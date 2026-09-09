-- Curated origin suggestions are served by the budgeted Go API only.
-- Seed-only redactions in 00008 do not replay on existing installations.
begin;
revoke select on public.origin_entities from public, anon, authenticated, service_role, beanmap_api_runtime;
do $$ declare item record; begin
  for item in select attname from pg_attribute
    where attrelid='public.origin_entities'::regclass and attnum>0 and not attisdropped
  loop
    execute format('revoke select (%I) on public.origin_entities from public, anon, authenticated, service_role, beanmap_api_runtime', item.attname);
  end loop;
end $$;
grant select (id, country_id, region_id, name, name_ko, entity_type, farm_name, producer_name, mill_name)
  on public.origin_entities to beanmap_api_runtime;

create function beanmap_security.origin_has_contact(value text)
returns boolean language sql immutable parallel safe set search_path='' as $$
  select coalesce(value ~* '@|\m(contact|phone|telephone|tel|mobile|e-?mail|fax)\M|연락처|전화|이메일|[0-9]([0-9[:space:]().+\-]*[0-9]){6}', false)
$$;
create function beanmap_security.origin_clean_name(value text)
returns text language sql immutable parallel safe set search_path='' as $$
  select btrim(segment) from unnest(string_to_array(value, '|')) with ordinality as parts(segment, position)
  where btrim(segment)<>'' and not beanmap_security.origin_has_contact(segment)
  order by position limit 1
$$;
alter function beanmap_security.origin_has_contact(text) owner to postgres;
alter function beanmap_security.origin_clean_name(text) owner to postgres;
revoke all on function beanmap_security.origin_has_contact(text), beanmap_security.origin_clean_name(text)
  from public, anon, authenticated, service_role, beanmap_api_runtime;

-- Preserve existing ids, country/region links and provenance. A contact-only
-- primary label falls back to a valid farm, producer or mill from the same row.
create temporary table minimized_origin_entities on commit drop as
select id,
  coalesce(beanmap_security.origin_clean_name(name), beanmap_security.origin_clean_name(farm_name),
    beanmap_security.origin_clean_name(producer_name), beanmap_security.origin_clean_name(mill_name)) as name,
  case when beanmap_security.origin_clean_name(name) is not null
    then beanmap_security.origin_clean_name(name_ko) end as name_ko,
  beanmap_security.origin_clean_name(farm_name) as farm_name,
  beanmap_security.origin_clean_name(farm_name_ko) as farm_name_ko,
  beanmap_security.origin_clean_name(producer_name) as producer_name,
  beanmap_security.origin_clean_name(producer_name_ko) as producer_name_ko,
  beanmap_security.origin_clean_name(owner_name) as owner_name,
  beanmap_security.origin_clean_name(owner_name_ko) as owner_name_ko,
  beanmap_security.origin_clean_name(mill_name) as mill_name,
  beanmap_security.origin_clean_name(mill_name_ko) as mill_name_ko
from public.origin_entities;
-- FKs use ON DELETE SET NULL; user-entered bean text is not changed.
delete from public.origin_entities e using minimized_origin_entities m where e.id=m.id and m.name is null;
update public.origin_entities e set
  name=m.name, name_ko=m.name_ko, farm_name=m.farm_name, farm_name_ko=m.farm_name_ko,
  producer_name=m.producer_name, producer_name_ko=m.producer_name_ko,
  owner_name=m.owner_name, owner_name_ko=m.owner_name_ko, mill_name=m.mill_name, mill_name_ko=m.mill_name_ko
from minimized_origin_entities m where e.id=m.id;

alter table public.origin_entities add constraint origin_entities_no_contact check (
  not beanmap_security.origin_has_contact(
    concat_ws('|', source_key, name, name_ko, entity_type, farm_name, farm_name_ko,
      producer_name, producer_name_ko, owner_name, owner_name_ko, mill_name, mill_name_ko, source_datasets)
  )
);
commit;
