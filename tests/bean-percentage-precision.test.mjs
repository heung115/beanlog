import assert from "node:assert/strict";
import test from "node:test";
import { beanFormSchema } from "../src/lib/validation/beans.ts";

const base = {
  name: "Precision test", roastery: "QA", bean_type: "blend", process_method: "washed",
  roast_level: "medium", consumed_at: "2026-09-06", place_type: "home", overall_score: 7,
  note: "Preserve the entered ratio", tags: [],
};
const blend = (left, right) => ({ ...base, blend_components: [
  { origin_country: "Brazil", percentage: left },
  { origin_country: "Colombia", percentage: right },
] });

test("blend ratios that fit database precision accept valid decimal inputs", () => {
  for (const [left, right] of [[33.3, 66.7], [33.33, 66.67], [0.01, 99.99], [1, 99]]) {
    assert.equal(beanFormSchema.safeParse(blend(left, right)).success, true, `${left} / ${right}`);
  }
});

test("a 100% blend is rejected before storage would silently round its components", () => {
  const parsed = beanFormSchema.safeParse(blend(33.333, 66.667));
  assert.equal(parsed.success, false);
  assert.ok(parsed.error.issues.some((issue) => issue.code === "not_multiple_of"
    && issue.path.join(".") === "blend_components.0.percentage"));
});
