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

function damagedCountryCaption({ countryConfidence = 99, fragmentConfidence = 74, country = "Colombia", headerX = 50, gap = 5, intervening, symbolNoise = false } = {}) {
  const damaged = line(`${country} ${symbolNoise ? "La" : "l"} Mesa${symbolNoise ? " ©" : ""}`, 138, 28, { width: 490, x: headerX, confidence: 96 });
  damaged.words[0].confidence = countryConfidence;
  damaged.words[1].confidence = fragmentConfidence;
  return blocks(line("케냐 푸른 언덕", 50, 40, { width: 500, confidence: 99 }),
    line("새벽 내추럴", 94, 38, { width: 300, confidence: 99 }), damaged,
    ...(intervening ? [line(intervening, 167, 10, { width: 270 })] : []),
    line("Caturra Natural", 166 + gap, 28, { width: 270, confidence: 99 }),
    line("Country: Kenya", 210 + gap, 18, { width: 300, confidence: 99 }));
}

test("a damaged country-prefixed caption cannot leave its contradictory tail as a separate product", () => {
  const base = { ...empty(), fields: { origin_country: "Kenya" }, evidence: { origin_country: "Country: Kenya" } };
  for (const options of [{ fragmentConfidence: 74 }, { fragmentConfidence: 99 }, { fragmentConfidence: 99, symbolNoise: true }]) {
    const source = damagedCountryCaption(options);
    const original = structuredClone(source);
    const result = extractLabelLayout(source, base);
    assert.equal(result.fields.name, "케냐 푸른 언덕 새벽 내추럴");
    assert.equal(result.fields.origin_country, "Kenya");
    assert.deepEqual(source, original);
  }
});

test("a damaged caption needs a confident printed country and matching independent country evidence", () => {
  const base = { ...empty(), fields: { origin_country: "Kenya" }, evidence: { origin_country: "Country: Kenya" } };
  for (const source of [damagedCountryCaption({ countryConfidence: 94.99 }), damagedCountryCaption({ country: "Colembea" }),
    damagedCountryCaption({ country: "Kenya" })]) {
    assert.equal(extractLabelLayout(source, base).fields.name, undefined);
  }
  assert.equal(extractLabelLayout(damagedCountryCaption(), empty()).fields.name, undefined);
});

test("a rejected country caption does not reach another column, distant title or cross a metadata row", () => {
  const base = { ...empty(), fields: { origin_country: "Kenya" }, evidence: { origin_country: "Country: Kenya" } };
  for (const source of [damagedCountryCaption({ headerX: 900 }), damagedCountryCaption({ gap: 22 }),
    damagedCountryCaption({ gap: 15, intervening: "Variety: Caturra" }),
    damagedCountryCaption({ gap: 5, intervening: "Variety: Caturra" })]) {
    assert.equal(extractLabelLayout(source, base).fields.name, undefined);
  }
});

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

test("a single printed product word can use adjacent origin, process and package weight", () => {
  const source = blocks(line("Crescendo", 50, 45), line("Country: Colombia", 112, 15),
    line("Process: Washed", 136, 15), line("250g", 160, 15));
  assert.equal(extractLabelLayout(source, empty()).fields.name, "Crescendo");
});

test("receipt, advertisement, generic package categories and regulatory identifiers are never product names", () => {
  for (const title of ["COFFEE RECEIPT", "SUMMER COLLECTION", "SPECIALTY WHOLE BEAN COFFEE", "품목보고번호 2022009039228", "SEASONAL", "DIRECT TRADE"]) {
    assert.equal(extractLabelLayout(blocks(line(title, 50, 50), line("Roasted coffee", 120, 15),
      line("Country: Colombia", 145, 15), line("250g", 168, 15)), empty()).fields.name, undefined, title);
  }
});

test("cup-note exclusions stay in their own physical column and ignore OCR container order", () => {
  const title = line("Copper Moon", 50, 40, { x: 50, width: 240 });
  const origin = line("Country: Colombia", 115, 15, { x: 50, width: 240 });
  const heading = line("Cup notes:", 20, 15, { x: 600, width: 120 });
  for (const rows of [[heading, title, origin], [title, origin, heading], [origin, heading, title]]) {
    assert.equal(extractLabelLayout(blocks(...rows), empty()).fields.name, "Copper Moon");
  }
  assert.equal(extractLabelLayout(blocks(line("Cup notes:", 20, 15, { x: 50 }),
    line("Country: Colombia", 40, 15, { x: 600 }), line("Orange Blossom", 60, 45), line("Coffee", 130, 15)), empty()).fields.name, undefined);
});

test("the complete stacked wordmark is excluded while a single-word product is recovered", () => {
  const source = blocks(line("NORTH", 20, 30, { width: 200 }), line("RIDGE", 52, 29, { width: 200 }),
    line("COFFEE", 85, 25, { width: 160, x: 70 }), line("Crescendo", 210, 43, { width: 210 }),
    line("Tasting notes:", 275, 14), line("Black tea, honey", 300, 14), line("WHOLE BEAN COFFEE", 350, 15), line("250g", 375, 15));
  const result = extractLabelLayout(source, { ...empty(), fields: { weight_g: 250 }, evidence: { weight_g: "250g" } });
  assert.equal(result.fields.name, "Crescendo");
  assert.equal(result.fields.roastery, "NORTH RIDGE");
  assert.equal(result.evidence.roastery, "NORTH\nRIDGE\nCOFFEE");
});

test("a corroborated coffee wordmark does not supplant a smaller single-word product", () => {
  const source = blocks(line("coffee summit", 20, 60, { width: 350 }), line("여울숲", 130, 30, { x: 170, width: 100 }),
    line("Country: Ethiopia", 170, 15, { x: 120, width: 240 }), line("Net weight: 200g", 205, 15, { x: 120, width: 240 }),
    line("Roasted at coffee summit Roastery", 260, 12, { x: 120, width: 240 }));
  for (const base of [empty(), { ...empty(), fields: { name: "coffee summit" }, evidence: { name: "coffee summit" } }]) {
    const result = extractLabelLayout(source, base);
    assert.equal(result.fields.name, "여울숲");
    assert.equal(result.fields.roastery, "coffee summit");
  }
});

test("ordinary single-word headings require package evidence and cannot win a tie", () => {
  for (const source of [blocks(line("Crescendo", 50, 45)), blocks(line("Crescendo", 50, 45), line("250g", 115, 15)),
    blocks(line("Crescendo", 50, 45), line("Nightfall", 190, 44), line("Country: Colombia", 130, 15), line("250g", 160, 15))]) {
    assert.equal(extractLabelLayout(source, empty()).fields.name, undefined);
  }
});

test("a single-word local title can belong to a metadata column without being larger than its origin line", () => {
  const base = { ...empty(), fields: { origin_country: "Kenya", weight_g: 200 }, evidence: { origin_country: "케냐 싱글오리진", weight_g: "200G" } };
  const source = blocks(line("RIVERBEND", 110, 21, { x: 50, width: 150 }), line("WASHED", 80, 21, { x: 350, width: 100 }),
    line("Tasting notes:", 200, 16, { x: 50, width: 160 }), line("Tamarind", 236, 21, { x: 50, width: 150 }),
    line("여울숲", 238, 21, { x: 350, width: 90 }), line("케냐 싱글오리진", 260, 24, { x: 325, width: 140 }),
    line("200G", 288, 20, { x: 365, width: 60 }));
  assert.equal(extractLabelLayout(source, base).fields.name, "여울숲");
});

test("expanded OCR polygons may overlap while still representing distinct stacked title lines", () => {
  const source = blocks(line("Orchard", 50, 80), line("Promise", 105, 72), line("MILK-BASED", 200, 15),
    line("Sweet fruit and creamy chocolate", 232, 18));
  const base = { ...empty(), fields: { weight_g: 200 }, evidence: { weight_g: "200g" } };
  assert.equal(extractLabelLayout(source, base).fields.name, "Orchard Promise");
});

test("weight-unit letters support a one-word title but damaged alphanumeric weights cannot support a large wordmark", () => {
  const source = blocks(line("Crescendo", 50, 45), line("Tasting notes:", 110, 15),
    line("fruity | milk chocolate", 135, 15), line("WHOLE BEAN COFFEE", 165, 15), line("Net Wt. 12 oz / 340 g", 190, 15));
  assert.equal(extractLabelLayout(source, empty()).fields.name, "Crescendo");
  const damaged = blocks(line("tropical breeze", 20, 40), line("RIDGE", 100, 90),
    line("LIGHT ROAST LEVEL", 280, 12), line("2B3g SPECIALTY COFFEE", 300, 12));
  assert.equal(extractLabelLayout(damaged, empty()).fields.name, "tropical breeze");
});

test("a large wordmark can use a smaller specialty-coffee descriptor without becoming the product", () => {
  const source = blocks(line("CLASSIC", 50, 30), line("ESPRESSO", 84, 30), line("Highland", 210, 55, { width: 310 }),
    line("SPECIALTY COFFEE", 300, 17, { width: 143 }), line("NET WT. 12 oz (340g)", 335, 17));
  const result = extractLabelLayout(source, empty());
  assert.equal(result.fields.name, "CLASSIC ESPRESSO");
  assert.equal(result.fields.roastery, "Highland");
});

test("roaster descriptors anchor a title while narrow vertical logo fragments do not become names", () => {
  const source = blocks(line("JCK", 30, 80, { width: 44 }), line("ROASTERS", 130, 30, { width: 250 }),
    line("Evening Harbor", 220, 55, { width: 280 }), line("CITRUS & DARK CHOCOLATE", 300, 15), line("NET WT 12 OZ (340g)", 350, 15));
  assert.equal(extractLabelLayout(source, empty()).fields.name, "Evening Harbor");
  assert.equal(extractLabelLayout(blocks(source[0].paragraphs[0].lines[0], source[0].paragraphs[0].lines[1],
    line("Country: Colombia", 170, 15), line("200g", 200, 15)), empty()).fields.name, undefined);
});

test("a distant one-word masthead cannot borrow metadata from a complete product title below it", () => {
  const source = blocks(line("HIGHLAND", 30, 50), line("CLASSIC ESPRESSO", 260, 25),
    line("Roasted coffee", 310, 15), line("NET WT 1 kg", 420, 15));
  assert.equal(extractLabelLayout(source, empty()).fields.name, "CLASSIC ESPRESSO");
});

test("out-of-range word confidence cannot establish a title", () => {
  for (const confidence of [-1, 101, Infinity, NaN]) {
    assert.equal(extractLabelLayout(blocks(line("Crescendo", 50, 40, { wordConfidence: confidence }),
      line("Country: Colombia", 110, 15), line("250g", 135, 15)), empty()).fields.name, undefined);
  }
});

test("an exact printed country statement resumes metadata below tasting notes", () => {
  const source = blocks(line("coffee summit", 20, 60, { width: 350 }), line("여울숲", 170, 29, { x: 170, width: 100 }),
    line("Note: Lemongrass, Brown Sugar", 235, 13, { x: 120, width: 240 }),
    line("에티오피아100%", 294, 20, { x: 160, width: 140 }), line("200 g", 321, 21, { x: 170, width: 100 }),
    line("Light", 324, 16, { x: 120, width: 40 }),
    line("Roasted at coffee summit Roastery", 380, 12, { x: 120, width: 240 }));
  const base = { ...empty(), fields: { origin_country: "Ethiopia", weight_g: 200 }, evidence: { origin_country: "에티오피아100%", weight_g: "200 g" } };
  assert.equal(extractLabelLayout(source, base).fields.name, "여울숲");
});

test("a detached badge does not interrupt or conflict with a wrapped local title", () => {
  const result = extractLabelLayout(blocks(
    line("고요한", 100, 50, { width: 260, confidence: 99 }),
    line("RESERVE", 128, 32, { x: 420, width: 170, confidence: 99 }),
    line("아침숲", 162, 48, { width: 230, confidence: 99 }),
    line("Country: Kenya", 230, 18), line("200 g", 263, 18)), countryBase("Kenya", "Country: Kenya"));
  assert.equal(result.fields.name, "고요한 아침숲");
  assert.equal(result.evidence.name, "고요한\n아침숲");
});

test("an origin caption joins its smaller product line without absorbing the flavor prose", () => {
  const result = extractLabelLayout(blocks(
    line("MEXICO", 100, 27, { width: 150, confidence: 99 }),
    line("Santa Lucia", 135, 17, { width: 175, confidence: 99 }),
    line("Chocolate hazelnut spread", 162, 16, { width: 260, confidence: 99 }),
    line("Honey caramel", 184, 16), line("285 g", 222, 15), line("Coffee", 250, 16)),
  { ...empty(), fields: { weight_g: 285 }, evidence: { weight_g: "285 g" } });
  assert.equal(result.fields.name, "MEXICO Santa Lucia");
});

test("overlapping brand polygons cannot turn the wordmark into a product", () => {
  const result = extractLabelLayout(blocks(line("MOUNTAIN", 10, 30), line("COFFEE", 38, 25),
    line("Quiet Valley", 110, 35), line("Country: Kenya", 163, 16), line("200 g", 190, 16)), countryBase("Kenya", "Country: Kenya"));
  assert.equal(result.fields.name, "Quiet Valley");
  assert.equal(result.fields.roastery, "MOUNTAIN");
});

test("a product between its cultivar and weight does not borrow a footer logo", () => {
  const result = extractLabelLayout(blocks(line("Geisha", 20, 25), line("Los Pinos", 66, 30),
    line("200 g", 111, 16), line("Distant Ridge", 153, 40)),
  { ...empty(), fields: { varietal: "Geisha", weight_g: 200 }, evidence: { varietal: "Geisha", weight_g: "200 g" } });
  assert.equal(result.fields.name, "Los Pinos");
});

test("a clear adjacent bilingual reading can win over a degraded transcription of the same origin", () => {
  const result = extractLabelLayout(blocks(line("르완다 푸른언덕 부르롱 워시드", 20, 36, { confidence: 89, width: 470 }),
    line("Rwanda Blue Hill Bourbon Washed", 68, 25, { confidence: 99, width: 470 }),
    line("Country: Rwanda", 113, 16), line("250 g", 140, 16)), countryBase("Rwanda", "Country: Rwanda"));
  assert.equal(result.fields.name, "Rwanda Blue Hill Bourbon Washed");
});

test("transcription confidence cannot decide between contradictory country headings", () => {
  for (const metadata of [[], [line("Ethiopia 에티오피아", 270, 16)]]) {
    const source = countryCard(undefined, undefined, metadata);
    for (const row of source[0].paragraphs[0].lines.slice(0, 2)) {
      row.confidence = 88;
      for (const word of row.words) word.confidence = 88;
    }
    assert.equal(extractLabelLayout(source, countryBase("Ethiopia", "Ethiopia 에티오피아")).fields.name, undefined);
  }
});

test("a proven non-product base name is cleared even if no replacement title is readable", () => {
  const base = { ...empty(), fields: { name: "MOUNTAIN" }, evidence: { name: "MOUNTAIN" } };
  const original = structuredClone(base);
  const result = extractLabelLayout(blocks(line("MOUNTAIN", 10, 30), line("COFFEE", 50, 25)), base);
  assert.equal(result.fields.name, undefined);
  assert.equal(result.evidence.name, undefined);
  assert.deepEqual(base, original);
});

test("a compact country heading is supported by its explicit local origin and independent coffee detail", () => {
  const base = { ...countryBase("Rwanda", "Origin: Rwanda"), fields: { origin_country: "Rwanda", varietal: "Bourbon", process_method: "washed" },
    evidence: { origin_country: "Origin: Rwanda", varietal: "Bourbon", process_method: "Process: Washed" } };
  const title = [line("Rwanda Green Valley", 50, 13, { confidence: 99, width: 180 }),
    line("Bourbon Washed", 67, 13, { confidence: 97, width: 140 })];
  const body = [line("Bourbon", 104, 11), line("Process: Washed", 124, 11), line("Origin: Rwanda", 148, 11, { confidence: 84 })];
  assert.equal(extractLabelLayout(blocks(...title, ...body), base).fields.name, "Rwanda Green Valley Bourbon Washed");
  assert.equal(extractLabelLayout(blocks(...title, ...body.slice(0, 2)), base).fields.name, undefined);
  assert.equal(extractLabelLayout(blocks(...title, line("Origin: Rwanda", 148, 11)), countryBase("Rwanda", "Origin: Rwanda")).fields.name, undefined);
  const blurredOrigin = body.map(row => structuredClone(row));
  blurredOrigin[2].confidence = 70;
  for (const word of blurredOrigin[2].words) word.confidence = 70;
  assert.equal(extractLabelLayout(blocks(...title, ...blurredOrigin), base).fields.name, undefined);
});

test("compatible compact bilingual headings select one printed language without joining translations", () => {
  const base = { ...empty(), fields: { origin_country: "Rwanda", varietal: "Bourbon" },
    evidence: { origin_country: "Origin: Rwanda", varietal: "Bourbon" } };
  const source = blocks(line("Rwanda Green Valley", 50, 13, { confidence: 99, width: 180 }),
    line("Bourbon Washed", 67, 13, { confidence: 99, width: 140 }),
    line("르완다 푸른 계곡 부르봉 워시드", 84, 13, { confidence: 99, width: 180 }),
    line("Bourbon", 120, 11), line("Origin: Rwanda", 148, 11));
  // Country, process and the same adjacent heading area permit one source reading.
  // Differing countries, methods and separated products remain negative tests above.
  assert.equal(extractLabelLayout(source, base).fields.name, "Rwanda Green Valley Bourbon Washed");
});

test("a compact second language starts its own title and preserves the more readable source", () => {
  const rows = [line("Brazil Mountain", 50, 25, { confidence: 99, width: 230 }),
    line("Summit Natural", 79, 25, { confidence: 99, width: 210 }),
    line("브라질푸른산내추럴", 110, 27, { confidence: 96, width: 240 }),
    line("Country: Brazil", 160, 15), line("200 g", 190, 15)];
  // The two English continuation rows form one name; the Korean repetition
  // starts a separate heading even when OCR omitted every word space.
  for (const ordered of [rows, [...rows].reverse(), [rows[2], rows[4], rows[1], rows[0], rows[3]]]) {
    const result = extractLabelLayout(blocks(...ordered), countryBase("Brazil", "Country: Brazil"));
    assert.equal(result.fields.name, "Brazil Mountain Summit Natural");
    assert.equal(result.evidence.name, "Brazil Mountain\nSummit Natural");
  }
});

test("a small confidence difference between compatible adjacent language versions is enough", () => {
  const source = blocks(line("콜롬비아", 50, 40, { confidence: 94.5, width: 140 }),
    line("초록언덕 디카페인", 88, 34, { confidence: 99, width: 250 }),
    line("Colombia Green Hill Decaf", 128, 25, { confidence: 98, width: 290 }),
    line("Country: Colombia", 175, 15), line("200 g", 200, 15));
  assert.equal(extractLabelLayout(source, countryBase("Colombia", "Country: Colombia")).fields.name, "Colombia Green Hill Decaf");
});

test("conflicting processes cannot be overruled by confidence or a missing space", () => {
  for (const koreanTitle of ["르완다푸른언덕워시드", "르완다 푸른언덕 워시드"]) {
    const source = blocks(line(koreanTitle, 50, 30, { confidence: 88, width: 300 }),
      line("Rwanda Green Hill Natural", 90, 28, { confidence: 99, width: 300 }),
      line("Country: Rwanda", 145, 15), line("200 g", 175, 15));
    assert.equal(extractLabelLayout(source, countryBase("Rwanda", "Country: Rwanda")).fields.name, undefined);
  }
});

test("equal-country bilingual headings on separate products cannot disambiguate each other", () => {
  for (const second of [line("르완다 푸른언덕 워시드", 250, 30, { confidence: 99, width: 300 }),
    line("르완다 푸른언덕 워시드", 50, 30, { confidence: 99, width: 300, x: 550 })]) {
    const source = blocks(line("Rwanda Green Hill Washed", 50, 30, { confidence: 99, width: 300 }), second,
      line("Country: Rwanda", 105, 15, { width: 300 }), line("Country: Rwanda", second.bbox.y1 + 25, 15, { x: second.bbox.x0, width: 300 }));
    assert.equal(extractLabelLayout(source, countryBase("Rwanda", "Country: Rwanda")).fields.name, undefined);
  }
});

test("a broad geographic badge in another column does not compete with the coffee title", () => {
  for (const geography of ["CENTRAL AMERICA", "EAST AFRICA", "남아메리카"]) {
    const result = extractLabelLayout(blocks(line("Mountain", 70, 30, { width: 250 }),
      line("Passage", 105, 28, { width: 250 }), line("Country: Colombia", 155, 15, { width: 250 }),
      line("Process: Washed", 180, 15, { width: 250 }), line(geography, 170, 35, { x: 450, width: 250 }),
      line("Single origin", 230, 17, { x: 450, width: 250 })), countryBase("Colombia", "Country: Colombia"));
    assert.equal(result.fields.name, "Mountain Passage", geography);
  }
});

test("a source-backed roast classification anchors a single-word title without lending context to a distant slogan", () => {
  const source = blocks(line("Awaken", 80, 40, { width: 200, confidence: 98 }),
    line("Solstice", 180, 50, { width: 280, confidence: 99 }),
    line("MEDIUM ROAST BLEND", 395, 18, { width: 280 }), line("WHOLE BEAN COFFEE NET WT. 250g", 423, 18, { width: 280 }));
  const base = { ...empty(), bean_type: "blend", fields: { roast_level: "medium" }, evidence: { roast_level: "MEDIUM ROAST BLEND" } };
  assert.equal(extractLabelLayout(source, base).fields.name, "Solstice");
  const distantEvidence = { ...base, evidence: { roast_level: "Other source" } };
  assert.notEqual(extractLabelLayout(source, distantEvidence).fields.name, "Solstice");
});

function vertical(text, y, x = 500) {
  return { ...line(text, y, 150, { x, width: 32, confidence: 99 }), orientation: "vertical", fontSize: 32 };
}

test("vertical text uses its printed character thickness while adjacent columns remain separate", () => {
  const title = vertical("Solstice", 70);
  const source = blocks(title, vertical("Cocoa, Plum", 70, 450),
    line("Country: Rwanda", 265, 15, { x: 450, width: 250 }), line("Process: Washed", 290, 15, { x: 450, width: 250 }));
  assert.equal(extractLabelLayout(source, empty()).fields.name, "Solstice");
  assert.equal(extractLabelLayout(blocks(title, vertical("Nightfall", 70, 580), ...source[0].paragraphs[0].lines.slice(2)), empty()).fields.name, undefined);
});

test("invalid vertical font-size metadata cannot enlarge or recover a title", () => {
  for (const fontSize of [undefined, null, 0, -1, NaN, Infinity, 1000]) {
    const source = blocks({ ...vertical("Solstice", 70), fontSize }, line("Country: Rwanda", 265, 15, { x: 450, width: 250 }));
    assert.equal(extractLabelLayout(source, empty()).fields.name, undefined, String(fontSize));
  }
});

test("an inferred generic base name is reconsidered only when its exact source row proves the category", () => {
  const base = { ...empty(), bean_type: "blend", fields: { name: "MEDIUM ROAST BLEND", roastery: "Existing", roast_level: "medium" },
    evidence: { name: "MEDIUM ROAST BLEND", roastery: "Roaster: Existing", roast_level: "MEDIUM ROAST BLEND" } };
  const rows = [line("Solstice", 100, 40), line("MEDIUM ROAST BLEND", 225, 18), line("250g", 255, 18)];
  const original = structuredClone(base);
  assert.equal(extractLabelLayout(blocks(...rows), base).fields.name, "Solstice");
  assert.deepEqual(base, original);
  const explicit = { ...base, evidence: { ...base.evidence, name: "Product: MEDIUM ROAST BLEND" } };
  assert.strictEqual(extractLabelLayout(blocks(...rows), explicit), explicit);
  const unsupported = blocks(rows[0], line("LIGHT ROAST", 225, 18), rows[2]);
  assert.strictEqual(extractLabelLayout(unsupported, base), base);
});

test("two independently typed footer rows support a vertical title beyond the single-row distance", () => {
  const title = vertical("Solstice", 70);
  const region = line("Region: Tolima", 365, 15, { x: 450, width: 250 });
  const process = line("Process: Washed", 384, 15, { x: 450, width: 250 });
  const source = blocks(title, region, process);
  assert.equal(extractLabelLayout(source, empty()).fields.name, "Solstice");
  const originals = structuredClone(source);
  assert.equal(extractLabelLayout(blocks(process, title, region), empty()).fields.name, "Solstice");
  assert.deepEqual(source, originals);
  for (const details of [[region], [region, { ...region, bbox: { ...region.bbox, y0: 384, y1: 399 } }],
    [region, line("Region: Huila", 384, 15, { x: 450, width: 250 })],
    [line("Process: Washed", 365, 15, { x: 450, width: 250 }), line("Process: White Honey", 384, 15, { x: 450, width: 250 })],
    [region, line("Process: Washed", 384, 15, { x: 850, width: 250 })],
    [region, line("Process: Washed", 800, 15, { x: 450, width: 250 })],
    [region, line("Process: Washed", 384, 15, { x: 450, width: 250, confidence: 70 })]]) {
    assert.equal(extractLabelLayout(blocks(title, ...details), empty()).fields.name, undefined);
  }
  // Merely tall, narrow logo boxes do not acquire vertical-reading semantics.
  const unclassified = { ...title }; delete unclassified.orientation; delete unclassified.fontSize;
  assert.equal(extractLabelLayout(blocks(unclassified, region, process), empty()).fields.name, undefined);
});
