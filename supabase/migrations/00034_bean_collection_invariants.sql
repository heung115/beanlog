-- Align collection, scalar and persisted blend boundaries for every writer.
begin;
create function beanmap_security.valid_subregions(values_to_check text[])
returns boolean language sql immutable security invoker set search_path='' as $$
 select values_to_check is null or (
   coalesce(array_ndims(values_to_check),1)=1 and cardinality(values_to_check)<=10
   and not exists(select 1 from unnest(values_to_check) v where v is null
     or char_length(btrim(v,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')) not between 1 and 100
     or char_length(v)>100));
$$;
create function beanmap_security.assert_subregion_json(value_to_check jsonb)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if value_to_check is null or value_to_check='null'::jsonb then return; end if;
 if jsonb_typeof(value_to_check) is distinct from 'array' then
  raise exception 'Invalid subregions' using errcode='22023'; end if;
 if jsonb_array_length(value_to_check)>10 or exists(select 1 from jsonb_array_elements(value_to_check) v where jsonb_typeof(v) is distinct from 'string') then
  raise exception 'Invalid subregions' using errcode='22023'; end if;
 if not beanmap_security.valid_subregions(array(select jsonb_array_elements_text(value_to_check))) then
  raise exception 'Invalid subregions' using errcode='22023'; end if;
end $$;

create or replace function public.assert_bean_mutation_payload(p_bean jsonb,p_tags jsonb,p_components jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare item jsonb; key text; value jsonb; number_value numeric; total numeric:=0;
begin
 if jsonb_typeof(p_bean) is distinct from 'object' or jsonb_typeof(p_tags) is distinct from 'array' or jsonb_typeof(p_components) is distinct from 'array' then
  raise exception 'Invalid payload' using errcode='22023'; end if;
 if jsonb_array_length(p_tags)>30 or jsonb_array_length(p_components)>20
   or octet_length(p_bean::text)+octet_length(p_tags::text)+octet_length(p_components::text)>65536 then
  raise exception 'Payload limit exceeded' using errcode='22023'; end if;
 for key,value in select * from jsonb_each(p_bean) loop
  if key=any(array['name','roastery','bean_type','origin_country','origin_region','farm_producer','varietal','process_method','process_detail','roast_level','roast_date','consumed_at','place_type','cafe_name','cafe_location','menu_name','note','purchase_source','purchased_at','expected_updated_at']) then
   if jsonb_typeof(value) not in ('string','null') then raise exception 'Invalid text field: %',key using errcode='22023'; end if;
  elsif key=any(array['origin_country_id','origin_region_id','origin_entity_id','origin_lat','origin_lng','altitude_m','harvest_year','overall_score','score_aroma','score_acidity','score_body','score_sweetness','score_aftertaste','score_balance','price','weight_g']) then
   if jsonb_typeof(value) not in ('number','null') then raise exception 'Invalid numeric field: %',key using errcode='22023'; end if;
   if value<>'null'::jsonb then
    number_value:=(value#>>'{}')::numeric;
    if key not in ('origin_lat','origin_lng','overall_score') and number_value<>trunc(number_value) then raise exception 'Invalid integer field: %',key using errcode='22023'; end if;
    if (key='weight_g' and number_value not between 1 and 100000)
      or (key='price' and number_value not between 0 and 10000000)
      or (key='altitude_m' and number_value not between 0 and 5000)
      or (key='harvest_year' and number_value not between 1900 and 2100)
      or (key like 'score_%' and number_value not between 1 and 5)
      or (key in ('origin_country_id','origin_region_id','origin_entity_id') and number_value<=0)
      or (key='origin_lat' and number_value not between -90 and 90)
      or (key='origin_lng' and number_value not between -180 and 180) then raise exception 'Invalid scalar bound: %',key using errcode='22023'; end if;
   end if;
  elsif key='origin_subregions' then perform beanmap_security.assert_subregion_json(value);
  else raise exception 'Unknown bean field: %',key using errcode='22023'; end if;
 end loop;
 for item in select * from jsonb_array_elements(p_tags) loop
  if jsonb_typeof(item) is distinct from 'object' then raise exception 'Invalid tag' using errcode='22023'; end if;
  if exists(select 1 from jsonb_object_keys(item) k where k not in ('tag','category'))
    or jsonb_typeof(item->'tag') is distinct from 'string'
    or char_length(item->>'tag') not between 1 and 50
    or btrim(item->>'tag',U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')=''
    or jsonb_typeof(item->'category') is distinct from 'string'
    or item->>'category' not in ('fruity','floral','sweet','nutty','cocoa','spice','roasted','sour','green','other') then raise exception 'Invalid tag' using errcode='22023'; end if;
 end loop;
 for item in select * from jsonb_array_elements(p_components) loop
  if jsonb_typeof(item) is distinct from 'object' then raise exception 'Invalid component' using errcode='22023'; end if;
  for key,value in select * from jsonb_each(item) loop
   if key in ('origin_country','origin_region','farm_producer','varietal','process_method','process_detail') then
    if jsonb_typeof(value) not in ('string','null') then raise exception 'Invalid component text' using errcode='22023'; end if;
   elsif key='origin_subregions' then perform beanmap_security.assert_subregion_json(value);
   elsif key in ('percentage','sort_order') then
    if jsonb_typeof(value) is distinct from 'number' then raise exception 'Invalid component number' using errcode='22023'; end if;
   else raise exception 'Unknown component field' using errcode='22023'; end if;
  end loop;
  if jsonb_typeof(item->'origin_country') is distinct from 'string'
    or char_length(item->>'origin_country') not between 1 and 100
    or not beanmap_security.valid_subregions(array[item->>'origin_country'])
    or jsonb_typeof(item->'percentage') is distinct from 'number' then raise exception 'Invalid component' using errcode='22023'; end if;
  number_value:=(item->>'percentage')::numeric;
  if number_value<=0 or number_value>100 or number_value*100<>trunc(number_value*100) then raise exception 'Invalid percentage precision' using errcode='22023'; end if;
  total:=total+number_value;
  if item ? 'sort_order' then
   number_value:=(item->>'sort_order')::numeric;
   if number_value<>trunc(number_value) or number_value not between 0 and 100 then raise exception 'Invalid sort order' using errcode='22023'; end if;
  end if;
  if char_length(coalesce(item->>'origin_region',''))>100 or char_length(coalesce(item->>'farm_producer',''))>200
    or char_length(coalesce(item->>'varietal',''))>100 or char_length(coalesce(item->>'process_detail',''))>200
    or (item->>'process_method' is not null and item->>'process_method' not in ('washed','natural','honey','anaerobic','carbonic','decaf','other')) then raise exception 'Invalid component field bound' using errcode='22023'; end if;
 end loop;
 if (p_bean->>'bean_type'='blend' and (jsonb_array_length(p_components)=0 or total<>100))
   or (p_bean->>'bean_type'='single_origin' and jsonb_array_length(p_components)>0) then raise exception 'Invalid component total' using errcode='22023'; end if;
end $$;

-- Keep optional sort_order compatible with the form, without trusting casts or
-- letting omitted values become a NOT NULL violation after validation.
do $$ declare signature text; definition text; body text; marker text:='x.percentage, x.sort_order';
begin
 foreach signature in array array['public.create_bean_record(jsonb,jsonb,jsonb)','public.update_bean_record(uuid,jsonb,jsonb,jsonb)'] loop
  select pg_get_functiondef(p.oid),p.prosrc into strict definition,body from pg_proc p where p.oid=signature::regprocedure;
  if position('perform beanmap_security.require_current_session();' in body)=0
    or position('p_bean := beanmap_security.normalize_required_bean_fields(p_bean);' in body)=0
    or (length(body)-length(replace(body,marker,'')))<>length(marker) then raise exception 'Unexpected mutation definition'; end if;
  execute replace(definition,body,replace(body,marker,'x.percentage, coalesce(x.sort_order, 0)'));
 end loop;
end $$;

alter table public.beans add constraint beans_subregions_bounded check(beanmap_security.valid_subregions(origin_subregions)) not valid,
 add constraint beans_weight_positive check(weight_g is null or weight_g between 1 and 100000) not valid;
alter table public.blend_components add constraint components_subregions_bounded check(beanmap_security.valid_subregions(origin_subregions)) not valid,
 add constraint components_sort_order_bounded check(sort_order between 0 and 100) not valid;

-- Serialize all child writers on their common parent, including cross-parent
-- moves. Row locks also serialize ordinary UPDATE RPCs with direct imports.
create function beanmap_security.lock_bean_collection_parent()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' then
  update public.beans set updated_at=updated_at where id=new.bean_id;
 elsif TG_OP='DELETE' then
  update public.beans set updated_at=updated_at where id=old.bean_id;
 else
  perform id from public.beans where id in (old.bean_id,new.bean_id) order by id for update;
  update public.beans set updated_at=updated_at where id in (old.bean_id,new.bean_id);
 end if;
 if TG_OP='DELETE' then return old; end if;
 return new;
end $$;
create function beanmap_security.check_bean_collections()
returns trigger language plpgsql security definer set search_path='' as $$
declare bean_id_to_check uuid; ids uuid[]; kind text; component_count bigint; component_total numeric;
begin
 if TG_TABLE_NAME='beans' then ids:=array[new.id];
 elsif TG_OP='INSERT' then ids:=array[new.bean_id];
 elsif TG_OP='DELETE' then ids:=array[old.bean_id];
 else ids:=array[old.bean_id,new.bean_id]; end if;
 foreach bean_id_to_check in array ids loop
  select bean_type into kind from public.beans where id=bean_id_to_check;
  if not found then continue; end if;
  select count(*),coalesce(sum(percentage),0) into component_count,component_total from public.blend_components where bean_id=bean_id_to_check;
  if component_count>20 or (kind='blend' and (component_count=0 or component_total<>100))
    or (kind='single_origin' and component_count<>0)
    or (select count(*) from public.tasting_tags where bean_id=bean_id_to_check)>30 then
   raise exception 'Stored bean collection invariant violated' using errcode='23514';
  end if;
 end loop;
 return null;
end $$;
create trigger tags_parent_lock before insert or update or delete on public.tasting_tags for each row execute function beanmap_security.lock_bean_collection_parent();
create trigger components_parent_lock before insert or update or delete on public.blend_components for each row execute function beanmap_security.lock_bean_collection_parent();
create constraint trigger beans_collection_invariant after insert or update on public.beans deferrable initially deferred for each row execute function beanmap_security.check_bean_collections();
create constraint trigger tags_collection_invariant after insert or update or delete on public.tasting_tags deferrable initially deferred for each row execute function beanmap_security.check_bean_collections();
create constraint trigger components_collection_invariant after insert or update or delete on public.blend_components deferrable initially deferred for each row execute function beanmap_security.check_bean_collections();

alter function public.assert_bean_mutation_payload(jsonb,jsonb,jsonb) owner to postgres;
revoke all on function public.assert_bean_mutation_payload(jsonb,jsonb,jsonb) from public,anon,authenticated,service_role,beanmap_api_runtime;
alter function beanmap_security.valid_subregions(text[]) owner to postgres;
alter function beanmap_security.assert_subregion_json(jsonb) owner to postgres;
alter function beanmap_security.lock_bean_collection_parent() owner to postgres;
alter function beanmap_security.check_bean_collections() owner to postgres;
revoke all on function beanmap_security.valid_subregions(text[]),beanmap_security.assert_subregion_json(jsonb),beanmap_security.lock_bean_collection_parent(),beanmap_security.check_bean_collections() from public,anon,authenticated,service_role,beanmap_api_runtime;

commit;
