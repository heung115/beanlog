-- Disposable database only. Exercise RPC validation and all-writer invariants.
begin;
insert into auth.users(id,email,raw_user_meta_data) values ('a3400000-0000-0000-0000-000000000001','collections@example.test','{}');
insert into auth.sessions(id,user_id,created_at) values ('b3400000-0000-0000-0000-000000000001','a3400000-0000-0000-0000-000000000001',now());
select set_config('request.jwt.claim.sub','a3400000-0000-0000-0000-000000000001',true),set_config('request.jwt.claims','{"role":"authenticated","sub":"a3400000-0000-0000-0000-000000000001","session_id":"b3400000-0000-0000-0000-000000000001"}',true);
set local role beanmap_api_runtime;
do $$
declare base jsonb:='{"name":"Bounded blend","roastery":"Fixture","note":"Saved note","bean_type":"blend","process_method":"washed","roast_level":"light","place_type":"home","overall_score":8,"consumed_at":"2026-01-01T00:00:00Z"}';
 bean jsonb; tags jsonb; components jsonb; original jsonb; before_tags jsonb; before_components jsonb; fixture_id uuid; version timestamptz; scenario text; operation text; item jsonb;
begin
 fixture_id:=public.create_bean_record(base,'[{"tag":"initial","category":"sweet"}]','[{"origin_country":"Ethiopia","percentage":100}]');
 select updated_at,to_jsonb(b) into version,original from public.beans b where id=fixture_id;
 select jsonb_agg(to_jsonb(t)) into before_tags from public.tasting_tags t where bean_id=fixture_id;
 select jsonb_agg(to_jsonb(c)) into before_components from public.blend_components c where bean_id=fixture_id;
 foreach scenario in array array['thirds','half-cent','zero','negative','total99.99','total100.01','21components','31tags','zero-weight','huge-weight','negative-sort','huge-sort','fractional-sort','null-sort','string-sort','unknown-bean','unknown-tag','unknown-component','tag-number','tag-category-missing','tag-blank','null-tags','null-components','bean-subregions11','bean-subregions-object','bean-subregions-empty','bean-subregions-blank','bean-subregions-long','bean-subregions-number','component-subregions11','component-subregions-empty','component-subregions-blank','component-subregions-long','component-subregions-number','numeric-string','fractional-integer'] loop
  bean:=base;tags:='[]';components:='[{"origin_country":"Ethiopia","percentage":100}]';
  case scenario
   when 'thirds' then components:='[{"origin_country":"A","percentage":33.333333},{"origin_country":"B","percentage":33.333333},{"origin_country":"C","percentage":33.333334}]';
   when 'half-cent' then components:='[{"origin_country":"A","percentage":0.005},{"origin_country":"B","percentage":99.995}]';
   when 'zero' then components:=jsonb_set(components,'{0,percentage}','0');
   when 'negative' then components:=jsonb_set(components,'{0,percentage}','-1');
   when 'total99.99' then components:=jsonb_set(components,'{0,percentage}','99.99');
   when 'total100.01' then components:='[{"origin_country":"A","percentage":50},{"origin_country":"B","percentage":50.01}]';
   when '21components' then select jsonb_agg(jsonb_build_object('origin_country','Fixture','percentage',case when n=21 then 5 else 4.75 end)) into components from generate_series(1,21)n;
   when '31tags' then select jsonb_agg(jsonb_build_object('tag','tag-'||n,'category','sweet')) into tags from generate_series(1,31)n;
   when 'zero-weight' then bean:=bean||'{"weight_g":0}';
   when 'huge-weight' then bean:=bean||'{"weight_g":100001}';
   when 'negative-sort' then components:=jsonb_set(components,'{0,sort_order}','-1');
   when 'huge-sort' then components:=jsonb_set(components,'{0,sort_order}','101');
   when 'fractional-sort' then components:=jsonb_set(components,'{0,sort_order}','0.5');
   when 'null-sort' then components:=jsonb_set(components,'{0,sort_order}','null');
   when 'string-sort' then components:=jsonb_set(components,'{0,sort_order}','"0"');
   when 'unknown-bean' then bean:=bean||'{"unsupported":true}';
   when 'unknown-tag' then tags:='[{"tag":"x","category":"sweet","unsupported":true}]';
   when 'unknown-component' then components:=jsonb_set(components,'{0,unsupported}','true');
   when 'tag-number' then tags:='[{"tag":123,"category":"sweet"}]';
   when 'tag-category-missing' then tags:='[{"tag":"x"}]';
   when 'tag-blank' then tags:='[{"tag":"   ","category":"sweet"}]';
   when 'null-tags' then tags:='null';
   when 'null-components' then components:='null';
   when 'numeric-string' then bean:=bean||'{"weight_g":"1"}';
   when 'fractional-integer' then bean:=bean||'{"weight_g":1.5}';
   else
    case split_part(scenario,'subregions-',2)
     when 'object' then item:='{}';
     when 'empty' then item:='[""]';
     when 'blank' then item:='[" \t\n"]';
     when 'long' then item:=jsonb_build_array(repeat('x',101));
     when 'number' then item:='[123]';
     else select jsonb_agg('entry-'||n) into item from generate_series(1,11)n;
    end case;
    if scenario like 'bean-%' then bean:=bean||jsonb_build_object('origin_subregions',item);
    else components:=jsonb_set(components,'{0,origin_subregions}',item); end if;
  end case;
  foreach operation in array array['create','update'] loop
   begin
    if operation='create' then perform public.create_bean_record(bean,tags,components);
    else perform public.update_bean_record(fixture_id,bean||jsonb_build_object('expected_updated_at',version),tags,components); end if;
    raise exception 'Accepted invalid %: %',operation,scenario;
   exception when invalid_parameter_value then null; end;
   if (select to_jsonb(b) from public.beans b where id=fixture_id) is distinct from original
    or (select jsonb_agg(to_jsonb(t)) from public.tasting_tags t where bean_id=fixture_id) is distinct from before_tags
    or (select jsonb_agg(to_jsonb(c)) from public.blend_components c where bean_id=fixture_id) is distinct from before_components then raise exception 'Invalid mutation changed saved data: %',scenario; end if;
  end loop;
 end loop;
 -- The upper supported bounds remain valid, with an exact persisted total.
 select jsonb_agg(jsonb_build_object('origin_country','Fixture','percentage',5,'sort_order',100,'origin_subregions',(select jsonb_agg('region-'||x) from generate_series(1,10)x))) into components from generate_series(1,20)n;
 select jsonb_agg(jsonb_build_object('tag','tag-'||n,'category','sweet')) into tags from generate_series(1,30)n;
 bean:=base||jsonb_build_object('weight_g',100000,'origin_subregions',(select jsonb_agg('region-'||x) from generate_series(1,10)x));
 perform public.update_bean_record(fixture_id,bean||jsonb_build_object('expected_updated_at',version),tags,components);
 if (select sum(percentage) from public.blend_components where bean_id=fixture_id)<>100 then raise exception 'Stored total differs from 100'; end if;
 set constraints all immediate;
 set constraints all deferred;
 -- Missing/null/empty subregions and the smallest percentage remain supported.
 perform public.create_bean_record(base||'{"origin_subregions":null}', '[]','[{"origin_country":"A","percentage":0.01,"origin_subregions":[]},{"origin_country":"B","percentage":99.99,"origin_subregions":null}]');
 perform set_config('beanmap.collection_fixture',fixture_id::text,true);
end $$;
reset role;
do $$ declare fixture_id uuid:=current_setting('beanmap.collection_fixture')::uuid; scenario text;
begin
 foreach scenario in array array['rounded-total','31tags','21components','sort','weight','subregions'] loop
  begin
   case scenario
    when 'rounded-total' then delete from public.blend_components where bean_id=fixture_id; insert into public.blend_components(bean_id,user_id,origin_country,percentage) select fixture_id,auth.uid(),'Fixture',33.333333 from generate_series(1,3);
    when '31tags' then insert into public.tasting_tags(bean_id,user_id,tag,category) values(fixture_id,auth.uid(),'over-limit','sweet');
    when '21components' then insert into public.blend_components(bean_id,user_id,origin_country,percentage) values(fixture_id,auth.uid(),'extra',0.01);
    when 'sort' then update public.blend_components set sort_order=-1 where bean_id=fixture_id;
    when 'weight' then update public.beans set weight_g=0 where id=fixture_id;
    when 'subregions' then update public.beans set origin_subregions=array[''] where id=fixture_id;
   end case;
   set constraints all immediate;
   raise exception 'All-writer constraint accepted %',scenario;
  exception when check_violation then null; end;
 end loop;
 set constraints all immediate;
end $$;
rollback;
