import assert from "node:assert/strict";
import test from "node:test";
import { estimateLabelSkew, prepareLabelDeskew } from "../src/lib/coffee/bean-label-deskew.ts";

const blocks = (...lines) => [{ paragraphs: [{ lines }] }];
function line(angle, row = 0, words = 2) {
  const slope = Math.tan(angle * Math.PI / 180);
  return { words: Array.from({ length: words }, (_, index) => {
    const x = 100 + index * 180;
    const bottom = 200 + row * 100 + x * slope;
    return { text: `word${index}`, confidence: 90, bbox: { x0: x, x1: x + 100, y0: bottom - 35, y1: bottom } };
  }) };
}

test("measures either tilt direction from multiple observed rows without knowing their text", () => {
  for (const angle of [3, 8, -6, 16]) {
    const result = estimateLabelSkew(blocks(line(angle), line(angle, 1)));
    assert.ok(Math.abs(result.angleDegrees - angle) < .001);
    assert.equal(result.lineCount, 2);
    assert.equal(result.sampleCount, 2);
  }
});

test("straight, sparse, steep and inconsistent evidence does not rotate the image", () => {
  for (const input of [blocks(line(0), line(.3, 1)), blocks(line(8, 0, 6)), blocks(line(35), line(35, 1)),
    blocks(line(10), line(-10, 1)), blocks(line(3), line(14, 1), line(-14, 2)), blocks(line(8, 0, 1), line(8, 1, 1))])
    assert.equal(estimateLabelSkew(input), null);
});

test("a geometrically inconsistent row cannot overpower agreeing rows", () => {
  const result = estimateLabelSkew(blocks(line(8), line(8.5, 1), line(7.5, 2), line(-14, 3)));
  assert.ok(Math.abs(result.angleDegrees - 8) < .001);
  assert.equal(result.sampleCount, 3);
  assert.equal(result.lineCount, 3);
});

test("unreliable words and malformed or excessive input cannot create a tilt", () => {
  for (const confidence of [10, NaN, Infinity, 101]) {
    const a = line(8); const b = line(8, 1);
    a.words[1].confidence = b.words[1].confidence = confidence;
    assert.equal(estimateLabelSkew(blocks(a, b)), null);
  }
  for (const bbox of [null, {}, { x0: -1, y0: 0, x1: 20, y1: 30 }, { x0: 0, y0: 0, x1: Infinity, y1: 30 }]) {
    const a = line(8); const b = line(8, 1); a.words[1].bbox = b.words[1].bbox = bbox;
    assert.equal(estimateLabelSkew(blocks(a, b)), null);
  }
  for (const input of [null, {}, [null], [{ paragraphs: [null] }], blocks(...Array.from({ length: 301 }, (_, i) => line(8, i)))])
    assert.equal(estimateLabelSkew(input), null);
});

function canvasMock(t, { width = 3024, height = 4032, decode, encode, missingContext = false } = {}) {
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const oldBitmap = Object.getOwnPropertyDescriptor(globalThis, "createImageBitmap");
  const calls = { decoded: 0, closed: 0, fills: [], rotations: [], draws: [], translations: [] };
  const bitmap = { width, height, close() { calls.closed++; } };
  const context = {
    fillRect(...args) { calls.fills.push(args); }, rotate(...args) { calls.rotations.push(args); },
    translate(...args) { calls.translations.push(args); }, drawImage(...args) { calls.draws.push(args); },
  };
  const canvas = { width: 0, height: 0, getContext() { return missingContext ? null : context; },
    toBlob(callback, mime) { if (encode) encode(callback); else callback(new Blob(["png"], { type: mime })); } };
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement() { return canvas; } } });
  Object.defineProperty(globalThis, "createImageBitmap", { configurable: true, value: async () => {
    calls.decoded++; return decode ? decode(bitmap) : bitmap;
  } });
  t.after(() => {
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument); else delete globalThis.document;
    if (oldBitmap) Object.defineProperty(globalThis, "createImageBitmap", oldBitmap); else delete globalThis.createImageBitmap;
  });
  return { calls, bitmap, canvas, context };
}
const photo = new Blob(["validated source pixels"], { type: "image/jpeg" });
const signal = () => new AbortController().signal;
const flush = () => new Promise(resolve => setImmediate(resolve));

test("rotation includes every source edge on a bounded white canvas and releases resources", async t => {
  const { calls, bitmap, canvas, context } = canvasMock(t);
  const output = await prepareLabelDeskew(photo, 8, signal());
  assert.equal(output.type, "image/png");
  const [, , width, height] = calls.fills[0];
  assert.ok(width <= 3200 && height <= 3200 && width * height <= 8_000_000);
  assert.ok(width > 1950 && height > 2600, "rotation should grow the canvas around source edges");
  assert.equal(context.fillStyle, "white");
  assert.deepEqual(calls.rotations, [[-8 * Math.PI / 180]]);
  assert.deepEqual(calls.translations, [[width / 2, height / 2]]);
  assert.equal(calls.draws[0][0], bitmap);
  assert.ok(calls.draws[0][3] > 0 && calls.draws[0][4] > 0);
  assert.equal(calls.closed, 1);
  assert.equal(canvas.width, 1); assert.equal(canvas.height, 1);
});

test("invalid angles and non-image data are rejected before decode", async t => {
  const { calls } = canvasMock(t);
  for (const angle of [0, 1, -1, 21, NaN, Infinity]) await assert.rejects(prepareLabelDeskew(photo, angle, signal()), /invalid_image/u);
  for (const input of [null, {}, new Blob([]), new Blob(["script"], { type: "text/html" })])
    await assert.rejects(prepareLabelDeskew(input, 8, signal()), /invalid_image/u);
  assert.equal(calls.decoded, 0);
});

test("oversized sources and failed render or encode operations release decoded images", async t => {
  for (const options of [{ width: 10001, height: 10000 }, { missingContext: true }, { encode: callback => callback(null) }]) {
    await t.test(JSON.stringify(options), async t => {
      const { calls, canvas } = canvasMock(t, options);
      await assert.rejects(prepareLabelDeskew(photo, 8, signal()), /invalid_image/u);
      assert.equal(calls.closed, 1);
      if (calls.fills.length) assert.equal(canvas.width, 1);
    });
  }
});

test("cancellation before or during decode cannot leak the late bitmap", async t => {
  let complete;
  const { calls, bitmap } = canvasMock(t, { decode: () => new Promise(resolve => { complete = resolve; }) });
  const before = new AbortController(); before.abort();
  await assert.rejects(prepareLabelDeskew(photo, 8, before.signal), { name: "AbortError" });
  assert.equal(calls.decoded, 0);
  const controller = new AbortController();
  const pending = prepareLabelDeskew(photo, 8, controller.signal);
  await flush(); controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  complete(bitmap); await flush();
  assert.equal(calls.closed, 1);
  assert.equal(calls.draws.length, 0);
});

test("cancellation during encoding rejects immediately and releases its canvas", async t => {
  let complete;
  const { calls, canvas } = canvasMock(t, { encode: callback => { complete = callback; } });
  const controller = new AbortController();
  const pending = prepareLabelDeskew(photo, -8, controller.signal);
  await flush(); controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(calls.closed, 1); assert.equal(canvas.width, 1);
  complete(new Blob(["png"], { type: "image/png" })); await flush();
  assert.equal(calls.closed, 1);
});
