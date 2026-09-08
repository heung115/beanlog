-- Destructive account actions require fresh email possession, checked by the API.
-- PostgREST/authenticated cannot mint, inspect, consume, or bypass this state.
begin;
create table beanmap_security.account_deletion_challenges (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_id uuid not null,
  email text not null,
  challenge_hash text not null check (challenge_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  window_started_at timestamptz not null,
  sent_at timestamptz not null,
  sends integer not null check (sends between 1 and 5),
  attempts integer not null default 0 check (attempts between 0 and 5),
  attempt_hash text,
  attempt_expires_at timestamptz
);
alter table beanmap_security.account_deletion_challenges owner to postgres;
revoke all on beanmap_security.account_deletion_challenges from public, anon, authenticated, service_role, beanmap_api_runtime;

create function beanmap_security.begin_account_deletion(email_address text, proof_hash text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (current_setting('request.jwt.claims')::jsonb->>'sub')::uuid;
  sid uuid := (current_setting('request.jwt.claims')::jsonb->>'session_id')::uuid;
  challenge beanmap_security.account_deletion_challenges%rowtype;
  now_at timestamptz := clock_timestamp();
begin
  perform beanmap_security.require_current_session();
  if proof_hash is null or proof_hash !~ '^[a-f0-9]{64}$' then return 'challenge_expired'; end if;
  -- The user row serializes first issuance as well as repeated requests.
  perform 1 from auth.users where id=uid and email=email_address and email_confirmed_at is not null for update;
  if not found then return 'email_unavailable'; end if;
  select * into challenge from beanmap_security.account_deletion_challenges where user_id=uid for update;
  if found and (challenge.sent_at > now_at - interval '60 seconds' or
    (challenge.window_started_at > now_at - interval '15 minutes' and (challenge.sends >= 5 or challenge.attempts >= 5))) then
    return 'rate_limited';
  end if;
  if challenge.window_started_at is null or challenge.window_started_at <= now_at - interval '15 minutes' then
    challenge.window_started_at := now_at;
    challenge.sends := 0;
    challenge.attempts := 0;
  end if;
  insert into beanmap_security.account_deletion_challenges
    (user_id,session_id,email,challenge_hash,expires_at,window_started_at,sent_at,sends,attempts)
  values (uid,sid,email_address,proof_hash,now_at + interval '5 minutes',challenge.window_started_at,now_at,challenge.sends+1,challenge.attempts)
  on conflict (user_id) do update set session_id=excluded.session_id,email=excluded.email,
    challenge_hash=excluded.challenge_hash,expires_at=excluded.expires_at,window_started_at=excluded.window_started_at,
    sent_at=excluded.sent_at,sends=excluded.sends,attempts=excluded.attempts,attempt_hash=null,attempt_expires_at=null;
  return 'ok';
end;
$$;

create function beanmap_security.reserve_account_deletion(proof_hash text, email_address text, reservation_hash text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (current_setting('request.jwt.claims')::jsonb->>'sub')::uuid;
  sid uuid := (current_setting('request.jwt.claims')::jsonb->>'session_id')::uuid;
  challenge beanmap_security.account_deletion_challenges%rowtype;
  now_at timestamptz := clock_timestamp();
begin
  perform beanmap_security.require_current_session();
  if reservation_hash is null or reservation_hash !~ '^[a-f0-9]{64}$' then return 'challenge_expired'; end if;
  select * into challenge from beanmap_security.account_deletion_challenges where user_id=uid for update;
  if not found or challenge.session_id <> sid or challenge.email <> email_address or
    challenge.challenge_hash is distinct from proof_hash or challenge.expires_at <= now_at then return 'challenge_expired'; end if;
  if challenge.attempts >= 5 or challenge.attempt_expires_at > now_at then return 'rate_limited'; end if;
  if not exists (select 1 from auth.users where id=uid and email=email_address and email_confirmed_at is not null) then
    return 'email_unavailable';
  end if;
  update beanmap_security.account_deletion_challenges set attempts=attempts+1,
    attempt_hash=reservation_hash,attempt_expires_at=now_at+interval '30 seconds' where user_id=uid;
  return 'ok';
end;
$$;

create function beanmap_security.release_account_deletion(reservation_hash text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform beanmap_security.require_current_session();
  update beanmap_security.account_deletion_challenges set attempt_hash=null,attempt_expires_at=null
    where user_id=(current_setting('request.jwt.claims')::jsonb->>'sub')::uuid
      and session_id=(current_setting('request.jwt.claims')::jsonb->>'session_id')::uuid
      and attempt_hash=reservation_hash;
end;
$$;

-- Only the API may call this after it has directly verified a fresh email OTP.
-- Reservations are one-use and session/purpose bound; deleting the user atomically
-- consumes its challenge by FK cascade together with all other account data.
create function beanmap_security.complete_account_deletion(proof_hash text, email_address text, reservation_hash text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (current_setting('request.jwt.claims')::jsonb->>'sub')::uuid;
  sid uuid := (current_setting('request.jwt.claims')::jsonb->>'session_id')::uuid;
  challenge beanmap_security.account_deletion_challenges%rowtype;
  now_at timestamptz := clock_timestamp();
begin
  perform beanmap_security.require_current_session();
  select * into challenge from beanmap_security.account_deletion_challenges where user_id=uid for update;
  if not found or challenge.session_id <> sid or challenge.email <> email_address or
    challenge.challenge_hash is distinct from proof_hash or challenge.expires_at <= now_at or
    challenge.attempt_hash is null or challenge.attempt_hash is distinct from reservation_hash or
    challenge.attempt_expires_at is null or challenge.attempt_expires_at <= now_at then return 'challenge_expired'; end if;
  delete from auth.users where id=uid and email=email_address and email_confirmed_at is not null;
  if not found then return 'email_unavailable'; end if;
  return 'ok';
end;
$$;
alter function beanmap_security.begin_account_deletion(text,text) owner to postgres;
alter function beanmap_security.reserve_account_deletion(text,text,text) owner to postgres;
alter function beanmap_security.release_account_deletion(text) owner to postgres;
alter function beanmap_security.complete_account_deletion(text,text,text) owner to postgres;
revoke all on function beanmap_security.begin_account_deletion(text,text),
  beanmap_security.reserve_account_deletion(text,text,text),
  beanmap_security.release_account_deletion(text),
  beanmap_security.complete_account_deletion(text,text,text)
  from public, anon, authenticated, service_role;
grant execute on function beanmap_security.begin_account_deletion(text,text),
  beanmap_security.reserve_account_deletion(text,text,text),
  beanmap_security.release_account_deletion(text),
  beanmap_security.complete_account_deletion(text,text,text) to beanmap_api_runtime;
commit;
