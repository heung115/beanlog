-- ============================================
-- 00005: Security hardening
-- - Revoke unnecessary public grants
-- - Rate-limit helper for future use
-- - Restrict function execution
-- ============================================

-- Revoke execute on all functions from anon/public
-- Only authenticated users should call our functions
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;

-- Re-grant only what's needed
grant execute on function public.handle_new_user() to postgres;
grant execute on function public.set_updated_at() to postgres;

-- Revoke unnecessary table permissions from anon role
-- (RLS already blocks access, but defense in depth)
revoke all on public.profiles from anon;
revoke all on public.beans from anon;
revoke all on public.tasting_tags from anon;
revoke all on public.origin_presets from anon;

-- Authenticated users get minimal required grants
grant select on public.origin_presets to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.beans to authenticated;
grant select, insert, delete on public.tasting_tags to authenticated;

-- Sequence grant for origin_presets serial (needed for select to work with id)
grant usage on sequence public.origin_presets_id_seq to authenticated;

-- Rate-limit helper: simple per-user action counter
-- Can be called before expensive operations in the future
create table if not exists public.rate_limits (
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (char_length(action) <= 50),
  window_start timestamptz not null default now(),
  count integer not null default 1,
  primary key (user_id, action, window_start)
);

alter table public.rate_limits enable row level security;

-- Users can only manage their own rate limit counters
create policy "rate_limits_own"
  on public.rate_limits for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Function to check and increment rate limit
-- Returns true if allowed, false if rate-limited
create or replace function public.check_rate_limit(
  p_action text,
  p_max_count integer default 100,
  p_window_minutes integer default 60
)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  v_count integer;
  v_window_start timestamptz;
begin
  v_window_start := date_trunc('hour', now());

  -- Upsert counter
  insert into public.rate_limits (user_id, action, window_start, count)
  values (auth.uid(), p_action, v_window_start, 1)
  on conflict (user_id, action, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into v_count;

  return v_count <= p_max_count;
end;
$$;

grant execute on function public.check_rate_limit(text, integer, integer) to authenticated;

comment on function public.check_rate_limit is 'Simple sliding-window rate limiter per user per action';
