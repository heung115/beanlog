import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync(
  new URL("../src/app/globals.css", import.meta.url),
  "utf8"
);

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

test("Korean keeps SUIT while English display restores the legacy serif stack", () => {
  const theme = css.match(/@theme\s*\{([^}]*)\}/s)?.[1] ?? "";
  assert.match(theme, /--font-display\s*:\s*var\(--font-suit\)/);
  assert.match(theme, /--font-body\s*:\s*var\(--font-suit\)/);

  const english = css.match(/html\[lang=["']en["']\]\s*\{([^}]*)\}/s)?.[1];
  assert.ok(english, "globals.css should define an English typography override");

  const displayStack = english.match(/--font-display\s*:\s*([^;]+);/)?.[1] ?? "";
  const iowan = displayStack.indexOf("Iowan Old Style");
  const georgia = displayStack.indexOf("Georgia");
  const suitFallback = displayStack.indexOf("var(--font-suit)");

  assert.ok(iowan >= 0, "English display should prefer Iowan Old Style");
  assert.ok(georgia > iowan, "Georgia should follow Iowan Old Style");
  assert.ok(suitFallback > georgia, "self-hosted SUIT should remain the final readable fallback");

  const clientNavigationOverride = css.match(
    /\[data-locale=["']en["']\]\s*\{([^}]*)\}/s
  )?.[1];
  assert.ok(
    clientNavigationOverride?.includes(displayStack.trim()),
    "client-side locale switches should apply the same English display stack"
  );
});
