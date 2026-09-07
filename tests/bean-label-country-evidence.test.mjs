import assert from "node:assert/strict";
import test from "node:test";
import { extractLabelCountryEvidence, findLabelCountryRegions, reprojectLabelCountryEvidence } from "../src/lib/coffee/bean-label-country-evidence.ts";
import { parseBeanLabelText } from "../src/lib/coffee/bean-label-parser.ts";

const word = (text, x0, x1, options = {}) => ({ text, confidence: 96, bbox: { x0, y0: 100, x1, y1: 140 }, ...options });
function row(words) {
  return { text: words.map(entry => entry.text).join(" "), confidence: 71,
    bbox: { x0: Math.min(...words.map(entry => entry.bbox.x0)), y0: Math.min(...words.map(entry => entry.bbox.y0)),
      x1: Math.max(...words.map(entry => entry.bbox.x1)), y1: Math.max(...words.map(entry => entry.bbox.y1)) }, words };
}
const blocks = (...lines) => [{ paragraphs: [{ lines }] }];
const country = (value = "Ethiopia", label = "국가:") => row([word(label, 400, 490), word(value, 600, 750)]);
const withNoise = () => row([
  word("-.", 285, 383, { confidence: 0, bbox: { x0: 285, y0: 1399, x1: 383, y1: 1462 } }),
  word("국가:", 679, 771, { bbox: { x0: 679, y0: 1391, x1: 771, y1: 1431 } }),
  word("Ethiopia", 897, 1066, { bbox: { x0: 897, y0: 1388, x1: 1066, y1: 1428 } }),
  word("에티오피아", 1083, 1294, { bbox: { x0: 1083, y0: 1376, x1: 1294, y1: 1423 } }),
]);
const assertEmpty = source => assert.deepEqual(extractLabelCountryEvidence(source), { text: "", blocks: [] });

test("separated low-confidence punctuation cannot hide a clear original country row", () => {
  const source = blocks(withNoise());
  const original = structuredClone(source);
  const result = extractLabelCountryEvidence(source);
  assert.equal(result.text, "국가: Ethiopia 에티오피아");
  assert.equal(parseBeanLabelText(result.text).fields.origin_country, "Ethiopia");
  const retained = result.blocks[0].paragraphs[0].lines[0];
  assert.equal(retained.confidence, 96);
  assert.deepEqual(retained.words, original[0].paragraphs[0].lines[0].words.slice(1));
  assert.deepEqual(retained.bbox, { x0: 679, y0: 1376, x1: 1294, y1: 1431 });
  assert.deepEqual(source, original);
  retained.words[0].bbox.x0 = 0;
  assert.deepEqual(source, original);
});

function repeatedSeparatorRow() {
  return row([
    word("국가:", 0, 218, { confidence: 95, bbox: { x0: 0, y0: 0, x1: 218, y1: 176 } }),
    word(":", 249, 262, { confidence: 47, bbox: { x0: 249, y0: 170, x1: 262, y1: 176 } }),
    word("Ethiopia", 470, 826, { bbox: { x0: 470, y0: 58, x1: 826, y1: 176 } }),
    word("에티오피아", 843, 1282, { confidence: 94, bbox: { x0: 843, y0: 34, x1: 1282, y1: 176 } }),
  ]);
}

test("tiny repeated country separators retain their text and coordinates without lowering lexical confidence", () => {
  const source = blocks(repeatedSeparatorRow());
  const original = structuredClone(source);
  const result = extractLabelCountryEvidence(source);
  assert.equal(result.text, "국가: : Ethiopia 에티오피아");
  assert.equal(parseBeanLabelText(result.text).fields.origin_country, "Ethiopia");
  const line = result.blocks[0].paragraphs[0].lines[0];
  assert.equal(line.confidence, 94);
  assert.deepEqual(line.words, source[0].paragraphs[0].lines[0].words);
  assert.deepEqual(source, original);
});

test("only heading-adjacent separator tokens can be excluded from lexical confidence checks", () => {
  for (const text of ["1", "x", ";"]) {
    const source = repeatedSeparatorRow();
    source.words[1].text = text;
    assertEmpty(blocks(row(source.words)));
  }
  for (const confidence of [47, 96]) {
    const source = repeatedSeparatorRow();
    source.words[1].confidence = confidence;
    source.words[1].bbox = { x0: 830, y0: 170, x1: 840, y1: 176 };
    source.words = [source.words[0], source.words[2], source.words[1], source.words[3]];
    assertEmpty(blocks(row(source.words)));
  }
  const excessive = repeatedSeparatorRow();
  excessive.words.splice(2, 0, word(":", 280, 290, { confidence: 47, bbox: { x0: 280, y0: 170, x1: 290, y1: 176 } }),
    word(":", 310, 320, { confidence: 47, bbox: { x0: 310, y0: 170, x1: 320, y1: 176 } }));
  assertEmpty(blocks(row(excessive.words)));
});

test("complete country labels are accepted without requiring or manufacturing noise", () => {
  for (const [label, value] of [["Country:", "Colombia"], ["원산지:", "에티오피아"], ["Country of origin:", "Costa Rica"], ["생산국", "Panama"]]) {
    assert.equal(extractLabelCountryEvidence(blocks(country(value, label))).text, `${label} ${value}`);
  }
});

test("leading letters, digits, readable punctuation and nearby marks are not silently removed", () => {
  for (const options of [
    { text: "개", confidence: 0 }, { text: "1", confidence: 0 }, { text: "-.", confidence: 25 },
    { text: "-.", confidence: 0, bbox: { x0: 590, y0: 1399, x1: 670, y1: 1462 } },
  ]) {
    const source = withNoise();
    source.words[0] = { ...source.words[0], ...options };
    assertEmpty(blocks(row(source.words)));
  }
});

test("only an explicit country heading can identify a country value", () => {
  for (const label of ["Varietal:", "Producer:", "Farm:", "Origin story:", "Countrywide:", "=27}:"]) assertEmpty(blocks(country("Colombia", label)));
  assertEmpty(blocks(row([word("Ethiopia", 400, 550), word("에티오피아", 600, 800)])));
});

test("country spelling, trailing prose, mixed countries and additional metadata are never repaired or dropped", () => {
  for (const value of ["Ethiopla", "Ethiopia Valley", "Ethiopia / Colombia", "Ethiopia 60%", "Ethiopia Roast: unknown", "Ethiopia Region: Sidama"])
    assertEmpty(blocks(country(value)));
  const trailing = country();
  trailing.words.push(word("coffee", 780, 880, { confidence: 0 }));
  assertEmpty(blocks(row(trailing.words)));
});

test("conflicting or explicitly unreadable country rows cannot select whichever row appears first", () => {
  for (const rows of [[country(), country("Colombia")], [country("Colombia"), country()], [country(), country("Ethiopla")]]) assertEmpty(blocks(...rows));
  const result = extractLabelCountryEvidence(blocks(country(), country(), country("에티오피아", "원산지:")));
  assert.equal(parseBeanLabelText(result.text).fields.origin_country, "Ethiopia");
  assert.equal(result.blocks.length, 2);
});

test("word confidence, order, alignment and distance must support one physical row", () => {
  const variants = [];
  const low = country(); low.words[1].confidence = 84; variants.push(row(low.words));
  const reversed = country(); reversed.words.reverse(); variants.push(row(reversed.words));
  const distant = country(); distant.words[1].bbox.x0 = 1400; distant.words[1].bbox.x1 = 1550; variants.push(row(distant.words));
  const vertical = country(); vertical.words[1].bbox.y0 = 200; vertical.words[1].bbox.y1 = 240; variants.push(row(vertical.words));
  const missing = country(); missing.text += " Colombia"; variants.push(missing);
  for (const variant of variants) assertEmpty(blocks(variant));
});

test("malformed geometry, controls and oversized containers cannot supply evidence", () => {
  for (const source of [null, {}, Array.from({ length: 101 }, () => ({ paragraphs: [] })),
    [{ paragraphs: Array.from({ length: 101 }, () => ({ lines: [] })) }],
    [{ paragraphs: [{ lines: Array.from({ length: 101 }, () => country()) }] }]]) assertEmpty(source);
  const invalid = country(); invalid.words[0].bbox.x0 = -1;
  const hidden = country(); hidden.words[0].text = "국\u202e가:";
  const unbounded = country(); unbounded.text = "x".repeat(501);
  for (const line of [invalid, row(hidden.words), unbounded, { ...country(), words: [] }]) assertEmpty(blocks(line));
});

const splitCountryRow = () => [
  { text: "=i", confidence: 23, bbox: { x0: 679, y0: 1391, x1: 771, y1: 1431 },
    words: [word("=i", 679, 771, { confidence: 23, bbox: { x0: 679, y0: 1391, x1: 771, y1: 1431 } })] },
  { text: "Ethiopia 에티오피아", confidence: 94, bbox: { x0: 897, y0: 1376, x1: 1294, y1: 1427 }, words: [
    word("Ethiopia", 897, 1066, { confidence: 93, bbox: { x0: 897, y0: 1388, x1: 1066, y1: 1427 } }),
    word("에티오피아", 1084, 1294, { bbox: { x0: 1084, y0: 1376, x1: 1294, y1: 1423 } }),
  ] },
];

test("country crop location includes the nearest damaged label without interpreting its letters", () => {
  const source = blocks(...splitCountryRow());
  const original = structuredClone(source);
  assert.deepEqual(findLabelCountryRegions(source), [{ x: 679, y: 1376, width: 615, height: 55 }]);
  assert.deepEqual(source, original);
  const [label, value] = splitCountryRow();
  label.text = "Varietal:";
  // Only pixels are selected: a later country-evidence read still has to prove
  // that this is an origin heading rather than a country-named variety.
  assert.equal(findLabelCountryRegions(blocks(label, value)).length, 1);
});

test("a product title, inline heading, misspelling or mixed country phrase is not a standalone country value", () => {
  for (const text of ["Colombia La Esperanza", "Country: Ethiopia", "Ethiopla", "Ethiopia / Colombia", "Ethiopia 60%", "Ethiopia Region: Sidama"]) {
    const [label, value] = splitCountryRow();
    value.text = text;
    value.words = [word(text, 897, 1294, { bbox: { ...value.bbox } })];
    assert.deepEqual(findLabelCountryRegions(blocks(label, value)), [], text);
  }
});

test("crop candidates require readable country words and a nearby sufficiently aligned small left label", () => {
  const variants = [];
  let pair = splitCountryRow(); pair[1].confidence = 84; variants.push(pair);
  pair = splitCountryRow(); pair[1].words[0].confidence = 79; variants.push(pair);
  pair = splitCountryRow(); pair[1].words.reverse(); variants.push(pair);
  pair = splitCountryRow(); pair[0].bbox.x0 = 0; pair[0].bbox.x1 = 100; variants.push(pair);
  pair = splitCountryRow(); pair[0].bbox.y0 = 1200; pair[0].bbox.y1 = 1240; variants.push(pair);
  pair = splitCountryRow(); pair[0].bbox.x0 = 0; variants.push(pair);
  pair = splitCountryRow(); pair[0].bbox.y0 = 1200; pair[0].bbox.y1 = 1500; variants.push(pair);
  pair = splitCountryRow(); variants.push([pair[1]]);
  for (const source of variants) assert.deepEqual(findLabelCountryRegions(blocks(...source)), []);
});

test("one nearest label is selected independently of OCR line order and equal-distance labels stay ambiguous", () => {
  const [label, value] = splitCountryRow();
  const farther = { ...label, bbox: { ...label.bbox, x0: 550, x1: 650 } };
  const expected = [{ x: 679, y: 1376, width: 615, height: 55 }];
  assert.deepEqual(findLabelCountryRegions(blocks(value, farther, label)), expected);
  assert.deepEqual(findLabelCountryRegions(blocks(label, value, farther)), expected);
  assert.deepEqual(findLabelCountryRegions(blocks(label, value, { ...label })), []);
});

test("country region discovery remains bounded and rejects excessive ambiguity", () => {
  const source = blocks(...Array.from({ length: 3 }, (_, index) => splitCountryRow().map(entry => ({ ...entry,
    bbox: { ...entry.bbox, y0: entry.bbox.y0 + index * 200, y1: entry.bbox.y1 + index * 200 },
    words: entry.words.map(item => ({ ...item, bbox: { ...item.bbox, y0: item.bbox.y0 + index * 200, y1: item.bbox.y1 + index * 200 } })),
  }))).flat());
  assert.deepEqual(findLabelCountryRegions(source), []);
  for (const invalid of [null, {}, Array.from({ length: 101 }, () => ({ paragraphs: [] })),
    [{ paragraphs: [{ lines: Array.from({ length: 101 }, () => splitCountryRow()[0]) }] }]])
    assert.deepEqual(findLabelCountryRegions(invalid), []);
});

function croppedCountryEvidence() {
  return extractLabelCountryEvidence(blocks(row([
    word("국가:", 34, 218, { bbox: { x0: 34, y0: 64, x1: 218, y1: 144 } }),
    word("Ethiopia", 470, 808, { bbox: { x0: 470, y0: 58, x1: 808, y1: 138 } }),
    word("에티오피아", 842, 1264, { bbox: { x0: 842, y0: 34, x1: 1264, y1: 128 } }),
  ])));
}

test("country evidence coordinates return from the padded doubled crop at every tree level", () => {
  const source = croppedCountryEvidence();
  const original = structuredClone(source);
  const result = reprojectLabelCountryEvidence(source, { x: 679, y: 1376, width: 615, height: 55 }, 2);
  assert.equal(result.text, "국가: Ethiopia 에티오피아");
  const block = result.blocks[0];
  const paragraph = block.paragraphs[0];
  const line = paragraph.lines[0];
  for (const entry of [block, paragraph, line]) assert.deepEqual(entry.bbox, { x0: 679, y0: 1376, x1: 1294, y1: 1431 });
  assert.deepEqual(line.words[0].bbox, { x0: 679, y0: 1391, x1: 771, y1: 1431 });
  assert.deepEqual(line.words[2].bbox, { x0: 1083, y0: 1376, x1: 1294, y1: 1423 });
  assert.deepEqual(line.words.map(({ text, confidence }) => ({ text, confidence })), original.blocks[0].paragraphs[0].lines[0].words.map(({ text, confidence }) => ({ text, confidence })));
  assert.deepEqual(source, original);
  line.words[0].bbox.x0 = 0;
  assert.deepEqual(source, original);
});

test("reprojection clips negative padding origins and rejects unsupported scales or impossible crop coordinates", () => {
  const source = croppedCountryEvidence();
  const atEdge = reprojectLabelCountryEvidence(source, { x: 0, y: 0, width: 615, height: 100 }, 2);
  assert.equal(atEdge.blocks[0].bbox.x0, 17);
  assert.equal(atEdge.blocks[0].bbox.y0, 17);
  for (const scale of [0, 1.5, 3, NaN, Infinity]) assert.deepEqual(reprojectLabelCountryEvidence(source, { x: 679, y: 1376, width: 615, height: 55 }, scale), { text: "", blocks: [] });
  for (const region of [null, { x: -1, y: 0, width: 615, height: 55 }, { x: 0, y: 0, width: 1, height: 55 }, { x: 0, y: 0, width: 500, height: 55 }])
    assert.deepEqual(reprojectLabelCountryEvidence(source, region, 2), { text: "", blocks: [] });
});
