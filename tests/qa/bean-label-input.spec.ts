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

type OcrReply = { text?: string; error?: string; deferred?: boolean };
type OcrSnapshot = {
  reads: number;
  completions: number;
  images: { size: number; signature: string }[];
  workerUrls: string[];
  corePaths: string[];
  langPaths: string[];
  languages: string[];
  terminated: number[];
};
type OcrControl = OcrSnapshot & {
  release: (index: number) => void;
  dispose: () => void;
};
declare global {
  interface Window { qaBrowserOcr?: OcrControl }
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
  await page.route(`**${workerPath}`, async (route) => {
    expect(route.request().method()).toBe("GET");
    await route.fulfill({
      contentType: "application/javascript",
      body: `
        const pending = new Map();
        const respond = (message) => {
          const { workerId, jobId, action, qa } = message;
          const reply = qa.reply;
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
          if (action === "recognize") {
            self.postMessage({ workerId, jobId, action, status: "progress",
              data: { status: "recognizing text", progress: 0.5 } });
            if (qa.reply.deferred) pending.set(qa.index, message);
            else respond(message);
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
      langPaths: [], languages: [], terminated: [],
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
          if (data?.action === "recognize" && ["resolve", "reject"].includes(data.status)) state.completions += 1;
        });
      }
      postMessage(message: unknown, transferOrOptions?: Transferable[] | StructuredSerializeOptions) {
        const request = message as {
          action?: string;
          payload?: { image?: Uint8Array; langs?: string | string[]; options?: { corePath?: string; langPath?: string } };
        };
        let outgoing = message;
        if (request.action === "load") state.corePaths.push(request.payload?.options?.corePath ?? "");
        if (request.action === "loadLanguage") {
          state.langPaths.push(request.payload?.options?.langPath ?? "");
          const langs = request.payload?.langs;
          state.languages.push(Array.isArray(langs) ? langs.join("+") : langs ?? "");
        }
        if (request.action === "recognize") {
          const index = state.reads++;
          recognizingWorkers[index] = this;
          const image = request.payload?.image;
          state.images.push({
            size: image?.byteLength ?? 0,
            signature: Array.from(image?.slice(0, 8) ?? []).map((byte) => byte.toString(16).padStart(2, "0")).join(""),
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

  const snapshot = () => page.evaluate(() => {
    const state = window.qaBrowserOcr!;
    return {
      reads: state.reads, completions: state.completions, images: state.images,
      workerUrls: state.workerUrls, corePaths: state.corePaths, langPaths: state.langPaths,
      languages: state.languages, terminated: state.terminated,
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
      expect(state.workerUrls.every((url) => url === `${origin}${workerPath}`)).toBe(true);
      expect(state.corePaths.length).toBeGreaterThan(0);
      expect(state.corePaths.every((path) => new URL(path, origin).href === `${origin}/ocr/tesseract-7.0.0/core`)).toBe(true);
      expect(state.langPaths.length).toBeGreaterThan(0);
      expect(state.langPaths.every((path) => new URL(path, origin).href === `${origin}/ocr/tesseract-7.0.0/lang`)).toBe(true);
      expect(state.languages.every((langs) => langs.split("+").sort().join("+") === "eng+kor")).toBe(true);
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
  try {
    // Authenticate through the real app. Only the browser OCR worker is mocked.
    await page.goto(`/${locale}/login`);
    await page.locator('[name="email"]').fill(user.email);
    await page.locator('[name="password"]').fill(user.password);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
    await page.goto(`/${locale}/beans/new`);
    const t = locale === "ko" ? ko : en;
    await expect(page.locator("button").filter({ hasText: t.beans.labelImport.choose })).toBeVisible();
    await run(user);
  } finally {
    try {
      if (!page.isClosed()) {
        try {
          await page.evaluate(() => window.qaBrowserOcr?.dispose());
          await page.unrouteAll({ behavior: "wait" });
        } catch (error) {
          if (!page.isClosed()) throw error;
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
        expect(recognized.images[0].signature).toBe("89504e470d0a1a0a");
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
      ]);
      await page.getByLabel(label.choose, { exact: true }).setInputFiles(photo);
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
