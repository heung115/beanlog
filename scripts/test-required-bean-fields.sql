-- Disposable database only, after migration 00033. Fixtures and all mutations
-- roll back; assertions exercise the actual runtime role and mutation functions.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('a3300000-0000-0000-0000-000000000001','required-fields-fixture@example.test','{}');
insert into auth.sessions(id,user_id,created_at) values
 ('b3300000-0000-0000-0000-000000000001','a3300000-0000-0000-0000-000000000001',now());
select set_config('request.jwt.claim.sub','a3300000-0000-0000-0000-000000000001',true),
 set_config('request.jwt.claims','{"role":"authenticated","sub":"a3300000-0000-0000-0000-000000000001","session_id":"b3300000-0000-0000-0000-000000000001"}',true);
set local role beanmap_api_runtime;
do $$
declare
 fixture_id uuid; created_id uuid; original_version timestamptz;
 original_row jsonb; original_tags jsonb; original_components jsonb;
 base jsonb := '{"name":"Required fixture","roastery":"Fixture roastery","note":"Saved tasting note","bean_type":"single_origin","origin_country":"Ethiopia","process_method":"washed","roast_level":"light","place_type":"home","overall_score":4,"consumed_at":"2026-01-01T00:00:00Z"}';
 initial_components jsonb := '[{"origin_country":"Ethiopia","percentage":100,"sort_order":0}]';
 initial_tags jsonb := '[{"tag":"original","category":"sweet"}]';
 trim_space text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
 field text; candidate jsonb; bad_value jsonb; invalid_values jsonb; maximum_length integer;
 operation text; accepted boolean; before_count bigint;
begin
 -- A blend has dependent rows to protect, yet may omit a single country.
 fixture_id := public.create_bean_record((base-'origin_country') || '{"bean_type":"blend"}',initial_tags,initial_components);
 select updated_at,to_jsonb(b) into strict original_version,original_row from public.beans b where id=fixture_id;
 select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') into original_tags from public.tasting_tags t where bean_id=fixture_id;
 select coalesce(jsonb_agg(to_jsonb(c) order by id),'[]') into original_components from public.blend_components c where bean_id=fixture_id;
 select count(*) into before_count from public.beans;

 foreach field in array array['name','roastery','note','bean_type','process_method','roast_level','place_type','overall_score','consumed_at','origin_country'] loop
  maximum_length := case field when 'name' then 200 when 'roastery' then 200 when 'note' then 2000 when 'origin_country' then 100 else 2000 end;
  invalid_values := jsonb_build_array(null,123,true,false,'{}'::jsonb,'[]'::jsonb,'',trim_space,repeat('x',maximum_length+1));
  if field='overall_score' then
   invalid_values := invalid_values || '["4",0,-1,10.01,10.1,1000000000000000000000000000000]';
  elsif field='consumed_at' then
   invalid_values := invalid_values || '["now","infinity","-infinity","2026-01-01","2026-01-01T12:00:00","2026-02-30T12:00:00Z","2025-02-29T12:00:00Z","2026-01-01T24:00:00Z","2026-01-01T12:60:00Z","2026-01-01T12:00:00+25:00","0000-01-01T00:00:00Z"]';
  elsif field in ('bean_type','process_method','roast_level','place_type') then
   invalid_values := invalid_values || '["not-an-enum-value"]';
  end if;
  -- SQL NULL represents an omitted key; JSON null is separately exercised.
  for bad_value in select null::jsonb union all select value from jsonb_array_elements(invalid_values) loop
   candidate := case when bad_value is null then base-field else jsonb_set(base,array[field],bad_value) end;
   foreach operation in array array['create','update'] loop
    accepted := false;
    begin
     if operation='create' then
      perform public.create_bean_record(candidate,'[]','[]');
     else
      perform public.update_bean_record(fixture_id,candidate || jsonb_build_object('expected_updated_at',original_version),'[]','[]');
     end if;
     accepted := true;
    exception when invalid_parameter_value then null;
    end;
    if accepted then raise exception 'Required-field guard accepted % for %',field,operation; end if;
    if (select count(*) from public.beans) <> before_count then raise exception 'Rejected mutation inserted a record'; end if;
    if (select to_jsonb(b) from public.beans b where id=fixture_id) is distinct from original_row
      or (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.tasting_tags t where bean_id=fixture_id) is distinct from original_tags
      or (select coalesce(jsonb_agg(to_jsonb(c) order by id),'[]') from public.blend_components c where bean_id=fixture_id) is distinct from original_components then
     raise exception 'Rejected % changed saved row or dependent rows for %',operation,field;
    end if;
   end loop;
  end loop;
 end loop;

 -- The same complete ECMAScript trim set is normalized by create and update.
 candidate := base;
 foreach field in array array['name','roastery','note','origin_country'] loop
  candidate := jsonb_set(candidate,array[field],to_jsonb(trim_space || (base->>field) || trim_space));
 end loop;
 created_id := public.create_bean_record(candidate,'[]','[]');
 perform public.update_bean_record(fixture_id,candidate || jsonb_build_object('expected_updated_at',original_version),'[]','[]');
 foreach field in array array['name','roastery','note','origin_country'] loop
  if (select to_jsonb(b)->>field from public.beans b where id=created_id) is distinct from base->>field
    or (select to_jsonb(b)->>field from public.beans b where id=fixture_id) is distinct from base->>field then
   raise exception 'Create/update did not normalize whitespace in %',field;
  end if;
 end loop;
 -- Interior whitespace is meaningful and must not be collapsed.
 candidate := base || jsonb_build_object('note','First' || E'\n\t' || 'Second');
 created_id := public.create_bean_record(candidate,'[]','[]');
 if (select note from public.beans where id=created_id) <> 'First' || E'\n\t' || 'Second' then
  raise exception 'Interior note whitespace was altered';
 end if;
 -- Both score endpoints and a fractional number remain valid JSON numbers.
 foreach bad_value in array array['1'::jsonb,'10'::jsonb,'4.5'::jsonb] loop
  perform public.create_bean_record(jsonb_set(base,'{overall_score}',bad_value),'[]','[]');
 end loop;
 -- A real leap day and an explicit timezone offset remain accepted.
 perform public.create_bean_record(base || '{"consumed_at":"2024-02-29T12:34:56.123456+09:00"}','[]','[]');
 -- Update also permits blends without a single origin country.
 select updated_at into original_version from public.beans where id=created_id;
 perform public.update_bean_record(created_id,(base-'origin_country') || jsonb_build_object('bean_type','blend','expected_updated_at',original_version),initial_tags,initial_components);
 if (select bean_type from public.beans where id=created_id) <> 'blend' then raise exception 'Valid blend update failed'; end if;
 perform set_config('beanmap.test_required_single_id',fixture_id::text,true);
end $$;
reset role;

-- NOT VALID preserves pre-existing rows, while the table still guards every
-- new INSERT/UPDATE made by a privileged importer bypassing the RPC.
do $$
declare fixture_id uuid := current_setting('beanmap.test_required_single_id')::uuid;
 field text; original_row jsonb; modified_row jsonb; accepted boolean;
 blank text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
begin
 select to_jsonb(b) into strict original_row from public.beans b where id=fixture_id;
 foreach field in array array['name','roastery','note','origin_country'] loop
  if not exists(select 1 from pg_constraint where conrelid='public.beans'::regclass
    and contype='c' and not convalidated and position(field in pg_get_constraintdef(oid))>0) then
   raise exception 'Expected non-validating existing-row-safe CHECK for %',field;
  end if;
  accepted := false;
  begin
   execute format('update public.beans set %I=$1 where id=$2',field) using blank,fixture_id;
   accepted := true;
  exception when check_violation then null; end;
  if accepted then raise exception 'Table UPDATE accepted blank %',field; end if;
  modified_row := jsonb_set(original_row,array[field],to_jsonb(blank)) || jsonb_build_object('id',gen_random_uuid());
  accepted := false;
  begin
   insert into public.beans select (jsonb_populate_record(null::public.beans,modified_row)).*;
   accepted := true;
  exception when check_violation then null; end;
  if accepted then raise exception 'Table INSERT accepted blank %',field; end if;
  if (select to_jsonb(b) from public.beans b where id=fixture_id) is distinct from original_row then
   raise exception 'Rejected table update changed saved row';
  end if;
 end loop;
end $$;

-- Neither authenticated clients nor service-role PostgREST regain the RPCs.
set local role authenticated;
do $$ begin
 begin
  perform public.create_bean_record('{}','[]','[]');
  raise exception 'Authenticated direct create RPC is callable';
 exception when insufficient_privilege then null; end;
 begin
  perform public.update_bean_record(gen_random_uuid(),'{}','[]','[]');
  raise exception 'Authenticated direct update RPC is callable';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if has_function_privilege('service_role','public.create_bean_record(jsonb,jsonb,jsonb)','EXECUTE')
   or has_function_privilege('service_role','public.update_bean_record(uuid,jsonb,jsonb,jsonb)','EXECUTE') then
  raise exception 'Service role regained direct record mutations';
 end if;
end $$;
rollback;
