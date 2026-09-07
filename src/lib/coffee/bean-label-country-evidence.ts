import { parseBeanLabelText } from "./bean-label-parser.ts";
import type { LabelTextRegion } from "./bean-label-image-regions.ts";

type Box = { x0: number; y0: number; x1: number; y1: number };
type Word = { text: string; confidence: number; bbox: Box };
type EvidenceRow = { text: string; confidence: number; bbox: Box; words: Word[] };
const controls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u;
const countryHeadingOnly = /^(?:원\s*산\s*지|생\s*산\s*국|국\s*가|산\s*지|country\s*of\s*origin|origin\s*country|country|origin)(?:\s*[:：=])?$/iu;
const explicitCountry = /^(?:원\s*산\s*지|생\s*산\s*국|국\s*가|산\s*지|country\s*of\s*origin|origin\s*country|country|origin)(?:(?:\s*[:：=]\s*){1,3}|\s+)(.+)$/iu;
const compact = (text: string) => text.replace(/\s+/gu, "");
const empty = () => ({ text: "", blocks: [] as unknown[] });

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function box(value: unknown): value is Box {
  if (!record(value)) return false;
  const { x0, y0, x1, y1 } = value;
  return typeof x0 === "number" && typeof y0 === "number" && typeof x1 === "number" && typeof y1 === "number"
    && [x0, y0, x1, y1].every(Number.isFinite) && x0 >= 0 && y0 >= 0 && x1 > x0 && y1 > y0 && x1 <= 100_000 && y1 <= 100_000;
}

function word(value: unknown): value is Word {
  return record(value) && typeof value.text === "string" && value.text.trim().length > 0 && value.text.length <= 80
    && !/[\r\n]/u.test(value.text) && !controls.test(value.text) && box(value.bbox)
    && typeof value.confidence === "number" && Number.isFinite(value.confidence) && value.confidence >= 0 && value.confidence <= 100;
}

function extractRow(value: unknown): EvidenceRow | undefined {
  if (!record(value) || typeof value.text !== "string" || value.text.length > 500 || controls.test(value.text)
    || !box(value.bbox) || !Array.isArray(value.words) || value.words.length < 2 || value.words.length > 24
    || !value.words.every(word)) return undefined;
  const original = value.words;
  // Missing words cannot be silently erased by trusting a partial word array.
  if (compact(value.text) !== compact(original.map(entry => entry.text).join(" "))) return undefined;
  for (let index = 0; index < original.length; index += 1) {
    const current = original[index].bbox;
    if (current.x0 < value.bbox.x0 || current.x1 > value.bbox.x1 || current.y0 < value.bbox.y0 || current.y1 > value.bbox.y1) return undefined;
    if (index && current.x0 < original[index - 1].bbox.x1) return undefined;
  }
  let start = 0;
  while (start < original.length && start < 3 && original[start].confidence < 25 && /^[\p{P}]+$/u.test(original[start].text.trim())) start += 1;
  const words = original.slice(start);
  const text = words.map(entry => entry.text.trim()).join(" ");
  if (words.length < 2 || !explicitCountry.test(text)) return undefined;
  let headingEnd = 0;
  for (let end = 1; end <= Math.min(6, words.length); end += 1) {
    if (!/^[:：=]+$/u.test(words[end - 1].text.trim()) && countryHeadingOnly.test(words.slice(0, end).map(entry => entry.text.trim()).join(" "))) headingEnd = end;
  }
  let separatorEnd = headingEnd;
  while (headingEnd && separatorEnd < words.length && /^[:：=]$/u.test(words[separatorEnd].text.trim())) separatorEnd += 1;
  if (separatorEnd - headingEnd > 2) return undefined;
  // Preserve separator words and boxes in the result. Tiny table-rule glyphs
  // immediately after the heading do not establish the text's readability.
  const lexicalWords = words.filter((_, index) => index < headingEnd || index >= separatorEnd);
  if (lexicalWords.length < 2 || lexicalWords.some(entry => entry.confidence < 85)) return undefined;
  const first = words[0].bbox;
  const height = first.y1 - first.y0;
  if (start) {
    const noise = original[start - 1].bbox;
    if (first.x0 - noise.x1 < Math.max(height * 3, (noise.y1 - noise.y0) * 2)) return undefined;
  }
  for (let index = 0; index < lexicalWords.length; index += 1) {
    const current = lexicalWords[index].bbox;
    const currentHeight = current.y1 - current.y0;
    const vertical = Math.min(current.y1, first.y1) - Math.max(current.y0, first.y0);
    if (vertical < Math.min(height, currentHeight) * 0.4 || Math.max(height, currentHeight) > Math.min(height, currentHeight) * 2.5) return undefined;
    if (index && current.x0 - lexicalWords[index - 1].bbox.x1 > height * 6) return undefined;
  }
  return {
    text, confidence: Math.min(...lexicalWords.map(entry => entry.confidence)),
    bbox: { x0: first.x0, y0: Math.min(...words.map(entry => entry.bbox.y0)),
      x1: words.at(-1)!.bbox.x1, y1: Math.max(...words.map(entry => entry.bbox.y1)) },
    words: words.map(entry => ({ text: entry.text.trim(), confidence: entry.confidence, bbox: { ...entry.bbox } })),
  };
}

/** Retain only complete, explicit country rows from another reading of the same image. */
export function extractLabelCountryEvidence(blocks: unknown): { text: string; blocks: unknown[] } {
  if (!Array.isArray(blocks) || blocks.length > 100) return empty();
  const rows: EvidenceRow[] = [];
  const countries = new Set<string>();
  let count = 0;
  for (const block of blocks) {
    if (!record(block) || !Array.isArray(block.paragraphs)) continue;
    if (block.paragraphs.length > 100) return empty();
    for (const paragraph of block.paragraphs) {
      if (!record(paragraph) || !Array.isArray(paragraph.lines)) continue;
      if (paragraph.lines.length > 100) return empty();
      for (const line of paragraph.lines) {
        if (++count > 300) return empty();
        const row = extractRow(line);
        if (!row) continue;
        const parsed = parseBeanLabelText(row.text);
        const value = parseBeanLabelText(explicitCountry.exec(row.text)![1]);
        // The parser rejects misspellings, extra prose, mixed origins and units.
        if (!parsed.fields.origin_country || Object.keys(parsed.fields).length !== 1
          || parsed.evidence.origin_country !== row.text || parsed.bean_type === "blend"
          || value.fields.origin_country !== parsed.fields.origin_country || Object.keys(value.fields).length !== 1) return empty();
        countries.add(parsed.fields.origin_country);
        if (countries.size > 1 || rows.length >= 20) return empty();
        if (!rows.some(previous => previous.text === row.text)) rows.push(row);
      }
    }
  }
  return {
    text: rows.map(row => row.text).join("\n"),
    blocks: rows.map(row => ({ text: row.text, confidence: row.confidence, bbox: { ...row.bbox },
      paragraphs: [{ text: row.text, confidence: row.confidence, bbox: { ...row.bbox }, lines: [row] }] })),
  };
}

type CountryLine = { text: string; confidence: number; bbox: Box; words: unknown[] };

/** Locate a readable country value beside its label; the crop still has to read that label. */
export function findLabelCountryRegions(blocks: unknown): LabelTextRegion[] {
  if (!Array.isArray(blocks) || blocks.length > 100) return [];
  const lines: CountryLine[] = [];
  let inspected = 0;
  for (const block of blocks) {
    if (!record(block) || !Array.isArray(block.paragraphs)) continue;
    if (block.paragraphs.length > 100) return [];
    for (const paragraph of block.paragraphs) {
      if (!record(paragraph) || !Array.isArray(paragraph.lines)) continue;
      if (paragraph.lines.length > 100) return [];
      for (const line of paragraph.lines) {
        if (++inspected > 300) return [];
        if (!record(line) || typeof line.text !== "string" || !line.text.trim() || line.text.length > 200 || controls.test(line.text)
          || !box(line.bbox) || !Array.isArray(line.words) || line.words.length > 24
          || typeof line.confidence !== "number" || !Number.isFinite(line.confidence) || line.confidence < 0 || line.confidence > 100) continue;
        lines.push({ text: line.text.trim(), confidence: line.confidence, bbox: line.bbox, words: line.words });
      }
    }
  }
  const regions: LabelTextRegion[] = [];
  for (const value of lines) {
    if (value.confidence < 85 || !value.words.length || !value.words.every(word)
      || value.words.some(entry => entry.confidence < 80) || explicitCountry.test(value.text)
      || compact(value.text) !== compact(value.words.map(entry => entry.text).join(" "))) continue;
    const parsed = parseBeanLabelText(value.text);
    const labelled = parseBeanLabelText(`Country: ${value.text}`);
    if (!parsed.fields.origin_country || Object.keys(parsed.fields).length !== 1 || parsed.bean_type === "blend"
      || labelled.fields.origin_country !== parsed.fields.origin_country || Object.keys(labelled.fields).length !== 1) continue;
    const height = value.bbox.y1 - value.bbox.y0;
    if (height < 3 || height > 200 || value.bbox.x1 - value.bbox.x0 > 1200
      || value.words.some((entry, index) => entry.bbox.x0 < value.bbox.x0 || entry.bbox.x1 > value.bbox.x1
        || entry.bbox.y0 < value.bbox.y0 || entry.bbox.y1 > value.bbox.y1
        || (index > 0 && entry.bbox.x0 < (value.words[index - 1] as Word).bbox.x1))) continue;
    const labels = lines.filter(label => {
      if (label === value || label.text.length > 60 || label.bbox.x1 > value.bbox.x0 || value.bbox.x0 - label.bbox.x1 > height * 8) return false;
      const labelHeight = label.bbox.y1 - label.bbox.y0;
      const labelWidth = label.bbox.x1 - label.bbox.x0;
      const vertical = Math.min(label.bbox.y1, value.bbox.y1) - Math.max(label.bbox.y0, value.bbox.y0);
      return labelHeight >= height * 0.5 && labelHeight <= height * 1.75 && labelWidth <= Math.min(500, height * 8)
        && vertical >= Math.min(height, labelHeight) * 0.6;
    }).sort((left, right) => right.bbox.x1 - left.bbox.x1);
    if (!labels.length || (labels[1] && Math.abs(labels[0].bbox.x1 - labels[1].bbox.x1) < 1)) continue;
    const label = labels[0];
    const region = { x: label.bbox.x0, y: Math.min(label.bbox.y0, value.bbox.y0),
      width: value.bbox.x1 - label.bbox.x0, height: Math.max(label.bbox.y1, value.bbox.y1) - Math.min(label.bbox.y0, value.bbox.y0) };
    if (!validCountryRegion(region)) continue;
    if (!regions.some(previous => previous.x === region.x && previous.y === region.y && previous.width === region.width && previous.height === region.height)) regions.push(region);
    if (regions.length > 2) return [];
  }
  return regions;
}

function validCountryRegion(region: LabelTextRegion): boolean {
  return record(region) && [region.x, region.y, region.width, region.height].every(Number.isFinite)
    && region.x >= 0 && region.y >= 0 && region.width >= 3 && region.height >= 3
    && region.width <= 1600 && region.height <= 250 && region.x + region.width <= 100_000 && region.y + region.height <= 100_000;
}

/** Restore coordinates from prepareLabelWordRetry's padded crop at an exact integer scale. */
export function reprojectLabelCountryEvidence(evidence: { text: string; blocks: unknown[] }, region: LabelTextRegion, scale: 1 | 2): { text: string; blocks: unknown[] } {
  if (!record(evidence) || typeof evidence.text !== "string" || !validCountryRegion(region) || (scale !== 1 && scale !== 2)) return empty();
  const source = extractLabelCountryEvidence(evidence.blocks);
  if (!source.text || source.text !== evidence.text) return empty();
  const padding = region.height * 0.3;
  const left = Math.max(0, Math.floor(region.x - padding));
  const top = Math.max(0, Math.floor(region.y - padding));
  const maxWidth = Math.ceil(region.width + padding * 2) * scale;
  const maxHeight = Math.ceil(region.height + padding * 2) * scale;
  let invalid = false;
  const transform = (entry: unknown): unknown => {
    if (!record(entry) || !box(entry.bbox) || entry.bbox.x1 > maxWidth || entry.bbox.y1 > maxHeight) { invalid = true; return entry; }
    return { ...entry, bbox: { x0: entry.bbox.x0 / scale + left, x1: entry.bbox.x1 / scale + left,
      y0: entry.bbox.y0 / scale + top, y1: entry.bbox.y1 / scale + top },
    ...(Array.isArray(entry.paragraphs) ? { paragraphs: entry.paragraphs.map(transform) } : {}),
    ...(Array.isArray(entry.lines) ? { lines: entry.lines.map(transform) } : {}),
    ...(Array.isArray(entry.words) ? { words: entry.words.map(transform) } : {}) };
  };
  const projected = source.blocks.map(transform);
  return invalid ? empty() : { text: source.text, blocks: projected };
}
