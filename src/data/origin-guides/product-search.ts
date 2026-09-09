import { productOriginLinks } from "./product-origin-links.ts";

const termsByRegion = new Map<string, Set<string>>();
for (const link of productOriginLinks) {
  const terms = termsByRegion.get(link.regionId) ?? new Set<string>();
  terms.add(link.originalName);
  termsByRegion.set(link.regionId, terms);
}

export function productOriginSearchTerms(regionId: string): string[] {
  return [...(termsByRegion.get(regionId) ?? [])];
}
