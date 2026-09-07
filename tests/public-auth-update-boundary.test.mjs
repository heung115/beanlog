import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import http from "node:http";
import test from "node:test";

// Send the actual unnormalized request target, unlike fetch/URL path cleanup.
function request(base, path, method) {
  const address = new URL(base);
  const payload = method === "GET" ? "" : '{"password":"fixture-new-password"}';
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: address.hostname, port: address.port, path, method,
      headers: { authorization: "Bearer arbitrary-stolen-session-fixture", "content-type": "application/json", "content-length": Buffer.byteLength(payload) } }, (response) => {
      let body = "";
      response.on("data", chunk => { body += chunk; });
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body }));
    });
    req.on("error", reject);
    req.end(payload);
  });
}

const publicUrl = process.env.BEANMAP_CADDY_AUTH_QA_URL;
const internalUrl = process.env.BEANMAP_CADDY_INTERNAL_QA_URL;
test("public Auth updates cannot bypass recovery through normalized gateway paths", { skip: !publicUrl }, async () => {
  for (const method of ["PUT", "PATCH"]) {
    for (const path of ["/auth/v1/user", "/auth/v1/user?redirect_to=%2F", "/auth/v1//user", "//auth/v1/user",
      "/auth%2fv1/user", "/%61uth/v1/user", "/auth/v1/%75ser", "/auth/v1/./user",
      "/rest/v1/../../auth/v1/user", "/rest/v1/%2e%2e/%2e%2e/auth/v1/user",
      "/rest/v1/profiles%2f..%2f..%2f..%2fauth/v1/user", "/rest/v1/profiles%252f..%252fauth/v1/user",
      "/rest/v1/profiles/../user", "/REST/v1/profiles", "/storage/v1/object/account"]) {
      const response = await request(publicUrl, path, method);
      assert.ok([400, 404, 405].includes(response.status), `${method} ${path}: ${response.status}`);
      assert.equal(response.headers["x-fixture-upstream"], undefined, `${method} ${path} reached gateway`);
      if (path === "/auth/v1/user") assert.equal(response.status, 405);
    }
  }
});
test("OAuth and recovery requests plus canonical REST updates keep working", { skip: !publicUrl }, async () => {
  for (const [method, path] of [["POST", "/auth/v1/token?grant_type=password"], ["POST", "/auth/v1/recover"],
    ["GET", "/auth/v1/authorize?provider=google"], ["GET", "/auth/v1/callback?code=fixture"],
    ["GET", "/auth/v1/user"], ["POST", "/auth/v1/logout"], ["OPTIONS", "/auth/v1/user"],
    ["PATCH", "/rest/v1/profiles?id=eq.fixture"], ["PUT", "/rest/v1/profiles?id=eq.fixture"]]) {
    const response = await request(publicUrl, path, method);
    assert.equal(response.status, 200, `${method} ${path}: ${JSON.stringify(response)}`);
    assert.equal(response.headers["x-fixture-upstream"], "reached");
  }
});
test("trusted internal Auth path still permits the proof-validated server action", { skip: !internalUrl }, async () => {
  const response = await request(internalUrl, "/auth/v1/user", "PUT");
  assert.equal(response.status, 200);
  assert.equal(response.headers["x-fixture-upstream"], "reached");
});
test("public Auth candidate preserves provenance and is repeatable", () => {
  const script = String.raw`
import importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('candidate','ops/production/prepare-auth-update-caddy.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
source=Path('ops/caddy/Caddyfile').read_text()
assert m.prepare(source) == source
original=source.replace('import /etc/caddy/beanmap-public-auth-updates.Caddyfile\n\n','').replace('\t\timport beanmap_public_auth_updates\n','')
original=original.replace('reverse_proxy 127.0.0.1:8000','reverse_proxy 127.0.0.1:8000 {\n header_up -X-Beanmap-Client-Proof\n}')
result=m.prepare(original)
assert 'header_up -X-Beanmap-Client-Proof' in result
assert m.prepare(result) == result
assert result.count('import beanmap_public_auth_updates') == 1
for bad in [original.replace('handle @application_api {','handle {'), original + '\nreverse_proxy 127.0.0.1:8000\n', original.replace('handle @application_api {', 'handle @application_api {\n rewrite * /auth/v1/user')]:
 try: m.prepare(bad)
 except ValueError: pass
 else: raise AssertionError('ambiguous routing accepted')
`;
  execFileSync("python3", ["-B", "-c", script], { cwd: new URL("..", import.meta.url), encoding: "utf8" });
});
