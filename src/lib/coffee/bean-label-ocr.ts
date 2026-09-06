"use client";

import { prepareLabelWordRetry } from "./bean-label-image.ts";
import { findLabelWeightRegions, type LabelTextRegion } from "./bean-label-image-regions.ts";
import { hasUnreadableLabelWeight, parseBeanLabelText } from "./bean-label-parser.ts";
import { mergeLabelExtractions, type LabelExtraction } from "./bean-label.ts";

export interface LabelImageVariant {
  image: Blob;
  psm: "6" | "11";
  kind: "full" | "text";
}

export interface LabelReadProgress {
  phase: "loading" | "reading";
  progress: number;
}

interface ReadOptions {
  signal: AbortSignal;
  onProgress: (progress: LabelReadProgress) => void;
  onPartial?: (result: { text: string; extraction: LabelExtraction }) => void;
  prepareWeightRetry?: () => Promise<Blob>;
}

interface PendingJob {
  action: string;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

const ASSETS = "/ocr/tesseract-7.0.0";
const MAX_TEXT_LENGTH = 30_000;

const abortError = () => new DOMException("Reading cancelled", "AbortError");

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
        const combined = () => ({
          text: [...new Set(texts.flatMap(value => value.split("\n")).map(line => line.trim()).filter(Boolean))].join("\n").slice(0, MAX_TEXT_LENGTH),
          extraction: mergeLabelExtractions([...extractions]
            .sort((left, right) => Number(right.kind === "text") - Number(left.kind === "text"))
            .map(result => result.extraction)),
        });
        const partial = () => { options.onPartial?.(combined()); assertCurrent(); };
        async function readPixels(image: Blob, mode: string, boxes = false) {
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
          const extraction = parseBeanLabelText(text);
          const hasLabelContext = [extraction, ...extractions.map(result => result.extraction)].some(result =>
            Boolean(result.fields.name || result.fields.roastery || result.fields.origin_country || result.fields.blend_components?.length));
          return {
            text,
            extraction,
            regions: findLabelWeightRegions("blocks" in result ? result.blocks : undefined, hasLabelContext),
            confidence: "confidence" in result && typeof result.confidence === "number" ? result.confidence : 0,
          };
        }
        for (pass = 0; pass < variants.length; pass++) {
          const variant = variants[pass];
          const result = await readPixels(variant.image, variant.psm, true);
          texts.push(result.text);
          extractions.push({ extraction: result.extraction, kind: variant.kind });
          wordRegions.push(...result.regions.map(region => ({ image: variant.image, kind: variant.kind, region })));
          partial();
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
        // Parse views separately so repeated scans cannot double blend shares.
        onProgress({ phase: "reading", progress: 1 });
        assertCurrent();
        return combined();
      } catch (error) {
        if (generation === currentGeneration) stop();
        if (signal.aborted) throw abortError();
        if (error instanceof Error && ["AbortError", "loading_failed", "recognition_failed"].includes(error.name === "AbortError" ? error.name : error.message)) throw error;
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
