import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const en = JSON.parse(
  fs.readFileSync(new URL("../src/i18n/en.json", import.meta.url), "utf8")
);
const ko = JSON.parse(
  fs.readFileSync(new URL("../src/i18n/ko.json", import.meta.url), "utf8")
);

function messageShape(value, prefix = "") {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === "object" && child !== null
      ? messageShape(child, path)
      : `${path}:${typeof child}`;
  });
}

test("English and Korean message catalogs have the same structure", () => {
  assert.deepEqual(messageShape(en).sort(), messageShape(ko).sort());
});

test("tag removal and public language navigation are localized", () => {
  assert.equal(en.beans.removeTag, "Remove {tag}");
  assert.equal(ko.beans.removeTag, "{tag} 태그 제거");

  for (const catalog of [en, ko]) {
    assert.equal(typeof catalog.nav.publicNavigation, "string");
    assert.equal(typeof catalog.nav.language, "string");
    assert.equal(typeof catalog.nav.switchToKorean, "string");
    assert.equal(typeof catalog.nav.switchToEnglish, "string");
  }
});

test("next-intl defers alternate metadata links to the page metadata", () => {
  const routing = fs.readFileSync(
    new URL("../src/i18n/routing.ts", import.meta.url),
    "utf8"
  );
  assert.match(routing, /alternateLinks:\s*false/);
});

test("the locale switch uses crawlable, language-annotated links", () => {
  const localeSwitcher = fs.readFileSync(
    new URL(
      "../src/components/layout/locale-switcher.tsx",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(localeSwitcher, /<Link/);
  assert.match(localeSwitcher, /hrefLang=\{locale\}/);
  assert.match(localeSwitcher, /lang=\{locale\}/);
  assert.match(localeSwitcher, /aria-label=\{labels\[locale\]\}/);
  assert.match(localeSwitcher, /pathWithoutLocale === "\/" \? ""/);
});
