// Serialized into an isolated browser page by ocr-release-benchmark.mjs.
// All application imports resolve against the frozen loopback source snapshot.
export async function readFrozenLabel({ fixtureUrl, repeats, timeoutMs, readerType = "tesseract" }) {
  const setupStarted = performance.now(), rawReads = [], jobs = [], phases = [];
  const NativeWorker = window.Worker;
  let workerCount = 0;
  const copyBox = box => box && ({ x0: box.x0, y0: box.y0, x1: box.x1, y1: box.y1 });
  const copyText = node => ({ text: node?.text, confidence: node?.confidence, bbox: copyBox(node?.bbox) });
  const copyBlocks = blocks => Array.isArray(blocks) ? blocks.map(block => ({ ...copyText(block), paragraphs: block.paragraphs?.map(paragraph => ({ ...copyText(paragraph), lines: paragraph.lines?.map(line => ({ ...copyText(line), words: line.words?.map(copyText) })) })) })) : null;
  window.Worker = class extends NativeWorker {
    constructor(url, options) {
      super(url, options);
      this.auditId = ++workerCount;
      this.auditJobs = new Map();
      this.auditLanguage = null;
      this.auditMode = null;
      this.addEventListener("message", ({ data }) => {
        const paddle = data?.kind === "worker-transport-response";
        if (!(paddle ? ["success", "error"] : ["resolve", "reject"]).includes(data?.status)) return;
        const entry = this.auditJobs.get(paddle ? data.requestId : data.jobId);
        if (!entry) return;
        Object.assign(entry, { elapsedMs: performance.now() - entry.startedAt, status: data.status });
        if (paddle && entry.action === "predict" && data.status === "success") Object.assign(entry, { paddleResults: structuredClone(data.payload), text: Array.isArray(data.payload) ? data.payload.flatMap(result => result?.items ?? []).map(item => item.text ?? "").join("\n") : null, blocks: null });
        if (!paddle && data.action === "recognize") Object.assign(entry, { text: typeof data.data?.text === "string" ? data.data.text : null, confidence: data.data?.confidence ?? null, blocks: copyBlocks(data.data?.blocks) });
        if (data.status === "reject") entry.error = String(data.data);
        if (paddle && data.status === "error") entry.error = structuredClone(data.error);
      });
    }
    postMessage(message, ...rest) {
      const paddle = message.kind === "worker-transport-request";
      if (!paddle && !message.action) return super.postMessage(message, ...rest);
      if (message.action === "initialize") this.auditLanguage = message.payload?.langs;
      if (message.action === "setParameters" && message.payload?.params?.tessedit_pageseg_mode) this.auditMode = message.payload.params.tessedit_pageseg_mode;
      const entry = { workerId: this.auditId, backend: paddle ? "paddle" : "tesseract", jobId: paddle ? message.requestId : message.jobId, action: paddle ? message.type : message.action, startedAt: performance.now(), language: this.auditLanguage, psm: this.auditMode };
      jobs.push(entry);
      this.auditJobs.set(entry.jobId, entry);
      if (entry.action === "recognize" || entry.action === "predict") rawReads.push(entry);
      return super.postMessage(message, ...rest);
    }
  };
  let reader;
  try {
    const { prepareLabelImages, prepareLabelWeightRetry } = await import("/src/lib/coffee/bean-label-image.ts");
    const { prepareLabelDeskew } = await import("/src/lib/coffee/bean-label-deskew.ts");
    const { prepareLabelDetailRetries } = await import("/src/lib/coffee/bean-label-detail-image.ts");
    const createReader = readerType === "paddle" ? (await import("/src/lib/coffee/bean-label-paddle.ts")).createBrowserPaddleLabelReader : (await import("/src/lib/coffee/bean-label-ocr.ts")).createBrowserLabelReader;
    const imageReadStarted = performance.now();
    const response = await fetch(fixtureUrl);
    if (!response.ok) throw new Error(`fixture HTTP ${response.status}`);
    const original = await response.blob(), imageReadMs = performance.now() - imageReadStarted;
    reader = createReader();
    const setupMs = performance.now() - setupStarted;
    for (let repeat = 0; repeat < repeats; repeat++) {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
      const started = performance.now(), firstRead = rawReads.length, firstJob = jobs.length, beforeWorkers = workerCount;
      const partials = [], progress = [];
      let prepareMs, variants = [];
      try {
        const views = await prepareLabelImages(original, controller.signal, readerType === "paddle" ? "detector" : "block");
        prepareMs = performance.now() - started;
        variants = views.map(view => ({ kind: view.kind, psm: view.psm, bytes: view.image.size }));
        const result = await reader.recognize(views, {
          signal: controller.signal,
          onProgress: value => { if (progress.length < 1000) progress.push({ elapsedMs: performance.now() - started, ...value }); },
          onPartial: value => partials.push({ elapsedMs: performance.now() - started, ...structuredClone(value) }),
          prepareWeightRetry: () => prepareLabelWeightRetry(original, controller.signal),
          prepareDeskewRetry: angle => prepareLabelDeskew(original, angle, controller.signal),
          prepareDetailRetries: options => prepareLabelDetailRetries(original, controller.signal, options),
          prepareFallbackImages: () => prepareLabelImages(original, controller.signal, "block"),
        });
        phases.push({ repeat, phase: repeat === 0 ? "cold" : "warm", elapsedMs: performance.now() - started, prepareMs, variants, partials, progress,
          workerReused: beforeWorkers > 0 && workerCount === beforeWorkers, workerCount, rawReads: structuredClone(rawReads.slice(firstRead)), workerJobs: structuredClone(jobs.slice(firstJob)), ...result });
      } catch (error) {
        phases.push({ repeat, phase: repeat === 0 ? "cold" : "warm", elapsedMs: performance.now() - started, prepareMs, variants, partials, progress,
          workerCount, rawReads: structuredClone(rawReads.slice(firstRead)), workerJobs: structuredClone(jobs.slice(firstJob)), error: { name: error.name, message: error.message } });
      } finally { clearTimeout(timer); }
    }
    return { setupMs, imageReadMs, sourceBytes: original.size, sourceMime: original.type, phases, crossOriginIsolated: window.crossOriginIsolated, devicePixelRatio: window.devicePixelRatio };
  } finally {
    reader?.dispose();
    window.Worker = NativeWorker;
  }
}
