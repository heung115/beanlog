import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { prepareLabelSmallPrintImage } from "../src/lib/coffee/bean-label-small-print-image.ts";

const fixture = readFileSync(new URL("./fixtures/bean-label-ko.png", import.meta.url));
function image(width = 6, height = 4) {
  const bytes = Buffer.from(fixture);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return new Blob([bytes], { type: "image/png" });
}
function region() {
  return { source: { width: 6, height: 4 }, crop: { x: 2, y: 1, width: 2, height: 1 }, output: { width: 4, height: 1 } };
}
const signal = () => new AbortController().signal;
const flush = () => new Promise(resolve => setImmediate(resolve));

function browser(t, options = {}) {
  const descriptors = new Map();
  const replace = (name, value) => {
    descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, value });
  };
  t.after(() => {
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  const calls = { decoded: [], closed: 0, canvases: [], draws: [], reads: [], writes: [], encodes: [] };
  const bitmap = { width: options.width ?? 6, height: options.height ?? 4, close() { calls.closed++; } };
  replace("createImageBitmap", value => {
    calls.decoded.push(value);
    return options.decode ? options.decode(bitmap) : Promise.resolve(bitmap);
  });
  replace("ImageData", class {
    constructor(data, width, height) { this.data = data; this.width = width; this.height = height; }
  });
  replace("document", { createElement(name) {
    assert.equal(name, "canvas");
    const index = calls.canvases.length;
    const context = {
      fillRect(...args) { canvas.fill = args; },
      drawImage(...args) { calls.draws.push(args); options.draw?.(); },
      getImageData(...args) {
        calls.reads.push(args);
        options.read?.();
        return { data: new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]) };
      },
      putImageData(...args) { calls.writes.push(args); options.write?.(); },
    };
    const canvas = {
      width: 0, height: 0, context,
      getContext(...args) { canvas.contextArgs = args; return options.missingContext === index ? null : context; },
      toBlob(callback, mime) {
        calls.encodes.push({ width: canvas.width, height: canvas.height, mime });
        if (options.encode) options.encode(callback);
        else callback(new Blob(["encoded"], { type: mime }));
      },
    };
    calls.canvases.push(canvas);
    return canvas;
  } });
  return { calls, bitmap };
}

function assertReleased(calls, count = 2) {
  assert.equal(calls.closed, 1);
  assert.equal(calls.canvases.length, count);
  for (const canvas of calls.canvases) {
    assert.equal(canvas.width, 1);
    assert.equal(canvas.height, 1);
  }
}

test("crops exact normalized-frame pixels and uses deterministic cubic enlargement", async t => {
  const { calls, bitmap } = browser(t);
  const full = image();
  const output = await prepareLabelSmallPrintImage(full, region(), signal());
  assert.equal(output.type, "image/png");
  assert.deepEqual(calls.decoded, [full]);
  assert.deepEqual(calls.draws, [[bitmap, 2, 1, 2, 1, 0, 0, 2, 1]]);
  assert.deepEqual(calls.reads, [[0, 0, 2, 1]]);
  const [pixels, x, y] = calls.writes[0];
  assert.equal(pixels.width, 4); assert.equal(pixels.height, 1);
  assert.deepEqual([...pixels.data], [0, 0, 0, 255, 52, 52, 52, 255, 203, 203, 203, 255, 255, 255, 255, 255]);
  assert.equal(x, 0); assert.equal(y, 0);
  assert.equal(calls.canvases[0].context.fillStyle, "white");
  assert.deepEqual(calls.canvases[0].fill, [0, 0, 2, 1]);
  for (const canvas of calls.canvases) assert.deepEqual(canvas.contextArgs, ["2d", { willReadFrequently: true }]);
  assert.deepEqual(calls.encodes, [{ width: 4, height: 1, mime: "image/png" }]);
  assertReleased(calls);
});

test("invalid and oversized regions fail before image decoding or canvas allocation", async t => {
  const { calls } = browser(t);
  const invalid = [null, {}, { ...region(), crop: null },
    { ...region(), source: { width: 2500, height: 2000 } },
    { ...region(), source: { width: 2601, height: 4 } },
    { ...region(), source: { width: NaN, height: 4 } },
    { ...region(), source: { width: 6.5, height: 4 } },
    { ...region(), output: { width: 2000, height: 1600 } },
    { ...region(), output: { width: 2601, height: 1 } },
    { ...region(), output: { width: 4, height: 0 } },
    { ...region(), output: { width: 4, height: Infinity } },
    { ...region(), output: { width: 4, height: 1.5 } },
  ];
  for (const crop of [
    { x: -1 }, { y: -1 }, { x: 1.5 }, { y: NaN }, { width: 0 }, { height: -1 },
    { width: 2.5 }, { x: 5 }, { y: 4 }, { width: Number.MAX_SAFE_INTEGER },
  ]) invalid.push({ ...region(), crop: { ...region().crop, ...crop } });
  const full = image();
  for (const candidate of invalid) await assert.rejects(prepareLabelSmallPrintImage(full, candidate, signal()), /invalid_image/);
  assert.equal(calls.decoded.length, 0);
  assert.equal(calls.canvases.length, 0);
});

test("PNG container validation and source-header agreement happen before decoding", async t => {
  const { calls } = browser(t);
  for (const full of [new Blob(["not a PNG"], { type: "image/png" }), image(7, 4), image(2600, 1800)]) {
    await assert.rejects(prepareLabelSmallPrintImage(full, region(), signal()), /invalid_image/);
  }
  await assert.rejects(prepareLabelSmallPrintImage(image(6000, 6000), region(), signal()), /image_too_large/);
  assert.equal(calls.decoded.length, 0);
  assert.equal(calls.canvases.length, 0);
});

test("a decoded frame mismatch closes the bitmap before allocating any canvas", async t => {
  const { calls } = browser(t, { width: 4, height: 6 });
  await assert.rejects(prepareLabelSmallPrintImage(image(), region(), signal()), /invalid_image/);
  assertReleased(calls, 0);
});

test("snapshots validated coordinates so caller mutation during decode cannot change the crop", async t => {
  let finish;
  const { calls, bitmap } = browser(t, { decode: value => new Promise(resolve => { finish = () => resolve(value); }) });
  const candidate = region();
  const pending = prepareLabelSmallPrintImage(image(), candidate, signal());
  await flush();
  candidate.crop.x = 9999;
  candidate.output.width = 999999;
  candidate.source.width = 1;
  finish(); await pending;
  assert.deepEqual(calls.draws, [[bitmap, 2, 1, 2, 1, 0, 0, 2, 1]]);
  assert.deepEqual(calls.encodes, [{ width: 4, height: 1, mime: "image/png" }]);
  assertReleased(calls);
});

test("an already-cancelled request neither reads the PNG nor starts decoding", async t => {
  const { calls } = browser(t);
  const controller = new AbortController(); controller.abort(new Error("custom cancellation"));
  const full = image();
  full.arrayBuffer = () => assert.fail("cancelled input must not be read");
  await assert.rejects(prepareLabelSmallPrintImage(full, region(), controller.signal), { name: "AbortError" });
  assert.equal(calls.decoded.length, 0);
  assert.equal(calls.canvases.length, 0);
});

test("cancellation while reading the header settles before the pending read finishes", async t => {
  const { calls } = browser(t);
  let finish;
  const full = image();
  const bytes = await full.arrayBuffer();
  full.arrayBuffer = () => new Promise(resolve => { finish = () => resolve(bytes); });
  const controller = new AbortController();
  const rejection = assert.rejects(prepareLabelSmallPrintImage(full, region(), controller.signal), { name: "AbortError" });
  await flush(); controller.abort(); await rejection;
  assert.equal(calls.decoded.length, 0);
  finish(); await flush();
  assert.equal(calls.decoded.length, 0);
});

test("cancelling an unresolved decode settles promptly and closes its late bitmap exactly once", async t => {
  let finish;
  const { calls } = browser(t, { decode: value => new Promise(resolve => { finish = () => resolve(value); }) });
  const controller = new AbortController();
  const rejection = assert.rejects(prepareLabelSmallPrintImage(image(), region(), controller.signal), { name: "AbortError" });
  await flush(); controller.abort(); await rejection;
  assert.equal(calls.decoded.length, 1);
  assert.equal(calls.closed, 0);
  assert.equal(calls.canvases.length, 0);
  finish(); await flush();
  assertReleased(calls, 0);
});

test("a failed decode becomes invalid_image and allocates no canvas", async t => {
  const { calls } = browser(t, { decode: async () => { throw new Error("decode failed"); } });
  await assert.rejects(prepareLabelSmallPrintImage(image(), region(), signal()), /invalid_image/);
  assert.equal(calls.canvases.length, 0);
});

test("cancellation between decode completion and drawing closes the resolved bitmap", async t => {
  const controller = new AbortController();
  const { calls } = browser(t, { decode: value => {
    queueMicrotask(() => controller.abort());
    return Promise.resolve(value);
  } });
  await assert.rejects(prepareLabelSmallPrintImage(image(), region(), controller.signal), { name: "AbortError" });
  await flush();
  assertReleased(calls, 0);
});

test("cancellation between drawing and pixel reading stops further pixel work", async t => {
  const controller = new AbortController();
  const { calls } = browser(t, { draw: () => controller.abort() });
  await assert.rejects(prepareLabelSmallPrintImage(image(), region(), controller.signal), { name: "AbortError" });
  assert.equal(calls.reads.length, 0);
  assert.equal(calls.writes.length, 0);
  assertReleased(calls, 1);
});

test("cancellation after reading pixels stops before resizing and allocating output", async t => {
  const controller = new AbortController();
  const { calls } = browser(t, { read: () => controller.abort() });
  await assert.rejects(prepareLabelSmallPrintImage(image(), region(), controller.signal), { name: "AbortError" });
  assert.equal(calls.writes.length, 0);
  assertReleased(calls, 1);
});

test("cancellation after writing output stops before PNG encoding", async t => {
  const controller = new AbortController();
  const { calls } = browser(t, { write: () => controller.abort() });
  await assert.rejects(prepareLabelSmallPrintImage(image(), region(), controller.signal), { name: "AbortError" });
  assert.equal(calls.encodes.length, 0);
  assertReleased(calls);
});

test("cancelling a pending encode releases canvases immediately and ignores a late callback", async t => {
  let finish;
  const { calls } = browser(t, { encode: callback => { finish = callback; } });
  const controller = new AbortController();
  const rejection = assert.rejects(prepareLabelSmallPrintImage(image(), region(), controller.signal), { name: "AbortError" });
  await flush(); controller.abort(); await rejection;
  assertReleased(calls);
  finish(new Blob(["late PNG"], { type: "image/png" })); await flush();
  assertReleased(calls);
});

test("cancellation immediately after the encode callback still propagates AbortError", async t => {
  const controller = new AbortController();
  const { calls } = browser(t, { encode: callback => {
    callback(new Blob(["PNG"], { type: "image/png" }));
    controller.abort();
  } });
  await assert.rejects(prepareLabelSmallPrintImage(image(), region(), controller.signal), { name: "AbortError" });
  assertReleased(calls);
});

test("missing contexts, pixel read failures, and encoding failures release allocated resources", async t => {
  const cases = [
    { name: "source context", options: { missingContext: 0 }, count: 1, error: /invalid_image/ },
    { name: "output context", options: { missingContext: 1 }, count: 2, error: /invalid_image/ },
    { name: "pixel read", options: { read: () => { throw new Error("pixel read failed"); } }, count: 1, error: /pixel read failed/ },
    { name: "empty PNG", options: { encode: callback => callback(null) }, count: 2, error: /invalid_image/ },
    { name: "encode throw", options: { encode: () => { throw new Error("encode failed"); } }, count: 2, error: /encode failed/ },
  ];
  for (const { name, options, count, error } of cases) await t.test(name, async t => {
    const { calls } = browser(t, options);
    await assert.rejects(prepareLabelSmallPrintImage(image(), region(), signal()), error);
    assertReleased(calls, count);
  });
});
