function samplingPlan(sourceSize: number, targetSize: number) {
  const indices = new Int32Array(targetSize * 4);
  const weights = new Float64Array(targetSize * 4);
  for (let position = 0; position < targetSize; position += 1) {
    const source = (position + 0.5) * sourceSize / targetSize - 0.5;
    const base = Math.floor(source);
    const fraction = source - base;
    const square = fraction * fraction;
    const cube = square * fraction;
    const offset = position * 4;
    // Catmull–Rom weights, using pixel centers and clamping source taps at the border.
    weights[offset] = -0.5 * fraction + square - 0.5 * cube;
    weights[offset + 1] = 1 - 2.5 * square + 1.5 * cube;
    weights[offset + 2] = 0.5 * fraction + 2 * square - 1.5 * cube;
    weights[offset + 3] = -0.5 * square + 0.5 * cube;
    for (let tap = 0; tap < 4; tap += 1) {
      indices[offset + tap] = Math.max(0, Math.min(sourceSize - 1, base + tap - 1));
    }
  }
  return { indices, weights };
}

/** Magnifies opaque RGBA independently of browser resampling. The caller bounds image sizes. */
export function resizeLabelPixels(
  width: number,
  height: number,
  rgba: Uint8ClampedArray,
  targetWidth: number,
  targetHeight: number,
): Uint8ClampedArray<ArrayBuffer> {
  if (![width, height, targetWidth, targetHeight].every((size) => Number.isInteger(size) && size > 0)
    || rgba.length !== width * height * 4) throw new RangeError("Invalid RGBA image dimensions");
  const horizontal = samplingPlan(width, targetWidth);
  const vertical = samplingPlan(height, targetHeight);
  const output = new Uint8ClampedArray(targetWidth * targetHeight * 4);
  const cachedIds = new Int32Array(4).fill(-1);
  // Four rows suffice for the separable filter; no full floating-point image is allocated.
  const cachedRows = Array.from({ length: 4 }, () => new Float64Array(targetWidth * 3));
  const activeRows = new Array<Float64Array>(4);

  for (let y = 0; y < targetHeight; y += 1) {
    const verticalOffset = y * 4;
    for (let tapY = 0; tapY < 4; tapY += 1) {
      const sourceY = vertical.indices[verticalOffset + tapY];
      const slot = sourceY % 4;
      const row = cachedRows[slot];
      if (cachedIds[slot] !== sourceY) {
        for (let x = 0; x < targetWidth; x += 1) {
          let red = 0, green = 0, blue = 0;
          for (let tapX = 0; tapX < 4; tapX += 1) {
            const index = x * 4 + tapX;
            const sourceOffset = (sourceY * width + horizontal.indices[index]) * 4;
            const weight = horizontal.weights[index];
            red += rgba[sourceOffset] * weight;
            green += rgba[sourceOffset + 1] * weight;
            blue += rgba[sourceOffset + 2] * weight;
          }
          row[x * 3] = red;
          row[x * 3 + 1] = green;
          row[x * 3 + 2] = blue;
        }
        cachedIds[slot] = sourceY;
      }
      activeRows[tapY] = row;
    }
    for (let x = 0; x < targetWidth; x += 1) {
      let red = 0, green = 0, blue = 0;
      for (let tapY = 0; tapY < 4; tapY += 1) {
        const row = activeRows[tapY];
        const weight = vertical.weights[verticalOffset + tapY];
        red += row[x * 3] * weight;
        green += row[x * 3 + 1] * weight;
        blue += row[x * 3 + 2] * weight;
      }
      const offset = (y * targetWidth + x) * 4;
      // Clamp and round only at the final output, retaining cubic overshoot between passes.
      output[offset] = red;
      output[offset + 1] = green;
      output[offset + 2] = blue;
      output[offset + 3] = 255;
    }
  }
  return output;
}
