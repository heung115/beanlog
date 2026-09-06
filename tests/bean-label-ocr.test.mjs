import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { createBrowserLabelReader } from "../src/lib/coffee/bean-label-ocr.ts";

const imageBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const image = new Blob([imageBytes], { type: "image/png" });
const recognizedText = "Product: Test Coffee\nRoaster: Local Roastery\nOrigin: Ethiopia";
const initialActions = ["load", "loadLanguage", "initialize", "setParameters"];
const emptyOptions = () => ({ signal: new AbortController().signal, onProgress() {} });

function harness(t) {
  const previousWorker = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  const workers = [];

  class FakeWorker {
    constructor(url) {
      this.url = url;
      this.requests = [];
      this.terminateCalls = 0;
      this.throwOnPost = false;
      workers.push(this);
    }

    postMessage(message, transfer) {
      if (this.throwOnPost) throw new Error("Private worker transport failure");
      this.requests.push({ ...message, transfer, answered: false });
    }

    terminate() {
      this.terminateCalls += 1;
    }

    async waitFor(action) {
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const request = this.requests.find((request) => request.action === action && !request.answered);
        if (request) return request;
        await setImmediate();
      }
      assert.fail(`Expected pending ${action}; observed ${this.requests.map(({ action }) => action).join(", ")}`);
    }

    respond(request, data = {}, status = "resolve") {
      request.answered = status !== "progress";
      // Deliver even after terminate to exercise protection against queued old events.
      this.onmessage?.({ data: {
        workerId: request.workerId, jobId: request.jobId, action: request.action, status, data,
      } });
    }

    crash(kind = "error") {
      if (kind === "messageerror") this.onmessageerror?.({});
      else {
        let prevented = false;
        this.onerror?.({ message: "Private worker path and text", preventDefault() { prevented = true; } });
        assert.equal(prevented, true);
      }
    }
  }

  Object.defineProperty(globalThis, "Worker", { configurable: true, writable: true, value: FakeWorker });
  const reader = createBrowserLabelReader();
  t.after(() => {
    reader.dispose();
    if (previousWorker) Object.defineProperty(globalThis, "Worker", previousWorker);
    else delete globalThis.Worker;
  });
  return { reader, workers };
}

async function initialize(worker) {
  for (const action of initialActions) worker.respond(await worker.waitFor(action));
}

async function complete(worker, text = recognizedText) {
  const request = await worker.waitFor("recognize");
  worker.respond(request, { text });
  return request;
}

async function retrySuccessfully(reader, workers) {
  const retried = reader.recognize(image, emptyOptions());
  const worker = workers.at(-1);
  await initialize(worker);
  await complete(worker);
  assert.equal((await retried).extraction.fields.name, "Test Coffee");
  assert.equal(worker.terminateCalls, 0);
  return worker;
}

test("two complementary image views reuse one worker and merge only consistent facts", async (t) => {
  const { reader, workers } = harness(t);
  const read = reader.recognize([{ image, psm: "11", kind: "full" }, { image, psm: "6", kind: "text" }], emptyOptions());
  const worker = workers[0]; await initialize(worker);
  const sparse = await worker.waitFor("setParameters");
  assert.equal(sparse.payload.params.tessedit_pageseg_mode, "11"); worker.respond(sparse);
  await complete(worker, "Roaster: Small Roastery\nProduct: House Blend");
  const block = await worker.waitFor("setParameters");
  assert.equal(block.payload.params.tessedit_pageseg_mode, "6"); worker.respond(block);
  await complete(worker, "Product: House Blend\nEthiopia 60%\nEthiopia 40%\n200g");
  const result = await read;
  assert.equal(workers.length, 1);
  assert.equal(result.extraction.fields.roastery, "Small Roastery");
  assert.equal(result.extraction.fields.weight_g, 200);
  assert.deepEqual(result.extraction.fields.blend_components.map(c => c.percentage), [60, 40]);
  assert.equal(worker.requests.filter(r => r.action === "loadLanguage").length, 1);
  reader.dispose();
});

test("cancelling between image passes stops the worker and discards partial extraction", async (t) => {
  const { reader, workers } = harness(t); const controller = new AbortController();
  const read = reader.recognize([{ image, psm: "6", kind: "full" }, { image, psm: "11", kind: "text" }], { ...emptyOptions(), signal: controller.signal });
  const rejected = assert.rejects(read, { name: "AbortError" });
  const worker = workers[0]; await initialize(worker); await complete(worker);
  const next = await worker.waitFor("setParameters"); controller.abort(); worker.respond(next);
  await rejected; assert.equal(worker.terminateCalls, 1);
  assert.equal(worker.requests.filter(r => r.action === "recognize").length, 1);
  await retrySuccessfully(reader, workers);
});

test("browser OCR initializes local Korean and English assets and reuses its successful worker", async (t) => {
  const { reader, workers } = harness(t);
  const progress = [];
  const first = reader.recognize(image, { ...emptyOptions(), onProgress: (value) => progress.push(value) });
  const worker = workers[0];
  assert.equal(worker.url, "/ocr/tesseract-7.0.0/worker.min.js");
  await initialize(worker);
  const request = await worker.waitFor("recognize");
  assert.equal(worker.requests[0].payload.options.corePath, "/ocr/tesseract-7.0.0/core");
  assert.equal(worker.requests[1].payload.options.langPath, "/ocr/tesseract-7.0.0/lang");
  assert.equal(worker.requests[1].payload.langs, "kor+eng");
  assert.equal(worker.requests[2].payload.langs, "kor+eng");
  assert.equal(worker.requests[2].payload.oem, 1);
  assert.deepEqual(request.payload.image, imageBytes);
  assert.deepEqual(request.transfer, [request.payload.image.buffer]);
  assert.deepEqual(request.payload.output, { text: true, blocks: true });
  worker.respond(request, { text: recognizedText });
  assert.equal((await first).extraction.fields.name, "Test Coffee");
  assert.deepEqual(progress.at(-1), { phase: "reading", progress: 1 });

  const second = reader.recognize(image, emptyOptions());
  await complete(worker, "Product: Second Coffee");
  assert.equal((await second).extraction.fields.name, "Second Coffee");
  assert.equal(workers.length, 1);
  assert.equal(worker.terminateCalls, 0);
  assert.deepEqual(worker.requests.map(({ action }) => action), [...initialActions, "recognize", "recognize"]);
});

for (const stage of ["load", "loadLanguage"]) {
  test(`abort during ${stage} immediately terminates the worker and permits an immediate retry`, async (t) => {
    const { reader, workers } = harness(t);
    const controller = new AbortController();
    const first = reader.recognize(image, { ...emptyOptions(), signal: controller.signal });
    const aborted = assert.rejects(first, { name: "AbortError" });
    const oldWorker = workers[0];
    if (stage === "loadLanguage") oldWorker.respond(await oldWorker.waitFor("load"));
    const oldRequest = await oldWorker.waitFor(stage);
    controller.abort();
    assert.equal(oldWorker.terminateCalls, 1);

    // Retry before the old recognize() promise's finally block runs.
    const retried = reader.recognize(image, emptyOptions());
    const newWorker = workers[1];
    oldWorker.respond(oldRequest);
    await aborted;
    await assert.rejects(reader.recognize(image, emptyOptions()), { message: "recognition_failed" });
    assert.equal(newWorker.terminateCalls, 0);
    await initialize(newWorker);
    await complete(newWorker);
    assert.equal((await retried).text, recognizedText);
  });
}

for (const stage of ["load", "loadLanguage", "initialize", "setParameters"]) {
  test(`a rejected ${stage} reclaims the worker, hides internal errors, and can be retried`, async (t) => {
    const { reader, workers } = harness(t);
    const first = reader.recognize(image, emptyOptions());
    const rejected = assert.rejects(first, { message: "loading_failed" });
    const worker = workers[0];
    for (const action of initialActions) {
      const request = await worker.waitFor(action);
      if (action === stage) {
        worker.respond(request, "Private path / OCR text / backend error", "reject");
        break;
      }
      worker.respond(request);
    }
    assert.equal(worker.terminateCalls, 1);
    await rejected;
    await retrySuccessfully(reader, workers);
    assert.equal(workers.length, 2);
  });
}

for (const kind of ["error", "messageerror"]) {
  for (const phase of ["loading", "reading"]) {
    test(`worker ${kind} during ${phase} terminates and allows a clean retry`, async (t) => {
      const { reader, workers } = harness(t);
      const first = reader.recognize(image, emptyOptions());
      const rejected = assert.rejects(first, { message: phase === "loading" ? "loading_failed" : "recognition_failed" });
      const worker = workers[0];
      if (phase === "reading") {
        await initialize(worker);
        await worker.waitFor("recognize");
      }
      worker.crash(kind);
      assert.equal(worker.terminateCalls, 1);
      await rejected;
      await retrySuccessfully(reader, workers);
      assert.equal(workers.length, 2);
    });
  }
}

test("a concurrent recognition is rejected without interrupting the active read", async (t) => {
  const { reader, workers } = harness(t);
  const first = reader.recognize(image, emptyOptions());
  await assert.rejects(reader.recognize(image, emptyOptions()), { message: "recognition_failed" });
  assert.equal(workers.length, 1);
  assert.equal(workers[0].terminateCalls, 0);
  await initialize(workers[0]);
  await complete(workers[0]);
  assert.equal((await first).text, recognizedText);
});

test("dispose rejects the active read, and the old signal cannot cancel its replacement", async (t) => {
  const { reader, workers } = harness(t);
  const oldController = new AbortController();
  const first = reader.recognize(image, { ...emptyOptions(), signal: oldController.signal });
  const aborted = assert.rejects(first, { name: "AbortError" });
  const oldWorker = workers[0];
  reader.dispose();
  assert.equal(oldWorker.terminateCalls, 1);
  const replacementController = new AbortController();
  const replacement = reader.recognize(image, { ...emptyOptions(), signal: replacementController.signal });
  const newWorker = workers[1];
  oldController.abort();
  assert.equal(replacementController.signal.aborted, false);
  assert.equal(newWorker.terminateCalls, 0);
  oldWorker.respond(oldWorker.requests[0]);
  oldWorker.crash();
  assert.equal(newWorker.terminateCalls, 0);
  await aborted;
  await initialize(newWorker);
  await complete(newWorker);
  assert.equal((await replacement).text, recognizedText);
});

test("an idle disposed reader creates a new worker when reused", async (t) => {
  const { reader, workers } = harness(t);
  const oldWorker = await retrySuccessfully(reader, workers);
  reader.dispose();
  reader.dispose();
  assert.equal(oldWorker.terminateCalls, 1);
  const newWorker = await retrySuccessfully(reader, workers);
  assert.notEqual(newWorker, oldWorker);
  assert.equal(workers.length, 2);
});

test("raw OCR text remains available when the rule parser finds no supported fields", async (t) => {
  const { reader, workers } = harness(t);
  const pending = reader.recognize(image, emptyOptions());
  await initialize(workers[0]);
  await complete(workers[0], "  Enjoy your morning.\nPrinted for our community.  ");
  assert.deepEqual(await pending, {
    text: "Enjoy your morning.\nPrinted for our community.",
    extraction: { bean_type: "unknown", fields: {}, evidence: {} },
  });
});

test("malformed OCR output rejects without retaining the worker and permits retry", async (t) => {
  const { reader, workers } = harness(t);
  const pending = reader.recognize(image, emptyOptions());
  const rejected = assert.rejects(pending, { message: "recognition_failed" });
  await initialize(workers[0]);
  workers[0].respond(await workers[0].waitFor("recognize"), { text: { unexpected: "object" } });
  await rejected;
  assert.equal(workers[0].terminateCalls, 1);
  await retrySuccessfully(reader, workers);
});

for (const cancel of ["abort", "dispose"]) {
  test(`${cancel} from the completion callback cannot return a stale successful result`, async (t) => {
    const { reader, workers } = harness(t);
    const controller = new AbortController();
    const pending = reader.recognize(image, {
      signal: controller.signal,
      onProgress({ phase, progress }) {
        if (phase === "reading" && progress === 1) {
          if (cancel === "abort") controller.abort();
          else reader.dispose();
        }
      },
    });
    const rejected = assert.rejects(pending, { name: "AbortError" });
    await initialize(workers[0]);
    await complete(workers[0]);
    await rejected;
    assert.equal(workers[0].terminateCalls, 1);
    await retrySuccessfully(reader, workers);
  });
}

for (const phase of ["loading", "reading"]) {
  test(`cancel and immediate retry from ${phase} progress cannot post old work to the new worker`, async (t) => {
    const { reader, workers } = harness(t);
    const controller = new AbortController();
    let replacement;
    const first = reader.recognize(image, {
      signal: controller.signal,
      onProgress(update) {
        if (update.phase === phase && update.progress === 0 && !replacement) {
          controller.abort();
          replacement = reader.recognize(image, emptyOptions());
        }
      },
    });
    const aborted = assert.rejects(first, { name: "AbortError" });
    if (phase === "reading") await initialize(workers[0]);
    await aborted;
    const newWorker = workers[1];
    assert.equal(workers[0].terminateCalls, 1);
    assert.equal(newWorker.terminateCalls, 0);
    assert.deepEqual(newWorker.requests.map(({ action }) => action), ["load"]);
    await initialize(newWorker);
    await complete(newWorker);
    assert.equal((await replacement).text, recognizedText);
  });
}

for (const action of ["loadLanguage", "recognize"]) {
  test(`a synchronous ${action} transport error releases the worker for retry`, async (t) => {
    const { reader, workers } = harness(t);
    const first = reader.recognize(image, emptyOptions());
    const rejected = assert.rejects(first, { message: action === "recognize" ? "recognition_failed" : "loading_failed" });
    const worker = workers[0];
    const precedingActions = action === "loadLanguage" ? ["load"] : initialActions;
    for (const preceding of precedingActions) {
      const request = await worker.waitFor(preceding);
      if (preceding === precedingActions.at(-1)) worker.throwOnPost = true;
      worker.respond(request);
    }
    await rejected;
    assert.equal(worker.terminateCalls, 1);
    await retrySuccessfully(reader, workers);
  });
}

test("a failed printed weight is reread from pixels without replacing other recognized facts", async (t) => {
  const { reader, workers } = harness(t);
  let preparations = 0;
  const read = reader.recognize(image, { ...emptyOptions(), prepareWeightRetry: async () => { preparations += 1; return image; } });
  const worker = workers[0]; await initialize(worker);
  await complete(worker, "Product: Original Coffee\n내용량: 250 0");
  await complete(worker, "Product: Garbled Alternate\n내용량: 250 g");
  const result = await read;
  assert.equal(preparations, 1);
  assert.equal(result.extraction.fields.name, "Original Coffee");
  assert.equal(result.extraction.fields.weight_g, 250);
  assert.equal(result.extraction.evidence.weight_g, "내용량: 250 g");
  assert.match(result.text, /내용량: 250 0/u);
  assert.match(result.text, /내용량: 250 g/u);
});

for (const text of ["Net weight: 250 g", "Product: 250 0", "Product: Test Coffee"]) {
  test(`weight retry does not run for valid or absent package weights: ${text}`, async (t) => {
    const { reader, workers } = harness(t);
    const read = reader.recognize(image, { ...emptyOptions(), prepareWeightRetry: async () => assert.fail("unneeded retry") });
    await initialize(workers[0]); await complete(workers[0], text); await read;
    assert.equal(workers[0].requests.filter(r => r.action === "recognize").length, 1);
  });
}

test("another unreadable unit remains empty after the weight retry", async (t) => {
  const { reader, workers } = harness(t);
  const read = reader.recognize(image, { ...emptyOptions(), prepareWeightRetry: async () => image });
  await initialize(workers[0]); await complete(workers[0], "내용량: 250 0"); await complete(workers[0], "내용량: 2509");
  assert.equal((await read).extraction.fields.weight_g, undefined);
});

test("cancelling a pending weight enlargement cannot publish the earlier partial read", async (t) => {
  const { reader, workers } = harness(t);
  const controller = new AbortController();
  let release;
  let started;
  const preparing = new Promise(resolve => { started = resolve; });
  const read = reader.recognize(image, { signal: controller.signal, onProgress() {}, prepareWeightRetry: () => {
    started(); return new Promise(resolve => { release = resolve; });
  } });
  const rejected = assert.rejects(read, { name: "AbortError" });
  await initialize(workers[0]); await complete(workers[0], "Product: Original Coffee\n내용량: 250 0");
  await preparing; controller.abort(); release(image); await rejected;
  assert.equal(workers[0].requests.filter(r => r.action === "recognize").length, 1);
  assert.equal(workers[0].terminateCalls, 1);
  await retrySuccessfully(reader, workers);
});


test("partial callbacks publish completed views before the final result", async (t) => {
  const { reader, workers } = harness(t);
  const snapshots = [];
  const read = reader.recognize([{ image, psm: "6", kind: "text" }, { image, psm: "11", kind: "full" }], {
    ...emptyOptions(), onPartial: result => snapshots.push(result),
  });
  const worker = workers[0]; await initialize(worker);
  await complete(worker, "Product: First Coffee");
  const sparse = await worker.waitFor("setParameters");
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].extraction.fields.name, "First Coffee");
  assert.equal(snapshots[0].extraction.fields.roastery, undefined);
  worker.respond(sparse);
  await complete(worker, "Roaster: Small Roastery");
  const result = await read;
  assert.equal(snapshots.length, 2);
  assert.equal(snapshots[0].extraction.fields.roastery, undefined);
  assert.deepEqual(snapshots[1], result);
});

for (const cancel of ["abort", "dispose"]) {
  test(`${cancel} from a partial callback prevents later reads and final publication`, async (t) => {
    const { reader, workers } = harness(t);
    const controller = new AbortController();
    const read = reader.recognize([{ image, psm: "6", kind: "text" }, { image, psm: "11", kind: "full" }], {
      signal: controller.signal, onProgress() {},
      onPartial() { if (cancel === "abort") controller.abort(); else reader.dispose(); },
    });
    const rejected = assert.rejects(read, { name: "AbortError" });
    const worker = workers[0]; await initialize(worker); await complete(worker);
    await rejected;
    assert.equal(worker.requests.filter(request => request.action === "recognize").length, 1);
    await retrySuccessfully(reader, workers);
  });
}

function localPixels(t) {
  const descriptors = new Map(["Image", "document"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  class FakeImage {
    naturalWidth = 400;
    naturalHeight = 400;
    src = "";
    async decode() {}
  }
  const context = { fillRect() {}, drawImage() {} };
  const document = { createElement: () => ({ width: 0, height: 0, getContext: () => context, toBlob: callback => callback(image) }) };
  Object.defineProperty(globalThis, "Image", { configurable: true, value: FakeImage });
  Object.defineProperty(globalThis, "document", { configurable: true, value: document });
  t.after(() => {
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
}

const numericWordOutput = {
  text: "Product: Test Coffee\nApple, Honey, Tea 3509", confidence: 88,
  blocks: [{ paragraphs: [{ lines: [{ text: "Apple, Honey, Tea 3509", words: [
    { text: "Apple," }, { text: "Honey," }, { text: "Tea" }, { text: "3509", bbox: { x0: 90, y0: 100, x1: 150, y1: 125 } },
  ] }] }] }],
};

for (const confidence of [90, 20]) {
  test(`an observed numeric token needs an independently read unit and sufficient confidence (${confidence})`, async (t) => {
    const { reader, workers } = harness(t); localPixels(t);
    const read = reader.recognize(image, emptyOptions());
    const worker = workers[0]; await initialize(worker);
    worker.respond(await worker.waitFor("recognize"), numericWordOutput);
    const rawLine = await worker.waitFor("setParameters");
    assert.equal(rawLine.payload.params.tessedit_pageseg_mode, "13"); worker.respond(rawLine);
    worker.respond(await worker.waitFor("recognize"), { text: "3509", confidence: 98 });
    const english = await worker.waitFor("initialize");
    assert.equal(english.payload.langs, "eng"); worker.respond(english);
    const singleLine = await worker.waitFor("setParameters");
    assert.equal(singleLine.payload.params.tessedit_pageseg_mode, "7");
    assert.equal(singleLine.payload.params.tessedit_char_whitelist, undefined); worker.respond(singleLine);
    worker.respond(await worker.waitFor("recognize"), { text: "350g", confidence });
    const result = await read;
    assert.equal(result.extraction.fields.weight_g, confidence >= 70 ? 350 : undefined);
    assert.equal(workers.length, 1);
    assert.equal(worker.requests.filter(request => request.action === "loadLanguage").length, 1);

    // An English-only refinement must not leave the next Korean label on English.
    const next = reader.recognize(image, emptyOptions());
    const bilingual = await worker.waitFor("initialize");
    assert.equal(bilingual.payload.langs, "kor+eng"); worker.respond(bilingual);
    const block = await worker.waitFor("setParameters");
    assert.equal(block.payload.params.tessedit_pageseg_mode, "6"); worker.respond(block);
    await complete(worker, "상품명: 다음 커피");
    assert.equal((await next).extraction.fields.name, "다음 커피");
    assert.equal(workers.length, 1);
  });
}

test("cancelling the English token refinement releases it before a fresh Korean read", async (t) => {
  const { reader, workers } = harness(t); localPixels(t);
  const controller = new AbortController();
  const read = reader.recognize(image, { ...emptyOptions(), signal: controller.signal });
  const rejected = assert.rejects(read, { name: "AbortError" });
  const worker = workers[0]; await initialize(worker);
  worker.respond(await worker.waitFor("recognize"), numericWordOutput);
  worker.respond(await worker.waitFor("setParameters"));
  worker.respond(await worker.waitFor("recognize"), { text: "3509", confidence: 98 });
  const english = await worker.waitFor("initialize");
  controller.abort(); worker.respond(english);
  await rejected;
  assert.equal(worker.terminateCalls, 1);
  await retrySuccessfully(reader, workers);
});

for (const body of ["Dose: 20g", "Protein: 30g", "Brew recipe\n20g", "Date\n2026", "Order No. 3592"]) {
  test(`a numeric refinement preserves excluded source context: ${body.replaceAll("\n", " / ")}`, async (t) => {
    const { reader, workers } = harness(t);
    const read = reader.recognize(image, emptyOptions());
    const worker = workers[0]; await initialize(worker);
    const lines = body.split("\n").map(text => ({ text, words: text.split(" ").map(text => ({ text, bbox: { x0: 20, y0: 40, x1: 70, y1: 65 } })) }));
    worker.respond(await worker.waitFor("recognize"), { text: `Product: Test Coffee\n${body}`, confidence: 90,
      blocks: [{ paragraphs: [{ lines }] }],
    });
    const result = await read;
    assert.equal(result.extraction.fields.weight_g, undefined);
    assert.equal(worker.requests.filter(request => request.action === "recognize").length, 1);
  });
}

test("a later full scan missing a closing parenthesis preserves the complete partial bean name", async (t) => {
  const { reader, workers } = harness(t);
  const completeName = "지에이 블렌드(그린애플쥬스 블렌드)";
  const component = "Ethiopia Gedeb Chorso 74110, Kurume Washed 60%";
  // These two views reconstruct the conflicting readings visible in the combined
  // browser OCR text. A shared composition line is deduplicated in that display.
  const textView = [completeName, component, "Ethiopie Bursa Main Station 74 158 White Honey 40%"].join("\n");
  const fullView = ["COFFEE ROASTERS", "FROM. MALIC", "FAVORITE COFFEE", completeName.slice(0, -1),
    component, "Ethiopie Bursa Main Station 74158 White Honey 40%"].join("\n");
  const snapshots = [];
  const read = reader.recognize([{ image, psm: "6", kind: "text" }, { image, psm: "11", kind: "full" }], {
    ...emptyOptions(), onPartial: result => snapshots.push(result),
  });
  const worker = workers[0]; await initialize(worker);
  await complete(worker, textView);
  const sparse = await worker.waitFor("setParameters");
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].extraction.fields.name, completeName);
  assert.equal(sparse.payload.params.tessedit_pageseg_mode, "11"); worker.respond(sparse);
  await complete(worker, fullView);
  const result = await read;
  assert.equal(snapshots.length, 2);
  assert.equal(snapshots[1].extraction.fields.name, completeName);
  assert.equal(result.extraction.fields.name, completeName);
  assert.equal(result.extraction.evidence.name, completeName);
});

test("a full scan with genuinely different name letters remains an unresolved conflict", async (t) => {
  const { reader, workers } = harness(t);
  const snapshots = [];
  const read = reader.recognize([{ image, psm: "6", kind: "text" }, { image, psm: "11", kind: "full" }], {
    ...emptyOptions(), onPartial: result => snapshots.push(result),
  });
  const worker = workers[0]; await initialize(worker);
  await complete(worker, "Product: 지에이 블렌드(그린애플쥬스 블렌드)");
  const sparse = await worker.waitFor("setParameters"); worker.respond(sparse);
  await complete(worker, "Product: Other Blend");
  const result = await read;
  assert.equal(snapshots[0].extraction.fields.name, "지에이 블렌드(그린애플쥬스 블렌드)");
  assert.equal(snapshots[1].extraction.fields.name, undefined);
  assert.equal(result.extraction.fields.name, undefined);
  assert.equal(result.extraction.evidence.name, undefined);
});

function brandPixels(t) {
  localPixels(t);
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "createImageBitmap");
  Object.defineProperty(globalThis, "createImageBitmap", { configurable: true, value: async () => ({ width: 400, height: 400, close() {} }) });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, "createImageBitmap", descriptor);
    else delete globalThis.createImageBitmap;
  });
}

function brandOutput(marker = "FROM.", word = "NRIVER", confidence = 20) {
  return { text: `COFFEE ROASTERS\n${marker} ${word}\nFAVORITE COFFEE\nEvening Blend\nBrazil 70%\nPeru 30%\n250g`,
    blocks: [{ paragraphs: [{ lines: [{ text: `${marker} ${word}`, words: [
      { text: marker, confidence: 30, bbox: { x0: 20, y0: 20, x1: 80, y1: 40 } },
      { text: word, confidence, bbox: { x0: 90, y0: 20, x1: 180, y1: 40 } },
    ] }] }] }],
  };
}

for (const [marker, observed, reread, confidence, expected] of [
  ["FROM.", "NRIVER", "RIVER", 55, "RIVER"],
  ["FYROM.", "RIVER", "RIVER", 40, "RIVER"],
  ["FROM.", "NRIVER", "RIVER", 25, "NRIVER"],
  ["FROM.", "NRIVER", "OTHER", 95, "NRIVER"],
  ["FROM.", "NRIVER", "", 95, "NRIVER"],
]) {
  test(`same-image brand refinement preserves all other fields (${marker} ${observed} → ${reread || "empty"}, ${confidence})`, async t => {
    const { reader, workers } = harness(t); brandPixels(t);
    const partials = [];
    const read = reader.recognize(image, { ...emptyOptions(), onPartial: result => partials.push(result) });
    const worker = workers[0]; await initialize(worker);
    worker.respond(await worker.waitFor("recognize"), brandOutput(marker, observed));
    const english = await worker.waitFor("initialize");
    assert.equal(english.payload.langs, "eng"); worker.respond(english);
    const line = await worker.waitFor("setParameters");
    assert.equal(line.payload.params.tessedit_pageseg_mode, "7"); worker.respond(line);
    worker.respond(await worker.waitFor("recognize"), { text: reread, confidence });
    const result = await read;
    assert.equal(result.extraction.fields.roastery, expected);
    assert.equal(result.extraction.fields.name, "Evening Blend");
    assert.equal(result.extraction.fields.weight_g, 250);
    assert.deepEqual(result.extraction.fields.blend_components.map(row => row.percentage), [70, 30]);
    assert.ok(partials.every(result => result.extraction.fields.name === "Evening Blend"));
    assert.equal(worker.requests.filter(request => request.action === "loadLanguage").length, 1);
  });
}

test("an explicit conflicting roastery cannot be filled by a weaker FROM region", async t => {
  const { reader, workers } = harness(t);
  const read = reader.recognize(image, emptyOptions());
  const worker = workers[0]; await initialize(worker);
  const output = brandOutput();
  output.text += "\nRoaster: First Roastery\nRoaster: Second Roastery";
  worker.respond(await worker.waitFor("recognize"), output);
  assert.equal((await read).extraction.fields.roastery, undefined);
  assert.equal(worker.requests.filter(request => request.action === "recognize").length, 1);
});

test("cancelling a brand reread stops its worker before a late result and permits retry", async t => {
  const { reader, workers } = harness(t); brandPixels(t);
  const controller = new AbortController();
  const read = reader.recognize(image, { ...emptyOptions(), signal: controller.signal });
  const rejected = assert.rejects(read, { name: "AbortError" });
  const worker = workers[0]; await initialize(worker);
  worker.respond(await worker.waitFor("recognize"), brandOutput());
  worker.respond(await worker.waitFor("initialize"));
  worker.respond(await worker.waitFor("setParameters"));
  const request = await worker.waitFor("recognize");
  controller.abort(); worker.respond(request, { text: "RIVER", confidence: 90 });
  await rejected;
  assert.equal(worker.terminateCalls, 1);
  await retrySuccessfully(reader, workers);
});

test("detail rereads fill missing facts while preserving names, cup notes and known origins", async t => {
  const { reader, workers } = harness(t);
  const snapshots = [];
  const read = reader.recognize(image, { ...emptyOptions(), onPartial: result => snapshots.push(result),
    prepareDetailRetries: async () => [{ image, kind: "full", psm: "11" }],
  });
  const worker = workers[0]; await initialize(worker);
  await complete(worker, "Product: Original Coffee\nOrigin: Ethiopia\nCup notes: Apple, Honey");
  const sparse = await worker.waitFor("setParameters"); worker.respond(sparse);
  await complete(worker, "Product: Different Coffee");
  await complete(worker, "Product: Different Coffee\nRoaster: River\nBrazil 60%\nPeru 40%\n250g\nCup notes: Cherry, Chocolate, Caramel");
  const result = (await read).extraction;
  assert.equal(result.fields.name, "Original Coffee");
  assert.equal(result.fields.roastery, "River");
  assert.equal(result.fields.weight_g, 250);
  assert.equal(result.fields.origin_country, "Ethiopia");
  assert.equal(result.fields.blend_components, undefined);
  assert.deepEqual(result.tasting_notes.en, ["Apple", "Honey"]);
  assert.ok(snapshots.every(result => result.extraction.fields.name === "Original Coffee"));
});

test("complete basic information avoids extra contrast reads", async t => {
  const { reader, workers } = harness(t);
  const read = reader.recognize(image, { ...emptyOptions(), prepareDetailRetries: () => assert.fail("unnecessary detail read") });
  await initialize(workers[0]); await complete(workers[0], "Product: Daily Coffee\n250g");
  assert.equal((await read).extraction.fields.name, "Daily Coffee");
  assert.equal(workers[0].requests.filter(request => request.action === "recognize").length, 1);
});

test("a recovered native-size title survives an enlarged reading with a damaged final letter", async t => {
  const { reader, workers } = harness(t);
  const read = reader.recognize(image, { ...emptyOptions(), prepareDetailRetries: async options => {
    assert.equal(options.includeColor, true);
    return [{ image, kind: "full", psm: "11" }];
  } });
  const worker = workers[0]; await initialize(worker); await complete(worker, "COFFEE");
  worker.respond(await worker.waitFor("setParameters"));
  await complete(worker, "Product: Everyday Espresso");
  await complete(worker, "Product: Everyday Espress\n1kg");
  const result = (await read).extraction;
  assert.equal(result.fields.name, "Everyday Espresso");
  assert.equal(result.fields.weight_g, 1000);
});

test("an explicit name disagreement stays unresolved after a detail reread", async t => {
  const { reader, workers } = harness(t);
  const read = reader.recognize(image, { ...emptyOptions(), prepareDetailRetries: async () => [{ image, kind: "full", psm: "6" }] });
  await initialize(workers[0]); await complete(workers[0], "Product: First Coffee\nProduct: Second Coffee");
  workers[0].respond(await workers[0].waitFor("setParameters"));
  await complete(workers[0], "Product: Third Coffee");
  workers[0].respond(await workers[0].waitFor("setParameters"));
  await complete(workers[0], "Product: Third Coffee\n250g");
  const result = (await read).extraction;
  assert.equal(result.fields.name, undefined);
  assert.equal(result.fields.weight_g, 250);
});

test("cancelling a pending detail preparation prevents later pixel reads", async t => {
  const { reader, workers } = harness(t);
  const controller = new AbortController(); let release; let prepared;
  const ready = new Promise(resolve => { prepared = resolve; });
  const read = reader.recognize(image, { ...emptyOptions(), signal: controller.signal,
    prepareDetailRetries: () => { prepared(); return new Promise(resolve => { release = resolve; }); },
  });
  const rejected = assert.rejects(read, { name: "AbortError" });
  await initialize(workers[0]); await complete(workers[0], "COFFEE");
  workers[0].respond(await workers[0].waitFor("setParameters"));
  await complete(workers[0], "COFFEE");
  await ready; controller.abort(); release([{ image, psm: "11", kind: "full" }]);
  await rejected;
  assert.equal(workers[0].requests.filter(request => request.action === "recognize").length, 2);
  await retrySuccessfully(reader, workers);
});
