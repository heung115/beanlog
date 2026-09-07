import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { createBrowserLabelReader } from "../src/lib/coffee/bean-label-ocr.ts";

const image = new Blob([readFileSync(new URL("./fixtures/bean-label-ko.png", import.meta.url))], { type: "image/png" });
const tilted = [{ paragraphs: [{ lines: [0, 100].map(y => ({ words: [
  { text: "unreadable", confidence: 70, bbox: { x0: 30, y0: 20 + y, x1: 100, y1: 40 + y } },
  { text: "lettering", confidence: 70, bbox: { x0: 230, y0: 45 + y, x1: 300, y1: 65 + y } },
] })) }] }];

function setup(t, replies) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  const calls = [];
  class Worker {
    terminate() {}
    postMessage(request) {
      calls.push(request.action);
      const result = request.action === "recognize" ? replies.shift() : {};
      assert.notEqual(result, undefined, "unexpected extra OCR pass");
      setImmediate().then(() => this.onmessage?.({ data: {
        jobId: request.jobId, action: request.action, status: "resolve", data: result,
      } }));
    }
  }
  Object.defineProperty(globalThis, "Worker", { value: Worker, configurable: true, writable: true });
  const reader = createBrowserLabelReader();
  t.after(() => {
    reader.dispose();
    if (previous) Object.defineProperty(globalThis, "Worker", previous);
    else delete globalThis.Worker;
  });
  return { reader, calls };
}

test("a clear deskewed view replaces fragmented country text before publishing the recovered title", async t => {
  const { reader, calls } = setup(t, [
    { text: "Colombia", confidence: 35, blocks: tilted },
    { text: "Product: Highland Morning\nCountry: Ethiopia", confidence: 93 },
  ]);
  const partials = [];
  let corrections = 0;
  const result = await reader.recognize(image, {
    signal: new AbortController().signal, onProgress() {}, onPartial: value => partials.push(value),
    prepareDeskewRetry: async angle => { corrections++; assert.ok(angle > 5 && angle < 10); return image; },
  });
  assert.equal(corrections, 1);
  assert.equal(calls.filter(action => action === "recognize").length, 2);
  assert.equal(result.extraction.fields.name, "Highland Morning");
  assert.equal(result.extraction.fields.origin_country, "Ethiopia");
  assert.ok(partials.length && partials.every(value => value.extraction.fields.origin_country === "Ethiopia"));
});

test("existing names and upright or unmeasurable text do not trigger a rotation", async t => {
  const { reader } = setup(t, [
    { text: "Product: Orchard Morning", confidence: 90, blocks: tilted },
    { text: "Country: Ethiopia", confidence: 90 },
  ]);
  for (let attempt = 0; attempt < 2; attempt++) await reader.recognize(image, {
    signal: new AbortController().signal, onProgress() {},
    prepareDeskewRetry: () => assert.fail("unexpected rotation"),
  });
});

test("a rotation that still lacks a title cannot erase previously read facts", async t => {
  const { reader } = setup(t, [
    { text: "Country: Ethiopia\n250g", confidence: 40, blocks: tilted },
    { text: "unreadable", confidence: 90 },
    { text: "unreadable", confidence: 30 },
  ]);
  const result = await reader.recognize(image, {
    signal: new AbortController().signal, onProgress() {}, prepareDeskewRetry: async () => image,
  });
  assert.equal(result.extraction.fields.origin_country, "Ethiopia");
  assert.equal(result.extraction.fields.weight_g, 250);
});

test("a newly guessed title with weaker overall OCR confidence does not replace the initial reading", async t => {
  const { reader } = setup(t, [
    { text: "Country: Ethiopia", confidence: 75, blocks: tilted },
    { text: "Product: Uncertain Reading\nCountry: Colombia", confidence: 72 },
  ]);
  const result = await reader.recognize(image, {
    signal: new AbortController().signal, onProgress() {}, prepareDeskewRetry: async () => image,
  });
  assert.equal(result.extraction.fields.name, undefined);
  assert.equal(result.extraction.fields.origin_country, "Ethiopia");
});

test("cancelling while a corrected image is prepared prevents any late OCR or partial", async t => {
  const { reader, calls } = setup(t, [{ text: "Country: Ethiopia", confidence: 40, blocks: tilted }]);
  const controller = new AbortController();
  await assert.rejects(reader.recognize(image, {
    signal: controller.signal, onProgress() {}, onPartial: () => assert.fail("cancelled partial"),
    prepareDeskewRetry: async () => { controller.abort(); return image; },
  }), { name: "AbortError" });
  assert.equal(calls.filter(action => action === "recognize").length, 1);
});

test("conflicting explicitly printed names are not silently resolved by a later rotation", async t => {
  const { reader } = setup(t, [{ text: "Product: First Coffee\nProduct: Second Coffee", confidence: 40, blocks: tilted }]);
  const result = await reader.recognize(image, {
    signal: new AbortController().signal, onProgress() {},
    prepareDeskewRetry: () => assert.fail("explicit disagreement must stay unresolved"),
  });
  assert.equal(result.extraction.fields.name, undefined);
});

test("an earlier view's recovered name survives a later tilted view without a name", async t => {
  const { reader } = setup(t, [
    { text: "Product: Orchard Morning", confidence: 90 },
    { text: "Country: Ethiopia", confidence: 40, blocks: tilted },
  ]);
  const partials = [];
  const result = await reader.recognize([{ image, psm: "6", kind: "text" }, { image, psm: "6", kind: "full" }], {
    signal: new AbortController().signal, onProgress() {}, onPartial: value => partials.push(value.extraction.fields.name),
    prepareDeskewRetry: () => assert.fail("a later view must not reconsider an already recovered name"),
  });
  assert.equal(result.extraction.fields.name, "Orchard Morning");
  assert.ok(partials.every(name => name === "Orchard Morning"));
});

test("rotation cannot resolve conflicting explicit country rows by losing one of them", async t => {
  const { reader } = setup(t, [
    { text: "Country: Ethiopia\nCountry: Colombia", confidence: 35, blocks: tilted },
    { text: "Product: Highland Morning\nCountry: Ethiopia", confidence: 93 },
  ]);
  const result = await reader.recognize(image, {
    signal: new AbortController().signal, onProgress() {}, prepareDeskewRetry: async () => image,
  });
  assert.equal(result.extraction.fields.name, undefined);
  assert.equal(result.extraction.fields.origin_country, undefined);
});

test("a second segmentation of the corrected image supplies the missing country heading, not a competing title", async t => {
  const row = (text, y, height) => {
    const words = text.split(" ").map((text, index) => ({ text, confidence: 95,
      bbox: { x0: 50 + index * 100, x1: 140 + index * 100, y0: y, y1: y + height } }));
    return { text, confidence: 95, bbox: { x0: 50, x1: words.at(-1).bbox.x1, y0: y, y1: y + height }, words };
  };
  const rows = [row("에티오피아 알로 타미루", 50, 40), row("몰케 네추럴", 100, 40),
    row("Colombia La Esperanza", 150, 40), row("Java Natural", 200, 40),
    row("Ethiopia 에티오피아", 270, 16), row("Process: Natural", 310, 16)];
  const blocks = lines => [{ paragraphs: [{ lines }] }];
  const { reader } = setup(t, [
    { text: "Colombia", confidence: 35, blocks: tilted },
    { text: rows.map(row => row.text).join("\n"), confidence: 90, blocks: blocks(rows) },
    { text: "국가: Ethiopia 에티오피아", confidence: 70, blocks: blocks([row("국가: Ethiopia 에티오피아", 270, 16)]) },
  ]);
  const result = await reader.recognize(image, {
    signal: new AbortController().signal, onProgress() {}, prepareDeskewRetry: async () => image,
  });
  assert.equal(result.extraction.fields.name, "에티오피아 알로 타미루 몰케 네추럴");
  assert.equal(result.extraction.fields.origin_country, "Ethiopia");
  assert.equal(result.extraction.evidence.origin_country, "국가: Ethiopia 에티오피아");
});
