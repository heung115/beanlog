import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { resolvePostAuthPath } from "../src/lib/security/redirect.ts";

const source = readFileSync(new URL("../src/lib/actions/auth.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});

function signInWith(response, { throws = false, clientThrows = false } = {}) {
  const calls = [];
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require(name) {
      if (name === "zod") return { z };
      if (name === "@/lib/security/redirect") return { resolvePostAuthPath };
      if (name === "@/lib/supabase/server") return {
        createClient: async ({ persistSession }) => {
          calls.push(["client", persistSession]);
          if (clientThrows) throw response;
          return { auth: { signInWithPassword: async ({ email, password }) => {
            calls.push(["signIn", email, password]);
            if (throws) throw response;
            return response;
          } } };
        },
        setSessionPersistencePreference: async (value) => calls.push(["persistence", value]),
      };
      if (name === "next/navigation") return {
        redirect: (path) => { calls.push(["redirect", path]); throw new Error("NEXT_REDIRECT"); },
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return { signIn: exports.signInAction, calls };
}

function loginForm() {
  const form = new FormData();
  form.set("email", "retry@local.test");
  form.set("password", "unchanged-password");
  form.set("next", "/en/beans/new?draft=1");
  return form;
}

const failures = [
  ["invalid credentials", new AuthApiError("Invalid login credentials", 400, "invalid_credentials"), "invalid_credentials"],
  ["unconfirmed email", new AuthApiError("Email not confirmed", 400, "email_not_confirmed"), "email_not_confirmed"],
  ["rate-limit code", new AuthApiError("Too many requests", 429, "over_request_rate_limit"), "rate_limited"],
  ["rate-limit status without a code", new AuthApiError("Too many requests", 429), "rate_limited"],
  ["network failure", new AuthRetryableFetchError("fetch failed", 0), "temporarily_unavailable"],
  ["request timeout", new AuthApiError("Timed out", 408, "request_timeout"), "temporarily_unavailable"],
  ["unknown auth failure", new AuthApiError("An unexpected error occurred", 400), "temporarily_unavailable"],
  ...[500, 502, 503, 504, 530].map((status) => [
    `auth HTTP ${status}`, new AuthRetryableFetchError("Temporarily unavailable", status), "temporarily_unavailable",
  ]),
];

for (const [description, error, expected] of failures) {
  test(`${description} returns its own login guidance without discarding retry data`, async () => {
    const { signIn, calls } = signInWith({ error });
    const form = loginForm();
    const before = [...form.entries()];
    assert.equal((await signIn({}, form)).error, expected);
    assert.deepEqual([...form.entries()], before);
    assert.deepEqual(calls, [["client", false], ["signIn", "retry@local.test", "unchanged-password"]]);
  });
}

for (const options of [{ throws: true }, { clientThrows: true }]) {
  test(`a thrown connection error ${options.clientThrows ? "creating the client" : "during sign-in"} remains retryable`, async () => {
    const { signIn, calls } = signInWith(new TypeError("fetch failed"), options);
    assert.equal((await signIn({}, loginForm())).error, "temporarily_unavailable");
    assert.equal(calls.some(([name]) => ["redirect", "persistence"].includes(name)), false);
  });
}

test("successful retry honors the unchanged destination and session preference", async () => {
  const { signIn, calls } = signInWith({ error: null });
  await assert.rejects(signIn({ error: "temporarily_unavailable" }, loginForm()), /NEXT_REDIRECT/);
  assert.deepEqual(calls.slice(-2), [["persistence", false], ["redirect", "/en/beans/new?draft=1"]]);
});

test("invalid form fields never contact authentication", async () => {
  const { signIn, calls } = signInWith({ error: null });
  const form = loginForm();
  form.set("email", "invalid-email");
  assert.equal((await signIn({}, form)).error, "invalid_credentials");
  assert.deepEqual(calls, []);
});
