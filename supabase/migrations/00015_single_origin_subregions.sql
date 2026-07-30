alter table public.beans
  add column if not exists origin_subregions text[] not null default '{}';

create index if not exists idx_beans_user_origin_subregions
  on public.beans(user_id, origin_country, origin_region);

create index if not exists idx_blend_components_user_origin_region
  on public.blend_components(user_id, origin_country, origin_region);
