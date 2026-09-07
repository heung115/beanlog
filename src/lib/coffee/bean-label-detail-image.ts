"use client";

import { validateLabelImageBeforeDecode } from "./bean-label-image-header.ts";

import type { PreparedLabelImage } from "./bean-label-image.ts";

type PixelImage = { width: number; height: number; data: Uint8ClampedArray };
type Region = { x: number; y: number; width: number; height: number };
const MAX_DIMENSION = 2600;
const MAX_PIXELS = 4_500_000;
const DETECTION_DIMENSION = 320;

/** Stretch observed luminance, preserving letters without changing their shapes or interpreting their text. */
export function stretchLabelContrast(data: Uint8ClampedArray) {
  const gray = new Uint8Array(data.length / 4);
  const histogram = new Uint32Array(256);
  for (let index = 0; index < gray.length; index += 1) {
    const offset = index * 4;
    const alpha = data[offset + 3] / 255;
    gray[index] = Math.round((.299 * data[offset] + .587 * data[offset + 1] + .114 * data[offset + 2]) * alpha + 255 * (1 - alpha));
    histogram[gray[index]] += 1;
  }
  let low = 0;
  let high = 255;
  let count = 0;
  for (let value = 0; value < 256; value += 1) {
    count += histogram[value];
    if (count > gray.length * .01) { low = value; break; }
  }
  count = 0;
  for (let value = 255; value >= 0; value -= 1) {
    count += histogram[value];
    if (count > gray.length * .01) { high = value; break; }
  }
  for (let index = 0; index < gray.length; index += 1) {
    // Avoid amplifying sensor noise into false ink on blank or nearly uniform photos.
    const value = high - low < 12 ? gray[index] : Math.max(0, Math.min(255, Math.round((gray[index] - low) * 255 / (high - low))));
    data[index * 4] = data[index * 4 + 1] = data[index * 4 + 2] = value;
    data[index * 4 + 3] = 255;
  }
}

/** Find a small foreground panel; large artwork, whole packages, and ambiguous competing objects are excluded. */
export function findLabelForegroundPanel({ width, height, data }: PixelImage): Region | null {
  const pixels = width * height;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 16 || height < 16
    || pixels > DETECTION_DIMENSION * DETECTION_DIMENSION || data.length !== pixels * 4) return null;
  const mask = new Uint8Array(pixels);
  for (let index = 0; index < pixels; index += 1) {
    const alpha = data[index * 4 + 3] / 255;
    const r = data[index * 4] * alpha + 255 * (1 - alpha);
    const g = data[index * 4 + 1] * alpha + 255 * (1 - alpha);
    const b = data[index * 4 + 2] * alpha + 255 * (1 - alpha);
    mask[index] = Math.max(r, g, b) - Math.min(r, g, b) > 35 || .299 * r + .587 * g + .114 * b < 200 ? 1 : 0;
  }
  const queue = new Int32Array(pixels);
  let best: { left: number; top: number; right: number; bottom: number; area: number } | null = null;
  let runnerUp = 0;
  for (let start = 0; start < pixels; start += 1) {
    if (!mask[start]) continue;
    let head = 0;
    let tail = 1;
    let left = start % width;
    let right = left;
    let top = Math.floor(start / width);
    let bottom = top;
    queue[0] = start;
    mask[start] = 0;
    while (head < tail) {
      const pixel = queue[head++];
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
      for (let row = Math.max(0, y - 1); row <= Math.min(height - 1, y + 1); row += 1) {
        for (let column = Math.max(0, x - 1); column <= Math.min(width - 1, x + 1); column += 1) {
          const neighbor = row * width + column;
          if (!mask[neighbor]) continue;
          mask[neighbor] = 0;
          queue[tail++] = neighbor;
        }
      }
    }
    if (!best || tail > best.area) {
      runnerUp = best?.area ?? 0;
      best = { left, top, right, bottom, area: tail };
    } else runnerUp = Math.max(runnerUp, tail);
  }
  if (!best || best.area < pixels * .03 || best.area < runnerUp * 1.5) return null;
  const padding = Math.max(3, Math.round(Math.max(best.right - best.left, best.bottom - best.top) * .025));
  const x = Math.max(0, best.left - padding);
  const y = Math.max(0, best.top - padding);
  const right = Math.min(width, best.right + padding + 1);
  const bottom = Math.min(height, best.bottom + padding + 1);
  const region = { x, y, width: right - x, height: bottom - y };
  // A small printed panel benefits from enlargement; magnifying a whole patterned bag can be much slower and less accurate.
  return region.width * region.height <= pixels * .35 ? region : null;
}

function canvas(width: number, height: number) {
  const element = document.createElement("canvas");
  element.width = Math.max(1, Math.round(width));
  element.height = Math.max(1, Math.round(height));
  const context = element.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("invalid_image");
  context.fillStyle = "white";
  context.fillRect(0, 0, element.width, element.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  return { element, context };
}

async function encode(element: HTMLCanvasElement, signal: AbortSignal) {
  try {
    signal.throwIfAborted();
    const image = await new Promise<Blob>((resolve, reject) => element.toBlob(blob => blob ? resolve(blob) : reject(new Error("invalid_image")), "image/png"));
    signal.throwIfAborted();
    return image;
  } finally { element.width = element.height = 1; }
}

/** Bounded optional views for facts missing after the normal OCR passes. */
export async function prepareLabelDetailRetries(image: Blob, signal: AbortSignal, options: { includeColor?: boolean } = {}): Promise<PreparedLabelImage[]> {
  await validateLabelImageBeforeDecode(image, signal);
  signal.throwIfAborted();
  const url = URL.createObjectURL(image);
  const picture = new Image();
  const abort = () => { picture.src = ""; };
  signal.addEventListener("abort", abort, { once: true });
  try {
    picture.src = url;
    try { await picture.decode(); }
    catch { signal.throwIfAborted(); throw new Error("invalid_image"); }
    signal.throwIfAborted();
    const width = picture.naturalWidth;
    const height = picture.naturalHeight;
    if (!width || !height || width * height > 100_000_000) throw new Error("invalid_image");
    const detectionScale = Math.min(1, DETECTION_DIMENSION / Math.max(width, height));
    const sample = canvas(width * detectionScale, height * detectionScale);
    let foreground: Region | null;
    try {
      sample.context.drawImage(picture, 0, 0, sample.element.width, sample.element.height);
      foreground = findLabelForegroundPanel(sample.context.getImageData(0, 0, sample.element.width, sample.element.height));
      if (foreground) foreground = {
        x: foreground.x / detectionScale, y: foreground.y / detectionScale,
        width: Math.min(width - foreground.x / detectionScale, foreground.width / detectionScale),
        height: Math.min(height - foreground.y / detectionScale, foreground.height / detectionScale),
      };
    } finally { sample.element.width = sample.element.height = 1; }
    signal.throwIfAborted();
    const results: PreparedLabelImage[] = [];
    for (const [index, region] of [{ x: 0, y: 0, width, height }, ...(foreground ? [foreground] : [])].entries()) {
      signal.throwIfAborted();
      const scale = Math.min(index === 0 ? 3 : 4, MAX_DIMENSION / Math.max(region.width, region.height), Math.sqrt(MAX_PIXELS / (region.width * region.height)));
      const output = canvas(region.width * scale, region.height * scale);
      try {
        output.context.drawImage(picture, region.x, region.y, region.width, region.height, 0, 0, output.element.width, output.element.height);
        if (index === 0) {
          if (options.includeColor) {
            const color = await new Promise<Blob>((resolve, reject) => output.element.toBlob(blob => blob ? resolve(blob) : reject(new Error("invalid_image")), "image/png"));
            signal.throwIfAborted();
            results.push({ image: color, psm: "11", kind: "full" });
          }
          const pixels = output.context.getImageData(0, 0, output.element.width, output.element.height);
          stretchLabelContrast(pixels.data);
          output.context.putImageData(pixels, 0, 0);
        }
        results.push({ image: await encode(output.element, signal), psm: "11", kind: index === 0 ? "full" : "text" });
      } finally { output.element.width = output.element.height = 1; }
    }
    return results;
  } finally {
    signal.removeEventListener("abort", abort);
    picture.src = "";
    URL.revokeObjectURL(url);
  }
}
