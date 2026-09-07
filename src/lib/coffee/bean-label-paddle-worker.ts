"use client";

export interface PaddleOcrItem {
  poly: Array<[number, number]>;
  text: string;
  score: number;
}

export interface PaddleOcrResult {
  image: { width: number; height: number };
  items: PaddleOcrItem[];
  metrics: { detMs: number; recMs: number; totalMs: number; detectedBoxes: number; recognizedCount: number };
  runtime: { requestedBackend: string; detProvider: string; recProvider: string; webgpuAvailable: boolean };
}

export interface PaddleInitializationSummary {
  backend: string;
  detProvider: string;
  recProvider: string;
  webgpuAvailable: boolean;
  assets: unknown[];
  elapsedMs: number;
  pipelineConfigWarnings: string[];
}

interface NormalizedPaddleWorkerOptions {
  pipelineConfig: Record<string, unknown> & {
    assets: { det: { url: string }; rec: { url: string } };
  };
  ortOptions: Record<string, unknown> & {
    backend: "wasm";
    wasmPaths: string;
    numThreads: 1;
    simd: true;
    proxy: false;
    disableWasmProxy: true;
  };
}

interface ClientOptions {
  baseUrl: string | URL;
  /** Source-backed normalized config emitted with the pinned browser assets. */
  options: unknown;
  createWorker?: (url: URL) => Worker;
  initializationTimeoutMs?: number;
  inferenceTimeoutMs?: number;
}

type TaskType = "init" | "predict" | "decode" | "dispose";
interface PendingTask {
  type: TaskType;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const abortError = () => new DOMException("Reading cancelled", "AbortError");
const failure = (type: TaskType) => new Error(type === "init" ? "loading_failed" : "recognition_failed");
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function resolveLocalUrl(value: unknown, base: URL): string {
  if (typeof value !== "string" || !value) throw failure("init");
  const url = new URL(value, base);
  if (url.origin !== base.origin || !/^https?:$/u.test(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw failure("init");
  }
  return url.href;
}

function resolveOptions(input: unknown, base: URL): NormalizedPaddleWorkerOptions {
  if (!record(input) || !record(input.pipelineConfig) || !record(input.pipelineConfig.assets) || !record(input.ortOptions)) throw failure("init");
  const { det, rec } = input.pipelineConfig.assets;
  const ort = input.ortOptions;
  if (!record(det) || !record(rec) || ort.backend !== "wasm" || ort.numThreads !== 1 || ort.simd !== true || ort.proxy !== false) throw failure("init");
  // Only explicit same-origin URL descriptors enter the worker. Keep all source-backed
  // numeric pipeline settings unchanged; do not silently select models or fall back to a CDN.
  const options = structuredClone(input) as unknown as NormalizedPaddleWorkerOptions;
  options.pipelineConfig.assets = {
    det: { url: resolveLocalUrl(det.url, base) },
    rec: { url: resolveLocalUrl(rec.url, base) },
  };
  options.ortOptions.wasmPaths = resolveLocalUrl(ort.wasmPaths, base);
  options.ortOptions.disableWasmProxy = true;
  return options;
}

function initializationSummary(value: unknown): PaddleInitializationSummary {
  if (!record(value) || !record(value.summary)) throw failure("init");
  const s = value.summary;
  if (s.backend !== "wasm" || s.detProvider !== "wasm" || s.recProvider !== "wasm" ||
    typeof s.webgpuAvailable !== "boolean" || !Array.isArray(s.assets) ||
    typeof s.elapsedMs !== "number" || !Number.isFinite(s.elapsedMs) ||
    !Array.isArray(s.pipelineConfigWarnings) || !s.pipelineConfigWarnings.every(w => typeof w === "string")) throw failure("init");
  return s as unknown as PaddleInitializationSummary;
}

/** Thin transport for the pinned official PaddleOCR.js 0.4.2 worker protocol.
 * Owns its worker before initialization can await. Cancellation, errors and timeouts
 * terminate that worker; every pending operation settles without exposing worker text.
 */
export class PaddleWorkerClient {
  private readonly baseUrl: URL;
  private readonly options: NormalizedPaddleWorkerOptions;
  private readonly createWorker: (url: URL) => Worker;
  private readonly initializationTimeoutMs: number;
  private readonly inferenceTimeoutMs: number;
  private worker: Worker | null = null;
  private readonly pending = new Map<number, PendingTask>();
  private sequence = 0;
  private generation = 0;
  private initialization: Promise<PaddleInitializationSummary> | null = null;
  private summary: PaddleInitializationSummary | null = null;
  private busy = false;
  private disposed = false;

  constructor({ baseUrl, options, createWorker = url => new Worker(url, { type: "module" }),
    initializationTimeoutMs = 90_000, inferenceTimeoutMs = 60_000 }: ClientOptions) {
    try {
      const url = new URL(baseUrl, globalThis.location.href);
      if (url.origin !== globalThis.location.origin || !/^https?:$/u.test(url.protocol) || url.username || url.password || url.search || url.hash) throw failure("init");
      if (!url.pathname.endsWith("/")) url.pathname += "/";
      this.baseUrl = url;
      this.options = resolveOptions(options, url);
      if (![initializationTimeoutMs, inferenceTimeoutMs].every(value => Number.isFinite(value) && value > 0)) throw failure("init");
      this.initializationTimeoutMs = initializationTimeoutMs;
      this.inferenceTimeoutMs = inferenceTimeoutMs;
      this.createWorker = createWorker;
    } catch { throw failure("init"); }
  }

  private ensureActive(type: TaskType) {
    if (this.disposed) throw failure(type);
  }

  private ensureWorker(): Worker {
    this.ensureActive("init");
    if (this.worker) return this.worker;
    const worker = this.createWorker(new URL("worker.js", this.baseUrl));
    this.worker = worker;
    worker.onmessage = ({ data }: MessageEvent) => {
      if (this.worker !== worker || !record(data) || data.kind !== "worker-transport-response" || typeof data.requestId !== "number") return;
      const pending = this.pending.get(data.requestId);
      if (!pending || pending.type === "decode") return;
      if (data.status !== "success") {
        // A worker error may contain paths or recognized text. Never forward it or its stack.
        this.reset(failure(pending.type));
        return;
      }
      this.pending.delete(data.requestId);
      clearTimeout(pending.timer);
      pending.resolve(data.payload);
    };
    worker.onerror = event => {
      event.preventDefault();
      if (this.worker === worker) this.reset(failure(this.summary ? "predict" : "init"));
    };
    worker.onmessageerror = () => {
      if (this.worker === worker) this.reset(failure(this.summary ? "predict" : "init"));
    };
    return worker;
  }

  private request(type: Exclude<TaskType, "decode">, payload: unknown, transfer: Transferable[] = [], timeoutMs = this.inferenceTimeoutMs): Promise<unknown> {
    let worker: Worker;
    try { worker = this.ensureWorker(); } catch { return Promise.reject(failure(type)); }
    const requestId = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.worker === worker) this.reset(failure(type));
      }, timeoutMs);
      this.pending.set(requestId, { type, resolve, reject, timer });
      try { worker.postMessage({ kind: "worker-transport-request", type, payload, requestId }, transfer); }
      catch { this.reset(failure(type)); }
    });
  }

  private withSignal<T>(promise: Promise<T>, signal: AbortSignal | undefined, generation: number): Promise<T> {
    if (!signal) return promise;
    const onAbort = () => { if (generation === this.generation) this.cancel(); };
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
    return promise.finally(() => signal.removeEventListener("abort", onAbort));
  }

  initialize({ signal }: { signal?: AbortSignal } = {}): Promise<PaddleInitializationSummary> {
    this.ensureActive("init");
    if (signal?.aborted) return Promise.reject(abortError());
    if (this.summary) return Promise.resolve(this.summary);
    const generation = this.generation;
    if (!this.initialization) {
      this.initialization = this.request("init", { options: this.options }, [], this.initializationTimeoutMs)
        .then(payload => {
          if (generation !== this.generation) throw abortError();
          this.summary = initializationSummary(payload);
          return this.summary;
        }).catch(error => {
          if (generation === this.generation) this.reset(failure("init"));
          throw error instanceof Error && error.name === "AbortError" ? error : failure("init");
        });
    }
    return this.withSignal(this.initialization, signal, generation);
  }

  private decode(source: Blob | ImageBitmap, generation: number): Promise<ImageBitmap> {
    const requestId = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (generation === this.generation) this.reset(failure("decode"));
      }, this.inferenceTimeoutMs);
      this.pending.set(requestId, { type: "decode", resolve: value => resolve(value as ImageBitmap), reject, timer });
      // A decoder cannot be interrupted, but the caller must settle immediately on
      // cancel. Close its late bitmap rather than passing it to a later worker generation.
      void Promise.resolve().then(() => createImageBitmap(source)).then(bitmap => {
        const pending = this.pending.get(requestId);
        if (generation !== this.generation || !pending) { bitmap.close(); return; }
        this.pending.delete(requestId); clearTimeout(pending.timer); pending.resolve(bitmap);
      }, () => { if (generation === this.generation) this.reset(failure("decode")); });
    });
  }

  async predict(source: Blob | ImageBitmap, { signal }: { signal?: AbortSignal } = {}): Promise<PaddleOcrResult[]> {
    this.ensureActive("predict");
    if (signal?.aborted) throw abortError();
    if (this.busy) throw failure("predict");
    this.busy = true;
    const generation = this.generation;
    let bitmap: ImageBitmap | undefined;
    const operation = (async () => {
      await this.initialize({ signal });
      if (generation !== this.generation || signal?.aborted) throw abortError();
      bitmap = await this.decode(source, generation);
      if (generation !== this.generation || signal?.aborted) throw abortError();
      const result = await this.request("predict", { sources: [{ kind: "imageBitmap", imageBitmap: bitmap }], params: {} }, [bitmap]);
      if (generation !== this.generation || signal?.aborted) throw abortError();
      if (!Array.isArray(result) || result.length !== 1 || !record(result[0]) || !Array.isArray(result[0].items) || !record(result[0].image)) throw failure("predict");
      return result as PaddleOcrResult[];
    })();
    try { return await this.withSignal(operation, signal, generation); }
    catch (error) {
      if (generation === this.generation) this.reset(failure("predict"));
      if (error instanceof Error && (error.name === "AbortError" || error.message === "loading_failed")) throw error;
      throw failure("predict");
    } finally {
      bitmap?.close();
      if (generation === this.generation) this.busy = false;
    }
  }

  private reset(error: Error) {
    this.generation++;
    const worker = this.worker;
    this.worker = null;
    if (worker) { worker.onmessage = worker.onerror = worker.onmessageerror = null; worker.terminate(); }
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error); }
    this.pending.clear();
    this.initialization = null;
    this.summary = null;
    this.busy = false;
  }

  /** Immediately cancel all work. The same client can initialize a fresh worker afterward. */
  cancel() { this.reset(abortError()); }

  /** Release this client permanently. A subsequent read must use a new client instance. */
  async dispose(): Promise<void> {
    if (this.disposed) return;
    const release = this.worker && !this.busy && this.pending.size === 0 ? this.request("dispose", {}, [], 1000) : null;
    this.disposed = true;
    if (release) { try { await release; } catch { /* Termination is authoritative. */ } }
    this.reset(abortError());
  }
}
