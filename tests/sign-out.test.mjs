import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as authValidation from "../src/lib/validation/auth.ts";
import * as authRecovery from "../src/lib/supabase/auth-recovery.ts";
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
      if (name === "@/lib/security/sign-in-timing") return { createSignInFailureResponse: () => { throw new Error("Password sign-in timing must not run for another auth action"); } };
      if (name === "@/lib/security/oauth-consent") return { storeOAuthPreconsent: async () => { throw new Error("OAuth preconsent must not run during sign-out"); } };
      if (name === "next/headers") return { headers: async () => { throw new Error("Unexpected signup headers during sign-out"); } };
      if (name === "@/lib/security/signup-consent") return { controlledSignup: async () => { throw new Error("Unexpected signup during sign-out"); } };
      if (name === "@/lib/security/password-policy") return { newPasswordIssue: async () => { throw new Error("New-password policy must not run during sign-out"); } };
      if (name === "@/lib/security/password-recovery") return {};
      if (name === "@/lib/validation/auth") return authValidation;
      if (name === "@/lib/supabase/auth-recovery") return authRecovery;
      if (name === "zod") return { z };
      if (name === "@/lib/security/redirect") return {};
      if (name === "@/lib/admin/private-access") return {};
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
