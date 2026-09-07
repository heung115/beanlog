"use client";

import { validateLabelImageBeforeDecode } from "./bean-label-image-header.ts";
import { resizeLabelPixels } from "./bean-label-image-resample.ts";
import type { LabelSmallPrintRegion } from "./bean-label-small-print.ts";

const MAX_DIMENSION = 2600;
const MAX_SOURCE_PIXELS = 4_500_000;
const MAX_OUTPUT_PIXELS = 3_000_000;
const invalidImage = () => new Error("invalid_image");
const cancelled = () => new DOMException("Reading cancelled", "AbortError");

function checkCancellation(signal: AbortSignal) {
  if (signal.aborted) throw cancelled();
}

function checkedRegion(region: LabelSmallPrintRegion): Pick<LabelSmallPrintRegion, "source" | "crop" | "output"> {
  if (!region?.source || !region.crop || !region.output) throw invalidImage();
  // Snapshot caller-owned coordinates before the first asynchronous operation.
  const source = { width: region.source.width, height: region.source.height };
  const crop = { x: region.crop.x, y: region.crop.y, width: region.crop.width, height: region.crop.height };
  const output = { width: region.output.width, height: region.output.height };
  const sizes = [source.width, source.height, crop.width, crop.height, output.width, output.height];
  if (!sizes.every(value => Number.isSafeInteger(value) && value > 0)
    || ![crop.x, crop.y].every(value => Number.isSafeInteger(value) && value >= 0)
    || Math.max(source.width, source.height, output.width, output.height) > MAX_DIMENSION
    || source.width * source.height > MAX_SOURCE_PIXELS
    || output.width * output.height > MAX_OUTPUT_PIXELS
    || crop.x + crop.width > source.width || crop.y + crop.height > source.height) throw invalidImage();
  return { source, crop, output };
}

/** Browser decoders and encoders can finish after cancellation; callers settle immediately. */
function abortable<T>(signal: AbortSignal, start: () => Promise<T>, releaseLate?: (value: T) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const abort = () => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      reject(cancelled());
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) { abort(); return; }
    Promise.resolve().then(() => { checkCancellation(signal); return start(); }).then(value => {
      if (settled || signal.aborted) {
        releaseLate?.(value);
        abort();
        return;
      }
      settled = true;
      signal.removeEventListener("abort", abort);
      resolve(value);
    }, error => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      reject(signal.aborted ? cancelled() : error);
    });
  });
}

/** Crop the normalized full OCR frame without applying its normalization a second time. */
export async function prepareLabelSmallPrintImage(image: Blob, region: LabelSmallPrintRegion, signal: AbortSignal): Promise<Blob> {
  checkCancellation(signal);
  const { source, crop, output } = checkedRegion(region);
  const header = await abortable(signal, () => validateLabelImageBeforeDecode(image, signal));
  checkCancellation(signal);
  if (header.width !== source.width || header.height !== source.height
    || typeof createImageBitmap !== "function" || typeof document === "undefined") throw invalidImage();
  const bitmap = await abortable(signal, () => createImageBitmap(image), value => value.close()).catch(() => {
    checkCancellation(signal);
    throw invalidImage();
  });
  const canvases: HTMLCanvasElement[] = [];
  const canvas = (width: number, height: number) => {
    checkCancellation(signal);
    const element = document.createElement("canvas");
    canvases.push(element);
    element.width = width;
    element.height = height;
    const context = element.getContext("2d", { willReadFrequently: true });
    if (!context) throw invalidImage();
    return { element, context };
  };
  try {
    checkCancellation(signal);
    if (bitmap.width !== source.width || bitmap.height !== source.height) throw invalidImage();
    const sampled = canvas(crop.width, crop.height);
    sampled.context.fillStyle = "white";
    sampled.context.fillRect(0, 0, crop.width, crop.height);
    checkCancellation(signal);
    sampled.context.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
    checkCancellation(signal);
    const pixels = sampled.context.getImageData(0, 0, crop.width, crop.height);
    checkCancellation(signal);
    const resized = resizeLabelPixels(crop.width, crop.height, pixels.data, output.width, output.height);
    checkCancellation(signal);
    const enlarged = canvas(output.width, output.height);
    enlarged.context.putImageData(new ImageData(resized, output.width, output.height), 0, 0);
    checkCancellation(signal);
    const encoded = await abortable(signal, () => new Promise<Blob>((resolve, reject) => {
      enlarged.element.toBlob(value => value ? resolve(value) : reject(invalidImage()), "image/png");
    }));
    checkCancellation(signal);
    return encoded;
  } finally {
    for (const element of canvases) element.width = element.height = 1;
    bitmap.close();
  }
}
