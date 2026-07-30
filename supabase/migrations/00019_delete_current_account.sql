-- Delete only the authenticated caller's Auth identity. Foreign-key cascades
-- remove the profile, beans, tasting tags, and blend components atomically.
create or replace function public.delete_current_account()
returns void
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

  delete from auth.users where id = caller_id;
  if not found then
    raise exception 'authenticated user not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.delete_current_account() from public, anon;
grant execute on function public.delete_current_account() to authenticated;
