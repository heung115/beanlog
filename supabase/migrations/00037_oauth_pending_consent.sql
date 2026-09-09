-- New provider accounts cannot use application data until consent is recorded.
-- Existing users are deliberately not backfilled or marked as having agreed.
begin;
create table beanmap_signup.pending_oauth_consent (
  user_id uuid primary key references auth.users(id) on delete cascade deferrable initially deferred,
  provider text not null check (provider in ('google','kakao')),
  created_at timestamptz not null default clock_timestamp()
);
create table beanmap_signup.oauth_consent_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_id uuid not null,
  window_started_at timestamptz not null,
  attempts integer not null check (attempts between 1 and 11)
);
revoke all on all tables in schema beanmap_signup from public, anon, authenticated, service_role;
alter table beanmap_signup.consent_events drop constraint consent_events_source_check;
alter table beanmap_signup.consent_events drop constraint consent_events_path_check;
alter table beanmap_signup.consent_events add column provider text;
alter table beanmap_signup.consent_events add column auth_session_id uuid;
alter table beanmap_signup.consent_events add constraint consent_events_source_check check (source in ('email-signup','oauth-signup'));
alter table beanmap_signup.consent_events add constraint consent_events_path_check check (path in ('/signup','/consent'));
alter table beanmap_signup.consent_events add constraint consent_events_oauth_fields check (
  (source='email-signup' and path='/signup' and provider is null and auth_session_id is null)
  or (source='oauth-signup' and path='/consent' and provider in ('google','kakao') and auth_session_id is not null)
);

create function beanmap_signup.mark_new_oauth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare provider text;
begin
  if session_user in ('postgres','supabase_admin') then return new; end if;
  provider := new.raw_app_meta_data ->> 'provider';
  if provider in ('google','kakao') then
    insert into beanmap_signup.pending_oauth_consent(user_id,provider) values(new.id,provider);
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data,'{}'::jsonb) || '{"beanmap_pending_consent":true}'::jsonb;
  end if;
  return new;
end;
$$;
create trigger beanmap_pending_oauth_consent before insert on auth.users
for each row execute function beanmap_signup.mark_new_oauth_user();

-- Auth writes whole app-metadata snapshots during provider login. Derive the UI
-- hint from the private record on every write, never from a stale client snapshot.
create function beanmap_signup.sync_oauth_pending_hint() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from beanmap_signup.pending_oauth_consent where user_id=new.id) then
    new.raw_app_meta_data:=coalesce(new.raw_app_meta_data,'{}'::jsonb)||'{"beanmap_pending_consent":true}'::jsonb;
  else
    new.raw_app_meta_data:=coalesce(new.raw_app_meta_data,'{}'::jsonb)-'beanmap_pending_consent';
  end if;
  return new;
end;
$$;
create trigger beanmap_sync_oauth_pending_hint before update of raw_app_meta_data on auth.users
for each row execute function beanmap_signup.sync_oauth_pending_hint();

-- Copy the audited session check without changing its original OID: all existing
-- restrictive RLS policies and API require_current_session calls keep the wrapper.
do $$ declare definition text; begin
 select pg_get_functiondef('beanmap_security.current_session_valid()'::regprocedure) into definition;
 execute replace(definition,'beanmap_security.current_session_valid()', 'beanmap_security.current_auth_session_valid()');
end $$;
revoke all on function beanmap_security.current_auth_session_valid() from public, anon, authenticated, service_role, beanmap_api_runtime;
create or replace function beanmap_security.current_session_valid() returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if not beanmap_security.current_auth_session_valid() then return false; end if;
  return not exists(select 1 from beanmap_signup.pending_oauth_consent p
    where p.user_id=(current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid);
end;
$$;

create function public.complete_oauth_consent(assertion jsonb) returns boolean
language plpgsql volatile security definer set search_path = ''
set statement_timeout = '3s' set lock_timeout = '1s' as $$
declare
  claims jsonb;
  subject_id uuid;
  session_id uuid;
  pending_provider text;
  secret bytea;
  issued bigint;
  used_attempts integer;
  signed_text text;
  expected text;
begin
  -- This is the only data-write exception for pending users. JWT/session checks
  -- remain intact and ordinary application RLS/API paths still use the wrapper.
  if not beanmap_security.current_auth_session_valid() then return false; end if;
  claims := current_setting('request.jwt.claims',true)::jsonb;
  subject_id := (claims->>'sub')::uuid;
  session_id := (claims->>'session_id')::uuid;
  select p.provider into pending_provider from beanmap_signup.pending_oauth_consent p where p.user_id=subject_id for update;
  if pending_provider is null then
    -- Auth can write an older whole app-metadata snapshot during a concurrent
    -- OAuth login. The private pending row, not that UI hint, is authoritative.
    update auth.users set raw_app_meta_data=raw_app_meta_data-'beanmap_pending_consent'
      where id=subject_id and raw_app_meta_data ? 'beanmap_pending_consent';
    return true;
  end if;
  if assertion is null or jsonb_typeof(assertion)<>'object' or octet_length(assertion::text)>2048 then return false; end if;

  -- Commit rejected verification attempts rather than raising an exception that
  -- would refund the limit. The fixed account window survives session rotation.
  insert into beanmap_signup.oauth_consent_attempts(user_id,session_id,window_started_at,attempts)
  values(subject_id,session_id,clock_timestamp(),1)
  on conflict(user_id) do update set
    session_id=excluded.session_id,
    attempts=case when beanmap_signup.oauth_consent_attempts.window_started_at <= clock_timestamp()-interval '10 minutes'
      then 1 else least(beanmap_signup.oauth_consent_attempts.attempts+1,11) end,
    window_started_at=case when beanmap_signup.oauth_consent_attempts.window_started_at <= clock_timestamp()-interval '10 minutes'
      then clock_timestamp() else beanmap_signup.oauth_consent_attempts.window_started_at end
  returning attempts into used_attempts;
  if used_attempts>10 then return false; end if;
  if assertion->>'user_id' is distinct from subject_id::text
     or assertion->>'session_id' is distinct from session_id::text
     or assertion->>'provider' is distinct from pending_provider
     or assertion->>'terms_version' is distinct from '2026-08-26'
     or assertion->>'privacy_version' is distinct from '2026-08-26'
     or assertion->>'source' is distinct from 'oauth-signup'
     or assertion->>'path' is distinct from '/consent'
     or coalesce(assertion->>'nonce','') !~ '^[a-f0-9]{64}$'
     or coalesce(assertion->>'signature','') !~ '^[a-f0-9]{64}$'
     or coalesce(assertion->>'issued_at','') !~ '^[0-9]{10,11}$' then return false; end if;
  issued := (assertion->>'issued_at')::bigint;
  if to_timestamp(issued)<clock_timestamp()-interval '5 minutes'
     or to_timestamp(issued)>clock_timestamp()+interval '30 seconds' then return false; end if;
  select k.secret into secret from beanmap_signup.signing_key k where k.id;
  if secret is null then return false; end if;
  signed_text := concat_ws(E'\n','beanmap-oauth-consent-v1',subject_id::text,session_id::text,pending_provider,
    assertion->>'terms_version',assertion->>'privacy_version',assertion->>'issued_at',assertion->>'nonce',
    assertion->>'source',assertion->>'path');
  expected := encode(extensions.hmac(convert_to(signed_text,'UTF8'),secret,'sha256'),'hex');
  if expected<>assertion->>'signature' then return false; end if;
  -- Unique nonce and user constraints make replay fail without refunding attempts.
  insert into beanmap_signup.consent_events(user_id,terms_version,privacy_version,accepted_at,source,path,nonce,provider,auth_session_id)
  values(subject_id,assertion->>'terms_version',assertion->>'privacy_version',to_timestamp(issued),'oauth-signup','/consent',assertion->>'nonce',pending_provider,session_id)
  on conflict do nothing;
  if not found then return false; end if;
  delete from beanmap_signup.pending_oauth_consent where user_id=subject_id;
  update auth.users set raw_app_meta_data=raw_app_meta_data-'beanmap_pending_consent' where id=subject_id;
  return true;
end;
$$;
revoke all on all functions in schema beanmap_signup from public, anon, authenticated, service_role, beanmap_api_runtime;
revoke all on function public.complete_oauth_consent(jsonb) from public, anon, authenticated, service_role, beanmap_api_runtime;
grant execute on function public.complete_oauth_consent(jsonb) to authenticated;
comment on function public.complete_oauth_consent(jsonb) is 'Pending OAuth only: verified JWT/current session, signed consent, fixed per-account attempt budget; no ordinary data access.';
alter table beanmap_signup.pending_oauth_consent owner to postgres;
alter table beanmap_signup.oauth_consent_attempts owner to postgres;
alter function beanmap_signup.mark_new_oauth_user() owner to postgres;
alter function beanmap_signup.sync_oauth_pending_hint() owner to postgres;
alter function beanmap_security.current_auth_session_valid() owner to postgres;
alter function beanmap_security.current_session_valid() owner to postgres;
alter function public.complete_oauth_consent(jsonb) owner to postgres;
grant update (raw_app_meta_data) on auth.users to postgres;
commit;
