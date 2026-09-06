import assert from "node:assert/strict";
import test from "node:test";
import { formatDate } from "../src/lib/utils.ts";

test("calendar dates stay on the recorded day in Korean and English across time zones", () => {
  const previous = process.env.TZ;
  try {
    for (const timezone of ["America/Los_Angeles", "Asia/Seoul"]) {
      process.env.TZ = timezone;
      assert.equal(formatDate("2026-09-06", "en"), "Sep 6, 2026");
      assert.equal(formatDate("2026-09-06", "ko"), "2026년 9월 6일");
    }
    process.env.TZ = "America/Los_Angeles";
    assert.equal(formatDate("2026-09-06T01:00:00Z", "en"), "Sep 5, 2026");
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
