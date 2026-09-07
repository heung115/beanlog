import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

test("score audit rejects deleted observations and changed frozen truth", async () => {
  const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const parent = path.join(repository, ".staging/ocr-release-score-tests");
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(path.join(parent, "case-"));
  try {
    const manifestPath = path.join(directory, "manifest.json"), inputPath = path.join(directory, "input.json"), outputPath = path.join(directory, "output.json");
    const sha256 = "a".repeat(64), fixture = { id: "unit-fixture", split: "development", kind: "coffee", sha256, expected: { fields: { name: "Fixture Coffee" } } };
    const manifestBytes = JSON.stringify({ fixtures: [fixture] });
    await writeFile(manifestPath, manifestBytes);
    const run = { freeze: { sourceManifestSha256: createHash("sha256").update(manifestBytes).digest("hex") }, selectedIds: [fixture.id], browsers: ["webkit"], repeats: 2,
      rows: [0, 1].map(repeat => ({ id: fixture.id, browser: "webkit", repeat, imageSha256: sha256, workerReused: repeat === 1, elapsedMs: 100, extraction: { fields: { name: "Fixture Coffee" } } })) };
    const execute = () => spawnSync(process.execPath, ["tests/qa/ocr-release-benchmark.mjs", "score", "--manifest", manifestPath, "--input", inputPath, "--out", outputPath], { cwd: repository, encoding: "utf8" });
    await writeFile(inputPath, JSON.stringify(run));
    assert.equal(execute().status, 0);
    assert.equal(JSON.parse(await readFile(outputPath, "utf8")).groups[0].fields.total, 1);
    await writeFile(inputPath, JSON.stringify({ ...run, repeats: 1, rows: run.rows.slice(0, 1) }));
    assert.equal(execute().status, 0);
    const firstOnly = JSON.parse(await readFile(outputPath, "utf8")).groups[0];
    assert.equal(firstOnly.repeatedExpectedReads, 0);
    assert.equal(firstOnly.stableExtractions, 0);
    await writeFile(inputPath, JSON.stringify({ ...run, repeats: 1, rows: [] }));
    assert.notEqual(execute().status, 0);
    await writeFile(inputPath, JSON.stringify({ ...run, rows: run.rows.slice(0, 1) }));
    const incomplete = execute();
    assert.notEqual(incomplete.status, 0); assert.match(incomplete.stderr, /Incomplete result rows/u);
    await writeFile(inputPath, JSON.stringify(run));
    await writeFile(manifestPath, JSON.stringify({ fixtures: [{ ...fixture, expected: { fields: { name: "Different Golden" } } }] }));
    const changedTruth = execute();
    assert.notEqual(changedTruth.status, 0); assert.match(changedTruth.stderr, /differs from the run's frozen truth/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("prepare validates forbidden schema before any OCR and preserves nested values", async () => {
  const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const parent = path.join(repository, ".staging/ocr-release-score-tests");
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(path.join(parent, "schema-"));
  try {
    const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6z8AAAAASUVORK5CYII=", "base64");
    await writeFile(path.join(directory, "pixel.png"), image);
    const manifestPath = path.join(directory, "manifest.json"), outputPath = path.join(directory, "corpus.json");
    const fixture = { id: "schema-fixture", path: "pixel.png", sha256: createHash("sha256").update(image).digest("hex"), expected: { fields: { name: "Example Coffee" } } };
    const execute = () => spawnSync(process.execPath, ["tests/qa/ocr-release-benchmark.mjs", "prepare", "--development", manifestPath, "--no-generated-negatives", "--out", outputPath], { cwd: repository, encoding: "utf8" });
    await writeFile(manifestPath, JSON.stringify({ fixtures: [{ ...fixture, forbiddenValues: { fields: { name: "Example Blend" } } }] }));
    const invalid = execute();
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /forbiddenValues\.fields\.name must be an array/u);
    await assert.rejects(readFile(outputPath), { code: "ENOENT" });
    const forbiddenValues = { fields: { name: ["Example Blend"] } };
    await writeFile(manifestPath, JSON.stringify({ fixtures: [{ ...fixture, forbiddenValues }] }));
    assert.equal(execute().status, 0);
    assert.deepEqual(JSON.parse(await readFile(outputPath, "utf8")).fixtures[0].forbiddenValues, forbiddenValues);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
