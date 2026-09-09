import assert from "node:assert/strict";
import test from "node:test";
import { originPresets } from "../src/data/origin-presets.ts";
import {
  originGuideCountries, findGuideCountry, findGuideCountryBySlug, originRegionGuides, regionGuidePath, findRegionGuide, getCountryRegionGuides,
  getGuideSubregionChains, mergeOriginSubregionChains,
  getRecordOriginGuide,
  normalizeOriginGuideQuery,
} from "../src/data/origin-guides/index.ts";

test("every existing public region has a sourced regional profile in both languages", () => {
  for (const country of originPresets) {
    for (const region of country.regions) {
      const guide = findRegionGuide(country.country, region.name);
      assert.ok(guide, `${country.country}: ${region.name}`);
      assert.equal(guide.name, region.name);
    }
  }
  for (const guide of originRegionGuides) {
    assert.match(guide.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(originGuideCountries.some((country) => country.country === guide.country));
    for (const field of ["summary", "environment", "specialty"]) {
      for (const locale of ["ko", "en"]) assert.ok(guide[field][locale]?.trim(), `${guide.id}.${field}.${locale}`);
    }
    for (const locale of ["ko", "en"]) {
      assert.ok(guide.flavorNotes[locale].length > 0, guide.id);
      assert.ok(guide.processes[locale].length > 0, guide.id);
    }
    assert.ok(guide.sources.length > 0, guide.id);
    for (const source of guide.sources) {
      const url = new URL(source.url);
      assert.equal(url.protocol, "https:", guide.id);
      assert.equal(url.username, "");
      assert.ok(source.title.trim() && source.publisher.trim(), guide.id);
      assert.match(source.accessedAt, /^\d{4}-\d{2}-\d{2}$/);
    }
    if (guide.altitude) {
      assert.ok(guide.altitude.min >= 0 && guide.altitude.max > guide.altitude.min && guide.altitude.max < 4000, guide.id);
    }
  }
});

test("record links use the deepest verified region without reinterpreting a conflicting location", () => {
  assert.equal(getRecordOriginGuide("India", "Karnataka", ["Chikmagalur", "Bababudangiri"])?.name, "Bababudangiri");
  assert.equal(getRecordOriginGuide("Ethiopia", "Yirgacheffe", ["Gedeb"])?.name, "Gedeb");
  assert.equal(getRecordOriginGuide("Ethiopia", "Yirgacheffe", ["Guji"])?.name, "Yirgacheffe");
  assert.equal(getRecordOriginGuide("Ethiopia", "Yirgacheffe", ["Unknown village", "Gedeb"])?.name, "Yirgacheffe");
  assert.equal(getRecordOriginGuide("Ethiopia", "Unknown region", ["Gedeb"]), undefined);
  assert.equal(getRecordOriginGuide("Ethiopia", undefined, ["Yirgacheffe", "Gedeb"])?.name, "Gedeb");
  assert.equal(getRecordOriginGuide("Kenya", "Yirgacheffe"), undefined);
});

test("the catalog has unique pages and acyclic parents within the same country", () => {
  assert.equal(new Set(originRegionGuides.map((guide) => guide.id)).size, originRegionGuides.length);
  assert.equal(new Set(originRegionGuides.map(regionGuidePath)).size, originRegionGuides.length);
  const byId = new Map(originRegionGuides.map((guide) => [guide.id, guide]));
  const names = new Map();
  for (const guide of originRegionGuides) {
    for (const name of [guide.name, guide.nameKo, ...guide.aliases]) {
      const key = `${guide.country}:${normalizeOriginGuideQuery(name)}`;
      assert.ok(!names.has(key) || names.get(key) === guide.id, `${key} matches two places`);
      names.set(key, guide.id);
    }
    if (guide.kind === "microregion") assert.ok(guide.parentId, guide.id);
    const seen = new Set([guide.id]);
    let current = guide;
    while (current.parentId) {
      const parent = byId.get(current.parentId);
      assert.ok(parent, `${current.id} has a missing parent`);
      assert.equal(parent.country, guide.country);
      assert.equal(seen.has(parent.id), false, `${guide.id} has a cycle`);
      seen.add(parent.id);
      current = parent;
    }
  }
});

test("record suggestions stay scoped to the selected country and parent and retain saved labels", () => {
  const parent = originRegionGuides.find((guide) => originRegionGuides.some((child) => child.parentId === guide.id));
  assert.ok(parent);
  const children = originRegionGuides.filter((guide) => guide.parentId === parent.id);
  const chains = getGuideSubregionChains(parent.country, parent.nameKo);
  for (const child of children) assert.ok(chains.some((chain) => chain[0] === child.name), child.id);
  assert.ok(chains.every((chain) => !chain.includes(parent.name)));
  assert.deepEqual(getGuideSubregionChains(parent.country, "unverified-place"), []);
  assert.deepEqual(getGuideSubregionChains("unverified-country"), []);
  assert.deepEqual(mergeOriginSubregionChains([[" User Village "]], [["user village"], ["New Village"]]), [["User Village"], ["New Village"]]);
  for (const guide of getCountryRegionGuides("에티오피아")) assert.equal(guide.country, "Ethiopia");
  assert.equal(findRegionGuide("Colombia", "Narino")?.name, "Nariño");
  assert.deepEqual(getCountryRegionGuides("Tanzania, United Republic Of"), getCountryRegionGuides("Tanzania"));
  assert.ok(getCountryRegionGuides("Tanzania, United Republic Of").length > 0);
});

 test("every guide country resolves by either language and has regional pages", () => {
   for (const country of originGuideCountries) {
     assert.equal(findGuideCountry(country.countryKo)?.country, country.country);
     assert.ok(getCountryRegionGuides(country.countryKo).length > 0);
     const slug = regionGuidePath(getCountryRegionGuides(country.country)[0]).split("/")[2];
     assert.equal(findGuideCountryBySlug(slug)?.country, country.country);
   }
   for (const country of ["Bolivia", "Ecuador", "Uganda", "China", "Thailand", "Timor-Leste"]) {
     assert.ok(getCountryRegionGuides(country).length >= 2, country);
   }
 });
