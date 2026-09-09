-- Email registration accepts only a short-lived, server-signed consent event.
-- No acceptance is invented for existing users or externally-created OAuth users.
begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists beanmap_signup;
revoke all on schema beanmap_signup from public, anon, authenticated, service_role;

create table beanmap_signup.signing_key (
  id boolean primary key default true check (id),
  secret bytea not null check (octet_length(secret) = 32)
);
create table beanmap_signup.consent_events (
  user_id uuid primary key references auth.users(id) on delete cascade deferrable initially deferred,
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null,
  recorded_at timestamptz not null default clock_timestamp(),
  source text not null check (source = 'email-signup'),
  path text not null check (path = '/signup'),
  nonce text not null unique check (nonce ~ '^[a-f0-9]{64}$')
);
revoke all on all tables in schema beanmap_signup from public, anon, authenticated, service_role;

create function beanmap_signup.reject_event_mutation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Account erasure cascades the event. No application role can update/delete it.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return old; end if;
  raise exception using errcode = '42501', message = 'Consent events are immutable';
end;
$$;
create trigger signup_consent_immutable before update or delete on beanmap_signup.consent_events
for each row execute function beanmap_signup.reject_event_mutation();

create function beanmap_signup.verify_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  assertion jsonb;
  secret bytea;
  issued bigint;
  signed_text text;
  expected text;
  provider text;
begin
  -- Privileged SQL provisioning is an operator boundary, not a claim of consent.
  -- This also lets isolated DB fixtures create users without fabricating events.
  if session_user in ('postgres', 'supabase_admin') then return new; end if;
  provider := new.raw_app_meta_data ->> 'provider';
  if provider in ('google', 'kakao') then return new; end if;
  assertion := new.raw_user_meta_data -> 'beanmap_signup_consent';
  if assertion is null or jsonb_typeof(assertion) <> 'object'
     or assertion ->> 'email' is distinct from lower(new.email)
     or assertion ->> 'terms_version' is distinct from '2026-08-26'
     or assertion ->> 'privacy_version' is distinct from '2026-08-26'
     or assertion ->> 'source' is distinct from 'email-signup'
     or assertion ->> 'path' is distinct from '/signup'
     or coalesce(assertion ->> 'nonce', '') !~ '^[a-f0-9]{64}$'
     or coalesce(assertion ->> 'signature', '') !~ '^[a-f0-9]{64}$'
     or coalesce(assertion ->> 'issued_at', '') !~ '^[0-9]{10,11}$' then
    raise exception using errcode = '42501', message = 'Verified signup consent required';
  end if;
  issued := (assertion ->> 'issued_at')::bigint;
  if to_timestamp(issued) < clock_timestamp() - interval '5 minutes'
     or to_timestamp(issued) > clock_timestamp() + interval '30 seconds' then
    raise exception using errcode = '42501', message = 'Verified signup consent required';
  end if;
  select k.secret into secret from beanmap_signup.signing_key k where k.id;
  if secret is null then
    raise exception using errcode = '42501', message = 'Verified signup consent required';
  end if;
  signed_text := concat_ws(E'\n', 'beanmap-signup-v1', lower(new.email), assertion ->> 'terms_version',
    assertion ->> 'privacy_version', assertion ->> 'issued_at', assertion ->> 'nonce',
    assertion ->> 'source', assertion ->> 'path');
  expected := encode(extensions.hmac(convert_to(signed_text, 'UTF8'), secret, 'sha256'), 'hex');
  if expected <> assertion ->> 'signature' then
    raise exception using errcode = '42501', message = 'Verified signup consent required';
  end if;
  insert into beanmap_signup.consent_events(user_id, terms_version, privacy_version, accepted_at, source, path, nonce)
  values(new.id, assertion ->> 'terms_version', assertion ->> 'privacy_version', to_timestamp(issued),
    assertion ->> 'source', assertion ->> 'path', assertion ->> 'nonce');
  -- The assertion/signature is consumed, not published as editable user metadata.
  new.raw_user_meta_data := new.raw_user_meta_data - 'beanmap_signup_consent';
  return new;
end;
$$;
revoke all on all functions in schema beanmap_signup from public, anon, authenticated, service_role;
create trigger beanmap_verified_signup_consent before insert on auth.users
for each row execute function beanmap_signup.verify_new_user();
-- Migration execution may use supabase_admin while runtime definers use postgres.
alter schema beanmap_signup owner to postgres;
alter table beanmap_signup.signing_key owner to postgres;
alter table beanmap_signup.consent_events owner to postgres;
alter function beanmap_signup.reject_event_mutation() owner to postgres;
alter function beanmap_signup.verify_new_user() owner to postgres;
grant usage on schema extensions to postgres;
grant execute on function extensions.hmac(bytea,bytea,text) to postgres;
commit;
