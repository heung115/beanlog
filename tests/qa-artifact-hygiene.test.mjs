import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, existsSync, statSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { prepareQaArtifacts } from "../scripts/qa-artifact-hygiene.mjs";

test("QA cleanup expires generated artifacts, protects recent files, and does not follow links", () => {
  const root = mkdtempSync(path.join(tmpdir(), "beanmap-artifact-policy-"));
  try {
    const results = path.join(root, "test-results");
    mkdirSync(results);
    const old = path.join(results, "old-trace.zip"), recent = path.join(results, "recent.png");
    const outside = path.join(root, "outside.txt");
    for (const file of [old, recent, outside]) writeFileSync(file, "fixture", { mode: 0o644 });
    const outsideOriginalMode = statSync(outside).mode & 0o777;
    utimesSync(old, new Date(0), new Date(0));
    symlinkSync(outside, path.join(results, "link"));
    const output = prepareQaArtifacts(root);
    assert.deepEqual(output, { removed: 1, protected: 1 });
    assert.equal(existsSync(old), false);
    assert.equal(statSync(recent).mode & 0o777, 0o600);
    assert.equal(statSync(results).mode & 0o777, 0o700);
    assert.equal(statSync(outside).mode & 0o777, outsideOriginalMode);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
