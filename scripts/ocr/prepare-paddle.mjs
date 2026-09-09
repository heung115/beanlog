import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { cvCache, prepareCv } from "./prepare-opencv.mjs";
import { randomUUID } from "node:crypto";
import { build } from "esbuild";
import { assertAssetOutput, assetPath, downloadVerified, inventory, sha256, verifyBundle, verifyFile, writeVerified } from "./assets.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "../..");
const dependencies = path.join(root, "node_modules");
const require = createRequire(path.join(root, "package.json"));
const lock = JSON.parse(await fs.readFile(path.join(directory, "sources.lock.json"), "utf8"));
const cache = path.resolve(process.env.BEANMAP_OCR_CACHE || path.join(dependencies, ".cache/beanmap-ocr"));
const output = path.resolve(process.env.BEANMAP_OCR_OUTPUT || path.join(root, "public/ocr", lock.assetVersion));
assertAssetOutput(root, output, lock.assetVersion);
const buildInputs = ["sources.lock.json", "config-input.json", "prepare-paddle.mjs", "assets.mjs", "build-opencv.py", "prepare-opencv.mjs", "paddle-whitelist.py", "opencv-wrapper.mjs"];
const sourceDigest = sha256(JSON.stringify(await Promise.all(buildInputs.map(async name => [name, sha256(await fs.readFile(path.join(directory, name)))]))));
const pinnedFiles = Object.fromEntries([...lock.models, ...lock.ortFiles, ...lock.licenses.map(item => ({ ...item, path: `licenses/${item.path}` }))].map(item => [item.path, item]));

export async function preparePaddleAssets() {
  for (const [name, expected] of Object.entries(lock.packages)) {
    const actual = JSON.parse(await fs.readFile(path.join(dependencies, name, "package.json"), "utf8"));
    if (actual.version !== expected) throw new Error(`OCR package version changed: ${name}`);
  }
  const yamlModule = path.join(dependencies, "js-yaml", lock.yamlModule.path);
  await verifyFile(yamlModule, lock.yamlModule);
  const cv = await prepareCv();
  // Host builds may differ in bytes despite identical pinned inputs. Never
  // reuse a worker bundled around another factory or WASM artifact.
  const inputDigest = sha256(JSON.stringify([sourceDigest, cv.files]));
  const checkBundle = destination => verifyBundle(destination, inputDigest, pinnedFiles);
  try { return await checkBundle(output); } catch (error) {
    if (error.code !== "ENOENT" && error.message !== "OCR bundle inputs changed") throw error;
  }
  const bundleCache = path.join(cache, "bundles", inputDigest);
  try {
    await checkBundle(bundleCache);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const temporary = path.join(cache, "bundles", `${inputDigest}.${randomUUID()}.tmp`);
    const generated = path.join(cache, "generated", inputDigest);
    await fs.mkdir(temporary, { recursive: true });
    await fs.mkdir(generated, { recursive: true });
    try {
      // Preserve the official SDK's module context even when the build cache
      // lives outside this repository or below node_modules.
      await fs.writeFile(path.join(generated, "package.json"), '{"private":true,"type":"module"}\n');
      const recovered = {};
      for (const [file, expected] of Object.entries(lock.sourceMaps)) {
        const bytes = await fs.readFile(path.join(dependencies, "@paddleocr/paddleocr-js/dist", file));
        if (sha256(bytes) !== expected) throw new Error("Paddle SDK source map changed");
        const map = JSON.parse(bytes);
        for (let index = 0; index < map.sources.length; index++) {
          const original = map.sources[index];
          const name = original === "../../../node_modules/js-yaml/dist/js-yaml.mjs" ? "vendor/js-yaml.mjs" : original.startsWith("../src/") ? original.slice(3) : undefined;
          if (!name) continue;
          const content = map.sourcesContent[index];
          if (typeof content !== "string" || sha256(content) !== lock.sourceInventory[name] || (recovered[name] && recovered[name] !== sha256(content))) throw new Error("Paddle SDK recovered source changed");
          recovered[name] = sha256(content);
          // Verify the SDK's historical embedded copy, but never materialize or bundle it.
          if (name === "vendor/js-yaml.mjs") continue;
          const target = assetPath(generated, name);
          await fs.mkdir(path.dirname(target), { recursive: true });
          await fs.writeFile(target, content);
        }
      }
      if (Object.keys(recovered).length !== Object.keys(lock.sourceInventory).length) throw new Error("Paddle SDK source missing");
      for (const [name, content] of Object.entries({
        "resources/index.ts": 'export { loadModelAsset } from "./model-asset";\n',
        "models/index.ts": 'export { createDetModel } from "./det"; export { createRecModel } from "./rec";\n',
      })) await fs.writeFile(path.join(generated, "src", name), content);
      const shared = { bundle: true, nodePaths: [dependencies], target: "es2022", logLevel: "warning", legalComments: "inline",
        alias: { "js-yaml": yamlModule } };
      const configModule = path.join(generated, "resolve-options.cjs");
      await build({ ...shared, entryPoints: [path.join(generated, "src/pipelines/ocr/shared.ts")], outfile: configModule, platform: "node", format: "cjs" });
      const input = JSON.parse(await fs.readFile(path.join(directory, "config-input.json"), "utf8"));
      const normalized = require(configModule).resolvePaddleOCROptions(input);
      normalized.ortOptions.disableWasmProxy = true;
      await fs.writeFile(path.join(temporary, "config.json"), JSON.stringify(normalized, null, 2) + "\n");
      const result = await build({ ...shared, entryPoints: [path.join(generated, "src/pipelines/ocr/worker-entry.ts")],
        outfile: path.join(temporary, "worker.js"), platform: "browser", format: "esm", minify: true, metafile: true,
        alias: { ...shared.alias, "onnxruntime-web": "onnxruntime-web/wasm", "@techstark/opencv-js": path.join(directory, "opencv-wrapper.mjs"),
          "beanmap-opencv-factory": path.join(cvCache, "opencv_js.js") } });
      const inputs = Object.keys(result.metafile.inputs).map(name => path.resolve(root, name));
      if (!inputs.includes(yamlModule) || inputs.some(name => name.endsWith("/vendor/js-yaml.mjs"))) throw new Error("Paddle must bundle only the patched YAML module");
      if (Object.keys(result.metafile.inputs).some(name => /ort\.all|jsep|@techstark\/opencv-js/u.test(name))) throw new Error("Unexpected Paddle runtime backend");
      await writeVerified(path.join(cvCache, "opencv_js.wasm"), temporary, "opencv/opencv_js.wasm", cv.files["opencv_js.wasm"]);
      for (const asset of lock.ortFiles) await writeVerified(path.join(dependencies, "onnxruntime-web/dist", path.basename(asset.path)), temporary, asset.path, asset);
      for (const asset of lock.models) await writeVerified(await downloadVerified(asset, cache), temporary, asset.path, asset);
      for (const license of lock.licenses) await writeVerified(path.join(directory, "licenses", license.path), temporary, `licenses/${license.path}`, license);
      await fs.writeFile(path.join(temporary, "NOTICE.txt"), "PaddleOCR.js 0.4.2 and OpenCV 4.10.0: Apache-2.0. ONNX Runtime 1.24.3 and js-yaml 4.3.2: MIT.\nOpenCV JS bindings are rebuilt from pinned official source with DYNAMIC_EXECUTION=0. The SDK source is recovered unchanged from its official npm source maps; module resolution selects patched js-yaml 4.3.2 and adapts missing re-export barrels.\nSee licenses/ for original notices, including OpenCV internal dependencies, Emscripten, Clipper, and JSBN.\nSources and exact input hashes are maintained in scripts/ocr/sources.lock.json in the Beanmap repository.\n");
      const manifest = { schemaVersion: 1, assetVersion: lock.assetVersion, inputDigest, packages: lock.packages, opencv: cv, files: await inventory(temporary) };
      await fs.writeFile(path.join(temporary, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
      await checkBundle(temporary);
      await fs.rename(temporary, bundleCache);
    } finally { await fs.rm(temporary, { recursive: true, force: true }); }
  }
  const staging = `${output}.${randomUUID()}.tmp`;
  await fs.mkdir(path.dirname(output), { recursive: true });
  try {
    await fs.cp(bundleCache, staging, { recursive: true, errorOnExist: true });
    const manifest = await checkBundle(staging);
    await fs.rm(output, { recursive: true, force: true });
    await fs.rename(staging, output);
    return manifest;
  } finally { await fs.rm(staging, { recursive: true, force: true }); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = await preparePaddleAssets();
  console.log(`Prepared ${Object.keys(manifest.files).length} pinned Paddle OCR assets.`);
}
