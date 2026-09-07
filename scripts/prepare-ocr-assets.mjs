import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetVersion = "tesseract-7.0.0";
const hash = (value) => createHash("sha256").update(value).digest("hex");

export function prepareOcrAssets() {
  const output = path.join(root, "public", "ocr", assetVersion);
  const packages = { "tesseract.js": "7.0.0", "tesseract.js-core": "7.0.0", "@tesseract.js-data/eng": "1.0.0", "@tesseract.js-data/kor": "1.0.0" };
  for (const [name, version] of Object.entries(packages)) {
    const actual = JSON.parse(fs.readFileSync(path.join(root, "node_modules", name, "package.json"), "utf8")).version;
    if (actual !== version) throw new Error(`OCR asset version changed for ${name}; update the versioned URL and browser verification together.`);
  }

  const files = [["tesseract.js/dist/worker.min.js", "worker.min.js"], ["tesseract.js-core/LICENSE", "LICENSE.txt"]];
  const coreRoot = path.join(root, "node_modules/tesseract.js-core");
  for (const file of fs.readdirSync(coreRoot).filter((name) => /\.wasm(?:\.js)?$/.test(name))) files.push([`tesseract.js-core/${file}`, `core/${file}`]);
  for (const language of ["kor", "eng"]) files.push([`@tesseract.js-data/${language}/4.0.0_best_int/${language}.traineddata.gz`, `lang/${language}.traineddata.gz`]);
  const manifest = { packages, files: {} };
  for (const [source, target] of files) {
    const bytes = fs.readFileSync(path.join(root, "node_modules", source));
    const destination = path.join(output, target);
    const digest = hash(bytes);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    if (!fs.existsSync(destination) || hash(fs.readFileSync(destination)) !== digest) fs.writeFileSync(destination, bytes);
    manifest.files[target] = { bytes: bytes.byteLength, sha256: digest };
  }
  const notice = "Tesseract.js 7.0.0 and Tesseract.js-core 7.0.0: Apache-2.0.\nEnglish and Korean language packages @tesseract.js-data/* 1.0.0: MIT.\nSources: https://github.com/naptha/tesseract.js https://github.com/naptha/tesseract.js-core https://github.com/naptha/tessdata\nLanguage data originates from Tesseract tessdata (Apache-2.0): https://github.com/tesseract-ocr/tessdata\n";
  fs.writeFileSync(path.join(output, "NOTICE.txt"), notice);
  fs.writeFileSync(path.join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  // Keep the synchronous API used by staging/QA: assets must be complete before
  // the application starts. The child builds only when its pinned inputs change.
  const paddle = spawnSync(process.execPath, [path.join(root, "scripts/ocr/prepare-paddle.mjs")], {
    cwd: root, encoding: "utf8", maxBuffer: 1024 * 1024,
  });
  if (paddle.error) throw paddle.error;
  if (paddle.status !== 0) throw new Error(`Paddle OCR assets could not be prepared.\n${paddle.stderr || paddle.stdout}`);
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = prepareOcrAssets();
  console.log(`Prepared ${Object.keys(manifest.files).length} local OCR assets.`);
}
