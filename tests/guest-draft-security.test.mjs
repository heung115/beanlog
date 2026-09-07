import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { GUEST_BEAN_DRAFT_KEY, GUEST_BEAN_DRAFT_TTL_MS, MAX_GUEST_DRAFT_LENGTH, parseGuestBeanDraft, saveGuestBeanDraft, loadGuestBeanDraft, clearGuestBrowserDrafts } from "../src/lib/coffee/guest-draft.ts";
import { RECORD_DRAFT_PREFIX } from "../src/lib/coffee/record-draft.ts";

const now = Date.UTC(2026, 8, 7, 0);
const bean = { name: "Guest coffee", roastery: "Roastery", bean_type: "single_origin", origin_country: "Ethiopia", process_method: "washed", roast_level: "medium", consumed_at: "2026-09-07", place_type: "home", overall_score: 7, note: "My note", tags: [], blend_components: [] };
const draft = (savedAt = now) => JSON.stringify({ version: 1, savedAt: new Date(savedAt).toISOString(), bean });

function storage(t) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  const local = new Map(); const session = new Map();
  const api = map => ({ getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) });
  const window = { localStorage: api(local), sessionStorage: api(session) };
  Object.defineProperty(globalThis, "window", { configurable: true, value: window });
  t.after(() => { if (original) Object.defineProperty(globalThis, "window", original); else delete globalThis.window; });
  return { local, session, window };
}

test("guest drafts have a 24-hour lifetime with only a minute of future clock tolerance", () => {
  assert.deepEqual(parseGuestBeanDraft(draft(), now).bean, bean);
  assert.ok(parseGuestBeanDraft(draft(), now + GUEST_BEAN_DRAFT_TTL_MS));
  assert.equal(parseGuestBeanDraft(draft(), now + GUEST_BEAN_DRAFT_TTL_MS + 1), null);
  assert.equal(parseGuestBeanDraft(draft(now + 60_001), now), null);
});

test("invalid and oversized guest data is rejected before restoration", () => {
  for (const raw of ["broken", "x".repeat(MAX_GUEST_DRAFT_LENGTH + 1), JSON.stringify({ version: 2, savedAt: new Date(now).toISOString(), bean }), JSON.stringify({ version: 1, savedAt: "invalid", bean }), JSON.stringify({ version: 1, savedAt: new Date(now).toISOString(), bean: { ...bean, note: "" } })]) assert.equal(parseGuestBeanDraft(raw, now), null);
});

test("expired and malformed stored guest copies are physically removed on load", t => {
  const { local } = storage(t);
  for (const value of [draft(0), "broken", "x".repeat(MAX_GUEST_DRAFT_LENGTH + 1)]) {
    local.set(GUEST_BEAN_DRAFT_KEY, value);
    assert.equal(loadGuestBeanDraft(), null);
    assert.equal(local.has(GUEST_BEAN_DRAFT_KEY), false);
  }
});

test("save validates, bounds and reloads the guest copy", t => {
  const { local } = storage(t);
  const result = saveGuestBeanDraft(bean);
  assert.equal(result.status, "saved");
  assert.ok(local.get(GUEST_BEAN_DRAFT_KEY).length < MAX_GUEST_DRAFT_LENGTH);
  assert.deepEqual(loadGuestBeanDraft().bean, bean);
  assert.equal(saveGuestBeanDraft({ ...bean, note: "x".repeat(2001) }).status, "invalid");
});

test("discard and completed login remove both guest stores and preserve account drafts", t => {
  const { local, session } = storage(t);
  local.set(GUEST_BEAN_DRAFT_KEY, draft());
  session.set(RECORD_DRAFT_PREFIX + "guest", "guest");
  session.set(RECORD_DRAFT_PREFIX + "user:one:new", "account");
  clearGuestBrowserDrafts();
  assert.equal(local.has(GUEST_BEAN_DRAFT_KEY), false);
  assert.equal(session.has(RECORD_DRAFT_PREFIX + "guest"), false);
  assert.equal(session.get(RECORD_DRAFT_PREFIX + "user:one:new"), "account");
});

test("blocked local storage does not prevent clearing tab guest data", t => {
  const { session, window } = storage(t);
  window.localStorage.removeItem = () => { throw new Error("blocked"); };
  window.localStorage.setItem = () => { throw new Error("blocked"); };
  window.localStorage.getItem = () => { throw new Error("blocked"); };
  session.set(RECORD_DRAFT_PREFIX + "guest", "guest");
  assert.equal(loadGuestBeanDraft(), null);
  assert.equal(saveGuestBeanDraft(bean).status, "storage_unavailable");
  clearGuestBrowserDrafts();
  assert.equal(session.has(RECORD_DRAFT_PREFIX + "guest"), false);
});

test("login cleanup exempts explicit import and import stores its account copy before guest deletion", () => {
  const bar = readFileSync(new URL("../src/components/layout/top-bar.tsx", import.meta.url), "utf8");
  assert.match(bar, /appPathname === "\/beans\/new" && searchParams.get\("draft"\) === "1"/);
  assert.match(bar, /if \(user && !importingGuestDraft\) clearGuestBrowserDrafts\(\)/);
  const form = readFileSync(new URL("../src/components/beans/bean-form.tsx", import.meta.url), "utf8");
  assert.match(form, /sessionStorage.setItem\(RECORD_DRAFT_PREFIX \+ draftScope, serializeRecordDraft\([\s\S]*?clearGuestBrowserDrafts\(\);[\s\S]*?catch/);
  const guest = readFileSync(new URL("../src/components/beans/guest-record-form.tsx", import.meta.url), "utf8");
  assert.match(guest, /clearGuestBrowserDrafts\(\);\s*draftRecovery.discard\(emptyDraft\(\)\)/);
});
