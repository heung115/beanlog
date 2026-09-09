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
  oauth_completion text := 'public.complete_oauth_consent(jsonb)';
begin
  foreach signature in array allowed loop
    if to_regprocedure(signature) is null then
      raise exception 'Missing allowlisted function: %', signature;
    end if;
  end loop;
  if to_regprocedure(oauth_completion) is null then raise exception 'OAuth consent completion boundary is missing'; end if;
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
  foreach signature in array array[
    'beanmap_security.valid_subregions(text[])','beanmap_security.assert_subregion_json(jsonb)',
    'beanmap_security.lock_bean_collection_parent()','beanmap_security.check_bean_collections()'
  ] loop
    if to_regprocedure(signature) is null or not exists (select 1 from pg_proc where oid=to_regprocedure(signature) and proowner='postgres'::regrole) then
      raise exception 'Collection validator is missing or has an unexpected owner: %',signature;
    end if;
    foreach role_name in array array['anon','authenticated','service_role','beanmap_api_runtime'] loop
      if has_function_privilege(role_name,signature,'EXECUTE') then raise exception 'Private collection helper exposed to %: %',role_name,signature; end if;
    end loop;
  end loop;
  for fn in select * from (values
    ('public.beans','beans_collection_invariant',21),
    ('public.tasting_tags','tags_collection_invariant',29),
    ('public.blend_components','components_collection_invariant',29)
  ) expected(table_name,trigger_name,trigger_type) loop
    if not exists(select 1 from pg_trigger t where t.tgrelid=fn.table_name::regclass
      and t.tgname=fn.trigger_name and t.tgtype=fn.trigger_type and not t.tgisinternal
      and t.tgconstraint<>0 and t.tgdeferrable and t.tginitdeferred and t.tgenabled in ('O','A')
      and t.tgfoid='beanmap_security.check_bean_collections()'::regprocedure) then
      raise exception 'Deferred collection boundary is missing: %',fn.trigger_name;
    end if;
  end loop;
  for fn in select * from (values
    ('public.tasting_tags','tags_parent_lock'),('public.blend_components','components_parent_lock')
  ) expected(table_name,trigger_name) loop
    if not exists(select 1 from pg_trigger t where t.tgrelid=fn.table_name::regclass
      and t.tgname=fn.trigger_name and t.tgtype=31 and not t.tgisinternal and t.tgenabled in ('O','A')
      and t.tgfoid='beanmap_security.lock_bean_collection_parent()'::regprocedure) then
      raise exception 'Collection parent serialization is missing: %',fn.trigger_name;
    end if;
  end loop;
  if to_regnamespace('beanmap_signup') is null or to_regclass('beanmap_signup.signing_key') is null
    or to_regclass('beanmap_signup.consent_events') is null then raise exception 'Signup consent boundary is missing'; end if;
  foreach signature in array array['beanmap_signup.verify_new_user()','beanmap_signup.reject_event_mutation()','beanmap_signup.mark_new_oauth_user()','beanmap_signup.sync_oauth_pending_hint()'] loop
    if to_regprocedure(signature) is null or not exists(select 1 from pg_proc where oid=to_regprocedure(signature) and prosecdef and proowner='postgres'::regrole) then
      raise exception 'Signup consent enforcement helper is missing: %',signature;
    end if;
    for role_name in select rolname from pg_roles where rolname in
      ('anon','authenticated','service_role','authenticator','beanmap_api','beanlog_api','beanmap_api_runtime') loop
      if has_function_privilege(role_name,signature,'EXECUTE') then raise exception 'Signup helper exposed to %',role_name; end if;
    end loop;
  end loop;
  for role_name in select rolname from pg_roles where rolname in
    ('anon','authenticated','service_role','authenticator','beanmap_api','beanlog_api','beanmap_api_runtime') loop
    if has_schema_privilege(role_name,'beanmap_signup','USAGE,CREATE')
      or has_table_privilege(role_name,'beanmap_signup.signing_key','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      or has_any_column_privilege(role_name,'beanmap_signup.signing_key','SELECT,INSERT,UPDATE,REFERENCES')
      or has_table_privilege(role_name,'beanmap_signup.consent_events','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      or has_any_column_privilege(role_name,'beanmap_signup.consent_events','SELECT,INSERT,UPDATE,REFERENCES') then
      raise exception 'Signup signing material or consent events exposed to %',role_name;
    end if;
  end loop;
  if not exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass
    and tgname='beanmap_verified_signup_consent' and tgtype=7 and tgenabled in ('O','A')
    and tgfoid='beanmap_signup.verify_new_user()'::regprocedure)
    or not exists(select 1 from pg_trigger where tgrelid='beanmap_signup.consent_events'::regclass
      and tgname='signup_consent_immutable' and tgtype=27 and tgenabled in ('O','A')
      and tgfoid='beanmap_signup.reject_event_mutation()'::regprocedure) then
    raise exception 'Signup consent trigger is disabled or incomplete';
  end if;
  if exists(select 1 from pg_namespace where nspname='beanmap_signup' and nspowner<>'postgres'::regrole)
    or exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='beanmap_signup' and c.relkind in ('r','p','S') and c.relowner<>'postgres'::regrole)
    or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='beanmap_signup' and p.proowner<>'postgres'::regrole)
    or not exists(select 1 from pg_proc where oid=oauth_completion::regprocedure and proowner='postgres'::regrole)
    or not has_schema_privilege('postgres','extensions','USAGE')
    or not has_function_privilege('postgres','extensions.hmac(bytea,bytea,text)','EXECUTE') then
    raise exception 'Signup consent DDL and definer owners or crypto grants are inconsistent';
  end if;
  if to_regclass('beanmap_signup.pending_oauth_consent') is null
    or to_regclass('beanmap_signup.oauth_consent_attempts') is null
    or to_regprocedure('beanmap_security.current_auth_session_valid()') is null
    or not exists(select 1 from pg_proc where oid='beanmap_security.current_auth_session_valid()'::regprocedure and proowner='postgres'::regrole) then
    raise exception 'OAuth pending-session boundary is missing';
  end if;
  for role_name in select rolname from pg_roles where rolname in
    ('anon','authenticated','service_role','authenticator','beanmap_api','beanlog_api','beanmap_api_runtime') loop
    if has_function_privilege(role_name,'beanmap_security.current_auth_session_valid()','EXECUTE') then
      raise exception 'Unrestricted Auth-session helper exposed to %',role_name;
    end if;
    for fn in select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='beanmap_signup' and c.relkind in ('r','p','v','m','f') loop
      if has_table_privilege(role_name,fn.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        or has_any_column_privilege(role_name,fn.oid,'SELECT,INSERT,UPDATE,REFERENCES') then
        raise exception 'Private signup state exposed to %',role_name;
      end if;
    end loop;
  end loop;
  if not exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass
    and tgname='beanmap_pending_oauth_consent' and tgtype=7 and tgenabled in ('O','A')
    and tgfoid='beanmap_signup.mark_new_oauth_user()'::regprocedure)
    or not exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass
      and tgname='beanmap_sync_oauth_pending_hint' and tgtype=19 and tgenabled in ('O','A')
      and tgfoid='beanmap_signup.sync_oauth_pending_hint()'::regprocedure
      and tgattr::text=(select attnum::text from pg_attribute where attrelid='auth.users'::regclass and attname='raw_app_meta_data'))
    or not exists(select 1 from pg_proc where oid='beanmap_security.current_session_valid()'::regprocedure
      and prosecdef and proowner='postgres'::regrole and position('beanmap_security.current_auth_session_valid()' in prosrc)>0
      and position('beanmap_signup.pending_oauth_consent' in prosrc)>0)
    or not exists(select 1 from pg_proc where oid=oauth_completion::regprocedure and prosecdef
      and proconfig @> array['statement_timeout=3s','lock_timeout=1s']
      and position('beanmap_security.current_auth_session_valid()' in prosrc)>0
      and position('beanmap_signup.oauth_consent_attempts' in prosrc)>0) then
    raise exception 'OAuth pending-state enforcement or completion budget is incomplete';
  end if;
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
      should_execute := (role_name = 'beanmap_api_runtime' and fn.signature = any(allowed))
        or (role_name in ('authenticated','beanmap_api_runtime') and fn.signature=oauth_completion);
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
        and (a.grantee = 0 or a.grantee in (select oid from pg_roles where rolname in ('anon','authenticated','service_role','authenticator','beanmap_api','beanlog_api','beanmap_api_runtime')))
    ) then
      raise exception 'Broad function defaults remain for %', role_name;
    end if;
  end loop;
  -- Newly created relations must start private even before RLS is attached.
  if exists (
    select 1 from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a
    where d.defaclrole in ('postgres'::regrole,'supabase_admin'::regrole)
      and d.defaclobjtype in ('r','S') and d.defaclnamespace in (0,'public'::regnamespace)
      and (a.grantee = 0 or a.grantee in (select oid from pg_roles where rolname in
        ('anon','authenticated','service_role','authenticator','beanmap_api','beanlog_api','beanmap_api_runtime')))
  ) then raise exception 'Broad table or sequence defaults remain'; end if;
  if to_regnamespace('net') is not null then
    if exists (select 1 from pg_namespace n cross join lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
      where n.nspname='net' and a.grantee=0) then raise exception 'PUBLIC can use network schema'; end if;
    if exists (
      select 1 from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a
      where d.defaclrole in ('postgres'::regrole,'supabase_admin'::regrole)
        and d.defaclnamespace='net'::regnamespace and d.defaclobjtype in ('f','r','S')
        and (a.grantee=0 or a.grantee in (select oid from pg_roles where rolname in
          ('anon','authenticated','service_role','authenticator','beanmap_api','beanlog_api','beanmap_api_runtime')))
    ) then raise exception 'Broad network object defaults remain'; end if;
    for role_name in select rolname from pg_roles where rolname in
      ('anon','authenticated','service_role','authenticator','beanmap_api','beanlog_api','beanmap_api_runtime') loop
      if has_schema_privilege(role_name,'net','USAGE,CREATE') then raise exception 'Network schema exposed to %',role_name; end if;
    end loop;
    for fn in select p.oid,p.proacl,p.proowner from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='net' loop
      if exists (select 1 from aclexplode(coalesce(fn.proacl,acldefault('f',fn.proowner))) where grantee=0) then
        raise exception 'PUBLIC can execute network routine';
      end if;
      for role_name in select rolname from pg_roles where rolname in
        ('anon','authenticated','service_role','authenticator','beanmap_api','beanlog_api','beanmap_api_runtime') loop
        if has_schema_privilege(role_name,'net','USAGE,CREATE') or has_function_privilege(role_name,fn.oid,'EXECUTE') then
          raise exception 'Network capability exposed to %',role_name;
        end if;
      end loop;
    end loop;
    for fn in select c.oid,c.relkind,c.relacl,c.relowner from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='net' and c.relkind in ('r','p','v','m','f','S') loop
      if exists (select 1 from aclexplode(coalesce(fn.relacl,acldefault(case when fn.relkind='S' then 's'::"char" else 'r'::"char" end,fn.relowner))) where grantee=0) then
        raise exception 'PUBLIC can access network relation';
      end if;
      for role_name in select rolname from pg_roles where rolname in
        ('anon','authenticated','service_role','authenticator','beanmap_api','beanlog_api','beanmap_api_runtime') loop
        if fn.relkind='S' then
          if has_sequence_privilege(role_name,fn.oid,'USAGE,SELECT,UPDATE') then raise exception 'Network sequence exposed to %',role_name; end if;
        elsif has_table_privilege(role_name,fn.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
          raise exception 'Network relation exposed to %',role_name;
        end if;
      end loop;
    end loop;
  end if;
end;
$$;
