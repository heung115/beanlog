import { originPresets } from "../../data/origin-presets.ts";

export interface LabelRoasteryRegion {
  region: { x: number; y: number; width: number; height: number };
  /** Original OCR word text, without spelling repair. */
  text: string;
  /** Original line that located the brand, including any damaged marker. */
  evidence: string;
  confidence: number;
}

type Box = { x0: number; y0: number; x1: number; y1: number };
type Word = { text: string; bbox: Box; confidence?: number };
const MAX_SOURCE_PIXELS = 12_000_000;
const MAX_CROP_PIXELS = 600_000;
const MAX_REGION_WIDTH = 1200;
const MAX_REGION_HEIGHT = 250;
const MAX_REGION_PIXELS = 120_000;
const NON_BRAND = /\b(?:upload|select|choose|image|photo|file|scan|reading|recognition|cancel|continue|save|submit|click|tap|button|email|password|login|origin|country|region|varietal|process|weight|recipe|dose|dosage|water|tasting|nutrition|ingredients|expiry|expiration|farms?|farmers?|finca|hacienda|estate|producer|cooperative|station|source|province|city|village|district|street|address|road|avenue)\b|사진|파일|선택|업로드|인식|취소|저장|로그인|비밀번호|원산지|생산자|농장|원재료|중량|내용량|레시피|영양|주소|생산지|산지/iu;
const GENERIC_WORDS = /^(?:from|our|the|your|their|a|an|fresh|selected|local|best|coffee|coffees|roaster|roasters|roastery|specialty|company|co|cafe|beans|bean|source)$/iu;
const placeKey = (value: string) => value.normalize("NFKC").replace(/[\s.]/gu, "").toLowerCase();
// Known origins are domain vocabulary, not a list of expected roastery names.
const originPlaces = new Set(originPresets.flatMap(origin => [origin.country, origin.countryKo,
  ...origin.regions.flatMap(region => [region.name, region.nameKo])]).map(placeKey));

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function box(value: unknown): value is Box {
  return record(value) && [value.x0, value.y0, value.x1, value.y1]
    .every(number => typeof number === "number" && Number.isFinite(number))
    && (value.x0 as number) >= 0 && (value.y0 as number) >= 0
    && (value.x1 as number) > (value.x0 as number) && (value.y1 as number) > (value.y0 as number);
}

function validRegion(region: LabelRoasteryRegion["region"]): boolean {
  if (!record(region)) return false;
  const { x, y, width, height } = region;
  return [x, y, width, height].every(Number.isFinite) && x >= 0 && y >= 0 && width >= 3 && height >= 3
    && width <= MAX_REGION_WIDTH && height <= MAX_REGION_HEIGHT && width * height <= MAX_REGION_PIXELS && width / height <= 50;
}

function distance(left: string, right: string): number {
  let row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let index = 0; index < left.length; index++) {
    const next = [index + 1];
    for (let column = 0; column < right.length; column++) {
      next.push(Math.min(next[column] + 1, row[column + 1] + 1,
        row[column] + Number(left[index] !== right[column])));
    }
    row = next;
  }
  return row[right.length];
}

const markerKey = (value: string) => value.replace(/[^a-z]/giu, "").toLowerCase();
const brandKey = (value: string) => value.normalize("NFKC").replace(/[\s.]/gu, "").toLowerCase();
const isMarker = (value: string) => {
  const text = markerKey(value);
  return text.length >= 3 && text.length <= 5 && distance(text, "from") <= 1;
};

/** Validate visible brand text. No dictionary, completion or character replacement is applied. */
export function parseLabelRoasteryRetry(text: string): string | undefined {
  if (typeof text !== "string" || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u.test(text)) return undefined;
  const value = text.trim().replace(/\s+/gu, " ");
  if (value.length < 2 || value.length > 80 || !/^[\p{L}\p{N} .&'’()\-]+$/u.test(value)
    || (value.match(/\p{L}/gu)?.length ?? 0) < 2 || NON_BRAND.test(value) || /^from\b/iu.test(value) || originPlaces.has(placeKey(value))
    || /(?:www\.|\.com\b|\.co\.kr\b)|^\d[\d,.]*\s*(?:g|kg|ml|그램|킬로그램)$/iu.test(value)) return undefined;
  const words = value.split(/[\s.&'’()\-]+/u).filter(Boolean);
  if (!words.length || words.length > 8 || words.every(word => GENERIC_WORDS.test(word))) return undefined;
  return value;
}

/** Marker spelling is used only to locate ink. Multiple different brands remain ambiguous. */
export function findLabelRoasteryRegions(blocks: unknown, hasLabelContext: boolean): LabelRoasteryRegion[] {
  if (!hasLabelContext || !Array.isArray(blocks) || blocks.length > 100) return [];
  const candidates = new Map<string, LabelRoasteryRegion>();
  let inspectedLines = 0;
  for (const block of blocks) {
    if (!record(block) || !Array.isArray(block.paragraphs)) continue;
    if (block.paragraphs.length > 100) return [];
    for (const paragraph of block.paragraphs) {
      if (!record(paragraph) || !Array.isArray(paragraph.lines)) continue;
      if (paragraph.lines.length > 100) return [];
      for (const line of paragraph.lines) {
        if (++inspectedLines > 300) return [];
        if (!record(line) || typeof line.text !== "string" || !Array.isArray(line.words)) continue;
        const evidence = line.text.trim();
        if (!evidence || evidence.length > 200 || /[\r\n\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u.test(evidence)) continue;
        const first = evidence.split(/[\s.:：]+/u)[0];
        if (!isMarker(first)) continue;
        // A damaged marker needs its printed separator. This avoids interpreting
        // an unrelated word such as "FROG" as a FROM heading.
        if (markerKey(first) !== "from" && !/^[^\s.:：]+[\s]*[.:：]/u.test(evidence)) continue;
        if (line.words.length > 24) continue;
        if (!line.words.every((word): word is Word => record(word)
          && typeof word.text === "string" && box(word.bbox))) continue;
        const words = line.words;
        const marker = words.findIndex(word => isMarker(word.text));
        if (marker < 0 || marker > 1) continue;
        const following = words.slice(marker + 1);
        const firstLetter = following.findIndex(word => /[\p{L}\p{N}]/u.test(word.text));
        const lastLetter = following.findLastIndex(word => /[\p{L}\p{N}]/u.test(word.text));
        const brandWords = firstLetter < 0 ? [] : following.slice(firstLetter, lastLetter + 1);
        if (!brandWords.length || brandWords.length > 8) continue;
        const text = brandWords.map(word => word.text).join(" ");
        if (!parseLabelRoasteryRetry(text)) continue;
        const region = {
          x: Math.min(...brandWords.map(word => word.bbox.x0)),
          y: Math.min(...brandWords.map(word => word.bbox.y0)),
          width: 0, height: 0,
        };
        region.width = Math.max(...brandWords.map(word => word.bbox.x1)) - region.x;
        region.height = Math.max(...brandWords.map(word => word.bbox.y1)) - region.y;
        if (!validRegion(region)) continue;
        const markerBox = words[marker].bbox;
        if (region.x < markerBox.x0 || region.x - markerBox.x1 > region.height * 8
          || Math.min(markerBox.y1, region.y + region.height) <= Math.max(markerBox.y0, region.y)) continue;
        const confidence = brandWords.reduce((sum, word) => sum + (typeof word.confidence === "number" && Number.isFinite(word.confidence)
          ? Math.max(0, Math.min(100, word.confidence)) : 0), 0) / brandWords.length;
        const key = brandKey(text);
        const candidate = { region, text, evidence, confidence };
        if (candidates.size && !candidates.has(key)) return [];
        if (!candidates.has(key) || candidates.get(key)!.confidence < confidence) candidates.set(key, candidate);
      }
    }
  }
  return [...candidates.values()];
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

/** Crop only observed brand ink and provide a small white border for single-line OCR. */
export async function prepareLabelRoasteryRetry(image: Blob, region: LabelRoasteryRegion["region"], signal: AbortSignal): Promise<Blob> {
  signal.throwIfAborted();
  if (!validRegion(region) || typeof createImageBitmap !== "function" || typeof document === "undefined") throw invalidImage();
  const bitmap = await decode(image, signal);
  let canvas: HTMLCanvasElement | undefined;
  try {
    signal.throwIfAborted();
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > MAX_SOURCE_PIXELS
      || region.x + region.width > bitmap.width || region.y + region.height > bitmap.height) throw invalidImage();
    const margin = Math.max(2, region.height * 0.25);
    const x = Math.max(0, Math.floor(region.x - margin));
    const y = Math.max(0, Math.floor(region.y - margin));
    const width = Math.min(bitmap.width - x, Math.ceil(region.width + margin * 2));
    const height = Math.min(bitmap.height - y, Math.ceil(region.height + margin * 2));
    const zoom = Math.min(4, Math.max(1, 48 / region.height));
    const targetWidth = Math.round(width * zoom);
    const targetHeight = Math.round(height * zoom);
    if ((targetWidth + 20) * (targetHeight + 20) > MAX_CROP_PIXELS) throw invalidImage();
    canvas = document.createElement("canvas");
    canvas.width = targetWidth + 20;
    canvas.height = targetHeight + 20;
    const context = canvas.getContext("2d");
    if (!context) throw invalidImage();
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, x, y, width, height, 10, 10, targetWidth, targetHeight);
    signal.throwIfAborted();
    const encoded = await new Promise<Blob>((resolve, reject) => {
      const abort = () => { reject(cancelled()); };
      signal.addEventListener("abort", abort, { once: true });
      try {
        canvas!.toBlob(value => {
          signal.removeEventListener("abort", abort);
          if (signal.aborted) reject(cancelled());
          else if (value) resolve(value);
          else reject(invalidImage());
        }, "image/png");
      } catch {
        signal.removeEventListener("abort", abort);
        reject(invalidImage());
      }
    });
    signal.throwIfAborted();
    return encoded;
  } finally {
    if (canvas) canvas.width = canvas.height = 1;
    bitmap.close();
  }
}
