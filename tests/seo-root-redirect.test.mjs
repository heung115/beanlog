import * as csp from "../src/lib/security/csp.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";
import * as redirects from "../src/lib/security/redirect.ts";

const nextImports = registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context);
} });
const { default: createIntlMiddleware } = await import("next-intl/middleware");
const { routing } = await import("../src/i18n/routing.ts");
nextImports.deregister();

const compiled = ts.transpileModule(
  readFileSync(new URL("../src/proxy.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText;
const exports = {};
vm.runInNewContext(compiled, {
  exports,
  URL,
  require(name) {
    if (name === "@/lib/security/csp") return csp;
    if (name === "next/server") return { NextRequest, NextResponse };
    if (name === "next-intl/middleware") return { default: createIntlMiddleware };
    if (name === "./i18n/routing") return { routing };
    if (name === "@/lib/security/redirect") return redirects;
    if (name === "@/lib/security/admin-boundary") return { isAdminPath: () => false };
    if (name === "@/lib/admin/private-access") return { privateAdminContext: () => null };
    if (name === "@/lib/coffee/origin-route") return { isMissingOriginPath: () => false };
    if (name === "@/lib/supabase/middleware") return {
      isProtectedPath: () => false,
      updateSession: async () => NextResponse.next(),
      preserveAuthResponse: (_session, response) => response,
    };
    throw new Error(`Unexpected dependency: ${name}`);
  },
});

for (const method of ["GET", "HEAD"]) {
  test(`root ${method} permanently resolves to Korean canonical regardless of language preference`, async () => {
    for (const headers of [{}, { "accept-language": "en-US,en;q=0.9" }, { cookie: "NEXT_LOCALE=en" }]) {
      const response = await exports.proxy(new NextRequest("https://beanmap.site/?loggedOut=1&next=%2Fko%2Forigins", { method, headers }));
      assert.equal(response.status, 308);
      assert.equal(response.headers.get("location"), "https://beanmap.site/ko?loggedOut=1&next=%2Fko%2Forigins");
    }
  });
}

test("root OAuth errors keep recovery precedence over the permanent homepage redirect", async () => {
  const response = await exports.proxy(new NextRequest("https://beanmap.site/?error=access_denied&next=%2Fen%2Fexplore", {
    headers: { cookie: "NEXT_LOCALE=en" },
  }));
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const destination = new URL(response.headers.get("location"));
  assert.equal(destination.pathname, "/en/login");
  assert.equal(destination.searchParams.get("next"), "/en/explore");
});

test("explicit English homepage keeps its locale without a Korean redirect", async () => {
  const response = await exports.proxy(new NextRequest("https://beanmap.site/en", {
    headers: { "accept-language": "ko", cookie: "NEXT_LOCALE=ko" },
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("location"), null);
  assert.equal(response.headers.get("x-middleware-request-x-next-intl-locale"), "en");
});
