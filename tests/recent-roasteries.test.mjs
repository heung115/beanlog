import assert from "node:assert/strict";
import test from "node:test";
import { parseRecentRoasteries, readRecentRoasteries, recentRoasteriesKey, saveRecentRoastery } from "../src/lib/coffee/recent-roasteries.ts";

const storage = () => {
  const entries = new Map();
  return { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: (key) => entries.delete(key) };
};

test("recent roasteries remain private when accounts share a browser", () => {
  const store = storage();
  saveRecentRoastery(store, "account-a", "A private roastery");
  assert.deepEqual(readRecentRoasteries(store, "account-b"), []);
  saveRecentRoastery(store, "account-b", "B roastery");
  assert.deepEqual(readRecentRoasteries(store, "account-a"), ["A private roastery"]);
  assert.deepEqual(readRecentRoasteries(store, "account-b"), ["B roastery"]);
  store.setItem("recent_roasteries", '["unattributed private history"]');
  assert.deepEqual(readRecentRoasteries(store, "account-c"), []);
  assert.equal(store.getItem("recent_roasteries"), null);
  assert.equal(saveRecentRoastery(store, undefined, "Anonymous"), undefined);
});

test("damaged persistent history cannot crash the record form", () => {
  for (const raw of ['{"notAnArray":true}', 'null', '42', '"text"', 'invalid']) assert.deepEqual(parseRecentRoasteries(raw), []);
  assert.deepEqual(parseRecentRoasteries('[null,{},42," valid ","valid",""]'), ["valid"]);
  const store = storage();
  store.setItem(recentRoasteriesKey("a"), '{"notAnArray":true}');
  assert.deepEqual(saveRecentRoastery(store, "a", "Recovered"), ["Recovered"]);
  assert.deepEqual(readRecentRoasteries(store, "a"), ["Recovered"]);
});

test("history is deduplicated, bounded, and optional when storage is unavailable", () => {
  const store = storage();
  for (let n = 0; n < 12; n++) saveRecentRoastery(store, "a", `Roastery ${n}`);
  saveRecentRoastery(store, "a", "Roastery 10");
  assert.equal(readRecentRoasteries(store, "a").length, 10);
  assert.equal(readRecentRoasteries(store, "a")[0], "Roastery 10");
  const unavailable = { getItem() { throw Error("unavailable"); }, setItem() { throw Error("unavailable"); }, removeItem() { throw Error("unavailable"); } };
  assert.deepEqual(readRecentRoasteries(unavailable, "a"), []);
  assert.equal(saveRecentRoastery(unavailable, "a", "Name"), undefined);
});
