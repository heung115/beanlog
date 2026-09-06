import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server.js";
import * as boundary from "../src/lib/security/admin-boundary.ts";
import * as redirects from "../src/lib/security/redirect.ts";

const privateOrigin = "https://operator.example.ts.net:9443";
const publicOrigin = "https://beanmap.example";
const fixtureSecret = "private-ingress-unit-test-fixture-0123456789";
const fixtureEnv = {
  ADMIN_PRIVATE_ORIGIN: privateOrigin,
  ADMIN_INGRESS_SECRET_FILE: "/run/secrets/unit-test-admin-secret",
  NEXT_PUBLIC_APP_URL: publicOrigin,
};

function privateHeaders(changes = {}) {
  const result = new Headers({
    host: new URL(privateOrigin).host,
    "x-forwarded-host": new URL(privateOrigin).host,
    "x-forwarded-proto": "https",
    [boundary.ADMIN_INGRESS_HEADER]: fixtureSecret,
    ...changes,
  });
  for (const [name, value] of Object.entries(changes)) if (value === null) result.delete(name);
  return result;
}

function loadModule(relativePath, dependencies, globals = {}) {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, URL, URLSearchParams, Headers,
    require(name) {
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      throw new Error(`Unexpected dependency: ${name}`);
    },
    ...globals,
  });
  return exports;
}

function privateAccess(requestHeaders, { env = fixtureEnv, unreadable = false } = {}) {
  return loadModule("../src/lib/admin/private-access.ts", {
    "server-only": {},
    "node:fs": { readFileSync: () => {
      if (unreadable) throw new Error("Unreadable configured file");
      return `${fixtureSecret}\n`;
    } },
    "next/headers": { headers: async () => requestHeaders },
    "@/lib/security/admin-boundary": boundary,
  }, { process: { env } });
}

test("private ingress requires the configured secret and exact host, protocol, and request origin", () => {
  const config = { origin: privateOrigin, secret: fixtureSecret };
  assert.equal(boundary.trustedPrivateAdminOrigin(privateHeaders(), config), privateOrigin);
  assert.equal(boundary.trustedPrivateAdminOrigin(privateHeaders({ origin: privateOrigin }), config), privateOrigin);
  for (const changes of [
    { [boundary.ADMIN_INGRESS_HEADER]: null },
    { [boundary.ADMIN_INGRESS_HEADER]: "forged-value" },
    { [boundary.ADMIN_INGRESS_HEADER]: "x".repeat(fixtureSecret.length) },
    { host: "beanmap.example" },
    { host: null },
    { "x-forwarded-host": "attacker.example" },
    { "x-forwarded-host": "operator.example.ts.net:9443, attacker.example" },
    { "x-forwarded-proto": "http" },
    { origin: publicOrigin },
    { origin: "null" },
  ]) {
    assert.equal(boundary.trustedPrivateAdminOrigin(privateHeaders(changes), config), null, JSON.stringify(Object.keys(changes)));
  }
});

test("unset, weak, and malformed private deployment configuration fails closed", async () => {
  for (const config of [
    {}, { origin: privateOrigin }, { secret: fixtureSecret },
    { origin: privateOrigin, secret: "short" },
    { origin: "http://operator.example.ts.net:9443", secret: fixtureSecret },
    { origin: "https://user:password@operator.example.ts.net:9443", secret: fixtureSecret },
    { origin: `${privateOrigin}/admin`, secret: fixtureSecret },
    { origin: `${privateOrigin}?redirect=1`, secret: fixtureSecret },
    { origin: `${privateOrigin}#fragment`, secret: fixtureSecret },
  ]) assert.equal(boundary.trustedPrivateAdminOrigin(privateHeaders(), config), null);
  assert.equal(await privateAccess(privateHeaders(), { env: {} }).getPrivateAdminContext(), null);
  assert.equal(await privateAccess(privateHeaders(), { env: {
    ADMIN_PRIVATE_ORIGIN: privateOrigin, ADMIN_INGRESS_SECRET: fixtureSecret,
  } }).getPrivateAdminContext(), null);
  assert.equal(await privateAccess(privateHeaders(), { unreadable: true }).getPrivateAdminContext(), null);
});

test("insecure loopback access requires explicit QA configuration and never permits a remote HTTP origin", () => {
  const origin = "http://127.0.0.1:3100";
  const headers = new Headers({ host: "127.0.0.1:3100", [boundary.ADMIN_INGRESS_HEADER]: fixtureSecret });
  assert.equal(boundary.trustedPrivateAdminOrigin(headers, { origin, secret: fixtureSecret }), null);
  assert.equal(boundary.trustedPrivateAdminOrigin(headers, { origin, secret: fixtureSecret, allowInsecureLoopback: true }), origin);
  assert.equal(boundary.trustedPrivateAdminOrigin(privateHeaders(), {
    origin: "http://operator.example.ts.net:9443", secret: fixtureSecret, allowInsecureLoopback: true,
  }), null);
});

test("private access honors both established QA loopback flag spellings", async () => {
  const origin = "http://127.0.0.1:3100";
  const headers = new Headers({ host: "127.0.0.1:3100", [boundary.ADMIN_INGRESS_HEADER]: fixtureSecret });
  for (const flag of ["1", "true", "0", "false", ""]) {
    const access = privateAccess(headers, { env: {
      ...fixtureEnv, ADMIN_PRIVATE_ORIGIN: origin, QA_ALLOW_INSECURE_LOOPBACK_AUTH: flag,
    } });
    const context = await access.getPrivateAdminContext();
    assert.equal(context?.origin ?? null, ["1", "true"].includes(flag) ? origin : null);
  }
});

test("admin path filtering covers localized pages and API routes without matching neighboring route names", () => {
  for (const path of ["/admin", "/admin/", "/ko/admin", "/en/admin/catalog", "/api/admin/access"]) {
    assert.equal(boundary.isAdminPath(path), true, path);
  }
  for (const path of ["/", "/ko/settings", "/ko/administrator", "/api/admin-extra", "/en/login"]) {
    assert.equal(boundary.isAdminPath(path), false, path);
  }
});

function apiClient(requestHeaders, { authenticated = true } = {}) {
  const calls = [];
  const loaded = loadModule("../src/lib/api/client.ts", {
    "@/lib/admin/private-access": privateAccess(requestHeaders),
    "@/lib/security/admin-boundary": boundary,
    "@/lib/supabase/server": { createClient: async () => {
      calls.push({ type: "session" });
      return { auth: { getSession: async () => ({ data: {
        session: authenticated ? { access_token: "fixture-user-jwt" } : null,
      } }) } };
    } },
  }, {
    process: { env: { GO_API_URL: "http://api.internal:8080" } },
    fetch: async (url, init) => {
      calls.push({ type: "fetch", url, init });
      return new Response(JSON.stringify({ is_admin: true }), { headers: { "content-type": "application/json" } });
    },
  });
  return { module: loaded, calls };
}

test("public admin API calls stop before reading a session or contacting the Go API", async () => {
  for (const headers of [new Headers({ host: "beanmap.example" }), privateHeaders({ [boundary.ADMIN_INGRESS_HEADER]: "spoofed" })]) {
    const { module, calls } = apiClient(headers);
    for (const path of ["/api/admin", "/api/admin/access", "/api/admin/catalog/country/1"]) {
      await assert.rejects(module.apiFetch(path, { method: "PUT", body: {} }), { status: 404, message: "Not found" });
    }
    assert.deepEqual(calls, []);
  }
});

test("admin Server Actions cannot bypass ingress checks when invoked from another page", async () => {
  const { module, calls } = apiClient(new Headers({ host: "beanmap.example", "next-action": "fixture-action-id" }));
  const actions = loadModule("../src/lib/actions/admin.ts", {
    "zod": { z },
    "next/cache": { revalidatePath: () => { throw new Error("A blocked action cannot revalidate"); } },
    "@/lib/api/client": module,
  });
  assert.equal(await actions.getAdminAccess(), false);
  const result = await actions.updateCatalogLabel({
    kind: "country", id: 1, name_ko: "검증", expected_name_ko: null, reason: "공개 요청 차단 검증",
  });
  assert.equal(result.ok, false);
  assert.deepEqual(calls, []);
});

test("private admin API calls forward the secret only with the signed-in user's JWT", async () => {
  const { module, calls } = apiClient(privateHeaders({ origin: privateOrigin }));
  assert.equal((await module.apiFetch("/api/admin/access")).is_admin, true);
  const forwarded = calls.find((call) => call.type === "fetch");
  assert.equal(forwarded.init.headers.Authorization, "Bearer fixture-user-jwt");
  assert.equal(forwarded.init.headers[boundary.ADMIN_INGRESS_HEADER], fixtureSecret);
  assert.equal(forwarded.init.cache, "no-store");
  calls.length = 0;
  await module.apiFetch("/api/beans");
  assert.equal(calls.find((call) => call.type === "fetch").init.headers[boundary.ADMIN_INGRESS_HEADER], undefined);
});

test("a trusted private ingress does not replace the user's login", async () => {
  const { module, calls } = apiClient(privateHeaders(), { authenticated: false });
  await assert.rejects(module.apiFetch("/api/admin/access"), { status: 401, message: "Unauthorized" });
  assert.equal(calls.filter((call) => call.type === "session").length, 1);
  assert.equal(calls.filter((call) => call.type === "fetch").length, 0);
});

test("the locale proxy rejects public admin pages before session lookup", async () => {
  const loaded = loadModule("../src/proxy.ts", {
    "next/server": { NextRequest, NextResponse },
    "@/lib/admin/private-access": privateAccess(new Headers()),
    "@/lib/security/admin-boundary": boundary,
    "@/lib/supabase/middleware": { updateSession: () => { throw new Error("Public admin paths cannot read authentication"); } },
    "next-intl/middleware": { default: () => () => { throw new Error("Public admin paths cannot be localized"); } },
    "./i18n/routing": { routing: {} },
    "@/lib/security/redirect": {},
    "@/lib/coffee/origin-route": {},
  });
  for (const path of ["/admin", "/ko/admin", "/en/admin", "/api/admin/access"]) {
    const response = await loaded.proxy(new NextRequest(`${publicOrigin}${path}`));
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("location"), null);
  }
});

for (const [name, requestHeaders, expectedOrigin] of [
  ["trusted private ingress", privateHeaders(), privateOrigin],
  ["public request", new Headers({ host: "beanmap.example" }), publicOrigin],
  ["forged private header", privateHeaders({ [boundary.ADMIN_INGRESS_HEADER]: "spoofed" }), publicOrigin],
  ["mismatched private host", privateHeaders({ host: "attacker.example" }), publicOrigin],
]) {
  test(`${name} uses the configured safe origin throughout OAuth`, async () => {
    const access = privateAccess(requestHeaders);
    const calls = [];
    const actions = loadModule("../src/lib/actions/auth.ts", {
      "zod": { z },
      "@/lib/admin/private-access": access,
      "@/lib/security/redirect": redirects,
      "next/navigation": { redirect: () => {} },
      "@/lib/supabase/server": {
        createPublicClient: async () => ({ auth: { signInWithOAuth: async (options) => {
          calls.push(options.options.redirectTo);
          return { data: { url: null }, error: null };
        } } }),
        setSessionPersistencePreference: async () => {},
      },
    });
    await actions.signInWithOAuth("google", true, "/ko/admin");
    const authorizeCallback = new URL(calls[0]);
    assert.equal(authorizeCallback.origin, expectedOrigin);
    assert.equal(authorizeCallback.pathname, "/api/auth/callback");
    assert.equal(authorizeCallback.searchParams.get("next"), "/ko/admin");
    const callback = loadModule("../src/app/api/auth/callback/route.ts", {
      "@/lib/admin/private-access": access,
      "@/lib/security/redirect": redirects,
      "next/server": { NextResponse },
      "next/headers": { cookies: async () => ({ get: () => undefined }) },
      "@/lib/supabase/server": { createClient: async () => ({ auth: {
        exchangeCodeForSession: async () => ({ error: null }),
      } }) },
    });
    const request = new Request(`${privateOrigin}/api/auth/callback?code=fixture-code&next=%2Fko%2Fadmin`, { headers: requestHeaders });
    const response = await callback.GET(request);
    assert.equal(response.headers.get("location"), `${expectedOrigin}/ko/admin`);
    assert.equal(JSON.stringify([...response.headers]).includes(fixtureSecret), false);
  });
}
