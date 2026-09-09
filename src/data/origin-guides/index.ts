import { originPresets, originSlug } from "../origin-presets.ts";
import { roasterOriginGuides } from "./roaster-regions.ts";
import { productDiscoveryGuides } from "./product-discovery.ts";
import { africaOriginGuides } from "./africa.ts";
import { southAmericaOriginGuides } from "./americas-south.ts";
import { centralAmericaOriginGuides } from "./americas-central.ts";
import { asiaPacificOriginGuides } from "./asia-pacific.ts";
import { additionalCountryOriginGuides, additionalGuideCountries } from "./additional-countries.ts";
import { additionalOriginRegionGuides } from "./additional-regions.ts";
import { enrichVarieties } from "./variety-research/enrich.ts";
import { originVarietyEvidence } from "./variety-research/index.ts";
import { newAfricaOriginGuides } from "./specialty-research/new-africa-guides.ts";
import { newSouthOriginGuides } from "./specialty-research/new-south-guides.ts";
import { newCentralOriginGuides } from "./specialty-research/new-central-guides.ts";
import { specialtyProfileById, specialtyVarietyEvidence } from "./specialty-research/index.ts";
import { mergeSpecialtySources } from "./specialty-research/model.ts";
import type { OriginRegionGuide } from "./types.ts";

export type { OriginRegionGuide, OriginGuideText, OriginGuideSource } from "./types.ts";

export const originRegionGuides: OriginRegionGuide[] = mergeSpecialtySources(enrichVarieties([
  ...africaOriginGuides,
  ...southAmericaOriginGuides,
  ...centralAmericaOriginGuides,
  ...asiaPacificOriginGuides,
  ...additionalCountryOriginGuides,
  ...additionalOriginRegionGuides,
  ...newAfricaOriginGuides,
  ...newSouthOriginGuides,
  ...newCentralOriginGuides,
  ...roasterOriginGuides,
  ...productDiscoveryGuides,
], [...originVarietyEvidence, ...specialtyVarietyEvidence]), specialtyProfileById);

export const originGuideCountries = [
  ...originPresets.map(({ country, countryKo }) => ({ country, countryKo })),
  ...additionalGuideCountries,
];

export function findGuideCountry(country: string) {
  const query = normalizeOriginGuideQuery(country);
  const canonical = query === "tanzania, united republic of" ? "tanzania" : query;
  return originGuideCountries.find((entry) => [entry.country, entry.countryKo].some((name) => normalizeOriginGuideQuery(name) === canonical));
}

export function findGuideCountryBySlug(slug: string) {
  return originGuideCountries.find((entry) => originSlug(entry.country) === slug);
}

export function regionGuideSlug(guide: OriginRegionGuide): string {
  return guide.id.replace(new RegExp(`^${originSlug(guide.country)}-`), "");
}

export function regionGuidePath(guide: OriginRegionGuide): string {
  return `/origins/${originSlug(guide.country)}/${regionGuideSlug(guide)}`;
}

export function getCountryRegionGuides(country: string): OriginRegionGuide[] {
  // The input catalog retains the workbook's formal country label.
  const lookup = country.trim().toLowerCase() === "tanzania, united republic of" ? "Tanzania" : country;
  const canonicalCountry = findGuideCountry(lookup)?.country ?? lookup;
  return originRegionGuides.filter((guide) => guide.country === canonicalCountry);
}

export function getRegionChildren(id: string): OriginRegionGuide[] {
  return originRegionGuides.filter((guide) => guide.parentId === id);
}

export function findRegionGuideByRoute(countrySlug: string, regionSlug: string): OriginRegionGuide | undefined {
  return originRegionGuides.find((guide) => originSlug(guide.country) === countrySlug && regionGuideSlug(guide) === regionSlug);
}

export function normalizeOriginGuideQuery(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
}

/** Resolve explicit names only: a trade label must not silently move to a different place. */
export function findRegionGuide(country: string, region: string): OriginRegionGuide | undefined {
  const query = normalizeOriginGuideQuery(region);
  return getCountryRegionGuides(country).find((guide) =>
    [guide.name, guide.nameKo, ...guide.aliases].some((name) => normalizeOriginGuideQuery(name) === query)
  );
}

/** Follow only known, compatible geography in a record; never guess from a farm name. */
export function getRecordOriginGuide(country: string, region?: string | null, subregions?: string[] | null): OriginRegionGuide | undefined {
  let selected = region?.trim() ? findRegionGuide(country, region) : undefined;
  if (region?.trim() && !selected) return undefined;
  const byId = new Map(getCountryRegionGuides(country).map((guide) => [guide.id, guide]));
  for (const part of subregions ?? []) {
    const candidate = findRegionGuide(country, part);
    if (!candidate) break;
    if (selected) {
      let ancestor: OriginRegionGuide | undefined = candidate;
      const visited = new Set<string>();
      while (ancestor && ancestor.id !== selected.id && !visited.has(ancestor.id)) {
        visited.add(ancestor.id);
        ancestor = ancestor.parentId ? byId.get(ancestor.parentId) : undefined;
      }
      if (ancestor?.id !== selected.id) break;
    }
    selected = candidate;
  }
  return selected;
}

/** Relative chains for the existing record form; canonical names are stored in English. */
export function getGuideSubregionChains(country: string, region?: string): string[][] {
  const guides = getCountryRegionGuides(country);
  const selected = region?.trim() ? findRegionGuide(country, region) : undefined;
  if (region?.trim() && !selected) return [];
  const byId = new Map(guides.map((guide) => [guide.id, guide]));
  const chains: string[][] = [];
  for (const guide of guides) {
    if (guide.id === selected?.id) continue;
    const chain: string[] = [];
    const seen = new Set<string>();
    let current: OriginRegionGuide | undefined = guide;
    while (current && current.id !== selected?.id && !seen.has(current.id)) {
      seen.add(current.id);
      chain.unshift(current.name);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    if (chain.length > 0 && (!selected || current?.id === selected.id)) chains.push(chain);
  }
  return chains;
}

export function mergeOriginSubregionChains(...groups: string[][][]): string[][] {
  const unique = new Map<string, string[]>();
  for (const chain of groups.flat()) {
    const clean = chain.map((part) => part.trim()).filter(Boolean);
    if (clean.length === 0) continue;
    const key = JSON.stringify(clean.map(normalizeOriginGuideQuery));
    if (!unique.has(key)) unique.set(key, clean);
  }
  return [...unique.values()];
}
