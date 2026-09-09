-- Disposable database: failed calls return false and their attempt rows commit.
begin;
create role oauth_fixture_auth nologin;
grant usage on schema auth to oauth_fixture_auth;
grant insert on auth.users to oauth_fixture_auth;
insert into beanmap_signup.signing_key(id,secret) values(true,decode(repeat('a',64),'hex'));
-- Represents a pre-migration account. Never invent acceptance or deny its session.
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data)
values('c3700000-0000-0000-0000-000000000009','oauth-legacy@example.test','{}','{"provider":"google"}');
set session authorization oauth_fixture_auth;
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values
 ('c3700000-0000-0000-0000-000000000001','oauth-one@example.test','{}','{"provider":"google"}'),
 ('c3700000-0000-0000-0000-000000000002','oauth-two@example.test','{}','{"provider":"kakao"}');
reset session authorization;
insert into auth.sessions(id,user_id) values
 ('d3700000-0000-0000-0000-000000000001','c3700000-0000-0000-0000-000000000001'),
 ('d3700000-0000-0000-0000-000000000002','c3700000-0000-0000-0000-000000000002'),
 ('d3700000-0000-0000-0000-000000000009','c3700000-0000-0000-0000-000000000009');
-- A stale/absent Auth UI hint cannot remove the authoritative pending boundary.
update auth.users set raw_app_meta_data=raw_app_meta_data-'beanmap_pending_consent' where id='c3700000-0000-0000-0000-000000000001';
do $$ begin
 if not exists(select 1 from auth.users where id='c3700000-0000-0000-0000-000000000001' and raw_app_meta_data->>'beanmap_pending_consent'='true') then raise exception 'Pending UI hint was removed while private pending record exists'; end if;
end $$;
create table public.oauth_consent_test_inputs(kind text primary key,assertion jsonb);
grant select on public.oauth_consent_test_inputs to authenticated;
do $$ declare item record; payload jsonb; canonical text; begin
 for item in select * from (values
  ('valid-one','c3700000-0000-0000-0000-000000000001','d3700000-0000-0000-0000-000000000001','google',repeat('1',64)),
  ('valid-two','c3700000-0000-0000-0000-000000000002','d3700000-0000-0000-0000-000000000002','kakao',repeat('2',64)),
  ('replay-two','c3700000-0000-0000-0000-000000000002','d3700000-0000-0000-0000-000000000002','kakao',repeat('1',64))
 ) as data(kind,user_id,session_id,provider,nonce) loop
  payload:=jsonb_build_object('user_id',item.user_id,'session_id',item.session_id,'provider',item.provider,
   'terms_version','2026-08-26','privacy_version','2026-08-26','issued_at',floor(extract(epoch from clock_timestamp()))::bigint,
   'nonce',item.nonce,'source','oauth-signup','path','/consent');
  canonical:=concat_ws(E'\n','beanmap-oauth-consent-v1',item.user_id,item.session_id,item.provider,'2026-08-26','2026-08-26',payload->>'issued_at',item.nonce,'oauth-signup','/consent');
  payload:=payload||jsonb_build_object('signature',encode(extensions.hmac(convert_to(canonical,'UTF8'),decode(repeat('a',64),'hex'),'sha256'),'hex'));
  insert into public.oauth_consent_test_inputs values(item.kind,payload);
 end loop;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"c3700000-0000-0000-0000-000000000001","session_id":"d3700000-0000-0000-0000-000000000001"}',true);
select set_config('request.jwt.claim.sub','c3700000-0000-0000-0000-000000000001',true);
do $$ declare proof jsonb; begin
 if beanmap_security.current_session_valid() then raise exception 'Pending OAuth gained data access'; end if;
 if exists(select 1 from public.profiles) then raise exception 'Pending OAuth bypassed restrictive RLS'; end if;
 begin
  perform beanmap_security.require_current_session();
  raise exception 'API session guard permitted pending account';
 exception when sqlstate '28000' then null; end;
 begin
  perform beanmap_security.current_auth_session_valid();
  raise exception 'Private original session helper exposed';
 exception when insufficient_privilege then null; end;
 select assertion into proof from public.oauth_consent_test_inputs where kind='valid-one';
 if public.complete_oauth_consent('{}') then raise exception 'Missing proof accepted'; end if;
 if public.complete_oauth_consent(proof||jsonb_build_object('signature',repeat('0',64))) then raise exception 'Forged proof accepted'; end if;
 if public.complete_oauth_consent(proof||'{"session_id":"d3700000-0000-0000-0000-000000000002"}') then raise exception 'Other session accepted'; end if;
 if public.complete_oauth_consent(proof||'{"user_id":"c3700000-0000-0000-0000-000000000002"}') then raise exception 'Other user accepted'; end if;
 if public.complete_oauth_consent(proof||'{"provider":"kakao"}') then raise exception 'Other provider accepted'; end if;
 if public.complete_oauth_consent(proof||'{"terms_version":"old"}') then raise exception 'Old terms accepted'; end if;
 if public.complete_oauth_consent(proof||jsonb_build_object('issued_at',floor(extract(epoch from clock_timestamp()))::bigint-600)) then raise exception 'Expired proof accepted'; end if;
 if not public.complete_oauth_consent(proof) then raise exception 'Valid consent failed'; end if;
 if not beanmap_security.current_session_valid() then raise exception 'Accepted OAuth still denied'; end if;
 if not public.complete_oauth_consent(proof) then raise exception 'Idempotent retry failed'; end if;
end $$;
reset role;
do $$ begin
 if (select attempts from beanmap_signup.oauth_consent_attempts where user_id='c3700000-0000-0000-0000-000000000001')<>8 then
  raise exception 'Rejected verifications refunded their attempt budget';
 end if;
 if (select count(*) from beanmap_signup.consent_events where user_id='c3700000-0000-0000-0000-000000000001')<>1 then raise exception 'Consent event missing or duplicated'; end if;
 if exists(select 1 from auth.users where id='c3700000-0000-0000-0000-000000000001' and raw_app_meta_data ? 'beanmap_pending_consent') then raise exception 'Pending UI flag remained'; end if;
end $$;
-- Simulate Auth persisting an older whole metadata snapshot after completion.
update auth.users set raw_app_meta_data=raw_app_meta_data||'{"beanmap_pending_consent":true}' where id='c3700000-0000-0000-0000-000000000001';
do $$ begin
 if exists(select 1 from auth.users where id='c3700000-0000-0000-0000-000000000001' and raw_app_meta_data ? 'beanmap_pending_consent') then raise exception 'Auth stale metadata restored completed pending hint'; end if;
end $$;
set local role authenticated;
do $$ begin
 if not public.complete_oauth_consent('{}') then raise exception 'Completed account could not repair stale Auth flag'; end if;
end $$;
reset role;
do $$ begin
 if exists(select 1 from auth.users where id='c3700000-0000-0000-0000-000000000001' and raw_app_meta_data ? 'beanmap_pending_consent') then raise exception 'Stale Auth pending flag caused permanent consent loop'; end if;
 if (select count(*) from beanmap_signup.consent_events where user_id='c3700000-0000-0000-0000-000000000001')<>1 then raise exception 'Idempotent flag repair rewrote consent'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"c3700000-0000-0000-0000-000000000002","session_id":"d3700000-0000-0000-0000-000000000002"}',true);
select set_config('request.jwt.claim.sub','c3700000-0000-0000-0000-000000000002',true);
do $$ declare proof jsonb; n integer; begin
 select assertion into proof from public.oauth_consent_test_inputs where kind='replay-two';
 if public.complete_oauth_consent(proof) then raise exception 'Consumed nonce replayed for another account'; end if;
 for n in 1..9 loop
  if public.complete_oauth_consent('{}') then raise exception 'Missing consent accepted'; end if;
 end loop;
 select assertion into proof from public.oauth_consent_test_inputs where kind='valid-two';
 if public.complete_oauth_consent(proof) then raise exception 'Exhausted account budget allowed consent'; end if;
 if beanmap_security.current_session_valid() then raise exception 'Exhausted pending account gained access'; end if;
end $$;
reset role;
update beanmap_signup.oauth_consent_attempts set window_started_at=clock_timestamp()-interval '11 minutes' where user_id='c3700000-0000-0000-0000-000000000002';
set local role authenticated;
do $$ declare proof jsonb; begin
 select assertion into proof from public.oauth_consent_test_inputs where kind='valid-two';
 if not public.complete_oauth_consent(proof) then raise exception 'Fresh fixed window did not recover'; end if;
end $$;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"c3700000-0000-0000-0000-000000000009","session_id":"d3700000-0000-0000-0000-000000000009"}',true);
select set_config('request.jwt.claim.sub','c3700000-0000-0000-0000-000000000009',true);
do $$ begin
 if not beanmap_security.current_session_valid() or not public.complete_oauth_consent('{}') then raise exception 'Legacy OAuth was disrupted'; end if;
end $$;
reset role;
do $$ begin
 if exists(select 1 from beanmap_signup.consent_events where user_id='c3700000-0000-0000-0000-000000000009') then raise exception 'Legacy consent fabricated'; end if;
 if has_function_privilege('anon','public.complete_oauth_consent(jsonb)','EXECUTE') then raise exception 'Anonymous consent endpoint exposed'; end if;
 if (select pg_get_userbyid(proowner) from pg_proc where oid='beanmap_security.current_auth_session_valid()'::regprocedure)<>'postgres' then raise exception 'Session definer owner mismatch'; end if;
end $$;
delete from auth.users where id::text like 'c3700000-%';
do $$ begin
 if exists(select 1 from beanmap_signup.consent_events where user_id::text like 'c3700000-%') then raise exception 'OAuth event retained after erasure'; end if;
end $$;
rollback;
