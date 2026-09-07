import { extractLabelLayout } from "./bean-label-layout.ts";
import { isLabelProcessProse, parseBeanLabelText } from "./bean-label-parser.ts";
import { mergeLabelExtractions } from "./bean-label.ts";
import { extractLabelBlendLayout } from "./bean-label-blend-layout.ts";
import { mergeLabelListLayout } from "./bean-label-list-layout.ts";
import { labelTableRows } from "./bean-label-table-layout.ts";

type Point = [number, number];
type Box = { x0: number; y0: number; x1: number; y1: number };
type Item = { text: string; score: number; poly: Point[] };
type Line = { text: string; confidence: number; box: Box; height: number; centerY: number;
  orientation?: "vertical"; fontSize?: number };

const heading = /^(?:country(?:\s+of\s+origin)?|origin(?:\s+country)?|region|farm|producer|varietals?|variet(?:y|ies)|cultivar|process(?:ing)?|roast(?:ed|ing)?|net(?:\s*(?:wt|weight))?|weight|altitude|원\s*산\s*지|생\s*산\s*국|국\s*가|(?:생산|산지|재배)?\s*지역|농장|생산자|품종|가공(?:\s*방식|\s*방법|법)?|로스팅|내용량|중량|(?:재배)?\s*고도|컵\s*노트|tasting\s*notes?|cup\s*notes?)(?:\b|\s|[:：]|$)/iu;
const controls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u;
const median = (numbers: number[]) => [...numbers].sort((a, b) => a - b)[Math.floor(numbers.length / 2)] ?? 0;
const bounds = (points: Point[]): Box => ({ x0: Math.min(...points.map(p => p[0])), y0: Math.min(...points.map(p => p[1])),
  x1: Math.max(...points.map(p => p[0])), y1: Math.max(...points.map(p => p[1])) });
const combine = (rows: Line[]): Box => ({ x0: Math.min(...rows.map(p => p.box.x0)), y0: Math.min(...rows.map(p => p.box.y0)),
  x1: Math.max(...rows.map(p => p.box.x1)), y1: Math.max(...rows.map(p => p.box.y1)) });

function isItem(value: unknown): value is Item {
  if (!value || typeof value !== "object") return false;
  const item = value as Item;
  if (typeof item.text !== "string" || !item.text.trim() || item.text.length > 500 || controls.test(item.text)
    || !Number.isFinite(item.score) || item.score < 0 || item.score > 1 || !Array.isArray(item.poly) || item.poly.length !== 4
    || !item.poly.every(p => Array.isArray(p) && p.length === 2 && p.every(n => Number.isFinite(n) && n >= 0 && n <= 100_000))) return false;
  const [a, b, c, d] = item.poly;
  const area = Math.abs(a[0] * b[1] + b[0] * c[1] + c[0] * d[1] + d[0] * a[1]
    - b[0] * a[1] - c[0] * b[1] - d[0] * c[1] - a[0] * d[1]) / 2;
  return area > 0;
}

/** Convert detector polygons to source-preserving rows shared by both parsers.
 * A recognizer line score stays a line score, scaled to the layout interface's
 * 0..100 range. Fragment boxes are never invented from character lengths.
 */
export function extractLabelPolygons(result: unknown) {
  let items = result && typeof result === "object" && "items" in result && Array.isArray(result.items)
    ? result.items.slice(0, 300).filter(isItem) : [];
  if (result && typeof result === "object" && "image" in result) {
    const frame = result.image;
    if (!frame || typeof frame !== "object" || !("width" in frame) || !("height" in frame)
      || typeof frame.width !== "number" || typeof frame.height !== "number"
      || !Number.isFinite(frame.width) || !Number.isFinite(frame.height)
      || frame.width <= 0 || frame.height <= 0 || frame.width > 16_384 || frame.height > 16_384) items = [];
    else {
      const { width, height } = frame;
      items = items.filter(item => item.poly.every(([x, y]) => x <= width && y <= height));
    }
  }
  const angles = items.flatMap(item => {
    const [a, b, c, d] = item.poly;
    const dx = (b[0] - a[0] + c[0] - d[0]) / 2;
    const dy = (b[1] - a[1] + c[1] - d[1]) / 2;
    const height = (Math.hypot(d[0] - a[0], d[1] - a[1]) + Math.hypot(c[0] - b[0], c[1] - b[1])) / 2;
    const angle = Math.atan2(dy, dx);
    return item.score >= .75 && dx > height * 3 && Math.abs(angle) < Math.PI / 6 ? [angle] : [];
  });
  const angle = angles.length >= 3 ? median(angles) : 0;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const raw = items.map(item => {
    const [a, b, c, d] = item.poly;
    const inlineWidth = (Math.hypot(b[0]-a[0], b[1]-a[1]) + Math.hypot(c[0]-d[0], c[1]-d[1])) / 2;
    const inlineHeight = (Math.hypot(d[0]-a[0], d[1]-a[1]) + Math.hypot(c[0]-b[0], c[1]-b[1])) / 2;
    const vertical = inlineHeight > inlineWidth * 1.6 && (item.text.match(/\p{L}/gu)?.length ?? 0) >= 3;
    return { text: item.text.trim(), confidence: item.score * 100,
      box: bounds(item.poly.map(([x, y]): Point => [x * cos + y * sin, -x * sin + y * cos])),
      ...(vertical ? { orientation: "vertical" as const, fontSize: inlineWidth } : {}) };
  });
  const offsetX = Math.max(0, -Math.min(0, ...raw.map(row => row.box.x0)));
  const offsetY = Math.max(0, -Math.min(0, ...raw.map(row => row.box.y0)));
  const lines: Line[] = raw.map(row => ({ ...row, box: { x0: row.box.x0 + offsetX, y0: row.box.y0 + offsetY,
    x1: row.box.x1 + offsetX, y1: row.box.y1 + offsetY }, height: row.box.y1 - row.box.y0,
  centerY: (row.box.y0 + row.box.y1) / 2 + offsetY }));
  const compatible = (group: Line[], line: Line) => {
      // Upright vertical text occupies its own column. Its long bounding box
      // is not a tall horizontal line shared with the neighboring column.
      if (line.orientation === "vertical" || group.some(row => row.orientation === "vertical")) return false;
      const box = combine(group), height = median(group.map(row => row.height));
      const fragments = [...group, line].sort((a, b) => a.box.x0 - b.box.x0);
      const first = fragments[0];
      const hasHeading = heading.test(first.text);
      const emptyHeading = hasHeading && !first.text.replace(heading, "").replace(/[:：=\s]/gu, "");
      const groupHasValue = group.length > 1 && group.some(row => row !== first);
      // Only a bare heading permits a wide table gap. A complete field must
      // not absorb the next column (e.g. net weight beside ingredients).
      if (hasHeading && !emptyHeading || fragments.slice(1).some(row => heading.test(row.text))) return false;
      const sameScript = fragments.every(row => /[가-힣]/u.test(row.text) === /[가-힣]/u.test(first.text));
      const gap = Math.max(0, line.box.x0 - box.x1, box.x0 - line.box.x1);
      if (emptyHeading && isLabelProcessProse(first.text, fragments.slice(1).map(row => row.text).join(" "))) {
        // A stacked processing value can be closer than the sensory column on
        // its right. Keep those columns separate only with a legible, aligned
        // value directly below; never jump over a damaged value to a later one.
        const right = fragments[1].box.x0;
        const below = lines.filter(row => !fragments.includes(row)
          && row.box.y0 >= first.box.y0 + first.height * .5
          && row.box.y0 <= first.box.y1 + first.height * 1.5
          && Math.abs(row.box.x0 - first.box.x0) <= first.height
          && row.box.x1 <= right - first.height * .5)
          .sort((a, b) => a.box.y0 - b.box.y0)[0];
        if (below && below.confidence >= 80
          && Math.max(below.height, first.height) / Math.min(below.height, first.height) < 2
          && below.centerY - first.centerY < right - first.box.x1) {
          const value = parseBeanLabelText(`${first.text} ${below.text}`).fields;
          if (value.process_method || value.process_detail) return false;
        }
      }
      return (emptyHeading || sameScript)
        && Math.abs(line.centerY - median(group.map(row => row.centerY))) <= Math.min(height, line.height) * .5
        && Math.max(height, line.height) / Math.min(height, line.height) < 2
        && gap <= Math.max(height, line.height) * (emptyHeading && !groupHasValue ? 8 : 1);
  };
  const groups: Line[][] = [];
  for (const line of lines.sort((a, b) => a.centerY - b.centerY || a.box.x0 - b.box.x0)) {
    const matches = groups.filter(group => compatible(group, line)).sort((a, b) => Math.abs(line.centerY - median(a.map(row => row.centerY)))
      - Math.abs(line.centerY - median(b.map(row => row.centerY))));
    if (matches.length) matches[0].push(line); else groups.push([line]);
  }
  // Perspective can put the rightmost word before its bridging middle word in
  // vertical order. Reconcile touching fragments after all words are present;
  // the same gap/heading rules still keep independent columns separate.
  groups.sort((a, b) => combine(a).x0 - combine(b).x0);
  for (let index = 0; index < groups.length; index++) {
    for (let next = index + 1; next < groups.length; next++) {
      const joined = [...groups[index]];
      const fragments = [...groups[next]].sort((a, b) => a.box.x0 - b.box.x0);
      if (!fragments.every(line => { if (!compatible(joined, line)) return false; joined.push(line); return true; })) continue;
      groups[index] = joined;
      groups.splice(next--, 1);
    }
  }
  const rows = groups.map(group => {
    group.sort((a, b) => a.box.x0 - b.box.x0);
    const orientation = group.length === 1 && group[0].orientation === "vertical"
      ? { orientation: "vertical" as const, fontSize: group[0].fontSize } : {};
    return { text: group.map(row => row.text).join(" "), bbox: combine(group), ...orientation,
      confidence: group.reduce((sum, row) => sum + row.confidence * row.text.length, 0) / group.reduce((sum, row) => sum + row.text.length, 0),
      words: group.map(row => ({ text: row.text, bbox: row.box, confidence: row.confidence,
        ...(row.orientation ? { orientation: row.orientation, fontSize: row.fontSize } : {}) })) };
  }).sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0);
  const text = rows.map(row => row.text).join("\n").slice(0, 30_000);
  const blocks = [{ paragraphs: [{ lines: rows }] }];
  // Low-confidence text is still available in the transcript, but cannot
  // supply fields through the lexical parser. Keep rejected rows as boundaries
  // so a heading cannot jump over an unreadable value to a different row.
  const runs: string[][] = [[]];
  for (const row of labelTableRows(rows)) {
    if (row.words.every(word => word.confidence >= 80)) runs.at(-1)!.push(row.text);
    else if (runs.at(-1)!.length) runs.push([]);
  }
  const parsed = mergeLabelListLayout(rows, mergeLabelExtractions([
    ...runs.filter(run => run.length).map(run => parseBeanLabelText(run.join("\n"))),
    extractLabelBlendLayout(rows),
  ]));
  return { text, extraction: extractLabelLayout(blocks, parsed), rows };
}
