import assert from "node:assert/strict";
import test from "node:test";
import { isMissingOriginPath } from "../src/lib/coffee/origin-route.ts";
import { originPresets, originSlug } from "../src/data/origin-presets.ts";
import { originRegionGuides, regionGuidePath } from "../src/data/origin-guides/index.ts";

test("every published origin retains its successful route in both languages", () => {
  for (const locale of ["ko", "en"]) {
    for (const preset of originPresets) {
      const path = `/${locale}/origins/${originSlug(preset.country)}`;
      assert.equal(isMissingOriginPath(path), false, path);
      assert.equal(isMissingOriginPath(`${path}/`), false, path);
    }
    assert.equal(isMissingOriginPath(`/${locale}/origins/%65thiopia`), false);
  }
});

test("unknown or malformed matched origin slugs receive 404, including dotted names", () => {
  for (const locale of ["ko", "en"]) {
    for (const slug of ["not-a-country", "not.a.country", "Ethiopia", "ethiopia%2Fedit", "%E0%A4%A"]) {
      assert.equal(isMissingOriginPath(`/${locale}/origins/${slug}`), true, slug);
    }
  }
});

test("origin status handling does not alter index, unrelated or unmatched route families", () => {
  for (const path of ["/ko/origins", "/en/origins/", "/ko/explore", "/en/login", "/api/health", "/_next/static/file.js", "/fr/origins/ethiopia"]) {
    assert.equal(isMissingOriginPath(path), false, path);
  }
});

test("every region and microregion resolves only inside its own country", () => {
  for (const guide of originRegionGuides) {
    for (const locale of ["ko", "en"]) {
      const path = `/${locale}${regionGuidePath(guide)}`;
      assert.equal(isMissingOriginPath(path), false, path);
      assert.equal(isMissingOriginPath(`${path}/`), false, path);
    }
  }
  for (const path of ["/ko/origins/ethiopia/details", "/en/origins/kenya/yirgacheffe", "/ko/origins/ethiopia/%E0%A4%A", "/en/origins/ethiopia/yirgacheffe%2Fedit"]) {
    assert.equal(isMissingOriginPath(path), true, path);
  }
});
