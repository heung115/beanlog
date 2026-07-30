"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type {
  OriginCountryOption,
  OriginEntityOption,
  OriginRegionOption,
} from "@/types/database";

const originIdSchema = z.number().int().positive();
const noisySegmentPattern = /^(contact|contact name|exporter name|phone|phone number|tel|mobile|email)$/i;
const contactValuePattern = /@|\b(phone|tel|mobile|email)\b|[0-9][0-9 -]{5,}/i;

function cleanEntityName(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const cleanParts = trimmed
    .split("|")
    .map((part) => part.trim())
    .filter((part) => part && !noisySegmentPattern.test(part) && !contactValuePattern.test(part));

  const cleaned = cleanParts[0] ?? trimmed;
  if (noisySegmentPattern.test(cleaned) || contactValuePattern.test(cleaned)) return null;
  return cleaned;
}

async function hasAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Returns only the values needed to render the country selector. */
export async function getOriginCountries(): Promise<OriginCountryOption[]> {
  const { supabase, user } = await hasAuthenticatedUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("origin_countries")
    .select("id, name_en, name_ko")
    .order("name_en", { ascending: true });

  if (error || !data) return [];
  return data as OriginCountryOption[];
}

/** Returns the region choices that belong to one selected country. */
export async function getOriginRegions(
  countryId: number
): Promise<OriginRegionOption[]> {
  const parsed = originIdSchema.safeParse(countryId);
  if (!parsed.success) return [];

  const { supabase, user } = await hasAuthenticatedUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("origin_regions")
    .select("id, display_name, display_name_ko")
    .eq("country_id", parsed.data)
    .eq("is_canonical", true)
    .order("display_name", { ascending: true });

  if (error || !data) return [];
  return data
    .filter((region) => Boolean(region.display_name))
    .map((region) => ({
      id: region.id,
      name: region.display_name,
      name_ko: region.display_name_ko,
    })) as OriginRegionOption[];
}

/** Returns farm/producer/cooperative suggestions for one selected region. */
export async function getOriginEntities(
  countryId: number,
  regionId: number
): Promise<OriginEntityOption[]> {
  const country = originIdSchema.safeParse(countryId);
  const region = originIdSchema.safeParse(regionId);
  if (!country.success || !region.success) return [];

  const { supabase, user } = await hasAuthenticatedUser();
  if (!user) return [];

  const { data: selectedRegion, error: selectedRegionError } = await supabase
    .from("origin_regions")
    .select("id, canonical_region_id")
    .eq("id", region.data)
    .eq("country_id", country.data)
    .single();
  if (
    selectedRegionError ||
    !selectedRegion ||
    selectedRegion.canonical_region_id !== selectedRegion.id
  ) {
    return [];
  }

  const { data: regionAliases, error: aliasesError } = await supabase
    .from("origin_regions")
    .select("id")
    .eq("country_id", country.data)
    .eq("canonical_region_id", selectedRegion.id);
  if (aliasesError || !regionAliases || regionAliases.length === 0) return [];

  const { data, error } = await supabase
    .from("origin_entities")
    .select("id, name, name_ko, entity_type, farm_name, producer_name, mill_name")
    .eq("country_id", country.data)
    .in(
      "region_id",
      regionAliases.map((regionAlias) => regionAlias.id)
    )
    .order("name", { ascending: true });

  if (error || !data) return [];
  const entities: OriginEntityOption[] = [];

  for (const entity of data) {
      const displayName =
        cleanEntityName(entity.name) ??
        cleanEntityName(entity.farm_name) ??
        cleanEntityName(entity.producer_name) ??
        cleanEntityName(entity.mill_name);
      if (!displayName) continue;

      const hasSpecificSource = Boolean(
        cleanEntityName(entity.farm_name) ||
          cleanEntityName(entity.producer_name) ||
          cleanEntityName(entity.mill_name)
      );
      if (entity.entity_type === "미분류" && !hasSpecificSource) continue;

      entities.push({
        ...entity,
        name: displayName,
        name_ko: entity.name === displayName ? entity.name_ko : null,
      });
  }

  return entities;
}

/** Returns this user's previously entered origin subregion chains. */
export async function getUserOriginSubregions({
  country,
  region,
}: {
  country: string;
  region?: string;
}): Promise<string[][]> {
  const countryName = country.trim();
  const regionName = region?.trim();
  if (!countryName) return [];

  const { supabase, user } = await hasAuthenticatedUser();
  if (!user) return [];

  let beansQuery = supabase
    .from("beans")
    .select("origin_subregions")
    .eq("user_id", user.id)
    .eq("origin_country", countryName)
    .not("origin_subregions", "eq", "{}");

  let blendQuery = supabase
    .from("blend_components")
    .select("origin_subregions")
    .eq("user_id", user.id)
    .eq("origin_country", countryName)
    .not("origin_subregions", "eq", "{}");

  if (regionName) {
    beansQuery = beansQuery.eq("origin_region", regionName);
    blendQuery = blendQuery.eq("origin_region", regionName);
  }

  const [{ data: beansData, error: beansError }, { data: blendData, error: blendError }] =
    await Promise.all([beansQuery.limit(200), blendQuery.limit(200)]);
  if (beansError && blendError) return [];

  const seen = new Set<string>();
  const chains: string[][] = [];
  for (const row of [...(beansData ?? []), ...(blendData ?? [])]) {
    const subregions = Array.isArray(row.origin_subregions)
      ? row.origin_subregions
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean)
      : [];
    if (subregions.length === 0) continue;
    const key = subregions.map((item) => item.toLowerCase()).join("\u001f");
    if (seen.has(key)) continue;
    seen.add(key);
    chains.push(subregions);
  }

  return chains.sort((a, b) => a.join(" ").localeCompare(b.join(" ")));
}
