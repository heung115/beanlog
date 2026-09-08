#!/usr/bin/env bash
set -euo pipefail
# Must target a disposable test database. No production URL is inferred.
: "${ACL_TEST_DATABASE_URL:?Set ACL_TEST_DATABASE_URL to a disposable test database}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
psql_test=(psql -X "$ACL_TEST_DATABASE_URL" -v ON_ERROR_STOP=1)
"${psql_test[@]}" <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create role supabase_admin nologin;
create role beanmap_api login noinherit;
create role beanlog_api login noinherit;
create schema auth;
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb, banned_until timestamptz, deleted_at timestamptz, email_confirmed_at timestamptz);
create table auth.sessions(id uuid primary key, user_id uuid references auth.users(id) on delete cascade, created_at timestamptz not null default now(), refreshed_at timestamp, not_after timestamptz);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;
-- Reproduce Supabase additive defaults before migrations.
alter default privileges for role postgres in schema public grant execute on functions to anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public grant execute on functions to anon, authenticated, service_role;
SQL
for migration in "$root"/supabase/migrations/*.sql; do
  if [[ "$(basename "$migration")" == "00032_origin_contact_minimization.sql" ]]; then
    "${psql_test[@]}" <<'SQL'
insert into public.origin_entities(source_key,country_id,name,farm_name,producer_name)
select 'privacy-upgrade-fixture',id,'fixture@example.test','+1 (202) 555-0100','Valid Fixture Producer'
from public.origin_countries limit 1;
insert into public.origin_entities(source_key,country_id,name)
select 'privacy-contact-only-fixture',id,'fixture@example.test' from public.origin_countries limit 1;
SQL
  fi
  if [[ "$(basename "$migration")" == "00033_required_bean_fields.sql" ]]; then
    "${psql_test[@]}" <<'SQL'
insert into auth.users(id,email,raw_user_meta_data) values
 ('a3300000-0000-0000-0000-000000000099','legacy-required-fixture@example.test','{}');
insert into public.beans(id,user_id,name,roastery,bean_type,origin_country,process_method,roast_level,place_type,overall_score,note)
values ('c3300000-0000-0000-0000-000000000099','a3300000-0000-0000-0000-000000000099','   ',E'\t','single_origin',null,'washed','light','home',4,'');
SQL
  fi
  "${psql_test[@]}" -f "$migration" > /dev/null
done
"${psql_test[@]}" <<'SQL'
do $$ begin
 if not exists(select 1 from public.beans where id='c3300000-0000-0000-0000-000000000099'
   and name='   ' and roastery=E'\t' and note='' and origin_country is null) then
  raise exception 'Required-field upgrade rewrote or removed a legacy record';
 end if;
end $$;
delete from auth.users where id='a3300000-0000-0000-0000-000000000099';
SQL
"${psql_test[@]}" -f "$root/scripts/verify-function-acls.sql"
"${psql_test[@]}" -f "$root/scripts/test-current-session.sql"
"${psql_test[@]}" -f "$root/scripts/test-mandatory-edit-version.sql"
"${psql_test[@]}" -f "$root/scripts/test-required-bean-fields.sql"
"${psql_test[@]}" -f "$root/scripts/test-account-deletion.sql"
"${psql_test[@]}" -f "$root/scripts/test-origin-contact.sql"
"${psql_test[@]}" -c 'grant select (name) on public.origin_entities to authenticated' > /dev/null
if "${psql_test[@]}" -f "$root/scripts/verify-function-acls.sql" > /dev/null 2>&1; then
  echo 'ACL checker missed a raw origin column grant' >&2
  exit 1
fi
"${psql_test[@]}" -c 'revoke select (name) on public.origin_entities from authenticated' > /dev/null
# Future functions from either owner must remain inaccessible.
"${psql_test[@]}" <<'SQL'
create function public.acl_postgres_probe() returns int language sql as $$ select 1 $$;
grant create on schema public to supabase_admin;
set role supabase_admin;
create function public.acl_admin_probe() returns int language sql as $$ select 1 $$;
reset role;
SQL
"${psql_test[@]}" -f "$root/scripts/verify-function-acls.sql"
"${psql_test[@]}" -c 'grant execute on function public.acl_postgres_probe() to authenticated' > /dev/null
if "${psql_test[@]}" -f "$root/scripts/verify-function-acls.sql" > /dev/null 2>&1; then
  echo 'ACL checker failed to detect unexpected grant' >&2
  exit 1
fi
"${psql_test[@]}" -c 'revoke execute on function public.acl_postgres_probe() from authenticated' > /dev/null
"${psql_test[@]}" -c 'alter default privileges for role supabase_admin in schema public grant execute on functions to anon' > /dev/null
if "${psql_test[@]}" -f "$root/scripts/verify-function-acls.sql" > /dev/null 2>&1; then
  echo 'ACL checker failed to detect broad defaults' >&2
  exit 1
fi
echo 'Function ACL regression checks passed'
