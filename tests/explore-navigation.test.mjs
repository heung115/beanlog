import assert from "node:assert/strict";
import test from "node:test";
import { beanDetailHref, exploreHref, parseExploreQuery, resolveExploreReturnPath } from "../src/lib/coffee/explore-navigation.ts";

test("journal URLs round-trip supported controls and the number of loaded pages", () => {
  const state = parseExploreQuery(new URLSearchParams("search=커피&origin_country=Ethiopia&roastery=A+B&process_method=washed&varietal=Heirloom&bean_type=single_origin&roast_level=light&sort=name&page=3"));
  assert.equal(state.page, 2);
  assert.equal(state.filters.sort_order, "asc");
  const url = new URL(exploreHref("en", state), "http://localhost");
  assert.deepEqual(parseExploreQuery(url.searchParams), state);
});

test("unsupported and excessive URL inputs cannot break record loading", () => {
  const state = parseExploreQuery(new URLSearchParams({ search: "x".repeat(300), sort: "DROP", page: "-1", process_method: "anything", roast_level: "nope" }));
  assert.equal(state.filters.search.length, 100);
  assert.equal(state.filters.sort_by, "consumed_at");
  assert.equal(state.filters.process_method, undefined);
  assert.equal(state.page, 0);
});

test("a saved Korean varietal filter restores the canonical choice after a language switch", () => {
  assert.equal(parseExploreQuery(new URLSearchParams("varietal=게이샤")).filters.varietal, "Geisha");
});

test("record return links only target a canonical journal in the current language", () => {
  const id = "1ff7068e-13b6-4444-aaaa-e58813156d35";
  const returnTo = `/en/explore?search=coffee&sort=name&page=2&untrusted=1#bean-${id}`;
  const expected = `/en/explore?search=coffee&sort=name&page=2#bean-${id}`;
  assert.equal(resolveExploreReturnPath(returnTo, "en"), expected);
  assert.equal(new URL(beanDetailHref(id, "en", returnTo, true), "http://localhost").searchParams.get("returnTo"), expected);
  for (const value of ["https://evil.test", "//evil.test", "/ko/explore?search=coffee", "/en/explore/../settings", "/en/explore?search=x\\y", "/en/beans/new", null]) {
    assert.equal(resolveExploreReturnPath(value, "en"), "/en/explore");
  }
});
