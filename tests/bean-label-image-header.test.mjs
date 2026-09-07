import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseLabelImageHeader, validateLabelImageBeforeDecode, MAX_LABEL_FILE_BYTES } from "../src/lib/coffee/bean-label-image-header.ts";
import { prepareLabelImages, prepareLabelWeightRetry, prepareLabelWordRetry } from "../src/lib/coffee/bean-label-image.ts";
import { prepareLabelDetailRetries } from "../src/lib/coffee/bean-label-detail-image.ts";
import { prepareLabelRoasteryRetry } from "../src/lib/coffee/bean-label-roastery.ts";

const png = readFileSync(new URL("./fixtures/bean-label-ko.png", import.meta.url));
function pngSize(width, height) { const bytes = Buffer.from(png); bytes.writeUInt32BE(width, 16); bytes.writeUInt32BE(height, 20); return bytes; }
function jpeg(width, height, marker = 0xc0) {
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0, 4, 0, 0, 0xff, marker, 0, 11, 8, 0, 0, 0, 0, 1, 1, 0x11, 0, 0xff, 0xda, 0, 8, 1, 1, 0, 0, 63, 0, 0xff, 0xd9]);
  bytes.writeUInt16BE(height, 13); bytes.writeUInt16BE(width, 15); return bytes;
}
function chunk(type, payload) { const data = Buffer.alloc(8 + payload.length + payload.length % 2); data.write(type); data.writeUInt32LE(payload.length, 4); payload.copy(data, 8); return data; }
function webp(...chunks) { const header = Buffer.from("RIFF\0\0\0\0WEBP", "binary"); const data = Buffer.concat([header, ...chunks]); data.writeUInt32LE(data.length - 8, 4); return data; }
function lossy(width, height) { const data = Buffer.alloc(10); Buffer.from([0x9d, 1, 0x2a]).copy(data, 3); data.writeUInt16LE(width, 6); data.writeUInt16LE(height, 8); return chunk("VP8 ", data); }
function lossless(width, height) { const data = Buffer.alloc(5); data[0] = 0x2f; data.writeUInt32LE(((width - 1) | ((height - 1) << 14)) >>> 0, 1); return chunk("VP8L", data); }
function extended(width, height, flags = 0) { const data = Buffer.alloc(10); data[0] = flags; data.writeUIntLE(width - 1, 4, 3); data.writeUIntLE(height - 1, 7, 3); return chunk("VP8X", data); }

test("parses real PNG and JPEG baseline/progressive and all static WebP dimension encodings", () => {
  assert.deepEqual(parseLabelImageHeader(png, "image/png"), { width: png.readUInt32BE(16), height: png.readUInt32BE(20) });
  for (const marker of [0xc0, 0xc2]) assert.deepEqual(parseLabelImageHeader(jpeg(640, 480, marker), "image/jpeg"), { width: 640, height: 480 });
  for (const frame of [lossy(640, 480), lossless(640, 480)]) {
    for (const data of [webp(frame), webp(extended(640, 480), frame)]) assert.deepEqual(parseLabelImageHeader(data, "image/webp"), { width: 640, height: 480 });
  }
});

test("tiny compressed headers claiming giant buffers fail the source pixel and side budgets", () => {
  for (const [data, mime] of [[pngSize(1_000_000, 1), "image/png"], [pngSize(6000, 6000), "image/png"], [jpeg(6000, 6000), "image/jpeg"], [webp(lossy(6000, 6000)), "image/webp"], [webp(lossless(6000, 6000)), "image/webp"], [webp(extended(6000, 6000), lossless(1, 1)), "image/webp"]]) {
    assert.throws(() => parseLabelImageHeader(data, mime), /image_too_large/);
  }
});

test("rejects MIME spoofing, truncated containers, animation and conflicting WebP dimensions", () => {
  const animation = Buffer.alloc(20); animation.writeUInt32BE(8); animation.write("acTL", 4); animation.writeUInt32BE(2, 8);
  const animatedPng = Buffer.concat([png.subarray(0, 33), animation, png.subarray(33)]);
  for (const [data, mime] of [[png, "image/jpeg"], [png.subarray(0, 24), "image/png"], [pngSize(0, 10), "image/png"], [animatedPng, "image/png"], [jpeg(1, 1).subarray(0, 10), "image/jpeg"], [webp(extended(10, 10, 2), lossless(10, 10)), "image/webp"], [webp(extended(1, 1), lossless(600, 600)), "image/webp"], [webp(lossy(1, 1), lossy(1, 1)), "image/webp"], [Buffer.from('<svg width="100000"/>'), "image/svg+xml"]]) {
    assert.throws(() => parseLabelImageHeader(data, mime), /invalid_image/);
  }
});

test("all browser decode entrypoints reject giant compressed dimensions without touching browser APIs", async t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "document");
  const bitmap = Object.getOwnPropertyDescriptor(globalThis, "createImageBitmap");
  Object.defineProperty(globalThis, "document", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "createImageBitmap", { configurable: true, value: () => assert.fail("must reject before decode") });
  t.after(() => { if (original) Object.defineProperty(globalThis, "document", original); else delete globalThis.document; if (bitmap) Object.defineProperty(globalThis, "createImageBitmap", bitmap); else delete globalThis.createImageBitmap; });
  const image = new Blob([pngSize(6000, 6000)], { type: "image/png" });
  const signal = new AbortController().signal;
  const region = { x: 0, y: 0, width: 10, height: 10 };
  for (const read of [() => prepareLabelImages(image, signal), () => prepareLabelWeightRetry(image, signal), () => prepareLabelWordRetry(image, region, signal), () => prepareLabelDetailRetries(image, signal), () => prepareLabelRoasteryRetry(image, region, signal)]) await assert.rejects(read(), /image_too_large/);
});

test("byte budget and cancellation are enforced before reading or decoding", async () => {
  await assert.rejects(validateLabelImageBeforeDecode(new Blob([new Uint8Array(MAX_LABEL_FILE_BYTES + 1)])), /image_too_large/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(validateLabelImageBeforeDecode(new Blob([png], { type: "image/png" }), controller.signal), { name: "AbortError" });
});
