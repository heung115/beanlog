#!/usr/bin/env node
// Opt-in wall-clock regression: actual action + Supabase SDK, loopback-only
// synthetic Auth with deliberately different lookup/KDF durations. No real
// accounts, SMTP, external requests, or claims about production distributions.
import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import { createServer } from "node:http";
import { performance } from "node:perf_hooks";
import { setTimeout as sleep } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import { loadSignInAction } from "../tests/fixtures/sign-in-action.mjs";
import { SIGN_IN_FAILURE_FLOOR_MS, SIGN_IN_FAILURE_JITTER_MS } from "../src/lib/security/sign-in-timing.ts";

const durations = { existing: 165, absent: 60 };
const requests = { existing: 0, absent: 0 };
const server = createServer(async (request, response) => {
  try {
    assert.equal(request.method, "POST");
    assert.equal(request.url, "/auth/v1/token?grant_type=password");
    let payload = "";
    for await (const chunk of request) {
      payload += chunk;
      assert.ok(payload.length < 8192);
    }
    const { email } = JSON.parse(payload);
    const cohort = email === "existing@local.test" ? "existing" : "absent";
    requests[cohort] += 1;
    await sleep(durations[cohort]);
    response.writeHead(400, { "content-type": "application/json", "x-supabase-api-version": "2024-01-01" });
    response.end(JSON.stringify({ code: "invalid_credentials", msg: "Invalid login credentials" }));
  } catch {
    response.writeHead(500).end();
  }
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const client = createClient(`http://127.0.0.1:${server.address().port}`, "fixture-anon", {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const signIn = loadSignInAction({ createClient: async () => client });
const results = [];
const summary = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const quantile = (p) => Number(sorted[Math.floor((sorted.length - 1) * p)].toFixed(2));
  return { count: sorted.length, minMs: quantile(0), medianMs: quantile(0.5), p95Ms: quantile(0.95), maxMs: quantile(1) };
};
try {
  for (const order of ["alternating", "randomized"]) {
    const sequence = Array.from({ length: 20 }, () => ["existing", "absent"]).flat();
    if (order === "randomized") {
      for (let i = sequence.length - 1; i > 0; i -= 1) {
        const j = randomInt(i + 1);
        [sequence[i], sequence[j]] = [sequence[j], sequence[i]];
      }
    }
    const samples = { existing: [], absent: [] };
    for (const cohort of sequence) {
      const form = new FormData();
      form.set("email", `${cohort}@local.test`);
      form.set("password", "fixture-wrong-password");
      const before = performance.now();
      const result = await signIn({}, form);
      const elapsed = performance.now() - before;
      assert.equal(JSON.stringify(result), '{"error":"invalid_credentials"}');
      assert.ok(elapsed >= SIGN_IN_FAILURE_FLOOR_MS, "failure escaped minimum duration");
      samples[cohort].push(elapsed);
    }
    const existing = summary(samples.existing);
    const absent = summary(samples.absent);
    results.push({ order, existing, absent, medianDifferenceMs: Number((existing.medianMs - absent.medianMs).toFixed(2)) });
  }
  assert.deepEqual(requests, { existing: 40, absent: 40 });
  console.log(JSON.stringify({ pass: true, scope: "actual action and SDK; synthetic loopback Auth; not production or full Next HTTP timing", providerDelayMs: durations, failureFloorMs: SIGN_IN_FAILURE_FLOOR_MS, uniformJitterMs: [0, SIGN_IN_FAILURE_JITTER_MS], results, limitation: "Finite samples do not prove statistical indistinguishability; backend delays exceeding the floor remain observable." }, null, 2));
} finally {
  await new Promise((resolve) => server.close(resolve));
}
