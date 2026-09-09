import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
import * as redirectHelpers from "../src/lib/security/redirect.ts";
import * as validation from "../src/lib/validation/auth.ts";
import * as passwordPolicy from "../src/lib/security/password-policy.ts";
import * as signInTiming from "../src/lib/security/sign-in-timing.ts";
import * as authRecovery from "../src/lib/supabase/auth-recovery.ts";

const source = readFileSync(new URL("../src/lib/actions/auth.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const plain = (value) => JSON.parse(JSON.stringify(value));

function form(values = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    locale: "ko", email: "recovery-fixture@local.test", displayName: "Audit user",
    password: "fixture-new-password", passwordConfirm: "fixture-new-password", acceptedTerms: "on", ...values,
  })) data.set(key, value);
  return data;
}

function authModule(overrides = {}, recoveryProof = true) {
  const calls = [];
  const auth = {
    signInWithPassword: async (...args) => { calls.push(["signInWithPassword", ...args]); return { error: null }; },
    resetPasswordForEmail: async (...args) => { calls.push(["requestReset", ...args]); return { error: null }; },
    getUser: async () => { calls.push(["getUser"]); return { data: { user: { id: "fixture-user" } }, error: null }; },
    updateUser: async (...args) => { calls.push(["updateUser", ...args]); return { error: null }; },
    signOut: async (...args) => { calls.push(["signOut", ...args]); return { error: null }; },
    ...overrides,
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, URL, URLSearchParams, FormData,
    require(name) {
      if (name === "@/lib/security/sign-in-timing") return signInTiming;
      if (name === "@/lib/security/oauth-consent") return { storeOAuthPreconsent: async () => { throw new Error("OAuth preconsent must not run during password reset or email signup"); } };
      if (name === "next/headers") return { headers: async () => new Headers() };
      if (name === "@/lib/security/signup-consent") return { controlledSignup: async () => { throw new Error("Unexpected signup during reset"); } };
      if (name === "@/lib/security/password-policy") return passwordPolicy;
      if (name === "@/lib/security/password-recovery") return {
        checkPasswordRecoveryProof: async (_client, userId, consume) => {
          calls.push(["recoveryProof", userId, consume]);
          return recoveryProof;
        },
      };
      if (name === "zod") return { z };
      if (name === "@/lib/validation/auth") return validation;
      if (name === "@/lib/supabase/auth-recovery") return authRecovery;
      if (name === "@/lib/security/redirect") return redirectHelpers;
      if (name === "@/lib/admin/private-access") return { getRequestAppOrigin: async () => "http://localhost:3100" };
      if (name === "@/lib/supabase/server") return {
        createClient: async (options) => { calls.push(["createClient", options]); return { auth }; },
        clearSessionCookies: async () => { calls.push(["clearSessionCookies"]); },
        setSessionPersistencePreference: async () => {},
      };
      if (name === "next/navigation") return {
        RedirectType: { replace: "replace" },
        redirect(destination) { throw Object.assign(new Error("Test redirect"), { destination }); },
      };
      throw new Error(`Unexpected auth-action dependency: ${name}`);
    },
  });
  return { actions: exports, calls };
}

test("reset requests reject invalid emails before contacting Auth", async () => {
  const { actions, calls } = authModule();
  assert.deepEqual(plain(await actions.requestPasswordResetAction({}, form({ email: "invalid-address" }))), { error: "invalid_email", field: "email" });
  assert.deepEqual(calls, []);
});

test("reset requests do not reveal account existence or per-address rate limits", async () => {
  const outcomes = [];
  for (const error of [null, { status: 400, code: "user_not_found" }, { status: 422, code: "email_not_confirmed" }, { status: 429, code: "over_email_send_rate_limit" }]) {
    const { actions } = authModule({ resetPasswordForEmail: async () => ({ error }) });
    outcomes.push(plain(await actions.requestPasswordResetAction({}, form())));
  }
  for (const outcome of outcomes) assert.deepEqual(outcome, { sent: true });
});

test("a reset service outage remains distinguishable from successful delivery guidance", async () => {
  for (const failure of [{ status: 503 }, { name: "AuthRetryableFetchError" }, new TypeError("offline")]) {
    const { actions } = authModule({ resetPasswordForEmail: async () => {
      if (failure instanceof TypeError) throw failure;
      return { error: failure };
    } });
    assert.deepEqual(plain(await actions.requestPasswordResetAction({}, form())), { error: "temporarily_unavailable" });
  }
});

for (const locale of ["ko", "en"]) {
  test(`${locale} reset callbacks normalize email and preserve only trusted destinations`, async () => {
    for (const destination of [`/${locale}/stats`, `/${locale}/beans/new?draft=1`, "https://example.com/untrusted"]) {
      const { actions, calls } = authModule();
      await actions.requestPasswordResetAction({}, form({ locale, email: " recovery-fixture@local.test ", next: destination }));
      const [, email, options] = calls.find(([name]) => name === "requestReset");
      assert.equal(email, "recovery-fixture@local.test");
      const callback = new URL(options.redirectTo);
      assert.equal(callback.origin, "http://localhost:3100");
      assert.equal(callback.pathname, "/api/auth/callback");
      assert.equal(callback.searchParams.get("mode"), "recovery");
      assert.equal(callback.searchParams.get("locale"), locale);
      assert.equal(callback.searchParams.get("next"), destination.startsWith("/") ? destination : null);
      assert.deepEqual(plain(calls.find(([name]) => name === "createClient")[1]), { persistSession: false });
    }
    const { actions, calls } = authModule();
    await actions.requestPasswordResetAction({}, form({ locale, draft: "1" }));
    const callback = new URL(calls.find(([name]) => name === "requestReset")[2].redirectTo);
    assert.equal(callback.searchParams.get("next"), `/${locale}/beans/new?draft=1`);
  });

  test(`${locale} password update clears the local session before directing the user to login`, async () => {
    const { actions, calls } = authModule();
    await assert.rejects(actions.updatePasswordAction({}, form({ locale, draft: "1" })), (error) => {
      const destination = new URL(error.destination, "http://localhost:3100");
      assert.equal(destination.pathname, `/${locale}/login`);
      assert.equal(destination.searchParams.get("passwordReset"), "1");
      assert.equal(destination.searchParams.get("next"), `/${locale}/beans/new?draft=1`);
      return true;
    });
    assert.deepEqual(calls.map(([name]) => name), ["createClient", "getUser", "recoveryProof", "updateUser", "signOut", "clearSessionCookies"]);
    assert.deepEqual(plain(calls.find(([name]) => name === "updateUser")[1]), { password: "fixture-new-password" });
    assert.deepEqual(plain(calls.find(([name]) => name === "signOut")[1]), { scope: "local" });
  });
}

test("short, compromised, overlong, and mismatched reset passwords cannot reach identity or update calls", async () => {
  for (const [values, expected] of [
    [{ password: "passwordpassword", passwordConfirm: "passwordpassword" }, { error: "password_compromised", field: "password" }],
    [{ password: "123456", passwordConfirm: "123456" }, { error: "password_length", field: "password" }],
    [{ password: "12345", passwordConfirm: "12345" }, { error: "password_length", field: "password" }],
    [{ password: "x".repeat(129), passwordConfirm: "x".repeat(129) }, { error: "password_length", field: "password" }],
    [{ passwordConfirm: "different-password" }, { error: "password_mismatch", field: "passwordConfirm" }],
  ]) {
    const { actions, calls } = authModule();
    assert.deepEqual(plain(await actions.updatePasswordAction({}, form(values))), expected);
    assert.deepEqual(calls, []);
  }
});

test("unverified or unavailable identities never authorize a password update", async () => {
  for (const [identity, expected] of [
    [{ data: { user: null }, error: null }, "expired"],
    [{ data: { user: null }, error: { status: 401 } }, "expired"],
    [{ data: { user: null }, error: { status: 503 } }, "temporarily_unavailable"],
    [{ data: { user: null }, error: { status: 429 } }, "temporarily_unavailable"],
    [{ data: { user: null }, error: { status: 0, name: "AuthRetryableFetchError" } }, "temporarily_unavailable"],
  ]) {
    const { actions, calls } = authModule({ getUser: async () => identity });
    assert.equal((await actions.updatePasswordAction({}, form())).error, expected);
    assert.equal(calls.some(([name]) => ["updateUser", "signOut", "clearSessionCookies"].includes(name)), false);
  }
});

test("a sign-out transport failure after a completed update still clears cookies and shows success", async () => {
  const { actions, calls } = authModule({ signOut: async () => { throw new TypeError("offline during sign-out"); } });
  await assert.rejects(actions.updatePasswordAction({}, form({ next: "/ko/stats" })), (error) => {
    const destination = new URL(error.destination, "http://localhost:3100");
    assert.equal(destination.pathname, "/ko/login");
    assert.equal(destination.searchParams.get("passwordReset"), "1");
    assert.equal(destination.searchParams.get("next"), "/ko/stats");
    return true;
  });
  assert.equal(calls.some(([name]) => name === "updateUser"), true);
  assert.equal(calls.some(([name]) => name === "clearSessionCookies"), true);
});

test("a rejected password update preserves the current session and identifies same-password errors", async () => {
  const { actions, calls } = authModule({ updateUser: async () => ({ error: { code: "same_password" } }) });
  assert.deepEqual(plain(await actions.updatePasswordAction({}, form())), { error: "same_password", field: "password", requiresNewLink: true });
  assert.equal(calls.some(([name]) => ["signOut", "clearSessionCookies"].includes(name)), false);
});

test("signup's server action returns field errors for whitespace names and mismatched confirmation", async () => {
  for (const [values, expected] of [
    [{ displayName: "   " }, { error: "display_name_required", field: "displayName" }],
    [{ passwordConfirm: "different-password" }, { error: "password_mismatch", field: "passwordConfirm" }],
    [{ acceptedTerms: "" }, { error: "agreement_required", field: "acceptedTerms" }],
  ]) {
    const { actions, calls } = authModule();
    assert.deepEqual(plain(await actions.signUpAction({}, form(values))), expected);
    assert.deepEqual(calls, []);
  }
});


test("an ordinary valid session without recovery proof cannot change a password", async () => {
  const { actions, calls } = authModule({}, false);
  assert.deepEqual(plain(await actions.updatePasswordAction({}, form())), { error: "expired" });
  assert.equal(calls.some(([name]) => name === "updateUser"), false);
  assert.deepEqual(calls.find(([name]) => name === "recoveryProof"), ["recoveryProof", "fixture-user", true]);
});


test("direct signup cannot bypass the shared policy before the controlled boundary", async () => {
  for (const password of ["123456", "passwordpassword", "a".repeat(73)]) {
    const { actions, calls } = authModule();
    const result = await actions.signUp("policy-fixture@local.test", password, "Fixture", true);
    assert.ok(result.error);
    assert.deepEqual(calls, []);
  }
});

test("legacy short-password login remains available without the new-credential policy", async () => {
  const { actions, calls } = authModule();
  await assert.rejects(actions.signInAction({}, form({ password: "123456" })), (error) => error.destination === "/explore");
  assert.equal(calls.filter(([name]) => name === "signInWithPassword").length, 1);
});
