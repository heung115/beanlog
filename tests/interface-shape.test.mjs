import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync(
  new URL("../src/app/globals.css", import.meta.url),
  "utf8"
);
const design = fs.readFileSync(new URL("../DESIGN.md", import.meta.url), "utf8");

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cssBlock(selector) {
  const match = css.match(
    new RegExp(`(?:^|\\n)${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`, "s")
  );
  assert.ok(match, `Missing CSS block for ${selector}`);
  return match[1];
}

function lengthToPixels(value) {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)(px|rem)$/);
  assert.ok(match, `Expected a px or rem length, received ${value}`);
  return Number(match[1]) * (match[2] === "rem" ? 16 : 1);
}

function cssRadius(name) {
  const value = css.match(
    new RegExp(`--radius-${escapeRegExp(name)}\\s*:\\s*([^;]+);`)
  )?.[1];
  assert.ok(value, `Missing --radius-${name} in globals.css`);
  return lengthToPixels(value);
}

function designRadius(name) {
  const roundedBlock = design.match(/^rounded:\s*\n([\s\S]*?)^components:/m)?.[1];
  assert.ok(roundedBlock, "Missing rounded tokens in DESIGN.md");
  const value = roundedBlock.match(
    new RegExp(`^\\s{2}${escapeRegExp(name)}:\\s*([^\\s#]+)`, "m")
  )?.[1];
  assert.ok(value, `Missing rounded.${name} in DESIGN.md`);
  return lengthToPixels(value);
}

function borderDeclarations(block) {
  return [...block.matchAll(
    /(?:^|;)\s*(border(?:-(?:top|right|bottom|left))?)\s*:\s*([^;]+)/g
  )].map((match) => ({ property: match[1], value: match[2].trim() }));
}

test("corner tokens form a subtle hierarchy and stay synchronized with DESIGN.md", () => {
  const names = ["sm", "md", "lg"];
  const cssRadii = Object.fromEntries(names.map((name) => [name, cssRadius(name)]));
  const designRadii = Object.fromEntries(
    names.map((name) => [name, designRadius(name)])
  );

  assert.deepEqual(cssRadii, designRadii, "CSS and DESIGN.md radius tokens must match");
  assert.ok(cssRadii.sm > 0, "The compact radius must remain visible");
  assert.ok(cssRadii.sm < cssRadii.md, "Compact elements must be tighter than controls");
  assert.ok(cssRadii.md < cssRadii.lg, "Controls must be tighter than content panels");
  assert.ok(cssRadii.lg <= 8, "Content panels must not exceed the subtle 8px radius cap");
});

test("shared journal surfaces never use a dark outline", () => {
  for (const selector of [
    ".journal-panel",
    ".journal-panel-feature",
    ".journal-panel-quiet",
    ".paper-sheet",
    ".paper-sheet.paper-sheet-feature",
  ]) {
    for (const { property, value } of borderDeclarations(cssBlock(selector))) {
      assert.doesNotMatch(
        value,
        /var\(--color-(?:brown|brown-medium|border)\)/,
        `${selector} ${property} must not use a dark outline`
      );
      if (!/^(?:0|none)$/.test(value)) {
        assert.match(
          value,
          /^1px\s+solid\s+var\(--color-border-light\)$/,
          `${selector} ${property} may only use a quiet one-pixel outline`
        );
      }
    }
  }
});

test("ordinary journal panels are borderless and do not imitate elevated cards", () => {
  const panel = cssBlock(".journal-panel");
  const visibleBorders = borderDeclarations(panel).filter(
    ({ value }) => !/^(?:0|none)$/.test(value)
  );

  assert.deepEqual(visibleBorders, [], ".journal-panel must remain borderless");
  assert.doesNotMatch(panel, /\bbox-shadow\s*:/, ".journal-panel must remain flat");
  assert.match(
    panel,
    /border-radius\s*:\s*var\(--radius-lg\)/,
    ".journal-panel must use the content-panel radius"
  );
});

test("shared form fields use the quiet control shape", () => {
  for (const relativePath of [
    "../src/components/ui/input.tsx",
    "../src/components/ui/select.tsx",
    "../src/components/ui/textarea.tsx",
    "../src/components/ui/combobox.tsx",
  ]) {
    const source = fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.match(source, /rounded-md border border-border-light/);
    assert.doesNotMatch(source, /rounded-sm border border-border(?:\s|\")/);
  }
});
