import type { OriginRegionGuide, OriginSpecialtyProfile } from "../types.ts";

export const specialtyPriorityOrder = { focus: 0, standard: 1, background: 2 } as const;

export function buildSpecialtyIndex(profiles: OriginSpecialtyProfile[]) {
  const byId = new Map<string, OriginSpecialtyProfile>();
  for (const profile of profiles) {
    if (byId.has(profile.regionId)) throw new Error(`Duplicate specialty profile: ${profile.regionId}`);
    byId.set(profile.regionId, profile);
  }
  return byId;
}

export function sortBySpecialty(guides: OriginRegionGuide[], profiles: ReadonlyMap<string, OriginSpecialtyProfile>): OriginRegionGuide[] {
  return [...guides].sort((a, b) => {
    const first = profiles.get(a.id)?.priority ?? "background";
    const second = profiles.get(b.id)?.priority ?? "background";
    return specialtyPriorityOrder[first] - specialtyPriorityOrder[second];
  });
}

export function specialtySearchTerms(profile?: OriginSpecialtyProfile): string[] {
  return profile?.lots.flatMap((lot) => [lot.name, ...(lot.producer ? [lot.producer] : []), lot.location, ...lot.varieties,
    ...(lot.process ? [lot.process.ko, lot.process.en] : []), ...lot.flavorNotes.ko, ...lot.flavorNotes.en,
    ...lot.sources.map((source) => source.publisher)]) ?? [];
}

export function mergeSpecialtySources(guides: OriginRegionGuide[], profiles: ReadonlyMap<string, OriginSpecialtyProfile>): OriginRegionGuide[] {
  return guides.map((guide) => {
    const profile = profiles.get(guide.id);
    if (!profile) return guide;
    const sources = [...guide.sources];
    for (const source of [...profile.sources, ...profile.lots.flatMap((lot) => lot.sources)]) {
      if (!sources.some((existing) => existing.url === source.url)) sources.push(source);
    }
    return { ...guide, sources };
  });
}
