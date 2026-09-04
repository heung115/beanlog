import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { ensureQaCredentials } from "../scripts/staging-credentials.mjs";

test("QA credentials are random, stable, isolated, and mode 0600", () => {
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "beanmap-qa-"));

  try {
    const first = ensureQaCredentials(runtimeRoot);
    const second = ensureQaCredentials(runtimeRoot);
    const file = path.join(runtimeRoot, "qa-credentials.secret");

    assert.deepEqual(second, first);
    assert.notEqual(first.primary.email, first.isolation.email);
    assert.notEqual(first.primary.email, first.empty.email);
    assert.notEqual(first.isolation.email, first.empty.email);
    assert.notEqual(first.primary.password, first.isolation.password);
    assert.notEqual(first.primary.password, first.empty.password);
    assert.notEqual(first.isolation.password, first.empty.password);
    assert.ok(first.primary.password.length >= 24);
    assert.match(first.empty.email, /^beanmap-qa-empty-.+@local\.test$/);
    assert.ok(first.empty.password.length >= 24);
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  } finally {
    fs.rmSync(runtimeRoot, { recursive: true, force: true });
  }
});

test("legacy QA credentials gain a separate empty-state account", () => {
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "beanmap-qa-legacy-"));
  const file = path.join(runtimeRoot, "qa-credentials.secret");
  const legacy = {
    primary: {
      email: "beanmap-qa-primary-legacy@local.test",
      password: "p".repeat(24),
    },
    isolation: {
      email: "beanmap-qa-isolation-legacy@local.test",
      password: "i".repeat(24),
    },
  };

  try {
    fs.writeFileSync(file, `${JSON.stringify(legacy)}\n`, { mode: 0o600 });
    const migrated = ensureQaCredentials(runtimeRoot);

    assert.deepEqual(migrated.primary, legacy.primary);
    assert.deepEqual(migrated.isolation, legacy.isolation);
    assert.match(migrated.empty.email, /^beanmap-qa-empty-.+@local\.test$/);
    assert.ok(migrated.empty.password.length >= 24);
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    assert.deepEqual(ensureQaCredentials(runtimeRoot), migrated);
  } finally {
    fs.rmSync(runtimeRoot, { recursive: true, force: true });
  }
});

test("QA source files contain no committed password values", () => {
  const helpers = fs.readFileSync(
    new URL("./qa/helpers.ts", import.meta.url),
    "utf8"
  );
  const security = fs.readFileSync(
    new URL("./qa/security.spec.ts", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(helpers, /password:\s*["']/);
  assert.doesNotMatch(security, /password:\s*["']/);
});
