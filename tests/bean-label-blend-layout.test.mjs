import assert from "node:assert/strict";
import test from "node:test";
import { extractLabelBlendLayout } from "../src/lib/coffee/bean-label-blend-layout.ts";

const row = (text, x, y, width = 240, height = 20, confidence = 96) => {
  const bbox = { x0: x, y0: y, x1: x + width, y1: y + height };
  return { text, bbox, confidence, words: [{ text, bbox: { ...bbox }, confidence }] };
};
const stack = (share, lot, country, processing, x = 40, y = 40) => [
  row(`${share}% ${lot}`, x, y), row(country, x, y + 24), row(`Process: ${processing}`, x, y + 48),
];
const valid = () => [...stack(50, "Lot A", "Place A, Guatemala", "Washed"),
  ...stack(50, "Lot B", "Place B, Costa Rica", "White Honey", 40, 120)];
const noBlend = rows => {
  const result = extractLabelBlendLayout(rows);
  assert.equal(result.bean_type, "unknown");
  assert.deepEqual(result.fields, {});
  assert.equal(result.composition_lines, undefined);
};

test("three-line components retain exact printed descriptions without inventing place or lot roles", () => {
  const source = valid(), before = structuredClone(source);
  const result = extractLabelBlendLayout(source);
  assert.equal(result.bean_type, "blend");
  assert.deepEqual(result.fields, { process_method: "other", process_detail: "Washed 50% / White Honey 50%", blend_components: [
    { origin_country: "Guatemala", percentage: 50, sort_order: 0, process_method: "washed", process_detail: "Washed" },
    { origin_country: "Costa Rica", percentage: 50, sort_order: 1, process_method: "honey", process_detail: "White Honey" },
  ] });
  assert.deepEqual(result.composition_lines, [
    "50% Lot A / Place A, Guatemala / Process: Washed",
    "50% Lot B / Place B, Costa Rica / Process: White Honey",
  ]);
  assert.equal(result.evidence.blend_components, result.composition_lines.join(" / "));
  assert.deepEqual(source, before);
});

// Verbatim development OCR rows; this is a regression fixture, not held-out
// accuracy evidence. Polygons, scores, and differing lot spellings stay intact.
const development = {
  chromium: [
    ["50% Chacayd", [[394, 937], [455, 940], [454, 954], [393, 951]], .9745072722434998],
    ["Solola, Guatemala", [[394, 947], [469, 947], [469, 961], [394, 961]], .9820826474358054],
    ["Process: Washed", [[394, 956], [467, 958], [466, 972], [393, 970]], .9899844169616699],
    ["50% Puente Tarrazd", [[393, 976], [478, 974], [478, 988], [394, 990]], .9337897722919782],
    ["Tarraza, Costa Rica", [[395, 984], [472, 985], [472, 1000], [394, 998]], .9438956505373904],
    ["Process: White Honey", [[394, 994], [484, 995], [484, 1010], [393, 1008]], .9830143332481385],
  ],
  webkit: [
    ["Solola, Guatemala", [[394, 947], [469, 947], [469, 961], [394, 961]], .9817847083596623],
    ["50% Chacayd", [[395, 940], [454, 940], [454, 951], [395, 951]], .9662697911262512],
    ["Process: Washed", [[394, 956], [467, 958], [466, 972], [393, 970]], .9899601260821025],
    ["50% Puente Tarraza", [[393, 976], [478, 974], [478, 988], [394, 990]], .9347655442025926],
    ["Tarraza, Costa Rica", [[395, 984], [472, 985], [472, 1000], [394, 998]], .9457461112423947],
    ["Process: White Honey", [[394, 994], [483, 995], [483, 1010], [393, 1008]], .984461534023285],
  ],
};
for (const [browser, source] of Object.entries(development)) {
  test(`${browser} development polygons preserve overlapping rows and OCR spellings`, () => {
    const rows = source.map(([text, poly, score]) => {
      const xs = poly.map(point => point[0]), ys = poly.map(point => point[1]);
      return row(text, Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), score * 100);
    });
    const result = extractLabelBlendLayout(rows);
    assert.deepEqual(result.fields.blend_components.map(component => [component.origin_country, component.percentage, component.process_method]),
      [["Guatemala", 50, "washed"], ["Costa Rica", 50, "honey"]]);
    const secondLot = browser === "chromium" ? "Puente Tarrazd" : "Puente Tarraza";
    assert.deepEqual(result.composition_lines, ["50% Chacayd / Solola, Guatemala / Process: Washed",
      `50% ${secondLot} / Tarraza, Costa Rica / Process: White Honey`]);
    assert.equal(result.fields.process_method, "other");
    assert.equal(result.fields.process_detail, "Washed 50% / White Honey 50%");
    assert.equal(result.fields.farm_producer, undefined);
    assert.equal(result.fields.origin_region, undefined);
    assert.equal(result.fields.origin_country, undefined);
  });
}

test("source order and modest coordinate scaling do not change component ownership", () => {
  const original = valid();
  const transformed = original.map(entry => {
    const transform = bounds => Object.fromEntries(Object.entries(bounds).map(([key, value]) => [key, value * 1.75 + 110]));
    return { ...entry, bbox: transform(entry.bbox), words: entry.words.map(word => ({ ...word, bbox: transform(word.bbox) })) };
  }).reverse();
  assert.deepEqual(extractLabelBlendLayout(transformed), extractLabelBlendLayout(original));
});

test("complete component methods produce an explicit mixed-process summary", () => {
  const rows = [...stack(35, "Lot A", "Guatemala", "Natural"), ...stack(65, "Lot B", "Costa Rica", "Washed", 40, 120)];
  const result = extractLabelBlendLayout(rows);
  assert.deepEqual(result.fields.blend_components.map(component => [component.percentage, component.process_method]), [[35, "natural"], [65, "washed"]]);
  assert.equal(result.fields.process_method, "other");
  assert.equal(result.fields.process_detail, "Natural 35% / Washed 65%");
  assert.equal(result.fields.origin_country, undefined);
});

test("components sharing one method retain the method and their individual printed details", () => {
  const result = extractLabelBlendLayout([...stack(25, "Lot A", "Guatemala", "Black Honey"), ...stack(75, "Lot B", "Costa Rica", "White Honey", 40, 120)]);
  assert.equal(result.fields.process_method, "honey");
  assert.equal(result.fields.process_detail, "Black Honey 25% / White Honey 75%");
});

test("unknown processing remains source text and never becomes a guessed method", () => {
  const rows = [...stack(50, "Lot A", "Guatemala", "White H0ney"), ...stack(50, "Lot B", "Costa Rica", "Experimental Q", 40, 120)];
  const result = extractLabelBlendLayout(rows);
  assert.equal(result.fields.blend_components.length, 2);
  assert.equal(result.fields.blend_components[0].process_method, undefined);
  assert.equal(result.fields.blend_components[0].process_detail, undefined);
  assert.equal(result.fields.process_method, undefined);
  assert.equal(result.fields.process_detail, undefined);
  assert.match(result.composition_lines[0], /White H0ney/u);
  assert.match(result.composition_lines[1], /Experimental Q/u);
  const partial = extractLabelBlendLayout([...stack(50, "Lot A", "Guatemala", "Washed"), ...stack(50, "Lot B", "Costa Rica", "White H0ney", 40, 120)]);
  assert.equal(partial.fields.process_method, undefined);
  assert.equal(partial.fields.process_detail, undefined);
});

test("incomplete totals are not normalized or completed from a subset", () => {
  for (const [first, second] of [[50, 49.9], [60, 50], [0, 100], [50.001, 49.999]]) {
    noBlend([...stack(first, "Lot A", "Guatemala", "Washed"), ...stack(second, "Lot B", "Costa Rica", "Honey", 40, 120)]);
  }
  noBlend([...valid(), ...stack(20, "Lot C", "Brazil", "Natural", 40, 200)]);
  noBlend([...valid(), row("30% Lot C", 40, 200, 240, 20, 40)]);
  noBlend([...valid(), row("3O% Lot C", 40, 200, 240, 20, 40)]);
  noBlend([...valid(), row("3O% Lot C", 80, 200, 180, 20, 40)]);
  noBlend([...valid(), row("30,5% Lot C", 40, 200)]);
  noBlend([...valid(), row("Lot C", 40, 200), row("Brazil", 40, 224), row("Process: Natural", 40, 248)]);
  noBlend([...valid(), row("Brazil", 40, 200), row("Process: Natural", 40, 224)]);
  noBlend([row("Brazil", 40, 0, 240, 16), row("Process: Natural", 40, 20, 240, 16), ...valid()]);
  noBlend([row("Brazil", 80, 0, 180, 16), row("Process: Natural", 80, 20, 180, 16), ...valid()]);
});

test("missing required rows or percentage markers cannot borrow from the next lot", () => {
  for (let index = 0; index < 6; index += 1) noBlend(valid().filter((_, position) => position !== index));
  noBlend([...stack(50, "Lot A", "Guatemala", "Washed"), row("Lot B", 40, 120), row("Costa Rica", 40, 144), row("Process: Honey", 40, 168)]);
});

test("country misspellings, two countries, and country-looking product names are not repaired", () => {
  for (const text of ["Place, Guatema1a", "Guatemala / Brazil", "Costa Rica, Guatemala", "Guatemala Sunrise", "Coffee from Guatemala", "Unknown, Atlantis"]) {
    const rows = valid();
    rows[1] = row(text, 40, 64);
    noBlend(rows);
  }
  noBlend([...stack(50, "Brazil Lot A", "Guatemala", "Washed"), ...stack(50, "Lot B", "Costa Rica", "Honey", 40, 120)]);
  noBlend([...stack(50, "Lot A", "Guatemala", "Natural from Brazil"), ...stack(50, "Lot B", "Costa Rica", "Honey", 40, 120)]);
});

test("separate columns or distant product stacks cannot supply a combined composition", () => {
  noBlend([...stack(50, "Lot A", "Guatemala", "Washed"), ...stack(50, "Lot B", "Costa Rica", "Honey", 360, 40)]);
  noBlend([...stack(50, "Lot A", "Guatemala", "Washed"), ...stack(50, "Lot B", "Costa Rica", "Honey", 40, 400)]);
  const rows = valid();
  rows[1] = row("Place A, Guatemala", 360, 64);
  noBlend(rows);
});

test("a wide country row cannot bridge two columns", () => {
  noBlend([row("50% Lot A", 40, 40, 120), row("Guatemala", 40, 64, 520), row("Process: Washed", 360, 88, 200),
    ...stack(50, "Lot B", "Costa Rica", "Honey", 40, 120)]);
});

test("an intervening different product is a boundary even if its text is unreadable", () => {
  for (const confidence of [96, 40]) {
    noBlend([...valid(), row("Product: Another Coffee", 40, 108, 240, 8, confidence)]);
    noBlend([...valid(), row("Product: Another Coffee", 80, 108, 180, 8, confidence)]);
    noBlend([...valid(), row("Uncertain Text", 40, 60, 200, 8, confidence)]);
    noBlend([...valid(), row("Uncertain Text", 80, 60, 180, 8, confidence)]);
  }
  noBlend([row("50% Lot A", 40, 40), row("Brazil", 80, 64, 180), row("Guatemala", 40, 88), row("Process: Washed", 40, 112),
    ...stack(50, "Lot B", "Costa Rica", "White Honey", 40, 144)]);
});

test("a low-confidence percentage fragment cannot hide behind a strong row average", () => {
  for (let index = 0; index < 6; index += 1) {
    const rows = valid();
    rows[index].words[0].confidence = 60;
    noBlend(rows);
  }
  const rows = valid();
  rows[0].words = [
    { text: "50%", confidence: 60, bbox: { x0: 40, y0: 40, x1: 80, y1: 60 } },
    { text: "Lot A", confidence: 99, bbox: { x0: 90, y0: 40, x1: 280, y1: 60 } },
  ];
  noBlend(rows);
});

test("recipe, nutrition, and discount contexts cannot become package compositions", () => {
  for (const heading of ["Recipe", "Brewing", "Discount", "Ingredients", "레시피", "할인 정보"]) noBlend([row(heading, 40, 10), ...valid()]);
  noBlend([row("Recipe", 80, 10, 180), ...valid()]);
  for (const descriptor of ["off Lot A", "discount Lot A", "Recipe A", "Water A"]) {
    noBlend([...stack(50, descriptor, "Guatemala", "Washed"), ...stack(50, "Lot B", "Costa Rica", "Honey", 40, 120)]);
  }
  // A separate recipe column does not exclude a complete label stack.
  assert.equal(extractLabelBlendLayout([row("Recipe", 600, 10), ...valid()]).fields.blend_components.length, 2);
});

test("two complete independent groups remain ambiguous", () => {
  noBlend([...valid(), ...stack(40, "Lot C", "Brazil", "Natural", 400, 40), ...stack(60, "Lot D", "Colombia", "Washed", 400, 120)]);
  noBlend([...valid(), ...stack(40, "Lot C", "Brazil", "Natural", 400, 40)]);
});

test("duplicate detector rows and oversized or inconsistent input are rejected", () => {
  noBlend([...valid(), ...structuredClone(valid())]);
  for (const input of [null, {}, [null], Array(301).fill(row("Text", 0, 0)), [{ ...row("50% Lot A", 40, 40), confidence: NaN }]]) noBlend(input);
  for (const change of [entry => { entry.words = []; }, entry => { entry.text = "50% Rewritten Lot"; },
    entry => { entry.words[0].bbox.x1 = 100_001; }, entry => { entry.text += "\u202e"; }]) {
    const rows = valid();
    change(rows[0]);
    noBlend(rows);
  }
});
