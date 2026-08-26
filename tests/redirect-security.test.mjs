import assert from "node:assert/strict";
import test from "node:test";

const { resolveTrustedAppRedirect } = await import(
  "../src/lib/security/redirect.ts"
);

test("OAuth redirects stay on the configured application origin", () => {
  const appUrl = "https://beanmap.example/application-path";
  for (const maliciousNext of [
    "https://attacker.example/phish",
    "//attacker.example/phish",
    "/\\attacker.example/phish",
    "\\attacker.example/phish",
    "javascript:alert(1)",
  ]) {
    const destination = resolveTrustedAppRedirect(maliciousNext, appUrl);
    assert.equal(destination.origin, "https://beanmap.example");
    assert.equal(destination.pathname, "/explore");
  }

  const valid = resolveTrustedAppRedirect("/ko/explore?sort=recent", appUrl);
  assert.equal(valid.href, "https://beanmap.example/ko/explore?sort=recent");
});

test("invalid configured origins fall back without reflecting credentials", () => {
  for (const configuredAppUrl of [
    "javascript:alert(1)",
    "not a URL",
    "file:///tmp/beanmap",
  ]) {
    const destination = resolveTrustedAppRedirect(
      "/login?error=invalid_credentials",
      configuredAppUrl,
      "/login"
    );
    assert.equal(
      destination.href,
      "http://localhost:3100/login?error=invalid_credentials"
    );
    assert.doesNotMatch(destination.href, /token|password/i);
  }
});
