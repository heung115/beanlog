import assert from "node:assert/strict";
import test from "node:test";
import { originRegionGuides } from "../src/data/origin-guides/index.ts";
import { originVarietyEvidence } from "../src/data/origin-guides/variety-research/index.ts";
import { enrichVarieties, varietyKey } from "../src/data/origin-guides/variety-research/enrich.ts";
import { varietySearchTerms } from "../src/data/origin-guides/variety-search.ts";

test("every added variety retains producer and source evidence on the correct guide", () => {
  for (const record of originVarietyEvidence) {
    const guide = originRegionGuides.find((guide) => guide.id === record.regionId);
    assert.ok(guide, record.regionId);
    assert.ok(record.producer.trim());
    assert.ok(record.variety.trim());
    assert.ok(record.sources.length);
    assert.ok(guide.varieties.some((name) => varietyKey(name) === varietyKey(record.variety)));
    for (const source of record.sources) {
      assert.equal(new URL(source.url).protocol, "https:");
      assert.ok(source.title && source.publisher && source.accessedAt);
      assert.ok(guide.sources.some((entry) => entry.url === source.url));
    }
  }
});

test("farm varieties roll up only to ancestors without mutating source guides or flavors", () => {
  const template = originRegionGuides[0];
  const make = (id, parentId, country = "Test") => ({ ...template, id, parentId, country, varieties: ["Typica"], sources: [] });
  const guides = [make("root"), make("farm", "root"), make("neighbor", "root"), make("below", "farm"), make("foreign", "root", "Other")];
  const before = structuredClone(guides);
  const source = { title: "farm lot", url: "https://example.com/farm", publisher: "Farm", accessedAt: "2026-09-08" };
  const result = enrichVarieties(guides, [{ regionId: "farm", variety: "Gesha", producer: "Farm", sources: [source] }, { regionId: "foreign", variety: "Pacamara", producer: "Other", sources: [source] }]);
  assert.deepEqual(guides, before);
  for (const id of ["root", "farm"]) assert.deepEqual(result.find((g) => g.id === id).varieties, ["Typica", "Gesha"]);
  for (const id of ["neighbor", "below"]) assert.deepEqual(result.find((g) => g.id === id).varieties, ["Typica"]);
  assert.deepEqual(result.map((g) => g.flavorNotes), before.map((g) => g.flavorNotes));
  assert.throws(() => enrichVarieties(guides, [{ regionId: "missing", variety: "Java", producer: "Farm", sources: [source] }]), /Unknown/);
});

test("spelling aliases deduplicate without collapsing named selections", () => {
  for (const [a,b] of [["Gesha","Geisha"],["SL28","SL-28"],["74110","JARC 74110"],["Maragogype","Maragogipe"]]) assert.equal(varietyKey(a),varietyKey(b));
  for (const [a,b] of [["Gesha","Gesha 1931"],["Bourbon","Pink Bourbon"],["KT423","KP423"],["Wolisho","Welicho"]]) assert.notEqual(varietyKey(a),varietyKey(b));
});

test("specialty variety searches accept Korean and English spellings", () => {
  for (const [variety, query] of [["Gesha","게이샤"],["Geisha","Gesha"],["Pink Bourbon","핑크버번"],["Sidra","시드라"],["Chiroso","치로소"],["Wush Wush","우시우시"],["Ombligon","옴블리곤"],["SL-28","SL28"]]) assert.ok(varietySearchTerms([variety]).includes(query), query);
});
