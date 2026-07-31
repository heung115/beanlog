import assert from "node:assert/strict";
import test from "node:test";

const { clearAuthCookies, isUnrecoverableRefreshError } = await import(
  "../src/lib/supabase/auth-recovery.ts"
);

test("missing and already-used refresh tokens require local recovery", () => {
  assert.equal(
    isUnrecoverableRefreshError({ code: "refresh_token_not_found" }),
    true
  );
  assert.equal(
    isUnrecoverableRefreshError({ code: "refresh_token_already_used" }),
    true
  );
  assert.equal(
    isUnrecoverableRefreshError({ message: "Invalid Refresh Token: Refresh Token Not Found" }),
    true
  );
});

test("transient and unrelated auth errors preserve the session", () => {
  assert.equal(isUnrecoverableRefreshError({ code: "request_timeout" }), false);
  assert.equal(isUnrecoverableRefreshError({ code: "over_request_rate_limit" }), false);
  assert.equal(isUnrecoverableRefreshError({ message: "network unavailable" }), false);
  assert.equal(isUnrecoverableRefreshError(null), false);
});

test("local recovery expires every auth-cookie chunk and preserves other cookies", () => {
  const requestCookies = new Map([
    ["sb-localhost-auth-token", "base"],
    ["sb-localhost-auth-token.0", "chunk-zero"],
    ["sb-localhost-auth-token.1", "chunk-one"],
    ["theme", "dark"],
  ]);
  const expired = [];
  const request = {
    cookies: {
      getAll: () => [...requestCookies].map(([name, value]) => ({ name, value })),
      delete: (name) => requestCookies.delete(name),
    },
  };
  const response = {
    cookies: {
      set: (name, value, options) => expired.push({ name, value, options }),
    },
  };

  clearAuthCookies(request, response, "sb-localhost-auth-token");

  assert.deepEqual([...requestCookies], [["theme", "dark"]]);
  assert.deepEqual(
    expired.map(({ name }) => name),
    [
      "sb-localhost-auth-token",
      "sb-localhost-auth-token.0",
      "sb-localhost-auth-token.1",
    ]
  );
  for (const cookie of expired) {
    assert.equal(cookie.value, "");
    assert.equal(cookie.options.maxAge, 0);
    assert.equal(cookie.options.path, "/");
  }
});
