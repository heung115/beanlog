import type { BeanFormData } from "../../types/database";

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
] as const;

export type LabelField = (typeof LABEL_FIELDS)[number];
export type LabelValues = Partial<Pick<BeanFormData, LabelField>>;

export interface LabelExtraction {
  bean_type: "single_origin" | "blend" | "unknown";
  fields: LabelValues;
  evidence: Partial<Record<LabelField, string>>;
}

const PROCESS_METHODS = ["washed", "natural", "honey", "anaerobic", "carbonic", "decaf", "other"] as const;
const ROAST_LEVELS = ["light", "medium", "dark"] as const;
const ORIGIN_FIELDS: readonly LabelField[] = ["origin_country", "origin_region", "farm_producer"];
const TEXT_LIMITS: Record<Exclude<LabelField, "weight_g">, number> = {
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

function cleanValue(field: LabelField, value: unknown): string | number | undefined {
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

/** Discard unsupported guesses, malformed values, and anything without a readable source quote. */
export function normalizeLabelExtraction(raw: unknown): LabelExtraction {
  const result: LabelExtraction = { bean_type: "unknown", fields: {}, evidence: {} };
  if (!isRecord(raw)) return result;
  const beanType = own(raw, "bean_type");
  if (beanType === "single_origin" || beanType === "blend") result.bean_type = beanType;
  const fields = own(raw, "fields");
  if (!isRecord(fields)) return result;

  for (const field of LABEL_FIELDS) {
    const candidate = own(fields, field);
    if (!isRecord(candidate)) continue;
    const evidence = cleanText(own(candidate, "evidence"), EVIDENCE_LIMIT);
    const value = cleanValue(field, own(candidate, "value"));
    if (!evidence || value === undefined) continue;
    Object.assign(result.fields, { [field]: value });
    result.evidence[field] = evidence;
  }
  return result;
}

function validatedExtraction(extraction: LabelExtraction): LabelExtraction {
  return normalizeLabelExtraction({
    bean_type: extraction.bean_type,
    fields: Object.fromEntries(LABEL_FIELDS.map((field) => [field, {
      value: extraction.fields[field],
      evidence: extraction.evidence[field],
    }])),
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
    if (eligible.has(field) && !ORIGIN_FIELDS.includes(field)) Object.assign(next, { [field]: safe.fields[field] });
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
  return next;
}
