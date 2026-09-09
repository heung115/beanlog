-- New objects require explicit reviewed grants, regardless of migration owner.
begin;
do $$
declare owner_name text; role_name text; target_role text; object_kind text;
begin
  foreach owner_name in array array['postgres', 'supabase_admin'] loop
    foreach role_name in array array[
      'PUBLIC', 'anon', 'authenticated', 'service_role', 'authenticator',
      'beanmap_api', 'beanlog_api', 'beanmap_api_runtime'
    ] loop
      if role_name <> 'PUBLIC' and to_regrole(role_name) is null then continue; end if;
      target_role := case when role_name = 'PUBLIC' then 'PUBLIC' else quote_ident(role_name) end;
      foreach object_kind in array array['tables', 'sequences'] loop
        execute format('alter default privileges for role %I revoke all privileges on %s from %s', owner_name, object_kind, target_role);
        execute format('alter default privileges for role %I in schema public revoke all privileges on %s from %s', owner_name, object_kind, target_role);
      end loop;
    end loop;
  end loop;
end;
$$;
-- Keep the optional network extension installed for its owner, without giving
-- application or gateway roles access to HTTP functions or request queues.
do $$
declare role_name text; target_role text; owner_name text;
begin
  if to_regnamespace('net') is null then return; end if;
  foreach role_name in array array[
    'PUBLIC', 'anon', 'authenticated', 'service_role', 'authenticator',
    'beanmap_api', 'beanlog_api', 'beanmap_api_runtime'
  ] loop
    if role_name <> 'PUBLIC' and to_regrole(role_name) is null then continue; end if;
    target_role := case when role_name = 'PUBLIC' then 'PUBLIC' else quote_ident(role_name) end;
    execute format('revoke all privileges on schema net from %s', target_role);
    execute format('revoke all privileges on all functions in schema net from %s', target_role);
    execute format('revoke all privileges on all tables in schema net from %s', target_role);
    execute format('revoke all privileges on all sequences in schema net from %s', target_role);
    foreach owner_name in array array['postgres', 'supabase_admin'] loop
      execute format('alter default privileges for role %I in schema net revoke all privileges on functions from %s', owner_name, target_role);
      execute format('alter default privileges for role %I in schema net revoke all privileges on tables from %s', owner_name, target_role);
      execute format('alter default privileges for role %I in schema net revoke all privileges on sequences from %s', owner_name, target_role);
    end loop;
  end loop;
end;
$$;
commit;
