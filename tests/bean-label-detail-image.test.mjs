import assert from "node:assert/strict";
import test from "node:test";
import { findLabelForegroundPanel, prepareLabelDetailRetries, stretchLabelContrast } from "../src/lib/coffee/bean-label-detail-image.ts";

function picture(width = 200, height = 200) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  return { width, height, data };
}
function fill(image, x, y, width, height, color = [25, 95, 60, 255]) {
  for (let row = y; row < y + height; row++) for (let column = x; column < x + width; column++) image.data.set(color, (row * image.width + column) * 4);
}

test("selects a small colored panel and ignores a detached advertising heading", () => {
  const image = picture();
  fill(image, 60, 105, 90, 55);
  for (let x = 8; x < 75; x += 10) fill(image, x, 10, 5, 8, [0, 0, 0, 255]);
  const original = image.data.slice();
  const region = findLabelForegroundPanel(image);
  assert.ok(region);
  assert.ok(region.x < 60 && region.y < 105);
  assert.ok(region.x + region.width > 150 && region.y + region.height > 160);
  assert.ok(region.y > 18);
  assert.deepEqual(image.data, original);
});

test("rejects whole patterned packages, blank images, and two equally plausible panels", () => {
  const large = picture(); fill(large, 30, 15, 140, 165);
  assert.equal(findLabelForegroundPanel(large), null);
  assert.equal(findLabelForegroundPanel(picture()), null);
  const competing = picture(); fill(competing, 10, 60, 60, 50); fill(competing, 125, 60, 60, 50);
  assert.equal(findLabelForegroundPanel(competing), null);
});

test("does not mistake transparent pixels for a dark panel or accept oversized detection buffers", () => {
  const transparent = picture(); fill(transparent, 50, 70, 100, 60, [0, 0, 0, 0]);
  assert.equal(findLabelForegroundPanel(transparent), null);
  assert.equal(findLabelForegroundPanel(picture(500, 500)), null);
  assert.equal(findLabelForegroundPanel({ width: 100, height: 100, data: new Uint8ClampedArray(4) }), null);
});

test("stretches colored text luminance while preserving its pixel positions", () => {
  const image = picture(20, 20); fill(image, 5, 5, 10, 10, [190, 10, 85, 255]);
  stretchLabelContrast(image.data);
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    const offset = (y * 20 + x) * 4;
    const expected = x >= 5 && x < 15 && y >= 5 && y < 15 ? 0 : 255;
    assert.deepEqual([...image.data.slice(offset, offset + 4)], [expected, expected, expected, 255]);
  }
});

test("near-flat photos are not exaggerated into black and white noise", () => {
  const data = new Uint8ClampedArray([200, 200, 200, 255, 205, 205, 205, 255]);
  stretchLabelContrast(data);
  assert.deepEqual([...data], [200, 200, 200, 255, 205, 205, 205, 255]);
});

test("an already cancelled preparation touches no browser objects", async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(prepareLabelDetailRetries(new Blob(), controller.signal), { name: "AbortError" });
});
