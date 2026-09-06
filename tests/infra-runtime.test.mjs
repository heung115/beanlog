import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const loadConfig = require("next/dist/server/config").default;
const { PHASE_PRODUCTION_BUILD } = require("next/constants");
const FileSystemCache = require("next/dist/server/lib/incremental-cache/file-system-cache").default;
const { CachedRouteKind, IncrementalCacheKind } = require("next/dist/server/response-cache");

// Use Next's actual cache implementation and this project's loaded config. This
// reproduces the production .body write failure without making a real disk RW.
test("production metadata refreshes retain their response without writing to the image", async () => {
  const config = await loadConfig(PHASE_PRODUCTION_BUILD, root);
  let writeAttempts = 0;
  const readonlyFilesystem = {
    async mkdir() { writeAttempts += 1; throw Object.assign(new Error("read-only image"), { code: "EROFS" }); },
    async writeFile() { writeAttempts += 1; throw Object.assign(new Error("read-only image"), { code: "EROFS" }); },
    async readFile() { throw Object.assign(new Error("cache miss"), { code: "ENOENT" }); },
  };
  const cache = new FileSystemCache({
    fs: readonlyFilesystem,
    flushToDisk: config.experimental.isrFlushToDisk,
    serverDistDir: "/app/.next/server",
    maxMemoryCacheSize: config.cacheMaxMemorySize,
    revalidatedTags: [],
  });
  for (const route of ["robots.txt", "sitemap.xml", "favicon.ico", "opengraph-image"]) {
    const value = {
      kind: CachedRouteKind.APP_ROUTE,
      body: Buffer.from(`metadata-response:${route}`),
      headers: { "content-type": route.endsWith("xml") ? "application/xml" : "text/plain" },
      status: 200,
    };
    const key = `infra-regression/${route}`;
    await cache.set(key, value, {});
    const cached = await cache.get(key, { kind: IncrementalCacheKind.APP_ROUTE });
    assert.equal(cached.value.status, 200);
    assert.equal(cached.value.body.toString(), value.body.toString());
  }
  assert.equal(writeAttempts, 0);
  assert.ok(config.cacheMaxMemorySize > 0 && config.cacheMaxMemorySize <= 64 * 1024 * 1024);
});

test("the production Next config uses the deployment's verified release identity", () => {
  const release = "1234567890abcdef1234567890abcdef12345678";
  // Next memoizes the loaded config per directory/phase. A real build starts
  // with its release env already set, so test that boundary in a fresh process.
  const script = `
    const loadConfig = require("next/dist/server/config").default;
    const { PHASE_PRODUCTION_BUILD } = require("next/constants");
    loadConfig(PHASE_PRODUCTION_BUILD, process.cwd()).then(config => {
      console.log(JSON.stringify({ deploymentId: config.deploymentId }));
    });
  `;
  const result = execFileSync(process.execPath, ["-e", script], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NEXT_DEPLOYMENT_ID: release },
  });
  assert.equal(JSON.parse(result).deploymentId, release);
});

test("Caddy candidate generation preserves public restrictions and is idempotent", () => {
  const script = String.raw`
import importlib.util
from pathlib import Path
p=Path("ops/production/prepare-caddy-errors.py")
spec=importlib.util.spec_from_file_location("candidate",p)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
source='''{
 admin unix//run/caddy/admin.sock
}
beanmap.site {
 @private path /ko/admin /api/admin/*
 respond @private 404
 reverse_proxy 127.0.0.1:3100
 handle_errors 413 {
  respond "Payload Too Large" 413
 }
}
api.beanmap.site {
 respond 404
}
'''
result=m.prepare(source)
assert '@private path /ko/admin /api/admin/*' in result
assert 'respond @private 404' in result
assert 'handle_errors 413' in result
assert 'api.beanmap.site {\n respond 404\n}' in result
assert result.count('import beanmap_upstream_errors /opt/beanmap-errors') == 1
assert m.prepare(result) == result
assert result.index('import /etc/caddy/beanmap-upstream-errors.Caddyfile') < result.index('beanmap.site {')
assert result.startswith('{\n admin'), 'global options must remain first'
late = result.replace('import /etc/caddy/beanmap-upstream-errors.Caddyfile\n', '') + '\nimport /etc/caddy/beanmap-upstream-errors.Caddyfile\n'
repaired = m.prepare(late)
assert repaired.index('import /etc/caddy/beanmap-upstream-errors.Caddyfile') < repaired.index('beanmap.site {')
for bad in ['localhost { respond 200 }', source.replace('handle_errors 413','handle_errors 502')]:
 try: m.prepare(bad)
 except ValueError: pass
 else: raise AssertionError('ambiguous configuration must be rejected')
print('candidate checks passed')
`;
  assert.match(execFileSync("python3", ["-B", "-c", script], { cwd: root, encoding: "utf8" }), /checks passed/);
});

const caddyUrl = process.env.BEANMAP_CADDY_QA_URL;
test("upstream connection failure returns localized retry guidance while preserving application and private responses", { skip: !caddyUrl }, async () => {
  for (const [route, lang, title] of [["/ko/login?next=%2Fko%2Fbeans%2Fnew", "ko", "잠시 연결할 수 없어요"], ["/en/login", "en", "We can’t connect right now"]]) {
    const response = await fetch(`${caddyUrl}${route}`, { headers: { accept: "text/html" } });
    const body = await response.text();
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("retry-after"), "5");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.ok(body.includes(`lang="${lang}"`) && body.includes(title));
    assert.ok(body.includes('href=""'));
    assert.doesNotMatch(body, /<script|http-equiv=.refresh/i);
  }
  const action = await fetch(`${caddyUrl}/ko/beans/new`, { method: "POST", headers: { accept: "text/html" }, body: "fixture" });
  assert.equal(action.status, 503);
  assert.doesNotMatch(await action.text(), /<html/i);
  const appResponse = await fetch(`${caddyUrl}/upstream-503`, { headers: { accept: "text/html" } });
  assert.equal(appResponse.status, 503);
  assert.equal(await appResponse.text(), "original app session recovery");
  assert.equal((await fetch(`${caddyUrl}/ko/admin`, { headers: { accept: "text/html" } })).status, 404);
});
