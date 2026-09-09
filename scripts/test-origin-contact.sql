-- Disposable database only; no source contact values are printed.
begin;
do $$ begin
 if exists (select 1 from public.origin_entities where
   beanmap_security.origin_has_contact(concat_ws('|',source_key,name,name_ko,entity_type,
     farm_name,farm_name_ko,producer_name,producer_name_ko,owner_name,owner_name_ko,mill_name,mill_name_ko,source_datasets))) then
   raise exception 'Catalog still contains contact patterns';
 end if;
 if (select name from public.origin_entities where source_key='privacy-upgrade-fixture') is distinct from 'Valid Fixture Producer'
   or (select farm_name from public.origin_entities where source_key='privacy-upgrade-fixture') is not null
   or exists(select 1 from public.origin_entities where source_key='privacy-contact-only-fixture') then
   raise exception 'Existing-data contact minimization failed';
 end if;
 begin
  insert into public.origin_entities(source_key,country_id,name) select 'rejected-fixture',id,'fixture@example.test' from public.origin_countries limit 1;
  raise exception 'Contact ingestion accepted';
 exception when check_violation then null; end;
 begin
  update public.origin_entities set owner_name='+1 (202) 555-0100' where source_key='privacy-upgrade-fixture';
  raise exception 'Contact update accepted';
 exception when check_violation then null; end;
end $$;
insert into auth.users(id,email,raw_user_meta_data) values ('a1000000-0000-0000-0000-000000000001','contact-acl@example.test','{}');
insert into auth.sessions(id,user_id) values ('b1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001');
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000001',true),
 set_config('request.jwt.claims','{"role":"authenticated","sub":"a1000000-0000-0000-0000-000000000001","session_id":"b1000000-0000-0000-0000-000000000001"}',true);
set local role authenticated;
do $$ begin
 begin
  perform name,owner_name,source_key from public.origin_entities limit 1;
  raise exception 'Ordinary role enumerated raw origins';
 exception when insufficient_privilege then null; end;
 begin
  perform name from public.origin_entities limit 1;
  raise exception 'Ordinary role selected a raw origin column';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role beanmap_api_runtime;
do $$ begin
 perform id,name,name_ko,entity_type,farm_name,producer_name,mill_name from public.origin_entities where country_id>0 and region_id is not null limit 1;
 if not found then raise exception 'API selector lost catalog access'; end if;
 begin
  perform owner_name,source_key,source_datasets from public.origin_entities limit 1;
  raise exception 'API obtained unnecessary origin metadata';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
delete from auth.sessions where id='b1000000-0000-0000-0000-000000000001';
set local role beanmap_api_runtime;
do $$ begin
 if exists(select id from public.origin_entities) then raise exception 'Revoked API session read catalog'; end if;
end $$;
reset role;
rollback;
