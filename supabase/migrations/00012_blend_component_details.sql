alter table public.blend_components
  add column if not exists farm_producer text,
  add column if not exists process_detail text;
