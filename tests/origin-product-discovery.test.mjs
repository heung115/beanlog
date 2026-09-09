import assert from "node:assert/strict";
import test from "node:test";
import { originRegionGuides } from "../src/data/origin-guides/index.ts";
import { productOriginLinks } from "../src/data/origin-guides/product-origin-links.ts";
import { productOriginSearchTerms } from "../src/data/origin-guides/product-search.ts";

test("product names resolve only to published regions with independent geographic evidence", () => {
  const ids = new Set(originRegionGuides.map((guide) => guide.id));
  const seen = new Set();
  for (const link of productOriginLinks) {
    assert.ok(ids.has(link.regionId), link.regionId);
    assert.ok(link.originalName.trim());
    assert.ok(link.productNumbers.length && link.discoveryUrls.length && link.verificationUrls.length);
    const key = `${link.regionId}|${link.originalName}`;
    assert.ok(!seen.has(key), key);
    seen.add(key);
    for (const url of [...link.discoveryUrls, ...link.verificationUrls]) {
      assert.equal(new URL(url).protocol, "https:");
    }
  }
});

test("Korean offering names find the verified place without becoming geographic aliases", () => {
  assert.ok(productOriginSearchTerms("peru-chirinos").some((name) => name.includes("에프라인") && name.includes("엘 세로")));
  assert.ok(productOriginSearchTerms("ethiopia-chelbesa").some((name) => name.includes("스냅 첼베사")));
  assert.ok(!productOriginSearchTerms("ethiopia-bursa-arbegona").some((name) => name.includes("차리초")));
  assert.ok(!productOriginSearchTerms("vietnam-lac-duong").some((name) => name.includes("#26")));
  assert.ok(!productOriginLinks.some((link) => link.productNumbers.includes(811) && /#(?:15|20|56)\s/.test(link.originalName)));
  assert.ok(!productOriginLinks.some((link) => link.productNumbers.some((number) => [286, 341].includes(number)) && /마리아스.*핑크\s?버번/.test(link.originalName)));
  assert.ok(productOriginSearchTerms("colombia-esmeralda-piendamo").some((name) => name.includes("산타 마르타") && name.includes("카스티요")));
  assert.ok(productOriginSearchTerms("colombia-el-manzanillo").some((name) => name.includes("모나르카") && name.includes("파파요")));
  assert.deepEqual(productOriginSearchTerms("unknown-region"), []);
});
