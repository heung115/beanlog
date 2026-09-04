import assert from "node:assert/strict";
import test from "node:test";

const {
  applySessionPersistence,
  SESSION_ONLY_COOKIE_VALUE,
  shouldPersistSession,
  shouldUseSecureCookies,
} = await import("../src/lib/supabase/session-persistence.ts");

test("persistent sessions keep the Supabase cookie lifetime", () => {
  const options = {
    httpOnly: false,
    maxAge: 400 * 24 * 60 * 60,
    path: "/",
    sameSite: "lax",
  };

  assert.deepEqual(applySessionPersistence(options, true), options);
});

test("session-only login removes cookie expiry without weakening attributes", () => {
  const expires = new Date("2030-01-01T00:00:00.000Z");
  const options = {
    expires,
    httpOnly: false,
    maxAge: 400 * 24 * 60 * 60,
    path: "/",
    sameSite: "lax",
    secure: true,
  };

  assert.deepEqual(applySessionPersistence(options, false), {
    httpOnly: false,
    path: "/",
    sameSite: "lax",
    secure: true,
  });
});

test("only the explicit session-only preference disables persistence", () => {
  assert.equal(shouldPersistSession(undefined), true);
  assert.equal(shouldPersistSession("unexpected"), true);
  assert.equal(shouldPersistSession(SESSION_ONLY_COOKIE_VALUE), false);
});

test("production cookies stay secure except on explicit HTTP loopback URLs", () => {
  assert.equal(
    shouldUseSecureCookies("production", "https://beanmap.site", "1"),
    true
  );
  assert.equal(
    shouldUseSecureCookies("production", "http://beanmap.site", "1"),
    true
  );
  assert.equal(
    shouldUseSecureCookies("production", "http://localhost:11037", "1"),
    false
  );
  assert.equal(
    shouldUseSecureCookies("production", "http://127.0.0.1:11037", "1"),
    false
  );
  assert.equal(
    shouldUseSecureCookies("production", "http://[::1]:11037", "1"),
    false
  );
  assert.equal(
    shouldUseSecureCookies("development", "http://localhost:3100", undefined),
    false
  );
});

test("production cookies require an explicit QA flag before loopback relaxation", () => {
  assert.equal(
    shouldUseSecureCookies("production", "http://localhost:11037", undefined),
    true
  );
  assert.equal(
    shouldUseSecureCookies("production", "http://localhost:11037", "0"),
    true
  );
});

test("missing or invalid production URLs fail closed", () => {
  assert.equal(shouldUseSecureCookies("production", undefined, "1"), true);
  assert.equal(
    shouldUseSecureCookies("production", "not a URL", "1"),
    true
  );
});
