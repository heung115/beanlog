-- Disposable database only. Exercise the actual runtime role and roll back
-- all fixture data.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('a1000000-0000-0000-0000-000000000001','version-fixture@example.test','{}');
insert into auth.sessions(id,user_id,created_at) values
 ('b1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001',now());
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000001',true),
 set_config('request.jwt.claims','{"role":"authenticated","sub":"a1000000-0000-0000-0000-000000000001","session_id":"b1000000-0000-0000-0000-000000000001"}',true);
set local role beanmap_api_runtime;
do $$
declare fixture_id uuid; version_one timestamptz; version_two timestamptz; candidate jsonb;
 base jsonb := '{"name":"Version fixture","roastery":"Fixture","bean_type":"single_origin","process_method":"washed","roast_level":"medium","place_type":"home","overall_score":4,"consumed_at":"2026-01-01T00:00:00Z","note":""}';
begin
 fixture_id := public.create_bean_record(base,'[{"tag":"initial","category":"sweet"}]','[]');
 select updated_at into strict version_one from public.beans where id=fixture_id;
 for candidate in select value from jsonb_array_elements('[null,"","not-a-timestamp","2026-02-30T12:00:00Z","infinity","now","2026-09-08","2026-09-08T24:00:00Z",123,{},[]]') loop
  begin
   perform public.update_bean_record(fixture_id,base || jsonb_build_object('expected_updated_at',candidate),'[]','[]');
   raise exception 'Invalid edit version accepted';
  exception when invalid_parameter_value then null; end;
 end loop;
 begin
  perform public.update_bean_record(fixture_id,base,'[]','[]');
  raise exception 'Missing edit version accepted';
 exception when invalid_parameter_value then null; end;
 if (select updated_at from public.beans where id=fixture_id) <> version_one
   or (select count(*) from public.tasting_tags where bean_id=fixture_id) <> 1 then
  raise exception 'Rejected update changed record or dependent rows';
 end if;
 -- Two editors read version_one. Only the first may commit it.
 perform public.update_bean_record(fixture_id,base || jsonb_build_object('expected_updated_at',version_one,'name','Editor one'),'[{"tag":"first","category":"sweet"}]','[]');
 select updated_at into strict version_two from public.beans where id=fixture_id;
 if version_two <= version_one then raise exception 'Version did not advance'; end if;
 begin
  perform public.update_bean_record(fixture_id,base || jsonb_build_object('expected_updated_at',version_one,'name','Editor two'),'[]','[]');
  raise exception 'Stale edit version accepted';
 exception when sqlstate 'PT409' then null; end;
 if (select name from public.beans where id=fixture_id) <> 'Editor one'
   or (select tag from public.tasting_tags where bean_id=fixture_id) <> 'first' then
  raise exception 'Conflicting update changed saved data';
 end if;
 -- Refreshing the editor supplies the new version and permits its next edit.
 perform public.update_bean_record(fixture_id,base || jsonb_build_object('expected_updated_at',version_two,'name','Editor two refreshed'),'[]','[]');
 if (select name from public.beans where id=fixture_id) <> 'Editor two refreshed' then
  raise exception 'Fresh edit failed';
 end if;
end $$;
reset role;
-- CREATE OR REPLACE must retain the security-definer guard and exact ACL.
do $$ begin
 if not exists(select 1 from pg_proc where oid='public.update_bean_record(uuid,jsonb,jsonb,jsonb)'::regprocedure
   and proowner='postgres'::regrole and prosecdef
   and position('perform beanmap_security.require_current_session();' in prosrc)>0)
   or has_function_privilege('authenticated','public.update_bean_record(uuid,jsonb,jsonb,jsonb)','EXECUTE')
   or has_function_privilege('service_role','public.update_bean_record(uuid,jsonb,jsonb,jsonb)','EXECUTE')
   or not has_function_privilege('beanmap_api_runtime','public.update_bean_record(uuid,jsonb,jsonb,jsonb)','EXECUTE') then
  raise exception 'Edit function boundary changed';
 end if;
end $$;
rollback;
