import type { BeanFormData, BlendComponent } from "../../types/database";
import { flavorPresets } from "../../data/flavor-wheel.ts";

export const LABEL_FIELDS = [
  "name",
  "roastery",
  "origin_country",
  "origin_region",
  "farm_producer",
  "varietal",
  "process_method",
  "process_detail",
  "roast_level",
  "roast_date",
  "weight_g",
  "blend_components",
] as const;

export type LabelField = (typeof LABEL_FIELDS)[number];
export type LabelValues = Partial<Pick<BeanFormData, LabelField>>;

export interface LabelExtraction {
  bean_type: "single_origin" | "blend" | "unknown";
  fields: LabelValues;
  evidence: Partial<Record<LabelField, string>>;
  /** Display-only printed lot descriptions, in the same order as blend_components. */
  composition_lines?: string[];
  /** The roaster's printed cup notes; these never become the user's tasting data. */
  tasting_notes?: { en: string[]; ko: string[] };
  tasting_notes_evidence?: string[];
  /** Exact dictionary translations of the English reading, not Korean OCR text. */
  tasting_notes_translation_ko?: string[];
}

const PROCESS_METHODS = ["washed", "natural", "honey", "anaerobic", "carbonic", "decaf", "other"] as const;
const ROAST_LEVELS = ["light", "medium", "dark"] as const;
const ORIGIN_FIELDS: readonly LabelField[] = ["origin_country", "origin_region", "farm_producer"];
const TEXT_LIMITS: Record<Exclude<LabelField, "weight_g" | "blend_components">, number> = {
  name: 200,
  roastery: 200,
  origin_country: 100,
  origin_region: 100,
  farm_producer: 200,
  varietal: 100,
  process_method: 20,
  process_detail: 200,
  roast_level: 10,
  roast_date: 10,
};
const EVIDENCE_LIMIT = 500;
const TASTING_NOTE_LIMIT = 20;
const noteDictionaryKey = (text: string) => text.normalize("NFKC").toLowerCase().replace(/[\s-]+/gu, "");
const noteTranslations = new Map([
  ...flavorPresets.map((flavor): [string, string] => [noteDictionaryKey(flavor.tag), flavor.tagKo]),
  ["greenapple", "청사과"], ["redapple", "빨간사과"], ["yellowapple", "노란사과"],
  ["candy", "캔디"], ["sugar", "설탕"], ["nuts", "견과류"], ["blacktea", "블랙티"], ["milkchocolate", "밀크초콜릿"],
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function own(record: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

function cleanText(value: unknown, limit: number): string | undefined {
  if (typeof value !== "string") return undefined;
  // Tabs and line breaks occur in printed labels; hidden controls and bidi overrides do not.
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u.test(value)) return undefined;
  const text = value.trim().replace(/\s+/gu, " ");
  if (!text || text.length > limit) return undefined;
  if (/^(?:null|undefined|unknown|none|n\/?a|not (?:visible|provided|specified)|미표기|미상|알 수 없음|확인 불가|없음|-+)$/iu.test(text)) return undefined;
  return text;
}

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function cleanComposition(value: unknown): BlendComponent[] | undefined {
  if (!Array.isArray(value) || value.length < 2 || value.length > 10) return undefined;
  const components: BlendComponent[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return undefined;
    const country = cleanText(own(entry, "origin_country"), TEXT_LIMITS.origin_country);
    const percentage = own(entry, "percentage");
    if (!country || typeof percentage !== "number" || !Number.isFinite(percentage) || percentage <= 0 || percentage > 100) return undefined;
    if (Math.abs(percentage * 100 - Math.round(percentage * 100)) > 0.000001) return undefined;
    const component: BlendComponent = { origin_country: country, percentage, sort_order: components.length };
    for (const field of ["origin_region", "farm_producer", "varietal", "process_method", "process_detail"] as const) {
      const text = cleanText(own(entry, field), TEXT_LIMITS[field]);
      if (text && (field !== "process_method" || PROCESS_METHODS.some(method => method === text))) Object.assign(component, { [field]: text });
    }
    const subregions = own(entry, "origin_subregions");
    if (Array.isArray(subregions) && subregions.length <= 10) {
      const names = subregions.map((name) => cleanText(name, 100));
      if (names.every((name): name is string => Boolean(name))) component.origin_subregions = names;
    }
    components.push(component);
  }
  // Do not invent a missing share or normalize an incomplete printed recipe.
  return Math.abs(components.reduce((sum, component) => sum + component.percentage, 0) - 100) < 0.005 ? components : undefined;
}

function cleanValue(field: LabelField, value: unknown): string | number | BlendComponent[] | undefined {
  if (field === "blend_components") return cleanComposition(value);
  if (field === "weight_g") {
    return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 100_000 ? value : undefined;
  }
  const text = cleanText(value, TEXT_LIMITS[field]);
  if (!text) return undefined;
  if (field === "process_method" && !PROCESS_METHODS.some((method) => method === text)) return undefined;
  if (field === "roast_level" && !ROAST_LEVELS.some((level) => level === text)) return undefined;
  if (field === "roast_date" && !isRealDate(text)) return undefined;
  return text;
}

function cleanList(value: unknown, count: number, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, count).flatMap((entry) => {
    const text = cleanText(entry, limit);
    const key = text?.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ");
    if (!text || !key || seen.has(key)) return [];
    seen.add(key);
    return [text];
  });
}

function normalizeDisplayMetadata(raw: Record<string, unknown>, result: LabelExtraction) {
  const composition = own(raw, "composition_lines");
  if (Array.isArray(composition) && result.fields.blend_components
    && composition.length === result.fields.blend_components.length) {
    const lines = composition.map((line) => cleanText(line, EVIDENCE_LIMIT));
    // Never drop an individual row: doing so would attach its text to a different lot.
    if (lines.every((line): line is string => Boolean(line))) result.composition_lines = lines;
  }
  const notes = own(raw, "tasting_notes");
  const evidence = cleanList(own(raw, "tasting_notes_evidence"), 10, EVIDENCE_LIMIT);
  if (!isRecord(notes) || !evidence.length) return;
  const sourceKey = (text: string) => text.normalize("NFKC").toLowerCase().replace(/\s+/gu, "");
  const sources = evidence.map(sourceKey);
  const read = (language: "en" | "ko") => cleanList(own(notes, language), TASTING_NOTE_LIMIT, 80)
    .filter((note) => (language === "ko" ? /[가-힣]/u.test(note) : /[a-z]/iu.test(note) && !/[가-힣]/u.test(note))
      && sources.some((source) => source.includes(sourceKey(note))));
  const en = read("en");
  const ko = read("ko");
  if (en.length || ko.length) {
    result.tasting_notes = { en, ko };
    result.tasting_notes_evidence = evidence;
    const translated = en.map((note) => noteTranslations.get(noteDictionaryKey(note)));
    // No fuzzy spelling repair or completion: every English note must match.
    if (translated.length && translated.every((note): note is string => Boolean(note))) result.tasting_notes_translation_ko = translated;
  }
}

/** Discard unsupported guesses, malformed values, and anything without a readable source quote. */
export function normalizeLabelExtraction(raw: unknown): LabelExtraction {
  const result: LabelExtraction = { bean_type: "unknown", fields: {}, evidence: {} };
  if (!isRecord(raw)) return result;
  const beanType = own(raw, "bean_type");
  if (beanType === "single_origin" || beanType === "blend") result.bean_type = beanType;
  const fields = own(raw, "fields");
  if (!isRecord(fields)) return result;

  for (const field of LABEL_FIELDS) {
    if (field === "blend_components" && result.bean_type !== "blend") continue;
    const candidate = own(fields, field);
    if (!isRecord(candidate)) continue;
    const evidence = cleanText(own(candidate, "evidence"), EVIDENCE_LIMIT);
    const value = cleanValue(field, own(candidate, "value"));
    if (!evidence || value === undefined) continue;
    Object.assign(result.fields, { [field]: value });
    result.evidence[field] = evidence;
  }
  normalizeDisplayMetadata(raw, result);
  return result;
}

function validatedExtraction(extraction: LabelExtraction): LabelExtraction {
  return normalizeLabelExtraction({
    bean_type: extraction.bean_type,
    composition_lines: extraction.composition_lines,
    tasting_notes: extraction.tasting_notes,
    tasting_notes_evidence: extraction.tasting_notes_evidence,
    fields: Object.fromEntries(LABEL_FIELDS.map((field) => [field, {
      value: extraction.fields[field],
      evidence: extraction.evidence[field],
    }])),
  });
}

/** Independent views may fill missing facts, but conflicting readings stay unselected. */
export function mergeLabelExtractions(extractions: LabelExtraction[]): LabelExtraction {
  const safe = extractions.map(validatedExtraction);
  const bean_type = safe.some(result => result.bean_type === "blend") ? "blend"
    : safe.some(result => result.bean_type === "single_origin") ? "single_origin" : "unknown";
  const fields: Record<string, { value: unknown; evidence: string | undefined }> = {};
  const textKey = (value: unknown) => JSON.stringify(value).normalize("NFKC").replace(/\s+/gu, " ").toLowerCase();
  const key = (field: LabelField, result: LabelExtraction) => {
    const value = result.fields[field];
    // Sparse OCR can swap printed lines. Compare lots as a multiset while
    // retaining the preferred block scan's original display order.
    if (field === "blend_components" && Array.isArray(value)) {
      return JSON.stringify(value.map(component => textKey(Object.fromEntries(Object.entries(component).filter(([name]) => name !== "sort_order")))).sort());
    }
    if (field === "process_detail" && result.bean_type === "blend" && typeof value === "string") {
      const shares = value.split(" / ");
      if (shares.length > 1 && shares.every(share => /\D.*\d+(?:\.\d+)?%$/u.test(share))) return JSON.stringify(shares.map(textKey).sort());
    }
    return textKey(value);
  };
  for (const field of LABEL_FIELDS) {
    const candidates = safe.filter(result => result.fields[field] !== undefined);
    if (candidates.length && new Set(candidates.map(result => key(field, result))).size === 1) {
      fields[field] = { value: candidates[0].fields[field], evidence: candidates[0].evidence[field] };
    }
  }
  const componentKey = (component: unknown) => isRecord(component)
    ? textKey(Object.fromEntries(Object.entries(component).filter(([name]) => name !== "sort_order"))) : "";
  let compositionLines: string[] | undefined;
  if (Array.isArray(fields.blend_components?.value)) {
    for (const result of safe) {
      if (!result.fields.blend_components || !result.composition_lines) continue;
      const remaining = result.fields.blend_components.map((component, index) => ({ key: componentKey(component), line: result.composition_lines![index] }));
      const ordered = fields.blend_components.value.map((component) => {
        const index = remaining.findIndex((row) => row.key === componentKey(component));
        return index < 0 ? undefined : remaining.splice(index, 1)[0].line;
      });
      if (!remaining.length && ordered.every((line): line is string => Boolean(line))) { compositionLines = ordered; break; }
    }
  }
  // Keep each language from one actual reading. Combining conflicting OCR spellings
  // would turn a seven-note list into a misleading list of fourteen different notes.
  const notesSource = (language: "en" | "ko") => safe.filter(result => result.tasting_notes?.[language].length)
    .sort((left, right) => right.tasting_notes![language].length - left.tasting_notes![language].length)[0];
  const en = notesSource("en");
  const ko = notesSource("ko");
  return normalizeLabelExtraction({
    bean_type, fields, composition_lines: compositionLines,
    tasting_notes: { en: en?.tasting_notes?.en ?? [], ko: ko?.tasting_notes?.ko ?? [] },
    tasting_notes_evidence: [...new Set([...(en?.tasting_notes_evidence ?? []), ...(ko?.tasting_notes_evidence ?? [])])],
  });
}

function sameOrigin(left: string | undefined, right: string | undefined): boolean {
  return (left ?? "").trim().replace(/\s+/gu, " ").toLowerCase() === (right ?? "").trim().replace(/\s+/gu, " ").toLowerCase();
}

/** Return the selected candidates that can be applied without mixing incompatible origins. */
export function eligibleLabelFields(current: BeanFormData, extraction: LabelExtraction, selected: LabelField[]): LabelField[] {
  const safe = validatedExtraction(extraction);
  const wanted = new Set<LabelField>(selected);
  const eligible = new Set(LABEL_FIELDS.filter((field) => wanted.has(field) && safe.fields[field] !== undefined));

  const process = eligible.has("process_method") ? safe.fields.process_method : current.process_method;
  if (safe.fields.process_method && process !== safe.fields.process_method) eligible.delete("process_detail");

  if (current.bean_type === "blend" || safe.bean_type === "blend") {
    for (const field of ORIGIN_FIELDS) eligible.delete(field);
    eligible.delete("varietal");
    return LABEL_FIELDS.filter((field) => eligible.has(field));
  }

  const country = eligible.has("origin_country") ? safe.fields.origin_country : current.origin_country;
  const countryChanged = eligible.has("origin_country") && !sameOrigin(country, current.origin_country);
  const countryCompatible = Boolean(country?.trim()) && (!safe.fields.origin_country || sameOrigin(country, safe.fields.origin_country));
  if (!countryCompatible) {
    eligible.delete("origin_region");
    eligible.delete("farm_producer");
  }

  const region = eligible.has("origin_region") ? safe.fields.origin_region : countryChanged ? undefined : current.origin_region;
  if (safe.fields.origin_region && !sameOrigin(region, safe.fields.origin_region)) eligible.delete("farm_producer");
  return LABEL_FIELDS.filter((field) => eligible.has(field));
}

/** Explicit selection permits replacing a value; this never saves a record or changes tasting data. */
export function applyLabelFields(current: BeanFormData, extraction: LabelExtraction, selected: LabelField[]): BeanFormData {
  const safe = validatedExtraction(extraction);
  const eligible = new Set(eligibleLabelFields(current, safe, selected));
  const next = { ...current };

  if (eligible.has("process_method") && safe.fields.process_method !== current.process_method) {
    next.process_detail = undefined;
  }

  for (const field of LABEL_FIELDS) {
    if (eligible.has(field) && field !== "blend_components" && !ORIGIN_FIELDS.includes(field)) Object.assign(next, { [field]: safe.fields[field] });
  }

  if (eligible.has("origin_country")) {
    if (!sameOrigin(next.origin_country, safe.fields.origin_country)) {
      next.origin_country_id = undefined;
      next.origin_region = undefined;
      next.origin_region_id = undefined;
      next.origin_subregions = undefined;
      next.origin_lat = undefined;
      next.origin_lng = undefined;
      next.farm_producer = undefined;
      next.origin_entity_id = undefined;
    }
    next.origin_country = safe.fields.origin_country;
  }
  if (eligible.has("origin_region")) {
    if (!sameOrigin(next.origin_region, safe.fields.origin_region)) {
      next.origin_region_id = undefined;
      next.origin_subregions = undefined;
      next.origin_lat = undefined;
      next.origin_lng = undefined;
      next.farm_producer = undefined;
      next.origin_entity_id = undefined;
    }
    next.origin_region = safe.fields.origin_region;
  }
  if (eligible.has("farm_producer")) {
    if (!sameOrigin(next.farm_producer, safe.fields.farm_producer)) next.origin_entity_id = undefined;
    next.farm_producer = safe.fields.farm_producer;
  }
  if (eligible.has("blend_components")) {
    next.bean_type = "blend";
    next.blend_components = safe.fields.blend_components?.map(component => ({ ...component }));
  }
  return next;
}
