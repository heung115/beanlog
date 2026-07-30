-- Keep workbook values as traceable aliases, but expose one curated region per
-- country/name group in the record form. Entities remain linked to their raw
-- source region and are resolved through canonical_region_id at read time.

ALTER TABLE public.origin_regions
  ADD COLUMN canonical_region_id bigint REFERENCES public.origin_regions(id) ON DELETE SET NULL,
  ADD COLUMN display_name text CHECK (char_length(display_name) <= 200),
  ADD COLUMN display_name_ko text CHECK (char_length(display_name_ko) <= 200),
  ADD COLUMN is_canonical boolean NOT NULL DEFAULT false;

-- Collapse case and whitespace-only variants, choosing the most readable
-- source spelling as the canonical row. The source name itself is never lost.
WITH ranked_regions AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY country_id, lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))
      ORDER BY
        CASE
          WHEN name = initcap(lower(name)) THEN 0
          WHEN name <> lower(name) THEN 1
          ELSE 2
        END,
        char_length(name),
        id
    ) AS canonical_id
  FROM public.origin_regions
)
UPDATE public.origin_regions AS regions
SET canonical_region_id = ranked_regions.canonical_id
FROM ranked_regions
WHERE regions.id = ranked_regions.id;

UPDATE public.origin_regions
SET display_name = CASE
      WHEN name = lower(name) THEN initcap(name)
      ELSE name
    END,
    display_name_ko = COALESCE(NULLIF(name_ko, ''), name),
    is_canonical = id = canonical_region_id;

-- A country name is not a selectable sub-region (for example, Ethiopia under
-- Ethiopia). These source rows remain available for provenance only.
UPDATE public.origin_regions AS regions
SET canonical_region_id = NULL,
    is_canonical = false
FROM public.origin_countries AS countries
WHERE regions.country_id = countries.id
  AND lower(btrim(regions.name)) = lower(countries.name_en);

-- Map simple "Country, Region" source values to the real region candidate.
UPDATE public.origin_regions AS source_region
SET canonical_region_id = target_region.id,
    is_canonical = false
FROM public.origin_countries AS countries
JOIN public.origin_regions AS target_region
  ON target_region.country_id = countries.id
  AND target_region.is_canonical
WHERE source_region.country_id = countries.id
  AND lower(regexp_replace(btrim(source_region.name), '\s+', ' ', 'g')) =
      lower(countries.name_en) || ', ' || lower(regexp_replace(btrim(target_region.name), '\s+', ' ', 'g'));

-- Gedeb is a useful coffee-origin label embedded in one compound source row.
-- Create a canonical region row, then attach that compound alias to it.
INSERT INTO public.origin_regions (
  source_key, country_id, name, name_ko, display_name, display_name_ko,
  canonical_region_id, is_canonical
)
SELECT
  'canonical:Ethiopia:Gedeb',
  countries.id,
  'Gedeb',
  '게데브',
  'Gedeb',
  '게데브',
  NULL,
  false
FROM public.origin_countries AS countries
WHERE countries.name_en = 'Ethiopia'
ON CONFLICT (source_key) DO NOTHING;

UPDATE public.origin_regions
SET canonical_region_id = id,
    is_canonical = true
WHERE source_key = 'canonical:Ethiopia:Gedeb';

-- Curated aliases where a source value contains a country, a broad province,
-- a legacy coffee trade name, or a spelling variant rather than the region
-- users should select. Sidama is the current official region name; Sidamo is
-- retained as a raw coffee-origin/source alias, not as a separate selectable
-- administrative peer.
WITH region_aliases(country_en, alias_name, canonical_name) AS (
  VALUES
    ('Ethiopia', 'sidamo', 'Sidama'),
    ('Ethiopia', 'ethiopia, sidamo', 'Sidama'),
    ('Ethiopia', 'Southern Ethiopia Guji', 'Guji'),
    ('Ethiopia', 'blida,kercha,guji,oromia', 'Guji'),
    ('Ethiopia', 'Gedeb,Yirgacheffe,Sidamo', 'Gedeb'),
    ('Ethiopia', 'oromiya', 'Oromia')
)
UPDATE public.origin_regions AS source_region
SET canonical_region_id = target_region.id,
    is_canonical = false
FROM region_aliases
JOIN public.origin_countries AS countries
  ON countries.name_en = region_aliases.country_en
JOIN public.origin_regions AS target_region
  ON target_region.country_id = countries.id
  AND lower(target_region.name) = lower(region_aliases.canonical_name)
WHERE source_region.country_id = countries.id
  AND lower(source_region.name) = lower(region_aliases.alias_name);

-- Historical bean records should reference the same canonical region used by
-- the selector while retaining their human-readable/source region label.
UPDATE public.beans AS beans
SET origin_region_id = canonical_regions.id
FROM public.origin_regions AS source_regions
JOIN public.origin_regions AS canonical_regions
  ON canonical_regions.id = source_regions.canonical_region_id
WHERE beans.origin_region_id = source_regions.id
  AND source_regions.canonical_region_id IS NOT NULL
  AND beans.origin_region_id <> source_regions.canonical_region_id;

CREATE INDEX idx_origin_regions_canonical_lookup
  ON public.origin_regions(country_id, canonical_region_id);

COMMENT ON COLUMN public.origin_regions.canonical_region_id IS
  'Canonical region for a raw source alias; only rows with is_canonical=true are shown in the selector.';
