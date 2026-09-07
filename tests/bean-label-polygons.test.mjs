import assert from "node:assert/strict";
import test from "node:test";
import { extractLabelPolygons } from "../src/lib/coffee/bean-label-polygons.ts";

const item = (text, x, y, width, height = 20, score = .96) => ({ text, score,
  poly: [[x, y], [x + width, y], [x + width, y + height], [x, y + height]] });

test("vertical product and flavor columns retain separate text direction and font thickness", () => {
  const result = extractLabelPolygons({ items: [
    item("케냐AATOP", 610, 460, 36, 136, .94),
    item("건과일·초콜릿·블랙티", 575, 464, 24, 180, .94),
    item("Country: Kenya", 350, 715, 290, 20),
    item("Weight: 200g", 350, 745, 290, 20),
  ] });
  assert.equal(result.rows.length, 4);
  assert.equal(result.rows.find(row => row.text === "케냐AATOP").orientation, "vertical");
  assert.equal(result.rows.find(row => row.text === "케냐AATOP").fontSize, 36);
  assert.equal(result.extraction.fields.name, "케냐AATOP");
});

test("parallel process and variety columns cannot exchange their values", () => {
  const result = extractLabelPolygons({ items: [
    item("PROCESS", 30, 100, 85), item("VARIETY", 220, 100, 85),
    item("WASHED", 30, 125, 85), item("VARIOUS", 220, 125, 85),
  ] });
  assert.equal(result.extraction.fields.process_method, "washed");
  assert.equal(result.extraction.fields.varietal, "VARIOUS");
  assert.equal(result.extraction.evidence.varietal, "VARIETY VARIOUS");
  assert.equal(result.rows.map(row => row.text).join("\n"), "PROCESS\nVARIETY\nWASHED\nVARIOUS");
});

test("polygon rows join a table heading to its value without joining the next column", () => {
  const result = extractLabelPolygons({ items: [item("국가:", 30, 100, 50),
    item("Ethiopia 에티오피아", 130, 100, 220), item("250g", 600, 100, 65)] });
  assert.equal(result.extraction.fields.origin_country, "Ethiopia");
  assert.equal(result.extraction.fields.weight_g, 250);
  assert.equal(result.rows.length, 2);
});

test("a processing column stays separate from adjacent sensory prose when its value is directly below", () => {
  const result = extractLabelPolygons({ items: [
    item("가공", 361, 576, 20, 11, .91),
    item("실구쟁의 달공한 장이와 플리드 오렌지와", 444, 572, 113, 13, .84),
    item("washed", 361, 585, 31, 12, .91),
    item("산뜻한 산이가 일도감 있게 느피지는 커피", 445, 585, 112, 10, .86),
  ] });
  assert.equal(result.extraction.fields.process_method, "washed");
  assert.equal(result.extraction.fields.process_detail, undefined);
  assert.ok(result.rows.some(row => row.text === "가공"));
  assert.ok(result.rows.some(row => row.text === "washed"));
  assert.doesNotMatch(result.extraction.evidence.process_method, /오렌지|커피/u);
});

test("processing column guards preserve real horizontal values and unknown explicit techniques", () => {
  const horizontal = extractLabelPolygons({ items: [item("가공방식:", 30, 100, 90),
    item("Natural", 160, 100, 100), item("청사과, 청포도", 450, 100, 180)] });
  assert.equal(horizontal.extraction.fields.process_method, "natural");
  assert.equal(horizontal.extraction.evidence.process_method, "가공방식: Natural");
  const unknown = extractLabelPolygons({ items: [item("Process:", 30, 100, 80),
    item("Experimental sealed-vessel treatment", 150, 100, 330), item("Washed", 30, 135, 90)] });
  assert.equal(unknown.extraction.fields.process_method, undefined);
  assert.equal(unknown.extraction.fields.process_detail, "Experimental sealed-vessel treatment");
});

test("processing column selection is scale independent and cannot skip damaged or distant values", () => {
  const source = [item("Process:", 40, 100, 80), item("Bright berry notes with a silky finish", 220, 98, 290),
    item("Washed", 40, 121, 85)];
  for (const scale of [.5, 1, 3]) {
    const scaled = source.map(row => ({ ...row, poly: row.poly.map(point => point.map(coordinate => coordinate * scale)) }));
    const result = extractLabelPolygons({ items: scaled });
    assert.equal(result.extraction.fields.process_method, "washed");
    assert.equal(result.extraction.fields.process_detail, undefined);
  }
  for (const values of [
    [item("Washed", 40, 121, 85, 20, .4)],
    [item("unreadable", 40, 122, 90), item("Washed", 40, 145, 85)],
    [item("Washed", 40, 175, 85)],
    [item("Washed", 140, 121, 70)],
  ]) {
    const result = extractLabelPolygons({ items: [...source.slice(0, 2), ...values] });
    assert.equal(result.extraction.fields.process_method, undefined);
    assert.equal(result.extraction.fields.process_detail, undefined);
  }
});

test("a complete net-weight row is not swallowed by adjacent ingredients", () => {
  const result = extractLabelPolygons({ items: [item("NET WT 1 kg", 30, 100, 130),
    item("커피원두100%", 180, 100, 120)] });
  assert.equal(result.extraction.fields.weight_g, 1000);
  assert.equal(result.rows.length, 2);
  assert.equal(result.extraction.evidence.weight_g, "NET WT 1 kg");
});

test("same-baseline title fragments retain source geometry and confidence", () => {
  const source = { items: [item("Copper", 30, 30, 100, 35), item("Moon", 140, 30, 90, 35),
    item("Country: Colombia", 30, 100, 220)] };
  const before = structuredClone(source);
  const result = extractLabelPolygons(source);
  assert.equal(result.extraction.fields.name, "Copper Moon");
  assert.equal(result.rows[0].words.length, 2);
  assert.equal(result.rows[0].words[1].confidence, 96);
  assert.deepEqual(source, before);
});

test("a heading never consumes a second field heading", () => {
  const result = extractLabelPolygons({ items: [item("Country:", 30, 100, 80),
    item("Weight: 200g", 150, 100, 140)] });
  assert.equal(result.rows.length, 2);
  assert.equal(result.extraction.fields.origin_country, undefined);
  assert.equal(result.extraction.fields.weight_g, 200);
});

test("a table heading cannot keep consuming distant values after its first value", () => {
  const result = extractLabelPolygons({ items: [item("Country:", 0, 100, 80),
    item("Ethiopia", 120, 100, 90), item("250g", 310, 100, 50)] });
  assert.equal(result.rows.length, 2);
  assert.equal(result.extraction.fields.origin_country, "Ethiopia");
  assert.equal(result.extraction.fields.weight_g, 250);
});

test("perspective ordering cannot split an adjacent multiword table value", () => {
  const result = extractLabelPolygons({ items: [item("Region:", 0, 100, 80), item("Ridge,", 150, 105, 98),
    item("Valley,", 250, 108, 98), item("Plateau", 350, 106, 98)] });
  assert.equal(result.extraction.fields.origin_region, "Ridge, Valley, Plateau");
  assert.equal(result.rows.length, 1);
});

test("low-confidence headed fields are reviewable as raw text but cannot fill the form", () => {
  const result = extractLabelPolygons({ items: [item("Product: Copper Moon", 30, 30, 250, 20, 0),
    item("Country: Colombia", 30, 100, 200, 20, .4), item("Producer:", 30, 140, 100),
    item("Uncertain Farm", 30, 180, 180, 20, .3), item("Large Words", 30, 220, 200)] });
  assert.match(result.text, /Copper Moon/u);
  assert.equal(result.extraction.fields.name, undefined);
  assert.equal(result.extraction.fields.origin_country, undefined);
  assert.equal(result.extraction.fields.farm_producer, undefined);
});

test("bounded malformed input cannot supply invented text or boxes", () => {
  const valid = item("Coffee", 30, 30, 100);
  for (const invalid of [null, {}, { items: null }, { items: [null, {}, { ...valid, score: Infinity },
    { ...valid, poly: [[0, 0], [0, 0], [0, 0], [0, 0]] }, { ...valid, text: "x".repeat(501) },
    { ...valid, text: "Bad\u202eCoffee" }, { ...valid, poly: [[0, 0], [1e8, 0], [1e8, 1e8], [0, 1e8]] }] }]) {
    assert.equal(extractLabelPolygons(invalid).text, "");
    assert.deepEqual(extractLabelPolygons(invalid).extraction.fields, {});
  }
});

test("a low-confidence line retains its score and cannot become a product title", () => {
  const result = extractLabelPolygons({ items: [item("Copper Moon", 30, 30, 250, 40, .62),
    item("Roasted Coffee", 30, 100, 200)] });
  assert.equal(result.rows[0].confidence, 62);
  assert.equal(result.extraction.fields.name, undefined);
});

test("geometry outside a supplied decoded image cannot become field evidence", () => {
  for (const image of [{ width: 10, height: 10 }, { width: Infinity, height: 300 }, null]) {
    const result = extractLabelPolygons({ image, items: [item("Country: Colombia", 30, 30, 200)] });
    assert.deepEqual(result.extraction.fields, {});
  }
});

test("deskewed rows keep source words and do not prefer one language", () => {
  const source = { items: [item("Copper Moon", 30, 30, 220, 30), item("Country:", 30, 100, 100),
    item("Colombia", 140, 100, 120), item("Process: Washed", 30, 150, 220), item("Net weight: 250g", 30, 190, 220)] };
  const rotate = .14;
  const rotated = { items: source.items.map(value => ({ ...value, poly: value.poly.map(([x, y]) =>
    [x * Math.cos(rotate) - y * Math.sin(rotate) + 80, x * Math.sin(rotate) + y * Math.cos(rotate) + 80]) })) };
  assert.deepEqual(extractLabelPolygons(rotated).extraction, extractLabelPolygons(source).extraction);
});
