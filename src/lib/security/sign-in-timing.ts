import { randomInt } from "node:crypto";
import { performance } from "node:perf_hooks";
import { setTimeout as sleep } from "node:timers/promises";

export const SIGN_IN_FAILURE_FLOOR_MS = 750;
export const SIGN_IN_FAILURE_JITTER_MS = 50;

type TimingSource = {
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<unknown>;
  jitter?: () => number;
};

/** Start before validation; pad total failed-attempt time, not backend time. */
export function createSignInFailureResponse(source: TimingSource = {}) {
  const now = source.now ?? (() => performance.now());
  const wait = source.sleep ?? sleep;
  // Draw once, independently of the address, credentials, outcome or provider.
  const deadline = now() + SIGN_IN_FAILURE_FLOOR_MS
    + (source.jitter ?? (() => randomInt(SIGN_IN_FAILURE_JITTER_MS + 1)))();

  return async <T>(response: T): Promise<T> => {
    // Timers can wake slightly early. A monotonic deadline also survives wall
    // clock adjustments. Provider delays exceeding it are not claimed hidden.
    for (let remaining = deadline - now(); remaining > 0; remaining = deadline - now()) {
      await wait(Math.ceil(remaining));
    }
    return response;
  };
}
