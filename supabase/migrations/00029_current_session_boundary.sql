-- Apply the same current-session boundary to the API and direct database reads.
begin;
create role beanmap_api_runtime nologin inherit nosuperuser nobypassrls nocreatedb nocreaterole;
grant authenticated to beanmap_api_runtime;
-- The connection identities never inherit data access before SET LOCAL ROLE.
grant beanmap_api_runtime to postgres with inherit false, set true;
do $$
declare connector text;
begin
  foreach connector in array array['beanlog_api', 'beanmap_api'] loop
    if exists (select 1 from pg_roles where rolname = connector) then
      if exists (select 1 from pg_roles where rolname = connector
        and (not rolcanlogin or rolinherit or rolsuper or rolbypassrls or rolcreaterole or rolcreatedb)) then
        raise exception 'Invalid API connection role: %', connector;
      end if;
      execute format('grant beanmap_api_runtime to %I with inherit false, set true', connector);
    end if;
  end loop;
end;
$$;
-- Preference changes use the same budgeted API boundary as bean mutations.
revoke update on public.profiles from authenticated;
revoke update (display_name, locale) on public.profiles from authenticated;
grant update (display_name, locale) on public.profiles to beanmap_api_runtime;
create schema beanmap_security authorization postgres;
revoke all on schema beanmap_security from public, anon, authenticated, service_role;
grant usage on schema beanmap_security to authenticated;

create function beanmap_security.current_session_valid()
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  claims jsonb;
  subject_id uuid;
  session_id uuid;
begin
  -- Only signed JWT claims supplied by the trusted request transport are used.
  -- Missing/malformed claims never fall back to an independently supplied id.
  begin
    claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
    if claims->>'role' is distinct from 'authenticated'
      or jsonb_typeof(claims->'sub') is distinct from 'string'
      or jsonb_typeof(claims->'session_id') is distinct from 'string'
      or claims->>'sub' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or claims->>'session_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      return false;
    end if;
    subject_id := (claims->>'sub')::uuid;
    session_id := (claims->>'session_id')::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  -- Auth revokes sessions by deleting their rows. Its refreshed_at column is
  -- UTC without a time zone. Keep these bounds aligned with Auth's 720h/168h
  -- timebox/inactivity configuration; a live JWT alone does not extend them.
  return exists (
    select 1 from auth.sessions s join auth.users u on u.id = s.user_id
    where s.id = session_id and s.user_id = subject_id
      and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= statement_timestamp())
      and (s.not_after is null or s.not_after > statement_timestamp())
      and s.created_at > statement_timestamp() - interval '720 hours'
      and coalesce(s.refreshed_at at time zone 'UTC', s.created_at)
        > statement_timestamp() - interval '168 hours'
  );
end;
$$;
create function beanmap_security.require_current_session()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not beanmap_security.current_session_valid() then
    raise exception 'current session required' using errcode = '28000';
  end if;
end;
$$;
alter function beanmap_security.current_session_valid() owner to postgres;
alter function beanmap_security.require_current_session() owner to postgres;
revoke all on all functions in schema beanmap_security from public, anon, authenticated, service_role;
grant execute on function beanmap_security.current_session_valid() to authenticated;
grant execute on function beanmap_security.require_current_session() to authenticated;

-- Restrictive policies are ANDed with ownership/catalog policies, including
-- roles inheriting authenticated. Require RLS on every publicly readable table.
do $$
declare item record;
begin
  for item in select c.relname, c.relrowsecurity from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and has_table_privilege('authenticated', c.oid, 'SELECT')
  loop
    if not item.relrowsecurity then
      raise exception 'RLS missing on public table %', item.relname;
    end if;
    execute format('create policy current_session_required on public.%I as restrictive for all to authenticated using ((select beanmap_security.current_session_valid())) with check ((select beanmap_security.current_session_valid()))', item.relname);
  end loop;
end;
$$;

-- Preserve the complete existing validation bodies while inserting the same
-- session guard before any SECURITY DEFINER code can bypass row policies.
do $$
declare signature text; definition text; body text; guarded_body text;
begin
  foreach signature in array array[
    'public.create_bean_record(jsonb,jsonb,jsonb)',
    'public.update_bean_record(uuid,jsonb,jsonb,jsonb)',
    'public.delete_bean_record(uuid)',
    'public.delete_current_account()'
  ] loop
    select pg_get_functiondef(p.oid), p.prosrc into strict definition, body
      from pg_proc p where p.oid = signature::regprocedure;
    guarded_body := regexp_replace(body, '\mBEGIN\M', E'begin\n  perform beanmap_security.require_current_session();', 'i');
    if body = guarded_body then raise exception 'Missing function body boundary: %', signature; end if;
    execute replace(definition, body, guarded_body);
    execute format('revoke all on function %s from public, anon, authenticated, service_role, beanmap_api_runtime', signature);
  end loop;
end;
$$;
grant execute on function public.create_bean_record(jsonb,jsonb,jsonb) to beanmap_api_runtime;
grant execute on function public.update_bean_record(uuid,jsonb,jsonb,jsonb) to beanmap_api_runtime;
grant execute on function public.delete_bean_record(uuid) to beanmap_api_runtime;
commit;
