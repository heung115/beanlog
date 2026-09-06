import assert from "node:assert/strict";
import test from "node:test";
import { resizeLabelPixels } from "../src/lib/coffee/bean-label-image-resample.ts";

const opaque = (values) => new Uint8ClampedArray(values.flatMap((value) => [value, value, value, 255]));
const red = (rgba) => Array.from(rgba).filter((_, index) => index % 4 === 0);

test("resampling at the original size preserves every color channel in a new array", () => {
  const input = new Uint8ClampedArray([0, 43, 255, 255, 119, 201, 14, 255, 230, 11, 149, 255]);
  const output = resizeLabelPixels(3, 1, input, 3, 1);
  assert.deepEqual(output, input);
  assert.notEqual(output, input);
});

test("expanding one pixel preserves its constant color and opaque alpha at every border", () => {
  const input = new Uint8ClampedArray([21, 112, 234, 255]);
  const expected = new Uint8ClampedArray(Array.from({ length: 63 }, () => [...input]).flat());
  assert.deepEqual(resizeLabelPixels(1, 1, input, 9, 7), expected);
});

test("pixel-center interpolation preserves edge contrast and clamps cubic ringing on both axes", () => {
  const input = opaque([0, 255]);
  assert.deepEqual(red(resizeLabelPixels(2, 1, input, 4, 1)), [0, 52, 203, 255]);
  assert.deepEqual(red(resizeLabelPixels(1, 2, input, 1, 4)), [0, 52, 203, 255]);
});

test("repeated resampling is deterministic and leaves the source pixels unchanged", () => {
  const input = opaque([0, 70, 255, 128, 190, 40, 11, 250, 99]);
  const before = input.slice();
  const first = resizeLabelPixels(3, 3, input, 13, 11);
  assert.deepEqual(resizeLabelPixels(3, 3, input, 13, 11), first);
  assert.deepEqual(input, before);
});

// A direct 2D implementation independently checks the rolling row cache and
// separable interpolation, including repeated edge rows and noninteger ratios.
function cubic(distance) {
  const x = Math.abs(distance);
  if (x < 1) return 1.5 * x ** 3 - 2.5 * x ** 2 + 1;
  if (x < 2) return -0.5 * x ** 3 + 2.5 * x ** 2 - 4 * x + 2;
  return 0;
}

function reference(width, height, input, targetWidth, targetHeight) {
  const output = new Uint8ClampedArray(targetWidth * targetHeight * 4);
  for (let y = 0; y < targetHeight; y += 1) {
    const sy = (y + 0.5) * height / targetHeight - 0.5;
    for (let x = 0; x < targetWidth; x += 1) {
      const sx = (x + 0.5) * width / targetWidth - 0.5;
      const offset = (y * targetWidth + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        let value = 0;
        for (let oy = -1; oy <= 2; oy += 1) {
          for (let ox = -1; ox <= 2; ox += 1) {
            const ix = Math.floor(sx) + ox;
            const iy = Math.floor(sy) + oy;
            const clampedX = Math.max(0, Math.min(width - 1, ix));
            const clampedY = Math.max(0, Math.min(height - 1, iy));
            value += input[(clampedY * width + clampedX) * 4 + channel] * cubic(sx - ix) * cubic(sy - iy);
          }
        }
        output[offset + channel] = value;
      }
      output[offset + 3] = 255;
    }
  }
  return output;
}

test("the row cache matches independent 2D interpolation across changing sample windows", () => {
  const width = 11, height = 13;
  const input = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < input.length; i += 1) input[i] = i % 4 === 3 ? 255 : (i * 73 + 19) % 256;
  for (const [targetWidth, targetHeight] of [[3, 5], [17, 29], [1, 2], [37, 7]]) {
    const actual = resizeLabelPixels(width, height, input, targetWidth, targetHeight);
    const expected = reference(width, height, input, targetWidth, targetHeight);
    // Different floating-point operation order can move a rounded value by one level.
    assert.ok(actual.every((value, index) => Math.abs(value - expected[index]) <= 1));
  }
});

test("invalid dimensions and mismatched pixel arrays are rejected", () => {
  const input = opaque([0, 255]);
  assert.throws(() => resizeLabelPixels(2, 1, input, 0, 1), RangeError);
  assert.throws(() => resizeLabelPixels(2, 1, input, 1.5, 1), RangeError);
  assert.throws(() => resizeLabelPixels(3, 1, input, 4, 2), RangeError);
});
