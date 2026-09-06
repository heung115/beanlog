import { randomBytes, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { expect, test, type Request } from "@playwright/test";
import { admin, ensureUser } from "./helpers";
import ko from "../../src/i18n/ko.json" with { type: "json" };
import en from "../../src/i18n/en.json" with { type: "json" };

for (const locale of ["ko", "en"] as const) {
  for (const mobile of [false, true]) {
    test(`${mobile ? "@mobile " : ""}${locale} browser OCR reads a real image locally and saves reviewed fields`, async ({ page, browser, context, baseURL }, info) => {
      test.setTimeout(180_000);
      const t = locale === "ko" ? ko : en;
      const email = `beanmap-qa-browser-ocr-${randomUUID()}@local.test`;
      const password = randomBytes(24).toString("hex");
      const id = await ensureUser(email, password);
      const imagePath = info.outputPath("synthetic-label.png");
      const expected = locale === "ko"
        ? { name: "우일라 워시드", roastery: "테스트 로스터리", origin_country: "Colombia", origin_region: "Huila", process_method: "washed", roast_level: "medium", roast_date: "2026-09-01", weight_g: 250 }
        : { name: "Ethiopia Yirgacheffe", roastery: "Sample Roastery", origin_country: "Ethiopia", origin_region: "Yirgacheffe", process_method: "natural", roast_level: "light", roast_date: "2026-09-01", weight_g: 200 };
      const lines = locale === "ko" ? [
        "원두명: 우일라 워시드", "로스터리: 테스트 로스터리", "원산지: 콜롬비아", "지역: Huila",
        "품종: Caturra", "가공법: 워시드", "배전도: 미디엄", "로스팅일: 2026-09-01", "내용량: 250 g",
      ] : [
        "Product: Ethiopia Yirgacheffe", "Roaster: Sample Roastery", "Origin: Ethiopia", "Region: Yirgacheffe",
        "Variety: Heirloom", "Process: Natural", "Roast level: Light", "Roasted on: 2026-09-01", "Net weight: 200 g",
      ];
      try {
        const fixture = await browser.newPage({ viewport: { width: 1200, height: 1150 } });
        try {
          await fixture.setContent(`<html lang="${locale}"><meta charset="UTF-8"><style>body{margin:0;padding:65px;background:#e9e1d0;color:#21190e;font-family:Arial,"Apple SD Gothic Neo",sans-serif}main{background:white;padding:50px;border:2px solid #493b26}small{font-size:22px}p{font-size:40px;line-height:1.6;margin:20px 0}</style><main><small>BEANMAP · SYNTHETIC TEST LABEL</small><p>${lines.join("<br>")}</p></main></html>`);
          await fixture.screenshot({ path: imagePath });
        } finally { await fixture.close(); }
        await page.goto(`/${locale}/login`);
        await page.locator("[name=email]").fill(email);
        await page.locator("[name=password]").fill(password);
        await page.locator("button[type=submit]").click();
        await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
        await page.goto(`/${locale}/beans/new`);
        const note = "내 감상은 그대로 / Chocolate and apricot";
        await page.locator("[name=note]").fill(note);
        await page.getByRole("slider").press("End");
        for (let n = 0; n < 3; n++) await page.getByRole("slider").press("ArrowLeft");
        const requests: { url: string; method: string; emptyPageAction: boolean }[] = [];
        const collect = (request: Request) => requests.push({
          url: request.url(), method: request.method(),
          emptyPageAction: request.method() === "POST" && request.url() === page.url()
            && Boolean(request.headers()["next-action"]) && request.postData() === "[]",
        });
        context.on("request", collect);
        await page.locator("input[type=file]").setInputFiles(imagePath);
        expect(requests.filter((entry) => entry.url.includes("/ocr/"))).toHaveLength(0);
        const started = Date.now();
        await page.getByRole("button", { name: t.beans.labelImport.read, exact: true }).click();
        const review = page.getByRole("group", { name: t.beans.labelImport.review, exact: true });
        await expect(review).toBeVisible({ timeout: 120_000 });
        const elapsedSeconds = (Date.now() - started) / 1000;
        await page.locator("summary").filter({ hasText: t.beans.labelImport.rawText }).click();
        const text = await page.locator("pre[aria-label]").innerText();
        await writeFile(info.outputPath("recognized.txt"), text);
        const origin = new URL(baseURL!).origin;
        expect(requests.every((entry) => !entry.url.startsWith("http") || new URL(entry.url).origin === origin)).toBe(true);
        expect(requests.filter((entry) => !["GET", "HEAD", "OPTIONS"].includes(entry.method) && !entry.emptyPageAction)).toEqual([]);
        expect(requests.some((entry) => entry.url.endsWith("worker.min.js"))).toBe(true);
        expect(requests.some((entry) => entry.url.includes("kor.traineddata"))).toBe(true);
        expect(requests.some((entry) => entry.url.includes("eng.traineddata"))).toBe(true);
        context.off("request", collect);

        if (!mobile && locale === "ko") {
          // A warm reader continues to work with all browser networking disabled.
          await context.setOffline(true);
          try {
            await page.getByRole("button", { name: t.beans.labelImport.read, exact: true }).click();
            await expect(review).toBeVisible({ timeout: 60_000 });
          } finally { await context.setOffline(false); }
        }
        await expect(page.locator("[name=name]")).toHaveValue("");
        for (const name of [t.beans.processMethod, t.beans.roastLevel]) await review.getByRole("checkbox", { name, exact: true }).check();
        await review.getByRole("button", { name: t.beans.labelImport.apply, exact: true }).click();
        await expect(page.locator("[name=name]")).toHaveValue(expected.name);
        await expect(page.locator("[name=roastery]")).toHaveValue(expected.roastery);
        await expect(page.locator("[name=note]")).toHaveValue(note);
        await expect(page.getByRole("slider")).toHaveValue("8.5");
        // A g misread as 0 is deliberately not guessed. The reviewer supplies
        // that missing optional field from the visible package before saving.
        const manualFields: string[] = [];
        if (await page.getByRole("button", { name: t.beans.moreDetails, exact: true }).count()) {
          await page.getByRole("button", { name: t.beans.moreDetails, exact: true }).click();
        }
        if (await page.locator("[name=weight_g]").inputValue() === "") {
          manualFields.push("weight_g");
          await page.locator("[name=weight_g]").fill(String(expected.weight_g));
        }
        const unsaved = await context.newPage();
        try {
          await unsaved.goto(`/${locale}/explore`);
          await expect(unsaved.getByTestId("bean-card")).toHaveCount(0);
        } finally { await unsaved.close(); }
        await page.reload();
        await expect(page.locator("[name=name]")).toHaveValue(expected.name);
        await page.locator("button[type=submit]:not([name=continue])").click();
        await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
        await expect(page.getByTestId("bean-card")).toHaveCount(1);
        await page.getByTestId("bean-card").locator("h3 a").click();
        await page.getByRole("button", { name: t.beans.edit, exact: true }).click();
        await expect(page.locator("[name=name]")).toHaveValue(expected.name);
        await expect(page.locator("[name=note]")).toHaveValue(note);
        await page.goto(`/${locale}/settings`);
        const download = page.waitForEvent("download");
        await page.getByRole("button", { name: t.settings.export, exact: true }).click();
        const saved = JSON.parse(await readFile((await (await download).path())!, "utf8"));
        expect(saved.beans).toHaveLength(1);
        expect(saved.beans[0]).toMatchObject({ ...expected, note, overall_score: 8.5 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
        await writeFile(info.outputPath("verification.json"), JSON.stringify({ locale, mobile, elapsedSeconds, requests, expected, manualFields }, null, 2));
      } finally {
        await context.setOffline(false);
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) throw error;
      }
    });
  }
}
