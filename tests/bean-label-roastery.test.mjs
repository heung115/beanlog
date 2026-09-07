import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import {
  findLabelRoasteryRegions,
  parseLabelRoasteryRetry,
  prepareLabelRoasteryRetry,
} from "../src/lib/coffee/bean-label-roastery.ts";

const line = (text, tokens = text.split(/\s+/u), confidence = 42) => ({ text,
  words: tokens.map((text, index) => ({ text, confidence,
    bbox: { x0: 20 + index * 60, y0: 30, x1: 70 + index * 60, y1: 50 } })) });
const blocks = (...lines) => [{ paragraphs: [{ lines }] }];
const find = (...lines) => findLabelRoasteryRegions(blocks(...lines), true);

test("uses observed brand-word coordinates and confidence while keeping the original marker line", () => {
  assert.deepEqual(find(line("FROM .CEDAR", ["FROM", ".CEDAR"], 22)), [{
    region: { x: 80, y: 30, width: 50, height: 20 },
    text: ".CEDAR", evidence: "FROM .CEDAR", confidence: 22,
  }]);
  const multiple = line("FROM. Cedar & Stone", ["FROM.", "Cedar", "&", "Stone"]);
  assert.deepEqual(find(multiple)[0].region, { x: 80, y: 30, width: 170, height: 20 });
  // An internal ampersand is part of the observed name, unlike marker punctuation.
  assert.equal(find(multiple)[0].text, "Cedar & Stone");
});

test("damaged FROM markers locate pixels but are never repaired in the original evidence", () => {
  for (const text of ["FYROM. CEDAR", "¥ROM . CEDAR"]) {
    const [candidate] = find(line(text));
    assert.equal(candidate.text, "CEDAR");
    assert.equal(candidate.evidence, text);
  }
  assert.deepEqual(find(line("FROG CEDAR")), []);
  assert.deepEqual(findLabelRoasteryRegions(blocks(line("FROM CEDAR")), false), []);
});

test("different brand candidates remain ambiguous, while repeated evidence keeps its best confidence", () => {
  assert.deepEqual(find(line("FROM CEDAR"), line("FROM PINE")), []);
  assert.deepEqual(find(line("FROM CEDAR"), line("FROM Cedar.", undefined, 60)), [{
    region: { x: 80, y: 30, width: 50, height: 20 },
    text: "Cedar.", evidence: "FROM Cedar.", confidence: 60,
  }]);
});

test("UI instructions, origins, farm descriptions, addresses and generic coffee terms are not brand candidates", () => {
  const values = ["Upload photo", "Choose file", "Save image", "Our farm", "Finca Bella",
    "Hacienda Bella", "Main Street", "Address Seoul", "우리 농장", "Ethiopia", "에티오피아", "Huila",
    "Coffee Roasters", "our local coffee", "Origin Guatemala", "Brew recipe", "Nutrition facts"];
  for (const value of values) {
    assert.equal(parseLabelRoasteryRetry(value), undefined, value);
    assert.deepEqual(find(line(`FROM ${value}`)), [], value);
  }
});

test("valid retry text preserves printed letters instead of spelling or brand-name corrections", () => {
  for (const value of ["HCEDAR", "Cedar & Stone", "19grams", "Björk", "프롬 로스터스", "O’Henry Coffee"])
    assert.equal(parseLabelRoasteryRetry(value), value);
  assert.equal(parseLabelRoasteryRetry("  Cedar   Stone\n"), "Cedar Stone");
  for (const value of ["FROM CEDAR", "www.cedar.com", "cedar.co.kr", "200g", "1", "C", "Cedar: 2", "Cedar\u202eStone", "Cedar\u0000"])
    assert.equal(parseLabelRoasteryRetry(value), undefined, value);
});

test("invalid, distant and oversized boxes cannot create a crop", () => {
  for (const replacement of [null, {}, { x0: NaN, y0: 30, x1: 100, y1: 50 },
    { x0: -1, y0: 30, x1: 100, y1: 50 }, { x0: 80, y0: 30, x1: 80, y1: 50 },
    { x0: 80, y0: 30, x1: 2000, y1: 50 }, { x0: 80, y0: 30, x1: 100, y1: 600 },
    { x0: 1000, y0: 30, x1: 1050, y1: 50 }, { x0: 80, y0: 100, x1: 130, y1: 120 }]) {
    const sample = line("FROM CEDAR"); sample.words[1].bbox = replacement;
    assert.deepEqual(find(sample), [], JSON.stringify(replacement));
  }
  for (const input of [null, {}, [null], [{ paragraphs: [null, { lines: [null] }] }]])
    assert.deepEqual(findLabelRoasteryRegions(input, true), []);
  assert.deepEqual(find(...Array.from({ length: 301 }, () => line("FROM CEDAR"))), []);
});

function mockCanvas(t, { bitmapWidth = 400, bitmapHeight = 300, decode, encode, contextMissing = false } = {}) {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalDecode = Object.getOwnPropertyDescriptor(globalThis, "createImageBitmap");
  const calls = { decoded: 0, closed: 0, draws: [], fills: [], contexts: [] };
  const bitmap = { width: bitmapWidth, height: bitmapHeight, close() { calls.closed++; } };
  const context = { fillRect(...args) { calls.fills.push(args); }, drawImage(...args) { calls.draws.push(args); } };
  const canvas = {
    width: 0, height: 0,
    getContext(...args) { calls.contexts.push(args); return contextMissing ? null : context; },
    toBlob(callback, mime) {
      calls.mime = mime;
      if (encode) encode(callback);
      else callback(new Blob(["png"], { type: mime }));
    },
  };
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement(name) { assert.equal(name, "canvas"); return canvas; } } });
  Object.defineProperty(globalThis, "createImageBitmap", { configurable: true, value: async () => {
    calls.decoded++; return decode ? decode(bitmap) : bitmap;
  } });
  t.after(() => {
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument); else delete globalThis.document;
    if (originalDecode) Object.defineProperty(globalThis, "createImageBitmap", originalDecode); else delete globalThis.createImageBitmap;
  });
  return { calls, bitmap, canvas, context };
}
const image = new Blob([readFileSync(new URL("./fixtures/bean-label-ko.png", import.meta.url))], { type: "image/png" });
const region = { x: 20, y: 30, width: 100, height: 20 };
const signal = () => new AbortController().signal;
const flush = () => new Promise(resolve => setImmediate(resolve));

test("crop scales observed glyph height, adds a white border and releases image resources", async t => {
  const { calls, bitmap, canvas, context } = mockCanvas(t);
  const output = await prepareLabelRoasteryRetry(image, region, signal());
  assert.equal(output.type, "image/png");
  assert.deepEqual(calls.contexts, [["2d"]]);
  assert.deepEqual(calls.fills, [[0, 0, 284, 92]]);
  assert.deepEqual(calls.draws, [[bitmap, 15, 25, 110, 30, 10, 10, 264, 72]]);
  assert.equal(context.fillStyle, "white");
  assert.equal(context.imageSmoothingQuality, "high");
  assert.equal(calls.closed, 1);
  assert.equal(canvas.width, 1); assert.equal(canvas.height, 1);
});

test("invalid coordinates are rejected before decoding", async t => {
  const { calls } = mockCanvas(t);
  for (const invalid of [null, {}, { ...region, width: 1500 }, { ...region, x: -1 }, { ...region, height: NaN }])
    await assert.rejects(prepareLabelRoasteryRetry(image, invalid, signal()), /invalid_image/u);
  assert.equal(calls.decoded, 0);
});

test("an out-of-image region closes the decoded bitmap without drawing", async t => {
  const { calls } = mockCanvas(t);
  await assert.rejects(prepareLabelRoasteryRetry(image, { ...region, x: 350 }, signal()), /invalid_image/u);
  assert.equal(calls.closed, 1); assert.equal(calls.draws.length, 0);
});

test("an oversized source closes the decoded bitmap without allocating a crop", async t => {
  const { calls } = mockCanvas(t, { bitmapWidth: 4000, bitmapHeight: 4000 });
  await assert.rejects(prepareLabelRoasteryRetry(image, region, signal()), /invalid_image/u);
  assert.equal(calls.closed, 1); assert.equal(calls.contexts.length, 0);
});

test("missing canvas context and failed PNG encoding release resources", async t => {
  for (const options of [{ contextMissing: true }, { encode: callback => callback(null) }]) {
    await t.test(JSON.stringify(options), async t => {
      const { calls, canvas } = mockCanvas(t, options);
      await assert.rejects(prepareLabelRoasteryRetry(image, region, signal()), /invalid_image/u);
      assert.equal(calls.closed, 1); assert.equal(canvas.width, 1);
    });
  }
});

test("an already-cancelled request does not decode the image", async t => {
  const { calls } = mockCanvas(t);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(prepareLabelRoasteryRetry(image, region, controller.signal), { name: "AbortError" });
  assert.equal(calls.decoded, 0);
});

test("cancelling an in-flight decode rejects promptly and closes a late bitmap", async t => {
  let finish;
  const { calls } = mockCanvas(t, { decode: bitmap => new Promise(resolve => { finish = () => resolve(bitmap); }) });
  const controller = new AbortController();
  const result = prepareLabelRoasteryRetry(image, region, controller.signal);
  const rejection = assert.rejects(result, { name: "AbortError" });
  await flush(); controller.abort(); await rejection;
  assert.equal(calls.closed, 0);
  finish(); await flush(); assert.equal(calls.closed, 1);
});

test("cancelling an in-flight PNG encode releases resources and ignores its late callback", async t => {
  let finish;
  const { calls, canvas } = mockCanvas(t, { encode: callback => { finish = callback; } });
  const controller = new AbortController();
  const rejection = assert.rejects(prepareLabelRoasteryRetry(image, region, controller.signal), { name: "AbortError" });
  await flush(); controller.abort(); await rejection;
  assert.equal(calls.closed, 1); assert.equal(canvas.width, 1);
  finish(new Blob(["late"])); await flush(); assert.equal(calls.closed, 1);
});
