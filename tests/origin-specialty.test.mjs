import assert from "node:assert/strict";
import test from "node:test";
import { originRegionGuides, findRegionGuideByRoute } from "../src/data/origin-guides/index.ts";
import { originSpecialtyProfiles, specialtyProfileById } from "../src/data/origin-guides/specialty-research/index.ts";
import { buildSpecialtyIndex, sortBySpecialty, specialtySearchTerms, mergeSpecialtySources } from "../src/data/origin-guides/specialty-research/model.ts";
import { varietyKey } from "../src/data/origin-guides/variety-research/enrich.ts";

const byId = new Map(originRegionGuides.map((guide) => [guide.id, guide]));

test("every published origin has its own specialty review and traceable lots", () => {
  assert.equal(originSpecialtyProfiles.length, originRegionGuides.length);
  assert.equal(specialtyProfileById.size, originRegionGuides.length);
  for (const profile of originSpecialtyProfiles) {
    const guide = byId.get(profile.regionId);
    assert.ok(guide, profile.regionId);
    assert.ok(["focus", "standard", "background"].includes(profile.priority));
    assert.ok(profile.rationale.trim(), profile.regionId);
    assert.ok(profile.sources.length, profile.regionId);
    assert.ok(profile.lots.length >= (profile.priority === "focus" ? 2 : 1), profile.regionId);
    const keys = profile.lots.map((lot) => `${lot.name}|${lot.producer}`);
    assert.equal(new Set(keys).size, keys.length, profile.regionId);
    for (const lot of profile.lots) {
      for (const field of [lot.name, ...(lot.producer !== undefined ? [lot.producer] : []), lot.location, ...(lot.process ? [lot.process.ko, lot.process.en] : [])]) assert.ok(field.trim(), profile.regionId);
      assert.ok(lot.sources.length, lot.name);
      assert.ok(lot.flavorNotes.ko.length || lot.varieties.length || lot.process, lot.name);
      assert.equal(lot.flavorNotes.ko.length, lot.flavorNotes.en.length, lot.name);
      for (const value of [...lot.varieties, ...lot.flavorNotes.ko, ...lot.flavorNotes.en]) assert.ok(value.trim(), lot.name);
      for (const variety of lot.varieties) assert.ok(guide.varieties.some((value) => varietyKey(value) === varietyKey(variety)), `${guide.id}: ${variety}`);
      for (const source of lot.sources) {
        assert.equal(new URL(source.url).protocol, "https:");
        assert.ok(source.title && source.publisher && source.accessedAt, lot.name);
        assert.ok(guide.sources.some((entry) => entry.url === source.url), `${guide.id}: ${source.url}`);
      }
    }
    assert.ok(profile.lots.some((lot) => lot.flavorNotes.ko.length), `${profile.regionId}: flavor evidence`);
  }
});

test("specialty priority is stable and does not remove less prominent origins", () => {
  const guide = originRegionGuides[0];
  const guides = ["unknown", "standard-a", "focus-a", "background", "focus-b", "standard-b"].map((id) => ({ ...guide, id }));
  const profiles = new Map(guides.slice(1).map((entry) => [entry.id, { priority: entry.id.split("-")[0] }]));
  const before = structuredClone(guides);
  assert.deepEqual(sortBySpecialty(guides, profiles).map((entry) => entry.id), ["focus-a", "focus-b", "standard-a", "standard-b", "unknown", "background"]);
  assert.deepEqual(guides, before);
  assert.throws(() => buildSpecialtyIndex([originSpecialtyProfiles[0], originSpecialtyProfiles[0]]), /Duplicate/);
});

test("producer search includes lot names, location, processing and tasting notes", () => {
  const profile = specialtyProfileById.get("peru-puno");
  const terms = specialtySearchTerms(profile);
  for (const value of ["Anastacio Mamani", "Gesha", "워시드", "얼그레이"]) assert.ok(terms.includes(value), value);
  assert.deepEqual(specialtySearchTerms(), []);
});

test("roaster searches use the publishers attached to actual regional lots", () => {
  assert.ok(specialtySearchTerms(specialtyProfileById.get("ethiopia-arbegona")).includes("커피화 로스터스 · 언스페셜티"));
  assert.ok(!specialtySearchTerms(specialtyProfileById.get("rwanda-gicumbi")).includes("커피화 로스터스 · 언스페셜티"));
});

test("lot sources merge without replacing regional flavor evidence or source objects", () => {
  const guide = originRegionGuides[0];
  const original = { ...guide, sources: [] };
  const before = structuredClone(original);
  const result = mergeSpecialtySources([original], specialtyProfileById)[0];
  assert.deepEqual(original, before);
  assert.deepEqual(result.flavorNotes, original.flavorNotes);
  assert.deepEqual(result.verification, original.verification);
  assert.equal(new Set(result.sources.map((source) => source.url)).size, result.sources.length);
  assert.ok(result.sources.length);
});

test("important specialty additions resolve as distinct regions", () => {
  for (const [country, region] of [["colombia", "quindio"], ["colombia", "valle-del-cauca"], ["brazil", "espirito-santo"], ["ethiopia", "bench-maji"], ["costa-rica", "turrialba"], ["costa-rica", "orosi"], ["costa-rica", "tres-rios"]]) {
    const guide = findRegionGuideByRoute(country, region);
    assert.ok(guide, `${country}/${region}`);
    assert.ok(specialtyProfileById.has(guide.id));
  }
});

test("public origin copy contains facts rather than unsolicited selection instructions", () => {
  const instructions = /확인하면 좋|확인해야|살펴보세요|비교하기 좋|함께 읽어야|일반화하지|should be checked|best explored|useful starting point/i;
  for (const guide of originRegionGuides) {
    for (const field of [guide.summary, guide.environment]) {
      assert.doesNotMatch(field.ko, instructions, guide.id);
      assert.doesNotMatch(field.en, instructions, guide.id);
    }
  }
});
