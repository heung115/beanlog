// Local-only, actual-reader benchmark. See ocr-release-benchmark.md for commands.
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { scoreFixture, summarize, forbiddenValueEntries } from "./ocr-release-score.mjs";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const argv = process.argv.slice(2), command = argv.shift();
const options = name => argv.flatMap((value, index) => value === name ? [argv[index + 1]] : []);
const option = (name, fallback) => options(name)[0] ?? fallback;
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const json = async file => JSON.parse(await readFile(file, "utf8"));
const absolute = value => path.resolve(repository, value);
const required = name => { const value = option(name); if (!value) throw new Error(`Required: ${name}`); return absolute(value); };
const save = async (file, value) => { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, JSON.stringify(value, null, 2) + "\n"); };
const localOutput = value => { const output = absolute(value); if (!output.startsWith(path.join(repository, ".staging") + path.sep)) throw new Error("Private benchmark output must be below .staging/"); return output; };
async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true }), files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Do not snapshot symlink: ${file}`);
    if (entry.isDirectory()) files.push(...await filesBelow(file)); else if (entry.isFile()) files.push(file);
  }
  return files;
}
function mime(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216) return "image/jpeg";
  if (bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP") return "image/webp";
  throw new Error("Expected a real PNG, JPEG or WebP image, not an HTML download/error page");
}
async function validateFixtures(manifestFile, manifest) {
  if (!Array.isArray(manifest.fixtures) || !manifest.fixtures.length) throw new Error("Empty fixture manifest");
  const ids = new Set(), fixtures = [];
  for (const fixture of manifest.fixtures) {
    if (!/^[a-zA-Z0-9_-]+$/u.test(fixture.id) || ids.has(fixture.id)) throw new Error(`Invalid/duplicate ID: ${fixture.id}`);
    ids.add(fixture.id);
    // Reject unusable scoring metadata before decoding an image or running OCR.
    forbiddenValueEntries(fixture.forbiddenValues);
    if (!["development", "blind", "negative"].includes(fixture.split)) throw new Error(`Explicit development/blind/negative split required: ${fixture.id}`);
    const file = path.resolve(path.dirname(manifestFile), fixture.path), bytes = await readFile(file);
    if (!fixture.sha256 || hash(bytes) !== fixture.sha256) throw new Error(`Image SHA-256 mismatch: ${fixture.id}`);
    if (fixture.kind !== "negative" && !Object.keys(fixture.expected?.fields ?? {}).length) throw new Error(`No predeclared expected fields: ${fixture.id}`);
    fixtures.push({ ...fixture, path: file, mime: mime(bytes), bytes: bytes.length });
  }
  return fixtures;
}
async function downloadPublic() {
  const catalog = await json(absolute(option("--catalog", "tests/qa/fixtures/ocr-release-public.json")));
  const output = localOutput(option("--out", ".staging/ocr-release/public-manifest.json")), fixtures = [];
  for (const fixture of catalog.fixtures) {
    if (!/^[a-zA-Z0-9_-]+$/u.test(fixture.id) || !/^[a-f0-9]{64}$/u.test(fixture.sha256)) throw new Error("Invalid public fixture ID/SHA");
    const url = new URL(fixture.imageUrl);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error(`Invalid public image URL: ${fixture.id}`);
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Public fixture HTTP ${response.status}: ${fixture.id}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (hash(bytes) !== fixture.sha256) throw new Error(`Public image changed; do not substitute it under the old golden: ${fixture.id}`);
    const type = mime(bytes), extension = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" }[type];
    const file = path.join(path.dirname(output), "public", `${fixture.id}${extension}`);
    await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, bytes);
    fixtures.push({ ...fixture, path: file, mime: type, bytes: bytes.length });
  }
  await save(output, { version: 1, downloadedAt: new Date().toISOString(), fixtures });
  console.log(JSON.stringify({ output, fixtures: fixtures.length, split: "development" }));
}
async function prepare() {
  const output = localOutput(option("--out", ".staging/ocr-release/corpus.json")), fixtures = [], sources = [];
  const planFile = option("--plan"), plan = planFile ? await json(absolute(planFile)) : {};
  for (const [split, paths] of [["development", [...(plan.developmentManifests ?? []), ...options("--development")]], ["blind", [...(plan.blindManifests ?? []), ...options("--blind")]]]) {
    for (const relative of paths) {
      const file = absolute(relative), bytes = await readFile(file), source = JSON.parse(bytes.toString());
      sources.push({ path: path.relative(repository, file), sha256: hash(bytes), assignedSplit: split });
      for (const original of source.fixtures) fixtures.push({ ...original, path: path.resolve(path.dirname(file), original.path), priorSplit: original.split, split, kind: original.negative || original.kind === "negative" ? "negative" : "coffee" });
    }
  }
  if (!fixtures.length) throw new Error("Supply --plan or --development/--blind manifests");
  // These are valid deterministic raster inputs, not decoder rejection cases.
  // sharp is already a dependency of the app; generated PNGs remain untracked.
  const { default: sharp } = await import("sharp");
  const width = 1000, height = 1200;
  const descriptors = [
    { id: "negative-blank", lines: [] },
    { id: "negative-hand-soap", lines: ["HAND SOAP", "LAVENDER", "MADE IN KOREA", "NET WEIGHT 250 g", "INGREDIENTS", "WATER, GLYCERIN", "HOUSEHOLD HAND WASH"] },
  ];
  for (const descriptor of argv.includes("--no-generated-negatives") ? [] : descriptors) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="white"/>${descriptor.lines.map((line, i) => `<text x="90" y="${150 + i * 125}" font-family="Arial,sans-serif" font-size="48" fill="black">${line}</text>`).join("")}</svg>`;
    const bytes = await sharp(Buffer.from(svg)).png().toBuffer(), file = path.join(path.dirname(output), "negative", `${descriptor.id}.png`);
    await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, bytes);
    fixtures.push({ id: descriptor.id, path: file, sha256: hash(bytes), split: "negative", kind: "negative", privacy: "synthetic-public-test", expected: { bean_type: "unknown", fields: {} }, visibleText: descriptor.lines.join("\n"), generator: { svgSha256: hash(svg), sharpVersion: sharp.versions.sharp, width, height } });
  }
  const manifest = { version: 1, preparedAt: new Date().toISOString(), sources, policy: "Previously observed photos are development/regression data, including any opened blind set. Preserve every first-blind freeze and result. New blind images must be selected and transcribed without OCR, remain sealed until reader/config/assets/harness freeze, and never become independent again after inspection. Repetitions are not independent photos.", fixtures };
  await validateFixtures(output, manifest); await save(output, manifest);
  console.log(JSON.stringify({ output, fixtures: fixtures.length, splits: Object.fromEntries(["development", "blind", "negative"].map(split => [split, fixtures.filter(fixture => fixture.split === split).length])) }));
}
async function freeze() {
  const manifestFile = required("--manifest"), output = localOutput(option("--out", `.staging/ocr-release/frozen-${Date.now()}`));
  const reader = option("--reader", "tesseract");
  if (!["tesseract", "paddle"].includes(reader)) throw new Error("--reader must be tesseract or paddle");
  try { await stat(path.join(output, "freeze.json")); throw new Error("Do not overwrite an existing freeze; choose a new --out"); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const manifest = await json(manifestFile), fixtures = await validateFixtures(manifestFile, manifest);
  const sourceFiles = (await filesBelow(path.join(repository, "src"))).filter(file => /\.(?:ts|tsx|js|mjs|json)$/u.test(file));
  const assetFiles = await filesBelow(path.join(repository, "public/ocr"));
  if (!assetFiles.length) throw new Error("Prepare the app's OCR assets before freezing");
  const harnessFiles = ["ocr-release-benchmark.mjs", "ocr-release-browser.mjs", "ocr-release-score.mjs"].map(name => path.join(repository, "tests/qa", name));
  const files = {};
  for (const file of [...sourceFiles, ...assetFiles, ...harnessFiles, path.join(repository, "package.json"), path.join(repository, "package-lock.json")]) {
    const relative = path.relative(repository, file), destination = path.join(output, "source", relative), bytes = await readFile(file);
    await mkdir(path.dirname(destination), { recursive: true }); await writeFile(destination, bytes);
    files[relative] = { sha256: hash(bytes), bytes: bytes.length };
  }
  for (const [relative, expected] of Object.entries(files)) if (hash(await readFile(path.join(repository, relative))) !== expected.sha256) throw new Error(`Working source changed during freeze: ${relative}`);
  await save(path.join(output, "manifest.json"), { ...manifest, fixtures });
  const manifestSha256 = hash(await readFile(path.join(output, "manifest.json")));
  let head = null; try { head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repository, encoding: "utf8" }).trim(); } catch { /* A source export can still be benchmarked by content hash. */ }
  await save(path.join(output, "freeze.json"), { version: 1, frozenAt: new Date().toISOString(), reader, source: "Current working files, including uncommitted changes", head, manifestSha256, sourceManifestSha256: hash(await readFile(manifestFile)), files, codeSha256: hash(JSON.stringify(files)),
    performanceBudget: { declaredAt: "2026-09-07", percentileMethod: "nearest rank: sorted[ceil(0.95 * n) - 1]", warmP95Ms: 8000, warmMaxMs: 15000, coldLoopbackTotalMaxMs: 20000, coldWanTotalMaxMs: 30000, wanDownloadMbps: 20, wanRttMs: 100, subsequentReadScope: "All repeated end-to-end waits, including worker restart and fallback; same-worker warm is diagnostic. Coffee and negative fixtures are evaluated separately. Missing or failed observations cannot pass.", eligibility: "Requires isolated measurements on the reported Mac/browser. Loopback does not measure WAN; mobile emulation is not physical iPhone performance." },
    node: process.version, platform: process.platform, architecture: process.arch, cpu: os.cpus()[0]?.model, osRelease: os.release() });
  console.log(JSON.stringify({ output, codeSha256: hash(JSON.stringify(files)), manifestSha256, fixtures: fixtures.length }));
}
async function verify() {
  const directory = required("--frozen"), { frozen, fixtures } = await verifiedFreeze(directory);
  console.log(JSON.stringify({ directory, codeSha256: frozen.codeSha256, files: Object.keys(frozen.files).length, fixtures: fixtures.length, verified: true }));
}
async function verifiedFreeze(directory) {
  const frozen = await json(path.join(directory, "freeze.json"));
  for (const [relative, expected] of Object.entries(frozen.files)) {
    const bytes = await readFile(path.join(directory, "source", relative));
    if (hash(bytes) !== expected.sha256 || bytes.length !== expected.bytes) throw new Error(`Frozen file changed: ${relative}`);
  }
  const manifestFile = path.join(directory, "manifest.json"), bytes = await readFile(manifestFile);
  if (hash(bytes) !== frozen.manifestSha256) throw new Error("Frozen manifest changed");
  if (hash(await readFile(path.join(repository, "package-lock.json"))) !== frozen.files["package-lock.json"].sha256) throw new Error("Dependency lock changed since freeze; use the matching environment or make a new freeze");
  return { frozen, fixtures: await validateFixtures(manifestFile, JSON.parse(bytes.toString())) };
}
async function run() {
  const directory = required("--frozen"), output = localOutput(option("--out", `.staging/ocr-release/results-${Date.now()}`));
  const { frozen, fixtures } = await verifiedFreeze(directory), split = option("--split", "development"), ids = option("--ids", "").split(",").filter(Boolean);
  const reader = option("--reader", frozen.reader ?? "tesseract");
  if (reader !== (frozen.reader ?? "tesseract")) throw new Error("Reader selection differs from freeze metadata");
  if (hash(await readFile(fileURLToPath(import.meta.url))) !== frozen.files["tests/qa/ocr-release-benchmark.mjs"].sha256) throw new Error("Runner changed since freeze; freeze its final code before reading blind photos");
  if (!["development", "blind", "negative", "all"].includes(split)) throw new Error("Invalid --split");
  const selected = fixtures.filter(fixture => (split === "all" || fixture.split === split) && (!ids.length || ids.includes(fixture.id)));
  if (!selected.length) throw new Error("No selected fixtures");
  if (new Set(ids).size !== ids.length || ids.some(id => !selected.some(fixture => fixture.id === id))) throw new Error("Duplicate, unknown or out-of-split --ids");
  const repeats = Number(option("--repeat", "2")), timeoutMs = Number(option("--timeout-ms", "120000"));
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > 5 || !Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 300000) throw new Error("Invalid repetition or timeout limit");
  const browserNames = option("--browsers", "chromium,webkit").split(",");
  if (new Set(browserNames).size !== browserNames.length || browserNames.some(name => !["chromium", "webkit"].includes(name))) throw new Error("Only distinct Chromium/WebKit selections are supported");
  const { chromium, webkit, devices } = await import("@playwright/test"), { default: ts } = await import("typescript");
  const { readFrozenLabel } = await import(pathToFileURL(path.join(directory, "source/tests/qa/ocr-release-browser.mjs")));
  const frozenScore = await import(pathToFileURL(path.join(directory, "source/tests/qa/ocr-release-score.mjs")));
  const sourceRoot = path.join(directory, "source"), fixtureByUrl = new Map(selected.map((fixture, index) => [`/fixture/${index}`, fixture]));
  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, "http://localhost").pathname;
      if (pathname === "/") { res.writeHead(200, { "content-type": "text/html", "cache-control": "no-store" }); res.end("<!doctype html><title>Frozen local OCR release benchmark</title>"); return; }
      const fixture = fixtureByUrl.get(pathname);
      if (fixture) { const bytes = await readFile(fixture.path); res.writeHead(200, { "content-type": fixture.mime, "content-length": bytes.length, "cache-control": "no-store" }); res.end(bytes); return; }
      if (!/^\/(?:src\/|ocr\/)/u.test(pathname)) throw new Error("Not served");
      const relative = pathname.startsWith("/ocr/") ? `public${pathname}` : pathname.slice(1);
      if (!Object.hasOwn(frozen.files, relative)) throw new Error("Outside frozen source/asset allowlist");
      const file = path.join(sourceRoot, relative), bytes = await readFile(file);
      const body = /\.tsx?$/u.test(file) ? Buffer.from(ts.transpileModule(bytes.toString(), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText) : bytes;
      const type = /\.(?:m?js|tsx?)$/u.test(file) ? "application/javascript" : file.endsWith(".wasm") ? "application/wasm" : "application/octet-stream";
      res.writeHead(200, { "content-type": type, "content-length": body.length, "cache-control": "no-store" }); res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`, rows = [], rawRuns = [], startedAt = new Date().toISOString(), versions = {};
  const mobile = argv.includes("--mobile");
  await mkdir(output, { recursive: true });
  try {
    for (const browserName of browserNames) {
      const browser = await ({ chromium, webkit }[browserName]).launch(); versions[browserName] = browser.version();
      try {
        for (const [index, fixture] of selected.entries()) {
          const context = await browser.newContext(mobile ? { ...devices[browserName === "webkit" ? "iPhone 13" : "Pixel 7"] } : { viewport: { width: 1280, height: 960 }, locale: "en-US" });
          const page = await context.newPage(), blockedRequests = [], pageErrors = [], requests = [], pending = [];
          await context.route("**/*", route => { const request = route.request(), url = new URL(request.url()); if (url.origin === origin && ["GET", "HEAD"].includes(request.method())) return route.continue(); blockedRequests.push({ url: `${url.origin}${url.pathname}`, method: request.method() }); return route.abort(); });
          context.on("requestfinished", request => { pending.push((async () => { const response = await request.response(); requests.push({ path: new URL(request.url()).pathname, status: response?.status(), bytes: Number(response?.headers()["content-length"] ?? 0), timing: request.timing() }); })()); });
          page.on("pageerror", error => pageErrors.push({ name: error.name, message: error.message }));
          let observation = {}, timer;
          try {
            const navStarted = performance.now(); await page.goto(origin); const pageSetupMs = performance.now() - navStarted;
            observation = await Promise.race([page.evaluate(readFrozenLabel, { fixtureUrl: `/fixture/${index}`, repeats, timeoutMs, readerType: reader }), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("browser_evaluation_timeout")), repeats * timeoutMs + 20000); })]);
            observation.pageSetupMs = pageSetupMs;
          } catch (error) { observation.error = { name: error.name, message: error.message }; }
          finally { clearTimeout(timer); await context.close(); await Promise.allSettled(pending); }
          const runRecord = { id: fixture.id, split: fixture.split, kind: fixture.kind, reader, browser: browserName, mobileEmulation: mobile, imageSha256: fixture.sha256, codeSha256: frozen.codeSha256, ...observation, blockedRequests, pageErrors, requests };
          rawRuns.push(runRecord); await save(path.join(output, `${fixture.id}-${browserName}.json`), runRecord);
          for (let repeat = 0; repeat < repeats; repeat++) {
            const phase = observation.phases?.find(value => value.repeat === repeat) ?? { repeat, error: observation.error ?? { message: "Missing phase" } };
            rows.push({ id: fixture.id, split: fixture.split, kind: fixture.kind, reader, browser: browserName, mobileEmulation: mobile, imageSha256: fixture.sha256, repeat, elapsedMs: phase.elapsedMs ?? null, coldTotalMs: repeat === 0 && phase.elapsedMs !== undefined ? observation.pageSetupMs + observation.setupMs + phase.elapsedMs : null, workerReused: phase.workerReused ?? false, extraction: phase.extraction ?? null, text: phase.text ?? null, error: phase.error ?? observation.error ?? null, pageErrors, blockedRequests, score: frozenScore.scoreFixture(fixture, phase.extraction) });
          }
          // Do not print blind OCR content into progress logs.
          console.log(JSON.stringify({ browser: browserName, id: fixture.id, split: fixture.split, elapsedMs: observation.phases?.map(phase => Math.round(phase.elapsedMs)), runtimeError: Boolean(observation.error || observation.phases?.some(phase => phase.error)) }));
        }
      } finally { await browser.close(); }
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
    await save(path.join(output, "results.json"), { version: 1, startedAt, completedAt: new Date().toISOString(), reader, frozenDirectory: directory, freeze: frozen, browsers: browserNames, browserVersions: versions, mobileEmulation: mobile, timeoutMs, timingNote: option("--timing-note", "Host contention and real-device performance were not controlled by this harness."),
      environment: { node: process.version, platform: process.platform, architecture: process.arch, cpu: os.cpus()[0]?.model, osRelease: os.release() },
      method: "First read per unique photo/browser. Cold elapsedMs includes original decode/preprocess, lazy worker/model init, retries and final parser/layout; warm reuses the reader. setupMs and pageSetupMs are separate. Loopback transfers are not internet/mobile network timing. Raw replay is not this benchmark.",
      selectedIds: selected.map(fixture => fixture.id), repeats, rows, groups: frozenScore.summarize(rows), rawRuns });
  }
  if (rows.some(row => row.error || row.pageErrors.length || row.blockedRequests.length)) process.exitCode = 1;
}
async function score() {
  const manifestFile = required("--manifest"), manifest = await json(manifestFile), input = await json(required("--input")), fixtures = new Map(manifest.fixtures.map(fixture => [fixture.id, fixture]));
  const manifestSha256 = hash(await readFile(manifestFile));
  if (![input.freeze?.manifestSha256, input.freeze?.sourceManifestSha256].includes(manifestSha256)) throw new Error("Score audit manifest differs from the run's frozen truth");
  if (!Array.isArray(input.selectedIds) || !Array.isArray(input.browsers) || !Number.isInteger(input.repeats) || input.repeats < 1 || input.repeats > 5 || !Array.isArray(input.rows)) throw new Error("Score audit needs the complete run selection/repetition metadata");
  const expectedKeys = new Set(input.selectedIds.flatMap(id => input.browsers.flatMap(browser => Array.from({ length: input.repeats }, (_, repeat) => `${id}/${browser}/${repeat}`))));
  if (input.rows.length !== expectedKeys.size || input.selectedIds.some(id => !fixtures.has(id))) throw new Error("Incomplete result rows or unknown selected fixture");
  const seen = new Set(), rows = input.rows.map(row => {
    const fixture = fixtures.get(row.id), key = `${row.id}/${row.browser}/${row.repeat}`;
    if (!fixture || !expectedKeys.has(key) || seen.has(key) || row.imageSha256 !== fixture.sha256) throw new Error(`Unknown, duplicate or wrong image: ${key}`);
    seen.add(key); return { ...row, split: fixture.split, kind: fixture.kind, score: scoreFixture(fixture, row.extraction) };
  });
  const output = localOutput(option("--out", ".staging/ocr-release/scored.json"));
  await save(output, { source: input.frozenDirectory ?? null, manifestSha256, manifestMatchesFreeze: true, scorerSha256: hash(await readFile(path.join(repository, "tests/qa/ocr-release-score.mjs"))), groups: summarize(rows), rows });
  console.log(JSON.stringify({ output, groups: summarize(rows) }));
}
async function replay() {
  const manifest = await json(required("--manifest")), inputFile = required("--input"), input = await json(inputFile), fixtures = new Map(manifest.fixtures.map(fixture => [fixture.id, fixture]));
  const { parseBeanLabelText } = await import(pathToFileURL(path.join(repository, "src/lib/coffee/bean-label-parser.ts")));
  const { extractLabelLayout } = await import(pathToFileURL(path.join(repository, "src/lib/coffee/bean-label-layout.ts")));
  const { mergeLabelExtractions } = await import(pathToFileURL(path.join(repository, "src/lib/coffee/bean-label.ts")));
  const runs = input.rawRuns ?? (input.id ? [input] : []), rows = [];
  if (!runs.length) throw new Error("Replay needs results.json with rawRuns or one baseline raw fixture JSON");
  for (const run of runs) {
    const fixture = fixtures.get(run.id);
    if (!fixture || fixture.split === "blind") throw new Error(`Replay is development-only; do not tune to blind outputs: ${run.id}`);
    if ((run.imageSha256 ?? run.sha256) !== fixture.sha256) throw new Error(`Replay image SHA mismatch: ${run.id}`);
    for (const [repeat, phase] of (run.phases ?? []).entries()) {
      const extraction = mergeLabelExtractions((phase.rawReads ?? []).filter(read => read.text).map(read => extractLabelLayout(read.blocks, parseBeanLabelText(read.text))));
      rows.push({ id: fixture.id, split: fixture.split, kind: fixture.kind, browser: run.browser, repeat, extraction, score: scoreFixture(fixture, extraction) });
    }
  }
  const output = localOutput(option("--out", ".staging/ocr-release/replay.json"));
  await save(output, { diagnosticOnly: true, warning: "Reparse of previous OCR text/boxes using current parser/layout, then a simple merge. No new pixels are recognized. Does not reproduce reader retry selection, view priority, cancellation, timing or final UI integration; never use as release accuracy.", inputFile, rows, groups: summarize(rows) });
  console.log(JSON.stringify({ output, rows: rows.length, diagnosticOnly: true }));
}
const commands = { prepare, freeze, verify, run, score, replay, "download-public": downloadPublic };
if (!commands[command]) throw new Error("Usage: node tests/qa/ocr-release-benchmark.mjs prepare|freeze|verify|run|score|replay|download-public [options]; read tests/qa/ocr-release-benchmark.md");
await commands[command]();
