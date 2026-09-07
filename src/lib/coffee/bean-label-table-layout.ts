type Box = { x0: number; y0: number; x1: number; y1: number };
type Row = { text: string; bbox: Box; confidence: number; words: { text: string; confidence: number }[]; orientation?: "vertical" };
const label = /^(?:country(?:\s+of\s+origin)?|origin(?:\s+country)?|region|farm|producer|varietals?|variet(?:y|ies)|cultivar|process(?:ing)?|roast(?:ing)?|weight|net(?:\s*(?:wt\.?|weight))?|원\s*산\s*지|생\s*산\s*국|국\s*가|(?:생산|산지|재배)?\s*지역|농장|생산자|품종|가공(?:\s*방식|\s*방법|법)?|로스팅|내용량|중량)\s*[:：=]?$/iu;
const height = (row: Row) => row.bbox.y1 - row.bbox.y0;
const centerX = (row: Row) => (row.bbox.x1 + row.bbox.x0) / 2;
const centerY = (row: Row) => (row.bbox.y1 + row.bbox.y0) / 2;
const overlap = (a: Row, b: Row) => Math.max(0, Math.min(a.bbox.x1, b.bbox.x1) - Math.max(a.bbox.x0, b.bbox.x0))
  / Math.min(a.bbox.x1 - a.bbox.x0, b.bbox.x1 - b.bbox.x0);
const readable = (row: Row) => row.confidence >= 80 && row.words.every(word => word.confidence >= 80);

/** Recover parallel label/value columns without reordering their source boxes.
 * This is only a lexical projection; display and title geometry stay original.
 * A single label or an ambiguous/damaged value cannot activate this path. */
export function labelTableRows(rows: Row[]): Pick<Row, "text" | "words">[] {
  const labels = rows.filter(row => label.test(row.text) && row.orientation !== "vertical" && readable(row));
  const pairs = new Map<Row, Row>();
  for (const head of labels) {
    const peers = labels.filter(other => other !== head
      && Math.abs(centerY(other) - centerY(head)) <= Math.min(height(other), height(head)) * .5
      && overlap(head, other) === 0
      && Math.abs(centerX(head) - centerX(other)) <= Math.max(height(head), height(other)) * 20);
    if (!peers.length) continue;
    const below = rows.filter(row => row !== head && centerY(row) > centerY(head) + height(head) * .5
      && overlap(row, head) >= .5 && row.bbox.y0 - head.bbox.y1 <= height(head) * 1.5
      && Math.abs(centerX(row) - centerX(head)) <= Math.max(height(row), height(head)))
      .sort((a, b) => centerY(a) - centerY(b))[0];
    if (!below || label.test(below.text) || !readable(below) || below.orientation === "vertical"
      || Math.max(height(head), height(below)) / Math.min(height(head), height(below)) > 2
      || peers.some(peer => overlap(peer, below) > .2)) continue;
    pairs.set(head, below);
  }
  // A pair of headers needs a distinct value in each corresponding column.
  for (const [head, value] of pairs) {
    if (![...pairs].some(([other, otherValue]) => other !== head && value !== otherValue
      && Math.abs(centerY(head) - centerY(other)) <= Math.min(height(head), height(other)) * .5
      && Math.abs(centerY(value) - centerY(otherValue)) <= Math.min(height(value), height(otherValue)))) pairs.delete(head);
  }
  const values = new Set(pairs.values());
  return rows.filter(row => !values.has(row)).map(row => {
    const value = pairs.get(row);
    return value ? { text: `${row.text} ${value.text}`, words: [...row.words, ...value.words] } : row;
  });
}
