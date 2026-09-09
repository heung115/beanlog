import assert from "node:assert/strict";
import test from "node:test";
import { coffeeVarietyGuides, getVarietyGuides } from "../src/data/coffee-varieties/index.ts";
import { buildVarietyGuideIndex } from "../src/data/coffee-varieties/model.ts";
import { varietySearchTerms } from "../src/data/origin-guides/variety-search.ts";

test("variety aliases normalize spelling without merging genetic identities", () => {
  assert.deepEqual(getVarietyGuides(["SL28", "SL-28", "SL 28"]).map(x => x.id), ["sl28"]);
  const generic = getVarietyGuides(["Gesha"])[0];
  const panama = getVarietyGuides(["Geisha T2722"])[0];
  assert.ok(generic && panama);
  assert.notEqual(generic.id, panama.id);
  assert.equal(getVarietyGuides(["Obata"]).length, 0);
  assert.equal(getVarietyGuides(["Obatá Vermelho"])[0].id, "obata-red");
  assert.deepEqual(getVarietyGuides(["H1 Centroamericano", "Centroamericano (H1)"]).map(x => x.id), ["centroamericano"]);
});

test("new profile spellings are searchable only for matching cultivated varieties", () => {
  assert.ok(varietySearchTerms(["Centroamericano (H1)"]).includes("센트로아메리카노"));
  assert.ok(varietySearchTerms(["Unknown experimental Bourbon"]).includes("Unknown experimental Bourbon"));
  assert.ok(!varietySearchTerms(["Typica"]).includes("센트로아메리카노"));
});

test("unknown names and descendants are not assigned a parent profile", () => {
  assert.deepEqual(getVarietyGuides(["Unknown experimental Bourbon", "SL28 descendant"]), []);
  const first = coffeeVarietyGuides[0];
  assert.throws(() => buildVarietyGuideIndex([first, {...first, id: "different-genetics"}]), /Ambiguous/);
});

test("published variety characteristics have bilingual text and primary source links", () => {
  assert.equal(new Set(coffeeVarietyGuides.map(x => x.id)).size, coffeeVarietyGuides.length);
  for (const guide of coffeeVarietyGuides) {
    assert.ok(guide.summary.ko && guide.summary.en, guide.id);
    assert.ok(guide.sources.length, guide.id);
    for (const field of [guide.lineage, guide.growing, guide.traits].filter(Boolean)) {
      assert.ok(field.ko && field.en, guide.id);
    }
    for (const source of guide.sources) {
      assert.equal(new URL(source.url).protocol, "https:");
      assert.ok(source.publisher && source.accessedAt, guide.id);
    }
  }
});
