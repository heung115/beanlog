import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const tokens = JSON.parse(fs.readFileSync(path.join(root, "src/config/design-tokens.json"), "utf8"));
const css = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
const design = fs.readFileSync(path.join(root, "DESIGN.md"), "utf8");
const failures = [];

// CSS keeps the established implementation names while DESIGN.md exposes
// semantic roles. Keep that compatibility boundary explicit and testable.
const designColorAliases = {
  cream: "neutral",
  "cream-dark": "neutral-strong",
  brown: "primary",
  "brown-light": "secondary",
  "brown-medium": "primary-soft",
  "accent-light": "accent-soft",
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

for (const sourceName of Object.keys(designColorAliases)) {
  if (!(sourceName in tokens.colors)) {
    failures.push(`design color alias references unknown JSON token: ${sourceName}`);
  }
}

for (const [name, value] of Object.entries(tokens.colors)) {
  const cssPattern = new RegExp(`--color-${escapeRegExp(name)}\\s*:\\s*${escapeRegExp(value)}`, "i");
  if (!cssPattern.test(css)) failures.push(`globals.css is missing --color-${name}: ${value}`);

  const designName = designColorAliases[name] ?? name;
  const designPattern = new RegExp(`^\\s*${escapeRegExp(designName)}:\\s*["']?${escapeRegExp(value)}["']?`, "im");
  if (!designPattern.test(design)) failures.push(`DESIGN.md is missing ${designName}: ${value}`);
}

for (const [theme, colors] of Object.entries(tokens.themeOverrides ?? {})) {
  const selectorPattern = new RegExp(`html\\[data-beanmap-theme=["']${escapeRegExp(theme)}["']\\]`, "i");
  if (!selectorPattern.test(css)) failures.push(`globals.css is missing the ${theme} theme selector`);

  for (const [name, value] of Object.entries(colors)) {
    const cssPattern = new RegExp(`--color-${escapeRegExp(name)}\\s*:\\s*${escapeRegExp(value)}`, "i");
    if (!cssPattern.test(css)) failures.push(`globals.css is missing ${theme} --color-${name}: ${value}`);
  }
}

const sourceRoot = path.join(root, "src");
const allowedRawColorFiles = new Map([
  ["app/globals.css", "generated design-token declarations and color-mix recipes"],
  ["app/[locale]/login/page.tsx", "official Google and Kakao brand colors"],
  ["app/[locale]/signup/page.tsx", "official Google and Kakao brand colors"],
]);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

for (const file of walk(sourceRoot).filter((file) => /\.(?:css|ts|tsx)$/.test(file))) {
  const relative = path.relative(sourceRoot, file);
  if (allowedRawColorFiles.has(relative)) continue;
  const contents = fs.readFileSync(file, "utf8");
  const matches = [...contents.matchAll(/#[0-9a-f]{3,8}\b|rgba?\s*\(/gi)];
  if (matches.length) failures.push(`${relative} contains raw colors: ${[...new Set(matches.map((m) => m[0]))].join(", ")}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Verified ${Object.keys(tokens.colors).length} design colors and raw-color policy.`);
