import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";
import { createServerClient } from "@supabase/ssr";
import * as authRecovery from "../src/lib/supabase/auth-recovery.ts";
import * as persistence from "../src/lib/supabase/session-persistence.ts";
import * as originRoute from "../src/lib/coffee/origin-route.ts";

// next-intl uses Next's extensionless server import, resolved by Next in-app.
const nextImports = registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context);
} });
const { default: createIntlMiddleware } = await import("next-intl/middleware");
const { routing } = await import("../src/i18n/routing.ts");
nextImports.deregister();

const source = readFileSync(new URL("../src/lib/supabase/middleware.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});

function middlewareModuleWith(error, throws = false, clientFactory) {
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    process: { env: {} },
    require(name) {
      if (name === "next/server") return { NextResponse };
      if (name === "./auth-recovery") return authRecovery;
      if (name === "./session-persistence") return persistence;
      if (name === "./config") return { supabaseCookieOptions: { name: "auth-cookie", secure: false } };
      if (name === "@supabase/ssr") return { createServerClient: clientFactory ?? (() => ({ auth: { getUser: async () => {
        if (throws) throw error;
        return { data: { user: null }, error };
      } } })) };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return exports;
}

const middlewareWith = (error, throws) => middlewareModuleWith(error, throws).updateSession;

for (const locale of ["ko", "en"]) {
  for (const status of [429, 503]) {
    test(`${locale} auth HTTP ${status} serves recovery without exposing the protected route or deleting cookies`, async () => {
      const path = `/${locale}/beans/new?draft=1&from=journal`;
      const request = new NextRequest(`http://localhost:3100${path}`, { headers: { cookie: "auth-cookie=existing-session; beanmap-session-only=1" } });
      const response = await middlewareWith({ status })(request);
      assert.equal(response.status, 503);
      assert.equal(response.headers.get("location"), null);
      const rewrite = new URL(response.headers.get("x-middleware-rewrite"));
      assert.equal(rewrite.pathname, `/${locale}/session-unavailable`);
      assert.equal(rewrite.searchParams.get("next"), path);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("retry-after"), "5");
      assert.equal(response.headers.get("x-middleware-next"), null);
      assert.equal(response.cookies.getAll().length, 0);
      assert.equal(request.cookies.get("auth-cookie").value, "existing-session");
    });
  }
}

test("a thrown network failure has the same recoverable response", async () => {
  const response = await middlewareWith(new TypeError("fetch failed"), true)(new NextRequest("http://localhost:3100/en/settings"));
  assert.equal(response.status, 503);
  assert.match(response.headers.get("x-middleware-rewrite"), /\/en\/session-unavailable/);
});

test("a verified missing session still requires login with its return path", async () => {
  const response = await middlewareWith({ name: "AuthSessionMissingError", status: 400 })(new NextRequest("http://localhost:3100/ko/settings"));
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get("location")).pathname, "/ko/login");
});

test("public recovery and origin pages remain reachable during an auth outage", async () => {
  for (const route of ["session-unavailable", "origins"]) {
    const response = await middlewareWith({ status: 503 })(new NextRequest(`http://localhost:3100/en/${route}`));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-middleware-rewrite"), null);
  }
});

function proxyWith(error) {
  const proxySource = readFileSync(new URL("../src/proxy.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(proxySource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require(name) {
      if (name === "next/server") return { NextRequest, NextResponse };
      if (name === "@/lib/supabase/middleware") return middlewareModuleWith(error);
      if (name === "./i18n/routing") return { routing };
      if (name === "@/lib/security/redirect") return {};
      if (name === "@/lib/coffee/origin-route") return originRoute;
      if (name === "next-intl/middleware") return { default: createIntlMiddleware };
      throw new Error(`Unexpected dependency: ${name}`);
    },
    URL,
  });
  return exports.proxy;
}

test("locale proxy composition preserves the recovery rewrite, status, retry delay, and locale cookie", async () => {
  const request = new NextRequest("http://localhost:3100/en/settings?from=journal");
  const response = await proxyWith({ status: 429 })(request);
  assert.equal(request.nextUrl.pathname, "/en/settings");
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("location"), null);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("retry-after"), "5");
  assert.equal(response.headers.get("x-middleware-request-x-next-intl-locale"), "en");
  assert.equal(response.cookies.get("NEXT_LOCALE").value, "en");
  const rewrite = new URL(response.headers.get("x-middleware-rewrite"));
  assert.equal(rewrite.pathname, "/en/session-unavailable");
  assert.equal(rewrite.searchParams.get("next"), "/en/settings?from=journal");
});

for (const [description, locale, preferenceHeaders] of [
  ["saved locale before browser language", "en", { cookie: "NEXT_LOCALE=en", "accept-language": "ko" }],
  ["browser language", "en", { "accept-language": "en-US,en;q=0.9" }],
  ["default locale", "ko", {}],
]) {
  test(`unprefixed recovery honors ${description} without a Location header or lost destination`, async () => {
    const originalUrl = "http://localhost:3100/settings?from=journal&tab=profile";
    const request = new NextRequest(originalUrl, { headers: {
      ...preferenceHeaders,
      cookie: [preferenceHeaders.cookie, "auth-cookie=existing-session"].filter(Boolean).join("; "),
    } });
    const response = await proxyWith({ status: 503 })(request);
    assert.equal(request.nextUrl.href, originalUrl);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("location"), null);
    assert.equal(response.headers.get("x-middleware-next"), null);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("retry-after"), "5");
    assert.equal(response.headers.get("x-middleware-request-x-next-intl-locale"), locale);
    assert.match(response.headers.get("x-middleware-override-headers"), /x-next-intl-locale/);
    assert.match(response.headers.get("x-middleware-request-cookie"), /auth-cookie=existing-session/);
    const rewrite = new URL(response.headers.get("x-middleware-rewrite"));
    assert.equal(rewrite.pathname, `/${locale}/session-unavailable`);
    assert.equal(rewrite.searchParams.get("next"), `/${locale}/settings?from=journal&tab=profile`);
  });
}

test("a missing session at an unprefixed protected path still requires localized login", async () => {
  const request = new NextRequest("http://localhost:3100/settings?from=journal", { headers: { cookie: "NEXT_LOCALE=en" } });
  const response = await proxyWith({ name: "AuthSessionMissingError", status: 400 })(request);
  assert.equal(response.status, 307);
  const login = new URL(response.headers.get("location"));
  assert.equal(login.pathname, "/en/login");
  assert.equal(login.searchParams.get("next"), "/en/settings?from=journal");
});

const fixtureUser = {
  id: "00000000-0000-0000-0000-000000000001", aud: "authenticated", role: "authenticated",
  email: "fixture@local.test", created_at: "2020-01-01T00:00:00Z",
};
function expiredSessionRequest() {
  const session = {
    access_token: "fixture.expired.signature", refresh_token: "fixture-refresh-token",
    token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) - 60,
    user: fixtureUser,
  };
  const encoded = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  const half = Math.floor(encoded.length / 2);
  return new NextRequest("http://localhost:3100/en/settings", { headers: {
    cookie: `auth-cookie.0=${encoded.slice(0, half)}; auth-cookie.1=${encoded.slice(half)}; beanmap-session-only=1; theme=mist`,
  } });
}

function middlewareWithSdk(fetch) {
  return middlewareModuleWith(null, false, (_url, _key, options) => createServerClient(
    "http://localhost:9999", "fixture-public-key", { ...options, global: { fetch } }
  )).updateSession;
}

function authResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: {
    "content-type": "application/json", "x-supabase-api-version": "2024-01-01",
  } });
}

test("the real SDK's expired-token HTTP 429 cannot delete existing session-cookie chunks", async (t) => {
  t.mock.method(console, "error", () => {});
  const request = expiredSessionRequest();
  const before = request.cookies.getAll();
  const paths = [];
  const response = await middlewareWithSdk(async (url) => {
    paths.push(new URL(url).pathname);
    return authResponse(429, { code: "over_request_rate_limit", msg: "Too many requests" });
  })(request);
  assert.deepEqual(paths, ["/auth/v1/token"]);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("location"), null);
  assert.deepEqual(request.cookies.getAll(), before);
  assert.deepEqual(response.cookies.getAll(), []);
});

for (const userStatus of [200, 503]) {
  test(`real SDK token rotation survives the following user HTTP ${userStatus}`, async () => {
    const request = expiredSessionRequest();
    const paths = [];
    const response = await middlewareWithSdk(async (url) => {
      const path = new URL(url).pathname;
      paths.push(path);
      return path.endsWith("/token") ? authResponse(200, {
        access_token: "fixture.rotated.signature", refresh_token: "rotated-fixture-refresh-token",
        token_type: "bearer", expires_in: 3600, user: fixtureUser,
      }) : authResponse(userStatus, userStatus === 200 ? fixtureUser : { msg: "Temporarily unavailable" });
    })(request);
    assert.deepEqual(paths, ["/auth/v1/token", "/auth/v1/user"]);
    assert.equal(response.status, userStatus);
    const updated = response.cookies.get("auth-cookie");
    assert.ok(updated?.value.startsWith("base64-"));
    const session = JSON.parse(Buffer.from(updated.value.slice(7), "base64url").toString());
    assert.equal(session.refresh_token, "rotated-fixture-refresh-token");
    assert.equal(session.access_token, "fixture.rotated.signature");
    assert.equal(request.cookies.get("auth-cookie").value, updated.value);
    assert.equal(updated.maxAge, undefined);
    for (const chunk of ["auth-cookie.0", "auth-cookie.1"]) {
      assert.equal(response.cookies.get(chunk).maxAge, 0);
    }
    assert.equal(request.cookies.get("theme").value, "mist");
    assert.equal(request.cookies.get("beanmap-session-only").value, "1");
  });
}

test("the real SDK still clears rejected refresh tokens and requires login", async (t) => {
  t.mock.method(console, "error", () => {});
  const request = expiredSessionRequest();
  const response = await middlewareWithSdk(async () => authResponse(400, {
    code: "refresh_token_not_found", msg: "Invalid Refresh Token: Refresh Token Not Found",
  }))(request);
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get("location")).pathname, "/en/login");
  for (const chunk of ["auth-cookie.0", "auth-cookie.1"]) {
    assert.equal(response.cookies.get(chunk).maxAge, 0);
    assert.equal(request.cookies.has(chunk), false);
  }
  assert.equal(request.cookies.get("theme").value, "mist");
});
