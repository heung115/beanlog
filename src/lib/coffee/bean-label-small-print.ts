import { parseBeanLabelText } from "./bean-label-parser.ts";
import type { LabelExtraction } from "./bean-label.ts";

type Box = { x0: number; y0: number; x1: number; y1: number };
type Row = Box & { index: number; text: string; score: number; h: number; w: number; cue: boolean };
export interface LabelSmallPrintRegion {
  source: { width: number; height: number };
  crop: { x: number; y: number; width: number; height: number };
  output: { width: number; height: number };
  itemIndices: number[];
}

const controls = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u;
const cue = /origin|원산지|variet|품종|process|가공|washed|natural|honey|워시드|내추럴|네추럴|콜.{0,2}비아|에티오피아|르완다|브라질|과테말라|케냐|코스타리카|에콰도르|페루|엘살바도르|파나마|ethiopia|colombia|rwanda|brazil|kenya|guatemala|\d\s*%|\d[\d.,\s]*\s*(?:kg|g|9)\b/iu;
const actualUnit = /(?<![\p{L}\p{N}])\d+(?:[.,]\d+)?\s*(?:kg|g|oz)\b/iu;
const key = (text: string) => text.normalize("NFKC").toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]/gu, "");
const percentile = (values: number[], fraction: number) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * fraction)];
const union = (rows: Box[]): Box => ({ x0: Math.min(...rows.map(r => r.x0)), y0: Math.min(...rows.map(r => r.y0)), x1: Math.max(...rows.map(r => r.x1)), y1: Math.max(...rows.map(r => r.y1)) });
const overlapX = (a: Box, b: Box) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
const gapY = (a: Box, b: Box) => Math.max(0, Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1));
const gapX = (a: Box, b: Box) => Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1));

function readRows(result: unknown) {
  if (!result || typeof result !== "object" || !("image" in result) || !("items" in result)) return;
  const frame = result.image;
  if (!frame || typeof frame !== "object" || !("width" in frame) || !("height" in frame)
    || !Number.isSafeInteger(frame.width) || !Number.isSafeInteger(frame.height)) return;
  const width = frame.width as number, height = frame.height as number;
  if (width <= 0 || height <= 0 || Math.max(width, height) > 2600 || width * height > 4_500_000
    || !Array.isArray(result.items) || result.items.length > 300) return;
  const rows: Row[] = [];
  for (const [index, value] of result.items.entries()) {
    if (!value || typeof value !== "object") continue;
    const { text, score, poly } = value;
    if (typeof text !== "string" || !text.trim() || text.length > 500 || controls.test(text)
      || typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1
      || !Array.isArray(poly) || poly.length !== 4 || !poly.every(p => Array.isArray(p) && p.length === 2
        && p.every(Number.isFinite) && p[0] >= 0 && p[1] >= 0 && p[0] <= width && p[1] <= height)) continue;
    const [a, b, c, d] = poly as [number, number][];
    const area = Math.abs(a[0] * b[1] + b[0] * c[1] + c[0] * d[1] + d[0] * a[1]
      - b[0] * a[1] - c[0] * b[1] - d[0] * c[1] - a[0] * d[1]) / 2;
    if (!area) continue;
    const edge = (first: number[], last: number[]) => Math.hypot(first[0] - last[0], first[1] - last[1]);
    rows.push({ index, text: text.trim(), score, cue: cue.test(text),
      x0: Math.min(...poly.map(p => p[0])), y0: Math.min(...poly.map(p => p[1])), x1: Math.max(...poly.map(p => p[0])), y1: Math.max(...poly.map(p => p[1])),
      h: (edge(a, d) + edge(b, c)) / 2, w: (edge(a, b) + edge(d, c)) / 2 });
  }
  return { source: { width, height }, rows };
}

/** Choose one small-print component from the original full-image polygons.
 * Ambiguous packages and a component detached from the established name do
 * not qualify for a weight supplement. There are no photo/brand rectangles. */
export function selectLabelSmallPrintRegion(result: unknown, primary: LabelExtraction): LabelSmallPrintRegion | undefined {
  if (primary.fields.weight_g !== undefined) return;
  // A country/address and a small numeric label also occur on non-coffee
  // products. Supplemental OCR cannot establish coffee identity by weight.
  if (!primary.fields.name && !primary.fields.varietal && !primary.fields.process_method
    && !primary.fields.blend_components?.length) return;
  const data = readRows(result);
  if (!data) return;
  const boxes = data.rows.filter(box => box.h > 2 && box.w / box.h >= 1.2 && box.score >= .3);
  if (!boxes.length) return;
  const limit = Math.min(32, percentile(boxes.map(b => b.h), .65) * 1.4);
  const small = boxes.filter(box => box.h <= limit);
  const connected = (a: Row, b: Row) => {
    const height = Math.max(a.h, b.h);
    return overlapX(a, b) >= Math.min(a.w, b.w) * .2 && gapY(a, b) <= height * 3
      || Math.abs((a.y0 + a.y1 - b.y0 - b.y1) / 2) <= height * .8 && gapX(a, b) <= height * 5;
  };
  const components: Row[][] = [];
  const unseen = new Set(small);
  while (unseen.size) {
    const queue = [unseen.values().next().value!]; unseen.delete(queue[0]);
    for (let index = 0; index < queue.length; index++) for (const next of unseen) {
      if (connected(queue[index], next)) { queue.push(next); unseen.delete(next); }
    }
    components.push(queue);
  }
  const candidates = components.filter(rows => rows.length >= 3 && rows.some(row => row.cue));
  if (candidates.length !== 1) return;
  const chosen = candidates[0];
  const medianHeight = percentile(chosen.map(b => b.h), .5);
  const body = union(chosen);
  const context = boxes.filter(box => !chosen.includes(box) && box.h <= medianHeight * 3
    && overlapX(box, body) >= box.w * .4 && gapY(box, body) <= medianHeight * 2);
  const included = [...chosen, ...context];
  if (primary.fields.name) {
    const name = key(primary.fields.name);
    const matching = boxes.filter(box => {
      const value = key(box.text);
      return Math.min(name.length, value.length) >= 4 && (value.includes(name) || name.includes(value));
    });
    const longest = Math.max(0, ...matching.map(box => key(box.text).length));
    const anchors = matching.filter(box => key(box.text).length === longest);
    if (!anchors.length || anchors.some(anchor => !included.includes(anchor))) return;
  }
  const bounds = union(included), padding = Math.max(10, medianHeight * 1.5);
  const x = Math.max(0, Math.floor(bounds.x0 - padding)), y = Math.max(0, Math.floor(bounds.y0 - padding));
  const width = Math.min(data.source.width, Math.ceil(bounds.x1 + padding)) - x;
  const height = Math.min(data.source.height, Math.ceil(bounds.y1 + padding)) - y;
  const scale = Math.min(4, 48 / medianHeight, 2600 / Math.max(width, height), Math.sqrt(3_000_000 / (width * height)));
  return { source: data.source, crop: { x, y, width, height },
    output: { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) },
    itemIndices: included.map(row => row.index) };
}

function printedWeight(row: Row) {
  // Reuse the established parser's metric/paired-ounce consistency rules, but
  // require an actual unit here: damaged 9/q/0z glyphs cannot supply a unit.
  if (!actualUnit.test(row.text)) return;
  return parseBeanLabelText(row.text).fields.weight_g;
}

/** Read only a confident printed weight, anchored to a numeric source box.
 * No other field or inferred unit can leave this supplemental reading. */
export function extractLabelSmallPrintWeight(result: unknown, region: LabelSmallPrintRegion, fullResult: unknown) {
  const data = readRows(result), original = readRows(fullResult);
  if (!data || !original || data.source.width !== region.output.width || data.source.height !== region.output.height
    || original.source.width !== region.source.width || original.source.height !== region.source.height) return;
  const candidates = data.rows.flatMap(row => {
    if (row.score < .9) return [];
    const weight = printedWeight(row);
    if (weight === undefined) return [];
    const mapped: Box = { x0: region.crop.x + row.x0 * region.crop.width / region.output.width,
      y0: region.crop.y + row.y0 * region.crop.height / region.output.height,
      x1: region.crop.x + row.x1 * region.crop.width / region.output.width,
      y1: region.crop.y + row.y1 * region.crop.height / region.output.height };
    const area = (mapped.x1 - mapped.x0) * (mapped.y1 - mapped.y0);
    const anchored = original.rows.some(source => region.itemIndices.includes(source.index) && /\d/u.test(source.text)
      && !/%|\d{4}\s*[-./]\s*\d|\d{8}/u.test(source.text)
      && overlapX(mapped, source) * Math.max(0, Math.min(mapped.y1, source.y1) - Math.max(mapped.y0, source.y0)) >= area * .5);
    return anchored ? [{ weight_g: weight, evidence: row.text, confidence: row.score * 100 }] : [];
  });
  const values = new Set(candidates.map(candidate => candidate.weight_g));
  if (values.size !== 1) return;
  const weight = candidates[0].weight_g;
  if (original.rows.some(row => {
    const other = printedWeight(row);
    return other !== undefined && other !== weight;
  })) return;
  return candidates.sort((a, b) => b.confidence - a.confidence)[0];
}
