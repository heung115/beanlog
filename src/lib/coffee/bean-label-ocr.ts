"use client";

import { validateLabelImageBeforeDecode } from "./bean-label-image-header.ts";
import { prepareLabelWordRetry } from "./bean-label-image.ts";
import { findLabelWeightRegions, type LabelTextRegion } from "./bean-label-image-regions.ts";
import { hasUnreadableLabelWeight, parseBeanLabelText } from "./bean-label-parser.ts";
import { extractLabelLayout } from "./bean-label-layout.ts";
import { estimateLabelSkew } from "./bean-label-deskew.ts";
import { extractLabelCountryEvidence, findLabelCountryRegions, reprojectLabelCountryEvidence } from "./bean-label-country-evidence.ts";
import { findLabelRoasteryRegions, parseLabelRoasteryRetry, prepareLabelRoasteryRetry, type LabelRoasteryRegion } from "./bean-label-roastery.ts";
import { LABEL_FIELDS, mergeLabelExtractions, type LabelExtraction } from "./bean-label.ts";

export interface LabelImageVariant {
  image: Blob;
  psm: "6" | "11";
  kind: "full" | "text";
}

export interface LabelReadProgress {
  phase: "loading" | "reading";
  progress: number;
}

export interface ReadOptions {
  signal: AbortSignal;
  onProgress: (progress: LabelReadProgress) => void;
  onPartial?: (result: { text: string; extraction: LabelExtraction }) => void;
  prepareWeightRetry?: () => Promise<Blob>;
  prepareDetailRetries?: (options: { includeColor: boolean }) => Promise<LabelImageVariant[]>;
  prepareDeskewRetry?: (angleDegrees: number) => Promise<Blob>;
  prepareFallbackImages?: () => Promise<LabelImageVariant[]>;
}

interface PendingJob {
  action: string;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

const ASSETS = "/ocr/tesseract-7.0.0";
const MAX_TEXT_LENGTH = 30_000;
const explicitCountryHeading = /^(?:country\s+of\s+origin|origin\s+country|country|origin|원\s*산\s*지|생\s*산\s*국|국\s*가|산\s*지)(?!\s+region)(?:\s*[:：=]|\s+|$)/imu;

const abortError = () => new DOMException("Reading cancelled", "AbortError");

function sameBrandReading(observed: string, refined: string, before: number, after: number) {
  const compact = (text: string) => text.toLocaleLowerCase("en").replace(/[\s.]+/gu, "");
  const left = compact(observed);
  const right = compact(refined);
  if (after < 30) return false;
  if (left === right) return true;
  if (Math.min(left.length, right.length) < 3 || Math.abs(left.length - right.length) > 1 || after < before + 10) return false;
  // This selects between actual readings of the same pixels; it does not repair
  // strings or look up a brand. A substantially different word stays unresolved.
  let i = 0; let j = 0; let differences = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) { i++; j++; continue; }
    if (++differences > 1) return false;
    if (left.length >= right.length) i++;
    if (right.length >= left.length) j++;
  }
  return differences + Number(i < left.length || j < right.length) <= 1;
}

/**
 * Tesseract 7's pinned worker protocol, kept inside one disposable browser worker.
 * Owning the worker before its language files load makes cancellation and failed
 * initialization immediately reclaim memory. No image or OCR text leaves the browser.
 */
export function createBrowserLabelReader() {
  let worker: Worker | null = null;
  let initialized = false;
  let language = "kor+eng";
  let psm = "6";
  let busy = false;
  let generation = 0;
  let nextJob = 0;
  let progress: ReadOptions["onProgress"] | null = null;
  const pending = new Map<string, PendingJob>();

  function stop(error: Error = abortError()) {
    generation += 1;
    worker?.terminate();
    worker = null;
    initialized = false;
    busy = false;
    progress = null;
    for (const job of pending.values()) job.reject(error);
    pending.clear();
  }

  function job(action: string, payload: unknown, transfer: Transferable[] = []): Promise<unknown> {
    const currentWorker = worker;
    if (!currentWorker) return Promise.reject(abortError());
    const jobId = `label-${++nextJob}`;
    return new Promise((resolve, reject) => {
      pending.set(jobId, { action, resolve, reject });
      try {
        currentWorker.postMessage({ workerId: "bean-label", jobId, action, payload }, transfer);
      } catch {
        pending.delete(jobId);
        reject(new Error(initialized ? "recognition_failed" : "loading_failed"));
      }
    });
  }

  function startWorker() {
    const currentWorker = new Worker(`${ASSETS}/worker.min.js`);
    worker = currentWorker;
    currentWorker.onerror = (event) => {
      event.preventDefault();
      if (worker === currentWorker) stop(new Error(initialized ? "recognition_failed" : "loading_failed"));
    };
    currentWorker.onmessageerror = () => {
      if (worker === currentWorker) stop(new Error(initialized ? "recognition_failed" : "loading_failed"));
    };
    currentWorker.onmessage = ({ data }: MessageEvent) => {
      if (worker !== currentWorker || !data || typeof data.jobId !== "string") return;
      const task = pending.get(data.jobId);
      if (!task || data.action !== task.action) return;
      if (data.status === "progress") {
        const reading = data.data?.status === "recognizing text";
        const amount = Number(data.data?.progress);
        const value = Number.isFinite(amount) ? Math.max(0, Math.min(1, amount)) : 0;
        const stages: Record<string, [number, number]> = { load: [0, 0.25], loadLanguage: [0.25, 0.6], initialize: [0.85, 0.1], setParameters: [0.95, 0.05] };
        const [start, length] = stages[task.action] ?? [0, 1];
        progress?.({ phase: reading ? "reading" : "loading", progress: reading ? value : start + length * value });
      } else if (data.status === "resolve") {
        pending.delete(data.jobId);
        task.resolve(data.data);
      } else if (data.status === "reject") {
        // Worker failures can contain paths or extracted text; only expose a stable code.
        stop(new Error(initialized ? "recognition_failed" : "loading_failed"));
      }
    };
  }

  return {
    dispose: () => stop(),
    async recognize(image: Blob | LabelImageVariant[], options: ReadOptions): Promise<{ text: string; extraction: LabelExtraction }> {
      const { signal, onProgress } = options;
      signal.throwIfAborted();
      if (typeof Worker === "undefined" || typeof WebAssembly === "undefined") throw new Error("browser_unsupported");
      if (busy) throw new Error("recognition_failed");
      const variants: LabelImageVariant[] = Array.isArray(image) ? image : [{ image, psm: "6", kind: "full" }];
      if (!variants.length || variants.length > 3) throw new Error("recognition_failed");
      busy = true;
      const currentGeneration = generation;
      let pass = 0;
      let reading = false;
      let readingProgress = 0;
      const plannedPasses = variants.length + (options.prepareWeightRetry || variants.length > 1 ? 1 : 0);
      progress = value => {
        if (!reading) { onProgress(value); return; }
        readingProgress = Math.max(readingProgress,
          Math.min(0.98, (pass + (value.phase === "reading" ? value.progress : 0)) / plannedPasses));
        onProgress({ phase: "reading", progress: readingProgress });
      };
      const abort = () => { if (generation === currentGeneration) stop(); };
      const assertCurrent = () => {
        signal.throwIfAborted();
        if (generation !== currentGeneration) throw abortError();
      };
      signal.addEventListener("abort", abort, { once: true });
      try {
        if (!worker) startWorker();
        if (!initialized) {
          onProgress({ phase: "loading", progress: 0 });
          assertCurrent();
          await job("load", { options: { lstmOnly: true, corePath: `${ASSETS}/core`, logging: false } });
          assertCurrent();
          await job("loadLanguage", { langs: "kor+eng", options: {
            langPath: `${ASSETS}/lang`, cachePath: "bean-label-kor-eng-v1", gzip: true, lstmOnly: true,
          } });
          assertCurrent();
          await job("initialize", { langs: "kor+eng", oem: 1, config: {} });
          assertCurrent();
          await job("setParameters", { params: { tessedit_pageseg_mode: "6", preserve_interword_spaces: "1", user_defined_dpi: "300" } });
          assertCurrent();
          initialized = true;
          language = "kor+eng";
          psm = "6";
        }
        if (language !== "kor+eng") {
          await job("initialize", { langs: "kor+eng", oem: 1, config: {} });
          assertCurrent();
          language = "kor+eng";
          psm = "";
        }
        reading = true;
        onProgress({ phase: "reading", progress: 0 });
        assertCurrent();
        const texts: string[] = [];
        const extractions: { extraction: LabelExtraction; kind?: LabelImageVariant["kind"] }[] = [];
        const wordRegions: { image: Blob; kind: LabelImageVariant["kind"]; region: LabelTextRegion }[] = [];
        const roasteryRegions: { image: Blob; index: number; candidate: LabelRoasteryRegion }[] = [];
        let deskewAttempted = false;
        const combined = () => ({
          text: [...new Set(texts.flatMap(value => value.split("\n")).map(line => line.trim()).filter(Boolean))].join("\n").slice(0, MAX_TEXT_LENGTH),
          extraction: mergeLabelExtractions([...extractions]
            .sort((left, right) => Number(right.kind === "text") - Number(left.kind === "text"))
            .map(result => result.extraction)),
        });
        const partial = () => { options.onPartial?.(combined()); assertCurrent(); };
        async function readPixels(image: Blob, mode: string, boxes = false) {
          await validateLabelImageBeforeDecode(image, signal);
          assertCurrent();
          if (psm !== mode) {
            await job("setParameters", { params: { tessedit_pageseg_mode: mode, preserve_interword_spaces: "1", user_defined_dpi: "300" } });
            assertCurrent();
            psm = mode;
          }
          const pixels = new Uint8Array(await image.arrayBuffer());
          assertCurrent();
          const result = await job("recognize", { image: pixels, options: {}, output: { text: true, ...(boxes ? { blocks: true } : {}) } }, [pixels.buffer]);
          assertCurrent();
          if (!result || typeof result !== "object" || !("text" in result) || typeof result.text !== "string") throw new Error("recognition_failed");
          const text = result.text.slice(0, MAX_TEXT_LENGTH).trim();
          const extraction = extractLabelLayout("blocks" in result ? result.blocks : undefined, parseBeanLabelText(text));
          const hasLabelContext = [extraction, ...extractions.map(result => result.extraction)].some(result =>
            Boolean(result.fields.name || result.fields.roastery || result.fields.origin_country || result.fields.blend_components?.length));
          return {
            text,
            extraction,
            regions: findLabelWeightRegions("blocks" in result ? result.blocks : undefined, hasLabelContext),
            roasteryRegions: findLabelRoasteryRegions("blocks" in result ? result.blocks : undefined, hasLabelContext),
            confidence: "confidence" in result && typeof result.confidence === "number" ? result.confidence : 0,
            skew: boxes ? estimateLabelSkew("blocks" in result ? result.blocks : undefined) : null,
            blocks: "blocks" in result ? result.blocks : undefined,
          };
        }
        for (pass = 0; pass < variants.length; pass++) {
          const variant = variants[pass];
          let source = variant.image;
          let result = await readPixels(source, variant.psm, true);
          if (!deskewAttempted && options.prepareDeskewRetry && !result.extraction.fields.name && result.skew
            && extractions.every(previous => !previous.extraction.fields.name)
            && !/^(?:product(?:\s+name)?|coffee\s+name|bean\s+name|상품명|제품명|원두명|커피명)\s*[:：=]/imu.test(result.text)) {
            deskewAttempted = true;
            const corrected = await options.prepareDeskewRetry(result.skew.angleDegrees);
            assertCurrent();
            const refined = await readPixels(corrected, "11", true);
            if (!refined.extraction.fields.name) {
              const supplementCountry = (country: ReturnType<typeof extractLabelCountryEvidence>) => {
                if (!country.text) return;
                refined.extraction = extractLabelLayout([
                  ...(Array.isArray(refined.blocks) ? refined.blocks : []), ...country.blocks,
                ], parseBeanLabelText(`${country.text}\n${refined.text}`));
                refined.text += `\n${country.text}`;
              };
              // A sparse pass can read the title and country value but miss its
              // small heading. Re-read only that observed row, then put its exact
              // evidence back at the original image coordinates for layout checks.
              const regions = findLabelCountryRegions(refined.blocks);
              for (const region of regions) {
                const cropped = await prepareLabelWordRetry(corrected, region, signal, 2);
                assertCurrent();
                const confirmation = await readPixels(cropped, "7", true);
                supplementCountry(reprojectLabelCountryEvidence(extractLabelCountryEvidence(confirmation.blocks), region, 2));
                if (refined.extraction.fields.name) break;
              }
              if (!regions.length) {
                const confirmation = await readPixels(corrected, "6", true);
                supplementCountry(extractLabelCountryEvidence(confirmation.blocks));
              }
            }
            // A clearer reading of the same photograph replaces its failed view
            // before publishing a partial. Never merge a fragmented country word
            // from the tilted read into the recovered title's metadata.
            const hasExplicitCountry = explicitCountryHeading.test(result.text) || Boolean(extractLabelCountryEvidence(result.blocks).text);
            const explicitCountryConflict = hasExplicitCountry && (!result.extraction.fields.origin_country
              || result.extraction.fields.origin_country !== refined.extraction.fields.origin_country);
            if (refined.extraction.fields.name && refined.confidence >= result.confidence + 10 && !explicitCountryConflict) {
              source = corrected;
              result = refined;
            }
          }
          texts.push(result.text);
          extractions.push({ extraction: result.extraction, kind: variant.kind });
          wordRegions.push(...result.regions.map(region => ({ image: source, kind: variant.kind, region })));
          const explicitRoaster = /^(?:roastery|roasters?|roasted\s+by|로스터리|로스터|로스팅\s*업체)\s*[:：=]/imu.test(result.text);
          if (variant.kind === "full" && !explicitRoaster) {
            roasteryRegions.push(...result.roasteryRegions.map(candidate => ({ image: source, index: extractions.length - 1, candidate })));
          }
          partial();
        }
        const firstReading = combined().extraction;
        if (options.prepareDetailRetries && (!firstReading.fields.name
          || (!firstReading.fields.roastery && firstReading.fields.weight_g === undefined))) {
          const missing = new Set(LABEL_FIELDS.filter(field => extractions.every(result => result.extraction.fields[field] === undefined)));
          // Missing due to an explicit disagreement is different from absent ink.
          if (texts.some(text => /^(?:product(?:\s+name)?|coffee\s+name|bean\s+name|상품명|제품명|원두명|커피명)\s*[:：=]/imu.test(text))) missing.delete("name");
          if (texts.some(text => /^(?:roastery|roasters?|roasted\s+by|로스터리|로스터|로스팅\s*업체)\s*[:：=]/imu.test(text))) missing.delete("roastery");
          async function addDetail(variant: LabelImageVariant) {
            const result = await readPixels(variant.image, variant.psm, true);
            // A successful detail reading becomes the baseline for later retries.
            // Enlarging the same text must not erase a title just recovered at its native size.
            for (const field of missing) if (extractions.some(result => result.extraction.fields[field] !== undefined)) missing.delete(field);
            const supplement: LabelExtraction = { ...result.extraction,
              bean_type: firstReading.bean_type !== "unknown" ? firstReading.bean_type
                : firstReading.fields.origin_country ? "unknown" : result.extraction.bean_type,
              fields: Object.fromEntries(Object.entries(result.extraction.fields).filter(([field]) => missing.has(field as typeof LABEL_FIELDS[number]))),
              evidence: Object.fromEntries(Object.entries(result.extraction.evidence).filter(([field]) => missing.has(field as typeof LABEL_FIELDS[number]))),
              tasting_notes: {
                en: firstReading.tasting_notes?.en.length ? [] : result.extraction.tasting_notes?.en ?? [],
                ko: firstReading.tasting_notes?.ko.length ? [] : result.extraction.tasting_notes?.ko ?? [],
              },
            };
            texts.push(result.text);
            extractions.push({ extraction: supplement, kind: variant.kind });
            wordRegions.push(...result.regions.map(region => ({ image: variant.image, kind: variant.kind, region })));
            partial();
          }
          const needsColor = !variants.some(variant => variant.kind === "full" && variant.psm === "11");
          if (needsColor && variants.length === 1) await addDetail({ ...variants[0], psm: "11" });
          const native = combined().extraction;
          if (!native.fields.name || (!native.fields.roastery && native.fields.weight_g === undefined)) {
            const details = await options.prepareDetailRetries({ includeColor: needsColor });
            assertCurrent();
            if (!Array.isArray(details) || details.length > 3) throw new Error("recognition_failed");
            for (const variant of details) await addDetail(variant);
          }
        }
        if (options.prepareWeightRetry && extractions.every(result => result.extraction.fields.weight_g === undefined)
          && texts.some(hasUnreadableLabelWeight)) {
          const enlarged = await options.prepareWeightRetry();
          assertCurrent();
          const result = await readPixels(enlarged, "6");
          texts.push(result.text);
          const retry = result.extraction;
          // Enlarging a unit may damage other glyphs. Only its explicitly read
          // package weight can supplement the original, never names or origins.
          extractions.push({ extraction: { bean_type: "unknown", fields: { weight_g: retry.fields.weight_g }, evidence: { weight_g: retry.evidence.weight_g } } });
          partial();
        }
        if (extractions.every(result => result.extraction.fields.weight_g === undefined)) {
          // A sparse photograph keeps isolated digits separate from surrounding
          // words. Prefer its coordinates and retry at most two observed tokens.
          const candidates = wordRegions.sort((left, right) => Number(right.kind === "full") - Number(left.kind === "full")).slice(0, 2);
          for (const candidate of candidates) {
            for (const scale of [1, 1.5] as const) {
              if (scale !== 1 && language !== "eng") {
                // English units can be mistaken for a digit by the Korean model.
                // Reuse the already loaded language data and the same worker.
                await job("initialize", { langs: "eng", oem: 1, config: {} });
                assertCurrent();
                language = "eng";
                psm = "";
              }
              const cropped = await prepareLabelWordRetry(candidate.image, candidate.region, signal, scale);
              assertCurrent();
              const result = await readPixels(cropped, scale === 1 ? "13" : "7");
              // No whitelist, digit replacement, or assumed unit: accept only the
              // package weight explicitly recognized in this independent pixel read.
              const retry = result.extraction;
              if (result.confidence >= 70 && retry.fields.weight_g !== undefined) {
                texts.push(result.text);
                extractions.push({ extraction: { bean_type: "unknown", fields: { weight_g: retry.fields.weight_g }, evidence: { weight_g: retry.evidence.weight_g } } });
                partial();
                break;
              }
            }
            if (extractions.some(result => result.extraction.fields.weight_g !== undefined)) break;
          }
        }
        for (const { image, index, candidate } of roasteryRegions.slice(0, 2)) {
          const base = extractions[index].extraction;
          const existing = base.fields.roastery;
          // A FROM wordmark is weaker evidence than an explicit roaster field.
          if (existing && !base.evidence.roastery?.includes(candidate.evidence.trim())) continue;
          if (language !== "eng") {
            await job("initialize", { langs: "eng", oem: 1, config: {} });
            assertCurrent(); language = "eng"; psm = "";
          }
          let cropped: Blob;
          try { cropped = await prepareLabelRoasteryRetry(image, candidate.region, signal); }
          catch (error) {
            assertCurrent();
            if (error instanceof Error && error.message === "invalid_image") continue;
            throw error;
          }
          assertCurrent();
          const result = await readPixels(cropped, "7");
          const brand = parseLabelRoasteryRetry(result.text);
          if (!brand || !sameBrandReading(candidate.text, brand, candidate.confidence, result.confidence)) continue;
          texts.push(result.text);
          // Replace only this view's matching coarse wordmark. Appending the
          // refined brand as a new view would turn a corrected glyph into a conflict.
          extractions[index].extraction = { ...base,
            fields: { ...base.fields, roastery: brand },
            evidence: { ...base.evidence, roastery: `${candidate.evidence.trim()} / ${result.text}`.slice(0, 500) },
          };
          partial();
        }
        // Parse views separately so repeated scans cannot double blend shares.
        onProgress({ phase: "reading", progress: 1 });
        assertCurrent();
        return combined();
      } catch (error) {
        if (generation === currentGeneration) stop();
        if (signal.aborted) throw abortError();
        if (error instanceof Error && ["AbortError", "loading_failed", "recognition_failed", "invalid_image", "image_too_large"].includes(error.name === "AbortError" ? error.name : error.message)) throw error;
        throw new Error("recognition_failed");
      } finally {
        signal.removeEventListener("abort", abort);
        if (generation === currentGeneration) {
          busy = false;
          progress = null;
        }
      }
    },
  };
}
