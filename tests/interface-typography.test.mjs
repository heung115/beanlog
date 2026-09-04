import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const uprightInterfaceFiles = [
  "src/app/not-found.tsx",
  "src/app/[locale]/explore/explore-client.tsx",
  "src/app/[locale]/origins/page.tsx",
  "src/app/[locale]/origins/[country]/page.tsx",
  "src/app/[locale]/stats/page.tsx",
  "src/components/beans/bean-form.tsx",
  "src/components/beans/guest-record-form.tsx",
  "src/components/landing/landing-page.tsx",
  "src/components/ui/score-display.tsx",
];

test("repeated interface data and step numbers use upright typography", () => {
  for (const relativePath of uprightInterfaceFiles) {
    const source = fs.readFileSync(
      new URL(`../${relativePath}`, import.meta.url),
      "utf8"
    );
    assert.doesNotMatch(
      source,
      /\bitalic\b/,
      `${relativePath} should reserve italics for isolated editorial moments`
    );
  }
});
