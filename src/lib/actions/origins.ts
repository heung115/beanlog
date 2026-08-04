"use server";

import { z } from "zod";
import { apiFetch } from "@/lib/api/client";
import type {
  OriginCountryOption,
  OriginEntityOption,
  OriginRegionOption,
} from "@/types/database";

const originIdSchema = z.number().int().positive();

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

/** Returns this user's previously entered origin subregion chains. */
export async function getUserOriginSubregions({
  country,
  region,
}: {
  country: string;
  region?: string;
}): Promise<string[][]> {
  const countryName = country.trim();
  if (!countryName) return [];

  try {
    return await apiFetch<string[][]>("/api/origins/subregions", {
      query: { country: countryName, region: region?.trim() },
    });
  } catch {
    return [];
  }
}
