import { originPresets } from "../../data/origin-presets.ts";
import type { BlendComponent } from "../../types/database.ts";
import { parseBeanLabelText } from "./bean-label-parser.ts";
import { normalizeLabelExtraction, type LabelExtraction } from "./bean-label.ts";

type Box = { x0: number; y0: number; x1: number; y1: number };
type Row = { text: string; bbox: Box; confidence: number; height: number; centerY: number; readable: boolean };
type Component = { value: BlendComponent; rows: Row[] };
const empty = (): LabelExtraction => ({ bean_type: "unknown", fields: {}, evidence: {} });
const controls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u;
const compact = (value: string) => value.replace(/\s+/gu, "");
// Damaged ratios remain candidate boundaries, even though only exact numeric
// percentages can become values. Never select a clean 100% subset around them.
const shareStart = /^[^%\s]{0,12}\s*%/u;
const shareValue = /^(\d{1,2}(?:\.\d{1,2})?)\s*%\s*([\p{L}\p{M}\d .,'’()\-/]*)$/u;
const processHeading = /^(?:process(?:ing)?|가공(?:\s*방식|\s*방법|법)?)(?:\s*[:：=]\s*|\s+)(.+)$/iu;
const countryHeading = /^(?:country(?:\s+of\s+origin)?|origin(?:\s+country)?|원\s*산\s*지|생\s*산\s*국|국\s*가|산\s*지)(?:\s*[:：=]\s*|\s+)/iu;
const unsuitable = /\b(?:brew(?:ing)?|recipe|dose|dosage|water|yield|ratio|nutrition(?:al)?|ingredients|sale|discount|off|price|save|coupon|promotion)\b|레\s*시\s*피|추\s*출|투\s*입|영양|원재료|할인|특가|쿠폰/iu;
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const countries = originPresets.map(({ country, countryKo }) => ({ country, pattern: new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${[country, countryKo].map(alias => [...alias.replace(/\s+/gu, "")].map(escape).join("[ \\t]*")).join("|")})(?![\\p{L}\\p{N}])`, "giu"),
}));

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function box(value: unknown): value is Box {
  return record(value) && [value.x0, value.y0, value.x1, value.y1].every(number => typeof number === "number" && Number.isFinite(number))
    && Number(value.x0) >= 0 && Number(value.y0) >= 0 && Number(value.x1) > Number(value.x0)
    && Number(value.y1) > Number(value.y0) && Number(value.x1) <= 100_000 && Number(value.y1) <= 100_000;
}

function confidence(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function readRows(value: unknown): Row[] {
  if (!Array.isArray(value) || value.length > 300) return [];
  const result: Row[] = [];
  for (const row of value) {
    if (!record(row) || typeof row.text !== "string" || !row.text.trim() || row.text.length > 500 || controls.test(row.text)
      || !box(row.bbox) || !confidence(row.confidence) || !Array.isArray(row.words) || !row.words.length || row.words.length > 100) return [];
    const bounds = row.bbox;
    let readable = row.confidence >= 85;
    const text: string[] = [];
    for (const word of row.words) {
      if (!record(word) || typeof word.text !== "string" || !word.text.trim() || controls.test(word.text)
        || !box(word.bbox) || !confidence(word.confidence) || word.bbox.x0 < bounds.x0 || word.bbox.y0 < bounds.y0
        || word.bbox.x1 > bounds.x1 || word.bbox.y1 > bounds.y1) return [];
      readable &&= word.confidence >= 80;
      text.push(word.text);
    }
    if (compact(text.join(" ")) !== compact(row.text)) return [];
    result.push({ text: row.text.trim(), bbox: { ...bounds }, confidence: row.confidence, readable,
      height: bounds.y1 - bounds.y0, centerY: (bounds.y0 + bounds.y1) / 2 });
  }
  // Detector containers need not follow page order. Unreadable rows remain
  // barriers: removing them would attach a percentage to a later lot's country.
  return result.sort((left, right) => left.centerY - right.centerY || left.bbox.x0 - right.bbox.x0);
}

function sameArea(left: Row, right: Row): boolean {
  const overlap = Math.max(0, Math.min(left.bbox.x1, right.bbox.x1) - Math.max(left.bbox.x0, right.bbox.x0));
  return overlap >= Math.min(left.bbox.x1 - left.bbox.x0, right.bbox.x1 - right.bbox.x0) * .5;
}

function sameColumn(left: Row, right: Row): boolean {
  const overlap = Math.max(0, Math.min(left.bbox.x1, right.bbox.x1) - Math.max(left.bbox.x0, right.bbox.x0));
  return overlap >= Math.min(left.bbox.x1 - left.bbox.x0, right.bbox.x1 - right.bbox.x0) * .65
    && Math.abs(left.bbox.x0 - right.bbox.x0) <= Math.max(left.height, right.height) * 1.5;
}

function adjacent(left: Row, right: Row): boolean {
  const minimum = Math.min(left.height, right.height), maximum = Math.max(left.height, right.height);
  return sameColumn(left, right) && maximum <= minimum * 2
    && right.centerY - left.centerY >= minimum * .25
    && right.bbox.y0 - left.bbox.y1 <= maximum * 1.5;
}

function nearbyBoundary(left: Row, right: Row): boolean {
  return sameArea(left, right) && right.centerY > left.centerY
    && right.bbox.y0 - left.bbox.y1 <= Math.max(left.height, right.height) * 1.5;
}

function countryMatches(value: string) {
  return countries.flatMap(({ country, pattern }) => {
    pattern.lastIndex = 0;
    return [...value.matchAll(pattern)].map(match => ({ country, match }));
  });
}

function printedCountry(value: string): string | undefined {
  if (unsuitable.test(value) || value.includes("%")) return undefined;
  const countryValue = value.replace(countryHeading, "");
  const matches = countryMatches(countryValue);
  if (matches.length !== 1) return undefined;
  const { country, match } = matches[0];
  const prefix = countryValue.slice(0, match.index).trim();
  const suffix = countryValue.slice((match.index ?? 0) + match[0].length).trim();
  // An unknown place before a comma stays display text. A country inside a
  // product name or prose is not an origin declaration.
  if (suffix || (prefix && !/^[\p{L}\p{M} .,'’()\-]+,\s*$/u.test(prefix))) return undefined;
  return country;
}

function readComponent(anchor: Row, rows: Row[]): Component | undefined {
  const share = shareValue.exec(anchor.text);
  if (!anchor.readable || !share || unsuitable.test(anchor.text) || Number(share[1]) <= 0 || Number(share[1]) >= 100) return undefined;
  // An indented or centered row can be a boundary in this column. The stricter
  // alignment rule applies only after the immediate source rows are selected.
  const following = rows.filter(row => row.centerY > anchor.centerY && sameArea(anchor, row));
  const origin = following[0], processing = following[1];
  if (!origin || !processing || !origin.readable || !processing.readable || !adjacent(anchor, origin) || !adjacent(origin, processing)
    || unsuitable.test(processing.text)) return undefined;
  const country = printedCountry(origin.text), process = processHeading.exec(processing.text);
  if (!country || !process || process[1].length > 200 || process[1].includes("%")) return undefined;
  const mentioned = new Set(countryMatches([anchor.text, origin.text, processing.text].join(" ")).map(match => match.country));
  if (mentioned.size !== 1 || !mentioned.has(country)) return undefined;
  // The known processing vocabulary and normalization are shared with the text
  // parser. No location, lot name, or OCR spelling is repaired here.
  const method = parseBeanLabelText(processing.text).fields.process_method;
  const value: BlendComponent = { origin_country: country, percentage: Number(share[1]) };
  if (method) {
    value.process_method = method;
    value.process_detail = process[1].trim();
  }
  return { value, rows: [anchor, origin, processing] };
}

/** Recover a complete stack of percentage / origin / processing blocks from
 * source geometry. Evidence stays verbatim; unknown places are display-only.
 * A single complete group is required, so unrelated products cannot be merged.
 */
export function extractLabelBlendLayout(value: unknown): LabelExtraction {
  const rows = readRows(value);
  const anchors = rows.filter(row => shareStart.test(row.text));
  const groups: Row[][] = [];
  for (const anchor of anchors) {
    const nearby = groups.filter(group => {
      const previous = group.at(-1)!;
      return sameColumn(previous, anchor) && anchor.centerY - previous.centerY <= Math.max(previous.height, anchor.height) * 8;
    });
    if (nearby.length > 1) return empty();
    if (nearby.length) nearby[0].push(anchor); else groups.push([anchor]);
  }
  const complete: Component[][] = [];
  const candidates = groups.map(group => ({ group, components: group.map(anchor => readComponent(anchor, rows)) }));
  // A second origin-bearing stack belongs to an unresolved product/column,
  // even when only the first stack happens to have a complete 100% total.
  if (candidates.filter(candidate => candidate.components.some(Boolean)).length > 1) return empty();
  for (const { group, components } of candidates) {
    if (group.length < 2 || group.length > 10) continue;
    if (!components.every((component): component is Component => Boolean(component))) continue;
    const used = components.flatMap(component => component.rows);
    if (new Set(used).size !== used.length || Math.abs(components.reduce((sum, component) => sum + component.value.percentage, 0) - 100) > .005) continue;
    const first = used[0], last = used.at(-1)!;
    const preceding = rows.filter(row => row.centerY < first.centerY && sameArea(first, row));
    const before = preceding.at(-1), earlier = preceding.at(-2);
    if (before && nearbyBoundary(before, first) && (shareStart.test(before.text)
      || (earlier && nearbyBoundary(earlier, before) && processHeading.test(before.text) && printedCountry(earlier.text)))) continue;
    const continuation = rows.filter(row => row.centerY > last.centerY && sameArea(last, row));
    // An adjacent uncounted country/process row may be a third lot whose
    // percentage was lost. A 100% subset cannot certify the entire stack.
    if (continuation[0] && nearbyBoundary(last, continuation[0])
      && (shareStart.test(continuation[0].text) || printedCountry(continuation[0].text) || processHeading.test(continuation[0].text)
        || (continuation[1] && nearbyBoundary(continuation[0], continuation[1]) && printedCountry(continuation[1].text)))) continue;
    // Recipes and promotional percentages cannot acquire coffee provenance
    // merely by being printed beside or above a processing description.
    if (rows.some(row => unsuitable.test(row.text) && sameArea(first, row)
      && row.centerY <= last.centerY && row.centerY >= first.centerY - first.height * 12)) continue;
    let connected = true;
    for (let index = 1; index < components.length; index += 1) {
      const previous = components[index - 1].rows.at(-1)!, next = components[index].rows[0];
      if (!adjacent(previous, next) || rows.some(row => row.centerY > previous.centerY && row.centerY < next.centerY
        && (sameArea(previous, row) || sameArea(next, row)))) connected = false;
    }
    if (connected) complete.push(components);
  }
  if (complete.length !== 1) return empty();
  const components = complete[0];
  const composition = components.map(component => component.rows.map(row => row.text).join(" / "));
  const evidence = composition.join(" / ");
  if (evidence.length > 500) return empty();
  const allProcessing = components.every(component => Boolean(component.value.process_method));
  const methods = new Set(components.map(component => component.value.process_method));
  const processing = allProcessing ? {
    process_method: { value: methods.size === 1 ? components[0].value.process_method : "other", evidence },
    process_detail: { value: components.map(({ value }) => `${value.process_detail} ${value.percentage}%`).join(" / "), evidence },
  } : {};
  return normalizeLabelExtraction({ bean_type: "blend", composition_lines: composition,
    fields: { blend_components: { value: components.map(component => component.value), evidence }, ...processing } });
}
