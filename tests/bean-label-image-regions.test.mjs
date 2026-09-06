import assert from "node:assert/strict";
import test from "node:test";
import { detectLabelTextRegion } from "../src/lib/coffee/bean-label-image-regions.ts";

function picture(width = 640, height = 800) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      // A smooth illumination gradient exercises local, rather than global, thresholding.
      data[offset] = data[offset + 1] = data[offset + 2] = 150 + Math.floor(x / width * 50);
      data[offset + 3] = 255;
    }
  }
  return { width, height, data };
}

function rectangle(image, x, y, width, height, value = 75) {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      const offset = (row * image.width + column) * 4;
      image.data[offset] = image.data[offset + 1] = image.data[offset + 2] = value;
    }
  }
}

function textRow(image, x, y, count = 30, size = 1) {
  for (let character = 0; character < count; character += 1) {
    const left = x + character * 12 * size;
    // Connected, hollow shapes stand in for glyph geometry without depending on a font.
    rectangle(image, left, y, 8 * size, 14 * size);
    rectangle(image, left + 2 * size, y + 2 * size, 4 * size, 10 * size, 185);
  }
}

function textBlock(image, x = 120, y = 400) {
  for (let line = 0; line < 3; line += 1) textRow(image, x, y + line * 34);
}

test("locates a compact multi-line block under uneven lighting with room around all glyphs", () => {
  const image = picture();
  textBlock(image);
  const region = detectLabelTextRegion(image);
  assert.ok(region);
  assert.ok(region.x < 120 && region.y < 400);
  assert.ok(region.x + region.width > 476 && region.y + region.height > 482);
  assert.ok(region.width < image.width * 0.75 && region.height < image.height * 0.25);
});

test("ignores large decorative shapes when finding the smaller text block", () => {
  const image = picture();
  textBlock(image);
  const expected = detectLabelTextRegion(image);
  rectangle(image, 65, 60, 510, 260);
  rectangle(image, 75, 70, 490, 240, 165);
  rectangle(image, 130, 135, 80, 110);
  rectangle(image, 270, 135, 80, 110);
  rectangle(image, 410, 135, 80, 110);
  assert.deepEqual(detectLabelTextRegion(image), expected);
});

test("does not crop photographs covered by text", () => {
  const image = picture();
  for (let y = 30; y < 760; y += 34) textRow(image, 45, y, 45);
  assert.equal(detectLabelTextRegion(image), null);
});

test("keeps a large nine-line label on the full-image path despite blank space below", () => {
  const image = picture();
  // The text spans about 54% of the image height, like a roomy text-only label.
  for (let line = 0; line < 9; line += 1) textRow(image, 100, 60 + line * 50, 16, 2);
  assert.equal(detectLabelTextRegion(image), null);
});

test("does not choose between separate text blocks of similar strength", () => {
  const image = picture();
  textBlock(image, 120, 90);
  textBlock(image, 120, 550);
  assert.equal(detectLabelTextRegion(image), null);
});

test("returns no region for a blank image, a single text row, tiny fixtures, or invalid data", () => {
  assert.equal(detectLabelTextRegion(picture()), null);
  const singleLine = picture();
  textRow(singleLine, 120, 400);
  assert.equal(detectLabelTextRegion(singleLine), null);
  assert.equal(detectLabelTextRegion(picture(1, 1)), null);
  assert.equal(detectLabelTextRegion({ width: 640, height: 800, data: new Uint8ClampedArray(4) }), null);
});

test("is deterministic and leaves source pixels untouched", () => {
  const image = picture();
  textBlock(image);
  const original = image.data.slice();
  const first = detectLabelTextRegion(image);
  assert.ok(first);
  assert.deepEqual(detectLabelTextRegion(image), first);
  assert.deepEqual(image.data, original);
});
