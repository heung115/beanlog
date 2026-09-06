-- The operator API calls these functions through its PostgreSQL connection.
-- No administrator RPC belongs in the PostgREST public schema, even when its
-- caller has an administrator JWT. Keep beanmap_private out of exposed schemas.
-- Move and repair all references atomically; no public compatibility wrappers.
begin;

alter function public.beanmap_is_admin() set schema beanmap_private;
alter function public.beanmap_admin_overview() set schema beanmap_private;
alter function public.beanmap_admin_update_catalog(text, bigint, text, text, text) set schema beanmap_private;
alter function public.beanmap_admin_audit() set schema beanmap_private;

-- ALTER FUNCTION SET SCHEMA preserves ownership and privileges, but does not
-- rewrite qualified names in PL/pgSQL bodies. Replace those bodies explicitly.
create or replace function beanmap_private.beanmap_admin_overview()
returns table (
  users bigint, beans bigint, new_users_30d bigint, new_beans_30d bigint,
  active_users_30d bigint, countries bigint, regions bigint, entities bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not beanmap_private.beanmap_is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return query
  select
    (select count(*) from public.profiles),
    (select count(*) from public.beans),
    (select count(*) from public.profiles p where p.created_at >= now() - interval '30 days'),
    (select count(*) from public.beans b where b.created_at >= now() - interval '30 days'),
    (select count(distinct b.user_id) from public.beans b where b.created_at >= now() - interval '30 days'),
    (select count(*) from public.origin_countries),
    (select count(*) from public.origin_regions r where r.is_canonical and r.display_name is not null),
    (select count(*) from public.origin_entities);
end;
$$;

create or replace function beanmap_private.beanmap_admin_update_catalog(
  p_kind text,
  p_id bigint,
  p_name_ko text,
  p_expected_name_ko text,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Match Go strings.TrimSpace at the database boundary as well.
  v_space constant text := U&'\0009\000a\000b\000c\000d\0020\0085\00a0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200a\2028\2029\202f\205f\3000';
  v_name_ko text := nullif(btrim(p_name_ko, v_space), '');
  v_reason text := btrim(p_reason, v_space);
  v_old_name_ko text;
  v_item_name text;
begin
  if not beanmap_private.beanmap_is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('country', 'region', 'entity')
    or p_id is null or p_id <= 0 or p_name_ko is null
    or char_length(v_name_ko) > 120
    or char_length(p_expected_name_ko) > 300
    or v_reason is null or char_length(v_reason) not between 3 and 300 then
    raise exception 'Invalid catalog update' using errcode = '22023';
  end if;

  -- Lock before comparing so concurrent editors cannot silently overwrite one
  -- another. The row update and audit insert commit or roll back together.
  if p_kind = 'country' then
    select c.name_en, c.name_ko into v_item_name, v_old_name_ko
    from public.origin_countries c where c.id = p_id for update;
  elsif p_kind = 'region' then
    select r.display_name, r.display_name_ko into v_item_name, v_old_name_ko
    from public.origin_regions r
    where r.id = p_id and r.is_canonical and r.display_name is not null for update;
  else
    select e.name, e.name_ko into v_item_name, v_old_name_ko
    from public.origin_entities e where e.id = p_id for update;
  end if;
  if not found then
    raise exception 'Catalog item not found' using errcode = 'P0002';
  end if;
  if p_expected_name_ko is distinct from v_old_name_ko then
    raise exception 'Catalog item changed' using errcode = '40001';
  end if;
  if v_name_ko is not distinct from v_old_name_ko then
    return false;
  end if;

  if p_kind = 'country' then
    update public.origin_countries set name_ko = v_name_ko where id = p_id;
  elsif p_kind = 'region' then
    update public.origin_regions set display_name_ko = v_name_ko, name_ko = v_name_ko where id = p_id;
  else
    update public.origin_entities set name_ko = v_name_ko where id = p_id;
  end if;

  insert into beanmap_private.admin_catalog_audit (
    actor_id, kind, item_id, item_name, old_name_ko, new_name_ko, reason
  ) values (
    auth.uid(), p_kind, p_id, v_item_name, v_old_name_ko, v_name_ko, v_reason
  );
  return true;
end;
$$;

create or replace function beanmap_private.beanmap_admin_audit()
returns table (
  id bigint, kind text, item_id bigint, item_name text,
  old_name_ko text, new_name_ko text, reason text, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not beanmap_private.beanmap_is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return query
  select a.id, a.kind, a.item_id, a.item_name, a.old_name_ko,
         a.new_name_ko, a.reason, a.created_at
  from beanmap_private.admin_catalog_audit a
  order by a.created_at desc, a.id desc
  limit 30;
end;
$$;

-- Go sets the transaction role to authenticated. USAGE permits resolving the
-- four functions, but does not grant direct access to the private tables.
revoke all on schema beanmap_private from public, anon, authenticated, service_role;
grant usage on schema beanmap_private to authenticated;
revoke all on all tables in schema beanmap_private from public, anon, authenticated, service_role;
revoke all on all sequences in schema beanmap_private from public, anon, authenticated, service_role;
revoke all on function beanmap_private.beanmap_is_admin() from public, anon, authenticated, service_role;
revoke all on function beanmap_private.beanmap_admin_overview() from public, anon, authenticated, service_role;
revoke all on function beanmap_private.beanmap_admin_update_catalog(text, bigint, text, text, text) from public, anon, authenticated, service_role;
revoke all on function beanmap_private.beanmap_admin_audit() from public, anon, authenticated, service_role;
grant execute on function beanmap_private.beanmap_is_admin() to authenticated;
grant execute on function beanmap_private.beanmap_admin_overview() to authenticated;
grant execute on function beanmap_private.beanmap_admin_update_catalog(text, bigint, text, text, text) to authenticated;
grant execute on function beanmap_private.beanmap_admin_audit() to authenticated;

notify pgrst, 'reload schema';
commit;
