import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceRoot = path.join(root, "src");
const css = fs.readFileSync(path.join(sourceRoot, "app/globals.css"), "utf8");

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function stringLiterals(source) {
  return source.matchAll(
    /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`/gs
  );
}

function utilityName(token) {
  return token.slice(token.lastIndexOf(":") + 1);
}

function borderSides(axis) {
  switch (axis) {
    case "x":
      return new Set(["left", "right"]);
    case "y":
      return new Set(["top", "bottom"]);
    case "t":
      return new Set(["top"]);
    case "r":
      return new Set(["right"]);
    case "b":
      return new Set(["bottom"]);
    case "l":
      return new Set(["left"]);
    default:
      return new Set(["top", "right", "bottom", "left"]);
  }
}

function thickBorderSides(token) {
  const match = utilityName(token).match(
    /^border(?:-([xytrbl]))?-(?:(\d+(?:\.\d+)?)|\[(\d+(?:\.\d+)?)px\])$/
  );
  if (!match) return null;

  const width = Number(match[2] ?? match[3]);
  return width >= 2 ? borderSides(match[1]) : null;
}

function brownBorderSides(token) {
  const match = utilityName(token).match(/^border(?:-([xytrbl]))?-brown$/);
  return match ? borderSides(match[1]) : null;
}

function intersects(left, right) {
  return [...left].some((side) => right.has(side));
}

test("interface class lists do not combine thick rules with primary brown ink", () => {
  const violations = [];

  for (const file of walk(sourceRoot).filter((entry) => entry.endsWith(".tsx"))) {
    const source = fs.readFileSync(file, "utf8");

    for (const match of stringLiterals(source)) {
      const literal = match[1] ?? match[2] ?? match[3] ?? "";
      const tokens = literal.split(/\s+/).filter(Boolean);
      const thick = tokens.flatMap((token) => {
        const sides = thickBorderSides(token);
        return sides ? [{ token, sides }] : [];
      });
      const brown = tokens.flatMap((token) => {
        const sides = brownBorderSides(token);
        return sides ? [{ token, sides }] : [];
      });

      for (const thickRule of thick) {
        for (const brownRule of brown) {
          if (!intersects(thickRule.sides, brownRule.sides)) continue;
          const line = source.slice(0, match.index).split("\n").length;
          violations.push(
            `${path.relative(root, file)}:${line} (${thickRule.token} + ${brownRule.token})`
          );
        }
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Thick structural rules must use quiet border tokens:\n${violations.join("\n")}`
  );
});

test("shared CSS primitives do not draw thick primary-brown borders or bars", () => {
  const thickBrownBorders = [...css.matchAll(
    /border(?:-(?:top|right|bottom|left))?\s*:\s*(\d+(?:\.\d+)?)px\s+solid\s+var\(--color-brown\)/gi
  )].filter((match) => Number(match[1]) >= 2);

  assert.deepEqual(
    thickBrownBorders.map((match) => match[0]),
    [],
    "CSS primitives must not reintroduce a 2px-or-thicker primary-brown border"
  );

  const pageRule = css.match(/\.page-rule\s*\{([^}]*)\}/s)?.[1] ?? "";
  const barHeight = Number(pageRule.match(/\bheight\s*:\s*(\d+(?:\.\d+)?)px/i)?.[1] ?? 0);
  const isBrownBar = /\bbackground(?:-color)?\s*:\s*var\(--color-brown\)/i.test(pageRule);
  assert.ok(
    !isBrownBar || barHeight < 2,
    ".page-rule must not render a thick primary-brown bar"
  );
});

test("interface class lists do not recreate borders with hard offset shadows", () => {
  const violations = [];

  for (const file of walk(sourceRoot).filter((entry) => entry.endsWith(".tsx"))) {
    const source = fs.readFileSync(file, "utf8");

    for (const match of source.matchAll(/shadow-\[(\d+(?:\.\d+)?)px_\1px_0_[^\]]+\]/g)) {
      if (Number(match[1]) < 2) continue;
      const line = source.slice(0, match.index).split("\n").length;
      violations.push(`${path.relative(root, file)}:${line} (${match[0]})`);
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Hard offset shadows read as heavy borders and must stay out of the interface:\n${violations.join("\n")}`
  );
});
