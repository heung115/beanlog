-- Run with the local Supabase database after applying the origin migrations.
-- This guards the UI contract: only canonical names are selectable, while
-- entities attached to aliases remain discoverable through the canonical row.
DO $verify$
DECLARE
  sidama_id bigint;
  sidama_entity_count integer;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.origin_regions
    WHERE is_canonical
      AND canonical_region_id IS DISTINCT FROM id
  ) THEN
    RAISE EXCEPTION 'A selectable region must point to itself as canonical';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.origin_regions AS regions
    JOIN public.origin_countries AS countries ON countries.id = regions.country_id
    WHERE countries.name_en = 'Ethiopia'
      AND regions.is_canonical
      AND lower(regions.display_name) = 'ethiopia'
  ) THEN
    RAISE EXCEPTION 'Country name leaked into Ethiopia region choices';
  END IF;

  IF EXISTS (
    SELECT lower(regions.display_name)
    FROM public.origin_regions AS regions
    JOIN public.origin_countries AS countries ON countries.id = regions.country_id
    WHERE countries.name_en = 'Ethiopia'
      AND regions.is_canonical
    GROUP BY lower(regions.display_name)
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate Ethiopia region labels remain selectable';
  END IF;

  SELECT regions.id INTO sidama_id
  FROM public.origin_regions AS regions
  JOIN public.origin_countries AS countries ON countries.id = regions.country_id
  WHERE countries.name_en = 'Ethiopia'
    AND regions.is_canonical
    AND regions.display_name = 'Sidama';

  IF sidama_id IS NULL THEN
    RAISE EXCEPTION 'Sidama canonical region is missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.origin_regions AS regions
    JOIN public.origin_countries AS countries ON countries.id = regions.country_id
    WHERE countries.name_en = 'Ethiopia'
      AND regions.is_canonical
      AND lower(regions.display_name) = 'sidamo'
  ) THEN
    RAISE EXCEPTION 'Sidamo legacy label leaked into canonical region choices';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.origin_regions AS regions
    WHERE lower(regions.name) = 'ethiopia, sidamo'
      AND regions.canonical_region_id = sidama_id
  ) THEN
    RAISE EXCEPTION 'Country-prefixed Sidamo alias is not normalized to Sidama';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.origin_regions AS regions
    WHERE lower(regions.name) = 'sidamo'
      AND regions.canonical_region_id = sidama_id
      AND NOT regions.is_canonical
  ) THEN
    RAISE EXCEPTION 'Sidamo legacy alias is not attached to Sidama';
  END IF;

  SELECT count(*) INTO sidama_entity_count
  FROM public.origin_entities AS entities
  JOIN public.origin_regions AS regions ON regions.id = entities.region_id
  WHERE regions.canonical_region_id = sidama_id;

  IF sidama_entity_count = 0 THEN
    RAISE EXCEPTION 'No Sidama entity can be reached through normalized aliases';
  END IF;
END;
$verify$;
