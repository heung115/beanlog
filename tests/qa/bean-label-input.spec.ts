import { randomBytes, randomUUID } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { admin, browserSupabaseUrl, ensureUser, signIn } from "./helpers";
import ko from "../../src/i18n/ko.json" with { type: "json" };
import en from "../../src/i18n/en.json" with { type: "json" };

type Locale = "ko" | "en";
type QaUser = { email: string; password: string };

// A real PNG exercises image decoding and lossless canvas preparation in the browser.
const photo = {
  name: "coffee-package.png",
  mimeType: "image/png",
  buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
};
// The real rule parser converts this OCR text into the review candidates.
const labelText = [
  "Product: Yirgacheffe Natural",
  "Roaster: QA Label Roastery",
  "Origin: Ethiopia",
  "Region: Yirgacheffe",
  "Producer: QA Washing Station",
  "Variety: Heirloom",
  "Process: Natural",
  "Processing detail: Sun dried",
  "Roast level: Light",
  "Roasted on: 2026-09-01",
  "Net weight: 200 g",
].join("\n");
const requestedBlend = {
  name: "지에이 블렌드(그린애플쥬스 블렌드)",
  composition: [
    "Ethiopia Gedeb Chorso 74110, Kurume Washed 60%",
    "Ethiopia Bursa Main Station 74158 White Honey 40%",
  ],
  notesEn: "Green Apple, Red Apple, Lemon, Bergamot, Candy, Honey, Black Tea",
  notesKo: "청사과, 빨간사과, 레운, 바르가웃, 캔디, 꿀, 블랙티",
  translatedKo: "청사과, 빨간사과, 레몬, 베르가못, 캔디, 꿀, 블랙티",
};
const requestedBlendText = [requestedBlend.name, ...requestedBlend.composition, requestedBlend.notesEn, requestedBlend.notesKo, "200g"].join("\n");
const workerPath = "/ocr/tesseract-7.0.0/worker.min.js";
const paddleWorkerPath = "/ocr/paddle-0.4.2-v1/worker.js";

type OcrReply = { text?: string; error?: string; deferred?: boolean; scores?: number[] };
type OcrSnapshot = {
  reads: number;
  completions: number;
  images: { size: number; signature: string; sha256: string }[];
  workerUrls: string[];
  corePaths: string[];
  langPaths: string[];
  languages: string[];
  modelPaths: string[];
  terminated: number[];
};
type OcrControl = Omit<OcrSnapshot, "images"> & {
  images: { size: number; signature: string; sha256: Promise<string> }[];
  release: (index: number) => void;
  dispose: () => void;
};
declare global {
  interface Window {
    qaBrowserOcr?: OcrControl;
    qaPhotoReadStarted?: boolean;
    qaReleasePhotoRead?: () => void;
  }
}

/** Mock only the OCR engine; image preparation, worker RPC, parser and UI remain real. */
async function mockBrowserOcr(page: Page, replies: OcrReply[] = [{ text: labelText }], allowLateResponses = false) {
  const requests: { url: string; method: string; argumentFreeServerAction: boolean }[] = [];
  page.on("request", (request) => {
    requests.push({
      url: request.url(),
      method: request.method(),
      argumentFreeServerAction: Boolean(request.headers()["next-action"]) && request.postData()?.trim() === "[]",
    });
  });
  await page.route(url => [workerPath, paddleWorkerPath].includes(url.pathname), async (route) => {
    expect(route.request().method()).toBe("GET");
    await route.fulfill({
      contentType: "application/javascript",
      body: `
        const pending = new Map();
        const respond = (message) => {
          const { workerId, jobId, action, qa } = message;
          const reply = qa.reply;
          if (message.kind === "worker-transport-request") {
            // Synthetic OCR rows exercise the real polygon adapter and parser.
            // No recognition result is derived from a production photo here.
            const rows = (reply.text || "").split("\\n").filter(Boolean);
            const items = rows.map((text, index) => ({ text, score: reply.scores?.[index] ?? 0.99,
              poly: [[10, 10 + index * 40], [990, 10 + index * 40], [990, 30 + index * 40], [10, 30 + index * 40]] }));
            self.postMessage({ kind: "worker-transport-response", requestId: message.requestId,
              status: reply.error ? "error" : "success", qaCompletion: true,
              payload: reply.error ? { message: reply.error } : [{ items, image: { width: 1000, height: Math.max(100, rows.length * 40 + 40) } }]
            });
            for (const source of message.payload.sources) source.imageBitmap?.close();
            return;
          }
          self.postMessage({ workerId, jobId, action,
            status: reply.error ? "reject" : "resolve",
            data: reply.error || { text: reply.text || "" }
          });
        };
        self.onmessage = ({ data: message }) => {
          if (typeof message.qaRelease === "number") {
            const saved = pending.get(message.qaRelease);
            if (saved) { pending.delete(message.qaRelease); respond(saved); }
            return;
          }
          const { workerId, jobId, action, qa } = message;
          if (action === "recognize" || message.type === "predict") {
            if (action === "recognize") self.postMessage({ workerId, jobId, action, status: "progress",
              data: { status: "recognizing text", progress: 0.5 } });
            if (qa.reply.deferred) pending.set(qa.index, message);
            else respond(message);
          } else if (message.kind === "worker-transport-request") {
            self.postMessage({ kind: "worker-transport-response", requestId: message.requestId, status: "success",
              payload: message.type === "init" ? { summary: { backend: "wasm", detProvider: "wasm", recProvider: "wasm",
                webgpuAvailable: false, assets: [], elapsedMs: 0, pipelineConfigWarnings: [] } } : {} });
          } else {
            self.postMessage({ workerId, jobId, action, status: "resolve", data: {} });
          }
        };
      `,
    });
  });
  await page.evaluate(({ replies, allowLateResponses }) => {
    const NativeWorker = window.Worker;
    const workers: Worker[] = [];
    const recognizingWorkers: Worker[] = [];
    const state: OcrControl = {
      reads: 0, completions: 0, images: [], workerUrls: [], corePaths: [],
      langPaths: [], languages: [], modelPaths: [], terminated: [],
      release(index) {
        NativeWorker.prototype.postMessage.call(recognizingWorkers[index], { qaRelease: index });
      },
      dispose() {
        workers.forEach((worker) => NativeWorker.prototype.terminate.call(worker));
        window.Worker = NativeWorker;
      },
    };
    window.qaBrowserOcr = state;
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        workers.push(this);
        state.workerUrls.push(new URL(String(url), location.href).href);
        this.addEventListener("message", ({ data }) => {
          if (data?.action === "recognize" && ["resolve", "reject"].includes(data.status)
            || data?.kind === "worker-transport-response" && data.qaCompletion) state.completions += 1;
        });
      }
      postMessage(message: unknown, transferOrOptions?: Transferable[] | StructuredSerializeOptions) {
        const request = message as {
          action?: string;
          type?: string;
          payload?: {
            image?: Uint8Array; langs?: string | string[]; sources?: { imageBitmap: ImageBitmap }[];
            options?: { corePath?: string; langPath?: string; ortOptions?: { wasmPaths: string };
              pipelineConfig?: { assets: { det: { url: string }; rec: { url: string } } } };
          };
        };
        let outgoing = message;
        if (request.action === "load") state.corePaths.push(request.payload?.options?.corePath ?? "");
        if (request.action === "loadLanguage") {
          state.langPaths.push(request.payload?.options?.langPath ?? "");
          const langs = request.payload?.langs;
          state.languages.push(Array.isArray(langs) ? langs.join("+") : langs ?? "");
        }
        if (request.type === "init") {
          state.corePaths.push(request.payload?.options?.ortOptions?.wasmPaths ?? "");
          const assets = request.payload?.options?.pipelineConfig?.assets;
          state.modelPaths.push(assets?.det.url ?? "", assets?.rec.url ?? "");
        }
        if (request.action === "recognize" || request.type === "predict") {
          const index = state.reads++;
          recognizingWorkers[index] = this;
          const bitmap = request.payload?.sources?.[0].imageBitmap;
          let pixels: Uint8ClampedArray | undefined;
          if (bitmap) {
            const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
            const context = canvas.getContext("2d")!;
            context.drawImage(bitmap, 0, 0);
            pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
          }
          const image = pixels ?? request.payload?.image;
          state.images.push({
            size: image?.byteLength ?? 0,
            signature: pixels ? "rgba" : Array.from(image?.slice(0, 8) ?? []).map((byte) => byte.toString(16).padStart(2, "0")).join(""),
            // Hash the complete real input once. Returning megapixels on every
            // progress poll can itself block the browser and hide UI races.
            sha256: crypto.subtle.digest("SHA-256", new Uint8Array(image ?? [])).then(hash =>
              Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, "0")).join("")),
          });
          outgoing = { ...request, qa: { index, reply: replies[Math.min(index, replies.length - 1)] } };
        }
        if (Array.isArray(transferOrOptions)) super.postMessage(outgoing, transferOrOptions);
        else super.postMessage(outgoing, transferOrOptions);
      }
      terminate() {
        state.terminated.push(workers.indexOf(this));
        // Deliberately permit late test replies to exercise cancellation guards.
        // Cleanup always terminates the underlying native workers.
        if (!allowLateResponses) super.terminate();
      }
    };
  }, { replies, allowLateResponses });

  const snapshot = () => page.evaluate(async () => {
    const state = window.qaBrowserOcr!;
    return {
      reads: state.reads, completions: state.completions,
      images: await Promise.all(state.images.map(async image => ({ ...image, sha256: await image.sha256 }))),
      workerUrls: state.workerUrls, corePaths: state.corePaths, langPaths: state.langPaths,
      languages: state.languages, modelPaths: state.modelPaths, terminated: state.terminated,
    };
  });
  return {
    snapshot,
    release: (index: number) => page.evaluate((index) => window.qaBrowserOcr!.release(index), index),
    async expectBrowserOnly() {
      const state = await snapshot();
      const pageUrl = new URL(page.url());
      const origin = pageUrl.origin;
      expect(state.workerUrls.length).toBeGreaterThan(0);
      const paddle = state.workerUrls.includes(`${origin}${paddleWorkerPath}`);
      const tesseract = state.workerUrls.includes(`${origin}${workerPath}`);
      expect(state.workerUrls.every((url) => [workerPath, paddleWorkerPath].some(path => url === `${origin}${path}`))).toBe(true);
      expect(state.corePaths.length).toBeGreaterThan(0);
      expect(state.corePaths.every(path => [`${origin}/ocr/tesseract-7.0.0/core`, `${origin}/ocr/paddle-0.4.2-v1/ort/`].includes(new URL(path, origin).href))).toBe(true);
      if (paddle) {
        expect(state.corePaths).toContain(`${origin}/ocr/paddle-0.4.2-v1/ort/`);
        expect(state.modelPaths.length).toBeGreaterThanOrEqual(2);
        expect(state.modelPaths.every((path) => path.startsWith(`${origin}/ocr/paddle-0.4.2-v1/models/`))).toBe(true);
      }
      if (tesseract) {
        expect(state.corePaths.map(path => new URL(path, origin).href)).toContain(`${origin}/ocr/tesseract-7.0.0/core`);
        expect(state.langPaths.length).toBeGreaterThan(0);
        expect(state.langPaths.every((path) => new URL(path, origin).href === `${origin}/ocr/tesseract-7.0.0/lang`)).toBe(true);
        expect(state.languages.every((langs) => langs.split("+").sort().join("+") === "eng+kor")).toBe(true);
      } else expect(state.langPaths).toEqual([]);
      // Initial country/admin lookups use argument-free Next Server Action POSTs.
      // Permit only that empty argument list; photo or OCR-text payloads must still fail.
      const allowedOrigins = new Set([origin, new URL(browserSupabaseUrl).origin]);
      expect(requests.filter(({ url }) => !allowedOrigins.has(new URL(url).origin))).toEqual([]);
      expect(requests.filter(({ url, method, argumentFreeServerAction }) => {
        if (["GET", "HEAD", "OPTIONS"].includes(method)) return false;
        const target = new URL(url);
        return !(method === "POST" && target.origin === origin && target.pathname === pageUrl.pathname && argumentFreeServerAction);
      })).toEqual([]);
      expect(requests.filter(({ url }) => new URL(url).pathname === "/api/beans/label")).toEqual([]);
    },
  };
}

async function withLabelForm(page: Page, locale: Locale, run: (user: QaUser) => Promise<void>) {
  const user = {
    email: `beanmap-qa-label-${randomUUID()}@local.test`,
    password: randomBytes(24).toString("hex"),
  };
  const userId = await ensureUser(user.email, user.password);
  let testFailed = false;
  try {
    // Authenticate through the real app. Only the browser OCR worker is mocked.
    await page.goto(`/${locale}/login`);
    await page.locator('[name="email"]').fill(user.email);
    await page.locator('[name="password"]').fill(user.password);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
    // Follow the rendered empty-state action after the login redirect commits.
    // Starting another document navigation at URL-change time races WebKit's redirect.
    await page.locator(`main a[href="/${locale}/beans/new"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/beans/new$`));
    const t = locale === "ko" ? ko : en;
    await expect(page.locator("button").filter({ hasText: t.beans.labelImport.choose })).toBeVisible();
    await run(user);
  } catch (error) {
    testFailed = true;
    throw error;
  } finally {
    try {
      if (!page.isClosed()) {
        try {
          await page.evaluate(() => window.qaBrowserOcr?.dispose());
          await page.unrouteAll({ behavior: "wait" });
        } catch (error) {
          // A failed navigation can destroy the context during cleanup too.
          // Keep that original failure visible while still deleting the QA user.
          if (!page.isClosed() && !testFailed) throw error;
        }
      }
    } finally {
      // A cancelled run can close the page before route cleanup completes.
      // User deletion must still run even if that cleanup throws.
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
    }
  }
}

async function enterExistingDetails(page: Page) {
  await page.locator('[name="name"]').fill("My existing coffee");
  await page.locator('[name="roastery"]').fill("My existing roastery");
  await page.locator('[name="note"]').fill("My own tasting note: peach and chocolate.");
  const score = page.getByRole("slider");
  await score.press("End");
  for (let step = 0; step < 3; step += 1) await score.press("ArrowLeft");
}

async function expectExistingDetails(page: Page) {
  await expect(page.locator('[name="name"]')).toHaveValue("My existing coffee");
  await expect(page.locator('[name="roastery"]')).toHaveValue("My existing roastery");
  await expect(page.locator('[name="process_method"]')).toHaveValue("washed");
  await expect(page.locator('[name="roast_level"]')).toHaveValue("medium");
  await expectTastingDetails(page);
}

async function expectTastingDetails(page: Page) {
  await expect(page.locator('[name="note"]')).toHaveValue("My own tasting note: peach and chocolate.");
  await expect(page.getByRole("slider")).toHaveValue("8.5");
}

async function openFieldChoices(review: Locator) {
  const choices = review.getByTestId("label-field-choices");
  if (await choices.getAttribute("open") === null) await choices.locator("summary").click();
  return choices;
}

async function openRecognizedText(panel: Locator, label: string) {
  const summary = panel.locator("summary").filter({ hasText: label });
  if (await summary.locator("..").getAttribute("open") === null) await summary.click();
  return panel.locator("pre");
}

async function compactLabelPhoto(page: Page) {
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 800;
    const context = canvas.getContext("2d")!;
    for (let x = 0; x < canvas.width; x += 1) {
      const shade = 150 + Math.floor(x / canvas.width * 50);
      context.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
      context.fillRect(x, 0, 1, canvas.height);
    }
    // A compact block of hollow glyphs deterministically creates real crop and full-image passes.
    // Match the geometry exercised by the image-region tests without relying on installed fonts.
    for (let line = 0; line < 3; line += 1) {
      for (let character = 0; character < 30; character += 1) {
        const left = 120 + character * 12;
        const top = 400 + line * 34;
        context.fillStyle = "rgb(75, 75, 75)";
        context.fillRect(left, top, 8, 14);
        context.fillStyle = "rgb(185, 185, 185)";
        context.fillRect(left + 2, top + 2, 4, 10);
      }
    }
    return canvas.toDataURL("image/png").split(",")[1];
  });
  return { name: "compact-label-two-views.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") };
}

for (const mobile of [false, true]) {
  test(`${mobile ? "@mobile " : ""}ko blend name survives a later scan missing its closing parenthesis`, async ({ page }) => {
    test.setTimeout(90_000);
    const t = ko;
    const label = t.beans.labelImport;
    const missingParenthesis = requestedBlend.name.slice(0, -1);
    await withLabelForm(page, "ko", async () => {
      const ocr = await mockBrowserOcr(page, [
        { text: requestedBlendText },
        { text: requestedBlendText.replace(requestedBlend.name, missingParenthesis), deferred: true },
      ]);
      await page.getByLabel(label.choose, { exact: true }).setInputFiles(await compactLabelPhoto(page));
      await expect.poll(async () => (await ocr.snapshot()).reads).toBe(2);
      const panel = page.getByRole("region", { name: label.sectionTitle, exact: true });
      const review = page.getByRole("group", { name: label.review, exact: true });
      const heading = review.getByTestId("label-result-summary").getByRole("heading");
      const apply = review.getByRole("button", { name: label.apply, exact: true });
      await expect(panel).toHaveAttribute("aria-busy", "true");
      await expect(review.getByText(label.partialResult, { exact: true })).toBeVisible();
      await expect(heading).toHaveText(requestedBlend.name);
      await expect(apply).toHaveCount(0);
      await expect(page.locator('[name="name"]')).toHaveValue("");
      const note = "My note typed while the full photo is still being read";
      await page.locator('[name="note"]').fill(note);
      const score = await page.getByRole("slider").inputValue();

      await ocr.release(1);
      await expect(panel).toHaveAttribute("aria-busy", "false");
      await expect(heading).toHaveText(requestedBlend.name);
      await expect(apply).toBeEnabled();
      const state = await ocr.snapshot();
      expect(state.reads).toBe(2);
      expect(state.completions).toBe(2);
      expect(state.images[0].sha256).not.toBe(state.images[1].sha256);
      const raw = await openRecognizedText(panel, label.rawText);
      const lines = (await raw.innerText()).split("\n");
      expect(lines).toContain(requestedBlend.name);
      expect(lines).toContain(missingParenthesis);
      await ocr.expectBrowserOnly();

      await apply.click();
      await expect(page.locator('[name="name"]')).toHaveValue(requestedBlend.name);
      await expect(heading).toHaveText(requestedBlend.name);
      await expect(page.locator('[name="note"]')).toHaveValue(note);
      await expect(page.getByRole("slider")).toHaveValue(score);
      await expect(page.locator('[name="weight_g"]')).toHaveValue("200");
      await expect(page).toHaveURL(/\/ko\/beans\/new$/u);
    });
  });
}

for (const locale of ["ko", "en"] as const) {
  test(`${locale} manual dependent edits invalidate selected OCR parent fields`, async ({ page }) => {
    const t = locale === "ko" ? ko : en;
    const label = t.beans.labelImport;
    await withLabelForm(page, locale, async () => {
      await mockBrowserOcr(page);
      await enterExistingDetails(page);
      await page.getByLabel(label.choose, { exact: true }).setInputFiles(photo);
      const review = page.getByRole("group", { name: label.review, exact: true });
      await expect(review).toBeVisible();
      await openFieldChoices(review);
      const process = review.getByRole("checkbox", { name: t.beans.processMethod, exact: true });
      const country = review.getByRole("checkbox", { name: t.beans.originCountry, exact: true });
      await process.check();
      await expect(country).toBeChecked();
      await page.getByRole("button", { name: t.beans.moreDetails, exact: true }).click();
      await page.locator('[name="process_detail"]').fill("My new hand-entered fermentation detail");
      await expect(process).not.toBeChecked();
      await page.locator('[name="origin_region"]').fill("My new hand-entered region");
      await expect(country).not.toBeChecked();
      await review.getByRole("button", { name: label.apply, exact: true }).click();
      await expect(page.locator('[name="process_method"]')).toHaveValue("washed");
      await expect(page.locator('[name="process_detail"]')).toHaveValue("My new hand-entered fermentation detail");
      await expect(page.locator('[name="origin_region"]')).toHaveValue("My new hand-entered region");
    });
  });
  const t = locale === "ko" ? ko : en;
  const label = t.beans.labelImport;

  for (const mobile of [false, true]) {
    test(`${mobile ? "@mobile " : ""}${locale} photo upload automatically previews details and requires explicit replacement before filling`, async ({ page }) => {
      test.setTimeout(90_000);
      await withLabelForm(page, locale, async (user) => {
        const ocr = await mockBrowserOcr(page);
        await enterExistingDetails(page);
        const fileName = mobile ? `${"coffee-package-".repeat(10)}.png` : photo.name;
        await page.getByLabel(label.choose, { exact: true }).setInputFiles({ ...photo, name: fileName });
        await expect(page.getByAltText(label.preview, { exact: true })).toBeVisible();
        const review = page.getByRole("group", { name: label.review, exact: true });
        await expect(review).toBeVisible();
        await expect(review.getByTestId("label-result-summary")).toContainText("Yirgacheffe Natural");
        await expect(review.getByTestId("label-field-choices")).not.toHaveAttribute("open", "");
        await openFieldChoices(review);
        const recognized = await ocr.snapshot();
        expect(recognized.reads).toBe(1);
        expect(recognized.images).toHaveLength(1);
        expect(recognized.images[0].size).toBeGreaterThan(0);
        expect(recognized.images[0].signature).toBe(recognized.workerUrls[0].endsWith(paddleWorkerPath) ? "rgba" : "89504e470d0a1a0a");
        await ocr.expectBrowserOnly();
        await expect(review.getByRole("checkbox")).toHaveCount(11);
        await expect(review).toContainText(label.evidence.replace("{text}", "Origin: Ethiopia"));
        await expectExistingDetails(page);
        await expect(page.locator('[name="origin_country"]')).toHaveValue("");

        for (const fieldLabel of [t.beans.name, t.beans.roastery, t.beans.processMethod, t.beans.processDetail, t.beans.roastLevel]) {
          await expect(review.getByRole("checkbox", { name: fieldLabel, exact: true })).not.toBeChecked();
        }
        await expect(review.getByRole("checkbox", { name: t.beans.processDetail, exact: true })).toBeDisabled();
        await expect(review).toContainText(label.processSelectionHint);
        for (const fieldLabel of [t.beans.originCountry, t.beans.originRegion, t.beans.farmProducer, t.beans.varietal, t.beans.roastDate, t.beans.weight]) {
          await expect(review.getByRole("checkbox", { name: fieldLabel, exact: true })).toBeChecked();
        }

        if (mobile) {
          await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
          const bounds = await review.boundingBox();
          expect(bounds).not.toBeNull();
          expect(bounds!.x).toBeGreaterThanOrEqual(0);
          expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
        }

        // Applying the preselected empty fields must preserve entered values and defaults.
        await review.getByRole("button", { name: label.apply, exact: true }).click();
        await expect(review).toBeVisible();
        await expect(review.getByRole("button", { name: label.apply, exact: true })).toBeDisabled();
        await expect(page.getByRole("status").filter({ hasText: label.applied })).toHaveText(label.applied);
        await expectExistingDetails(page);
        for (const [field, value] of Object.entries({
          origin_country: locale === "ko" ? "에티오피아" : "Ethiopia",
          origin_region: "Yirgacheffe", farm_producer: "QA Washing Station",
          varietal: locale === "ko" ? "에이룸" : "Heirloom",
          process_detail: "", roast_date: "2026-09-01", weight_g: "200",
        })) {
          await expect(page.locator(`[name="${field}"]`)).toHaveValue(value);
        }

        // Re-reading does not silently override existing fields, even when they match the photo.
        await page.getByRole("button", { name: label.retry, exact: true }).click();
        await expect(page.getByRole("region", { name: label.sectionTitle, exact: true })).toHaveAttribute("aria-busy", "false");
        await expect(review).toBeVisible();
        await openFieldChoices(review);
        await expect(review.getByRole("checkbox", { checked: true })).toHaveCount(0);
        await expect(review.getByRole("button", { name: label.apply, exact: true })).toBeDisabled();
        for (const fieldLabel of [t.beans.name, t.beans.roastery, t.beans.processMethod, t.beans.roastLevel]) {
          await review.getByRole("checkbox", { name: fieldLabel, exact: true }).check();
        }
        await expect(review.getByRole("checkbox", { name: t.beans.processDetail, exact: true })).toBeEnabled();
        await review.getByRole("checkbox", { name: t.beans.processDetail, exact: true }).check();
        await expect(review.getByText(label.replaceWarning, { exact: true })).toBeVisible();
        await review.getByRole("button", { name: label.apply, exact: true }).click();
        await expect(page.locator('[name="name"]')).toHaveValue("Yirgacheffe Natural");
        await expect(page.locator('[name="roastery"]')).toHaveValue("QA Label Roastery");
        await expect(page.locator('[name="process_method"]')).toHaveValue("natural");
        await expect(page.locator('[name="process_detail"]')).toHaveValue("Sun dried");
        await expect(page.locator('[name="roast_level"]')).toHaveValue("light");
        await expectTastingDetails(page);
        await expect(page).toHaveURL(new RegExp(`/${locale}/beans/new$`));
        // Filling is not saving: verify with this dedicated user's authenticated database view.
        const { client } = await signIn(user.email, user.password);
        const { count, error } = await client.from("beans").select("id", { count: "exact", head: true });
        if (error) throw error;
        expect(count).toBe(0);
      });
    });
  }

  test(`${locale} photo review preserves later manual edits unless explicitly reselected`, async ({ page }) => {
    test.setTimeout(90_000);
    await withLabelForm(page, locale, async () => {
      await mockBrowserOcr(page, [{ text: "Product: Yirgacheffe Natural\nRoaster: QA Label Roastery" }]);
      await page.getByLabel(label.choose, { exact: true }).setInputFiles(photo);
      const review = page.getByRole("group", { name: label.review, exact: true });
      const nameChoice = review.getByRole("checkbox", { name: t.beans.name, exact: true });
      const roasteryChoice = review.getByRole("checkbox", { name: t.beans.roastery, exact: true });
      const apply = review.getByRole("button", { name: label.apply, exact: true });
      await expect(review).toBeVisible();
      await openFieldChoices(review);
      await expect(nameChoice).toBeChecked();
      await expect(roasteryChoice).toBeChecked();

      // These fields were empty when recognition finished, then the user edited them.
      await page.locator('[name="name"]').fill("Name typed after recognition");
      await expect(nameChoice).not.toBeChecked();
      await expect(roasteryChoice).toBeChecked();
      await page.locator('[name="roastery"]').fill("Roastery typed after recognition");
      await expect(roasteryChoice).not.toBeChecked();
      await expect(apply).toBeDisabled();

      // Explicitly reselecting one field permits only that replacement.
      await roasteryChoice.check();
      await expect(roasteryChoice).toBeChecked();
      await expect(nameChoice).not.toBeChecked();
      await expect(review.getByText(label.replaceWarning, { exact: true })).toBeVisible();
      await apply.click();
      await expect(review).toBeVisible();
      await expect(apply).toBeDisabled();
      await expect(page.locator('[name="name"]')).toHaveValue("Name typed after recognition");
      await expect(page.locator('[name="roastery"]')).toHaveValue("QA Label Roastery");
    });
  });

  test(`${locale} unsupported photos and recognition failure preserve input for retry`, async ({ page }) => {
    test.setTimeout(90_000);
    await withLabelForm(page, locale, async () => {
      const ocr = await mockBrowserOcr(page, [
        { error: "QA recognition failure" },
        { text: labelText },
      ]);
      await enterExistingDetails(page);
      const file = page.getByLabel(label.choose, { exact: true });
      await file.setInputFiles({ name: "package.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') });
      await expect(page.getByRole("status").filter({ hasText: label.errors.invalid_image })).toHaveText(label.errors.invalid_image);
      await expect(page.getByRole("button", { name: label.retry, exact: true })).toHaveCount(0);
      expect((await ocr.snapshot()).reads).toBe(0);
      await expectExistingDetails(page);

      const giant = Buffer.from(photo.buffer);
      giant.writeUInt32BE(6000, 16);
      giant.writeUInt32BE(6000, 20);
      await file.setInputFiles({ name: "giant-compressed.png", mimeType: "image/png", buffer: giant });
      await expect(page.getByRole("status").filter({ hasText: label.errors.image_too_large })).toHaveText(label.errors.image_too_large);
      await expect(page.getByAltText(label.preview, { exact: true })).toHaveCount(0);
      expect((await ocr.snapshot()).reads).toBe(0);
      await expectExistingDetails(page);

      await file.setInputFiles(photo);
      await expect(page.getByRole("status").filter({ hasText: label.errors.recognition_failed })).toHaveText(label.errors.recognition_failed);
      await expect(page.getByRole("group", { name: label.review, exact: true })).toHaveCount(0);
      await expectExistingDetails(page);
      await expect(page.getByAltText(label.preview, { exact: true })).toBeVisible();

      await page.getByRole("button", { name: label.retry, exact: true }).click();
      await expect(page.getByRole("group", { name: label.review, exact: true })).toBeVisible();
      expect((await ocr.snapshot()).reads).toBe(2);
      await expectExistingDetails(page);
    });
  });

  test(`${locale} cancel and replacement ignore late recognition responses`, async ({ page }) => {
    test.setTimeout(90_000);
    await withLabelForm(page, locale, async () => {
      const ocr = await mockBrowserOcr(page, [
        { text: "Product: Stale response", deferred: true },
        { text: "Product: Stale response", deferred: true },
        { text: labelText, deferred: true },
      ], true);
      await enterExistingDetails(page);
      const file = page.getByLabel(label.choose, { exact: true });
      const read = page.getByRole("button", { name: label.retry, exact: true });
      const review = page.getByRole("group", { name: label.review, exact: true });
      await file.setInputFiles(photo);
      await expect.poll(async () => (await ocr.snapshot()).reads).toBe(1);
      const photoPanel = page.getByRole("region", { name: label.sectionTitle, exact: true });
      await photoPanel.getByRole("button", { name: label.cancel, exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: label.cancelled })).toHaveText(label.cancelled);
      await expect.poll(async () => (await ocr.snapshot()).terminated).toContain(0);
      await ocr.release(0);
      await expect.poll(async () => (await ocr.snapshot()).completions).toBe(1);
      await expect(review).toHaveCount(0);
      await expectExistingDetails(page);

      await read.click();
      await expect.poll(async () => (await ocr.snapshot()).reads).toBe(2);
      await file.setInputFiles({ ...photo, name: "replacement-package.png" });
      await expect(page.getByText("replacement-package.png", { exact: true })).toBeVisible();
      await expect.poll(async () => (await ocr.snapshot()).reads).toBe(3);
      await expect.poll(async () => (await ocr.snapshot()).terminated).toContain(1);
      await ocr.release(1);
      await expect.poll(async () => (await ocr.snapshot()).completions).toBe(2);
      await expect(review).toHaveCount(0);
      await expect(page.getByText("Stale response", { exact: true })).toHaveCount(0);
      await expectExistingDetails(page);
      await ocr.release(2);
      await expect(review).toBeVisible();
      await expect(review).toContainText("Yirgacheffe Natural");
      expect((await ocr.snapshot()).reads).toBe(3);
      await expectExistingDetails(page);
    });
  });
}

const retainedLabelText = "Product: Original coffee\nRoaster: Original roastery\nNet weight: 200 g";

for (const outcome of ["complete", "cancel"] as const) {
  test(`ko detector refinement ${outcome} preserves manual input and rejects stale workers`, async ({ page }) => {
    test.setTimeout(90_000);
    const label = ko.beans.labelImport;
    await withLabelForm(page, "ko", async () => {
      const ocr = await mockBrowserOcr(page, [
        { text: "Product: Recovered coffee\nOrigin: Ethiopia", scores: [0.1, 0.99] },
        { text: "Product: Recovered coffee\nOrigin: Ethiopia\nNet weight: 200 g", deferred: true },
      ], outcome === "cancel");
      await page.getByLabel(label.choose, { exact: true }).setInputFiles(photo);
      await expect.poll(async () => (await ocr.snapshot()).reads).toBeGreaterThanOrEqual(1);
      test.skip(!(await ocr.snapshot()).workerUrls[0].endsWith(paddleWorkerPath), "Detector refinement applies to the Paddle reader.");
      await expect.poll(async () => (await ocr.snapshot()).reads).toBe(2);
      const panel = page.getByRole("region", { name: label.sectionTitle, exact: true });
      await expect(panel).toHaveAttribute("aria-busy", "true");
      await expect(panel.getByRole("heading", { level: 3 })).toHaveText(label.readingName);
      await expect(panel.getByText(label.missingName, { exact: true })).toHaveCount(0);
      const state = await ocr.snapshot();
      expect(state.workerUrls[1]).toContain(workerPath);
      expect(state.terminated).toContain(0);
      await page.locator('[name="name"]').fill("My name during refinement");
      await page.locator('[name="note"]').fill("My impression during refinement");
      if (outcome === "cancel") {
        await panel.getByRole("button", { name: label.cancel, exact: true }).click();
        await expect(panel.getByRole("status")).toHaveText(label.cancelled);
        await ocr.release(1);
        await expect.poll(async () => (await ocr.snapshot()).completions).toBe(2);
        await expect(panel.getByTestId("label-result")).toHaveCount(0);
        await ocr.expectBrowserOnly();
      } else {
        await ocr.release(1);
        await expect(panel).toHaveAttribute("aria-busy", "false");
        await expect(panel.getByRole("heading")).toHaveText("Recovered coffee");
        await expect(panel.getByRole("status")).toHaveText(/^원두 정보 \d+개를 읽었습니다\.$/);
        await ocr.expectBrowserOnly();
        await panel.getByRole("button", { name: label.apply, exact: true }).click();
        await expect(page.locator('[name="weight_g"]')).toHaveValue("200");
      }
      await expect(page.locator('[name="name"]')).toHaveValue("My name during refinement");
      await expect(page.locator('[name="note"]')).toHaveValue("My impression during refinement");
    });
  });
}

for (const mobile of [false, true]) {
  test(`${mobile ? "@mobile " : ""}ko invalid replacement preserves the current photo, review, and choices`, async ({ page }) => {
    test.setTimeout(90_000);
    const label = ko.beans.labelImport;
    await withLabelForm(page, "ko", async () => {
      const ocr = await mockBrowserOcr(page, [{ text: retainedLabelText }]);
      const file = page.getByLabel(label.choose, { exact: true });
      await file.setInputFiles(photo);
      const panel = page.getByRole("region", { name: label.sectionTitle, exact: true });
      const review = panel.getByRole("group", { name: label.review, exact: true });
      const apply = review.getByRole("button", { name: label.apply, exact: true });
      await expect(apply).toBeEnabled();
      await openFieldChoices(review);
      const roastery = review.getByRole("checkbox", { name: ko.beans.roastery, exact: true });
      await roastery.uncheck();
      const raw = await openRecognizedText(panel, label.rawText);
      const preview = page.getByAltText(label.preview, { exact: true });
      const source = await preview.getAttribute("src");
      await page.locator('[name="note"]').fill("My note survives an invalid replacement");
      const giant = Buffer.from(photo.buffer);
      giant.writeUInt32BE(6000, 16);
      giant.writeUInt32BE(6000, 20);
      const invalidPhotos = [
        { file: { name: "wrong.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") }, code: "invalid_image" },
        { file: { name: "corrupt.png", mimeType: "image/png", buffer: Buffer.from("not an image") }, code: "invalid_image" },
        { file: { name: "oversized.png", mimeType: "image/png", buffer: giant }, code: "image_too_large" },
      ] as const;
      for (const invalid of invalidPhotos) {
        await file.setInputFiles(invalid.file);
        await expect(panel.getByRole("status")).toHaveText(label.errors[invalid.code]);
        await expect(preview).toHaveAttribute("src", source!);
        await expect(panel.getByText(photo.name, { exact: true })).toBeVisible();
        await expect(review.getByRole("heading")).toHaveText("Original coffee");
        await expect(raw).toHaveText(retainedLabelText);
        await expect(roastery).not.toBeChecked();
        await expect(apply).toBeEnabled();
        expect((await ocr.snapshot()).reads).toBe(1);
      }
      await apply.click();
      await expect(page.locator('[name="name"]')).toHaveValue("Original coffee");
      await expect(page.locator('[name="roastery"]')).toHaveValue("");
      await expect(page.locator('[name="note"]')).toHaveValue("My note survives an invalid replacement");
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    });
  });
}

test("ko invalid replacement leaves the active recognition running", async ({ page }) => {
  test.setTimeout(90_000);
  const label = ko.beans.labelImport;
  await withLabelForm(page, "ko", async () => {
    const ocr = await mockBrowserOcr(page, [{ text: retainedLabelText, deferred: true }]);
    const file = page.getByLabel(label.choose, { exact: true });
    await file.setInputFiles(photo);
    await expect.poll(async () => (await ocr.snapshot()).reads).toBe(1);
    const panel = page.getByRole("region", { name: label.sectionTitle, exact: true });
    const preview = page.getByAltText(label.preview, { exact: true });
    const source = await preview.getAttribute("src");
    await file.setInputFiles({ name: "corrupt.png", mimeType: "image/png", buffer: Buffer.from("not an image") });
    await expect(panel.getByRole("status")).toHaveText(label.errors.invalid_image);
    await expect(panel).toHaveAttribute("aria-busy", "true");
    await expect(preview).toHaveAttribute("src", source!);
    expect((await ocr.snapshot()).terminated).toEqual([]);
    await ocr.release(0);
    await expect(panel).toHaveAttribute("aria-busy", "false");
    await expect(panel.getByRole("heading")).toHaveText("Original coffee");
    await expect(panel.getByRole("status")).toHaveText(label.found.replace("{count}", "3"));
  });
});

for (const action of ["replace", "remove", "retry"] as const) {
  test(`ko ${action} ignores an older photo whose validation finishes late`, async ({ page }) => {
    test.setTimeout(90_000);
    const label = ko.beans.labelImport;
    await withLabelForm(page, "ko", async () => {
      const ocr = await mockBrowserOcr(page, [
        { text: retainedLabelText },
        { text: "Product: Latest coffee\nNet weight: 250 g" },
      ]);
      const file = page.getByLabel(label.choose, { exact: true });
      const panel = page.getByRole("region", { name: label.sectionTitle, exact: true });
      await file.setInputFiles(photo);
      await expect(panel.getByRole("button", { name: label.apply, exact: true })).toBeEnabled();
      // Delay only disk-byte delivery; the real header validator still checks those bytes.
      await page.evaluate(() => {
        const read = File.prototype.arrayBuffer;
        File.prototype.arrayBuffer = async function () {
          const bytes = await read.call(this);
          if (this.name === "slow-replacement.png") {
            window.qaPhotoReadStarted = true;
            await new Promise<void>(resolve => { window.qaReleasePhotoRead = resolve; });
          }
          return bytes;
        };
      });
      await file.setInputFiles({ ...photo, name: "slow-replacement.png" });
      await expect.poll(() => page.evaluate(() => window.qaPhotoReadStarted)).toBe(true);
      if (action === "replace") {
        await file.setInputFiles({ ...photo, name: "latest-replacement.png" });
        await expect(panel.getByRole("heading")).toHaveText("Latest coffee");
      } else if (action === "retry") {
        await panel.getByRole("button", { name: label.retry, exact: true }).click();
        await expect(panel.getByRole("heading")).toHaveText("Latest coffee");
      } else {
        await panel.getByRole("button", { name: label.remove, exact: true }).click();
      }
      await page.evaluate(async () => {
        window.qaReleasePhotoRead?.();
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      });
      await expect(panel.getByText("slow-replacement.png", { exact: true })).toHaveCount(0);
      if (action !== "remove") {
        await expect(panel.getByText(action === "replace" ? "latest-replacement.png" : photo.name, { exact: true })).toBeVisible();
        await expect(panel.getByRole("heading")).toHaveText("Latest coffee");
        expect((await ocr.snapshot()).reads).toBe(2);
      } else {
        await expect(panel.getByTestId("label-result")).toHaveCount(0);
        await expect(page.getByAltText(label.preview, { exact: true })).toHaveCount(0);
        expect((await ocr.snapshot()).reads).toBe(1);
      }
    });
  });
}

test("ko same-photo rescan keeps previous facts through partial reads and replaces them only on success", async ({ page }) => {
  test.setTimeout(90_000);
  const t = ko;
  const label = t.beans.labelImport;
  await withLabelForm(page, "ko", async () => {
    const ocr = await mockBrowserOcr(page, [
      { text: retainedLabelText },
      { text: retainedLabelText },
      { text: "Product: Rescanned coffee\nRoaster: Rescanned roastery\nNet weight: 250", deferred: true },
      { text: "Net weight: 250 g", deferred: true },
      { text: "Net weight: 250 g" },
    ]);
    await page.getByLabel(label.choose, { exact: true }).setInputFiles(await compactLabelPhoto(page));
    const panel = page.getByRole("region", { name: label.sectionTitle, exact: true });
    const review = page.getByRole("group", { name: label.review, exact: true });
    const apply = review.getByRole("button", { name: label.apply, exact: true });
    await expect(apply).toBeEnabled();
    await expect(panel.getByRole("button", { name: label.retry, exact: true })).toHaveCount(1);
    const rescan = review.getByRole("button", { name: label.retry, exact: true });
    await expect(rescan).toBeVisible();
    await openFieldChoices(review);
    await review.getByRole("checkbox", { name: t.beans.roastery, exact: true }).uncheck();
    const raw = await openRecognizedText(panel, label.rawText);
    await expect(raw).toContainText(retainedLabelText);
    const originalRaw = await raw.textContent();
    const source = await page.getByAltText(label.preview, { exact: true }).getAttribute("src");

    await rescan.click();
    await expect.poll(async () => (await ocr.snapshot()).reads).toBe(3);
    await expect(panel).toHaveAttribute("aria-busy", "true");
    await expect(review.getByText(label.previousResult, { exact: true })).toBeVisible();
    await expect(review.getByTestId("label-result-summary")).toContainText("Original coffee");
    await expect(apply).toBeDisabled();
    for (const checkbox of await review.getByRole("checkbox").all()) await expect(checkbox).toBeDisabled();
    await expect(raw).toBeVisible();
    await expect(raw).toHaveText(originalRaw!);
    expect((await ocr.snapshot()).images[2].sha256).toBe((await ocr.snapshot()).images[0].sha256);
    await expect(page.getByAltText(label.preview, { exact: true })).toHaveAttribute("src", source!);

    // The next pass emits a partial extraction; it must not displace a previous successful result.
    await ocr.release(2);
    await expect.poll(async () => (await ocr.snapshot()).reads).toBe(4);
    await expect(panel).toHaveAttribute("aria-busy", "true");
    await expect(review.getByTestId("label-result-summary")).toContainText("Original coffee");
    await expect(review.getByTestId("label-result-summary")).not.toContainText("Rescanned coffee");
    await expect(raw).toHaveText(originalRaw!);
    await expect(review.getByRole("checkbox", { name: t.beans.roastery, exact: true })).not.toBeChecked();
    await expect(apply).toBeDisabled();
    await page.locator('[name="name"]').fill("My name entered during rescan");

    await ocr.release(3);
    await expect(panel).toHaveAttribute("aria-busy", "false");
    await expect(review.getByTestId("label-result-summary")).toContainText("Rescanned coffee");
    await expect(review.getByTestId("label-result-summary")).toContainText("Rescanned roastery");
    await expect(review.getByLabel(`${t.beans.weight}: 250 g`, { exact: true })).toBeVisible();
    await expect(review.getByText(label.previousResult, { exact: true })).toHaveCount(0);
    await expect(raw).toContainText("Product: Rescanned coffee");
    await expect(raw).not.toContainText("Original coffee");
    await openFieldChoices(review);
    await expect(review.getByRole("checkbox", { name: t.beans.name, exact: true })).not.toBeChecked();
    await apply.click();
    await expect(page.locator('[name="name"]')).toHaveValue("My name entered during rescan");
    await expect(page.locator('[name="roastery"]')).toHaveValue("Rescanned roastery");
    await expect(page.locator('[name="weight_g"]')).toHaveValue("250");
  });
});

for (const scenario of [
  { locale: "en", outcome: "failure", mobile: false },
  { locale: "ko", outcome: "no_fields", mobile: false },
  { locale: "en", outcome: "cancel", mobile: true },
] as const) {
  test(`${scenario.mobile ? "@mobile " : ""}${scenario.locale} rescan ${scenario.outcome} preserves previous text, selected fields, and later manual edits`, async ({ page }) => {
    test.setTimeout(90_000);
    const t = scenario.locale === "ko" ? ko : en;
    const label = t.beans.labelImport;
    await withLabelForm(page, scenario.locale, async () => {
      const reply = scenario.outcome === "failure" ? { error: "QA rescan failure", deferred: true }
        : { text: scenario.outcome === "no_fields" ? "" : "Product: Late cancelled coffee", deferred: true };
      // After the deferred empty first pass, optional native/contrast rereads
      // must also complete empty so this exercises exhaustion of the real reader.
      const ocr = await mockBrowserOcr(page, [{ text: retainedLabelText }, reply,
        ...(scenario.outcome === "no_fields" ? [{ text: "" }] : []),
      ], scenario.outcome === "cancel");
      await page.getByLabel(label.choose, { exact: true }).setInputFiles(photo);
      const panel = page.getByRole("region", { name: label.sectionTitle, exact: true });
      const review = page.getByRole("group", { name: label.review, exact: true });
      const apply = review.getByRole("button", { name: label.apply, exact: true });
      await expect(apply).toBeEnabled();
      await openFieldChoices(review);
      const name = review.getByRole("checkbox", { name: t.beans.name, exact: true });
      const roastery = review.getByRole("checkbox", { name: t.beans.roastery, exact: true });
      const weight = review.getByRole("checkbox", { name: t.beans.weight, exact: true });
      await roastery.uncheck();
      await expect(name).toBeChecked();
      await expect(weight).toBeChecked();
      const raw = await openRecognizedText(panel, label.rawText);
      await expect(raw).toHaveText(retainedLabelText);

      await review.getByRole("button", { name: label.retry, exact: true }).click();
      await expect.poll(async () => (await ocr.snapshot()).reads).toBe(2);
      await expect(panel).toHaveAttribute("aria-busy", "true");
      await expect(apply).toBeDisabled();
      await expect(review.getByText(label.previousResult, { exact: true })).toBeVisible();
      await expect(raw).toHaveText(retainedLabelText);
      await page.locator('[name="name"]').fill("My coffee entered during rescan");
      await page.locator('[name="note"]').fill("My own tasting note: peach and chocolate.");
      await page.getByRole("slider").press("End");
      for (let step = 0; step < 3; step += 1) await page.getByRole("slider").press("ArrowLeft");

      if (scenario.outcome === "cancel") {
        await panel.getByRole("button", { name: label.cancel, exact: true }).click();
        await expect(panel.getByRole("status")).toHaveText(label.cancelled);
        await ocr.release(1);
        await expect.poll(async () => (await ocr.snapshot()).completions).toBe(2);
      } else {
        await ocr.release(1);
        const expectedError = scenario.outcome === "failure" ? label.errors.recognition_failed : label.errors.no_fields;
        await expect(panel.getByRole("status")).toHaveText(expectedError);
        if (scenario.outcome === "no_fields") expect((await ocr.snapshot()).reads).toBeGreaterThanOrEqual(2);
      }
      await expect(panel).toHaveAttribute("aria-busy", "false");
      await expect(review.getByText(label.previousResult, { exact: true })).toBeVisible();
      await expect(review.getByTestId("label-result-summary")).toContainText("Original coffee");
      await expect(raw).toBeVisible();
      await expect(raw).toHaveText(retainedLabelText);
      await expect(name).not.toBeChecked();
      await expect(roastery).not.toBeChecked();
      await expect(weight).toBeChecked();
      await expect(weight).toBeEnabled();
      await expect(panel.getByRole("button", { name: label.retry, exact: true })).toHaveCount(1);
      await expect(review.getByRole("button", { name: label.retry, exact: true })).toBeEnabled();
      await expect(page.locator('[name="name"]')).toHaveValue("My coffee entered during rescan");
      await expectTastingDetails(page);
      await apply.click();
      await expect(page.locator('[name="name"]')).toHaveValue("My coffee entered during rescan");
      await expect(page.locator('[name="roastery"]')).toHaveValue("");
      await expect(page.locator('[name="weight_g"]')).toHaveValue("200");
      await expect(panel.getByRole("status")).toHaveText(label.applied);
      await expect(panel.getByText(label.filledTitle, { exact: true })).toBeVisible();
      await expectTastingDetails(page);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    });
  });
}

test("ko replacing the photo during rescan clears old facts and rejects late responses", async ({ page }) => {
  test.setTimeout(90_000);
  const label = ko.beans.labelImport;
  await withLabelForm(page, "ko", async () => {
    const ocr = await mockBrowserOcr(page, [
      { text: retainedLabelText },
      { text: "Product: Stale rescan coffee", deferred: true },
      { text: "Product: Replacement photo coffee\nNet weight: 250 g", deferred: true },
    ], true);
    const file = page.getByLabel(label.choose, { exact: true });
    await file.setInputFiles(photo);
    const panel = page.getByRole("region", { name: label.sectionTitle, exact: true });
    const review = page.getByRole("group", { name: label.review, exact: true });
    await expect(review.getByRole("button", { name: label.apply, exact: true })).toBeEnabled();
    await openRecognizedText(panel, label.rawText);
    await review.getByRole("button", { name: label.retry, exact: true }).click();
    await expect.poll(async () => (await ocr.snapshot()).reads).toBe(2);
    await expect(review.getByTestId("label-result-summary")).toContainText("Original coffee");
    await page.locator('[name="note"]').fill("My note while replacing the photo");

    await file.setInputFiles({ ...photo, name: "replacement-during-rescan.png" });
    await expect.poll(async () => (await ocr.snapshot()).reads).toBe(3);
    await expect(panel.getByText("replacement-during-rescan.png", { exact: true })).toBeVisible();
    await expect(review).toHaveCount(0);
    await expect(panel.locator("pre")).toHaveCount(0);
    await ocr.release(1);
    await expect.poll(async () => (await ocr.snapshot()).completions).toBe(2);
    await expect(review).toHaveCount(0);
    await expect(panel).not.toContainText("Stale rescan coffee");
    await expect(panel).not.toContainText("Original coffee");
    await ocr.release(2);
    await expect(panel).toHaveAttribute("aria-busy", "false");
    await expect(review.getByTestId("label-result-summary")).toContainText("Replacement photo coffee");
    await expect(review.getByLabel(`${ko.beans.weight}: 250 g`, { exact: true })).toBeVisible();
    const raw = await openRecognizedText(panel, label.rawText);
    await expect(raw).toHaveText("Product: Replacement photo coffee\nNet weight: 250 g");
    await expect(page.locator('[name="note"]')).toHaveValue("My note while replacing the photo");
    await expect(page.locator('[name="name"]')).toHaveValue("");

    await panel.getByRole("button", { name: label.remove, exact: true }).click();
    await expect(page.getByAltText(label.preview, { exact: true })).toHaveCount(0);
    await expect(review).toHaveCount(0);
    await expect(panel.locator("pre")).toHaveCount(0);
    await expect(panel.getByRole("button", { name: label.retry, exact: true })).toHaveCount(0);
    await expect(page.locator('[name="note"]')).toHaveValue("My note while replacing the photo");
  });
});

test("recognized country replaces previously loaded origin suggestions", async ({ page }) => {
  test.setTimeout(90_000);
  const t = en;
  const label = t.beans.labelImport;
  await withLabelForm(page, "en", async () => {
    await mockBrowserOcr(page, [{ text: "Origin: Colombia\nRegion: Huila" }]);
    const country = page.locator('[name="origin_country"]');
    const region = page.locator('[name="origin_region"]');
    await country.fill("Ethiopia");
    await page.getByRole("option").filter({ hasText: "Ethiopia" }).click();
    await region.fill("Gedeb");
    const ethiopiaRegion = page.getByRole("option").filter({ hasText: "Gedeb" });
    await expect(ethiopiaRegion).toBeVisible();
    await ethiopiaRegion.click();
    await expect(region).toHaveValue("Gedeb");

    await page.getByLabel(label.choose, { exact: true }).setInputFiles(photo);
    const review = page.getByRole("group", { name: label.review, exact: true });
    await expect(review).toBeVisible();
    await expect(page.getByRole("region", { name: label.sectionTitle, exact: true })).toHaveAttribute("aria-busy", "false");
    await expect(review.getByRole("heading", { level: 3 })).toHaveText(label.missingName);
    await openFieldChoices(review);
    await review.getByRole("checkbox", { name: t.beans.originCountry, exact: true }).check();
    await review.getByRole("checkbox", { name: t.beans.originRegion, exact: true }).check();
    await review.getByRole("button", { name: label.apply, exact: true }).click();
    await expect(country).toHaveValue("Colombia");
    await expect(region).toHaveValue("Huila");

    // An old region must not be pickable under the newly recognized country.
    await region.fill("Gedeb");
    await expect(ethiopiaRegion).toHaveCount(0);
    await region.fill("Huila");
    const colombiaRegion = page.getByRole("option", { name: "Huila 우일라", exact: true });
    await expect(colombiaRegion).toBeVisible();
    await colombiaRegion.click();
    await expect(region).toHaveValue("Huila");
    await expect(country).toHaveValue("Colombia");
  });
});

test("editing the origin cancels the new blend's automatic composition and process choices", async ({ page }) => {
  const t = ko;
  const label = t.beans.labelImport;
  await withLabelForm(page, "ko", async () => {
    await mockBrowserOcr(page, [{ text: requestedBlendText }]);
    await page.getByLabel(label.choose, { exact: true }).setInputFiles(photo);
    const review = page.getByRole("group", { name: label.review, exact: true });
    await openFieldChoices(review);
    const composition = review.getByRole("checkbox", { name: t.beans.blendComposition, exact: true });
    const process = review.getByRole("checkbox", { name: t.beans.processMethod, exact: true });
    const detail = review.getByRole("checkbox", { name: t.beans.processDetail, exact: true });
    for (const choice of [composition, process, detail]) await expect(choice).toBeChecked();

    await page.locator('[name="origin_country"]').fill("Brazil");
    for (const choice of [composition, process, detail]) await expect(choice).not.toBeChecked();
    await expect(detail).toBeDisabled();
    await review.getByRole("button", { name: label.apply, exact: true }).click();
    await expect(page.getByRole("radio", { name: t.beans.singleOrigin, exact: true })).toHaveAttribute("aria-checked", "true");
    await expect(page.locator('[name="origin_country"]')).toHaveValue("Brazil");
    await expect(page.locator('[name="process_method"]')).toHaveValue("washed");
    await expect(page.locator('[name="process_detail"]')).toHaveValue("");
    await expect(page.locator('[name="weight_g"]')).toHaveValue("200");
  });
});

test("deselecting the new blend cancels its automatic process but permits an explicit process choice", async ({ page }) => {
  const t = en;
  const label = t.beans.labelImport;
  await withLabelForm(page, "en", async () => {
    await mockBrowserOcr(page, [{ text: requestedBlendText }]);
    await page.getByLabel(label.choose, { exact: true }).setInputFiles(photo);
    const review = page.getByRole("group", { name: label.review, exact: true });
    await openFieldChoices(review);
    const composition = review.getByRole("checkbox", { name: t.beans.blendComposition, exact: true });
    const process = review.getByRole("checkbox", { name: t.beans.processMethod, exact: true });
    const detail = review.getByRole("checkbox", { name: t.beans.processDetail, exact: true });
    for (const choice of [composition, process, detail]) await expect(choice).toBeChecked();

    await composition.uncheck();
    for (const choice of [composition, process, detail]) await expect(choice).not.toBeChecked();
    await expect(detail).toBeDisabled();
    // Choosing the recipe again is a new explicit choice; revoked automatic process choices stay off.
    await composition.check();
    await expect(composition).toBeChecked();
    await expect(process).not.toBeChecked();
    await expect(detail).not.toBeChecked();
    await composition.uncheck();
    await process.check();
    await expect(process).toBeChecked();
    await expect(composition).not.toBeChecked();
    await expect(detail).toBeEnabled();
    await detail.check();
    await review.getByRole("button", { name: label.apply, exact: true }).click();
    await expect(page.getByRole("radio", { name: t.beans.singleOrigin, exact: true })).toHaveAttribute("aria-checked", "true");
    await expect(page.locator('[name="process_method"]')).toHaveValue("other");
    await expect(page.locator('[name="process_detail"]')).toHaveValue("Washed 60% / White Honey 40%");
    await expect(page.locator('[name="weight_g"]')).toHaveValue("200");
  });
});

for (const locale of ["ko", "en"] as const) {
  test(`${locale} reading shows partial facts while the remaining weight is being recognized`, async ({ page }) => {
    const t = locale === "ko" ? ko : en;
    const label = t.beans.labelImport;
    await withLabelForm(page, locale, async () => {
      const ocr = await mockBrowserOcr(page, [
        { text: "Product: Coffee seen first\nNet weight: 250" },
        { text: "Net weight: 250 g", deferred: true },
        { text: "Net weight: 250 g" },
      ]);
      await page.getByLabel(label.choose, { exact: true }).setInputFiles(await compactLabelPhoto(page));
      await expect.poll(async () => (await ocr.snapshot()).reads).toBe(2);
      const panel = page.getByRole("region", { name: label.sectionTitle, exact: true });
      const review = page.getByRole("group", { name: label.review, exact: true });
      await expect(panel).toHaveAttribute("aria-busy", "true");
      await expect(panel.getByRole("progressbar")).toBeVisible();
      await expect(review.getByTestId("label-result-summary")).toContainText("Coffee seen first");
      await expect(review.getByText(label.partialResult, { exact: true })).toBeVisible();
      await expect(review.getByRole("button", { name: label.apply, exact: true })).toHaveCount(0);
      await expect(page.locator('[name="name"]')).toHaveValue("");
      await page.locator('[name="name"]').fill("My name typed while reading");
      await ocr.release(1);
      await expect(panel).toHaveAttribute("aria-busy", "false");
      await expect(review.getByLabel(`${t.beans.weight}: 250 g`, { exact: true })).toBeVisible();
      await ocr.expectBrowserOnly();
      await review.getByRole("button", { name: label.apply, exact: true }).click();
      await expect(page.locator('[name="name"]')).toHaveValue("My name typed while reading");
      await expect(page.locator('[name="weight_g"]')).toHaveValue("250");
    });
  });

  for (const mobile of [false, true]) {
    test(`${mobile ? "@mobile " : ""}${locale} uploading the requested blend immediately shows composition and cup notes with one-click basic fill`, async ({ page }) => {
      const t = locale === "ko" ? ko : en;
      const label = t.beans.labelImport;
      await withLabelForm(page, locale, async (user) => {
        const ocr = await mockBrowserOcr(page, [{ text: requestedBlendText }]);
        await page.locator('[name="note"]').fill("My own tasting note: peach and chocolate.");
        await page.getByRole("slider").press("End");
        for (let step = 0; step < 3; step += 1) await page.getByRole("slider").press("ArrowLeft");
        await page.getByRole("button", { name: t.beans.moreDetails, exact: true }).click();
        await page.locator('[name="tasting_tags_draft"]').fill("my-personal-tag");
        await page.getByRole("button", { name: t.beans.addTag, exact: true }).click();
        const personalTag = page.getByRole("button", { name: t.beans.removeTag.replace("{tag}", "my-personal-tag"), exact: true });
        await expect(personalTag).toBeVisible();
        const tags = page.locator('[name="tasting_tags_draft"]').locator("..").locator("..");
        const tagState = () => tags.getByRole("button").evaluateAll((buttons) => buttons.map((button) => ({
          label: button.getAttribute("aria-label") || button.textContent,
          pressed: button.getAttribute("aria-pressed"),
        })));
        const originalTags = await tagState();

        // No Read click or checkbox selection is needed to get the complete label preview.
        await page.getByLabel(label.choose, { exact: true }).setInputFiles(photo);
        const review = page.getByRole("group", { name: label.review, exact: true });
        const apply = review.getByRole("button", { name: label.apply, exact: true });
        await expect(apply).toBeEnabled();
        await expect(review.getByTestId("label-result-summary")).toContainText(requestedBlend.name);
        await expect(review.getByLabel(`${t.beans.weight}: 200 g`, { exact: true })).toBeVisible();
        const composition = review.getByTestId("label-composition").getByRole("listitem");
        await expect(composition).toHaveCount(2);
        for (let index = 0; index < requestedBlend.composition.length; index += 1) {
          const row = composition.nth(index);
          const [description, percentage] = requestedBlend.composition[index].split(/ (?=\d+%$)/u);
          await expect(row.locator(":scope > span")).toHaveText(percentage);
          await expect(row.locator("p")).toHaveText(description);
        }
        const notes = review.getByTestId("label-tasting-notes");
        await expect(notes.locator('[lang="en"]')).toHaveText(requestedBlend.notesEn);
        await expect(notes.locator('[lang="ko"]')).toContainText(requestedBlend.translatedKo);
        await expect(notes.locator('[lang="ko"]')).toContainText(label.translatedNotes);
        await expect(review.getByTestId("label-field-choices")).not.toHaveAttribute("open", "");
        await expect(page.locator('[name="name"]')).toHaveValue("");
        await expect(page.getByRole("radio", { name: t.beans.singleOrigin, exact: true })).toHaveAttribute("aria-checked", "true");
        await expectTastingDetails(page);
        await ocr.expectBrowserOnly();

        await apply.click();
        await expect(page.locator('[name="name"]')).toHaveValue(requestedBlend.name);
        await expect(page.getByRole("radio", { name: t.beans.blend, exact: true })).toHaveAttribute("aria-checked", "true");
        await expect(page.locator('[name="blend_percentage_0"]')).toHaveValue("60");
        await expect(page.locator('[name="blend_percentage_1"]')).toHaveValue("40");
        await expect(page.locator('[name="process_method"]')).toHaveValue("other");
        await expect(page.locator('[name="process_detail"]')).toHaveValue("Washed 60% / White Honey 40%");
        await expect(page.locator('[name="weight_g"]')).toHaveValue("200");
        await expect(page.locator('[name="roastery"]')).toHaveValue("");
        await expectTastingDetails(page);
        await expect(personalTag).toBeVisible();
        expect(await tagState()).toEqual(originalTags);
        await expect(notes).toBeVisible();
        await expect(apply).toBeDisabled();
        await page.locator("summary").filter({ hasText: label.rawText }).click();
        await expect(page.getByRole("region", { name: label.sectionTitle, exact: true }).locator("pre")).toContainText(requestedBlend.notesKo);
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
        const { client } = await signIn(user.email, user.password);
        const { count, error } = await client.from("beans").select("id", { count: "exact", head: true });
        if (error) throw error;
        expect(count).toBe(0);
      });
    });

    test(`${mobile ? "@mobile " : ""}${locale} printed blend requires explicit selection and preserves manual changes`, async ({ page }) => {
      const t = locale === "ko" ? ko : en;
      const label = t.beans.labelImport;
      await withLabelForm(page, locale, async () => {
        const ocr = await mockBrowserOcr(page, [{ text: "Product: Sample Blend\nRoaster: Test Roastery\nEthiopia Gedeb 74110, Kurume Washed 60%\nEthiopia Bursa Main Station 74158 White Honey 40%\n200g" }]);
        await enterExistingDetails(page);
        await page.getByLabel(label.choose, { exact: true }).setInputFiles(photo);
        const review = page.getByRole("group", { name: label.review, exact: true });
        await expect(review).toBeVisible();
        const choices = await openFieldChoices(review);
        const composition = review.getByRole("checkbox", { name: t.beans.blendComposition, exact: true });
        await expect(composition).not.toBeChecked();
        await expect(choices.getByRole("listitem")).toHaveCount(2);
        await expect(choices.getByRole("listitem").nth(0)).toContainText("60%");
        await expect(choices.getByRole("listitem").nth(1)).toContainText("40%");
        await ocr.expectBrowserOnly();
        await composition.check();
        await page.locator('[name="origin_country"]').fill("Brazil");
        await expect(composition).not.toBeChecked();
        await composition.check();
        await review.getByRole("checkbox", { name: t.beans.processMethod, exact: true }).check();
        await review.getByRole("checkbox", { name: t.beans.processDetail, exact: true }).check();
        await review.getByRole("button", { name: label.apply, exact: true }).click();
        await expect(page.getByRole("radio", { name: t.beans.blend, exact: true })).toHaveAttribute("aria-checked", "true");
        await expect(page.locator('[name="blend_percentage_0"]')).toHaveValue("60");
        await expect(page.locator('[name="blend_percentage_1"]')).toHaveValue("40");
        await expect(page.locator('[name="name"]')).toHaveValue("My existing coffee");
        await expect(page.locator('[name="process_method"]')).toHaveValue("other");
        await expectTastingDetails(page);
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
        // Returning to single-origin retains the person's earlier input.
        await page.getByRole("radio", { name: t.beans.singleOrigin, exact: true }).click();
        await expect(page.locator('[name="origin_country"]')).toHaveValue(locale === "ko" ? "브라질" : "Brazil");
      });
    });
  }
}
