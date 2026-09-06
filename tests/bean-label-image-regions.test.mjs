import assert from "node:assert/strict";
import test from "node:test";
import { detectLabelTextRegion, findLabelWeightRegions } from "../src/lib/coffee/bean-label-image-regions.ts";

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


const ocrLine = (text, tokens) => ({ text, words: tokens.map((text, index) => ({
  text, bbox: { x0: 20 + index * 60, y0: 100, x1: 70 + index * 60, y1: 125 },
})) });
const ocrBlocks = (...lines) => [{ paragraphs: [{ lines }] }];

test("a trailing unreadable numeric token supplies coordinates without inferring any weight", () => {
  const blocks = ocrBlocks(ocrLine("Apple, Honey, Tea 3509", ["Apple,", "Honey,", "Tea", "3509"]));
  assert.deepEqual(findLabelWeightRegions(blocks, true), [{ x: 200, y: 100, width: 50, height: 25 }]);
  assert.deepEqual(findLabelWeightRegions(ocrBlocks(ocrLine("Net weight 1,0000 |", ["Net weight", "1,0000", "|"]))),
    [{ x: 80, y: 100, width: 50, height: 25 }]);
});

test("numeric retry skips recipe shares, dates, cultivar numbers and product codes", () => {
  const labels = ["Ethiopia 60%", "Varietal 74110", "Roast 2026", "Lot 3592", "Product 1000", "소비기한 2027"];
  for (const label of labels) assert.deepEqual(findLabelWeightRegions(ocrBlocks(ocrLine(label, label.split(" ")))), []);
  assert.deepEqual(findLabelWeightRegions(ocrBlocks(ocrLine("3509 bags shipped", ["3509", "bags", "shipped"]))), []);
});

test("numeric retry is bounded and rejects malformed coordinates", () => {
  const many = Array.from({ length: 20 }, () => ocrLine("Net weight 3509", ["Net weight", "3509"]));
  assert.equal(findLabelWeightRegions(ocrBlocks(...many)).length, 3);
  const invalid = ocrLine("3509", ["3509"]); invalid.words[0].bbox.x0 = -1;
  assert.deepEqual(findLabelWeightRegions(ocrBlocks(invalid)), []);
  assert.deepEqual(findLabelWeightRegions(null), []);
  assert.deepEqual(findLabelWeightRegions([{}, { paragraphs: [{ lines: [null] }] }]), []);
});


test("a recipe or nutrient amount cannot become a package weight by losing its context", () => {
  const labels = ["Dose: 20g", "Water 350g", "Protein: 30g", "Sugar 20g", "단백질 30g", "Date: 2026", "Order No. 3592", "Batch 3592"];
  for (const text of labels) assert.deepEqual(findLabelWeightRegions(ocrBlocks(ocrLine(text, text.split(" "))), true), []);
  for (const heading of ["Brew recipe", "Nutrition facts", "레시피", "영양정보", "Date", "Order No."]) {
    assert.deepEqual(findLabelWeightRegions(ocrBlocks(ocrLine(heading, [heading]), ocrLine("3509", ["3509"])), true), []);
  }
  assert.deepEqual(findLabelWeightRegions(ocrBlocks(ocrLine("Brew recipe", ["Brew recipe"]),
    ocrLine("Apple, Honey, Tea 3509", ["Apple,", "Honey,", "Tea", "3509"])), true), []);
  assert.deepEqual(findLabelWeightRegions(ocrBlocks(ocrLine("Nutrition facts", ["Nutrition facts"]),
    ocrLine("Weight 3509", ["Weight", "3509"])), true), []);
});

test("unlabelled numbers require both a coffee identity and a list of cup notes", () => {
  assert.deepEqual(findLabelWeightRegions(ocrBlocks(ocrLine("3509", ["3509"])), true), []);
  assert.deepEqual(findLabelWeightRegions(ocrBlocks(ocrLine("200g", ["200g"])), true), []);
  const notes = ocrBlocks(ocrLine("Apple, Honey, Tea 3509", ["Apple,", "Honey,", "Tea", "3509"]));
  assert.deepEqual(findLabelWeightRegions(notes, false), []);
  assert.equal(findLabelWeightRegions(notes, true).length, 1);
  assert.equal(findLabelWeightRegions(ocrBlocks(ocrLine("Net weight:", ["Net weight:"]), ocrLine("3509", ["3509"]))).length, 1);
});

test("an explicit package amount rereads adjacent number and unit boxes together", () => {
  const weight = ocrLine("내용량: 350 9", ["내용량:", "350", "9"]);
  assert.deepEqual(findLabelWeightRegions(ocrBlocks(weight)), [{ x: 80, y: 100, width: 110, height: 25 }]);
  assert.deepEqual(findLabelWeightRegions(ocrBlocks(ocrLine("Roast date: 2026-09-01", ["Roast date:", "2026-09-01"]), weight)),
    [{ x: 80, y: 100, width: 110, height: 25 }]);
  assert.deepEqual(findLabelWeightRegions(ocrBlocks(ocrLine("Net weight:", ["Net weight:"]), ocrLine("1,000 0", ["1,000", "0"]))),
    [{ x: 20, y: 100, width: 110, height: 25 }]);
});

test("split numeric tokens cannot escape recipe context or merge across separate lines", () => {
  assert.deepEqual(findLabelWeightRegions(ocrBlocks(ocrLine("Brew recipe", ["Brew recipe"]),
    ocrLine("Weight: 350 9", ["Weight:", "350", "9"])), true), []);
  const farApart = ocrLine("내용량: 350 9", ["내용량:", "350", "9"]);
  farApart.words[2].bbox.x0 += 100;
  farApart.words[2].bbox.x1 += 100;
  assert.deepEqual(findLabelWeightRegions(ocrBlocks(farApart)), []);
  const differentLine = ocrLine("내용량: 350 9", ["내용량:", "350", "9"]);
  differentLine.words[2].bbox.y0 += 100;
  differentLine.words[2].bbox.y1 += 100;
  assert.deepEqual(findLabelWeightRegions(ocrBlocks(differentLine)), []);
});
