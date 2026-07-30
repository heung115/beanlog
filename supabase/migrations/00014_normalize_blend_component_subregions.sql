alter table public.blend_components
  add column if not exists origin_subregions text[] not null default '{}';

-- Some databases reached this migration with the legacy scalar column while
-- clean installs already removed it in 00013. Referencing a missing column in
-- a static UPDATE fails at parse time, so keep the compatibility copy dynamic.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'blend_components'
      and column_name = 'origin_subregion'
  ) then
    execute $sql$
      update public.blend_components
      set origin_subregions = array_remove(
        regexp_split_to_array(coalesce(origin_subregion, ''), '\s*,\s*'),
        ''
      )
      where origin_subregion is not null
        and cardinality(origin_subregions) = 0
    $sql$;
  end if;
end
$$;

alter table public.blend_components
  drop column if exists origin_subregion;
