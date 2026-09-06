import assert from "node:assert/strict";
import test from "node:test";
import { LABEL_FIELDS, normalizeLabelExtraction, eligibleLabelFields, applyLabelFields, mergeLabelExtractions } from "../src/lib/coffee/bean-label.ts";

function raw(fields = {}, bean_type = "single_origin") {
  return { bean_type, fields: Object.fromEntries(LABEL_FIELDS.map((key) => [key, fields[key] ?? { value: null, evidence: null }])) };
}

function extraction(fields, bean_type = "single_origin") {
  return normalizeLabelExtraction(raw(Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { value, evidence: `${key}: ${value}` }])), bean_type));
}

function form(overrides = {}) {
  return {
    name: "My coffee", roastery: "Original roastery", bean_type: "single_origin",
    origin_country: "Ethiopia", origin_country_id: 1,
    origin_region: "Sidama", origin_region_id: 2, origin_subregions: ["Bensa"],
    origin_lat: 6.8, origin_lng: 38.3, farm_producer: "Existing farm", origin_entity_id: 3,
    process_method: "washed", process_detail: "Existing process", roast_level: "medium",
    consumed_at: "2026-09-06", place_type: "cafe", cafe_name: "My cafe", cafe_location: "Seoul",
    menu_name: "Filter", overall_score: 7, note: "My tasting note", score_aroma: 4,
    tags: [{ tag: "peach", category: "fruity" }], price: 18000, weight_g: 200, purchased_at: "2026-09-01",
    ...overrides,
  };
}

test("normalization retains printed basic information and source quotes only", () => {
  const input = raw({
    name: { value: "  Ethiopia\nSidama  ", evidence: "ETHIOPIA SIDAMA" },
    process_method: { value: "natural", evidence: "Natural process" },
    weight_g: { value: 250, evidence: "NET WT 250g" },
    roast_date: { value: "2024-02-29", evidence: "Roasted 29 FEB 2024" },
  });
  input.fields.note = { value: "Peach", evidence: "Tasting notes: Peach" };
  input.fields.overall_score = { value: 10, evidence: "Cup score 90" };
  input.tags = [{ tag: "peach" }];
  const result = normalizeLabelExtraction(input);
  assert.deepEqual(result.fields, { name: "Ethiopia Sidama", process_method: "natural", roast_date: "2024-02-29", weight_g: 250 });
  assert.deepEqual(result.evidence, { name: "ETHIOPIA SIDAMA", process_method: "Natural process", roast_date: "Roasted 29 FEB 2024", weight_g: "NET WT 250g" });
});

test("missing quotes, placeholders, hidden controls, excessive text, and invalid enums are discarded", () => {
  const invalid = raw({
    name: { value: "Guess", evidence: "   " },
    roastery: { value: "Known roastery", evidence: null },
    origin_country: { value: "Ethiopia", evidence: "not visible" },
    origin_region: { value: "X".repeat(101), evidence: "A real quote" },
    farm_producer: { value: "Farm\u202eevil", evidence: "Farm" },
    varietal: { value: "Unknown", evidence: "Unknown" },
    process_method: { value: "honey-ish", evidence: "Honey-ish" },
    roast_level: { value: "medium_dark", evidence: "Medium dark" },
    process_detail: { value: "Fermented", evidence: "x".repeat(501) },
  });
  assert.deepEqual(normalizeLabelExtraction(invalid).fields, {});
  assert.deepEqual(normalizeLabelExtraction(invalid).evidence, {});
});

test("invalid calendar dates and weights never become form values", () => {
  for (const value of ["2026-02-29", "2026-04-31", "2026-13-01", "2026-00-20", "2026-01-00", "26-09-06", "2026-9-6", "2026-09-06T00:00:00Z", "0000-01-01", "9999-01-01"]) {
    assert.equal(normalizeLabelExtraction(raw({ roast_date: { value, evidence: value } })).fields.roast_date, undefined, value);
  }
  for (const value of [0, -1, 250.5, 100001, Infinity, NaN, "250", "250g"]) {
    assert.equal(normalizeLabelExtraction(raw({ weight_g: { value, evidence: "250g" } })).fields.weight_g, undefined, String(value));
  }
  for (const value of ["2026-09-06", "2000-02-29"]) assert.equal(extraction({ roast_date: value }).fields.roast_date, value);
});

test("malformed and inherited provider data produce no candidates", () => {
  for (const input of [null, undefined, [], 1, "{}", { fields: [] }, { fields: { name: "Coffee" } }]) {
    assert.deepEqual(normalizeLabelExtraction(input), { bean_type: "unknown", fields: {}, evidence: {} });
  }
  const fields = Object.create({ name: { value: "Inherited", evidence: "Inherited" } });
  assert.deepEqual(normalizeLabelExtraction({ bean_type: "invented", fields }), { bean_type: "unknown", fields: {}, evidence: {} });
});

test("only explicitly selected fields replace existing values while tasting and purchase data stay unchanged", () => {
  const current = Object.freeze(form());
  const candidate = extraction({ name: "Label name", roastery: "Label roastery", process_method: "natural", roast_level: "light", weight_g: 250 });
  const result = applyLabelFields(current, candidate, ["name", "process_method", "roast_level", "weight_g", "note", "overall_score", "tags"]);
  assert.deepEqual(result, { ...current, name: "Label name", process_method: "natural", process_detail: undefined, roast_level: "light", weight_g: 250 });
  assert.equal(current.name, "My coffee");
  assert.notEqual(result, current);
  assert.deepEqual(applyLabelFields(current, candidate, []), current);
});

test("changing the country invalidates stale geographic data even when children are unselected", () => {
  const current = form();
  const candidate = extraction({ origin_country: "Colombia", origin_region: "Huila", farm_producer: "El Paraiso" });
  const result = applyLabelFields(current, candidate, ["origin_country"]);
  assert.equal(result.origin_country, "Colombia");
  for (const key of ["origin_country_id", "origin_region", "origin_region_id", "origin_subregions", "origin_lat", "origin_lng", "farm_producer", "origin_entity_id"]) assert.equal(result[key], undefined, key);
  assert.equal(result.note, current.note);
  assert.equal(current.origin_region, "Sidama");
});

test("selected country, region and producer apply together without old IDs or coordinates", () => {
  const candidate = extraction({ origin_country: "Colombia", origin_region: "Huila", farm_producer: "El Paraiso" });
  const result = applyLabelFields(form(), candidate, ["farm_producer", "origin_region", "origin_country"]);
  assert.equal(result.origin_country, "Colombia");
  assert.equal(result.origin_region, "Huila");
  assert.equal(result.farm_producer, "El Paraiso");
  for (const key of ["origin_country_id", "origin_region_id", "origin_subregions", "origin_lat", "origin_lng", "origin_entity_id"]) assert.equal(result[key], undefined, key);
});

test("unselected conflicting country prevents its extracted region and producer from attaching", () => {
  const current = form();
  const candidate = extraction({ name: "Colombia Huila", origin_country: "Colombia", origin_region: "Huila", farm_producer: "El Paraiso" });
  assert.deepEqual(eligibleLabelFields(current, candidate, ["name", "origin_region", "farm_producer"]), ["name"]);
  assert.deepEqual(applyLabelFields(current, candidate, ["name", "origin_region", "farm_producer"]), { ...current, name: "Colombia Huila" });
});

test("a region needs a country, and a producer cannot use an unselected conflicting region", () => {
  const candidate = extraction({ origin_country: "Ethiopia", origin_region: "Yirgacheffe", farm_producer: "New farm" });
  assert.deepEqual(eligibleLabelFields(form({ origin_country: "" }), candidate, ["origin_region", "farm_producer"]), []);
  assert.deepEqual(eligibleLabelFields(form(), candidate, ["farm_producer"]), []);
  assert.deepEqual(eligibleLabelFields(form(), candidate, ["farm_producer", "origin_region"]), ["origin_region", "farm_producer"]);
  const result = applyLabelFields(form(), candidate, ["origin_region"]);
  assert.equal(result.origin_country_id, 1);
  assert.equal(result.origin_region, "Yirgacheffe");
  for (const key of ["origin_region_id", "origin_subregions", "origin_lat", "origin_lng", "farm_producer", "origin_entity_id"]) assert.equal(result[key], undefined, key);
});

test("changing country cannot preserve an unselected old region as the producer's parent", () => {
  const candidate = extraction({ origin_country: "Colombia", origin_region: "Sidama", farm_producer: "New farm" });
  assert.deepEqual(eligibleLabelFields(form(), candidate, ["origin_country", "farm_producer"]), ["origin_country"]);
  assert.equal(applyLabelFields(form(), candidate, ["origin_country", "farm_producer"]).farm_producer, undefined);
});

test("unchanged origin text preserves IDs, coordinates, and unselected child data", () => {
  const current = form();
  const candidate = extraction({ origin_country: "ETHIOPIA", origin_region: "Sidama", farm_producer: "Existing farm" });
  const result = applyLabelFields(current, candidate, ["origin_country", "origin_region", "farm_producer"]);
  assert.deepEqual(result, { ...current, origin_country: "ETHIOPIA" });
  const producer = applyLabelFields(current, extraction({ farm_producer: "Another farm" }), ["farm_producer"]);
  assert.deepEqual(producer, { ...current, farm_producer: "Another farm", origin_entity_id: undefined });
});

test("blend labels and current blends skip origin fields without changing type or composition", () => {
  for (const [current, candidate] of [
    [form(), extraction({ name: "House blend", origin_country: "Brazil", origin_region: "Cerrado", farm_producer: "Farm", varietal: "Bourbon" }, "blend")],
    [form({ bean_type: "blend", blend_components: [{ origin_country: "Brazil", percentage: 100 }] }), extraction({ name: "Coffee", origin_country: "Brazil", origin_region: "Cerrado", farm_producer: "Farm", varietal: "Bourbon" })],
  ]) {
    assert.deepEqual(eligibleLabelFields(current, candidate, [...LABEL_FIELDS]), ["name"]);
    assert.deepEqual(applyLabelFields(current, candidate, [...LABEL_FIELDS]), { ...current, name: candidate.fields.name });
  }
});

test("applying a tampered normalized response still rejects invalid or unsupported candidates", () => {
  const current = form();
  const candidate = { bean_type: "unknown", fields: { name: "Unsupported name", roast_date: "2026-02-29", weight_g: -5, overall_score: 10 }, evidence: { roast_date: "2026-02-29", weight_g: "-5", overall_score: "90 points" } };
  assert.deepEqual(eligibleLabelFields(current, candidate, [...LABEL_FIELDS, "overall_score"]), []);
  assert.deepEqual(applyLabelFields(current, candidate, [...LABEL_FIELDS, "overall_score"]), current);
});

test("processing details cannot contradict an unselected processing method", () => {
  const current = form({ process_method: "washed", process_detail: undefined });
  const candidate = extraction({ process_method: "natural", process_detail: "Natural, sun dried" });
  assert.deepEqual(eligibleLabelFields(current, candidate, ["process_detail"]), []);
  assert.deepEqual(applyLabelFields(current, candidate, ["process_detail"]), current);
  assert.deepEqual(eligibleLabelFields(current, candidate, ["process_method", "process_detail"]), ["process_method", "process_detail"]);
  assert.equal(applyLabelFields(current, candidate, ["process_method", "process_detail"]).process_detail, "Natural, sun dried");
  assert.deepEqual(eligibleLabelFields({ ...current, process_method: "natural" }, candidate, ["process_detail"]), ["process_detail"]);
});

test("replacing the processing method clears old details unless the new details are also selected", () => {
  const current = Object.freeze(form({ process_method: "washed", process_detail: "Washed, wet fermented 24h" }));
  const candidate = extraction({ process_method: "natural", process_detail: "Natural, sun dried" });

  const methodOnly = applyLabelFields(current, candidate, ["process_method"]);
  assert.equal(methodOnly.process_method, "natural");
  assert.equal(methodOnly.process_detail, undefined);
  assert.equal(current.process_detail, "Washed, wet fermented 24h");

  const methodAndDetail = applyLabelFields(current, candidate, ["process_method", "process_detail"]);
  assert.equal(methodAndDetail.process_method, "natural");
  assert.equal(methodAndDetail.process_detail, "Natural, sun dried");

  const unchangedMethod = applyLabelFields(current, extraction({ process_method: "washed" }), ["process_method"]);
  assert.equal(unchangedMethod.process_detail, current.process_detail);
});

test("printed blend composition keeps two lots from the same country and strips identifiers", () => {
  const components = [
    { origin_country: "Ethiopia", origin_region: "Gedeb", varietal: "74110, Kurume", process_method: "washed", percentage: 60, id: "untrusted", origin_country_id: 9 },
    { origin_country: "Ethiopia", farm_producer: "Bursa Main Station", varietal: "74158", process_method: "honey", process_detail: "White Honey", percentage: 40, user_id: "untrusted" },
  ];
  const result = normalizeLabelExtraction({ bean_type: "blend", fields: { blend_components: { value: components, evidence: "Ethiopia Gedeb 60% / Ethiopia Bursa Main Station 40%" } } });
  assert.equal(result.fields.blend_components.length, 2);
  assert.deepEqual(result.fields.blend_components.map(c => c.percentage), [60, 40]);
  for (const component of result.fields.blend_components) {
    assert.equal(component.id, undefined); assert.equal(component.user_id, undefined); assert.equal(component.origin_country_id, undefined);
  }
  const current = form();
  assert.deepEqual(applyLabelFields(current, result, []), current);
  const applied = applyLabelFields(current, result, ["blend_components"]);
  assert.equal(applied.bean_type, "blend");
  assert.deepEqual(applied.blend_components, result.fields.blend_components);
  for (const key of ["origin_country", "origin_country_id", "origin_region", "origin_region_id", "origin_subregions", "origin_lat", "origin_lng", "farm_producer", "origin_entity_id", "varietal"]) assert.deepEqual(applied[key], current[key], key);
  assert.equal(applied.note, current.note); assert.equal(applied.overall_score, current.overall_score);
});

test("incomplete, malformed and unsupported composition never changes the form", () => {
  for (const components of [
    [{ origin_country: "Ethiopia", percentage: 60 }],
    [{ origin_country: "Ethiopia", percentage: 60 }, { origin_country: "Brazil", percentage: 30 }],
    [{ origin_country: "Ethiopia", percentage: 60 }, { origin_country: "", percentage: 40 }],
    [{ origin_country: "Ethiopia", percentage: 60 }, { origin_country: "Brazil", percentage: "40" }],
    [{ origin_country: "Ethiopia", percentage: 100 }, { origin_country: "Brazil", percentage: 0 }],
    [{ origin_country: "Ethiopia", percentage: 33.333 }, { origin_country: "Brazil", percentage: 66.667 }],
  ]) {
    const candidate = { bean_type: "blend", fields: { blend_components: components }, evidence: { blend_components: "Printed composition" } };
    assert.deepEqual(applyLabelFields(form(), candidate, ["blend_components"]), form());
  }
  const fields = { blend_components: { value: [{ origin_country: "Ethiopia", percentage: 60 }, { origin_country: "Brazil", percentage: 40 }], evidence: "60 / 40" } };
  assert.equal(normalizeLabelExtraction({ bean_type: "unknown", fields }).fields.blend_components, undefined);
});

test("independent OCR views fill missing facts without duplicating lots or resolving conflicts by guessing", () => {
  const components = [{ origin_country: "Ethiopia", percentage: 60 }, { origin_country: "Ethiopia", percentage: 40 }];
  const full = extraction({ roastery: "Printed Brand", name: "House Blend", blend_components: components }, "blend");
  const detail = extraction({ name: "House Blend", blend_components: components, weight_g: 200 }, "blend");
  const result = mergeLabelExtractions([full, detail]);
  assert.equal(result.fields.roastery, "Printed Brand"); assert.equal(result.fields.weight_g, 200);
  assert.equal(result.fields.blend_components.length, 2);
  const reordered = mergeLabelExtractions([detail, extraction({ blend_components: [...components].reverse() }, "blend")]);
  assert.deepEqual(reordered.fields.blend_components.map(c => c.percentage), [60, 40]);
  const conflict = mergeLabelExtractions([full, extraction({ name: "Other Blend", weight_g: 250 }, "blend"), detail]);
  assert.equal(conflict.fields.name, undefined); assert.equal(conflict.fields.weight_g, undefined);
  assert.equal(conflict.fields.roastery, "Printed Brand");
});
