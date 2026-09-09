import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as proofStore from "../src/lib/security/recovery-proof-store.ts";
import * as redirects from "../src/lib/security/redirect.ts";
import * as persistence from "../src/lib/supabase/session-persistence.ts";

function load(path, dependencies) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, URL, URLSearchParams, process,
    require(name) { assert.ok(name in dependencies, name); return dependencies[name]; },
  });
  return exports;
}

async function fixture(t, method = "recovery", verified = true, consentComplete = true) {
  const directory = await mkdtemp(join(tmpdir(), "beanmap-callback-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const jar = new Map();
  const cookieAdapter = { cookies: async () => ({ get: (name) => jar.get(name), set: (name, value, options) => jar.set(name, { value, options }), delete: (name) => jar.delete(name) }) };
  const helpers = load("../src/lib/security/password-recovery.ts", {
    "next/headers": cookieAdapter,
    "../supabase/session-persistence": persistence,
    "./recovery-proof-store": { ...proofStore, RecoveryProofStore: class extends proofStore.RecoveryProofStore { constructor() { super(directory); } } },
  });
  const payload = { sub: "user-a", session_id: "session-a", exp: Math.floor(Date.now() / 1000) + 3600, amr: [{ method, timestamp: Math.floor(Date.now() / 1000) }] };
  const accessToken = `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
  const session = { access_token: accessToken };
  const exchanges = [];
  const auth = {
    getSession: async () => ({ data: { session }, error: null }),
    getUser: async (token) => { assert.equal(token, accessToken); return { data: { user: verified ? { id: "user-a" } : null }, error: verified ? null : { status: 401 } }; },
    exchangeCodeForSession: async (code) => { exchanges.push(["code", code]); return { data: { session, redirectType: "recovery" }, error: null }; },
    verifyOtp: async (options) => { exchanges.push(["otp", options]); return { data: { session }, error: null }; },
  };
  const supabase = { auth };
  const oauthCalls = [];
  const callback = load("../src/app/api/auth/callback/route.ts", {
    "@/lib/security/oauth-consent": {
      takeOAuthPreconsent: async () => { oauthCalls.push("take"); return null; },
      completeOAuthCallbackConsent: async (client, token, proof) => {
        assert.equal(client, supabase);
        assert.equal(token, accessToken);
        assert.equal(proof, null);
        oauthCalls.push("complete");
        return consentComplete;
      },
    },
    "@/lib/security/password-recovery": helpers,
    "@/lib/supabase/server": { createClient: async () => supabase, setSessionPersistencePreference: async () => {} },
    "@/lib/security/redirect": redirects,
    "next/server": { NextResponse: { redirect: (url) => new Response(null, { status: 307, headers: { location: String(url) } }) } },
    "next/headers": cookieAdapter,
    "@/lib/admin/private-access": { getRequestAppOrigin: async () => "https://beanmap.example" },
  });
  return { callback, helpers, jar, exchanges, supabase, oauthCalls };
}

for (const query of ["code=code-fixture&mode=recovery", "token_hash=hash-fixture&type=recovery"]) {
  test(`${query.split("=")[0]} recovery callback issues a bound, one-use HttpOnly proof`, async (t) => {
    const { callback, helpers, jar, supabase, oauthCalls } = await fixture(t, query.startsWith("token_hash") ? "otp" : "recovery");
    const response = await callback.GET(new Request(`https://beanmap.example/api/auth/callback?${query}&locale=en&next=%2Fen%2Fstats`));
    assert.equal(new URL(response.headers.get("location")).pathname, "/en/reset-password");
    assert.deepEqual(oauthCalls, []);
    const proof = jar.get("beanmap-recovery-proof");
    assert.ok(proof);
    assert.equal(proof.options.httpOnly, true);
    assert.equal(proof.options.maxAge, 600);
    assert.equal(await helpers.checkPasswordRecoveryProof(supabase, "user-a"), true);
    assert.equal(await helpers.checkPasswordRecoveryProof(supabase, "user-a", true), true);
    assert.equal(jar.get("beanmap-recovery-proof"), proof); // Inert cookie does not trigger Next page re-render.
    jar.set("beanmap-recovery-proof", proof); // Replaying the original cookie still fails.
    assert.equal(await helpers.checkPasswordRecoveryProof(supabase, "user-a", true), false);
  });
}

for (const [method, verified] of [["password", true], ["oauth", true], ["recovery", false]]) {
  test(`mode and SDK redirectType cannot upgrade ${method}/${verified} into recovery`, async (t) => {
    const { callback, jar, oauthCalls } = await fixture(t, method, verified);
    const response = await callback.GET(new Request("https://beanmap.example/api/auth/callback?code=code-fixture&mode=recovery&locale=ko"));
    assert.equal(new URL(response.headers.get("location")).pathname, "/ko/forgot-password");
    assert.deepEqual(oauthCalls, []);
    assert.equal(jar.has("beanmap-recovery-proof"), false);
  });
}

test("a normal OAuth callback keeps its destination without issuing a reset proof", async (t) => {
  const { callback, jar, oauthCalls } = await fixture(t, "oauth");
  const response = await callback.GET(new Request("https://beanmap.example/api/auth/callback?code=code-fixture&next=%2Fko%2Fstats"));
  assert.equal(new URL(response.headers.get("location")).pathname, "/ko/stats");
  assert.deepEqual(oauthCalls, ["take", "complete"]);
  assert.equal(jar.has("beanmap-recovery-proof"), false);
});


test("a pending OAuth account without completed consent is routed to consent on the safe origin", async (t) => {
  const { callback, jar, oauthCalls } = await fixture(t, "oauth", true, false);
  const response = await callback.GET(new Request("https://beanmap.example/api/auth/callback?code=code-fixture&locale=en&next=%2Fen%2Fstats"));
  const destination = new URL(response.headers.get("location"));
  assert.equal(destination.origin, "https://beanmap.example");
  assert.equal(destination.pathname, "/en/consent");
  assert.equal(destination.searchParams.get("next"), "/en/stats");
  assert.deepEqual(oauthCalls, ["take", "complete"]);
  assert.equal(jar.has("beanmap-recovery-proof"), false);
});
