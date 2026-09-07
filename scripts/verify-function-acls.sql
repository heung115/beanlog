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
    'public.delete_bean_record(uuid)',
    'public.delete_current_account()'
  ];
  signature text;
begin
  foreach signature in array allowed loop
    if to_regprocedure(signature) is null then
      raise exception 'Missing allowlisted function: %', signature;
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
    foreach role_name in array array['anon', 'authenticated', 'service_role'] loop
      should_execute := role_name = 'authenticated' and fn.signature = any(allowed);
      if has_function_privilege(role_name, fn.oid, 'EXECUTE') <> should_execute then
        raise exception 'Unexpected EXECUTE for role % on % (expected %)', role_name, fn.signature, should_execute;
      end if;
    end loop;
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
        and a.grantee in (0, 'anon'::regrole, 'authenticated'::regrole, 'service_role'::regrole)
    ) then
      raise exception 'Broad function defaults remain for %', role_name;
    end if;
  end loop;
end;
$$;
