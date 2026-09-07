import assert from "node:assert/strict";
import test from "node:test";
import { extractLabelListLayout, mergeLabelListLayout } from "../src/lib/coffee/bean-label-list-layout.ts";
import { parseBeanLabelText } from "../src/lib/coffee/bean-label-parser.ts";
import { extractLabelPolygons } from "../src/lib/coffee/bean-label-polygons.ts";

const row = (text, x = 40, y = 40, width = 180, height = 20, confidence = 96) => {
  const bbox = { x0: x, y0: y, x1: x + width, y1: y + height };
  return { text, bbox, confidence, words: [{ text, bbox: { ...bbox }, confidence }] };
};
const stack = (lines, x = 40, y = 40) => lines.map((text, index) => row(text, x, y + index * 24));
const flavors = () => stack(["Blueberry,", "Caramel,", "Vanilla"]);
const noNotes = rows => assert.equal(extractLabelListLayout(rows).tasting_notes, undefined);
const noVariety = rows => assert.equal(extractLabelListLayout(rows).fields.varietal, undefined);

test("coffee categories and continental labels terminate a vertical cup-note list", () => {
  for (const boundary of ["SINGLE ORIGIN", "BLEND", "LATIN AMERICA", "EAST AFRICA", "싱글 오리진", "블렌드", "아시아"]) {
    const result = extractLabelListLayout(stack(["NOTES", "BLUEBERRY PIE", "COCOA", boundary, "200g"]));
    assert.deepEqual(result.tasting_notes?.en, ["BLUEBERRY PIE", "COCOA"], boundary);
    assert.deepEqual(result.tasting_notes?.ko, [], boundary);
  }
});

test("printed commas connect nearby flavor rows while preserving every original phrase", () => {
  const rows = flavors(), before = structuredClone(rows);
  const result = extractLabelListLayout(rows);
  assert.deepEqual(result.tasting_notes, { en: ["Blueberry", "Caramel", "Vanilla"], ko: [] });
  assert.deepEqual(result.tasting_notes_evidence, ["Blueberry, Caramel, Vanilla"]);
  assert.deepEqual(result.fields, {});
  assert.deepEqual(rows, before);
});

test("center-aligned columns may vary in width and have overlapping OCR bounds", () => {
  const rows = [row("Blueberry,", 80, 40, 100), row("Caramel,", 105, 57, 50), row("Vanilla", 65, 74, 130)];
  const result = extractLabelListLayout(rows.reverse());
  assert.deepEqual(result.tasting_notes.en, ["Blueberry", "Caramel", "Vanilla"]);
});

test("shared flavor vocabulary anchors whole lists without spelling correction", () => {
  const first = extractLabelListLayout(stack(["MAPLE SYRUP,", "RAISIN,", "TANGERINE PEEL,", "CACAO"]));
  assert.deepEqual(first.tasting_notes.en, ["MAPLE SYRUP", "RAISIN", "TANGERINE PEEL", "CACAO"]);
  const second = extractLabelListLayout(stack(["PEONY,", "WHITE NECTARINE,", "EARL GREY,", "VIBRANT"]));
  assert.deepEqual(second.tasting_notes.en, ["PEONY", "WHITE NECTARINE", "EARL GREY", "VIBRANT"]);
  const literal = extractLabelListLayout(stack(["Blueberry,", "Caramel,", "Nectarlne"]));
  assert.deepEqual(literal.tasting_notes.en, ["Blueberry", "Caramel", "Nectarlne"]);
  assert.doesNotMatch(literal.tasting_notes_evidence[0], /Nectarine/u);
});

test("all entries of a known comma-separated varietal list remain attached", () => {
  const rows = stack(["CATURRA,", "CATUAI,", "TYPICA"]);
  const result = extractLabelListLayout(rows);
  assert.equal(result.fields.varietal, "CATURRA, CATUAI, TYPICA");
  assert.equal(result.evidence.varietal, "CATURRA, CATUAI, TYPICA");
  assert.equal(result.tasting_notes, undefined);
});

test("a comma-free pair must match one complete shared varietal phrase", () => {
  for (const [lines, expected] of [[["Pink", "Bourbon"], "Pink Bourbon"], [["LOCAL", "LANDRACES"], "LOCAL LANDRACES"], [["Mundo", "Novo"], "Mundo Novo"]]) {
    assert.equal(extractLabelListLayout(stack(lines)).fields.varietal, expected);
  }
  for (const lines of [["Pink", "Sunrise"], ["Local", "Producer"], ["L0CAL", "LANDRACES"], ["Landraces", "Local"], ["Blueberry", "Caramel"]]) noVariety(stack(lines));
  noNotes(stack(["Blueberry", "Caramel"]));
});

test("interleaved rows in a separate column never join the list", () => {
  const rows = [...flavors(), ...stack(["Product: Other coffee", "Country: Brazil", "Process: Washed"], 400, 40)];
  assert.deepEqual(extractLabelListLayout(rows).tasting_notes.en, ["Blueberry", "Caramel", "Vanilla"]);
  noNotes([row("Blueberry,", 40, 40), row("Caramel,", 400, 64), row("Vanilla", 40, 88)]);
  noVariety([row("Pink", 40, 40), row("Bourbon", 400, 64)]);
});

test("a wide row cannot bridge an otherwise separate column", () => {
  noNotes([row("Blueberry,", 40, 40, 100), row("Caramel,", 40, 64, 500), row("Vanilla", 430, 88, 100)]);
});

test("a list cannot skip an indented heading, prose, or unreadable row", () => {
  for (const text of ["Product: Another Coffee", "Country: Brazil", "with your favorite coffee", "Uncertain text"]) {
    noNotes([...flavors(), row(text, 80, 60, 100, 8, text === "Uncertain text" ? 40 : 96)]);
  }
  noVariety([row("Pink"), row("Uncertain text", 80, 60, 100, 8, 40), row("Bourbon", 40, 80)]);
});

test("recipe, ingredients, and promotional sections cannot acquire flavor anchors", () => {
  for (const text of ["Recipe", "Ingredients", "Nutrition", "Discount", "레시피"]) noNotes([row(text, 80, 10, 120), ...flavors()]);
  assert.deepEqual(extractLabelListLayout([row("Recipe", 400, 10), ...flavors()]).tasting_notes.en, ["Blueberry", "Caramel", "Vanilla"]);
  noNotes(stack(["Blueberry,", "Caramel,", "Enjoy this coffee"]));
});

test("metadata values cannot be appended as a flavor or moved from another row", () => {
  for (const final of ["Washed", "Brazil", "250g", "Bourbon", "Medium roast"]) noNotes(stack(["Blueberry,", "Caramel,", final]));
  assert.deepEqual(extractLabelListLayout(stack(["Blueberry,", "Caramel,", "Honey"])).tasting_notes.en, ["Blueberry", "Caramel", "Honey"]);
});

test("a dangling comma, damaged separator, or distant continuation stays incomplete", () => {
  noNotes(stack(["Blueberry,", "Caramel,"]));
  noNotes(stack(["Blueberry,", ", Caramel", "Vanilla"]));
  noNotes(stack(["Blueberry,", "Caramel,,", "Vanilla"]));
  noNotes([row("Blueberry,"), row("Caramel,", 40, 140), row("Vanilla", 40, 164)]);
});

test("low-confidence words and missing early entries cannot leave a complete-looking suffix", () => {
  for (let index = 0; index < 3; index += 1) {
    const rows = flavors(); rows[index].words[0].confidence = 60; noNotes(rows);
  }
  const rows = flavors();
  rows[0].words = [{ text: "Blueberry", bbox: { x0: 40, y0: 40, x1: 180, y1: 60 }, confidence: 99 },
    { text: ",", bbox: { x0: 181, y0: 40, x1: 220, y1: 60 }, confidence: 40 }];
  noNotes(rows);
});

test("two independent lists cannot be combined into a new global list", () => {
  noNotes([...flavors(), ...stack(["Peach,", "Honey,", "Vanilla"], 400)]);
  noVariety([...stack(["Pink", "Bourbon"]), ...stack(["Mundo", "Novo"], 400)]);
});

test("malformed geometry, source mismatches, and input limits cannot provide evidence", () => {
  for (const input of [null, {}, [null], Array(301).fill(row("Blueberry,"))]) noNotes(input);
  for (const mutate of [entry => { entry.text = "Honey,"; }, entry => { entry.words = []; }, entry => { entry.confidence = Infinity; },
    entry => { entry.bbox.x1 = 0; }, entry => { entry.words[0].bbox.x1 = 100_001; }, entry => { entry.text += "\u202e"; }]) {
    const rows = flavors(); mutate(rows[0]); noNotes(rows);
  }
});

test("complete source-backed varietal lists replace a lexical last-row subset", () => {
  const rows = stack(["Caturra,", "Catuai,", "Typica"]);
  const base = parseBeanLabelText("Typica");
  assert.equal(base.fields.varietal, "Typica");
  const before = structuredClone(base), merged = mergeLabelListLayout(rows, base);
  assert.equal(merged.fields.varietal, "Caturra, Catuai, Typica");
  assert.equal(merged.evidence.varietal, "Caturra, Catuai, Typica");
  assert.deepEqual(base, before);
  const pair = stack(["Pink", "Bourbon"]);
  assert.equal(mergeLabelListLayout(pair, parseBeanLabelText("Pink\nBourbon")).fields.varietal, "Pink Bourbon");
});

test("a matching variety value from a different source quote is still a conflict", () => {
  const rows = stack(["Caturra,", "Catuai,", "Typica"]);
  for (const [value, evidence] of [["Typica", "Variety: Typica"], ["Typica", "Catuai,"], ["Typica", "Other photo Typica"], ["Bourbon", "Typica"], ["Caturra, Caturra", "Caturra,"]]) {
    const base = { bean_type: "unknown", fields: { varietal: value }, evidence: { varietal: evidence } };
    assert.equal(mergeLabelListLayout(rows, base).fields.varietal, undefined);
  }
  const pair = stack(["Pink", "Bourbon"]);
  assert.equal(mergeLabelListLayout(pair, { bean_type: "unknown", fields: { varietal: "Bourbon" }, evidence: { varietal: "Pink" } }).fields.varietal, undefined);
});

test("a separate headed field cannot borrow the complete list's geometry", () => {
  const rows = [...stack(["Caturra,", "Catuai,", "Typica"]), row("Variety: Typica", 400, 64)];
  const base = parseBeanLabelText("Variety: Typica");
  assert.equal(mergeLabelListLayout(rows, base).fields.varietal, undefined);
  const duplicateQuote = [...stack(["Caturra,", "Catuai,", "Typica"]), row("Typica", 400, 64)];
  assert.equal(mergeLabelListLayout(duplicateQuote, parseBeanLabelText("Typica")).fields.varietal, undefined);
});

test("list merging preserves unrelated fields and does not add a global blend variety", () => {
  const base = parseBeanLabelText("Product: Copper Moon\nCountry: Guatemala\nNet weight: 250g");
  const merged = mergeLabelListLayout(flavors(), base);
  assert.deepEqual(merged.fields, base.fields);
  assert.deepEqual(merged.tasting_notes.en, ["Blueberry", "Caramel", "Vanilla"]);
  const blend = { bean_type: "blend", fields: {}, evidence: {} };
  assert.equal(mergeLabelListLayout(stack(["Pink", "Bourbon"]), blend).fields.varietal, undefined);
});

test("the polygon adapter keeps a wrapped list and the other column's origin separate", () => {
  const source = [...stack(["Caturra,", "Catuai,", "Typica"], 400), ...flavors(), row("Country: Guatemala", 400, 140)];
  const items = source.map(({ text, bbox, confidence }) => ({ text, score: confidence / 100,
    poly: [[bbox.x0, bbox.y0], [bbox.x1, bbox.y0], [bbox.x1, bbox.y1], [bbox.x0, bbox.y1]] }));
  const result = extractLabelPolygons({ items }).extraction;
  assert.equal(result.fields.varietal, "Caturra, Catuai, Typica");
  assert.equal(result.fields.origin_country, "Guatemala");
  assert.deepEqual(result.tasting_notes.en, ["Blueberry", "Caramel", "Vanilla"]);
});

test("a bare notes heading owns a compact right-aligned vertical list", () => {
  const rows = [row("NOTES", 897, 1064, 94, 33), row("BLUEBERRY PIE", 824, 1121, 165, 23),
    row("COCOA", 919, 1148, 70, 21), row("CANDIED PECAN", 819, 1173, 170, 21),
    row("MEDIUM ROAST BLEND", 569, 1209, 251, 22), row("Product: Other coffee", 500, 1130, 200)];
  const before = structuredClone(rows), result = extractLabelListLayout(rows);
  assert.deepEqual(result.tasting_notes, { en: ["BLUEBERRY PIE", "COCOA", "CANDIED PECAN"], ko: [] });
  assert.deepEqual(result.tasting_notes_evidence, ["NOTES BLUEBERRY PIE COCOA CANDIED PECAN"]);
  assert.deepEqual(result.fields, {});
  assert.deepEqual(rows, before);
});

test("two exact flavors in an unheaded first row anchor a nearby vertical continuation", () => {
  const rows = [row("RED APPLE• MILK CHOCOLATE", 573, 993, 251, 17), row("CANDIED ORANGE", 624, 1013, 152, 19),
    row("VARIETY", 741, 926, 62, 17), row("VARIOUS", 743, 944, 58, 18), row("LATIN", 908, 1034, 82, 34)];
  const result = extractLabelListLayout(rows);
  assert.deepEqual(result.tasting_notes.en, ["RED APPLE", "MILK CHOCOLATE", "CANDIED ORANGE"]);
  assert.deepEqual(result.tasting_notes_evidence, ["RED APPLE• MILK CHOCOLATE CANDIED ORANGE"]);
  noNotes(stack(["BLUEBERRY PIE", "COCOA", "CANDIED PECAN"]));
  noNotes(stack(["RED APPLE• Unknown", "CANDIED ORANGE"]));
});

test("explicit vertical notes retain unknown printed phrases without dictionary correction", () => {
  const result = extractLabelListLayout(stack(["Cup notes:", "Peony Custard", "Nectarlne"]));
  assert.deepEqual(result.tasting_notes.en, ["Peony Custard", "Nectarlne"]);
  assert.deepEqual(result.tasting_notes_evidence, ["Cup notes: Peony Custard Nectarlne"]);
  assert.deepEqual(extractLabelListLayout(stack(["컵 노트", "청사과", "꿀"])).tasting_notes.ko, ["청사과", "꿀"]);
});

test("vertical notes never skip damaged or low-confidence boundaries to collect a suffix", () => {
  for (let index = 0; index < 4; index++) {
    const rows = stack(["NOTES", "BLUEBERRY PIE", "COCOA", "CANDIED PECAN"]);
    rows[index].confidence = rows[index].words[0].confidence = 40;
    noNotes(rows);
  }
  for (const damaged of ["Unknown@text", "COCOA••", ", COCOA", "COCOA,,", "COCOA• •PEACH"]) {
    noNotes(stack(["NOTES", "BLUEBERRY PIE", damaged, "RED APPLE• MILK CHOCOLATE", "CANDIED ORANGE"]));
  }
  noNotes(stack(["NOTES", "BLUEBERRY PIE", "COCOA,"]));
  noNotes([...stack(["NOTES", "BLUEBERRY PIE", "COCOA"]), row("Uncertain", 80, 108, 80, 8, 40), row("CANDIED PECAN", 40, 120)]);
  const splitWord = stack(["NOTES", "BLUEBERRY PIE", "COCOA", "CANDIED PECAN"]);
  splitWord[2].words[0].confidence = 40;
  noNotes(splitWord);
});

test("an unheaded list cannot use one language's vocabulary to endorse another", () => {
  noNotes(stack(["RED APPLE• MILK CHOCOLATE", "미확인 문구"]));
  noNotes(stack(["청사과• 밀크초콜릿", "Unrelated Phrase"]));
  noNotes(stack(["RED APPLE• MILK CHOCOLATE• 미확인", "CANDIED ORANGE"]));
});

test("vertical notes stop at metadata and do not borrow another column or promotion", () => {
  for (const boundary of ["Washed", "Bourbon", "Brazil", "250g", "Product: Blue Moon", "Enjoy this coffee", "SALE"]) {
    const result = extractLabelListLayout(stack(["NOTES", "BLUEBERRY PIE", "COCOA", boundary, "CANDIED PECAN"]));
    assert.deepEqual(result.tasting_notes?.en, ["BLUEBERRY PIE", "COCOA"]);
  }
  for (const heading of ["PRODUCT NOTES", "NOTES FOR BREWING", "Recipe", "Ingredients"]) noNotes(stack([heading, "BLUEBERRY PIE", "COCOA"]));
  noNotes([row("NOTES", 40, 10), row("BLUEBERRY PIE", 400, 40), row("COCOA", 400, 64)]);
  noNotes([row("NOTES", 40, 10, 100), row("BLUEBERRY PIE", 40, 40, 100), row("COCOA", 40, 64, 500), row("CANDIED PECAN", 430, 88, 100)]);
  const honey = extractLabelListLayout(stack(["NOTES", "BLUEBERRY PIE", "Honey"]));
  assert.deepEqual(honey.tasting_notes.en, ["BLUEBERRY PIE", "Honey"]);
});

test("a complete vertical note list merges without modifying other fields", () => {
  const rows = stack(["NOTES", "BLUEBERRY PIE", "COCOA", "CANDIED PECAN"]);
  const base = parseBeanLabelText("Product: Copper Moon\nCountry: Guatemala\nNOTES\nBLUEBERRY PIE");
  const before = structuredClone(base), result = mergeLabelListLayout(rows, base);
  assert.deepEqual(result.fields, base.fields);
  assert.deepEqual(result.tasting_notes.en, ["BLUEBERRY PIE", "COCOA", "CANDIED PECAN"]);
  assert.deepEqual(base, before);
});
