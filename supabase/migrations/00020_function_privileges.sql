-- Functions receive EXECUTE for PUBLIC by default in PostgreSQL. Lock down
-- both the existing unused rate-limit helper and future public functions.
revoke all on function public.check_rate_limit(text, integer, integer)
  from public, anon, authenticated;

alter default privileges in schema public
  revoke execute on functions from public;

do $$
begin
  if exists (
      select 1
      from information_schema.routine_privileges
      where specific_schema = 'public'
        and routine_name = 'check_rate_limit'
        and grantee = 'PUBLIC'
        and privilege_type = 'EXECUTE'
    )
    or has_function_privilege('anon', 'public.check_rate_limit(text, integer, integer)', 'execute')
    or has_function_privilege('authenticated', 'public.check_rate_limit(text, integer, integer)', 'execute') then
    raise exception 'check_rate_limit execute privilege is not locked down';
  end if;
end;
$$;
