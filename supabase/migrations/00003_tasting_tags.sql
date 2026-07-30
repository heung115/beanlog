-- ============================================
-- 00003: tasting_tags table
-- Security: RLS ownership, length limits,
-- cascade delete with parent bean
-- ============================================

create table public.tasting_tags (
  id uuid primary key default gen_random_uuid(),
  bean_id uuid not null references public.beans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tag text not null check (char_length(tag) between 1 and 50),
  category text not null default 'other' check (
    category in ('fruity', 'floral', 'sweet', 'nutty', 'cocoa', 'spice', 'roasted', 'sour', 'green', 'other')
  )
);

comment on table public.tasting_tags is 'Tasting note tags per bean record';

-- Prevent duplicate tags on same bean
create unique index idx_tags_unique_per_bean
  on public.tasting_tags(bean_id, tag);

-- Query indexes
create index idx_tags_bean on public.tasting_tags(bean_id);
create index idx_tags_user on public.tasting_tags(user_id);

-- RLS: strict ownership
alter table public.tasting_tags enable row level security;

create policy "tags_select_own"
  on public.tasting_tags for select
  using (auth.uid() = user_id);

create policy "tags_insert_own"
  on public.tasting_tags for insert
  with check (auth.uid() = user_id);

create policy "tags_delete_own"
  on public.tasting_tags for delete
  using (auth.uid() = user_id);

-- No update policy: tags are immutable (delete + re-insert instead)
