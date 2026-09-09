import type { CoffeeVarietyGuide } from "./types.ts";

/** Normalize typography only. A cultivar must not absorb descendants or similarly named populations. */
export function varietyLookupKey(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\s‐‑–—-]+/g, " ").trim();
}

export function buildVarietyGuideIndex(guides: CoffeeVarietyGuide[]): ReadonlyMap<string, CoffeeVarietyGuide> {
  const index = new Map<string, CoffeeVarietyGuide>();
  for (const guide of guides) {
    for (const name of [guide.name, guide.nameKo, ...guide.aliases]) {
      const key = varietyLookupKey(name);
      const previous = index.get(key);
      if (previous && previous.id !== guide.id) throw new Error(`Ambiguous variety alias: ${name}`);
      index.set(key, guide);
    }
  }
  return index;
}

export function matchVarietyGuides(names: string[], index: ReadonlyMap<string, CoffeeVarietyGuide>): CoffeeVarietyGuide[] {
  const selected = new Map<string, CoffeeVarietyGuide>();
  for (const name of names) {
    const guide = index.get(varietyLookupKey(name));
    if (guide) selected.set(guide.id, guide);
  }
  return [...selected.values()];
}
