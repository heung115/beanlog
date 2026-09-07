import assert from "node:assert/strict";
import test from "node:test";
import { hasSecretPattern, scanTrackedFiles } from "../scripts/check-secret-files.mjs";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

test("credential scanner recognizes keys and tokens without treating placeholders as secrets", () => {
  for (const value of ["ghp_" + "a".repeat(36), ["eyJabc", "fixture", "token"].join("."), "-----BEGIN " + "PRIVATE KEY-----"]) {
    assert.equal(hasSecretPattern(value), true);
  }
  assert.equal(hasSecretPattern("ci-placeholder-anon-key"), false);
});

test("scanner inspects staged sensitive paths, skips ignored files, and emits paths only", () => {
  const root = mkdtempSync(path.join(tmpdir(), "beanmap-secret-check-"));
  try {
    execFileSync("git", ["init", "-q", root]);
    writeFileSync(path.join(root, ".gitignore"), ".env\n");
    writeFileSync(path.join(root, ".env"), "ignored-real-looking-value");
    writeFileSync(path.join(root, "fixture.ts"), "ghp_" + "a".repeat(36));
    writeFileSync(path.join(root, "traffic.har"), "{}");
    execFileSync("git", ["add", "."], { cwd: root });
    assert.deepEqual(scanTrackedFiles(root), ["fixture.ts", "traffic.har"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
