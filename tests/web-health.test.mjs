import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);

function read(relativePath) {
  return fs.readFileSync(new URL(relativePath, root), "utf8");
}

const routeSource = read("src/app/api/health/route.ts");
const routeJavaScript = ts.transpileModule(routeSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: "src/app/api/health/route.ts",
  reportDiagnostics: true,
});

assert.deepEqual(
  (routeJavaScript.diagnostics ?? [])
    .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
    .map((diagnostic) => diagnostic.messageText),
  []
);

const healthRoute = await import(
  `data:text/javascript;base64,${Buffer.from(routeJavaScript.outputText).toString("base64")}`
);

test("the web health route is bodyless, non-cacheable, and dependency-free", async () => {
  assert.doesNotMatch(routeSource, /^import\s/m);

  const response = healthRoute.GET();

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(await response.text(), "");
});

test("web container healthchecks use the lightweight route", () => {
  for (const composeFile of [
    "docker-compose.staging.yml",
    "docker-compose.production.yml",
  ]) {
    const compose = read(composeFile);
    const webService = compose.match(/\n  web:[\s\S]*?\n  api:/)?.[0] ?? "";

    assert.match(webService, /http:\/\/127\.0\.0\.1:3000\/api\/health/);
    assert.doesNotMatch(webService, /http:\/\/127\.0\.0\.1:3000\/ko\/login/);
  }
});

test("staging readiness and status consistently report the web health route", () => {
  const staging = read("scripts/staging.mjs");

  assert.match(
    staging,
    /waitFor\(\s*`http:\/\/localhost:\$\{runtime\.web\}\/api\/health`,\s*"beanmap web",\s*120_000,\s*204\s*\)/
  );
  assert.match(
    staging,
    /waitFor\(\s*`\$\{env\.STAGING_APP_URL\}\/api\/health`,\s*"beanmap web",\s*20_000,\s*204\s*\)/
  );
  assert.match(
    staging,
    /waitFor\(\s*`http:\/\/localhost:\$\{runtime\.api\}\/health`,\s*"beanmap API",\s*120_000,\s*200\s*\)/
  );
  assert.match(
    staging,
    /\["App", `http:\/\/localhost:\$\{runtime\.web\}\/api\/health`\]/
  );
  assert.doesNotMatch(staging, /runtime\.web\}\/ko\/login/);
});

test("the runtime audit probes health separately from page security headers", () => {
  const audit = read("scripts/audit.sh");
  const webProbe = audit.match(/^\s*WEB_CODE=.*$/m)?.[0] ?? "";
  const headerProbe = audit.match(
    /^\s*curl .*--dump-header "\$TMP_ROOT\/headers\.txt".*$/m
  )?.[0] ?? "";

  assert.match(webProbe, /\/api\/health/);
  assert.doesNotMatch(webProbe, /\/ko\/login/);
  assert.match(audit, /\[\[ "\$WEB_CODE" == "204" \]\]/);
  assert.match(headerProbe, /\/ko\/login/);
});
