import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { assertAssetOutput, assetPath, downloadVerified, inventory, sha256, verifyBundle, verifyFile, writeVerified } from "../scripts/ocr/assets.mjs";

test("the production archive extractor rejects unsafe members on the CI Python runtime", () => {
  const result = spawnSync(process.env.BEANMAP_OCR_PYTHON || "python3", [fileURLToPath(new URL("./ocr-archive.test.py", import.meta.url))],
    { encoding: "utf8", timeout: 10_000 });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("asset paths and output overrides cannot escape or replace the project", () => {
  const root = path.resolve("/tmp/ocr-project");
  for (const relative of ["../secret", "/tmp/other", "a/../../file", "a\\b", "a//b", ""]) assert.throws(() => assetPath(root, relative));
  assert.equal(assetPath(root, "models/label.tar"), path.join(root, "models/label.tar"));
  for (const output of [root, "/", "/tmp", "/tmp/paddle-v1", path.join(root, "public")]) assert.throws(() => assertAssetOutput(root, output, "paddle-v1"));
  assert.doesNotThrow(() => assertAssetOutput(root, path.join(root, "public/ocr/paddle-v1"), "paddle-v1"));
});

test("official download inputs must have HTTPS, an exact length and a SHA256 before any request", async () => {
  for (const input of [
    { url: "https://example.test/model", bytes: 100, sha256: null },
    { url: "http://example.test/model", bytes: 100, sha256: "a".repeat(64) },
    { url: "https://example.test/model", bytes: -1, sha256: "a".repeat(64) },
  ]) await assert.rejects(downloadVerified(input, "/unused"), /Unpinned/);
});

test("cached files are rehashed and symlinks are rejected", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ocr-integrity-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "model");
  await fs.writeFile(file, "original");
  const expected = { bytes: 8, sha256: sha256("original") };
  await verifyFile(file, expected);
  await fs.writeFile(file, "tampered");
  await assert.rejects(verifyFile(file, expected), /checksum/);
  const link = path.join(directory, "link");
  await fs.symlink(file, link);
  await assert.rejects(verifyFile(link, expected), /size\/type/);
});

test("private download cache modes do not make published models unreadable to the server user", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ocr-public-mode-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const cached = path.join(directory, "cached-model");
  await fs.writeFile(cached, "verified model", { mode: 0o600 });
  const expected = { bytes: 14, sha256: sha256("verified model") };
  const published = path.join(directory, "public");
  await writeVerified(cached, published, "models/label.tar", expected);
  const output = path.join(published, "models/label.tar");
  await verifyFile(output, expected);
  assert.equal((await fs.stat(output)).mode & 0o777, 0o644);
  assert.equal((await fs.stat(cached)).mode & 0o777, 0o600);
});

test("a cache manifest cannot omit or replace required pinned model, ORT module or license bytes", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ocr-bundle-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const names = ["worker.js", "config.json", "opencv/opencv_js.wasm", "ort/ort-wasm-simd-threaded.wasm", "ort/ort-wasm-simd-threaded.mjs", "models/det.tar", "models/rec.tar", "licenses/license.txt", "NOTICE.txt"];
  for (const name of names) {
    const file = assetPath(directory, name);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, name);
  }
  const files = await inventory(directory);
  const manifest = { schemaVersion: 1, inputDigest: "inputs", files };
  const pinned = Object.fromEntries(names.filter(name => name.startsWith("models/") || name.startsWith("licenses/")).map(name => [name, files[name]]));
  const save = value => fs.writeFile(path.join(directory, "manifest.json"), JSON.stringify(value));
  await save(manifest);
  await verifyBundle(directory, "inputs", pinned);
  for (const name of ["models/det.tar", "models/rec.tar", "ort/ort-wasm-simd-threaded.mjs", "licenses/license.txt"]) {
    const incomplete = structuredClone(manifest);
    delete incomplete.files[name];
    await save(incomplete);
    await assert.rejects(verifyBundle(directory, "inputs", pinned), /inputs changed/);
  }
  const replaced = structuredClone(manifest);
  replaced.files["models/rec.tar"] = { bytes: 4, sha256: sha256("fake") };
  await save(replaced);
  await assert.rejects(verifyBundle(directory, "inputs", pinned), /Pinned OCR asset changed/);
  await save(manifest);
  await fs.writeFile(path.join(directory, "harness.js"), "not a production asset");
  await assert.rejects(verifyBundle(directory, "inputs", pinned), /Unexpected OCR bundle file/);
});

test("production source/model/toolchain pins and copied third-party notices are complete", async () => {
  const root = new URL("../scripts/ocr/", import.meta.url);
  const lock = JSON.parse(await fs.readFile(new URL("sources.lock.json", root), "utf8"));
  assert.equal(lock.assetVersion, "paddle-0.4.2-v1");
  assert.deepEqual(Object.keys(lock.toolchains).sort(), ["darwin-arm64", "linux-arm64", "linux-x64"]);
  for (const input of [lock.opencvSource, ...Object.values(lock.toolchains), ...lock.models]) {
    assert.match(input.sha256, /^[a-f0-9]{64}$/u);
    assert.equal(new URL(input.url).protocol, "https:");
    assert.ok(Number.isSafeInteger(input.bytes) && input.bytes > 0);
  }
  assert.match(lock.opencvBuild.flags, /DYNAMIC_EXECUTION=0/);
  assert.match(lock.opencvBuild.flags, /ENVIRONMENT=web,worker(?:\s|$)/);
  assert.ok(lock.licenses.some(license => license.path === "musl-COPYRIGHT.txt"));
  for (const license of lock.licenses) await verifyFile(new URL(`licenses/${license.path}`, root), license);
  const dockerfile = await fs.readFile(new URL("../Dockerfile", import.meta.url), "utf8");
  assert.match(dockerfile, /bookworm-slim@sha256:[a-f0-9]{64} AS ocr-compiler/);
  assert.match(dockerfile, /--mount=type=cache.*prepare-opencv\.mjs/);
  const runner = dockerfile.slice(dockerfile.indexOf("FROM base AS runner"));
  assert.doesNotMatch(runner, /ocr-compiler|beanmap-opencv|emscripten|scripts\/ocr/);
});
