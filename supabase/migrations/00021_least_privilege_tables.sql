-- Supabase bootstrap grants can include TRUNCATE, TRIGGER, and REFERENCES.
-- Rebuild application table privileges from an explicit least-privilege list.
revoke all privileges on all tables in schema public
  from public, anon, authenticated, service_role;
revoke all privileges on all sequences in schema public
  from public, anon, authenticated, service_role;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.beans to authenticated;
grant select, insert, delete on public.tasting_tags to authenticated;
grant select, insert, update, delete on public.blend_components to authenticated;
grant select on public.origin_presets to authenticated;
grant select on public.origin_countries to authenticated;
grant select on public.origin_regions to authenticated;
grant select on public.origin_entities to authenticated;

alter default privileges in schema public
  revoke all privileges on tables from public, anon, authenticated, service_role;
alter default privileges in schema public
  revoke all privileges on sequences from public, anon, authenticated, service_role;

do $$
declare
  mismatch_count integer;
begin
  with expected(grantee, table_name, privilege_type) as (
    values
      ('authenticated', 'profiles', 'SELECT'),
      ('authenticated', 'profiles', 'INSERT'),
      ('authenticated', 'profiles', 'UPDATE'),
      ('authenticated', 'beans', 'SELECT'),
      ('authenticated', 'beans', 'INSERT'),
      ('authenticated', 'beans', 'UPDATE'),
      ('authenticated', 'beans', 'DELETE'),
      ('authenticated', 'tasting_tags', 'SELECT'),
      ('authenticated', 'tasting_tags', 'INSERT'),
      ('authenticated', 'tasting_tags', 'DELETE'),
      ('authenticated', 'blend_components', 'SELECT'),
      ('authenticated', 'blend_components', 'INSERT'),
      ('authenticated', 'blend_components', 'UPDATE'),
      ('authenticated', 'blend_components', 'DELETE'),
      ('authenticated', 'origin_presets', 'SELECT'),
      ('authenticated', 'origin_countries', 'SELECT'),
      ('authenticated', 'origin_regions', 'SELECT'),
      ('authenticated', 'origin_entities', 'SELECT')
  ), actual as (
    select grantee::text, table_name::text, privilege_type::text
    from information_schema.table_privileges
    where table_schema = 'public'
      and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
  ), mismatches as (
    (select * from actual except select * from expected)
    union all
    (select * from expected except select * from actual)
  )
  select count(*) into mismatch_count from mismatches;

  if mismatch_count <> 0 then
    raise exception 'public table privileges do not match least-privilege policy';
  end if;
end;
$$;
