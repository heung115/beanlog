import assert from "node:assert/strict";
import test from "node:test";
import {
  createSignInFailureResponse, SIGN_IN_FAILURE_FLOOR_MS, SIGN_IN_FAILURE_JITTER_MS,
} from "../src/lib/security/sign-in-timing.ts";

for (const jitter of [0, SIGN_IN_FAILURE_JITTER_MS]) {
  test(`all sub-floor provider times share the action deadline with jitter ${jitter}`, async () => {
    for (const backendTime of [0, 60, 165, 400, 740]) {
      let time = 10000;
      let draws = 0;
      const finish = createSignInFailureResponse({
        now: () => time, jitter: () => { draws++; return jitter; },
        sleep: async (remaining) => { time += remaining; },
      });
      time += backendTime;
      const response = { error: "invalid_credentials" };
      assert.equal(await finish(response), response);
      assert.equal(time, 10000 + SIGN_IN_FAILURE_FLOOR_MS + jitter);
      assert.equal(draws, 1);
    }
  });
}

test("an early timer wake cannot return before the monotonic deadline", async () => {
  let time = 0;
  const waits = [];
  const finish = createSignInFailureResponse({ now: () => time, jitter: () => 0,
    sleep: async (remaining) => { waits.push(remaining); time += waits.length === 1 ? remaining - 0.5 : remaining; },
  });
  await finish({ error: "rate_limited" });
  assert.deepEqual(waits, [SIGN_IN_FAILURE_FLOOR_MS, 1]);
  assert.ok(time >= SIGN_IN_FAILURE_FLOOR_MS);
});

test("provider overruns are not given another fixed delay or hidden by the timing claim", async () => {
  let time = 0;
  const finish = createSignInFailureResponse({ now: () => time, jitter: () => SIGN_IN_FAILURE_JITTER_MS,
    sleep: async () => { throw new Error("No extra delay after deadline"); },
  });
  time = 2000;
  assert.equal(await finish("temporarily_unavailable"), "temporarily_unavailable");
  assert.equal(time, 2000);
});
