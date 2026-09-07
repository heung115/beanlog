import assert from "node:assert/strict";
import test from "node:test";
import { selectLabelSmallPrintRegion, extractLabelSmallPrintWeight } from "../src/lib/coffee/bean-label-small-print.ts";

const primary = (fields = { name: "Copper Moon" }) => ({ bean_type: "single_origin", fields, evidence: {} });
const item = (text, x, y, width = 230, height = 14, score = .99) => ({ text, score, poly: [[x, y], [x + width, y], [x + width, y + height], [x, y + height]] });
const label = (offset = 0) => [item("Product: Copper Moon", 100 + offset, 100, 260, 28),
  item("Origin: Rwanda", 100 + offset, 145), item("Process: Washed", 100 + offset, 170), item("250 9", 240 + offset, 195, 60)];
const source = items => ({ image: { width: 1200, height: 1150 }, items: items ?? label() });
function supplemental(full, region, text = "250 g", score = .99) {
  const value = { ...full.items[3], text, score };
  return { image: region.output, items: [{ ...value, poly: value.poly.map(([x, y]) => [
    (x - region.crop.x) * region.output.width / region.crop.width,
    (y - region.crop.y) * region.output.height / region.crop.height,
  ]) }] };
}

test("a small-print component retains nearby name context and stays within both pixel budgets", () => {
  const full = source();
  const original = structuredClone(full);
  const region = selectLabelSmallPrintRegion(full, primary());
  assert.ok(region);
  assert.deepEqual(region.source, full.image);
  assert.ok(region.itemIndices.includes(0));
  assert.ok(region.crop.y <= 100);
  assert.ok(region.crop.x >= 0 && region.crop.x + region.crop.width <= full.image.width);
  assert.ok(region.output.width * region.output.height <= 3_000_000);
  assert.ok(Math.max(region.output.width, region.output.height) <= 2600);
  assert.deepEqual(full, original);
});

test("existing weight, large readable lettering, sparse text and non-cue paragraphs do not add a read", () => {
  assert.equal(selectLabelSmallPrintRegion(source(), primary({ name: "Copper Moon", weight_g: 250 })), undefined);
  assert.equal(selectLabelSmallPrintRegion(source(label().map(row => ({ ...row, poly: row.poly.map(([x, y]) => [x, y * 3]) }))), primary()), undefined);
  assert.equal(selectLabelSmallPrintRegion(source(label().slice(0, 2)), primary()), undefined);
  assert.equal(selectLabelSmallPrintRegion(source(label().map((row, i) => ({ ...row, text: ["Copper Moon", "Bright mornings", "Coffee moments", "Soft finish"][i] }))), primary()), undefined);
});

test("separate packages and a cluster detached from the established identity remain unresolved", () => {
  assert.equal(selectLabelSmallPrintRegion(source([...label(), ...label(650)]), primary()), undefined);
  assert.equal(selectLabelSmallPrintRegion(source(label().map((row, i) => i ? row : { ...row, text: "Product: Another Lot" })), primary()), undefined);
  assert.equal(selectLabelSmallPrintRegion(source([...label(), item("Product: Copper Moon", 900, 800, 250, 70)]), primary()), undefined);
});

test("a country, address or generic cream paragraph cannot create coffee identity through a recovered weight", () => {
  const cosmetic = source([item("Country: Kenya", 100, 145), item("Moisturizing hand cream", 100, 170), item("250 9", 240, 195, 60)]);
  for (const fields of [{}, { origin_country: "Kenya" }, { origin_country: "Kenya", farm_producer: "Nairobi Factory" }]) {
    assert.equal(selectLabelSmallPrintRegion(cosmetic, { bean_type: "unknown", fields, evidence: {} }), undefined);
  }
  assert.ok(selectLabelSmallPrintRegion(source(), primary({ varietal: "Bourbon" })));
});

test("vertical decoration and malformed or unbounded frames cannot inflate the crop", () => {
  const full = source([...label(), item("R", 20, 60, 30, 400, .5)]);
  assert.deepEqual(selectLabelSmallPrintRegion(full, primary()).crop, selectLabelSmallPrintRegion(source(), primary()).crop);
  for (const invalid of [null, {}, { ...full, image: { width: 2601, height: 800 } }, { ...full, image: { width: 2500, height: 2000 } },
    { ...full, items: Array.from({ length: 301 }, () => full.items[0]) }, { ...full, image: { width: NaN, height: 800 } }]) {
    assert.equal(selectLabelSmallPrintRegion(invalid, primary()), undefined);
  }
  assert.equal(selectLabelSmallPrintRegion(source(label().map(row => ({ ...row, poly: [[-1, 0], [2, 0], [2, 2], [0, 2]] }))), primary()), undefined);
});

test("only a 90-percent source line with actual units supplies the missing weight", () => {
  const full = source(), region = selectLabelSmallPrintRegion(full, primary());
  assert.deepEqual(extractLabelSmallPrintWeight(supplemental(full, region, "250 g", .9), region, full), {
    weight_g: 250, evidence: "250 g", confidence: 90,
  });
  assert.equal(extractLabelSmallPrintWeight(supplemental(full, region, "250 g", .89999), region, full), undefined);
  for (const text of ["250 9", "250 q", "250 0z", "250gourmet", "8 oz", "250g / 7oz", "100001g", "0g"]) {
    assert.equal(extractLabelSmallPrintWeight(supplemental(full, region, text), region, full), undefined, text);
  }
  for (const text of ["0.25 kg", "0,250 kg", "250g / 8.82oz", "Net weight: 250 g"]) {
    assert.equal(extractLabelSmallPrintWeight(supplemental(full, region, text), region, full)?.weight_g, 250, text);
  }
});

test("a numerical source polygon is required at the recovered weight position", () => {
  const full = source(), region = selectLabelSmallPrintRegion(full, primary());
  const moved = supplemental(full, region);
  moved.items[0].poly = moved.items[0].poly.map(([x, y]) => [x, y - 150]);
  assert.equal(extractLabelSmallPrintWeight(moved, region, full), undefined);
  for (const text of ["250%", "2026-09-07", "8800415420047", "Washed"]) {
    const differentSource = source(full.items.map((row, i) => i === 3 ? { ...row, text } : row));
    assert.equal(extractLabelSmallPrintWeight(supplemental(full, region), region, differentSource), undefined, text);
  }
});

test("conflicting printed weights and changed coordinate frames cannot select a preferred value", () => {
  const full = source(), region = selectLabelSmallPrintRegion(full, primary());
  const read = supplemental(full, region);
  const conflicting = { ...read, items: [...read.items, { ...read.items[0], text: "200 g" }] };
  assert.equal(extractLabelSmallPrintWeight(conflicting, region, full), undefined);
  assert.equal(extractLabelSmallPrintWeight(read, region, source([...full.items, item("200 g", 100, 400)])), undefined);
  assert.equal(extractLabelSmallPrintWeight({ ...read, image: { ...read.image, width: read.image.width + 1 } }, region, full), undefined);
  assert.equal(extractLabelSmallPrintWeight(read, region, { ...full, image: { width: 1150, height: 1200 } }), undefined);
});
