import assert from "node:assert/strict";
import test from "node:test";
import { applyNonceHeaders, contentSecurityPolicy, createScriptNonce } from "../src/lib/security/csp.ts";

test("production scripts require a fresh random nonce and disallow inline handlers and eval", () => {
  const nonces = Array.from({ length: 100 }, createScriptNonce);
  assert.equal(new Set(nonces).size, nonces.length);
  for (const nonce of nonces) {
    assert.equal(Buffer.from(nonce, "base64").length, 24);
    const policy = contentSecurityPolicy(nonce, false);
    assert.equal(policy.split("; ").find(value => value.startsWith("script-src ")), `script-src 'self' 'nonce-${nonce}'`);
    assert.ok(policy.includes("script-src-attr 'none'"));
    assert.ok(!policy.includes("'unsafe-eval'"));
  }
  assert.throws(() => contentSecurityPolicy("attacker'; script-src *"));
  assert.equal(contentSecurityPolicy(undefined, false).split("; ")[1], "script-src 'self'");
  assert.ok(contentSecurityPolicy(nonces[0], true).includes("'unsafe-eval'"));
});

test("nonce policy survives locale and cookie header composition without accepting a caller's nonce", () => {
  const nonce = createScriptNonce();
  const policy = contentSecurityPolicy(nonce, false);
  const headers = new Headers({
    "x-middleware-override-headers": "cookie,x-next-intl-locale,x-nonce,content-security-policy",
    "x-middleware-request-cookie": "session=refreshed",
    "x-middleware-request-x-next-intl-locale": "en",
    "x-middleware-request-x-nonce": "forged",
    "x-middleware-request-content-security-policy": "script-src *",
    "retry-after": "5",
    "cache-control": "public, max-age=600",
  });
  applyNonceHeaders(headers, nonce, policy, new Headers({ cookie: "session=old" }));
  assert.equal(headers.get("x-middleware-request-x-nonce"), nonce);
  assert.equal(headers.get("x-middleware-request-content-security-policy"), policy);
  assert.equal(headers.get("content-security-policy"), policy);
  assert.equal(headers.get("x-middleware-request-cookie"), "session=refreshed");
  assert.equal(headers.get("x-middleware-request-x-next-intl-locale"), "en");
  assert.equal(headers.get("retry-after"), "5");
  assert.equal(headers.get("cache-control"), "no-store");
  const names = headers.get("x-middleware-override-headers").split(",");
  assert.equal(names.length, new Set(names).size);
});

test("forwarding CSP preserves request headers when there are no prior overrides", () => {
  const headers = new Headers();
  const nonce = createScriptNonce();
  applyNonceHeaders(headers, nonce, contentSecurityPolicy(nonce, false), new Headers({ cookie: "session=existing", accept: "text/html" }));
  assert.equal(headers.get("x-middleware-request-cookie"), "session=existing");
  assert.equal(headers.get("x-middleware-request-accept"), "text/html");
});
