import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const {
  getAppPathname,
  isNavigationItemActive,
  navigationAriaCurrent,
  primaryNavigationHrefs,
} = await import("../src/components/layout/navigation-state.ts");

function activeHrefs(pathname) {
  const appPathname = getAppPathname(pathname);
  return primaryNavigationHrefs.filter((href) =>
    isNavigationItemActive(appPathname, href)
  );
}

test("localized routes resolve to one coherent primary navigation item", () => {
  const cases = [
    ["/ko/explore", "/explore"],
    ["/en/explore/", "/explore"],
    ["/ko/beans/2ff7068e", "/explore"],
    ["/en/beans/2ff7068e/edit", "/explore"],
    ["/ko/beans/new", "/beans/new"],
    ["/en/beans/new/", "/beans/new"],
    ["/ko/origins", "/origins"],
    ["/en/origins/papua-new-guinea", "/origins"],
    ["/ko/stats", "/stats"],
    ["/en/settings/profile", "/settings"],
  ];

  for (const [pathname, expected] of cases) {
    assert.deepEqual(activeHrefs(pathname), [expected], pathname);
  }
});

test("supporting routes do not claim a primary navigation item", () => {
  for (const pathname of ["/ko", "/en/login", "/ko/privacy", "/ko/terms"]) {
    assert.deepEqual(activeHrefs(pathname), [], pathname);
  }
});

test("aria-current follows the shared route matcher", () => {
  const beanDetailPath = getAppPathname("/ko/beans/record-id/edit");

  assert.equal(navigationAriaCurrent(beanDetailPath, "/explore"), "page");
  assert.equal(navigationAriaCurrent(beanDetailPath, "/beans/new"), undefined);

  for (const component of ["top-bar.tsx", "bottom-nav.tsx"]) {
    const source = fs.readFileSync(
      new URL(`../src/components/layout/${component}`, import.meta.url),
      "utf8"
    );

    assert.match(source, /aria-current=\{navigationAriaCurrent\(appPathname, href\)\}/);
    assert.doesNotMatch(
      source,
      /appPathname === href \|\| appPathname\.startsWith\(href \+ "\/"\)/
    );
  }
});
