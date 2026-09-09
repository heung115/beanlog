// Local-only smoke check: patched parser, real pinned models and a synthetic image.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import yaml from "js-yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const lock = JSON.parse(await fs.readFile(path.join(root, "scripts/ocr/sources.lock.json"), "utf8"));
const manifest = JSON.parse(await fs.readFile(path.join(root, "public/ocr", lock.assetVersion, "manifest.json"), "utf8"));
assert.equal(manifest.packages["js-yaml"], "4.3.2");
assert.deepEqual(yaml.load("model: OCR\nshape: [3, 48, 320]\n"), { model: "OCR", shape: [3, 48, 320] });
// Three empty mappings exceed a budget of two; no expensive PoC is necessary.
assert.throws(() => yaml.load("empty: &empty [{}, {}, {}]\ntarget: { <<: *empty }\n", { maxTotalMergeKeys: 2 }), /maxTotalMergeKeys/);
const client = await build({ entryPoints: [path.join(root, "src/lib/coffee/bean-label-paddle-worker.ts")], bundle: true, format: "esm", platform: "browser", write: false });
const workerPolicy = "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; worker-src 'none'; object-src 'none'";
const server = http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (pathname === "/") {
      response.setHeader("Content-Type", "text/html");
      response.end("<!doctype html><title>Local OCR smoke check</title>"); return;
    }
    if (pathname === "/client.js") {
      response.setHeader("Content-Type", "text/javascript");
      response.end(client.outputFiles[0].contents); return;
    }
    const publicRoot = path.join(root, "public");
    const file = path.resolve(publicRoot, "." + pathname);
    if (!file.startsWith(publicRoot + path.sep)) throw new Error("Invalid asset path");
    response.setHeader("Content-Type", file.endsWith(".js") || file.endsWith(".mjs") ? "text/javascript" : file.endsWith(".wasm") ? "application/wasm" : file.endsWith(".json") ? "application/json" : "application/octet-stream");
    if (file.endsWith("/worker.js")) response.setHeader("Content-Security-Policy", workerPolicy);
    response.end(await fs.readFile(file));
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const base = `http://127.0.0.1:${server.address().port}`;
  const external = [];
  page.on("request", request => { if (new URL(request.url()).origin !== base) external.push(request.url()); });
  await page.goto(base);
  const result = await page.evaluate(async assetVersion => {
    const { PaddleWorkerClient } = await import("/client.js");
    const baseUrl = `/ocr/${assetVersion}/`;
    const options = await (await fetch(baseUrl + "config.json")).json();
    const reader = new PaddleWorkerClient({ baseUrl, options });
    try {
      const initialized = await reader.initialize();
      const canvas = document.createElement("canvas");
      canvas.width = 1200; canvas.height = 650;
      const context = canvas.getContext("2d");
      context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "black"; context.font = "72px Arial";
      for (const [i, line] of ["ETHIOPIA", "COFFEE", "WASHED", "250 g"].entries()) context.fillText(line, 90, 130 + i * 130);
      const bitmap = await createImageBitmap(canvas);
      const predictions = await reader.predict(bitmap);
      bitmap.close();
      return { backend: initialized.backend, text: predictions.flatMap(value => value.items.map(item => item.text)).join(" ") };
    } finally { await reader.dispose(); }
  }, lock.assetVersion);
  assert.equal(result.backend, "wasm");
  assert.match(result.text, /ETHIOPIA/i);
  assert.match(result.text, /COFFEE/i);
  assert.deepEqual(external, []);
  console.log("PASS js-yaml 4.3.2 merge budget, pinned model initialization and synthetic browser OCR");
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
