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
const output = path.join(root, ".staging/ocr-fix-audit/browser");
await mkdir(output, { recursive: true });
prepareOcrAssets();
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, "http://localhost").pathname;
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
const results = [];
try {
  for (const [name, engine] of [["chromium", chromium], ["webkit", webkit]]) {
    const browser = await engine.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
      const lines = ["Product:", "Test Coffee", "Roaster:", "Small Roastery", "Origin: Ethiopia", "Process: Natural", "Net weight: 1,000 g"];
      await page.setContent(`<style>body{margin:0;padding:50px;background:white;color:black;font:36px/1.5 Arial}p{margin:0}</style>${lines.map(line => `<p>${line}</p>`).join("")}`);
      const generated = await page.screenshot({ path: path.join(output, `${name}-multiline-thousands.png`) });
      await page.goto(baseURL);
      const result = await page.evaluate(async ({ generated, fixture }) => {
        const { prepareLabelImages, prepareLabelWeightRetry } = await import("/src/lib/coffee/bean-label-image.ts");
        const { createBrowserLabelReader } = await import("/src/lib/coffee/bean-label-ocr.ts");
        const reader = createBrowserLabelReader();
        const results = [];
        try {
          for (const blob of [await (await fetch(fixture)).blob(), new Blob([Uint8Array.from(generated)], { type: "image/png" })]) {
            const signal = new AbortController().signal;
            let retries = 0;
            const started = performance.now();
            const read = await reader.recognize(await prepareLabelImages(blob, signal), { signal, onProgress() {}, prepareWeightRetry: () => { retries += 1; return prepareLabelWeightRetry(blob, signal); } });
            results.push({ ...read, retries, elapsedSeconds: (performance.now() - started) / 1000 });
          }
        } finally { reader.dispose(); }
        return results;
      }, { generated: [...generated], fixture: "/tests/fixtures/bean-label-ko.png" });
      await writeFile(path.join(output, `${name}-raw-result.json`), JSON.stringify(result, null, 2));
      assert.equal(result[0].extraction.fields.name, "우일라 워시드", name);
      assert.equal(result[0].extraction.fields.weight_g, 250, name);
      assert.equal(result[0].extraction.fields.process_detail, undefined, name);
      assert.equal(result[0].retries, 1, name);
      assert.equal(result[1].extraction.fields.name, "Test Coffee", name);
      assert.equal(result[1].extraction.fields.roastery, "Small Roastery", name);
      assert.equal(result[1].extraction.fields.weight_g, 1000, name);
      assert.equal(result[1].extraction.fields.process_detail, undefined, name);
      assert.equal(result[1].retries, 0, name);
      results.push({ browser: name, results: result });
      await writeFile(path.join(output, "results.json"), JSON.stringify(results, null, 2));
      console.log(`${name}: original Korean image + multiline headings + grouped grams passed`);
    } finally { await browser.close(); }
  }
} finally { await new Promise(resolve => server.close(resolve)); }
