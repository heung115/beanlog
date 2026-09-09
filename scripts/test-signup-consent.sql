-- Disposable database only. The transaction leaves no users, keys or fixture roles.
begin;
create role signup_fixture_auth nologin;
grant usage on schema auth to signup_fixture_auth;
grant insert, select on auth.users to signup_fixture_auth;
insert into beanmap_signup.signing_key(id,secret) values(true,decode(repeat('a',64),'hex'));
create table public.signup_consent_test_inputs(kind text primary key, user_id uuid, email text, metadata jsonb);
grant select on public.signup_consent_test_inputs to signup_fixture_auth;

do $$
declare item record; payload jsonb; signed_text text;
begin
  for item in select * from (values
    ('valid',1,'signup-valid@example.test',repeat('1',64),0),
    ('forged',2,'signup-forged@example.test',repeat('2',64),0),
    ('expired',3,'signup-expired@example.test',repeat('3',64),-600),
    ('wrong-email',4,'signup-wrong@example.test',repeat('4',64),0),
    ('replay',5,'signup-replay@example.test',repeat('1',64),0),
    ('rollback',6,'signup-rollback@example.test',repeat('6',64),0)
  ) as rows(kind,number,email,nonce,offset_seconds) loop
    payload := jsonb_build_object('email',item.email,'terms_version','2026-08-26','privacy_version','2026-08-26',
      'issued_at',floor(extract(epoch from clock_timestamp()))::bigint+item.offset_seconds,
      'nonce',item.nonce,'source','email-signup','path','/signup');
    signed_text := concat_ws(E'\n','beanmap-signup-v1',payload->>'email',payload->>'terms_version',
      payload->>'privacy_version',payload->>'issued_at',payload->>'nonce',payload->>'source',payload->>'path');
    payload := payload || jsonb_build_object('signature',encode(extensions.hmac(convert_to(signed_text,'UTF8'),decode(repeat('a',64),'hex'),'sha256'),'hex'));
    if item.kind = 'forged' then payload := payload || jsonb_build_object('signature',repeat('0',64)); end if;
    if item.kind = 'wrong-email' then payload := payload || jsonb_build_object('email','someone-else@example.test'); end if;
    insert into public.signup_consent_test_inputs values(item.kind,('b3600000-0000-0000-0000-'||lpad(item.number::text,12,'0'))::uuid,item.email,
      jsonb_build_object('display_name','Consent fixture','beanmap_signup_consent',payload));
  end loop;
  insert into public.signup_consent_test_inputs values
    ('missing','b3600000-0000-0000-0000-000000000010','signup-missing@example.test','{}'),
    ('mutable-claim','b3600000-0000-0000-0000-000000000011','signup-mutable@example.test','{"accepted_terms":true,"terms_version":"2026-08-26"}');
end $$;

set session authorization signup_fixture_auth;
-- Production Auth also has a non-operator session_user, so the real trigger runs.
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data)
select user_id,email,metadata,'{"provider":"email"}' from public.signup_consent_test_inputs where kind='valid';

do $$ declare item record; rejected boolean; begin
 for item in select * from public.signup_consent_test_inputs where kind not in ('valid','rollback') loop
  rejected := false;
  begin
   insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data)
   values(item.user_id,item.email,item.metadata,'{"provider":"email"}');
  exception when insufficient_privilege or unique_violation then rejected := true;
  end;
  if not rejected then raise exception 'Untrusted consent accepted: %',item.kind; end if;
 end loop;
 begin
  insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data)
  select user_id,email,metadata,'{"provider":"email"}' from public.signup_consent_test_inputs where kind='rollback';
  raise exception using errcode='P1234', message='Fixture rollback';
 exception when sqlstate 'P1234' then null;
 end;
end $$;
-- OAuth remains unchanged, and is explicitly not represented as accepted terms.
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data)
values('b3600000-0000-0000-0000-000000000020','signup-oauth@example.test','{}','{"provider":"google"}');
reset session authorization;
set constraints all immediate;

do $$ begin
 if (select count(*) from beanmap_signup.consent_events where user_id::text like 'b3600000-%') <> 1 then
  raise exception 'Consent was missing, fabricated, or survived a transaction rollback';
 end if;
 if exists(select 1 from auth.users where id='b3600000-0000-0000-0000-000000000006') then
  raise exception 'Auth user survived rollback';
 end if;
 if exists(select 1 from auth.users where id='b3600000-0000-0000-0000-000000000001' and raw_user_meta_data ? 'beanmap_signup_consent') then
  raise exception 'Consumed signed assertion leaked through user metadata';
 end if;
 begin
  update beanmap_signup.consent_events set terms_version='forged' where user_id='b3600000-0000-0000-0000-000000000001';
  raise exception 'Immutable consent was changed';
 exception when insufficient_privilege then null;
 end;
 if has_schema_privilege('authenticated','beanmap_signup','USAGE') or has_schema_privilege('anon','beanmap_signup','USAGE')
  or has_table_privilege('service_role','beanmap_signup.signing_key','SELECT') then
  raise exception 'Signing material or consent schema exposed';
 end if;
end $$;
delete from auth.users where id='b3600000-0000-0000-0000-000000000001';
do $$ begin
 if exists(select 1 from beanmap_signup.consent_events where user_id='b3600000-0000-0000-0000-000000000001') then
  raise exception 'Consent retained after account erasure';
 end if;
end $$;
rollback;
