import assert from "node:assert/strict";
import test from "node:test";

import { waitForHttpStatus } from "../scripts/http-readiness.mjs";

function hangingFetch(_url, { signal }) {
  return new Promise((_resolve, reject) => {
    const keepAlive = setInterval(() => {}, 1_000);
    signal.addEventListener(
      "abort",
      () => {
        clearInterval(keepAlive);
        reject(signal.reason);
      },
      { once: true }
    );
  });
}

test("readiness requires the exact expected response status", async () => {
  await waitForHttpStatus("http://test.invalid/api/health", {
    label: "test service",
    timeoutMs: 100,
    requestTimeoutMs: 20,
    retryDelayMs: 1,
    expectedStatus: 204,
    fetchImpl: async () => new Response(null, { status: 204 }),
  });

  await assert.rejects(
    waitForHttpStatus("http://test.invalid/api/health", {
      label: "test service",
      timeoutMs: 15,
      requestTimeoutMs: 5,
      retryDelayMs: 1,
      expectedStatus: 200,
      fetchImpl: async () => new Response(null, { status: 204 }),
    }),
    /test service did not become ready/
  );
});

test("a hung readiness request cannot exceed the overall deadline", async () => {
  const startedAt = Date.now();

  await assert.rejects(
    waitForHttpStatus("http://test.invalid/hang", {
      label: "hung service",
      timeoutMs: 60,
      requestTimeoutMs: 20,
      retryDelayMs: 2,
      expectedStatus: 204,
      fetchImpl: hangingFetch,
    }),
    /hung service did not become ready/
  );
  assert.ok(Date.now() - startedAt < 500);
});

test("shutdown aborts an in-flight readiness request", async () => {
  const controller = new AbortController();
  const reason = new Error("test shutdown");
  const readiness = waitForHttpStatus("http://test.invalid/hang", {
    label: "hung service",
    timeoutMs: 5_000,
    requestTimeoutMs: 5_000,
    retryDelayMs: 2,
    expectedStatus: 204,
    signal: controller.signal,
    fetchImpl: hangingFetch,
  });

  setTimeout(() => controller.abort(reason), 20);
  await assert.rejects(readiness, reason);
});
