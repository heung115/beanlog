import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";

const source = readFileSync(new URL("../src/lib/actions/auth.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});

function signOutWith(response) {
  const calls = [];
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require(name) {
      if (name === "zod") return { z };
      if (name === "@/lib/security/redirect") return {};
      if (name === "@/lib/supabase/server") return {
        createClient: async () => ({ auth: { signOut: async (options) => {
          calls.push(["signOut", options.scope]);
          return response;
        } } }),
        setSessionPersistencePreference: async (value) => calls.push(["persistence", value]),
      };
      if (name === "next/navigation") return {
        RedirectType: { replace: "replace" },
        redirect: (path, type) => { calls.push(["redirect", path, type]); },
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return { signOut: exports.signOut, calls };
}

for (const locale of ["ko", "en"]) {
  test(`${locale} successful sign-out replaces settings with the public home`, async () => {
    const { signOut, calls } = signOutWith({ error: null });
    await signOut(locale);
    assert.deepEqual(calls, [
      ["signOut", "local"],
      ["persistence", true],
      ["redirect", `/${locale}?loggedOut=1`, "replace"],
    ]);
  });
}

test("a remote sign-out failure preserves session preferences and does not navigate", async () => {
  const { signOut, calls } = signOutWith({ error: { status: 503, message: "unavailable" } });
  const result = await signOut("en");
  assert.equal(result?.error, "sign_out_failed");
  assert.deepEqual(calls, [["signOut", "local"]]);
});

test("untrusted sign-out locale cannot become a redirect destination", async () => {
  const { signOut, calls } = signOutWith({ error: null });
  await signOut("//example.com");
  assert.deepEqual(calls.at(-1), ["redirect", "/ko?loggedOut=1", "replace"]);
});
