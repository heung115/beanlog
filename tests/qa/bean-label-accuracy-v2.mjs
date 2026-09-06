// Standalone browser OCR regression. It uses only a loopback asset server and no application accounts.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { chromium, webkit } from "@playwright/test";
import { prepareOcrAssets } from "../../scripts/prepare-ocr-assets.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const output = path.join(root, ".staging/ocr-v2/accuracy");
const referenceImage = process.argv[2] ?? path.join(root, ".staging/ocr-v2/source.jpeg");
await mkdir(output, { recursive: true });
prepareOcrAssets();
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname === "/reference-image") { res.writeHead(200, { "content-type": "image/jpeg" }); res.end(await readFile(referenceImage)); return; }
    if (pathname === "/") { res.writeHead(200, { "content-type": "text/html" }); res.end("<!doctype html><title>Local OCR regression</title>"); return; }
    if (!/^\/(?:src\/|tests\/fixtures\/|ocr\/)/u.test(pathname) || pathname.includes("..")) { res.writeHead(404); res.end(); return; }
    const filename = path.join(root, pathname.startsWith("/ocr/") ? `public${pathname}` : pathname);
    const bytes = await readFile(filename);
    if (filename.endsWith(".ts")) {
      res.writeHead(200, { "content-type": "application/javascript" });
      res.end(ts.transpileModule(bytes.toString(), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText);
    } else {
      res.writeHead(200, { "content-type": filename.endsWith(".js") ? "application/javascript" : filename.endsWith(".wasm") ? "application/wasm" : "application/octet-stream" }); res.end(bytes);
    }
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const baseURL = `http://127.0.0.1:${server.address().port}`;

const observations = [];
try {
  for (const [browserName, engine] of [["chromium", chromium], ["webkit", webkit]]) {
    const browser = await engine.launch();
    try {
      const page = await browser.newPage();
      await page.goto(baseURL);
      const results = await page.evaluate(async () => {
        const { prepareLabelImages, prepareLabelWeightRetry } = await import("/src/lib/coffee/bean-label-image.ts");
        const { createBrowserLabelReader } = await import("/src/lib/coffee/bean-label-ocr.ts");
        const reader = createBrowserLabelReader();
        const original = await (await fetch("/reference-image")).blob();
        const observations = [];
        try {
          for (const scale of [1, 1, 0.8, 1.25]) {
            let blob = original;
            if (scale !== 1) {
              const bitmap = await createImageBitmap(original);
              const canvas = document.createElement("canvas");
              canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
              const context = canvas.getContext("2d"); context.imageSmoothingQuality = "high";
              context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
              blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
            }
            const signal = new AbortController().signal;
            const started = performance.now();
            const partials = [];
            const prepared = await prepareLabelImages(blob, signal);
            const result = await reader.recognize(prepared, { signal, onProgress() {},
              onPartial: value => partials.push({ elapsedMs: Math.round(performance.now() - started), fields: Object.keys(value.extraction.fields) }),
              prepareWeightRetry: () => prepareLabelWeightRetry(blob, signal),
            });
            observations.push({ scale, elapsedMs: Math.round(performance.now() - started), partials, ...result });
          }
        } finally { reader.dispose(); }
        return observations;
      });
      observations.push({ browser: browserName, results });
      await writeFile(path.join(output, `${browserName}-reference.json`), JSON.stringify(results, null, 2));
      console.log(JSON.stringify({browser:browserName, results:results.map(value=>({scale:value.scale, elapsedMs:value.elapsedMs, firstPartialMs:value.partials[0]?.elapsedMs,weight:value.extraction.fields.weight_g,name:value.extraction.fields.name}))}));
      for (const result of results) {
        assert.equal(result.extraction.fields.weight_g, 200, browserName);
        assert.equal(result.extraction.fields.name, "지에이 블렌드(그린애플쥬스 블렌드)", browserName);
        assert.deepEqual(result.extraction.fields.blend_components.map(value => value.percentage), [60, 40], browserName);
        assert.ok(result.partials[0].elapsedMs < result.elapsedMs, browserName);
      }
    } finally { await browser.close(); }
  }
} finally {
  await writeFile(path.join(output, "reference-results.json"), JSON.stringify(observations, null, 2));
  await new Promise(resolve => server.close(resolve));
}
