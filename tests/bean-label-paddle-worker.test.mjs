import assert from "node:assert/strict";
import test from "node:test";
import { PaddleWorkerClient } from "../src/lib/coffee/bean-label-paddle-worker.ts";

globalThis.location = new URL("https://coffee.example/");
const pause = () => new Promise(resolve => setTimeout(resolve, 0));
const configuration = () => ({
  pipelineConfig: { assets: { det: { url: "models/det.tar" }, rec: { url: "models/rec.tar" } },
    textDetectionBatchSize: 1, textRecognitionBatchSize: 1 },
  ortOptions: { backend: "wasm", wasmPaths: "ort/", numThreads: 1, simd: true, proxy: false },
});
const initialized = () => ({ summary: { backend: "wasm", detProvider: "wasm", recProvider: "wasm",
  webgpuAvailable: false, assets: [], elapsedMs: 1, pipelineConfigWarnings: [] } });
const recognized = () => [{ image: { width: 10, height: 10 }, items: [{ poly: [[1, 1], [9, 1], [9, 9], [1, 9]], text: "Printed label", score: 0.9 }] }];

function setup(overrides = {}) {
  const workers = [];
  const client = new PaddleWorkerClient({ baseUrl: "/ocr/paddle-test/", options: configuration(),
    createWorker(url) {
      const worker = { url: url.href, messages: [], terminated: 0,
        postMessage(message) { this.messages.push(message); },
        terminate() { this.terminated++; },
        answer(payload, index = this.messages.length - 1) {
          this.onmessage?.({ data: { kind: "worker-transport-response", status: "success", requestId: this.messages[index].requestId, payload } });
        },
        fail(detail, index = this.messages.length - 1) {
          this.onmessage?.({ data: { kind: "worker-transport-response", status: "error", requestId: this.messages[index].requestId, error: { message: detail, stack: detail } } });
        },
      };
      workers.push(worker); return worker;
    }, ...overrides });
  return { client, workers };
}
async function ready(context) {
  const pending = context.client.initialize(); context.workers.at(-1).answer(initialized()); await pending;
}
async function release(context) {
  const pending = context.client.dispose();
  if (context.workers.at(-1)?.messages.at(-1)?.type === "dispose") context.workers.at(-1).answer({});
  await pending;
}

test("Paddle initialization owns one worker synchronously and shares the initialization request", async () => {
  const { client, workers } = setup();
  const first = client.initialize(), second = client.initialize();
  assert.equal(workers.length, 1); assert.equal(workers[0].messages.length, 1);
  assert.equal(workers[0].url, "https://coffee.example/ocr/paddle-test/worker.js");
  const options = workers[0].messages[0].payload.options;
  assert.equal(options.ortOptions.wasmPaths, "https://coffee.example/ocr/paddle-test/ort/");
  assert.equal(options.ortOptions.disableWasmProxy, true);
  assert.equal(options.pipelineConfig.assets.rec.url, "https://coffee.example/ocr/paddle-test/models/rec.tar");
  workers[0].answer(initialized()); assert.deepEqual(await first, await second);
  await release({ client, workers });
});

test("initialization cancellation settles all callers and stale worker responses cannot reset a new worker", async () => {
  const context = setup(), { client, workers } = context;
  const controller = new AbortController();
  const first = client.initialize({ signal: controller.signal }), second = client.initialize();
  const rejected = Promise.all([assert.rejects(first, { name: "AbortError" }), assert.rejects(second, { name: "AbortError" })]);
  const oldMessage = workers[0].onmessage, oldError = workers[0].onerror;
  controller.abort();
  const next = client.initialize();
  oldMessage({ data: { kind: "worker-transport-response", status: "error", requestId: workers[0].messages[0].requestId, error: {} } });
  oldError({ preventDefault() {} });
  workers[1].answer(initialized()); await next; await rejected;
  assert.equal(workers[0].terminated, 1); assert.equal(workers[1].terminated, 0);
  await release(context);
});

test("Paddle failures expose only stable loading/recognition codes and release the failed worker", async () => {
  globalThis.createImageBitmap = async () => ({ close() {} });
  const context = setup(), { client, workers } = context;
  const init = client.initialize();
  const initFailure = assert.rejects(init, error => error.message === "loading_failed" && !error.stack.includes("private-image-text"));
  workers[0].fail("private-image-text /Users/private/model"); await initFailure;
  assert.equal(workers[0].terminated, 1);
  await ready(context);
  const read = client.predict(new Blob(["image"]));
  const readFailure = assert.rejects(read, error => error.message === "recognition_failed" && !error.stack.includes("private-image-text"));
  await pause(); workers[1].fail("private-image-text /Users/private/photo"); await readFailure;
  assert.equal(workers[1].terminated, 1);
});

test("Paddle worker startup errors and message decoding errors can recover through a fresh initialization", async () => {
  const context = setup(), { client, workers } = context;
  const init = client.initialize(), failed = assert.rejects(init, { message: "loading_failed" });
  workers[0].onerror({ message: "sensitive path", preventDefault() {} }); await failed;
  await ready(context);
  workers[1].onmessageerror(); assert.equal(workers[1].terminated, 1);
  await ready(context); await release(context);
});

test("Paddle initialization and inference deadlines terminate the worker and settle requests", async () => {
  const context = setup({ initializationTimeoutMs: 10, inferenceTimeoutMs: 10 });
  await assert.rejects(context.client.initialize(), { message: "loading_failed" });
  assert.equal(context.workers[0].terminated, 1);
  await ready(context);
  globalThis.createImageBitmap = async () => ({ close() {} });
  await assert.rejects(context.client.predict(new Blob(["image"])), { message: "recognition_failed" });
  assert.equal(context.workers[1].terminated, 1);
});

test("Paddle cancellation during image decode settles immediately and closes a bitmap that resolves later", async () => {
  const context = setup(), { client, workers } = context;
  await ready(context);
  let completeDecode, closes = 0;
  globalThis.createImageBitmap = () => new Promise(resolve => { completeDecode = resolve; });
  const pending = client.predict(new Blob(["image"])), rejected = assert.rejects(pending, { name: "AbortError" });
  await pause(); client.cancel(); await rejected;
  assert.equal(workers[0].messages.length, 1); assert.equal(workers[0].terminated, 1);
  const next = client.initialize();
  completeDecode({ close: () => closes++ }); await pause();
  workers[1].answer(initialized()); await next;
  assert.equal(closes, 1); assert.equal(workers[1].messages.length, 1);
  await release(context);
});

test("Paddle AbortSignal cancels an already posted inference and permits reinitialization", async () => {
  let closes = 0; globalThis.createImageBitmap = async () => ({ close: () => closes++ });
  const context = setup(), { client, workers } = context; await ready(context);
  const controller = new AbortController();
  const pending = client.predict(new Blob(["image"]), { signal: controller.signal });
  const rejected = assert.rejects(pending, { name: "AbortError" });
  await pause(); assert.equal(workers[0].messages.at(-1).type, "predict"); controller.abort(); await rejected;
  assert.equal(workers[0].terminated, 1); assert.equal(closes, 1);
  await ready(context);
  const recovered = client.predict(new Blob(["image"])); await pause(); workers[1].answer(recognized());
  assert.deepEqual(await recovered, recognized()); await release(context);
});

test("Paddle dispose during initialization or decoding settles work; a new instance can initialize", async () => {
  const context = setup(), { client, workers } = context;
  const init = client.initialize(), rejected = assert.rejects(init, { name: "AbortError" });
  await client.dispose(); await rejected; await client.dispose();
  assert.equal(workers[0].terminated, 1); assert.throws(() => client.initialize(), { message: "loading_failed" });
  const next = setup(); await ready(next);
  let completeDecode, closes = 0;
  globalThis.createImageBitmap = () => new Promise(resolve => { completeDecode = resolve; });
  const read = next.client.predict(new Blob(["image"])), cancelled = assert.rejects(read, { name: "AbortError" });
  await pause(); await next.client.dispose(); await cancelled;
  completeDecode({ close: () => closes++ }); await pause();
  assert.equal(closes, 1); assert.equal(next.workers[0].terminated, 1);
});

test("Paddle graceful disposal closes admission before awaiting the worker response", async () => {
  const context = setup(); await ready(context);
  const release = context.client.dispose();
  assert.throws(() => context.client.initialize(), { message: "loading_failed" });
  context.workers[0].answer({}); await release; assert.equal(context.workers[0].terminated, 1);
});

test("Paddle pre-aborted requests do not create a worker and concurrent reads are rejected", async () => {
  const context = setup(), { client, workers } = context;
  const controller = new AbortController(); controller.abort();
  await assert.rejects(client.initialize({ signal: controller.signal }), { name: "AbortError" });
  await assert.rejects(client.predict(new Blob(["image"]), { signal: controller.signal }), { name: "AbortError" });
  assert.equal(workers.length, 0);
  const first = client.predict(new Blob(["image"])), rejected = assert.rejects(first, { name: "AbortError" });
  await assert.rejects(client.predict(new Blob(["image"])), { message: "recognition_failed" });
  client.cancel(); await rejected;
});

test("Paddle cloning or malformed worker replies cannot leave initialization pending", async () => {
  const context = setup(), { client, workers } = context;
  const pending = client.initialize(), failed = assert.rejects(pending, { message: "loading_failed" });
  workers[0].answer({ summary: null }); await failed;
  const broken = setup({ createWorker: () => ({ postMessage() { throw new Error("sensitive detail"); }, terminate() {} }) });
  await assert.rejects(broken.client.initialize(), { message: "loading_failed" });
});

test("Paddle config never permits external, credentialed, malformed or non-WASM runtime assets", () => {
  for (const baseUrl of ["https://external.example/ocr/", "https://user:password@coffee.example/ocr/", "blob:https://coffee.example/asset"]) {
    assert.throws(() => setup({ baseUrl }), { message: "loading_failed" });
  }
  for (const mutate of [
    config => { config.pipelineConfig.assets.det.url = "https://external.example/model.tar"; },
    config => { config.pipelineConfig.assets.rec.url = "https://user:password@coffee.example/model.tar"; },
    config => { config.ortOptions.wasmPaths = "https://cdn.example/ort/"; },
    config => { config.ortOptions.backend = "auto"; },
    config => { config.ortOptions.proxy = true; },
    config => { config.pipelineConfig.assets = null; },
  ]) {
    const options = configuration(); mutate(options);
    assert.throws(() => setup({ options }), { message: "loading_failed" });
  }
  for (const options of [null, {}, [], "config"]) assert.throws(() => setup({ options }), { message: "loading_failed" });
});
