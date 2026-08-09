-- Keep user-owned data readable through PostgREST, but force every bean
-- mutation through the validated atomic functions. RLS answers "whose row?";
-- these functions additionally enforce the cross-row bean invariants.

revoke insert, update, delete on public.profiles from authenticated;
revoke insert, update, delete on public.beans from authenticated;
revoke insert, update, delete on public.tasting_tags from authenticated;
revoke insert, update, delete on public.blend_components from authenticated;

-- A profile owner may change only the two public preference fields. The
-- profiles_update_own RLS policy still restricts the affected row to auth.uid().
grant update (display_name, locale) on public.profiles to authenticated;

-- The existing functions already derive every user_id from auth.uid(), scope
-- updates/deletes to that id, validate blend totals, and pin an empty
-- search_path. SECURITY DEFINER lets those checks write after direct table
-- grants have been removed from authenticated callers.
alter function public.create_bean_record(jsonb, jsonb, jsonb) security definer;
alter function public.create_bean_record(jsonb, jsonb, jsonb) set search_path = '';
alter function public.update_bean_record(uuid, jsonb, jsonb, jsonb) security definer;
alter function public.update_bean_record(uuid, jsonb, jsonb, jsonb) set search_path = '';

revoke all on function public.create_bean_record(jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.update_bean_record(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.create_bean_record(jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.update_bean_record(uuid, jsonb, jsonb, jsonb) to authenticated;

create or replace function public.delete_bean_record(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  delete from public.beans
  where id = p_id and user_id = caller_id;
  return found;
end;
$$;

revoke all on function public.delete_bean_record(uuid) from public, anon;
grant execute on function public.delete_bean_record(uuid) to authenticated;

-- Fail migration application if a future bootstrap/default grant leaves the
-- public PostgREST role with a write path around the verified functions.
do $$
begin
  if has_table_privilege('authenticated', 'public.profiles', 'INSERT')
    or has_table_privilege('authenticated', 'public.profiles', 'UPDATE')
    or has_table_privilege('authenticated', 'public.profiles', 'DELETE')
    or has_table_privilege('authenticated', 'public.beans', 'INSERT')
    or has_table_privilege('authenticated', 'public.beans', 'UPDATE')
    or has_table_privilege('authenticated', 'public.beans', 'DELETE')
    or has_table_privilege('authenticated', 'public.tasting_tags', 'INSERT')
    or has_table_privilege('authenticated', 'public.tasting_tags', 'UPDATE')
    or has_table_privilege('authenticated', 'public.tasting_tags', 'DELETE')
    or has_table_privilege('authenticated', 'public.blend_components', 'INSERT')
    or has_table_privilege('authenticated', 'public.blend_components', 'UPDATE')
    or has_table_privilege('authenticated', 'public.blend_components', 'DELETE') then
    raise exception 'authenticated retains a direct table mutation grant';
  end if;

  if not has_column_privilege('authenticated', 'public.profiles', 'display_name', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.profiles', 'locale', 'UPDATE')
    or has_column_privilege('authenticated', 'public.profiles', 'id', 'UPDATE')
    or has_column_privilege('authenticated', 'public.profiles', 'email', 'UPDATE')
    or has_column_privilege('authenticated', 'public.profiles', 'created_at', 'UPDATE') then
    raise exception 'profile column update grants do not match the allow-list';
  end if;
end;
$$;
