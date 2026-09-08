-- Disposable database only. No Auth HTTP requests or email delivery.
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('d0000000-0000-4000-8000-000000000001','delete-one@example.test',now(),'{}'),
 ('d0000000-0000-4000-8000-000000000002','delete-two@example.test',now(),'{}');
insert into auth.sessions(id,user_id) values
 ('e0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001'),
 ('e0000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000001'),
 ('e0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000002');
select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000001',true),
 set_config('request.jwt.claims','{"role":"authenticated","sub":"d0000000-0000-4000-8000-000000000001","session_id":"e0000000-0000-4000-8000-000000000001"}',true);
do $$ declare name text; signature text; begin
 foreach name in array array['anon','authenticated','service_role'] loop
  foreach signature in array array['begin_account_deletion(text,text)','reserve_account_deletion(text,text,text)','release_account_deletion(text)','complete_account_deletion(text,text,text)'] loop
   if has_function_privilege(name,'beanmap_security.'||signature,'execute') then raise exception 'Private function exposed to %: %',name,signature;end if;
  end loop;
 end loop;
 if has_table_privilege('beanmap_api_runtime','beanmap_security.account_deletion_challenges','select,insert,update,delete') then raise exception 'State table exposed';end if;
end $$;
set local role beanmap_api_runtime;
do $$ begin
 if beanmap_security.begin_account_deletion('delete-two@example.test',repeat('a',64)) <> 'email_unavailable' then raise exception 'Caller-supplied email accepted';end if;
 if beanmap_security.complete_account_deletion(repeat('a',64),'delete-one@example.test',repeat('b',64)) <> 'challenge_expired' then raise exception 'Deletion without proof allowed';end if;
 if beanmap_security.begin_account_deletion('delete-one@example.test',repeat('a',64)) <> 'ok' then raise exception 'Challenge issuance failed';end if;
 if beanmap_security.begin_account_deletion('delete-one@example.test',repeat('b',64)) <> 'rate_limited' then raise exception 'Resend cooldown absent';end if;
 if beanmap_security.reserve_account_deletion(repeat('b',64),'delete-one@example.test',repeat('c',64)) <> 'challenge_expired' then raise exception 'Wrong proof accepted';end if;
 if beanmap_security.reserve_account_deletion(repeat('a',64),'delete-two@example.test',repeat('c',64)) <> 'challenge_expired' then raise exception 'Wrong email accepted';end if;
 perform set_config('request.jwt.claims','{"role":"authenticated","sub":"d0000000-0000-4000-8000-000000000001","session_id":"e0000000-0000-4000-8000-000000000002"}',true);
 if beanmap_security.reserve_account_deletion(repeat('a',64),'delete-one@example.test',repeat('c',64)) <> 'challenge_expired' then raise exception 'Proof moved across sessions';end if;
 perform set_config('request.jwt.claims','{"role":"authenticated","sub":"d0000000-0000-4000-8000-000000000001","session_id":"e0000000-0000-4000-8000-000000000001"}',true);
 perform set_config('request.jwt.claims','{"role":"authenticated","sub":"d0000000-0000-4000-8000-000000000002","session_id":"e0000000-0000-4000-8000-000000000003"}',true);
 if beanmap_security.reserve_account_deletion(repeat('a',64),'delete-two@example.test',repeat('c',64)) <> 'challenge_expired' then raise exception 'Proof moved across users';end if;
 perform set_config('request.jwt.claims','{"role":"authenticated","sub":"d0000000-0000-4000-8000-000000000001","session_id":"e0000000-0000-4000-8000-000000000001"}',true);
 if beanmap_security.reserve_account_deletion(repeat('a',64),'delete-one@example.test',repeat('c',64)) <> 'ok' then raise exception 'Reservation failed';end if;
 if beanmap_security.reserve_account_deletion(repeat('a',64),'delete-one@example.test',repeat('d',64)) <> 'rate_limited' then raise exception 'Concurrent verification not serialized';end if;
 if beanmap_security.complete_account_deletion(repeat('a',64),'delete-one@example.test',repeat('d',64)) <> 'challenge_expired' then raise exception 'Wrong reservation accepted';end if;
 perform beanmap_security.release_account_deletion(repeat('c',64));
 if beanmap_security.complete_account_deletion(repeat('a',64),'delete-one@example.test',repeat('c',64)) <> 'challenge_expired' then raise exception 'Failed reservation replayed';end if;
end $$;
reset role;
do $$ declare attempt integer;begin
 if (select attempts from beanmap_security.account_deletion_challenges where user_id=auth.uid()) <> 1 then raise exception 'Release refunded attempts';end if;
 for attempt in 2..5 loop
  set local role beanmap_api_runtime;
  if beanmap_security.reserve_account_deletion(repeat('a',64),'delete-one@example.test',repeat('c',64)) <> 'ok' then raise exception 'Allowed attempt rejected';end if;
  perform beanmap_security.release_account_deletion(repeat('c',64));
  reset role;
 end loop;
 set local role beanmap_api_runtime;
 if beanmap_security.reserve_account_deletion(repeat('a',64),'delete-one@example.test',repeat('c',64)) <> 'rate_limited' then raise exception 'More than five attempts allowed';end if;
 reset role;
 update beanmap_security.account_deletion_challenges set sent_at=now()-interval '2 minutes' where user_id=auth.uid();
 set local role beanmap_api_runtime;
 if beanmap_security.begin_account_deletion('delete-one@example.test',repeat('d',64)) <> 'rate_limited' then raise exception 'Resend reset attempt window';end if;
 reset role;
 update beanmap_security.account_deletion_challenges set window_started_at=now()-interval '16 minutes' where user_id=auth.uid();
 set local role beanmap_api_runtime;
 if beanmap_security.begin_account_deletion('delete-one@example.test',repeat('d',64)) <> 'ok' then raise exception 'Expired fixed window did not recover';end if;
 reset role;
 if (select attempts from beanmap_security.account_deletion_challenges where user_id=auth.uid()) <> 0 then raise exception 'New window did not reset attempts';end if;
 update beanmap_security.account_deletion_challenges set expires_at=now()-interval '1 second' where user_id=auth.uid();
 set local role beanmap_api_runtime;
 if beanmap_security.reserve_account_deletion(repeat('d',64),'delete-one@example.test',repeat('c',64)) <> 'challenge_expired' then raise exception 'Expired proof accepted';end if;
 reset role;
 update beanmap_security.account_deletion_challenges set expires_at=now()+interval '4 minutes' where user_id=auth.uid();
 set local role beanmap_api_runtime;
 if beanmap_security.reserve_account_deletion(repeat('d',64),'delete-one@example.test',repeat('c',64)) <> 'ok' then raise exception 'Final reservation failed';end if;
 reset role;
 delete from auth.sessions where id='e0000000-0000-4000-8000-000000000001';
 set local role beanmap_api_runtime;
 begin
  perform beanmap_security.complete_account_deletion(repeat('d',64),'delete-one@example.test',repeat('c',64));
  raise exception 'Revoked session deletion accepted';
 exception when invalid_authorization_specification then null;end;
 reset role;
 insert into auth.sessions(id,user_id) values ('e0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001');
 set local role beanmap_api_runtime;
 if beanmap_security.complete_account_deletion(repeat('d',64),'delete-one@example.test',repeat('c',64)) <> 'ok' then raise exception 'Verified deletion failed';end if;
 reset role;
 if exists(select 1 from auth.users where id='d0000000-0000-4000-8000-000000000001') or exists(select 1 from public.profiles where id='d0000000-0000-4000-8000-000000000001') or exists(select 1 from beanmap_security.account_deletion_challenges where user_id='d0000000-0000-4000-8000-000000000001') then raise exception 'Deletion not atomic with dependent data and proof';end if;
 if not exists(select 1 from auth.users where id='d0000000-0000-4000-8000-000000000002') then raise exception 'Other account affected';end if;
end $$;
rollback;
