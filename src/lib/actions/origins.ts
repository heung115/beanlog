"use server";

import { z } from "zod";
import { apiFetch } from "@/lib/api/client";
import { getGuideSubregionChains, mergeOriginSubregionChains } from "@/data/origin-guides";
import type {
  OriginCountryOption,
  OriginEntityOption,
  OriginRegionOption,
} from "@/types/database";

const originIdSchema = z.number().int().positive();
const subregionQuerySchema = z.object({
  country: z.string().trim().min(1).max(100),
  region: z.string().trim().max(200).optional(),
});

/** Returns only the values needed to render the country selector. */
export async function getOriginCountries(): Promise<OriginCountryOption[]> {
  try {
    return await apiFetch<OriginCountryOption[]>("/api/origins/countries");
  } catch {
    return [];
  }
}

/** Returns the region choices that belong to one selected country. */
export async function getOriginRegions(
  countryId: number
): Promise<OriginRegionOption[]> {
  const parsed = originIdSchema.safeParse(countryId);
  if (!parsed.success) return [];

  try {
    return await apiFetch<OriginRegionOption[]>(
      `/api/origins/countries/${parsed.data}/regions`
    );
  } catch {
    return [];
  }
}

/** Returns farm/producer/cooperative suggestions for one selected region. */
export async function getOriginEntities(
  countryId: number,
  regionId: number
): Promise<OriginEntityOption[]> {
  const country = originIdSchema.safeParse(countryId);
  const region = originIdSchema.safeParse(regionId);
  if (!country.success || !region.success) return [];

  try {
    return await apiFetch<OriginEntityOption[]>(
      `/api/origins/countries/${country.data}/regions/${region.data}/entities`
    );
  } catch {
    return [];
  }
}

/** Combine the user's own labels with researched, country-scoped origin suggestions. */
export async function getUserOriginSubregions({
  country,
  region,
}: {
  country: string;
  region?: string;
}): Promise<string[][]> {
  const parsed = subregionQuerySchema.safeParse({ country, region });
  if (!parsed.success) return [];

  const guideChains = getGuideSubregionChains(parsed.data.country, parsed.data.region);

  try {
    const savedChains = await apiFetch<string[][]>("/api/origins/subregions", {
      query: parsed.data,
    });
    return mergeOriginSubregionChains(savedChains, guideChains);
  } catch {
    return guideChains;
  }
}
