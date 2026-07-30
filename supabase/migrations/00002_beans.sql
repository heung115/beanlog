-- ============================================
-- 00002: beans table (core record)
-- Security: strict RLS, input length limits,
-- check constraints, no public access
-- ============================================

create table public.beans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,

  -- Required fields with length limits (prevent abuse)
  name text not null check (char_length(name) between 1 and 200),
  roastery text not null check (char_length(roastery) between 1 and 200),
  bean_type text not null check (bean_type in ('single_origin', 'blend')),

  -- Origin
  origin_country text not null check (char_length(origin_country) between 1 and 100),
  origin_region text check (char_length(origin_region) <= 100),
  origin_lat numeric check (origin_lat between -90 and 90),
  origin_lng numeric check (origin_lng between -180 and 180),

  -- Bean details (optional, length-limited)
  farm_producer text check (char_length(farm_producer) <= 200),
  varietal text check (char_length(varietal) <= 100),
  process_method text not null check (process_method in ('washed', 'natural', 'honey', 'anaerobic', 'carbonic', 'other')),
  process_detail text check (char_length(process_detail) <= 200),
  altitude_m integer check (altitude_m between 0 and 5000),
  harvest_year integer check (harvest_year between 1900 and 2100),

  -- Roast
  roast_level text not null check (roast_level in ('light', 'medium', 'dark')),
  roast_date date check (roast_date <= '2100-01-01'),

  -- Consumption context
  consumed_at timestamptz not null default now() check (consumed_at <= now() + interval '1 day'),
  place_type text not null check (place_type in ('cafe', 'home')),
  cafe_name text check (char_length(cafe_name) <= 200),
  cafe_location text check (char_length(cafe_location) <= 200),
  menu_name text check (char_length(menu_name) <= 200),

  -- Score & note
  overall_score numeric(3,1) not null check (overall_score between 1.0 and 10.0),
  note text not null default '' check (char_length(note) <= 2000),

  -- Detailed scores (1-5, nullable)
  score_aroma smallint check (score_aroma between 1 and 5),
  score_acidity smallint check (score_acidity between 1 and 5),
  score_body smallint check (score_body between 1 and 5),
  score_sweetness smallint check (score_sweetness between 1 and 5),
  score_aftertaste smallint check (score_aftertaste between 1 and 5),
  score_balance smallint check (score_balance between 1 and 5),

  -- Purchase info
  purchase_source text check (purchase_source in ('online', 'roastery', 'cafe', 'other')),
  price integer check (price between 0 and 10000000),
  weight_g integer check (weight_g between 0 and 100000),
  purchased_at date check (purchased_at <= '2100-01-01'),

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.beans is 'Coffee bean tasting records, owned per-user';

-- Indexes for common query patterns (prevents slow-query abuse)
create index idx_beans_user_consumed on public.beans(user_id, consumed_at desc);
create index idx_beans_user_origin on public.beans(user_id, origin_country);
create index idx_beans_user_process on public.beans(user_id, process_method);
create index idx_beans_user_score on public.beans(user_id, overall_score desc);
create index idx_beans_user_roastery on public.beans(user_id, roastery);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger beans_set_updated_at
  before update on public.beans
  for each row execute function public.set_updated_at();

-- RLS: strict ownership
alter table public.beans enable row level security;

create policy "beans_select_own"
  on public.beans for select
  using (auth.uid() = user_id);

create policy "beans_insert_own"
  on public.beans for insert
  with check (auth.uid() = user_id);

create policy "beans_update_own"
  on public.beans for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "beans_delete_own"
  on public.beans for delete
  using (auth.uid() = user_id);
