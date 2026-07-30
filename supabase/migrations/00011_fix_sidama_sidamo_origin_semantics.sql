-- 00011: correct Sidama/Sidamo semantics in already-migrated databases.
--
-- Sidama is the current official Ethiopian region name. Sidamo remains useful
-- as a legacy coffee trade/source label, but it must not be exposed as a
-- separate canonical administrative peer.

WITH ethiopia AS (
  SELECT id
  FROM public.origin_countries
  WHERE name_en = 'Ethiopia'
),
sidama AS (
  SELECT regions.id
  FROM public.origin_regions AS regions
  JOIN ethiopia ON ethiopia.id = regions.country_id
  WHERE lower(regions.name) = 'sidama'
  ORDER BY regions.id
  LIMIT 1
)
UPDATE public.origin_regions AS regions
SET canonical_region_id = sidama.id,
    display_name = 'Sidama',
    display_name_ko = '시다마',
    is_canonical = true
FROM sidama
WHERE regions.id = sidama.id;

WITH ethiopia AS (
  SELECT id
  FROM public.origin_countries
  WHERE name_en = 'Ethiopia'
),
sidama AS (
  SELECT regions.id
  FROM public.origin_regions AS regions
  JOIN ethiopia ON ethiopia.id = regions.country_id
  WHERE lower(regions.name) = 'sidama'
  ORDER BY regions.id
  LIMIT 1
)
UPDATE public.origin_regions AS regions
SET canonical_region_id = sidama.id,
    is_canonical = false
FROM sidama
JOIN ethiopia ON true
WHERE regions.country_id = ethiopia.id
  AND lower(regions.name) IN ('sidamo', 'ethiopia, sidamo');

-- Existing bean rows should point at the official canonical row when they were
-- linked to a Sidamo source alias. Do not rewrite origin_region text here:
-- that field may be the label printed on a user's coffee bag.
WITH ethiopia AS (
  SELECT id
  FROM public.origin_countries
  WHERE name_en = 'Ethiopia'
),
sidama AS (
  SELECT regions.id
  FROM public.origin_regions AS regions
  JOIN ethiopia ON ethiopia.id = regions.country_id
  WHERE lower(regions.name) = 'sidama'
  ORDER BY regions.id
  LIMIT 1
),
sidamo_aliases AS (
  SELECT regions.id
  FROM public.origin_regions AS regions
  JOIN ethiopia ON ethiopia.id = regions.country_id
  WHERE lower(regions.name) IN ('sidamo', 'ethiopia, sidamo')
)
UPDATE public.beans AS beans
SET origin_region_id = sidama.id
FROM sidama
JOIN sidamo_aliases ON true
WHERE beans.origin_region_id = sidamo_aliases.id;

UPDATE public.origin_presets
SET region = 'Sidama'
WHERE country = 'Ethiopia'
  AND region = 'Sidamo';
