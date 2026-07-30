#!/usr/bin/env python3
"""Generate the origin catalog seed section of migration 00008 from the supplied workbook.

Usage:
  python3 scripts/generate_origin_catalog.py /path/to/database.xlsx /path/to/00008_origin_catalog.sql

The migration schema lives in the SQL template below.  This script only turns the
workbook's normalized region and entity sheets into safely escaped INSERT statements.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import pandas as pd


UNKNOWN_COUNTRY = "(Unknown)"
UNKNOWN_REGION = "(지역 미기재)"
PLACEHOLDER_ENTITY_NAMES = {"-", "1"}


def text(value: object) -> str | None:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    value = str(value).strip()
    return value or None


def sql(value: object) -> str:
    value = text(value)
    if value is None:
        return "NULL"
    return "'" + value.replace("\x00", "").replace("'", "''") + "'"


def values_rows(rows: list[tuple[object, ...]]) -> str:
    return ",\n".join("  (" + ", ".join(sql(value) for value in row) + ")" for row in rows)


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__.strip(), file=sys.stderr)
        return 2

    workbook_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    regions_sheet = pd.read_excel(workbook_path, sheet_name="산지_지역")
    entities_sheet = pd.read_excel(workbook_path, sheet_name="농장_생산자")

    countries: dict[str, str | None] = {}
    regions: dict[tuple[str, str], dict[str, str | None]] = {}

    def remember_country(country_en: object, country_ko: object) -> str | None:
        key = text(country_en)
        if key is None or key == UNKNOWN_COUNTRY:
            return None
        countries.setdefault(key, text(country_ko))
        return key

    def remember_region(row: pd.Series) -> None:
        country_en = remember_country(row.get("country_en"), row.get("국가"))
        name = text(row.get("region_raw"))
        if country_en is None or name is None or name == UNKNOWN_REGION:
            return
        key = (country_en, name)
        regions.setdefault(
            key,
            {
                "name_ko": text(row.get("region_ko")),
                "part_1": text(row.get("region_part_1")),
                "part_1_ko": text(row.get("region_part_1_ko")),
                "part_2": text(row.get("region_part_2")),
                "part_2_ko": text(row.get("region_part_2_ko")),
                "part_3": text(row.get("region_part_3")),
                "part_3_ko": text(row.get("region_part_3_ko")),
            },
        )

    for _, row in regions_sheet.iterrows():
        remember_region(row)

    # Some entities use a region value absent from the aggregate region sheet.
    # Keep those values selectable instead of silently dropping their hierarchy.
    for _, row in entities_sheet.iterrows():
        remember_region(row)

    country_rows = [
        (f"country:{country_en}", country_en, country_ko)
        for country_en, country_ko in sorted(countries.items(), key=lambda item: item[0].casefold())
    ]
    region_rows = [
        (
            f"region:{country_en}:{name}",
            country_en,
            name,
            values["name_ko"],
            values["part_1"],
            values["part_1_ko"],
            values["part_2"],
            values["part_2_ko"],
            values["part_3"],
            values["part_3_ko"],
        )
        for (country_en, name), values in sorted(
            regions.items(), key=lambda item: (item[0][0].casefold(), item[0][1].casefold())
        )
    ]

    entity_rows: list[tuple[object, ...]] = []
    for _, row in entities_sheet.iterrows():
        country_en = remember_country(row.get("country_en"), row.get("국가"))
        source_key = text(row.get("entity_id"))
        entity_name = text(row.get("entity_name"))
        if (
            country_en is None
            or source_key is None
            or entity_name is None
            or entity_name.casefold() in PLACEHOLDER_ENTITY_NAMES
        ):
            continue
        region_name = text(row.get("region_raw"))
        if region_name == UNKNOWN_REGION:
            region_name = None
        region_source_key = (
            f"region:{country_en}:{region_name}" if region_name is not None else None
        )
        entity_rows.append(
            (
                source_key,
                country_en,
                region_source_key,
                entity_name,
                text(row.get("entity_name_ko")),
                text(row.get("entity_type")),
                text(row.get("farm_name")),
                text(row.get("farm_name_ko")),
                text(row.get("producer")),
                text(row.get("producer_ko")),
                text(row.get("owner")),
                text(row.get("owner_ko")),
                text(row.get("mill")),
                text(row.get("mill_ko")),
                text(row.get("datasets")),
            )
        )

    sql_text = f'''-- ============================================
-- 00008: normalized origin catalog and farm/producer suggestions
-- ============================================
-- Generated from public_coffee_origins_farms_database_ko.xlsx.
-- Source fields are retained for input suggestions only; no CQI score or lot data is seeded.

CREATE TABLE public.origin_countries (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  source_key text NOT NULL UNIQUE CHECK (char_length(source_key) <= 200),
  name_en text NOT NULL UNIQUE CHECK (char_length(name_en) <= 100),
  name_ko text CHECK (char_length(name_ko) <= 100),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.origin_regions (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  source_key text NOT NULL UNIQUE CHECK (char_length(source_key) <= 400),
  country_id bigint NOT NULL REFERENCES public.origin_countries(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) <= 200),
  name_ko text CHECK (char_length(name_ko) <= 200),
  part_1 text CHECK (char_length(part_1) <= 200),
  part_1_ko text CHECK (char_length(part_1_ko) <= 200),
  part_2 text CHECK (char_length(part_2) <= 200),
  part_2_ko text CHECK (char_length(part_2_ko) <= 200),
  part_3 text CHECK (char_length(part_3) <= 200),
  part_3_ko text CHECK (char_length(part_3_ko) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_id, name)
);

CREATE TABLE public.origin_entities (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  source_key text NOT NULL UNIQUE CHECK (char_length(source_key) <= 100),
  country_id bigint NOT NULL REFERENCES public.origin_countries(id) ON DELETE CASCADE,
  region_id bigint REFERENCES public.origin_regions(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (char_length(name) <= 300),
  name_ko text CHECK (char_length(name_ko) <= 300),
  entity_type text CHECK (char_length(entity_type) <= 50),
  farm_name text CHECK (char_length(farm_name) <= 300),
  farm_name_ko text CHECK (char_length(farm_name_ko) <= 300),
  producer_name text CHECK (char_length(producer_name) <= 300),
  producer_name_ko text CHECK (char_length(producer_name_ko) <= 300),
  owner_name text CHECK (char_length(owner_name) <= 300),
  owner_name_ko text CHECK (char_length(owner_name_ko) <= 300),
  mill_name text CHECK (char_length(mill_name) <= 300),
  mill_name_ko text CHECK (char_length(mill_name_ko) <= 300),
  source_datasets text CHECK (char_length(source_datasets) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.origin_countries IS 'Read-only country choices for coffee-record origin input.';
COMMENT ON TABLE public.origin_regions IS 'Read-only region choices linked to an origin country.';
COMMENT ON TABLE public.origin_entities IS 'Read-only farm, producer, cooperative, and mill suggestions linked to country and region.';
COMMENT ON TABLE public.origin_presets IS 'Deprecated: retained for backward compatibility; use origin_countries and origin_regions for new UI work.';

CREATE INDEX idx_origin_regions_country ON public.origin_regions(country_id, name);
CREATE INDEX idx_origin_entities_country_region ON public.origin_entities(country_id, region_id, name);

ALTER TABLE public.beans
  ADD COLUMN origin_country_id bigint REFERENCES public.origin_countries(id) ON DELETE SET NULL,
  ADD COLUMN origin_region_id bigint REFERENCES public.origin_regions(id) ON DELETE SET NULL,
  ADD COLUMN origin_entity_id bigint REFERENCES public.origin_entities(id) ON DELETE SET NULL;

CREATE INDEX idx_beans_origin_country_id ON public.beans(origin_country_id);
CREATE INDEX idx_beans_origin_region_id ON public.beans(origin_region_id);
CREATE INDEX idx_beans_origin_entity_id ON public.beans(origin_entity_id);

ALTER TABLE public.origin_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.origin_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.origin_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "origin_countries_select_authenticated"
  ON public.origin_countries FOR SELECT TO authenticated USING (true);
CREATE POLICY "origin_regions_select_authenticated"
  ON public.origin_regions FOR SELECT TO authenticated USING (true);
CREATE POLICY "origin_entities_select_authenticated"
  ON public.origin_entities FOR SELECT TO authenticated USING (true);

REVOKE ALL ON public.origin_countries, public.origin_regions, public.origin_entities FROM anon;
GRANT SELECT ON public.origin_countries, public.origin_regions, public.origin_entities TO authenticated;

INSERT INTO public.origin_countries (source_key, name_en, name_ko)
VALUES
{values_rows(country_rows)}
ON CONFLICT (source_key) DO UPDATE
SET name_en = EXCLUDED.name_en,
    name_ko = EXCLUDED.name_ko;

INSERT INTO public.origin_regions (
  source_key, country_id, name, name_ko,
  part_1, part_1_ko, part_2, part_2_ko, part_3, part_3_ko
)
SELECT
  values_table.source_key,
  countries.id,
  values_table.name,
  values_table.name_ko,
  values_table.part_1,
  values_table.part_1_ko,
  values_table.part_2,
  values_table.part_2_ko,
  values_table.part_3,
  values_table.part_3_ko
FROM (
  VALUES
{values_rows(region_rows)}
) AS values_table(
  source_key, country_en, name, name_ko,
  part_1, part_1_ko, part_2, part_2_ko, part_3, part_3_ko
)
JOIN public.origin_countries AS countries ON countries.name_en = values_table.country_en
ON CONFLICT (source_key) DO UPDATE
SET name = EXCLUDED.name,
    name_ko = EXCLUDED.name_ko,
    part_1 = EXCLUDED.part_1,
    part_1_ko = EXCLUDED.part_1_ko,
    part_2 = EXCLUDED.part_2,
    part_2_ko = EXCLUDED.part_2_ko,
    part_3 = EXCLUDED.part_3,
    part_3_ko = EXCLUDED.part_3_ko;

INSERT INTO public.origin_entities (
  source_key, country_id, region_id, name, name_ko, entity_type,
  farm_name, farm_name_ko, producer_name, producer_name_ko,
  owner_name, owner_name_ko, mill_name, mill_name_ko, source_datasets
)
SELECT
  values_table.source_key,
  countries.id,
  regions.id,
  values_table.name,
  values_table.name_ko,
  values_table.entity_type,
  values_table.farm_name,
  values_table.farm_name_ko,
  values_table.producer_name,
  values_table.producer_name_ko,
  values_table.owner_name,
  values_table.owner_name_ko,
  values_table.mill_name,
  values_table.mill_name_ko,
  values_table.source_datasets
FROM (
  VALUES
{values_rows(entity_rows)}
) AS values_table(
  source_key, country_en, region_source_key, name, name_ko, entity_type,
  farm_name, farm_name_ko, producer_name, producer_name_ko,
  owner_name, owner_name_ko, mill_name, mill_name_ko, source_datasets
)
JOIN public.origin_countries AS countries ON countries.name_en = values_table.country_en
LEFT JOIN public.origin_regions AS regions ON regions.source_key = values_table.region_source_key
ON CONFLICT (source_key) DO UPDATE
SET country_id = EXCLUDED.country_id,
    region_id = EXCLUDED.region_id,
    name = EXCLUDED.name,
    name_ko = EXCLUDED.name_ko,
    entity_type = EXCLUDED.entity_type,
    farm_name = EXCLUDED.farm_name,
    farm_name_ko = EXCLUDED.farm_name_ko,
    producer_name = EXCLUDED.producer_name,
    producer_name_ko = EXCLUDED.producer_name_ko,
    owner_name = EXCLUDED.owner_name,
    owner_name_ko = EXCLUDED.owner_name_ko,
    mill_name = EXCLUDED.mill_name,
    mill_name_ko = EXCLUDED.mill_name_ko,
    source_datasets = EXCLUDED.source_datasets;

-- Preserve existing user records while assigning IDs only for exact known matches.
UPDATE public.beans AS beans
SET origin_country_id = countries.id,
    origin_country = countries.name_en
FROM public.origin_countries AS countries
WHERE beans.origin_country_id IS NULL
  AND beans.origin_country IS NOT NULL
  AND (
    lower(trim(beans.origin_country)) = lower(countries.name_en)
    OR trim(beans.origin_country) = countries.name_ko
  );

UPDATE public.beans AS beans
SET origin_region_id = regions.id,
    origin_region = regions.name
FROM public.origin_regions AS regions
WHERE beans.origin_region_id IS NULL
  AND beans.origin_country_id = regions.country_id
  AND beans.origin_region IS NOT NULL
  AND (
    lower(trim(beans.origin_region)) = lower(regions.name)
    OR trim(beans.origin_region) = regions.name_ko
  );

WITH exact_entity_matches AS (
  SELECT beans.id, min(entities.id) AS entity_id
  FROM public.beans AS beans
  JOIN public.origin_entities AS entities
    ON entities.country_id = beans.origin_country_id
    AND (beans.origin_region_id IS NULL OR entities.region_id = beans.origin_region_id)
  WHERE beans.origin_entity_id IS NULL
    AND beans.farm_producer IS NOT NULL
    AND (
      lower(trim(beans.farm_producer)) = lower(entities.name)
      OR trim(beans.farm_producer) = entities.name_ko
      OR lower(trim(beans.farm_producer)) = lower(entities.farm_name)
      OR trim(beans.farm_producer) = entities.farm_name_ko
      OR lower(trim(beans.farm_producer)) = lower(entities.producer_name)
      OR trim(beans.farm_producer) = entities.producer_name_ko
    )
  GROUP BY beans.id
  HAVING count(*) = 1
)
UPDATE public.beans AS beans
SET origin_entity_id = exact_entity_matches.entity_id,
    farm_producer = entities.name
FROM exact_entity_matches
JOIN public.origin_entities AS entities ON entities.id = exact_entity_matches.entity_id
WHERE beans.id = exact_entity_matches.id;
'''

    output_path.write_text(sql_text, encoding="utf-8")
    print(
        f"Wrote {len(country_rows)} countries, {len(region_rows)} regions, "
        f"and {len(entity_rows)} entities to {output_path}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
