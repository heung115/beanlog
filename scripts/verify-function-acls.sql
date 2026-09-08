-- Read-only: psql -X -v ON_ERROR_STOP=1 -f scripts/verify-function-acls.sql
-- Compare every public function, including extension routines, to the RPC list.
do $$
declare
  fn record;
  role_name text;
  should_execute boolean;
  allowed text[] := array[
    'public.create_bean_record(jsonb,jsonb,jsonb)',
    'public.update_bean_record(uuid,jsonb,jsonb,jsonb)',
    'public.delete_bean_record(uuid)'
  ];
  signature text;
begin
  foreach signature in array allowed loop
    if to_regprocedure(signature) is null then
      raise exception 'Missing allowlisted function: %', signature;
    end if;
  end loop;
  if to_regprocedure('beanmap_security.normalize_required_bean_fields(jsonb)') is null then
    raise exception 'Required bean-field validator is missing';
  end if;
  foreach role_name in array array['anon', 'authenticated', 'service_role', 'beanmap_api_runtime'] loop
    if has_function_privilege(role_name, 'beanmap_security.normalize_required_bean_fields(jsonb)', 'EXECUTE') then
      raise exception 'Internal field validator is exposed to %', role_name;
    end if;
  end loop;
  foreach signature in array allowed[1:2] loop
    if not exists(select 1 from pg_proc where oid = signature::regprocedure
      and proowner = 'postgres'::regrole and prosecdef
      and position('perform beanmap_security.require_current_session();' in prosrc) > 0
      and position('p_bean := beanmap_security.normalize_required_bean_fields(p_bean);' in prosrc) > 0) then
      raise exception 'Bean mutation boundary is incomplete: %', signature;
    end if;
  end loop;
  for fn in
    select p.oid, format('%I.%I(%s)', n.nspname, p.proname,
      replace(oidvectortypes(p.proargtypes), ', ', ',')) as signature, p.proacl, p.proowner
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    if exists (select 1 from aclexplode(coalesce(fn.proacl, acldefault('f', fn.proowner)))
      where grantee = 0 and privilege_type = 'EXECUTE') then
      raise exception 'PUBLIC can execute %', fn.signature;
    end if;
    foreach role_name in array array['anon', 'authenticated', 'service_role', 'beanmap_api_runtime'] loop
      should_execute := role_name = 'beanmap_api_runtime' and fn.signature = any(allowed);
      if has_function_privilege(role_name, fn.oid, 'EXECUTE') <> should_execute then
        raise exception 'Unexpected EXECUTE for role % on % (expected %)', role_name, fn.signature, should_execute;
      end if;
    end loop;
  end loop;
  foreach role_name in array array['anon', 'authenticated', 'service_role'] loop
    if has_any_column_privilege(role_name, 'public.origin_entities', 'SELECT') then
      raise exception 'Raw origin entity read exposed to %', role_name;
    end if;
  end loop;
  for fn in select attname from pg_attribute
    where attrelid='public.origin_entities'::regclass and attnum>0 and not attisdropped
  loop
    if has_column_privilege('beanmap_api_runtime', 'public.origin_entities', fn.attname, 'SELECT')
      <> (fn.attname = any(array['id','country_id','region_id','name','name_ko','entity_type','farm_name','producer_name','mill_name'])) then
      raise exception 'Unexpected API origin column grant: %', fn.attname;
    end if;
  end loop;
  if has_any_column_privilege('authenticated', 'public.profiles', 'UPDATE')
    or not has_column_privilege('beanmap_api_runtime', 'public.profiles', 'display_name', 'UPDATE')
    or not has_column_privilege('beanmap_api_runtime', 'public.profiles', 'locale', 'UPDATE') then
    raise exception 'Preference mutation grants bypass API boundary';
  end if;
  if not pg_has_role('beanmap_api_runtime', 'authenticated', 'MEMBER')
    or pg_has_role('authenticated', 'beanmap_api_runtime', 'MEMBER')
    or exists (select 1 from pg_roles where rolname = 'beanmap_api_runtime'
      and (rolcanlogin or rolsuper or rolbypassrls or rolcreaterole or rolcreatedb)) then
    raise exception 'Invalid private API role boundary';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticator')
    and pg_has_role('authenticator', 'beanmap_api_runtime', 'MEMBER') then
    raise exception 'PostgREST can assume private API role';
  end if;
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and has_table_privilege('authenticated', c.oid, 'SELECT')
      and (not c.relrowsecurity or not exists (
        select 1 from pg_policy p where p.polrelid = c.oid
          and p.polname = 'current_session_required' and not p.polpermissive
          and p.polroles = array['authenticated'::regrole::oid]
          and pg_get_expr(p.polqual, p.polrelid) like '%beanmap_security.current_session_valid()%'
          and pg_get_expr(p.polwithcheck, p.polrelid) like '%beanmap_security.current_session_valid()%'
      ))
  ) then raise exception 'Public table lacks current-session RLS boundary'; end if;
  for fn in select p.oid, p.proacl, p.proowner from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'beanmap_security'
      and p.proname in ('current_session_valid', 'require_current_session')
  loop
    if exists (select 1 from aclexplode(coalesce(fn.proacl, acldefault('f', fn.proowner)))
      where grantee = 0 and privilege_type = 'EXECUTE')
      or has_function_privilege('anon', fn.oid, 'EXECUTE')
      or has_function_privilege('service_role', fn.oid, 'EXECUTE')
      or not has_function_privilege('authenticated', fn.oid, 'EXECUTE') then
      raise exception 'Invalid session helper ACL';
    end if;
  end loop;
  -- Missing global ACL means the implicit PUBLIC EXECUTE still applies.
  foreach role_name in array array['postgres', 'supabase_admin'] loop
    if not exists (
      select 1 from pg_default_acl d
      where d.defaclrole = role_name::regrole and d.defaclnamespace = 0 and d.defaclobjtype = 'f'
    ) then
      raise exception 'Missing denied global function defaults for %', role_name;
    end if;
    if exists (
      select 1 from pg_default_acl d, lateral aclexplode(d.defaclacl) a
      where d.defaclrole = role_name::regrole and d.defaclobjtype = 'f'
        and d.defaclnamespace in (0, 'public'::regnamespace)
        and a.privilege_type = 'EXECUTE'
        and a.grantee in (0, 'anon'::regrole, 'authenticated'::regrole, 'service_role'::regrole, 'beanmap_api_runtime'::regrole)
    ) then
      raise exception 'Broad function defaults remain for %', role_name;
    end if;
  end loop;
end;
$$;
