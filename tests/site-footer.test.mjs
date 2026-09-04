import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const footer = fs.readFileSync(
  new URL("../src/components/layout/site-footer.tsx", import.meta.url),
  "utf8"
);
const landing = fs.readFileSync(
  new URL("../src/app/page.tsx", import.meta.url),
  "utf8"
);
const landingComponent = fs.readFileSync(
  new URL("../src/components/landing/landing-page.tsx", import.meta.url),
  "utf8"
);
const localeLayout = fs.readFileSync(
  new URL("../src/app/[locale]/layout.tsx", import.meta.url),
  "utf8"
);

test("the shared footer exposes legal pages and the configured contact", () => {
  assert.match(footer, /\$\{locale\}\/terms/);
  assert.match(footer, /\$\{locale\}\/privacy/);
  assert.match(footer, /mailto:\$\{legal\.contactEmail\}/);
  assert.match(footer, /이용약관/);
  assert.match(footer, /개인정보 처리방침/);
  assert.match(footer, /Terms of Service/);
  assert.match(footer, /Privacy Policy/);
});

test("the shared footer links to each localized home and origin guide", () => {
  assert.ok(footer.includes('href={`/${locale}`}'));
  assert.ok(footer.includes('href={`/${locale}/origins`}'));
  assert.match(footer, /홈/);
  assert.match(footer, /커피 산지/);
  assert.match(footer, /Home/);
  assert.match(footer, /Coffee origins/);
});

test("the shared footer keeps a quiet page boundary", () => {
  assert.match(
    footer,
    /<footer className="border-t border-border-light bg-surface/
  );
  assert.doesNotMatch(footer, /<footer className="[^"]*\bborder-t-2\b/);
  assert.doesNotMatch(footer, /<footer className="[^"]*\bborder-brown\b/);
});

test("the landing and localized app layouts use the shared footer", () => {
  assert.match(landing, /<LandingPage locale="ko" \/>/);
  assert.match(landingComponent, /<SiteFooter locale=\{locale\} wide \/>/);
  assert.match(localeLayout, /<SiteFooter/);
  assert.match(localeLayout, /locale=\{locale as "ko" \| "en"\}/);
});
