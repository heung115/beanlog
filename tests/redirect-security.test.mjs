import assert from "node:assert/strict";
import test from "node:test";

const { resolveTrustedAppRedirect, resolvePostAuthPath } = await import(
  "../src/lib/security/redirect.ts"
);

test("post-login destinations retain locale and accept only application pages", () => {
  for (const next of ["/ko/explore", "/en/stats?view=origins", "/en/beans/new?draft=1", "/ko/beans/12345678-1234-1234-1234-123456789abc/edit"]) {
    assert.equal(resolvePostAuthPath(next), next);
  }
  for (const next of [null, "https://attacker.example", "//attacker.example", "/en/\\attacker.example", "/en/../../api/auth/callback", "/en/login", "/en/stats-extra", "/en/%2f%2fattacker.example"]) {
    assert.equal(resolvePostAuthPath(next), "/explore");
  }
});

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
