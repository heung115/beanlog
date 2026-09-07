import assert from "node:assert/strict";
import test from "node:test";
import { extractLabelLayout } from "../src/lib/coffee/bean-label-layout.ts";

const empty = () => ({ bean_type: "unknown", fields: {}, evidence: {} });
function line(text, y, height = 20, options = {}) {
  const { x = 50, confidence = 95, wordConfidence = confidence, width = text.length * height * 0.55 } = options;
  const tokens = text.split(/\s+/u);
  return {
    text: `${text}\n`, confidence, bbox: { x0: x, y0: y, x1: x + width, y1: y + height },
    words: tokens.map((text, index) => ({ text, confidence: wordConfidence,
      bbox: { x0: x + index * width / tokens.length, y0: y, x1: x + (index + 1) * width / tokens.length, y1: y + height } })),
  };
}
const blocks = (...lines) => [{ paragraphs: [{ lines }] }];

test("a dominant title is anchored to adjacent printed coffee metadata", () => {
  const source = blocks(line("Copper Moon", 50, 40), line("Country: Colombia", 110, 15), line("Net weight: 250g", 140, 15));
  const result = extractLabelLayout(source, empty());
  assert.equal(result.fields.name, "Copper Moon");
  assert.equal(result.evidence.name, "Copper Moon");
  assert.deepEqual(Object.keys(result.fields), ["name"]);
});

test("close equally sized title lines preserve their printed words and letter case", () => {
  const result = extractLabelLayout(blocks(line("Orchard", 50, 35), line("Promise", 94, 35),
    line("Coffee blend", 150, 14), line("Net weight: 300g", 172, 14)), empty());
  assert.equal(result.fields.name, "Orchard Promise");
  assert.equal(result.evidence.name.replace(/\s+/gu, " "), "Orchard Promise");
});

test("a clear coffee product category can be a title beside supporting packaging text", () => {
  for (const name of ["CLASSICESPRESSO", "DECAFFEINATED COFFEE", "Morning Blend", "클래식 에스프레소"]) {
    const result = extractLabelLayout(blocks(line(name, 70, 30), line("Roasted coffee", 110, 18)), empty());
    assert.equal(result.fields.name, name, name);
  }
});

test("rejected low-confidence larger lettering cannot supplant a clear printed coffee title", () => {
  const source = blocks(line("Uncertain Label", 50, 45, { wordConfidence: 55 }),
    line("DECAFFEINATED COFFEE", 110, 25), line("Coffee beans", 147, 16));
  assert.equal(extractLabelLayout(source, empty()).fields.name, "DECAFFEINATED COFFEE");
});

test("existing fields and display metadata are retained without mutation", () => {
  const base = { bean_type: "single_origin", fields: { weight_g: 350, roastery: "Printed Brand" },
    evidence: { weight_g: "350G NET", roastery: "Printed Brand Coffee Roasters" },
    tasting_notes: { en: ["Cocoa", "Plum"], ko: [] }, tasting_notes_evidence: ["Cocoa, Plum"] };
  const original = structuredClone(base);
  const result = extractLabelLayout(blocks(line("Copper Moon", 50, 40), line("Natural coffee", 110, 15)), base);
  assert.equal(result.fields.name, "Copper Moon");
  assert.deepEqual(base, original);
  assert.deepEqual({ ...result, fields: base.fields, evidence: base.evidence }, base);
  const existing = { ...base, fields: { ...base.fields, name: "Already read" }, evidence: { ...base.evidence, name: "Product: Already read" } };
  assert.strictEqual(extractLabelLayout(blocks(line("Different Espresso", 50, 40), line("Coffee", 110, 15)), existing), existing);
});

test("price banners, promotional prose and use categories cannot be product titles", () => {
  for (const text of ["Business", "Special Price", "Enjoy every cup", "Freshly roasted for you", "FAVORITE COFFEE", "MILK-BASED", "Sweet berries and creamy chocolate"]) {
    assert.equal(extractLabelLayout(blocks(line(text, 50, 50), line("Roasted coffee", 120, 15), line("250g", 147, 15)), empty()).fields.name, undefined, text);
  }
});

test("roastery wordmarks, blend components, tasting notes and factual headings stay out of names", () => {
  const base = { ...empty(), tasting_notes: { en: ["Orange Blossom"], ko: [] }, tasting_notes_evidence: ["Cup notes: Orange Blossom"] };
  for (const source of [
    blocks(line("Copper Roasters", 50, 50), line("Coffee", 120, 15)),
    blocks(line("RIDGE Coffee Roasters", 50, 50), line("250g", 120, 15)),
    blocks(line("Distant Ridge", 50, 50), line("Coffee Roasters", 110, 15), line("250g", 150, 15)),
    blocks(line("Brazil 60%", 50, 50), line("Coffee", 120, 15)),
    blocks(line("Cup notes:", 20, 15), line("Orange Blossom", 50, 50), line("Coffee", 120, 15)),
    blocks(line("Origin: Colombia", 50, 50), line("Coffee", 120, 15)),
  ]) assert.equal(extractLabelLayout(source, base).fields.name, undefined);
});

test("names with explicit headings are never recovered by layout after a conflict or failed labelled read", () => {
  for (const heading of ["Product: First", "Coffee name: First", "P R O D U C T : First", "제품명: 첫째", "원 두 명 : 첫째"]) {
    const source = blocks(line(heading, 10, 15), line("Copper Moon", 50, 40), line("Roasted coffee", 110, 15));
    assert.equal(extractLabelLayout(source, empty()).fields.name, undefined, heading);
  }
});

test("two similarly prominent products remain ambiguous instead of choosing by reading order", () => {
  const first = line("Copper Moon", 50, 40);
  const second = line("Evening Sun", 180, 38);
  const coffee = line("Roasted coffee", 130, 15);
  assert.equal(extractLabelLayout(blocks(first, coffee, second), empty()).fields.name, undefined);
  assert.equal(extractLabelLayout(blocks(second, coffee, first), empty()).fields.name, undefined);
});

test("a title needs readable coffee context in the same physical area", () => {
  for (const source of [
    blocks(line("Copper Moon", 50, 40)),
    blocks(line("Copper Moon", 50, 40), line("250g", 110, 15)),
    blocks(line("Copper Moon", 50, 40), line("Coffee", 1000, 15)),
    blocks(line("Copper Moon", 50, 40), line("Coffee", 100, 15, { x: 1400 })),
  ]) assert.equal(extractLabelLayout(source, empty()).fields.name, undefined);
});

test("low confidence, missing geometry, controls and unsupported word substitutions stay unresolved", () => {
  for (const broken of [
    line("CLASSICESPRESSO", 50, 40, { confidence: 54 }),
    line("Copper Moon", 50, 40, { wordConfidence: 60 }),
    { ...line("Copper Moon", 50, 40), bbox: null },
    { ...line("Copper Moon", 50, 40), bbox: { x0: -1, x1: 10, y0: 0, y1: 10 } },
    line("Copper\u202eMoon", 50, 40),
  ]) assert.equal(extractLabelLayout(blocks(broken, line("Roasted coffee", 110, 15)), empty()).fields.name, undefined);
});

test("layout is scale and translation invariant and does not mutate OCR blocks", () => {
  const source = blocks(line("Copper Moon", 50, 40), line("Country: Colombia", 110, 15));
  const original = structuredClone(source);
  const transformed = structuredClone(source);
  for (const entry of transformed[0].paragraphs[0].lines) {
    for (const box of [entry.bbox, ...entry.words.map((word) => word.bbox)]) {
      for (const key of ["x0", "x1"]) box[key] = box[key] * 3 + 150;
      for (const key of ["y0", "y1"]) box[key] = box[key] * 3 + 250;
    }
  }
  assert.deepEqual(extractLabelLayout(source, empty()), extractLabelLayout(transformed, empty()));
  assert.deepEqual(source, original);
});

test("malformed and oversized OCR containers cannot supply a title", () => {
  for (const source of [undefined, null, {}, [null, { paragraphs: [null, { lines: [null] }] }], blocks(line("X".repeat(501), 50, 40), line("Coffee", 120, 15))]) {
    assert.equal(extractLabelLayout(source, empty()).fields.name, undefined);
  }
});

test("large adjacent flavor words can form a title when usage, tasting prose and net weight establish the package", () => {
  const base = { ...empty(), fields: { weight_g: 300 }, evidence: { weight_g: "300g" } };
  const source = blocks(line("Blueberry", 50, 80), line("Promise", 123, 78), line("MILK-BASED", 220, 16),
    line("Sweet fruit and creamy chocolate", 270, 18));
  assert.equal(extractLabelLayout(source, base).fields.name, "Blueberry Promise");
  assert.equal(extractLabelLayout(source, empty()).fields.name, undefined);
});

test("a complete coffee title can use adjacent bilingual packaging text as context", () => {
  const source = blocks(line("항구", 50, 30), line("Evening Blend Harbor", 100, 28));
  assert.equal(extractLabelLayout(source, { ...empty(), bean_type: "blend" }).fields.name, "Evening Blend Harbor");
  assert.equal(extractLabelLayout(blocks(line("Blend H", 100, 28), line("커피", 70, 25)), empty()).fields.name, undefined);
});

test("a clipped name fragment cannot turn a nearby category heading into a conflicting product name", () => {
  const base = { ...empty(), bean_type: "blend" };
  const partial = blocks(line("한정 블렌드", 50, 25), line("Blend E", 125, 15));
  assert.equal(extractLabelLayout(partial, base).fields.name, undefined);
  const complete = blocks(line("한정 블렌드", 50, 25, { wordConfidence: 75 }), line("항구", 90, 27), line("Evening Blend Harbor", 140, 24));
  assert.equal(extractLabelLayout(complete, base).fields.name, "Evening Blend Harbor");
});

test("two confident bilingual readings do not pick a different name by font size", () => {
  const source = blocks(line("작은숲디카페인", 50, 45), line("DECAFFEINATED COFFEE", 110, 25));
  assert.equal(extractLabelLayout(source, empty()).fields.name, undefined);
  const uncertainHeading = blocks(line("한정 블렌트", 50, 38), line("항구", 100, 35), line("Evening Blend Harbor", 165, 25));
  assert.equal(extractLabelLayout(uncertainHeading, { ...empty(), bean_type: "blend" }).fields.name, undefined);
});

test("a clear stacked brand and COFFEE wordmark supplements only a missing roastery", () => {
  const base = { ...empty(), fields: { name: "Evening Blend" }, evidence: { name: "Evening Blend" } };
  const source = blocks(line("RIDGE", 20, 30), line("COFFEE", 68, 30), line("Evening Blend", 170, 25));
  const result = extractLabelLayout(source, base);
  assert.equal(result.fields.roastery, "RIDGE");
  assert.match(result.evidence.roastery, /RIDGE\s+COFFEE/u);
  const existing = { ...base, fields: { ...base.fields, roastery: "Already read" } };
  assert.strictEqual(extractLabelLayout(source, existing), existing);
});

test("plain COFFEE needs trustworthy geometry and confidence before identifying a nearby brand", () => {
  const base = { ...empty(), fields: { name: "Evening Blend" }, evidence: { name: "Evening Blend" } };
  for (const source of [
    blocks(line("RIDGE", 20, 30), line("COFFEE", 68, 30, { confidence: 22 })),
    blocks(line("RIDGE", 20, 30), line("COFFEE", 900, 30)),
    blocks(line("RIDGE", 20, 30), line("COFFEE", 68, 30, { x: 1000 })),
    blocks(line("GUJI", 20, 30), line("COFFEE", 68, 30)),
    blocks(line("Roaster: One", 0, 15), line("RIDGE", 30, 30), line("COFFEE", 78, 30)),
    blocks(line("RIDGE", 20, 30), line("COFFEE", 68, 30), line("RIVER", 200, 30), line("COFFEE", 248, 30)),
  ]) assert.equal(extractLabelLayout(source, base).fields.roastery, undefined);
});

function countryBase(country = "Ethiopia", evidence = "Country: Ethiopia") {
  return { ...empty(), fields: { origin_country: country }, evidence: { origin_country: evidence } };
}

function countryCard(first = ["에티오피아 알로 타미루", "몰케 네추럴"], second = ["Colombia La Esperanza", "Java Natural"], metadata = [line("Country: Ethiopia", 270, 16)]) {
  return blocks(...[...first, ...second].map((text, index) => line(text, 50 + index * 50, 40)),
    ...metadata, line("Process: Natural", 310, 16));
}

test("nearby explicit country metadata selects its complete printed title instead of joining conflicting headers", () => {
  const base = countryBase("Ethiopia", "국가: Ethiopia 에티오피아");
  const source = countryCard(undefined, undefined, [line("국가: Ethiopia 에티오피아", 270, 16)]);
  const original = structuredClone({ source, base });
  const result = extractLabelLayout(source, base);
  assert.equal(result.fields.name, "에티오피아 알로 타미루 몰케 네추럴");
  assert.equal(result.evidence.name, "에티오피아 알로 타미루\n몰케 네추럴");
  assert.equal(result.fields.origin_country, "Ethiopia");
  assert.deepEqual({ source, base }, original);
});

test("country agreement can select the English title without preferring Korean or reading order", () => {
  const result = extractLabelLayout(countryCard(["콜롬비아 푸른산", "자바 내추럴"], ["Ethiopia Tamiru", "Morke Natural"]), countryBase());
  assert.equal(result.fields.name, "Ethiopia Tamiru Morke Natural");
  assert.equal(result.evidence.name, "Ethiopia Tamiru\nMorke Natural");
});

test("a new country-prefixed heading starts a separate title even when both titles use the same script", () => {
  const result = extractLabelLayout(countryCard(["Ethiopia Tamiru", "Morke Natural"], ["Colombia La Esperanza", "Java Natural"]), countryBase());
  assert.equal(result.fields.name, "Ethiopia Tamiru Morke Natural");
});

test("country-supported titles preserve a mixed-script continuation without inventing a translation", () => {
  const result = extractLabelLayout(countryCard(["Ethiopia Tamiru", "몰케 Natural"], ["Colombia La Esperanza", "Java Natural"]), countryBase());
  assert.equal(result.fields.name, "Ethiopia Tamiru 몰케 Natural");
  assert.equal(result.evidence.name, "Ethiopia Tamiru\n몰케 Natural");
});

test("country selection needs both parsed evidence and the corresponding readable metadata line", () => {
  for (const [base, metadata] of [
    [empty(), []],
    [countryBase(), []],
    [{ ...empty(), fields: { origin_country: "Ethiopia" } }, [line("Country: Ethiopia", 270, 16)]],
    [countryBase(), [line("Country: Ethiopla", 270, 16)]],
    [countryBase(), [line("Country: Ethiopia", 270, 16, { confidence: 0, wordConfidence: 0 })]],
    [countryBase("Ethiopia", "Ethiopia"), [line("Ethiopia", 270, 16)]],
  ]) {
    const result = extractLabelLayout(countryCard(undefined, undefined, metadata), base);
    assert.equal(result.fields.name, undefined, JSON.stringify({ base, metadata }));
    assert.deepEqual(result.fields, base.fields);
  }
});

test("conflicting explicit country rows cannot break a title tie even if a previous pass supplied one country", () => {
  const metadata = [line("Country: Ethiopia", 270, 16), line("Origin: Colombia", 290, 16)];
  assert.equal(extractLabelLayout(countryCard(undefined, undefined, metadata), countryBase()).fields.name, undefined);
  assert.equal(extractLabelLayout(countryCard(undefined, undefined, metadata), empty()).fields.name, undefined);
});

test("country metadata on another distant card cannot disambiguate these titles", () => {
  for (const metadata of [
    [line("Country: Ethiopia", 1000, 16)],
    [line("Country: Ethiopia", 270, 16, { x: 1400 })],
  ]) assert.equal(extractLabelLayout(countryCard(undefined, undefined, metadata), countryBase()).fields.name, undefined);
});

test("matching a country does not prove that distinct bilingual titles are translations", () => {
  const source = countryCard(["에티오피아 푸른산", "워시드 커피"], ["Ethiopia Distant Valley", "Natural Coffee"]);
  assert.equal(extractLabelLayout(source, countryBase()).fields.name, undefined);
});

test("country names embedded in longer title words cannot establish country agreement", () => {
  const source = countryCard(["콜롬비아 푸른산", "자바 내추럴"], ["Ethiopiaway Morning", "Natural Coffee"]);
  assert.equal(extractLabelLayout(source, countryBase()).fields.name, undefined);
});

test("varietal and producer values named after a country are not explicit origin evidence", () => {
  for (const label of ["Varietal: Colombia", "Producer: Colombia"]) {
    const source = countryCard(undefined, undefined, [line(label, 270, 16)]);
    assert.equal(extractLabelLayout(source, countryBase("Colombia", label)).fields.name, undefined, label);
  }
});
