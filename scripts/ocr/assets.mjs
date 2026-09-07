import fs from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { Transform, Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

export function assertAssetOutput(root, output, version) {
  const relative = path.relative(root, output);
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)
    || path.basename(output) !== version) throw new Error("OCR output must be a versioned asset directory inside the project");
}

export function assetPath(root, relative) {
  if (typeof relative !== "string" || !relative || relative.includes("\\") || relative.startsWith("/")
    || relative.split("/").some(part => !part || part === "." || part === "..")) throw new Error("Invalid OCR asset path");
  return path.join(root, relative);
}

export async function verifyFile(file, expected) {
  if (!/^[a-f0-9]{64}$/u.test(expected.sha256) || !Number.isSafeInteger(expected.bytes) || expected.bytes <= 0) throw new Error("Unpinned OCR asset");
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== expected.bytes) throw new Error(`OCR asset size/type mismatch: ${path.basename(file)}`);
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  if (digest.digest("hex") !== expected.sha256) throw new Error(`OCR asset checksum mismatch: ${path.basename(file)}`);
}

export async function downloadVerified(input, cache) {
  const url = new URL(input.url);
  if (url.protocol !== "https:" || url.username || url.password || !/^[a-f0-9]{64}$/u.test(input.sha256)
    || !Number.isSafeInteger(input.bytes) || input.bytes <= 0) throw new Error("Unpinned OCR download");
  const directory = path.join(cache, "downloads");
  await fs.mkdir(directory, { recursive: true });
  const destination = path.join(directory, input.sha256);
  try { await verifyFile(destination, input); return destination; } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const temporary = `${destination}.${randomUUID()}.part`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(180_000), redirect: "error" });
    if (!response.ok || !response.body) throw new Error(`OCR download failed: ${response.status}`);
    const declared = response.headers.get("content-length");
    if (declared && Number(declared) !== input.bytes) throw new Error("OCR download length changed");
    let bytes = 0;
    const limiter = new Transform({ transform(chunk, _, callback) {
      bytes += chunk.length;
      callback(bytes > input.bytes ? new Error("OCR download exceeded pinned size") : null, chunk);
    } });
    await pipeline(Readable.fromWeb(response.body), limiter, createWriteStream(temporary, { flags: "wx", mode: 0o600 }));
    await verifyFile(temporary, input);
    await fs.rename(temporary, destination);
    return destination;
  } finally { await fs.rm(temporary, { force: true }); }
}

export async function writeVerified(source, root, relative, expected) {
  await verifyFile(source, expected);
  const destination = assetPath(root, relative);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
  // Verified download cache entries are private (0600). Published assets must
  // also be readable by the production image's unprivileged server user.
  await fs.chmod(destination, 0o644);
}

export async function inventory(directory) {
  const files = {};
  async function visit(relative) {
    for (const entry of (await fs.readdir(path.join(directory, relative), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await visit(name);
      else if (entry.isFile()) {
        const bytes = await fs.readFile(assetPath(directory, name));
        files[name] = { bytes: bytes.length, sha256: sha256(bytes) };
      } else throw new Error("Unexpected OCR asset type");
    }
  }
  await visit("");
  return files;
}

export async function verifyBundle(directory, inputDigest, pinnedFiles = {}) {
  const manifest = JSON.parse(await fs.readFile(path.join(directory, "manifest.json"), "utf8"));
  if (manifest.schemaVersion !== 1 || manifest.inputDigest !== inputDigest || !manifest.files
    || !["worker.js", "config.json", "opencv/opencv_js.wasm", "ort/ort-wasm-simd-threaded.wasm", "ort/ort-wasm-simd-threaded.mjs", "NOTICE.txt", ...Object.keys(pinnedFiles)].every(name => manifest.files[name])) throw new Error("OCR bundle inputs changed");
  for (const [name, expected] of Object.entries(pinnedFiles)) {
    const actual = manifest.files[name];
    if (actual.sha256 !== expected.sha256 || actual.bytes !== expected.bytes) throw new Error(`Pinned OCR asset changed: ${name}`);
  }
  for (const [relative, expected] of Object.entries(manifest.files)) await verifyFile(assetPath(directory, relative), expected);
  const actual = await inventory(directory);
  if (Object.keys(actual).some(name => name !== "manifest.json" && !manifest.files[name])) throw new Error("Unexpected OCR bundle file");
  return manifest;
}
