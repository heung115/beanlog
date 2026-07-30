-- 블렌드 구성 성분: 싱글오리진을 퍼센트로 조합
create table public.blend_components (
  id uuid default gen_random_uuid() primary key,
  bean_id uuid references public.beans(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  origin_country text not null,
  origin_region text,
  varietal text,
  process_method text check (process_method in ('washed', 'natural', 'honey', 'anaerobic', 'carbonic', 'other')),
  percentage numeric(5,2) not null check (percentage > 0 and percentage <= 100),
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

create index idx_blend_components_bean_id on public.blend_components(bean_id);
create index idx_blend_components_user_id on public.blend_components(user_id);

-- 블렌드는 단일 산지가 없으므로 origin_country를 nullable로
alter table public.beans alter column origin_country drop not null;

-- RLS
alter table public.blend_components enable row level security;

create policy "Users can view own blend components"
  on public.blend_components for select using (auth.uid() = user_id);
create policy "Users can insert own blend components"
  on public.blend_components for insert with check (auth.uid() = user_id);
create policy "Users can update own blend components"
  on public.blend_components for update using (auth.uid() = user_id);
create policy "Users can delete own blend components"
  on public.blend_components for delete using (auth.uid() = user_id);
