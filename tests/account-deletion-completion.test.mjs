import * as authClientIp from "../src/lib/security/auth-client-ip.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const compile = (relative) => ts.transpileModule(readFileSync(new URL(relative, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const actionsCode = compile("../src/lib/actions/account.ts");
class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }

function deletionWith({ apiError, challenge = "a".repeat(64), response = { success: true } } = {}) {
  const calls = [];
  const exports = {};
  const jar = new Map(challenge ? [["beanmap-account-deletion", challenge]] : []);
  vm.runInNewContext(actionsCode, {
    exports, process: { env: { NODE_ENV: "production" } },
    require(name) {
      if (name === "@/lib/supabase/session-persistence") return { shouldUseSecureCookies: () => true };
      if (name === "next/headers") return { cookies: async () => ({ get: (key) => jar.has(key) ? {value:jar.get(key)} : undefined, delete: (key) => {jar.delete(key); calls.push(["deleteCookie",key]);}, set: (key,value,options) => {jar.set(key,value);calls.push(["setCookie",key,value,options]);} }) };
      if (name === "@/lib/api/client") return { ApiError, apiFetch: async (path, init) => { calls.push(["api",path,JSON.parse(JSON.stringify(init))]); if(apiError) throw apiError; return response; } };
      if (name === "@/lib/supabase/server") return { clearSessionCookies: async () => calls.push("clearSessionCookies") };
      if (name === "next/navigation") return { RedirectType: {replace:"replace"}, redirect: (path,type) => {calls.push(["redirect",path,type]);} };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return { ...exports, calls, jar };
}

for (const locale of ["ko", "en"]) {
  test(`${locale} verified account deletion clears cookies only after API success`, async () => {
    const {deleteAccount,calls,jar} = deletionWith();
    await deleteAccount(locale,"123456");
    assert.deepEqual(calls, [["api","/api/account/delete",{method:"POST",body:{challenge:"a".repeat(64),code:"123456"}}],["deleteCookie","beanmap-account-deletion"],"clearSessionCookies",["redirect",`/${locale}?accountDeleted=1`,"replace"]]);
    assert.equal(jar.size,0);
  });
}

test("ordinary action calls and missing challenges never reach the deletion API", async () => {
  for (const [challenge,code,expected] of [["a".repeat(64),"","invalid_code"],[undefined,"bad","invalid_code"],[null,"123456","challenge_expired"],["bad","123456","challenge_expired"]]) {
    const {deleteAccount,calls} = deletionWith({challenge});
    assert.equal((await deleteAccount("ko",code)).error, expected);
    assert.deepEqual(calls,[]);
  }
});

test("API refusals preserve session and never announce deletion", async () => {
  for (const [status,error] of [[400,"invalid_code"],[403,"challenge_expired"],[401,"session_expired"],[429,"rate_limited"],[503,"temporarily_unavailable"]]) {
    const {deleteAccount,calls,jar} = deletionWith({apiError:new ApiError(status,error)});
    assert.equal((await deleteAccount("en","123456")).error,error);
    assert.equal(calls.length,1);
    assert.equal(jar.size,1);
  }
});

test("challenge request uses no supplied identity and stores only an HttpOnly bounded cookie", async () => {
  const {requestAccountDeletionCode,calls} = deletionWith({response:{challenge:"b".repeat(64),expires_in:300}});
  assert.equal((await requestAccountDeletionCode()).sent,true);
  assert.deepEqual(calls[0],["api","/api/account/deletion-challenge",{method:"POST",body:{}}]);
  assert.equal(calls[1][3].httpOnly,true);
  assert.equal(calls[1][3].sameSite,"strict");
  assert.equal(calls[1][3].secure,true);
  assert.equal(calls[1][3].maxAge,300);
});

test("failed or malformed challenge responses never issue a browser challenge", async () => {
  for (const response of [{challenge:"bad",expires_in:300},{challenge:"b".repeat(64),expires_in:3600}]) {
    const {requestAccountDeletionCode,calls} = deletionWith({response});
    assert.equal((await requestAccountDeletionCode()).error,"temporarily_unavailable");
    assert.equal(calls.length,1);
  }
});

test("confirmed-deletion cleanup removes only the auth-cookie family and session preference", async () => {
  const cookies = new Map([
    ["auth-cookie", "base"], ["auth-cookie.0", "chunk0"], ["auth-cookie.1", "chunk1"],
    ["beanmap-session-only", "1"], ["NEXT_LOCALE", "en"], ["unrelated", "keep"],
  ]);
  const exports = {};
  vm.runInNewContext(compile("../src/lib/supabase/server.ts"), {
    exports,
    require(name) {
      if (name === "../security/auth-client-ip") return authClientIp;
      if (name === "next/headers") return { cookies: async () => ({ getAll: () => [...cookies].map(([name, value]) => ({ name, value })), delete: (name) => cookies.delete(name) }) };
      if (name === "./config") return { supabaseCookieOptions: { name: "auth-cookie" } };
      if (name === "./session-persistence") return { SESSION_ONLY_COOKIE_NAME: "beanmap-session-only" };
      if (name === "@supabase/ssr") return {};
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  await exports.clearSessionCookies();
  assert.deepEqual([...cookies], [["NEXT_LOCALE", "en"], ["unrelated", "keep"]]);
});
