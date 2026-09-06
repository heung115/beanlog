import assert from "node:assert/strict";
import test from "node:test";
import { isCalendarDate } from "../src/lib/coffee/calendar-date.ts";

test("calendar dates reject impossible days instead of rolling them into another month", () => {
  for (const value of ["2026-02-29", "2026-02-30", "2026-04-31", "2026-00-10", "2026-13-01", "0000-01-01", "10000-01-01", "2026-1-01"]) assert.equal(isCalendarDate(value), false, value);
  for (const value of ["0001-01-01", "9999-12-31", "2024-02-29", "2000-02-29", "2026-09-06"]) assert.equal(isCalendarDate(value), true, value);
  assert.equal(isCalendarDate("1900-02-29"), false);
});
