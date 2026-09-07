import assert from "node:assert/strict";
import test from "node:test";
import { matches, scoreFixture, summarize, percentile95, forbiddenValueEntries } from "./ocr-release-score.mjs";
test("typography does not hide letter errors or incomplete lists", () => {
  assert.equal(matches("Hologram™", "hologram"), true);
  assert.equal(matches("MAbIC", "MALIC"), false);
  assert.equal(matches("Batian", "SL28, SL34, BATIAN"), false);
  assert.equal(matches([{ country: "Kenya", share: 40 }, { country: "Brazil", share: 60 }], [{ country: "Brazil", share: 60 }, { country: "Kenya", share: 40 }]), true);
});
test("missing, false content and unscored extra-language notes remain distinct", () => {
  const score = scoreFixture({ expected: { fields: { name: "Actual Coffee", weight_g: 200 }, tasting_notes: { ko: ["청사과"] } }, mustRemainUnknown: ["roast_date", "altitude_m"] },
    { fields: { name: "Report number", roast_date: "2026-09-01" }, tasting_notes: { ko: ["청사과"], en: ["Brand Logo"] } });
  assert.deepEqual(score.records.map(record => record.status), ["wrong", "missing", "correct"]);
  assert.equal(score.blankChecks.length, 1);
  assert.equal(score.blankChecks[0].status, "unsupported");
  assert.deepEqual(score.unscoredNotes, { en: ["Brand Logo"] });
});
test("negative images reject coffee fields, notes and inferred bean type", () => {
  const score = scoreFixture({ kind: "negative" }, { bean_type: "single_origin", fields: { weight_g: 200 }, tasting_notes: { en: ["SOAP"], ko: [] } });
  assert.equal(score.blankChecks.filter(record => record.status === "unsupported").length, 2);
  assert.equal(score.beanType.status, "wrong");
});
test("repeat reads do not inflate accuracy and errors remain in the denominator", () => {
  const fixture = { expected: { fields: { name: "A" } } };
  const rows = [0, 1].map(repeat => ({ id: "one", browser: "chromium", split: "blind", repeat, elapsedMs: 100, extraction: { fields: { name: "A" } }, score: scoreFixture(fixture, { fields: { name: "A" } }) }));
  rows.push({ id: "two", browser: "chromium", split: "blind", repeat: 0, error: "timeout", score: scoreFixture(fixture) });
  const group = summarize(rows)[0];
  assert.deepEqual(group.fields, { total: 2, correct: 1, missing: 1, wrong: 0 });
  assert.equal(group.runtimeFailures, 1);
  assert.equal(group.stableExtractions, 1);
});
test("warm-only failures remain visible even when first-read accuracy passed", () => {
  const fixture = { expected: { fields: { name: "A" } } }, extraction = { fields: { name: "A" } };
  const rows = [{ id: "one", browser: "webkit", split: "development", repeat: 0, elapsedMs: 100, extraction, score: scoreFixture(fixture, extraction) },
    { id: "one", browser: "webkit", split: "development", repeat: 1, error: "timeout", score: scoreFixture(fixture) }];
  const group = summarize(rows)[0];
  assert.equal(group.fields.correct, 1);
  assert.equal(group.runtimeFailures, 1);
  assert.equal(group.runtimeFailureReads, 1);
});
test("a failed negative read does not count as successful absence evidence", () => {
  const score = scoreFixture({ kind: "negative" }, null);
  assert.ok(score.blankChecks.every(record => record.status === "unmeasured"));
  const group = summarize([{ id: "blank", browser: "webkit", split: "negative", kind: "negative", repeat: 0, error: "timeout", score }])[0];
  assert.equal(group.blankChecks, 0);
  assert.equal(group.unmeasuredBlankChecks, 16);
  assert.equal(group.negativeFailures, 1);
});
test("a restarted worker is not warm and every repeat participates in stability", () => {
  const fixture = { expected: { fields: { name: "A" } } };
  const rows = ["A", "A", "B"].map((name, repeat) => ({ id: "one", browser: "chromium", split: "development", repeat, elapsedMs: 100, workerReused: repeat === 2, extraction: { fields: { name } }, score: scoreFixture(fixture, { fields: { name } }) }));
  const group = summarize(rows)[0];
  assert.equal(group.warmMedianMs, null);
  assert.equal(group.restartedRepeatReads, 1);
  assert.equal(group.stableExtractions, 0);
});
test("slow intentional restarts remain in end-to-end repeated timing", () => {
  const extraction = { fields: {} }, score = scoreFixture({}, extraction);
  const rows = [
    { id: "simple", repeat: 0, elapsedMs: 100 }, { id: "simple", repeat: 1, elapsedMs: 100, workerReused: true },
    { id: "fallback", repeat: 0, elapsedMs: 500 }, { id: "fallback", repeat: 1, elapsedMs: 17000, workerReused: false },
    { id: "failed", repeat: 0, elapsedMs: 200 }, { id: "failed", repeat: 1, elapsedMs: 120000, error: "timeout", workerReused: false },
  ].map(row => ({ browser: "webkit", split: "development", extraction, score, ...row }));
  const group = summarize(rows)[0];
  assert.equal(group.warmP95Ms, 100);
  assert.equal(group.warmSampleCount, 1);
  assert.equal(group.repeatedP95Ms, 120000);
  assert.equal(group.repeatedMaxMs, 120000);
  assert.equal(group.repeatedExpectedReads, 3);
  assert.equal(group.repeatedTimedReads, 3);
  assert.equal(group.repeatedFailedReads, 1);
  assert.equal(group.runtimeFailures, 1);
});
test("forbidden cup-note members are found inside arrays", () => {
  const result = scoreFixture({ forbiddenValues: { "tasting_notes.en": ["Soap"] } }, { fields: {}, tasting_notes: { en: ["Floral", "SOAP"], ko: [] } });
  assert.equal(result.forbidden.length, 1);
  assert.equal(result.forbidden[0].field, "tasting_notes.en");
});
test("nested and dotted forbidden paths preserve the same values and penalties", () => {
  const nested = { fields: { name: ["Example Blend"], origin_country: ["Example Country"] }, tasting_notes: { en: ["Soap"] } };
  const before = structuredClone(nested);
  const dotted = { "fields.name": ["Example Blend"], "fields.origin_country": ["Example Country"], "tasting_notes.en": ["Soap"] };
  const extraction = { fields: { name: "EXAMPLE BLEND", origin_country: "Example Country" }, tasting_notes: { en: ["Floral", "SOAP"] } };
  assert.deepEqual(scoreFixture({ forbiddenValues: nested }, extraction), scoreFixture({ forbiddenValues: dotted }, extraction));
  assert.equal(scoreFixture({ forbiddenValues: nested }, extraction).forbidden.length, 3);
  assert.deepEqual(nested, before);
});
test("invalid forbidden leaves fail validation instead of dropping a constraint", () => {
  assert.throws(() => forbiddenValueEntries({ fields: { name: "Example Blend" } }), /fields\.name must be an array/u);
  assert.throws(() => forbiddenValueEntries(["Example Blend"]), /must be a mapping/u);
  assert.throws(() => forbiddenValueEntries(null), /must be a mapping/u);
});
test("coffee timing is available independently of fast negatives in the same blind split", () => {
  const extraction = { fields: {} }, score = scoreFixture({}, extraction), rows = [];
  for (const kind of ["coffee", "negative"]) for (let repeat = 0; repeat < 2; repeat++) rows.push({ id: kind, kind,
    browser: "chromium", split: "blind", repeat, elapsedMs: kind === "coffee" ? 9000 : 10,
    coldTotalMs: repeat === 0 ? kind === "coffee" ? 18000 : 50 : null, extraction, score });
  const group = summarize(rows)[0];
  assert.equal(group.timingByKind.coffee.repeatedMedianMs, 9000);
  assert.equal(group.timingByKind.coffee.repeatedExpectedReads, 1);
  assert.equal(group.timingByKind.coffee.coldTotalMaxMs, 18000);
  assert.equal(group.timingByKind.negative.repeatedMedianMs, 10);
});
test("p95 uses the declared nearest-rank definition", () => {
  assert.equal(percentile95([]), null);
  assert.equal(percentile95(Array.from({ length: 20 }, (_, index) => index + 1)), 19);
  assert.equal(percentile95([8, 1, 3]), 8);
});
test("a first-read-only run cannot establish repetition or warm timing", () => {
  const extraction = { fields: { name: "A" } }, score = scoreFixture({ expected: { fields: { name: "A" } } }, extraction);
  const group = summarize([{ id: "one", browser: "chromium", split: "development", repeat: 0, elapsedMs: 100, coldTotalMs: 200, extraction, score }])[0];
  assert.equal(group.fields.correct, 1);
  assert.equal(group.stableExtractions, 0);
  assert.equal(group.repeatedExpectedReads, 0);
  assert.equal(group.repeatedTimedReads, 0);
  assert.equal(group.repeatedP95Ms, null);
  assert.equal(group.warmMedianMs, null);
});
