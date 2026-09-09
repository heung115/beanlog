import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { resolvePostAuthPath } from "../../src/lib/security/redirect.ts";
import * as authValidation from "../../src/lib/validation/auth.ts";
import * as authRecovery from "../../src/lib/supabase/auth-recovery.ts";
import * as signInTiming from "../../src/lib/security/sign-in-timing.ts";

const source = readFileSync(new URL("../../src/lib/actions/auth.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});

// Execute the actual action with only its framework/client boundary replaced.
export function loadSignInAction({ createClient, setSessionPersistencePreference = async () => {}, redirect = () => { throw new Error("NEXT_REDIRECT"); }, timing = signInTiming }) {
  const exports = {};
  const unused = () => { throw new Error("Unexpected non-login operation"); };
  const dependencies = {
    "@/lib/security/sign-in-timing": timing,
    "@/lib/security/oauth-consent": { storeOAuthPreconsent: unused },
    "next/headers": { headers: unused },
    "@/lib/security/signup-consent": { controlledSignup: unused },
    "@/lib/security/password-policy": { newPasswordIssue: unused },
    "@/lib/security/password-recovery": {},
    zod: { z },
    "@/lib/validation/auth": authValidation,
    "@/lib/supabase/auth-recovery": authRecovery,
    "@/lib/security/redirect": { resolvePostAuthPath },
    "@/lib/admin/private-access": {},
    "@/lib/supabase/server": { createClient, setSessionPersistencePreference },
    "next/navigation": { redirect },
  };
  vm.runInNewContext(outputText, { exports, require(name) {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  return exports.signInAction;
}
