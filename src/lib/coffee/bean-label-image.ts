"use client";

import { detectLabelTextRegion, type LabelTextRegion } from "./bean-label-image-regions.ts";
import { resizeLabelPixels } from "./bean-label-image-resample.ts";

export interface PreparedLabelImage {
  image: Blob;
  psm: "6" | "11";
  kind: "full" | "text";
}

const DETECTION_DIMENSION = 1024;
const MAX_OUTPUT_DIMENSION = 2600;
const ORDINARY_DIMENSION = 2200;
const MAX_FULL_PIXELS = 4_500_000;
const MAX_TEXT_PIXELS = 3_000_000;

function canvas(width: number, height: number) {
  const element = document.createElement("canvas");
  element.width = Math.max(1, Math.floor(width));
  element.height = Math.max(1, Math.floor(height));
  const context = element.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("invalid_image");
  context.fillStyle = "white";
  context.fillRect(0, 0, element.width, element.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  return { element, context };
}

function scaleFor(width: number, height: number, desired: number, maxPixels: number) {
  return Math.min(desired, MAX_OUTPUT_DIMENSION / Math.max(width, height), Math.sqrt(maxPixels / (width * height)));
}

function scaledPhoto(
  picture: HTMLImageElement,
  crop: { x: number; y: number; width: number; height: number },
  targetWidth: number,
  targetHeight: number,
) {
  const output = canvas(targetWidth, targetHeight);
  if (output.element.width <= crop.width && output.element.height <= crop.height) {
    output.context.drawImage(picture, crop.x, crop.y, crop.width, crop.height, 0, 0, output.element.width, output.element.height);
    return output;
  }

  // Canvas enlargement differs across browsers even with the same quality hint.
  // Read the decoded source once and use the same bounded cubic filter everywhere.
  const source = canvas(crop.width, crop.height);
  try {
    source.context.drawImage(picture, crop.x, crop.y, crop.width, crop.height, 0, 0, source.element.width, source.element.height);
    const pixels = source.context.getImageData(0, 0, source.element.width, source.element.height);
    const resized = resizeLabelPixels(source.element.width, source.element.height, pixels.data, output.element.width, output.element.height);
    output.context.putImageData(new ImageData(resized, output.element.width, output.element.height), 0, 0);
    return output;
  } finally {
    source.element.width = source.element.height = 1;
  }
}

async function encodeCanvas(element: HTMLCanvasElement, signal: AbortSignal): Promise<Blob> {
  try {
    signal.throwIfAborted();
    const blob = await new Promise<Blob>((resolve, reject) => {
      element.toBlob((value) => value ? resolve(value) : reject(new Error("invalid_image")), "image/png");
    });
    signal.throwIfAborted();
    return blob;
  } finally {
    // Release the backing pixels once the PNG has been created.
    element.width = element.height = 1;
  }
}

/**
 * Upscale locally and isolate a compact text block only when the pixel layout
 * supports it. Decorative packaging benefits from a sparse full-image pass;
 * ordinary text labels retain one block pass. No OCR text or brand is consulted.
 */
export async function prepareLabelImages(image: Blob, signal: AbortSignal): Promise<PreparedLabelImage[]> {
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
    if (Math.max(width, height) < 64 && image.type === "image/png") return [{ image, psm: "6", kind: "full" }];

    const detectionScale = Math.min(1, DETECTION_DIMENSION / Math.max(width, height));
    const sample = canvas(width * detectionScale, height * detectionScale);
    let region;
    try {
      sample.context.drawImage(picture, 0, 0, sample.element.width, sample.element.height);
      region = detectLabelTextRegion(sample.context.getImageData(0, 0, sample.element.width, sample.element.height));
    } finally {
      sample.element.width = sample.element.height = 1;
    }
    signal.throwIfAborted();
    // Clean text labels already read well at their original resolution. Enlarging
    // them can alter small units, so reserve the extra work for mixed packaging.
    if (!region) {
      const ordinaryScale = Math.min(1, ORDINARY_DIMENSION / Math.max(width, height));
      // Normalize decoded orientation once, including EXIF-rotated JPEG/WebP.
      // Keep the browser's default rendering path used by the original label UI.
      // Readback-oriented canvas settings can change even a 1:1 PNG conversion.
      const ordinary = document.createElement("canvas");
      const context = ordinary.getContext("2d");
      if (!context) throw new Error("invalid_image");
      ordinary.width = Math.max(1, Math.round(width * ordinaryScale));
      ordinary.height = Math.max(1, Math.round(height * ordinaryScale));
      context.fillStyle = "white";
      context.fillRect(0, 0, ordinary.width, ordinary.height);
      context.drawImage(picture, 0, 0, ordinary.width, ordinary.height);
      return [{ image: await encodeCanvas(ordinary, signal), psm: "6", kind: "full" }];
    }

    const fullScale = scaleFor(width, height, 2, MAX_FULL_PIXELS);
    // Do not add a white border: it can make brown paper dominate thresholding.
    const full = scaledPhoto(picture, { x: 0, y: 0, width, height }, width * fullScale, height * fullScale);
    const images: PreparedLabelImage[] = [{
      image: await encodeCanvas(full.element, signal),
      psm: "11",
      kind: "full",
    }];
    const x = Math.max(0, Math.floor(region.x / detectionScale));
    const y = Math.max(0, Math.floor(region.y / detectionScale));
    const cropWidth = Math.min(width - x, Math.ceil(region.width / detectionScale));
    const cropHeight = Math.min(height - y, Math.ceil(region.height / detectionScale));
    const textScale = scaleFor(cropWidth, cropHeight, 3, MAX_TEXT_PIXELS);
    const text = scaledPhoto(picture, { x, y, width: cropWidth, height: cropHeight }, cropWidth * textScale, cropHeight * textScale);
    images.push({ image: await encodeCanvas(text.element, signal), psm: "6", kind: "text" });
    // The compact label contains the useful facts and finishes first. The slower
    // full photograph can subsequently contribute a roaster printed elsewhere.
    return images.reverse();
  } finally {
    signal.removeEventListener("abort", abort);
    picture.src = "";
    URL.revokeObjectURL(url);
  }
}

/** Re-read a detected numeric word at its existing scale with room around its ink. */
export async function prepareLabelWordRetry(image: Blob, region: LabelTextRegion, signal: AbortSignal, scale: 1 | 1.5 | 2 = 1): Promise<Blob> {
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
    const { width, height, x, y } = region;
    if (![width, height, x, y].every(Number.isFinite) || width < 1 || height < 1 || x < 0 || y < 0
      || x + width > picture.naturalWidth || y + height > picture.naturalHeight) throw new Error("invalid_image");
    const padding = height * 0.3;
    const left = Math.max(0, Math.floor(x - padding));
    const top = Math.max(0, Math.floor(y - padding));
    const cropWidth = Math.min(picture.naturalWidth - left, Math.ceil(width + padding * 2));
    const cropHeight = Math.min(picture.naturalHeight - top, Math.ceil(height + padding * 2));
    const cropped = canvas(Math.round(cropWidth * scale), Math.round(cropHeight * scale));
    cropped.context.drawImage(picture, left, top, cropWidth, cropHeight, 0, 0, cropped.element.width, cropped.element.height);
    return await encodeCanvas(cropped.element, signal);
  } finally {
    signal.removeEventListener("abort", abort);
    picture.src = "";
    URL.revokeObjectURL(url);
  }
}

/** A bounded second pixel reading for a printed weight whose unit was unreadable. */
export async function prepareLabelWeightRetry(image: Blob, signal: AbortSignal): Promise<Blob> {
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
    const scale = scaleFor(width, height, 1.5, MAX_FULL_PIXELS);
    const enlarged = scaledPhoto(picture, { x: 0, y: 0, width, height }, width * scale, height * scale);
    return await encodeCanvas(enlarged.element, signal);
  } finally {
    signal.removeEventListener("abort", abort);
    picture.src = "";
    URL.revokeObjectURL(url);
  }
}
