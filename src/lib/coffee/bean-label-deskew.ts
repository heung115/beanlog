export interface LabelSkew {
  angleDegrees: number;
  sampleCount: number;
  lineCount: number;
}

type Box = { x0: number; y0: number; x1: number; y1: number };
type Sample = { angle: number; line: number };
const MAX_ANGLE = 20;
const MAX_SOURCE_PIXELS = 100_000_000;
const MAX_OUTPUT_PIXELS = 8_000_000;
const MAX_OUTPUT_DIMENSION = 3200;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function box(value: unknown): value is Box {
  return record(value) && [value.x0, value.y0, value.x1, value.y1].every(number =>
    typeof number === "number" && Number.isFinite(number) && number >= 0 && number <= 100_000)
    && (value.x1 as number) > (value.x0 as number) && (value.y1 as number) > (value.y0 as number);
}

function median(values: number[]): number {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.floor(ordered.length / 2)];
}

/** Estimate the observed baseline tilt. Text is never completed or corrected. */
export function estimateLabelSkew(blocks: unknown): LabelSkew | null {
  if (!Array.isArray(blocks) || blocks.length > 100) return null;
  const samples: Sample[] = [];
  let inspected = 0;
  for (const block of blocks) {
    if (!record(block) || !Array.isArray(block.paragraphs)) continue;
    if (block.paragraphs.length > 100) return null;
    for (const paragraph of block.paragraphs) {
      if (!record(paragraph) || !Array.isArray(paragraph.lines)) continue;
      if (paragraph.lines.length > 100) return null;
      for (const line of paragraph.lines) {
        if (++inspected > 300) return null;
        if (!record(line) || !Array.isArray(line.words) || line.words.length > 64) continue;
        const words = line.words.filter((word): word is Record<string, unknown> & { bbox: Box } =>
          record(word) && typeof word.text === "string" && word.text.length >= 2 && word.text.length <= 80
          && /[\p{L}\p{N}]/u.test(word.text) && typeof word.confidence === "number"
          && Number.isFinite(word.confidence) && word.confidence > 55 && word.confidence <= 100 && box(word.bbox));
        for (let left = 0; left < words.length; left++) {
          for (let right = left + 1; right < words.length; right++) {
            const a = words[left].bbox;
            const b = words[right].bbox;
            const distance = (b.x0 + b.x1 - a.x0 - a.x1) / 2;
            // Very close glyphs have unreliable baselines because of ascenders
            // and descenders. The broad coordinate floor also excludes tiny logos.
            if (Math.abs(distance) <= 100) continue;
            const angle = Math.atan((b.y1 - a.y1) / distance) * 180 / Math.PI;
            if (Math.abs(angle) <= MAX_ANGLE) samples.push({ angle, line: inspected });
            if (samples.length > 1000) return null;
          }
        }
      }
    }
  }
  if (samples.length < 2 || new Set(samples.map(sample => sample.line)).size < 2) return null;
  const center = median(samples.map(sample => sample.angle));
  if (Math.abs(center) < 1.5) return null;
  const agreeing = samples.filter(sample => Math.abs(sample.angle - center) <= 3.5);
  const lineCount = new Set(agreeing.map(sample => sample.line)).size;
  if (agreeing.length < 2 || lineCount < 2 || agreeing.length / samples.length < .65) return null;
  return { angleDegrees: median(agreeing.map(sample => sample.angle)), sampleCount: agreeing.length, lineCount };
}

const invalidImage = () => new Error("invalid_image");
const cancelled = () => new DOMException("Reading cancelled", "AbortError");

async function decode(image: Blob, signal: AbortSignal): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    let aborted = false;
    const abort = () => { aborted = true; reject(cancelled()); };
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve().then(() => { signal.throwIfAborted(); return createImageBitmap(image); }).then(bitmap => {
      signal.removeEventListener("abort", abort);
      if (aborted || signal.aborted) { bitmap.close(); reject(cancelled()); }
      else resolve(bitmap);
    }, () => {
      signal.removeEventListener("abort", abort);
      reject(signal.aborted ? cancelled() : invalidImage());
    });
  });
}

/** Rotate a previously validated photo without clipping its printed edges. */
export async function prepareLabelDeskew(image: Blob, angleDegrees: number, signal: AbortSignal): Promise<Blob> {
  signal.throwIfAborted();
  if (!(image instanceof Blob) || !image.size || image.size > 20 * 1024 * 1024
    || !["image/jpeg", "image/png", "image/webp"].includes(image.type)
    || !Number.isFinite(angleDegrees) || Math.abs(angleDegrees) < 1.5 || Math.abs(angleDegrees) > MAX_ANGLE
    || typeof createImageBitmap !== "function" || typeof document === "undefined") throw invalidImage();
  const bitmap = await decode(image, signal);
  let canvas: HTMLCanvasElement | undefined;
  try {
    signal.throwIfAborted();
    if (!Number.isInteger(bitmap.width) || !Number.isInteger(bitmap.height) || bitmap.width < 1 || bitmap.height < 1
      || bitmap.width * bitmap.height > MAX_SOURCE_PIXELS) throw invalidImage();
    const angle = angleDegrees * Math.PI / 180;
    const cosine = Math.abs(Math.cos(angle));
    const sine = Math.abs(Math.sin(angle));
    const rotatedWidth = bitmap.width * cosine + bitmap.height * sine;
    const rotatedHeight = bitmap.height * cosine + bitmap.width * sine;
    // Preserve enough source detail for Korean glyphs. Rotation can expand the
    // canvas, so both its final dimensions and allocation are independently bounded.
    const scale = Math.min(1, 2600 / Math.max(bitmap.width, bitmap.height),
      (MAX_OUTPUT_DIMENSION - 1) / Math.max(rotatedWidth, rotatedHeight),
      Math.sqrt((MAX_OUTPUT_PIXELS - MAX_OUTPUT_DIMENSION * 2) / (rotatedWidth * rotatedHeight)));
    const width = bitmap.width * scale;
    const height = bitmap.height * scale;
    canvas = document.createElement("canvas");
    canvas.width = Math.ceil(rotatedWidth * scale);
    canvas.height = Math.ceil(rotatedHeight * scale);
    // Use a software-backed canvas: WebKit's accelerated rotation can produce
    // different pixels on repeated reads of the same photo and angle.
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw invalidImage();
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(-angle);
    context.drawImage(bitmap, -width / 2, -height / 2, width, height);
    signal.throwIfAborted();
    const output = await new Promise<Blob>((resolve, reject) => {
      const abort = () => reject(cancelled());
      signal.addEventListener("abort", abort, { once: true });
      canvas!.toBlob(blob => {
        signal.removeEventListener("abort", abort);
        if (signal.aborted) reject(cancelled());
        else if (blob) resolve(blob);
        else reject(invalidImage());
      }, "image/png");
    });
    signal.throwIfAborted();
    return output;
  } finally {
    bitmap.close();
    if (canvas) canvas.width = canvas.height = 1;
  }
}
