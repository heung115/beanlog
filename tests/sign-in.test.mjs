import { loadSignInAction } from "./fixtures/sign-in-action.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { createSignInFailureResponse, SIGN_IN_FAILURE_FLOOR_MS } from "../src/lib/security/sign-in-timing.ts";

function signInWith(response, { throws = false, clientThrows = false, clientDuration = 0, backendDuration = 0 } = {}) {
  const calls = [];
  let elapsed = 0;
  const timing = { now: () => elapsed, jitter: () => 0, sleep: async (milliseconds) => { elapsed += milliseconds; } };
  const signIn = loadSignInAction({
    timing: { createSignInFailureResponse: () => createSignInFailureResponse(timing) },
    createClient: async ({ persistSession }) => {
      calls.push(["client", persistSession]);
      elapsed += clientDuration;
      if (clientThrows) throw response;
      return { auth: { signInWithPassword: async ({ email, password }) => {
        calls.push(["signIn", email, password]);
        elapsed += backendDuration;
        if (throws) throw response;
        return response;
      } } };
    },
    setSessionPersistencePreference: async (value) => calls.push(["persistence", value]),
    redirect: (path) => { calls.push(["redirect", path]); throw new Error("NEXT_REDIRECT"); },
  });
  return { signIn, calls, elapsed: () => elapsed };
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
    const { signIn, calls, elapsed } = signInWith({ error });
    const form = loginForm();
    const before = [...form.entries()];
    assert.equal((await signIn({}, form)).error, expected);
    assert.equal(elapsed(), SIGN_IN_FAILURE_FLOOR_MS);
    assert.deepEqual([...form.entries()], before);
    assert.deepEqual(calls, [["client", false], ["signIn", "retry@local.test", "unchanged-password"]]);
  });
}

for (const options of [{ throws: true }, { clientThrows: true }]) {
  test(`a thrown connection error ${options.clientThrows ? "creating the client" : "during sign-in"} remains retryable`, async () => {
    const { signIn, calls, elapsed } = signInWith(new TypeError("fetch failed"), options);
    assert.equal((await signIn({}, loginForm())).error, "temporarily_unavailable");
    assert.equal(elapsed(), SIGN_IN_FAILURE_FLOOR_MS);
    assert.equal(calls.some(([name]) => ["redirect", "persistence"].includes(name)), false);
  });
}

test("successful retry honors the unchanged destination and session preference", async () => {
  const { signIn, calls, elapsed } = signInWith({ error: null });
  await assert.rejects(signIn({ error: "temporarily_unavailable" }, loginForm()), /NEXT_REDIRECT/);
  assert.equal(elapsed(), 0);
  assert.deepEqual(calls.slice(-2), [["persistence", false], ["redirect", "/en/beans/new?draft=1"]]);
});

test("invalid form fields never contact authentication", async () => {
  const { signIn, calls, elapsed } = signInWith({ error: null });
  const form = loginForm();
  form.set("email", "invalid-email");
  assert.equal((await signIn({}, form)).error, "invalid_credentials");
  assert.equal(elapsed(), SIGN_IN_FAILURE_FLOOR_MS);
  assert.deepEqual(calls, []);
});

test("a legacy six-character password still reaches sign-in and preserves its destination", async () => {
  const { signIn, calls, elapsed } = signInWith({ error: null });
  const form = loginForm();
  form.set("password", "123456");
  await assert.rejects(signIn({}, form), /NEXT_REDIRECT/);
  assert.equal(calls.filter(([name]) => name === "signIn").length, 1);
  assert.equal(calls.find(([name]) => name === "signIn")[2].length, 6);
  assert.equal(elapsed(), 0);
  assert.deepEqual(calls.slice(-2), [["persistence", false], ["redirect", "/en/beans/new?draft=1"]]);
});

for (const backendDuration of [60, 165]) {
  test(`client preparation and provider ${backendDuration}ms count toward the same total failure floor`, async () => {
    const { signIn, elapsed } = signInWith({ error: failures[0][1] }, { clientDuration: 35, backendDuration });
    assert.equal((await signIn({}, loginForm())).error, "invalid_credentials");
    assert.equal(elapsed(), SIGN_IN_FAILURE_FLOOR_MS);
  });
}

test("malformed action arguments also receive the failure floor without calling Auth", async () => {
  for (const malformed of [null, undefined, {}, { get: "not-callable" }]) {
    const { signIn, calls, elapsed } = signInWith({ error: null });
    assert.equal((await signIn({}, malformed)).error, "invalid_credentials");
    assert.equal(elapsed(), SIGN_IN_FAILURE_FLOOR_MS);
    assert.deepEqual(calls, []);
  }
});
