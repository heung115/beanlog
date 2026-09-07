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
create schema auth;
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;
-- Reproduce Supabase additive defaults before migrations.
alter default privileges for role postgres in schema public grant execute on functions to anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public grant execute on functions to anon, authenticated, service_role;
SQL
for migration in "$root"/supabase/migrations/*.sql; do
  "${psql_test[@]}" -f "$migration" > /dev/null
done
"${psql_test[@]}" -f "$root/scripts/verify-function-acls.sql"
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
