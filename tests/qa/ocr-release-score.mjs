// Independent, deterministic field scoring. This module never runs OCR.
export const FIELD_NAMES = ["name", "roastery", "origin_country", "origin_region", "farm_producer", "varietal", "process_method", "process_detail", "roast_level", "roast_date", "weight_g", "blend_components"];
export const CORE_FIELDS = ["name", "origin_country", "weight_g", "roastery"];
export const normalize = value => String(value).replace(/[™®℠]/gu, "").normalize("NFKC").toLowerCase().replace(/[\s\p{P}]+/gu, "");
export const absent = value => value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
export function matches(actual, expected) {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) return false;
    const unused = [...actual];
    return expected.every(want => { const i = unused.findIndex(got => matches(got, want)); return i < 0 ? false : (unused.splice(i, 1), true); });
  }
  if (expected && typeof expected === "object") return Boolean(actual && typeof actual === "object" && Object.entries(expected).every(([key, value]) => matches(actual[key], value)));
  if (typeof expected === "number") return actual === expected;
  return typeof actual === "string" && normalize(actual) === normalize(expected);
}
const get = (object, dotted) => dotted.split(".").reduce((value, key) => value?.[key], object);
// Both { "fields.name": [value] } and { fields: { name: [value] } }
// declare the same forbidden values. Preserve leaf values exactly.
export function forbiddenValueEntries(mapping = {}, prefix = "") {
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) throw new Error("forbiddenValues must be a mapping of paths to arrays");
  return Object.entries(mapping).flatMap(([field, values]) => {
    const dotted = prefix ? `${prefix}.${field}` : field;
    if (Array.isArray(values)) return [[dotted, values]];
    if (values && typeof values === "object") return forbiddenValueEntries(values, dotted);
    throw new Error(`forbiddenValues.${dotted} must be an array or nested mapping`);
  });
}
export function scoreFixture(fixture, extraction) {
  const records = [];
  for (const [field, expected] of Object.entries(fixture.expected?.fields ?? {})) {
    const actual = extraction?.fields?.[field];
    const accepted = [expected, ...(fixture.expectedAlternatives?.fields?.[field] ?? [])];
    records.push({ field, expected, actual: actual ?? null, status: absent(actual) ? "missing" : accepted.some(value => matches(actual, value)) ? "correct" : "wrong", core: CORE_FIELDS.includes(field) });
  }
  for (const [language, expected] of Object.entries(fixture.expected?.tasting_notes ?? {})) {
    const actual = extraction?.tasting_notes?.[language];
    records.push({ field: `tasting_notes.${language}`, expected, actual: actual ?? null, status: absent(actual) ? "missing" : matches(actual, expected) ? "correct" : "wrong", core: false });
  }
  const blankPaths = [...(fixture.mustRemainUnknown ?? []).filter(field => FIELD_NAMES.includes(field)).map(field => `fields.${field}`), ...(fixture.mustRemainEmpty ?? [])];
  if (fixture.kind === "negative") blankPaths.push(...FIELD_NAMES.map(field => `fields.${field}`), "tasting_notes.en", "tasting_notes.ko", "tasting_notes_translation_ko", "composition_lines");
  const blankChecks = [...new Set(blankPaths)].map(field => { const actual = get(extraction, field); return { field, actual: actual ?? null, status: extraction == null ? "unmeasured" : absent(actual) ? "correct" : "unsupported" }; });
  const excluded = new Set(fixture.evaluationExclusions ?? []);
  const declared = new Set([...Object.keys(fixture.expected?.fields ?? {}), ...(fixture.mustRemainUnknown ?? [])]);
  const unexpected = Object.fromEntries(Object.entries(extraction?.fields ?? {}).filter(([field]) => !declared.has(field) && !excluded.has(field)));
  // A language absent from expected notes is deliberately surfaced, never silently treated as accurate.
  const unscoredNotes = excluded.has("tasting_notes") ? {} : Object.fromEntries(Object.entries(extraction?.tasting_notes ?? {}).filter(([language, values]) => !Object.hasOwn(fixture.expected?.tasting_notes ?? {}, language) && !absent(values)));
  const forbidden = forbiddenValueEntries(fixture.forbiddenValues).flatMap(([field, values]) => values.filter(value => {
    const actual = get(extraction, field);
    return matches(actual, value) || (Array.isArray(actual) && !Array.isArray(value) && actual.some(item => matches(item, value)));
  }).map(value => ({ field, actual: get(extraction, field), forbidden: value })));
  const expectedType = fixture.expected?.bean_type ?? (fixture.kind === "negative" ? "unknown" : null);
  return { records, blankChecks, unexpected, unscoredNotes, forbidden, beanType: expectedType ? { expected: expectedType, actual: extraction?.bean_type ?? null, status: extraction?.bean_type === expectedType ? "correct" : "wrong" } : null };
}
const counts = records => ({ total: records.length, ...Object.fromEntries(["correct", "missing", "wrong"].map(status => [status, records.filter(record => record.status === status).length])) });
export function median(values) { const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2); return !sorted.length ? null : sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; }
export function percentile95(values) { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? sorted[Math.ceil(sorted.length * 0.95) - 1] : null; }
function repeatTiming(rows) {
  const repeated = rows.filter(row => row.repeat > 0), times = repeated.filter(row => Number.isFinite(row.elapsedMs)).map(row => row.elapsedMs);
  const coldTotals = rows.filter(row => row.repeat === 0 && !row.error && Number.isFinite(row.coldTotalMs)).map(row => row.coldTotalMs);
  return { repeatedExpectedReads: repeated.length, repeatedTimedReads: times.length,
    repeatedFailedReads: repeated.filter(row => row.error || row.pageErrors?.length || row.blockedRequests?.length).length,
    repeatedMedianMs: median(times), repeatedP95Ms: percentile95(times), repeatedMaxMs: times.length ? Math.max(...times) : null,
    coldTotalMaxMs: coldTotals.length ? Math.max(...coldTotals) : null };
}
export function summarize(rows) {
  const groups = [];
  for (const browser of new Set(rows.map(row => row.browser))) for (const split of [...new Set(rows.map(row => row.split)), "all"]) {
    const selected = rows.filter(row => row.browser === browser && (split === "all" || row.split === split));
    const first = selected.filter(row => row.repeat === 0), warm = selected.filter(row => row.repeat === 1);
    if (!first.length) continue;
    const records = first.flatMap(row => row.score.records), blanks = first.flatMap(row => row.score.blankChecks);
    const warmTimes = warm.filter(row => !row.error && row.workerReused && Number.isFinite(row.elapsedMs)).map(row => row.elapsedMs);
    const allWarmTimes = selected.filter(row => row.repeat > 0 && !row.error && row.workerReused && Number.isFinite(row.elapsedMs)).map(row => row.elapsedMs);
    groups.push({ browser, split, photos: first.length, coffeePhotos: first.filter(row => row.kind !== "negative").length, negativePhotos: first.filter(row => row.kind === "negative").length, fields: counts(records), core: counts(records.filter(record => record.core)),
      perField: Object.fromEntries([...new Set(records.map(record => record.field))].map(field => [field, counts(records.filter(record => record.field === field))])),
      unsupported: blanks.filter(record => record.status === "unsupported").length, blankChecks: blanks.filter(record => record.status !== "unmeasured").length, unmeasuredBlankChecks: blanks.filter(record => record.status === "unmeasured").length,
      forbidden: first.reduce((sum, row) => sum + row.score.forbidden.length, 0),
      unscoredNoteOutputs: first.filter(row => Object.keys(row.score.unscoredNotes).length).length,
      negativeFailures: first.filter(row => row.kind === "negative" && (row.score.blankChecks.some(record => record.status !== "correct") || row.score.beanType?.status !== "correct")).length,
      runtimeFailures: new Set(selected.filter(row => row.error || row.pageErrors?.length || row.blockedRequests?.length).map(row => row.id)).size,
      runtimeFailureReads: selected.filter(row => row.error || row.pageErrors?.length || row.blockedRequests?.length).length,
      coldMedianMs: median(first.filter(row => !row.error && Number.isFinite(row.elapsedMs)).map(row => row.elapsedMs)), warmMedianMs: median(warm.filter(row => !row.error && row.workerReused && Number.isFinite(row.elapsedMs)).map(row => row.elapsedMs)),
      warmP95Ms: percentile95(warmTimes), warmMaxMs: allWarmTimes.length ? Math.max(...allWarmTimes) : null, warmSampleCount: warmTimes.length,
      ...repeatTiming(selected),
      timingByKind: Object.fromEntries([...new Set(selected.map(row => row.kind === "negative" ? "negative" : "coffee"))]
        .map(kind => [kind, repeatTiming(selected.filter(row => (row.kind === "negative" ? "negative" : "coffee") === kind))])),
      restartedRepeatReads: selected.filter(row => row.repeat > 0 && !row.error && !row.workerReused).length,
      stableExtractions: first.filter(row => { const reads = selected.filter(other => other.id === row.id); return reads.length >= 2 && reads.every(other => !other.error && JSON.stringify(other.extraction) === JSON.stringify(row.extraction)); }).length });
  }
  return groups;
}
