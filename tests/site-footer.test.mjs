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

test("the landing and localized app layouts use the shared footer", () => {
  assert.match(landing, /<SiteFooter locale="ko" wide \/>/);
  assert.match(localeLayout, /<SiteFooter/);
  assert.match(localeLayout, /locale=\{locale as "ko" \| "en"\}/);
});
