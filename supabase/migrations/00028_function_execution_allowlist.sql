-- Defaults are additive: revoke global and schema-specific grants for both owners.
begin;
alter default privileges for role postgres revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role supabase_admin revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public revoke execute on functions from public, anon, authenticated, service_role;
-- Trigger-only functions and internal helpers have no RPC callers.
revoke execute on all functions in schema public from public, anon, authenticated, service_role;
grant execute on function public.create_bean_record(jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.update_bean_record(uuid, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.delete_bean_record(uuid) to authenticated;
grant execute on function public.delete_current_account() to authenticated;
commit;
