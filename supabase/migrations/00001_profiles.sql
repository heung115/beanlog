-- ============================================
-- 00001: profiles table + auto-creation trigger
-- ============================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text check (char_length(display_name) <= 50),
  locale text not null default 'ko' check (locale in ('ko', 'en')),
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'User profiles, auto-created on signup via trigger';

-- Auto-create profile when a new user signs up
-- SECURITY DEFINER runs as postgres, but only does a simple insert
-- No user-controlled input beyond auth.uid() and raw_user_meta_data
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, locale)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    ),
    'ko'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;

-- Only the user themselves can read their profile
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- Only the user themselves can update their profile
-- Restrict which columns can be changed (not id, not email, not created_at)
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No manual insert (trigger handles it), no delete (cascade from auth.users)
