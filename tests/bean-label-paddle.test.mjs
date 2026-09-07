import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import test from "node:test";
import { createBrowserPaddleLabelReader, mergeLabelDetail, needsLabelRefinement } from "../src/lib/coffee/bean-label-paddle.ts";
import { selectLabelSmallPrintRegion } from "../src/lib/coffee/bean-label-small-print.ts";
import { validateLabelImageBeforeDecode } from "../src/lib/coffee/bean-label-image-header.ts";
import { extractLabelPolygons } from "../src/lib/coffee/bean-label-polygons.ts";

const bytes = readFileSync(new URL("./fixtures/bean-label-ko.png", import.meta.url));
const picture = () => new Blob([bytes], { type: "image/png" });
const fields = value => ({ bean_type: "single_origin", fields: value,
  evidence: Object.fromEntries(Object.entries(value).map(([key, value]) => [key, String(value)])) });
const config = { pipelineConfig: { assets: { det: { url: "models/det.tar" }, rec: { url: "models/rec.tar" } } },
  ortOptions: { backend: "wasm", numThreads: 1, simd: true, proxy: false, wasmPaths: "ort/" } };
const summary = { backend: "wasm", detProvider: "wasm", recProvider: "wasm", webgpuAvailable: false,
  assets: [], elapsedMs: 1, pipelineConfigWarnings: [] };
const result = text => ({ image: { width: 400, height: 400 }, items: text.split("\n").map((text, i) => ({
  text, score: .99, poly: [[30, 30 + i * 40], [330, 30 + i * 40], [330, 50 + i * 40], [30, 50 + i * 40]],
})) });

function harness(t, texts = ["Product: Copper Moon\nCountry: Colombia"], fallbackTexts = []) {
  const workers = [], sources = [], events = [];
  const originals = new Map();
  t.after(() => {
    for (const [key, previous] of originals) {
      if (previous) Object.defineProperty(globalThis, key, previous);
      else delete globalThis[key];
    }
  });
  const replace = (key, value) => {
    if (!originals.has(key)) originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  };
  class Worker {
    constructor(url) { this.url = String(url); this.terminated = false; workers.push(this); events.push({ event: "create", worker: this }); }
    postMessage(message) {
      if (message.action) {
        const data = message.action === "recognize" ? { text: fallbackTexts.shift() ?? "" } : {};
        queueMicrotask(() => this.onmessage?.({ data: { workerId: message.workerId, jobId: message.jobId, action: message.action, status: "resolve", data } }));
        return;
      }
      if (message.type === "predict") sources.push(message.payload.sources[0].imageBitmap.source);
      const next = message.type === "predict" ? texts.shift() ?? "" : undefined;
      const respond = value => {
        const payload = message.type === "init" ? { summary } : message.type === "predict" ? [typeof value === "string" ? result(value) : value] : {};
        queueMicrotask(() => this.onmessage?.({ data: { kind: "worker-transport-response", requestId: message.requestId,
          status: value?.error ? "error" : "success", payload: value?.error ? { message: "private engine failure" } : payload } }));
      };
      if (next?.deferred) next.respond = respond;
      else respond(typeof next === "function" ? next(message) : next);
    }
    terminate() { this.terminated = true; events.push({ event: "terminate", worker: this }); }
  }
  replace("Worker", Worker);
  replace("location", new URL("http://localhost:4320/ko/beans/new"));
  replace("createImageBitmap", async source => ({ source, close() {} }));
  replace("fetch", async () => ({ ok: true, json: async () => structuredClone(config) }));
  const reader = createBrowserPaddleLabelReader();
  t.after(async () => { reader.dispose(); await setImmediate(); });
  return { reader, workers, sources, replace, events };
}
const options = () => ({ signal: new AbortController().signal, onProgress() {} });

test("only an unresolved identity or printed incomplete recipe needs another engine", () => {
  assert.equal(needsLabelRefinement(fields({ name: "Copper Moon", weight_g: 250 }), "Coffee"), false);
  assert.equal(needsLabelRefinement(fields({ weight_g: 250 }), "Coffee on a receipt"), false);
  assert.equal(needsLabelRefinement(fields({ process_method: "decaf" }), "DECAFFEINATED COFFEE"), true);
  assert.equal(needsLabelRefinement({ ...fields({ name: "Evening Blend" }), bean_type: "blend" }, "Guatemala 50%\nCosta Rica 50%"), true);
  assert.equal(needsLabelRefinement({ ...fields({ name: "Evening Blend" }), bean_type: "blend" }, "100% Arabica"), false);
});

test("the full photograph establishes a stable name before its optional text crop", async t => {
  const { reader, sources } = harness(t, ["Product: Copper Moon\nCountry: Colombia", "Product: Moon\nNet weight: 250g"]);
  const full = picture(), crop = picture(), partials = [];
  const read = await reader.recognize([{ image: crop, psm: "6", kind: "text" }, { image: full, psm: "11", kind: "full" }],
    { ...options(), onPartial: result => partials.push(structuredClone(result)) });
  assert.deepEqual(sources, [full, crop]);
  assert.deepEqual(partials.map(result => result.extraction.fields.name), ["Copper Moon", "Copper Moon"]);
  assert.equal(read.extraction.fields.name, "Copper Moon");
  assert.equal(read.extraction.fields.weight_g, 250);
});

test("detail merging keeps conflicting countries unresolved and does not mutate either reading", () => {
  const primary = fields({ name: "Copper Moon", origin_country: "Colombia" });
  const crop = fields({ name: "Moon", origin_country: "Brazil", weight_g: 250 });
  const originals = structuredClone([primary, crop]);
  const merged = mergeLabelDetail(primary, crop);
  assert.equal(merged.fields.name, "Copper Moon");
  assert.equal(merged.fields.origin_country, undefined);
  assert.equal(merged.fields.weight_g, 250);
  assert.deepEqual([primary, crop], originals);
});

test("another product's crop cannot attach its country or producer to the primary name", () => {
  const primary = fields({ name: "Ethiopia First Lot" });
  const crop = fields({ name: "Colombia Second Lot", origin_country: "Colombia", farm_producer: "Second Farm" });
  assert.deepEqual(mergeLabelDetail(primary, crop), primary);
});

test("only a coffee with a damaged combined weight/composition row needs detail refinement", () => {
  const coffee = fields({ name: "Highland AA", process_method: "washed", varietal: "SL28" });
  assert.equal(needsLabelRefinement(coffee, "250g1원산지100%"), true);
  for (const raw of ["250g", "100%", "250g\n100%", "250 gift 100%", "receipt 100%"]) assert.equal(needsLabelRefinement(coffee, raw), false);
  assert.equal(needsLabelRefinement(fields({ name: "Hand cream" }), "250g1원산지100%"), false);
  assert.equal(needsLabelRefinement(fields({ ...coffee.fields, weight_g: 250 }), "250g1원산지100%"), false);
  assert.equal(needsLabelRefinement(fields({ ...coffee.fields, origin_country: "Peru" }), "250g1원산지100%"), false);
});

const bilingualObservation = (first = "Peru Copper Mountain", second = "페루 구리 산") => extractLabelPolygons({ image: { width: 800, height: 800 }, items: [
  smallItem(first, 100, 100, 220, 20), smallItem(second, 100, 126, 220, 20), smallItem("Country: Peru", 100, 190, 220, 20),
] });

test("the same adjacent bilingual title in both frames proves a missing-detail alias", () => {
  const primary = fields({ name: "Peru Copper Mountain", origin_country: "Peru" });
  const detail = fields({ name: "페루 구리 산", origin_country: "Peru", weight_g: 250 });
  const source = { primary: bilingualObservation(), detail: bilingualObservation() };
  const before = structuredClone([primary, detail, source]);
  const merged = mergeLabelDetail(primary, detail, source);
  assert.equal(merged.fields.name, "Peru Copper Mountain");
  assert.equal(merged.fields.weight_g, 250);
  assert.deepEqual([primary, detail, source], before);
});

test("matching country or a title found in only one frame cannot establish a bilingual alias", () => {
  const primary = fields({ name: "Peru Copper Mountain", origin_country: "Peru" });
  const detail = fields({ name: "페루 구리 산", origin_country: "Peru", weight_g: 250 });
  assert.deepEqual(mergeLabelDetail(primary, detail), primary);
  for (const which of ["primary", "detail"]) {
    const source = { primary: bilingualObservation(), detail: bilingualObservation() };
    source[which].rows.splice(1, 1);
    assert.deepEqual(mergeLabelDetail(primary, detail, source), primary);
  }
  const source = { primary: bilingualObservation(), detail: bilingualObservation() };
  source.detail.extraction.fields.origin_country = "Brazil";
  assert.deepEqual(mergeLabelDetail(primary, detail, source), primary);
  assert.deepEqual(mergeLabelDetail(primary, fields({ ...detail.fields, name: "다른 산" }), { primary: bilingualObservation(), detail: bilingualObservation() }), primary);
});

test("a bilingual alias cannot erase any established field through conflicting details", () => {
  const source = { primary: bilingualObservation(), detail: bilingualObservation() };
  for (const [field, first, second] of [["origin_country", "Peru", "Brazil"], ["process_method", "natural", "washed"],
    ["roastery", "First Roaster", "Second Roaster"], ["weight_g", 200, 250]]) {
    const primary = fields({ name: "Peru Copper Mountain", origin_country: "Peru", [field]: first });
    const detail = fields({ name: "페루 구리 산", origin_country: "Peru", [field]: second });
    assert.deepEqual(mergeLabelDetail(primary, detail, source), primary);
  }
});

test("conflicting countries or processing in printed titles veto an otherwise adjacent bilingual alias", () => {
  for (const [first, second] of [["Colombia Copper Mountain", "페루 구리 산"], ["Peru Copper Mountain Natural", "페루 구리 산 워시드"],
    ["Copper Mountain", "페루 구리 산"], ["Peru Copper Mountain", "구리 산"]]) {
    const primary = fields({ name: first, origin_country: "Peru" });
    const detail = fields({ name: second, origin_country: "Peru", weight_g: 250 });
    const source = { primary: bilingualObservation(first, second), detail: bilingualObservation(first, second) };
    assert.deepEqual(mergeLabelDetail(primary, detail, source), primary);
  }
});

test("distant, interrupted, unreadable, or duplicated title pairs cannot bypass the product guard", () => {
  const primary = fields({ name: "Peru Copper Mountain", origin_country: "Peru" });
  const detail = fields({ name: "페루 구리 산", origin_country: "Peru", weight_g: 250 });
  for (const mutation of [
    value => { value.rows[1].bbox.x0 += 400; value.rows[1].bbox.x1 += 400; },
    value => { value.rows[1].bbox.y0 += 300; value.rows[1].bbox.y1 += 300; },
    value => { value.rows[1].confidence = 40; },
    value => { value.rows[1].words[0].confidence = 40; },
    value => { value.rows.push(...structuredClone(value.rows.slice(0, 2)).map(row => ({ ...row, bbox: { ...row.bbox, x0: row.bbox.x0 + 400, x1: row.bbox.x1 + 400 } }))); },
    value => { value.rows.splice(1, 0, { ...structuredClone(value.rows[0]), text: "Other product", bbox: { x0: 110, y0: 120, x1: 210, y1: 127 } }); },
  ]) {
    const source = { primary: bilingualObservation(), detail: bilingualObservation() }; mutation(source.detail);
    assert.deepEqual(mergeLabelDetail(primary, detail, source), primary);
  }
});

test("a damaged printed detail row may use the independent engine after releasing Paddle", async t => {
  const h = harness(t, ["Product: Highland AA\nProcess: Washed\n250g1원산지100%"],
    ["Product: Highland AA\nCountry: Kenya\nNet weight: 250g\nProcess: Natural\nNotes: Banana"]);
  const read = await h.reader.recognize(picture(), options());
  assert.equal(read.extraction.fields.name, "Highland AA");
  assert.equal(read.extraction.fields.origin_country, "Kenya");
  assert.equal(read.extraction.fields.weight_g, 250);
  assert.equal(read.extraction.fields.process_method, "washed");
  assert.equal(read.extraction.tasting_notes, undefined);
  const fallback = h.events.findIndex(event => event.event === "create" && event.worker.url.includes("tesseract"));
  const released = h.events.findIndex(event => event.event === "terminate" && event.worker.url.includes("paddle"));
  assert.ok(released >= 0 && fallback > released);
});

test("optional detail preparation failure preserves the primary and a later read recovers", async t => {
  const h = harness(t, ["Product: Highland AA\nProcess: Washed\n250g1원산지100%", "Product: Copper Moon"]);
  const read = await h.reader.recognize(picture(), { ...options(), prepareFallbackImages: async () => { throw new Error("detail preparation failed"); } });
  assert.equal(read.extraction.fields.name, "Highland AA");
  assert.equal(read.extraction.fields.process_method, "washed");
  assert.equal(read.extraction.fields.weight_g, undefined);
  assert.equal((await h.reader.recognize(picture(), options())).extraction.fields.name, "Copper Moon");
});

test("another product found during optional detail recovery cannot supply its missing facts", async t => {
  const h = harness(t, ["Product: Highland AA\nProcess: Washed\n250g1원산지100%"],
    ["Product: Evening Sun\nCountry: Kenya\nNet weight: 250g"]);
  const read = await h.reader.recognize(picture(), options());
  assert.equal(read.extraction.fields.name, "Highland AA");
  assert.equal(read.extraction.fields.origin_country, undefined);
  assert.equal(read.extraction.fields.weight_g, undefined);
});

test("cancellation during optional detail preparation propagates without publishing a completion", async t => {
  const h = harness(t, ["Product: Highland AA\nProcess: Washed\n250g1원산지100%"]);
  const controller = new AbortController(), progress = [];
  await assert.rejects(h.reader.recognize(picture(), { signal: controller.signal, onProgress: value => progress.push(value), prepareFallbackImages: async () => {
    controller.abort();
    throw new DOMException("cancelled", "AbortError");
  } }), { name: "AbortError" });
  assert.equal(progress.some(value => value.phase === "reading" && value.progress === 1), false);
});

test("cancelling in the final progress callback cannot resolve a completed result", async t => {
  const { reader } = harness(t);
  const controller = new AbortController();
  await assert.rejects(reader.recognize(picture(), { signal: controller.signal, onProgress: progress => {
    if (progress.phase === "reading" && progress.progress === 1) controller.abort();
  } }), { name: "AbortError" });
});

test("rereading a different image uses that image's result without retaining old fields", async t => {
  const { reader, workers } = harness(t, ["Product: Copper Moon\nNet weight: 250g", "Product: Evening Sun"]);
  assert.equal((await reader.recognize(picture(), options())).extraction.fields.weight_g, 250);
  const second = await reader.recognize(picture(), options());
  assert.equal(second.extraction.fields.name, "Evening Sun");
  assert.equal(second.extraction.fields.weight_g, undefined);
  assert.equal(workers.length, 1);
});

test("cancelling after a partial prevents a crop, completion and stale callbacks", async t => {
  const { reader, sources } = harness(t);
  const controller = new AbortController(), progress = [];
  const pending = reader.recognize([{ image: picture(), psm: "11", kind: "full" }, { image: picture(), psm: "6", kind: "text" }],
    { signal: controller.signal, onProgress: value => progress.push(value), onPartial: () => controller.abort() });
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(sources.length, 1);
  assert.equal(progress.some(value => value.phase === "reading" && value.progress === 1), false);
});

test("disposing during the configuration download aborts it and permits a fresh read", async t => {
  const { reader, replace, workers } = harness(t);
  let downloadSignal;
  replace("fetch", (_url, { signal }) => new Promise((_resolve, reject) => {
    downloadSignal = signal;
    signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
  }));
  const pending = reader.recognize(picture(), options());
  const rejection = assert.rejects(pending, { name: "AbortError" });
  for (let i = 0; i < 30 && !downloadSignal; i++) await setImmediate();
  assert.ok(downloadSignal);
  reader.dispose();
  await rejection;
  assert.equal(downloadSignal.aborted, true);
  assert.equal(workers.length, 0);
  replace("fetch", async () => ({ ok: true, json: async () => structuredClone(config) }));
  assert.equal((await reader.recognize(picture(), options())).extraction.fields.name, "Copper Moon");
});

test("invalid input and an unavailable configuration fail before creating a worker", async t => {
  const { reader, workers, replace } = harness(t);
  await assert.rejects(reader.recognize(new Blob(["not a PNG"], { type: "image/png" }), options()), /invalid_image/u);
  replace("fetch", async () => ({ ok: false }));
  await assert.rejects(reader.recognize(picture(), options()), /loading_failed/u);
  assert.equal(workers.length, 0);
});

const smallItem = (text, x, y, width = 230, height = 14) => ({ text, score: .99,
  poly: [[x, y], [x + width, y], [x + width, y + height], [x, y + height]] });
const smallLabel = () => ({ image: { width: 1200, height: 1150 }, items: [
  smallItem("Product: Copper Moon", 100, 100, 260, 28), smallItem("Origin: Rwanda", 100, 145),
  smallItem("Process: Washed", 100, 170), smallItem("250 9", 240, 195, 60),
] });
function encodedFrame(width, height) {
  const copy = Buffer.from(bytes);
  copy.writeUInt32BE(width, 16); copy.writeUInt32BE(height, 20);
  return new Blob([copy], { type: "image/png" });
}
function fakeCanvas(h) {
  h.replace("createImageBitmap", async source => ({ source, ...await validateLabelImageBeforeDecode(source), close() {} }));
  h.replace("ImageData", class { constructor(data, width, height) { Object.assign(this, { data, width, height }); } });
  h.replace("document", { createElement: () => {
    const canvas = { width: 0, height: 0, getContext: () => ({ fillRect() {}, drawImage() {},
      getImageData: () => ({ data: new Uint8ClampedArray(canvas.width * canvas.height * 4) }), putImageData() {} }),
    toBlob: callback => queueMicrotask(() => callback(encodedFrame(canvas.width, canvas.height))), };
    return canvas;
  } });
}
function cropReply(full, text = "250 g", additions = []) {
  const primary = fields({ name: "Copper Moon" });
  const region = selectLabelSmallPrintRegion(full, primary) ?? selectLabelSmallPrintRegion(full, fields({ process_method: "washed" }));
  assert.ok(region);
  return { image: region.output, items: [{ ...full.items[3], text }, ...additions].map(row => ({ ...row,
    poly: row.poly.map(([x, y]) => [(x - region.crop.x) * region.output.width / region.crop.width,
      (y - region.crop.y) * region.output.height / region.crop.height]),
  })) };
}

test("one supplemental read adds only the anchored weight and retains every established fact", async t => {
  const full = smallLabel();
  full.items.push(smallItem("Tasting Notes: Berry, Cocoa", 100, 220));
  const extra = cropReply(full, "250 g", [smallItem("Country: Brazil", 100, 145), smallItem("Process: Natural", 100, 170), smallItem("Tasting Notes: Banana", 100, 220)]);
  const h = harness(t, [full, extra]); fakeCanvas(h);
  const partials = [];
  const read = await h.reader.recognize(picture(), { ...options(), onPartial: value => partials.push(structuredClone(value)) });
  assert.equal(h.sources.length, 2);
  const expected = structuredClone(partials[0].extraction);
  assert.deepEqual(expected.tasting_notes.en, ["Berry", "Cocoa"]);
  expected.fields.weight_g = 250; expected.evidence.weight_g = "250 g";
  assert.deepEqual(read.extraction, expected);
  assert.equal(read.text, `${partials[0].text}\n\n250 g`);
  assert.equal(h.workers.length, 1);
});

test("an existing crop remains before the one missing-weight supplement", async t => {
  const full = smallLabel();
  const h = harness(t, [full, "Product: Moon", cropReply(full)]); fakeCanvas(h);
  const photograph = picture(), crop = picture();
  const read = await h.reader.recognize([{ image: photograph, psm: "11", kind: "full" }, { image: crop, psm: "6", kind: "text" }], options());
  assert.deepEqual(h.sources.slice(0, 2), [photograph, crop]);
  assert.equal(h.sources.length, 3);
  assert.equal(read.extraction.fields.weight_g, 250);
});

test("an already readable weight and a non-coffee tiny label create no extra prediction", async t => {
  const full = smallLabel(); full.items[3].text = "250 g";
  const negative = { image: full.image, items: [smallItem("Country: Kenya", 100, 145), smallItem("Moisturizing hand cream", 100, 170), smallItem("250 9", 240, 195, 60)] };
  const h = harness(t, [full, negative]); fakeCanvas(h);
  assert.equal((await h.reader.recognize(picture(), options())).extraction.fields.weight_g, 250);
  const read = await h.reader.recognize(picture(), options());
  assert.equal(read.extraction.fields.weight_g, undefined);
  assert.equal(h.sources.length, 2);
});

test("a crop naming a different product cannot transplant its weight", async t => {
  const full = smallLabel();
  const extra = cropReply(full, "250 g", [smallItem("Product: Other Lot", 100, 100, 260, 28)]);
  const h = harness(t, [full, extra]); fakeCanvas(h);
  const read = await h.reader.recognize(picture(), options());
  assert.equal(read.extraction.fields.name, "Copper Moon");
  assert.equal(read.extraction.fields.weight_g, undefined);
  assert.equal(read.text.includes("Other Lot"), false);
});

test("a failed supplemental inference preserves the primary and the next recognition recovers", async t => {
  const full = smallLabel();
  const h = harness(t, [full, { error: true }, "Product: Evening Sun"]); fakeCanvas(h);
  const partials = [];
  const read = await h.reader.recognize(picture(), { ...options(), onPartial: value => partials.push(structuredClone(value)) });
  assert.deepEqual(read, partials[0]);
  assert.equal(h.workers[0].terminated, true);
  assert.equal((await h.reader.recognize(picture(), options())).extraction.fields.name, "Evening Sun");
  assert.equal(h.workers.length, 2);
});

test("a failed supplement's frame preparation keeps the primary without another prediction", async t => {
  const full = smallLabel(); full.image.width = 1100;
  const h = harness(t, [full]); fakeCanvas(h);
  const read = await h.reader.recognize(picture(), options());
  assert.equal(read.extraction.fields.name, "Copper Moon");
  assert.equal(read.extraction.fields.weight_g, undefined);
  assert.equal(h.sources.length, 1);
});

test("an unsuccessful extra unit reading is never retried", async t => {
  const full = smallLabel();
  const h = harness(t, [full, cropReply(full, "250 q")]); fakeCanvas(h);
  const read = await h.reader.recognize(picture(), options());
  assert.equal(read.extraction.fields.weight_g, undefined);
  assert.equal(h.sources.length, 2);
});

test("cancelling a pending supplemental prediction propagates and ignores its late result", async t => {
  const full = smallLabel(), delayed = { deferred: true };
  const h = harness(t, [full, delayed, "Product: Evening Sun"]); fakeCanvas(h);
  const controller = new AbortController(), partials = [];
  const pending = h.reader.recognize(picture(), { signal: controller.signal, onProgress() {}, onPartial: value => partials.push(value) });
  const rejected = assert.rejects(pending, { name: "AbortError" });
  for (let i = 0; i < 80 && !delayed.respond; i++) await setImmediate();
  assert.ok(delayed.respond);
  controller.abort(); await rejected;
  delayed.respond(cropReply(full)); await setImmediate();
  assert.equal(partials.length, 1);
  assert.equal(h.workers[0].terminated, true);
  assert.equal((await h.reader.recognize(picture(), options())).extraction.fields.name, "Evening Sun");
});

test("cancelling supplemental image decoding settles immediately and its late bitmap cannot affect a new read", async t => {
  const h = harness(t, [smallLabel(), "Product: Evening Sun"]); fakeCanvas(h);
  let decoded = 0, release, closed = 0;
  h.replace("createImageBitmap", async source => {
    if (++decoded === 2) return new Promise(resolve => { release = () => resolve({ source, width: 1200, height: 1150, close() { closed++; } }); });
    return { source, ...await validateLabelImageBeforeDecode(source), close() {} };
  });
  const controller = new AbortController(), partials = [];
  const pending = h.reader.recognize(picture(), { signal: controller.signal, onProgress() {}, onPartial: value => partials.push(value) });
  const rejected = assert.rejects(pending, { name: "AbortError" });
  for (let i = 0; i < 80 && !release; i++) await setImmediate();
  assert.ok(release);
  controller.abort(); await rejected;
  assert.equal(h.sources.length, 1);
  assert.equal((await h.reader.recognize(picture(), options())).extraction.fields.name, "Evening Sun");
  release(); await setImmediate();
  assert.equal(closed, 1);
  assert.equal(partials.length, 1);
});

test("supplemental weight cannot supply a name or change the independent-engine gate", async t => {
  const full = smallLabel(); full.items[0].text = "Variety: Bourbon";
  const extra = cropReply(full, "250 g", [smallItem("Product: Another Lot", 100, 100, 260, 28)]);
  const h = harness(t, [full, extra], ["Product: Another Lot\nCountry: Brazil"]); fakeCanvas(h);
  const read = await h.reader.recognize(picture(), options());
  assert.equal(read.extraction.fields.name, undefined);
  assert.equal(read.extraction.fields.origin_country, "Rwanda");
  assert.equal(read.extraction.fields.weight_g, 250);
  const fallback = h.events.findIndex(e => e.event === "create" && e.worker.url.includes("tesseract"));
  const detectorClosed = h.events.findIndex(e => e.event === "terminate" && e.worker.url.includes("paddle"));
  assert.ok(fallback > detectorClosed && detectorClosed >= 0);
});
