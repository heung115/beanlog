import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const middlewarePath = new URL(
  "../src/lib/supabase/middleware.ts",
  import.meta.url
);
const middlewareSource = fs.readFileSync(middlewarePath, "utf8");
const proxySource = fs.readFileSync(
  new URL("../src/proxy.ts", import.meta.url),
  "utf8"
);
const sourceFile = ts.createSourceFile(
  middlewarePath.pathname,
  middlewareSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS
);
const printer = ts.createPrinter();
const policyNames = new Set(["isPublicPath", "isProtectedPath"]);
const policySource = sourceFile.statements
  .filter(
    (statement) =>
      ts.isFunctionDeclaration(statement) &&
      statement.name &&
      policyNames.has(statement.name.text)
  )
  .map((statement) =>
    printer.printNode(ts.EmitHint.Unspecified, statement, sourceFile)
  )
  .join("\n");
const policyJavaScript = ts.transpileModule(policySource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { isPublicPath, isProtectedPath } = await import(
  `data:text/javascript,${encodeURIComponent(policyJavaScript)}`
);

test("localized landing, account, legal, trial, and origin routes are public", () => {
  const publicPaths = ["/"];

  for (const locale of ["ko", "en"]) {
    publicPaths.push(`/${locale}`, `/${locale}/`);

    for (const route of [
      "login",
      "signup",
      "signup/check-email",
      "privacy",
      "terms",
      "try",
      "origins",
    ]) {
      publicPaths.push(`/${locale}/${route}`, `/${locale}/${route}/`);
    }
  }

  publicPaths.push(
    "/ko/origins/ethiopia",
    "/en/origins/costa-rica",
    "/en/origins/timor-leste-2/"
  );

  for (const pathname of publicPaths) {
    assert.equal(isPublicPath(pathname), true, pathname);
    assert.equal(isProtectedPath(pathname), false, pathname);
  }
});

test("known application route families remain protected with or without a locale", () => {
  for (const pathname of [
    "/explore",
    "/explore/recent",
    "/beans/new",
    "/ko/explore",
    "/en/explore/recent",
    "/ko/beans/new",
    "/en/beans/record-id/edit",
    "/ko/stats",
    "/en/settings/profile",
  ]) {
    assert.equal(isPublicPath(pathname), false, pathname);
    assert.equal(isProtectedPath(pathname), true, pathname);
  }
});

test("unknown and spoofed paths are neither public nor protected", () => {
  for (const pathname of [
    "",
    "ko/login",
    "/not-a-real-page",
    "/ko/not-a-real-page",
    "/fr/origins",
    "/koala",
    "/ko/login-help",
    "/ko/login/extra",
    "/ko/signup/check-email/extra",
    "/ko/privacy-policy",
    "/ko/tryout",
    "/ko/origins-archive",
    "/ko/origins/Ethiopia",
    "/ko/origins/-ethiopia",
    "/ko/origins/ethiopia-",
    "/ko/origins/ethiopia--sidamo",
    "/ko/origins/ethiopia_slug",
    "/ko/origins/ethiopia.evil",
    "/ko/origins/ethiopia%2Fedit",
    "/ko/origins/ethiopia/details",
    "/ko/explore-more",
  ]) {
    assert.equal(isPublicPath(pathname), false, pathname);
    assert.equal(isProtectedPath(pathname), false, pathname);
  }
});

test("session middleware redirects only recognized protected routes", () => {
  assert.match(
    middlewareSource,
    /if \(!user && isProtectedPath\(pathname\)\)/
  );
  assert.doesNotMatch(
    middlewareSource,
    /if \(!user && !isPublicPath\(pathname\)\)/
  );
});

test("the extensionless Open Graph image bypasses locale redirects", () => {
  assert.match(proxySource, /pathname === "\/opengraph-image"/);
  assert.ok(
    proxySource.indexOf('pathname === "/opengraph-image"') <
      proxySource.indexOf("intlMiddleware(request)"),
    "the metadata route should return before next-intl can prefix it"
  );
});
