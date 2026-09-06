import assert from "node:assert/strict";
import test from "node:test";
import { parseRecordDraft, recordDraftScope, RECORD_DRAFT_TTL_MS, serializeRecordDraft } from "../src/lib/coffee/record-draft.ts";

const validate = (value) => typeof value?.name === "string" && typeof value?.note === "string";
const now = Date.UTC(2026, 8, 6, 9);

test("unfinished drafts preserve empty required fields, whitespace, hidden inputs and pending tags", () => {
  const value = { name: "", note: "  unfinished \n", price: -5, tagDraft: "Not committed", singleOrigin: "Ethiopia", blend_components: [{ origin_country: "", percentage: 0 }] };
  const parsed = parseRecordDraft(serializeRecordDraft(value, "server-revision", now), validate, now);
  assert.deepEqual(parsed.value, value);
  assert.equal(parsed.sourceVersion, "server-revision");
});

test("account, create and per-record edit scopes cannot collide", () => {
  const scopes = [recordDraftScope("first"), recordDraftScope("second"), recordDraftScope("first", "one"), recordDraftScope("first", "two"), recordDraftScope("first:new"), recordDraftScope("first", "one:new")];
  assert.equal(new Set(scopes).size, scopes.length);
  assert.ok(scopes.every((scope) => scope !== "guest"));
});

test("old, corrupt, oversized and incompatible drafts are not restored", () => {
  const value = { name: "unfinished", note: "" };
  const raw = serializeRecordDraft(value, null, now);
  assert.equal(parseRecordDraft(raw, validate, now + RECORD_DRAFT_TTL_MS + 1), null);
  assert.equal(parseRecordDraft(raw, validate, now - 61_000), null);
  assert.equal(parseRecordDraft("broken", validate, now), null);
  assert.equal(parseRecordDraft(JSON.stringify({ version: 2, savedAt: now, sourceVersion: null, value }), validate, now), null);
  assert.equal(parseRecordDraft(serializeRecordDraft({ name: 1, note: "" }, null, now), validate, now), null);
  assert.throws(() => serializeRecordDraft({ name: "x".repeat(100_000), note: "" }, null, now));
});
