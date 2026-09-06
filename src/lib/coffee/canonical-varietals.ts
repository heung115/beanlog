import { varietalPresets } from "../../data/varietal-presets.ts";

/** Canonical values for both UI languages. Display labels remain localized. */
export const VARIETAL_ALIASES: readonly (readonly [string, string])[] = varietalPresets.map(({ en, ko }) => [en, ko] as const);

const canonicalNames = new Map(VARIETAL_ALIASES.flatMap(([en, ko]) => [[en.toLowerCase(), en], [ko.toLowerCase(), en]] as const));

/** Match Go strings.TrimSpace and the exact-filter SQL Unicode whitespace set. */
export function trimCoffeeWhitespace(value: string): string {
  return value.replace(/^\p{White_Space}+|\p{White_Space}+$/gu, "");
}

export function canonicalVarietal(value: string): string {
  const text = trimCoffeeWhitespace(value);
  return canonicalNames.get(text.toLowerCase()) ?? text;
}

export function varietalDisplayName(value: string, locale: string): string {
  const canonical = canonicalVarietal(value);
  return locale === "ko" ? VARIETAL_ALIASES.find(([en]) => en === canonical)?.[1] ?? canonical : canonical;
}

export function splitCanonicalVarietals(value: string | null | undefined): string[] {
  const seen = new Set<string>();
  return (value ?? "").split(/[,，]/).map(canonicalVarietal).filter((name) => {
    const key = name.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function canonicalizeVarietals(value: string): string {
  return splitCanonicalVarietals(value).join(", ");
}
