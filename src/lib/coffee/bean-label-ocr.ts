"use client";

import { parseBeanLabelText } from "./bean-label-parser.ts";
import type { LabelExtraction } from "./bean-label";

export interface LabelReadProgress {
  phase: "loading" | "reading";
  progress: number;
}

interface ReadOptions {
  signal: AbortSignal;
  onProgress: (progress: LabelReadProgress) => void;
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
    async recognize(image: Blob, options: ReadOptions): Promise<{ text: string; extraction: LabelExtraction }> {
      const { signal, onProgress } = options;
      signal.throwIfAborted();
      if (typeof Worker === "undefined" || typeof WebAssembly === "undefined") throw new Error("browser_unsupported");
      if (busy) throw new Error("recognition_failed");
      busy = true;
      const currentGeneration = generation;
      progress = onProgress;
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
        }
        const pixels = new Uint8Array(await image.arrayBuffer());
        assertCurrent();
        onProgress({ phase: "reading", progress: 0 });
        assertCurrent();
        const result = await job("recognize", { image: pixels, options: {}, output: { text: true } }, [pixels.buffer]);
        assertCurrent();
        if (!result || typeof result !== "object" || !("text" in result) || typeof result.text !== "string") {
          throw new Error("recognition_failed");
        }
        // Bound retained text; the original photo remains a tab-local object URL.
        const text = result.text.slice(0, MAX_TEXT_LENGTH).trim();
        onProgress({ phase: "reading", progress: 1 });
        assertCurrent();
        return { text, extraction: parseBeanLabelText(text) };
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
