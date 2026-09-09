import type { OriginRegionGuide, OriginVarietyEvidence } from "../types.ts";

/** Spelling normalization only; named selections and uncertain local names remain distinct. */
export function varietyKey(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\bgeisha\b/g, "gesha").replace(/\bmaragogype\b/g, "maragogipe")
    .replace(/^jarc\s+(?=\d)/, "").replace(/[^a-z0-9]/g, "");
}

export function enrichVarieties(guides: OriginRegionGuide[], evidence: OriginVarietyEvidence[]): OriginRegionGuide[] {
  const result = guides.map((guide) => ({ ...guide, varieties: [...guide.varieties], sources: [...guide.sources] }));
  const byId = new Map(result.map((guide) => [guide.id, guide]));
  for (const entry of evidence) {
    let guide = byId.get(entry.regionId);
    if (!guide) throw new Error(`Unknown variety evidence region: ${entry.regionId}`);
    const country = guide.country;
    const visited = new Set<string>();
    while (guide && guide.country === country && !visited.has(guide.id)) {
      visited.add(guide.id);
      if (!guide.varieties.some((variety) => varietyKey(variety) === varietyKey(entry.variety))) guide.varieties.push(entry.variety);
      for (const source of entry.sources) {
        if (!guide.sources.some((existing) => existing.url === source.url)) guide.sources.push(source);
      }
      guide = guide.parentId ? byId.get(guide.parentId) : undefined;
    }
  }
  return result;
}
