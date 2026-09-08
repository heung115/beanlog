import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import {
  assertImageRuntimeVersions,
  verifyImageRuntime,
} from "../scripts/verify-image-runtime.mjs";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const { imageOptimizer } = require("next/dist/server/image-optimizer");
const raw = Buffer.from(Array.from({ length: 8 * 8 * 3 }, (_, index) => (index * 37) % 256));
const createImage = () => sharp(raw, { raw: { width: 8, height: 8, channels: 3 } });

test("installed Next uses patched Sharp and native libheif", () => {
  verifyImageRuntime();
});

test("build gate rejects vulnerable, missing, and prerelease native libraries", () => {
  const safe = verifyImageRuntime();
  for (const versions of [
    { ...safe, next: "16.2.11" },
    { ...safe, sharp: "0.35.3" },
    { ...safe, heif: "1.23.1" },
    { ...safe, heif: undefined },
    { ...safe, heif: "1.23.2-rc.1" },
  ]) {
    assert.throws(() => assertImageRuntimeVersions(versions), /Unsafe image runtime/);
  }
});

for (const inputFormat of ["png", "jpeg", "webp"]) {
  test(`patched native runtime decodes ${inputFormat} and produces PNG, JPEG, WebP`, async () => {
    verifyImageRuntime();
    const input = await createImage().toFormat(inputFormat).toBuffer();
    for (const outputFormat of ["png", "jpeg", "webp"]) {
      const output = await sharp(input).resize(4, 4).toFormat(outputFormat).toBuffer();
      const metadata = await sharp(output).metadata();
      assert.equal(metadata.format, outputFormat);
      assert.equal(metadata.width, 4);
      assert.equal(metadata.height, 4);
      assert.ok(output.length > 0);
    }
  });
}

test("normal AVIF decodes with patched libheif, while Next bypasses AVIF optimization", async () => {
  verifyImageRuntime();
  // Generate a tiny ordinary image; never load a malicious advisory payload.
  const avif = await createImage().avif().toBuffer();
  const png = await sharp(avif).png().toBuffer();
  assert.equal((await sharp(png).metadata()).width, 8);

  const result = await imageOptimizer(
    { buffer: avif, contentType: "image/avif", cacheControl: "max-age=60", etag: "safe-avif-fixture" },
    { href: "/safe-fixture.avif", width: 4, quality: 75, mimeType: "image/webp" },
    { images: { dangerouslyAllowSVG: false, minimumCacheTTL: 60 }, experimental: {} },
    { silent: true },
  );
  // Patched Next preserves AVIF bytes instead of decoding/resizing them even
  // when the requested output type and width would normally require a transform.
  assert.strictEqual(result.buffer, avif);
  assert.equal(result.contentType, "image/avif");
  assert.equal(result.etag, "safe-avif-fixture");
});
