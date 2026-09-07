import { isKnownLabelFlavor, isKnownLabelVariety, isLabelMetadataLine, parseBeanLabelText } from "./bean-label-parser.ts";
import { mergeLabelExtractions, normalizeLabelExtraction, type LabelExtraction } from "./bean-label.ts";

type Box = { x0: number; y0: number; x1: number; y1: number };
type Row = { text: string; bbox: Box; height: number; centerY: number; readable: boolean };
type List = { rows: Row[]; text: string; parsed: LabelExtraction };
type Variety = { value: string; evidence: string; rows: Row[] };
const empty = (): LabelExtraction => ({ bean_type: "unknown", fields: {}, evidence: {} });
const controls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u;
const key = (value: string) => value.trim().toLowerCase().replace(/\s+/gu, " ");
const compact = (value: string) => value.replace(/\s+/gu, "");
const commaEnd = /[,，]\s*$/u;
const heading = /^(?:product|coffee\s*name|bean\s*name|roaster(?:y|s)?|country|origin|region|farm|producer|process(?:ing)?|varietals?|variet(?:y|ies)|cultivar|roast(?:ed|ing)?|net|weight|altitude|harvest|batch|lot|tasting\s*notes?|cup\s*notes?|notes?|상품명|제품명|원두명|로스터리|원산지|생산국|국가|지역|농장|생산자|가공|품종|로스팅|내용량|중량|고도|컵\s*노트|향미)(?:\b|\s|[:：=]|$)/iu;
const excluded = /\b(?:brew(?:ing)?|recipe|dose|dosage|water|yield|ratio|nutrition(?:al)?|ingredients|sale|discount|price|coupon|address)\b|레\s*시\s*피|추\s*출|투\s*입|영양|원재료|할인|특가|주소/iu;
const prose = /\b(?:is|are|was|were|with|from|this|that|our|your|their|please|enjoy|visit|follow|discover|offers?|contains?)\b|입니다|습니다|하세요|즐기|느껴지/iu;
const notesHeading = /^(?:tasting\s*notes?|cup\s*notes?|flavor\s*notes?|tastes\s*like|notes?|컵\s*노트|향미|맛)\s*[:：=]?\s*$/iu;
const noteSeparator = /[,，;；|¦•·/]/u;
const noteEnd = /[,，;；|¦•·/]\s*$/u;

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
  const rows: Row[] = [];
  for (const row of value) {
    if (!record(row) || typeof row.text !== "string" || !row.text.trim() || row.text.length > 500 || controls.test(row.text)
      || !box(row.bbox) || !confidence(row.confidence) || !Array.isArray(row.words) || !row.words.length || row.words.length > 100) return [];
    const bounds = row.bbox;
    let readable = row.confidence >= 85;
    const words: string[] = [];
    for (const word of row.words) {
      if (!record(word) || typeof word.text !== "string" || !word.text.trim() || controls.test(word.text)
        || !box(word.bbox) || !confidence(word.confidence) || word.bbox.x0 < bounds.x0 || word.bbox.y0 < bounds.y0
        || word.bbox.x1 > bounds.x1 || word.bbox.y1 > bounds.y1) return [];
      words.push(word.text);
      readable &&= word.confidence >= 80;
    }
    if (compact(words.join(" ")) !== compact(row.text)) return [];
    rows.push({ text: row.text.trim(), bbox: { ...bounds }, height: bounds.y1 - bounds.y0,
      centerY: (bounds.y0 + bounds.y1) / 2, readable });
  }
  // Unreadable rows still delimit a list; they cannot be skipped to collect a
  // convenient suffix that happens to contain enough dictionary words.
  return rows.sort((left, right) => left.centerY - right.centerY || left.bbox.x0 - right.bbox.x0);
}

function sameArea(left: Row, right: Row): boolean {
  const overlap = Math.max(0, Math.min(left.bbox.x1, right.bbox.x1) - Math.max(left.bbox.x0, right.bbox.x0));
  return overlap >= Math.min(left.bbox.x1 - left.bbox.x0, right.bbox.x1 - right.bbox.x0) * .5;
}

function closeRows(left: Row, right: Row): boolean {
  const minimum = Math.min(left.height, right.height), maximum = Math.max(left.height, right.height);
  const centerDifference = Math.abs((left.bbox.x0 + left.bbox.x1 - right.bbox.x0 - right.bbox.x1) / 2);
  return sameArea(left, right) && maximum <= minimum * 1.6
    && (Math.abs(left.bbox.x0 - right.bbox.x0) <= maximum || centerDifference <= maximum)
    && right.centerY - left.centerY >= minimum * .4
    && right.bbox.y0 - left.bbox.y1 <= minimum * .75;
}

function nearbyBoundary(left: Row, right: Row): boolean {
  return sameArea(left, right) && right.centerY > left.centerY
    && right.bbox.y0 - left.bbox.y1 <= Math.max(left.height, right.height) * .75;
}

function tokens(value: string): string[] {
  return value.split(/[,，]/u).map(token => token.trim()).filter(Boolean);
}

function listRow(row: Row): boolean {
  return !heading.test(row.text) && !excluded.test(row.text) && !prose.test(row.text) && !isLabelMetadataLine(row.text)
    && !/^\s*[,，]|[,，]\s*[,，]/u.test(row.text) && tokens(row.text).length > 0
    && tokens(row.text).every(token => token.length <= 80 && token.split(/\s+/u).length <= 6
      && /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}\s'’()\-]*$/u.test(token));
}

function excludedContext(first: Row, last: Row, rows: Row[]): boolean {
  return rows.some(row => excluded.test(row.text) && sameArea(first, row)
    && row.centerY >= first.centerY - first.height * 10 && row.centerY <= last.centerY);
}

function flavorSafe(list: List): boolean {
  return tokens(list.text).every(token => {
    if (isKnownLabelFlavor(token)) return true;
    const fields = parseBeanLabelText(token).fields;
    // A processing/category/origin value next to cup notes cannot become a new
    // flavor just because earlier comma-separated entries supplied anchors.
    return !fields.origin_country && !fields.varietal && !fields.process_method && !fields.roast_level && !fields.weight_g;
  });
}

function noteEntries(text: string): string[] {
  return text.split(noteSeparator).map(entry => entry.trim()).filter(Boolean);
}

function noteRow(row: Row): boolean {
  return !/^[,，;；|¦•·/]|[,，;；|¦•·/]\s*[,，;；|¦•·/]/u.test(row.text)
    && noteEntries(row.text).length > 0 && noteEntries(row.text).every(entry => entry.length <= 80
      && entry.split(/\s+/u).length <= 6 && /^[\p{L}][\p{L}\p{M}\s'’()\-]*$/u.test(entry));
}

function noteBoundary(row: Row): boolean {
  if (heading.test(row.text) || excluded.test(row.text) || prose.test(row.text) || isLabelMetadataLine(row.text)) return true;
  return noteEntries(row.text).some(entry => {
    if (isKnownLabelFlavor(entry)) return false;
    const fields = parseBeanLabelText(entry).fields;
    return Boolean(fields.origin_country || fields.varietal || fields.process_method || fields.roast_level || fields.weight_g);
  });
}

function noteAligned(left: Row, right: Row): boolean {
  const height = Math.max(left.height, right.height);
  return sameArea(left, right) && (Math.abs(left.bbox.x0 - right.bbox.x0) <= height
    || Math.abs(left.bbox.x1 - right.bbox.x1) <= height
    || Math.abs((left.bbox.x0 + left.bbox.x1 - right.bbox.x0 - right.bbox.x1) / 2) <= height);
}

function nearbyNotes(left: Row, right: Row, header = false): boolean {
  const minimum = Math.min(left.height, right.height), maximum = Math.max(left.height, right.height);
  return noteAligned(left, right) && maximum <= minimum * (header ? 2.5 : 1.6)
    && right.centerY - left.centerY >= minimum * .4
    && right.bbox.y0 - left.bbox.y1 <= (header ? maximum * 1.5 : minimum * .75);
}

/** Geometry supplies the printed line separators. Explicit headings can own
 * unfamiliar phrases; an unheaded continuation needs two known flavors on its
 * first row, as the lexical parser already requires. No punctuation is added
 * to the retained source quote, and damaged rows invalidate the entire chain.
 */
function verticalNotes(rows: Row[]): { lists: List[]; owned: Set<Row> } {
  const lists: List[] = [], owned = new Set<Row>();
  const nextRow = (current: Row) => rows.find(row => row.centerY > current.centerY && sameArea(current, row));
  for (const start of rows) {
    if (owned.has(start)) continue;
    const explicit = notesHeading.test(start.text);
    const first = explicit ? nextRow(start) : start;
    if (!first || explicit && !nearbyNotes(start, first, true)) continue;
    const anchoredLanguages = [false, true].filter(korean => noteEntries(first.text)
      .filter(entry => /[가-힣]/u.test(entry) === korean && isKnownLabelFlavor(entry)).length >= 2);
    if (!explicit) {
      if (!noteRow(first) || noteBoundary(first)) continue;
      if (!anchoredLanguages.length) continue;
      const before = rows.filter(row => row.centerY < first.centerY && sameArea(row, first)).at(-1);
      if (before && nearbyBoundary(before, first)) continue;
    }
    const chain: Row[] = [];
    let current: Row | undefined = first, valid = start.readable;
    while (current) {
      if (noteBoundary(current) && current.readable) break;
      owned.add(current);
      chain.push(current);
      valid &&= current.readable && noteRow(current);
      if (!explicit) valid &&= noteEntries(current.text).every(entry => anchoredLanguages.includes(/[가-힣]/u.test(entry)));
      const next = nextRow(current);
      if (next && nearbyBoundary(current, next) && (!next.readable || !noteRow(next) && !noteBoundary(next))) valid = false;
      if (!next || !nearbyNotes(current, next)) break;
      // A wide intermediate row must not change the original list's column.
      if (!noteAligned(first, next) || chain.length >= 10) { valid = false; break; }
      current = next;
    }
    if (explicit) owned.add(start);
    if (!valid || chain.length < 2 || noteEnd.test(chain.at(-1)!.text) || excludedContext(first, chain.at(-1)!, rows)) continue;
    const entries = chain.flatMap(row => noteEntries(row.text));
    const text = [...(explicit ? [start] : []), ...chain].map(row => row.text).join("\n");
    if (text.length > 500 || entries.length > 20) continue;
    const parsed = normalizeLabelExtraction({ bean_type: "unknown", fields: {},
      tasting_notes: { en: entries.filter(entry => !/[가-힣]/u.test(entry)), ko: entries.filter(entry => /[가-힣]/u.test(entry)) },
      tasting_notes_evidence: [text] });
    if (parsed.tasting_notes) lists.push({ rows: chain, text, parsed });
  }
  return { lists, owned };
}

/** Join only printed comma continuations in one nearby column. Lexical meaning
 * remains the shared parser's responsibility; evidence is the original text.
 * A separate two-row path accepts only a complete known varietal phrase.
 */
function collectListLayout(value: unknown): { extraction: LabelExtraction; variety?: Variety } {
  const rows = readRows(value);
  const vertical = verticalNotes(rows);
  const lists: List[] = [...vertical.lists];
  const varieties: Variety[] = [];
  const incomplete: Row[] = [];
  for (const first of rows) {
    if (vertical.owned.has(first)) continue;
    if (!listRow(first)) continue;
    const before = rows.filter(row => row.centerY < first.centerY && sameArea(row, first)).at(-1);
    if (before && commaEnd.test(before.text) && nearbyBoundary(before, first)) continue;
    const nextRow = (current: Row) => rows.find(row => row.centerY > current.centerY && sameArea(current, row));
    if (commaEnd.test(first.text)) {
      const chain = [first];
      let complete = true;
      while (commaEnd.test(chain.at(-1)!.text)) {
        const previous = chain.at(-1)!, next = nextRow(previous);
        if (!next || chain.length >= 10 || !closeRows(previous, next) || !sameArea(first, next) || !listRow(next)
          || /[가-힣]/u.test(next.text) !== /[가-힣]/u.test(first.text)) { complete = false; break; }
        chain.push(next);
      }
      if (!complete || chain.length < 2 || chain.some(row => !row.readable) || excludedContext(first, chain.at(-1)!, rows)) {
        incomplete.push(first);
        continue;
      }
      const text = chain.map(row => row.text).join(" ");
      if (text.length > 500 || tokens(text).length > 20) continue;
      const parsed = parseBeanLabelText(text);
      if (parsed.fields.varietal && tokens(text).every(isKnownLabelVariety)) varieties.push({ value: parsed.fields.varietal, evidence: text, rows: chain });
      const list = { rows: chain, text, parsed };
      if (parsed.tasting_notes && flavorSafe(list)) lists.push(list);
    } else {
      const second = nextRow(first);
      if (!first.readable || !second?.readable || !closeRows(first, second) || !listRow(second)
        || /[,，]/u.test(first.text + second.text) || excludedContext(first, second, rows)) continue;
      const text = `${first.text} ${second.text}`;
      if (!isKnownLabelVariety(text)) continue;
      const parsed = parseBeanLabelText(text);
      varieties.push({ value: parsed.fields.varietal ?? text, evidence: text, rows: [first, second] });
    }
  }
  const variety = varieties.length === 1 ? varieties[0] : undefined;
  const source = (language: "en" | "ko") => {
    const candidates = lists.filter(list => list.parsed.tasting_notes?.[language].length
      && !incomplete.some(row => sameArea(row, list.rows[0])));
    const unique = new Set(candidates.map(list => JSON.stringify(list.parsed.tasting_notes![language].map(key))));
    return unique.size === 1 ? candidates[0] : undefined;
  };
  const en = source("en"), ko = source("ko");
  if (!variety && !en && !ko) return { extraction: empty() };
  return { variety, extraction: normalizeLabelExtraction({ bean_type: "unknown", fields: variety ? { varietal: variety } : {},
    tasting_notes: { en: en?.parsed.tasting_notes?.en ?? [], ko: ko?.parsed.tasting_notes?.ko ?? [] },
    tasting_notes_evidence: [...new Set([en?.text, ko?.text].filter((text): text is string => Boolean(text)))],
  }) };
}

export function extractLabelListLayout(rows: unknown): LabelExtraction {
  return collectListLayout(rows).extraction;
}

/** Replace a lexical suffix only when its exact source quote is inside the
 * same geometric list, and the value is a literal component/phrase subset.
 * Independent or conflicting origin evidence still follows the normal merge.
 */
export function mergeLabelListLayout(rows: unknown, base: LabelExtraction): LabelExtraction {
  const { extraction, variety } = collectListLayout(rows);
  if (base.bean_type === "blend") {
    delete extraction.fields.varietal;
    delete extraction.evidence.varietal;
    return mergeLabelExtractions([base, extraction]);
  }
  const value = base.fields.varietal, evidence = base.evidence.varietal;
  let completeSource = false;
  if (variety && value && evidence && key(value) !== key(variety.value)) {
    const completeTokens = tokens(variety.value).map(key), partialTokens = tokens(value).map(key);
    const remaining = [...completeTokens];
    const literalListSubset = partialTokens.length > 0 && partialTokens.length < completeTokens.length
      && partialTokens.every(token => { const index = remaining.indexOf(token); if (index < 0) return false; remaining.splice(index, 1); return true; });
    const literalPhraseSubset = completeTokens.length === 1 && isKnownLabelVariety(variety.value)
      && variety.rows.some(row => key(row.text) === key(value) && key(row.text) === key(evidence));
    const sourceRows = readRows(rows), matches: Row[][] = [];
    for (const start of sourceRows) {
      const chain = [start];
      while (chain.length <= 10) {
        const quote = key(chain.map(row => row.text).join(" "));
        if (quote === key(evidence)) matches.push([...chain]);
        if (quote.length >= key(evidence).length) break;
        const previous = chain.at(-1)!;
        const next = sourceRows.find(row => row.centerY > previous.centerY && sameArea(previous, row));
        if (!next || !closeRows(previous, next)) break;
        chain.push(next);
      }
    }
    const sameSource = (left: Row, right: Row) => left.text === right.text
      && left.bbox.x0 === right.bbox.x0 && left.bbox.y0 === right.bbox.y0 && left.bbox.x1 === right.bbox.x1 && left.bbox.y1 === right.bbox.y1;
    const quoteInList = matches.length === 1 && matches[0].every(row => variety.rows.some(source => sameSource(row, source)));
    const quotedTokens = tokens(evidence).map(key);
    const valuesInQuote = partialTokens.every(token => quotedTokens.includes(token));
    completeSource = quoteInList && (literalListSubset && valuesInQuote || literalPhraseSubset);
  }
  if (!completeSource) return mergeLabelExtractions([base, extraction]);
  const fields = { ...base.fields }, source = { ...base.evidence };
  delete fields.varietal;
  delete source.varietal;
  return mergeLabelExtractions([{ ...base, fields, evidence: source }, extraction]);
}
