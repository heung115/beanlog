#!/usr/bin/env node

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const minimumVersions = { next: "16.3.3", sharp: "0.35.4", heif: "1.23.2" };

function stableVersionAtLeast(actual, minimum) {
  if (typeof actual !== "string" || !/^\d+\.\d+\.\d+$/.test(actual)) return false;
  const parts = actual.split(".").map(Number);
  const floor = minimum.split(".").map(Number);
  for (let index = 0; index < 3; index++) {
    if (parts[index] !== floor[index]) return parts[index] > floor[index];
  }
  return true;
}

export function assertImageRuntimeVersions(versions) {
  for (const [name, minimum] of Object.entries(minimumVersions)) {
    assert.ok(
      stableVersionAtLeast(versions[name], minimum),
      `Unsafe image runtime: ${name} ${versions[name] ?? "missing"}; require stable ${minimum} or newer`,
    );
  }
  return versions;
}

export function verifyImageRuntime() {
  // Resolve the native dependency from Next's location, including standalone
  // layouts, rather than trusting package.json overrides or lock-file labels.
  const nextPath = require.resolve("next/package.json");
  const nextRequire = createRequire(nextPath);
  const sharp = nextRequire("sharp");
  return assertImageRuntimeVersions({
    next: nextRequire("./package.json").version,
    sharp: sharp.versions.sharp,
    heif: sharp.versions.heif,
    vips: sharp.versions.vips,
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const versions = verifyImageRuntime();
  console.log(`Image runtime verified: Next ${versions.next}, Sharp ${versions.sharp}, libheif ${versions.heif}, libvips ${versions.vips}`);
}
