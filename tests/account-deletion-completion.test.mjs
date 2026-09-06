import * as authClientIp from "../src/lib/security/auth-client-ip.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";

const compile = (relative) => ts.transpileModule(readFileSync(new URL(relative, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const actionsCode = compile("../src/lib/actions/beans.ts");

function deletionWith({ rpcError = null, logoutThrows = false } = {}) {
  const calls = [];
  const exports = {};
  vm.runInNewContext(actionsCode, {
    exports,
    require(name) {
      if (name === "../security/auth-client-ip") return authClientIp;
      if (name === "zod") return { z };
      if (name === "@/lib/supabase/server") return {
        createClient: async () => ({
          rpc: async () => ({ error: rpcError }),
          auth: {
            getUser: async () => ({ data: { user: { id: "test-user" } } }),
            signOut: async () => { if (logoutThrows) throw new TypeError("fetch failed"); return { error: { status: 503 } }; },
          },
        }),
        clearSessionCookies: async () => calls.push("clearSessionCookies"),
      };
      if (name === "next/navigation") return {
        RedirectType: { replace: "replace" },
        redirect: (path, type) => calls.push(["redirect", path, type]),
      };
      if (["next/cache", "next/headers", "@/i18n/routing", "@/lib/validation/beans", "@/lib/api/client"].includes(name)) return {};
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return { deleteAccount: exports.deleteAccount, calls };
}

for (const locale of ["ko", "en"]) {
  for (const logoutThrows of [false, true]) {
    test(`${locale} confirmed account deletion clears credentials and completes even if logout ${logoutThrows ? "throws" : "returns 503"}`, async () => {
      const { deleteAccount, calls } = deletionWith({ logoutThrows });
      await deleteAccount(locale);
      assert.deepEqual(calls, ["clearSessionCookies", ["redirect", `/${locale}?accountDeleted=1`, "replace"]]);
    });
  }
}

test("failed account deletion never clears the session or announces success", async () => {
  const { deleteAccount, calls } = deletionWith({ rpcError: { status: 503 } });
  assert.equal((await deleteAccount("en")).error, "Unable to delete account");
  assert.deepEqual(calls, []);
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
