import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { downloadVerified, sha256, verifyFile } from "./assets.mjs";
const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "../..");
const lock = JSON.parse(await fs.readFile(path.join(directory, "sources.lock.json"), "utf8"));
const cache = path.resolve(process.env.BEANMAP_OCR_CACHE || path.join(root, "node_modules/.cache/beanmap-ocr"));
const cvKey = sha256(JSON.stringify([lock.opencvSource, lock.toolchains, lock.opencvBuild,
  sha256(await fs.readFile(path.join(directory, "build-opencv.py")))]));
export const cvCache = path.join(cache, "opencv", cvKey);

async function verifiedCv() {
  const manifest = JSON.parse(await fs.readFile(path.join(cvCache, "manifest.json"), "utf8"));
  if (manifest.inputDigest !== cvKey) throw new Error("OpenCV input mismatch");
  for (const name of ["opencv_js.js", "opencv_js.wasm"]) await verifyFile(path.join(cvCache, name), manifest.files[name]);
  const code = await fs.readFile(path.join(cvCache, "opencv_js.js"), "utf8");
  if (/\beval\s*\(|\bnew\s+Function\s*\(/u.test(code) || !code.includes("export default")) throw new Error("OpenCV must use the strict ES module build");
  return manifest;
}

async function saveCv(source, metadata) {
  await fs.mkdir(cvCache, { recursive: true });
  for (const name of ["opencv_js.js", "opencv_js.wasm"]) await fs.copyFile(path.join(source, name), path.join(cvCache, name));
  const files = Object.fromEntries(await Promise.all(["opencv_js.js", "opencv_js.wasm"].map(async name => {
    const bytes = await fs.readFile(path.join(cvCache, name));
    return [name, { bytes: bytes.length, sha256: sha256(bytes) }];
  })));
  await fs.writeFile(path.join(cvCache, "manifest.json"), JSON.stringify({ schemaVersion: 1, inputDigest: cvKey, files, ...metadata }, null, 2) + "\n");
  return verifiedCv();
}

export async function prepareCv() {
  if (process.env.BEANMAP_OPENCV_BUNDLE) {
    const source = path.resolve(process.env.BEANMAP_OPENCV_BUNDLE);
    const manifest = JSON.parse(await fs.readFile(path.join(source, "manifest.json"), "utf8"));
    if (manifest.inputDigest !== cvKey || manifest.sourceSha256 !== lock.opencvSource.sha256
      || !Object.values(lock.toolchains).some(toolchain => toolchain.sha256 === manifest.toolchainSha256)) throw new Error("OpenCV compiler bundle inputs changed");
    for (const name of ["opencv_js.js", "opencv_js.wasm"]) await verifyFile(path.join(source, name), manifest.files[name]);
    return saveCv(source, { host: manifest.host, sourceSha256: manifest.sourceSha256, toolchainSha256: manifest.toolchainSha256 });
  }
  try { return await verifiedCv(); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const host = `${process.platform}-${process.arch}`;
  const toolchain = lock.toolchains[host];
  if (!toolchain) throw new Error(`No pinned OCR compiler for ${host}; use the native Linux Docker build`);
  await verifyFile(path.join(directory, "paddle-whitelist.py"), { bytes: (await fs.stat(path.join(directory, "paddle-whitelist.py"))).size, sha256: lock.opencvBuild.whitelistSha256 });
  const source = await downloadVerified(lock.opencvSource, cache);
  const sdk = await downloadVerified(toolchain, cache);
  const work = path.join(cache, "build", cvKey, host);
  await fs.mkdir(work, { recursive: true });
  console.log(`Building pinned OpenCV for ${host}; compiler logs: ${path.join(work, "build.log")}`);
  const result = spawnSync(process.env.BEANMAP_OCR_PYTHON || "python3", [path.join(directory, "build-opencv.py"), source, sdk, work],
    { stdio: "inherit", env: { ...process.env, BEANMAP_OCR_NODE: process.execPath } });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const log = await fs.readFile(path.join(work, "build.log"), "utf8").catch(() => "");
    console.error(log.split("\n").slice(-80).join("\n"));
    throw new Error(`OpenCV build failed; inspect ${path.join(work, "build.log")}`);
  }
  const provenance = JSON.parse(await fs.readFile(path.join(work, "provenance.json"), "utf8"));
  return saveCv(path.join(work, "build/bin"), { host, sourceSha256: lock.opencvSource.sha256, toolchainSha256: toolchain.sha256, provenance });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = process.argv.indexOf("--import-opencv");
  if (source >= 0) {
    const candidate = path.resolve(process.argv[source + 1] || "");
    let accepted = false;
    for (const variant of lock.opencvBuild.artifactVariants) {
      try {
        for (const [name, expected] of Object.entries(variant.files)) await verifyFile(path.join(candidate, name), expected);
        await saveCv(candidate, { validatedReference: variant.host, sourceSha256: lock.opencvSource.sha256 });
        accepted = true; break;
      } catch { /* Try only another explicitly pinned reference. */ }
    }
    if (!accepted) throw new Error("OpenCV cache seed is not a verified reference build");
    console.log("Imported a checksum-verified OpenCV reference build.");
  } else {
    await prepareCv();
    if (process.env.BEANMAP_OPENCV_OUTPUT) await fs.cp(cvCache, path.resolve(process.env.BEANMAP_OPENCV_OUTPUT), { recursive: true });
    console.log("Prepared pinned strict OpenCV assets.");
  }
}
