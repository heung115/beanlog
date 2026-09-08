-- Disposable database only: functional authorization tests, rolled back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('a0000000-0000-0000-0000-000000000001','session-one@example.test','{}'),
 ('a0000000-0000-0000-0000-000000000002','session-two@example.test','{}');
insert into auth.sessions(id,user_id,created_at) values
 ('b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',now()),
 ('b0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000002',now());
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true),
 set_config('request.jwt.claims','{"role":"authenticated","sub":"a0000000-0000-0000-0000-000000000001","session_id":"b0000000-0000-0000-0000-000000000001"}',true);
set local role authenticated;
do $$ begin
 if not beanmap_security.current_session_valid() then raise exception 'Valid session denied'; end if;
 if (select count(*) from public.profiles) <> 1 then raise exception 'Valid owner read/foreign isolation broken'; end if;
 begin
  update public.profiles set display_name='invalid';
  raise exception 'Direct preference update allowed';
 exception when insufficient_privilege then null; end;
 begin
  perform public.delete_current_account();
  raise exception 'Ordinary account deletion allowed';
 exception when insufficient_privilege then null; end;
 begin
  perform public.delete_bean_record(gen_random_uuid());
  raise exception 'Direct mutation allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role beanmap_api_runtime;
do $$ declare bean_id uuid; begin
 update public.profiles set display_name='valid' where id=auth.uid();
 if not found then raise exception 'Valid API preference update denied'; end if;
 bean_id := public.create_bean_record('{"name":"Session fixture","roastery":"Fixture","bean_type":"single_origin","process_method":"washed","roast_level":"medium","place_type":"home","overall_score":4,"consumed_at":"2026-01-01T00:00:00Z","note":""}', '[]','[]');
 perform public.update_bean_record(bean_id,jsonb_build_object('expected_updated_at',(select updated_at from public.beans where id=bean_id)) || '{"name":"Updated fixture","roastery":"Fixture","bean_type":"single_origin","process_method":"washed","roast_level":"medium","place_type":"home","overall_score":4,"consumed_at":"2026-01-01T00:00:00Z","note":""}', '[]','[]');
 if not public.delete_bean_record(bean_id) then raise exception 'API delete failed'; end if;
 begin
  perform public.delete_current_account();
  raise exception 'API ordinary account deletion allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Keep the same signed identity as its backing session/user changes.
do $$
declare scenario text; item record; row_count bigint; claims text; mutation text;
begin
 claims := current_setting('request.jwt.claims');
 foreach scenario in array array['removed','mismatched','banned','deleted','not_after','timebox','inactive','missing_sid','malformed_sid','missing_claims','malformed_claims'] loop
  begin
   case scenario
    when 'removed' then delete from auth.sessions where id='b0000000-0000-0000-0000-000000000001';
    when 'mismatched' then update auth.sessions set user_id='a0000000-0000-0000-0000-000000000002' where id='b0000000-0000-0000-0000-000000000001';
    when 'banned' then update auth.users set banned_until=now()+interval '1 day' where id=auth.uid();
    when 'deleted' then update auth.users set deleted_at=now() where id=auth.uid();
    when 'not_after' then update auth.sessions set not_after=now()-interval '1 second' where user_id=auth.uid();
    when 'timebox' then update auth.sessions set created_at=now()-interval '721 hours',refreshed_at=now() at time zone 'UTC' where user_id=auth.uid();
    when 'inactive' then update auth.sessions set created_at=now()-interval '169 hours',refreshed_at=(now()-interval '169 hours') at time zone 'UTC' where user_id=auth.uid();
    when 'missing_sid' then perform set_config('request.jwt.claims',(claims::jsonb-'session_id')::text,true);
    when 'malformed_sid' then perform set_config('request.jwt.claims',jsonb_set(claims::jsonb,'{session_id}','"bad"')::text,true);
    when 'missing_claims' then perform set_config('request.jwt.claims','',true);
    when 'malformed_claims' then perform set_config('request.jwt.claims','{bad',true);
   end case;
   set local role authenticated;
   if beanmap_security.current_session_valid() then raise exception 'Session unexpectedly valid: %',scenario; end if;
   for item in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p') and has_table_privilege(current_user,c.oid,'SELECT')
   loop
    execute format('select count(*) from public.%I',item.relname) into row_count;
    if row_count <> 0 then raise exception 'Stale session read %: %', item.relname,scenario; end if;
   end loop;
   reset role;
   set local role beanmap_api_runtime;
   update public.profiles set display_name='invalid';
   if found then raise exception 'Stale preference update allowed: %',scenario; end if;
   foreach mutation in array array[
    'select public.create_bean_record(''{}'',''[]'',''[]'')',
    'select public.update_bean_record(''c0000000-0000-0000-0000-000000000001'',''{}'',''[]'',''[]'')',
    'select public.delete_bean_record(''c0000000-0000-0000-0000-000000000001'')'
   ] loop
    begin
     execute mutation;
     raise exception 'Stale SECURITY DEFINER mutation allowed: %',scenario;
    exception when invalid_authorization_specification then null; end;
   end loop;
   reset role;
   raise exception 'restore fixture' using errcode='Z0001';
  exception when sqlstate 'Z0001' then null;
  end;
 end loop;
end $$;
rollback;

-- Real connection identities can assume only the separately provisioned role.
set session authorization beanmap_api;
begin;
set local role beanmap_api_runtime;
select beanmap_security.current_session_valid();
rollback;
reset session authorization;
set session authorization beanlog_api;
begin;
set local role beanmap_api_runtime;
select beanmap_security.current_session_valid();
rollback;
reset session authorization;
