import { randomBytes, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import ko from "../../src/i18n/ko.json" with { type: "json" };
import en from "../../src/i18n/en.json" with { type: "json" };
import { admin, ensureUser, qaApiURL, signIn } from "./helpers";

const account = { email: `beanmap-qa-live-ux-${randomUUID()}@local.test`, password: randomBytes(24).toString("hex") };
let accountId: string;
let beanId: string;
const longText = "LongUnbrokenCoffeeValue".repeat(8);
const note = "첫 번째 줄\nSecond line\n\nFourth line";

test.beforeAll(async ({ request }) => {
  if (!qaApiURL || !["localhost", "127.0.0.1"].includes(new URL(qaApiURL).hostname)) throw new Error("UX regressions require isolated loopback staging");
  accountId = await ensureUser(account.email, account.password);
  const { session } = await signIn(account.email, account.password);
  const response = await request.post(`${qaApiURL}/api/beans`, { headers: { Authorization: `Bearer ${session.access_token}` }, data: {
    name: longText, roastery: longText, bean_type: "single_origin", origin_country: "Ethiopia", origin_region: "R".repeat(100),
    farm_producer: longText, varietal: "V".repeat(100), process_method: "washed", process_detail: longText,
    roast_level: "medium", place_type: "cafe", cafe_name: longText, overall_score: 8.5,
    consumed_at: "2026-08-31T00:00:00Z", roast_date: "2026-08-20", purchased_at: "2026-08-22", altitude_m: 0,
    note, score_aroma: 5, tags: [{ tag: "t".repeat(50), category: "other" }],
  } });
  expect(response.status()).toBe(201);
  const data = await response.json();
  beanId = data.id;
  expect(beanId).toBeTruthy();
});
test.afterAll(async () => {
  if (accountId) {
    const { error } = await admin.auth.admin.deleteUser(accountId);
    if (error) throw error;
  }
});
async function login(page: Page, locale: "ko" | "en") {
  await page.goto(`/${locale}/login`);
  await page.locator('[name="email"]').fill(account.email);
  await page.locator('[name="password"]').fill(account.password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
}

for (const locale of ["ko", "en"] as const) {
  const t = locale === "ko" ? ko : en;
  test(`${locale} detail preserves long text, line breaks, zero altitude and missing scores`, async ({ page }, info) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await login(page, locale);
    await page.goto(`/${locale}/beans/${beanId}`);
    await expect(page.getByTestId("bean-detail-header")).toContainText(longText);
    const noteElement = page.getByTestId("bean-overall-score").locator("p");
    expect(await noteElement.innerText()).toBe(note);
    expect(await noteElement.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe("pre-wrap");
    await expect(page.getByTestId("bean-origin-info")).toContainText("0m");
    const scores = page.getByTestId("bean-detail-scores");
    await expect(scores).toContainText(t.beans.partialDetailScores);
    await expect(page.getByTestId("bean-detail-radar")).toHaveCount(0);
    await expect(scores.locator(`[aria-label="${t.beans.notRated}"]`)).toHaveCount(5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: info.outputPath("detail-320.png"), fullPage: true, animations: "disabled" });
    await page.goto(`/${locale}/stats`);
    await expect(page.getByTestId("stats-summary")).toContainText(longText);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });

  test(`${locale} no-JavaScript detail and stats explain the limitation and keep a working records link`, async ({ page, browser, baseURL }) => {
    await login(page, locale);
    const context = await browser.newContext({ baseURL, storageState: await page.context().storageState(), javaScriptEnabled: false });
    try {
      const nativePage = await context.newPage();
      for (const [path, message] of [[`beans/${beanId}`, t.beans.detailJavascriptRequired], ["stats", t.beans.statsJavascriptRequired]]) {
        await nativePage.goto(`/${locale}/${path}`);
        const notice = nativePage.getByRole("alert").filter({ hasText: message });
        await expect(notice).toBeVisible();
        await notice.getByRole("link", { name: t.beans.back, exact: true }).click();
        await expect(nativePage).toHaveURL(new RegExp(`/${locale}/explore$`));
      }
    } finally { await context.close(); }
  });

  test(`${locale} guest invalid calendar date identifies the input and save/edit transitions restore focus`, async ({ page }) => {
    await page.goto(`/${locale}/try`);
    for (const [name, value] of Object.entries({ name: "Guest keyboard coffee", roastery: "Roastery", origin_country: "Ethiopia", note: "Guest note" })) await page.locator(`[name="${name}"]`).fill(value);
    const date = page.locator('[name="consumed_at"]');
    await date.fill("10000-01-01");
    await page.getByRole("button", { name: t.guest.temporarySave, exact: true }).click();
    await expect(date).toBeFocused();
    await expect(date).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#guest-form-error")).toContainText(t.beans.consumedAt);
    await expect(page.getByRole("article", { name: t.guest.savedTitle })).toHaveCount(0);
    await date.fill("2026-08-31");
    await page.getByRole("button", { name: t.guest.temporarySave, exact: true }).click();
    await expect(page.getByRole("heading", { name: t.guest.savedTitle, exact: true })).toBeFocused();
    await page.getByRole("button", { name: t.guest.edit, exact: true }).click();
    await expect(page.locator('[name="name"]')).toBeFocused();
    await expect(date).toHaveValue("2026-08-31");
  });

  test(`${locale} deleting tasting tags keeps keyboard focus and accessible target size`, async ({ page }) => {
    await login(page, locale);
    await page.goto(`/${locale}/beans/new`);
    const detailToggle = page.getByRole("button", { name: t.beans.moreDetails, exact: true });
    if (await detailToggle.count()) await detailToggle.click();
    const input = page.locator('[name="tasting_tags_draft"]');
    for (const tag of ["alpha-custom", "beta-custom"]) {
      await input.fill(tag);
      await page.getByRole("button", { name: t.beans.addTag, exact: true }).click();
      await expect(input).toBeFocused();
    }
    const first = page.getByRole("button", { name: t.beans.removeTag.replace("{tag}", "alpha-custom"), exact: true });
    const second = page.getByRole("button", { name: t.beans.removeTag.replace("{tag}", "beta-custom"), exact: true });
    const box = await first.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(24);
    expect(box!.height).toBeGreaterThanOrEqual(24);
    await first.focus();
    await first.press("Enter");
    await expect(second).toBeFocused();
    await second.press("Enter");
    await expect(input).toBeFocused();
  });

  test(`${locale} account dialog initial focus cannot overwrite the first keyboard move`, async ({ page }) => {
    await login(page, locale);
    await page.goto(`/${locale}/settings`);
    await expect(page.locator('[name="displayName"]')).toBeEnabled();
    // Hold the first frame after showModal to deterministically model a Tab before it paints.
    await page.evaluate(() => {
      const originalShow = HTMLDialogElement.prototype.showModal;
      const originalRaf = window.requestAnimationFrame.bind(window);
      const state = window as typeof window & { qaFocusFrames?: FrameRequestCallback[]; qaReleaseFocusFrames?: () => void };
      state.qaFocusFrames = [];
      HTMLDialogElement.prototype.showModal = function () {
        originalShow.call(this);
        window.requestAnimationFrame = (callback) => {
          state.qaFocusFrames!.push(callback);
          return originalRaf(() => {});
        };
      };
      state.qaReleaseFocusFrames = () => {
        window.requestAnimationFrame = originalRaf;
        for (const callback of state.qaFocusFrames!.splice(0)) callback(performance.now());
      };
    });
    await page.getByRole("button", { name: t.settings.deleteAccount, exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: t.common.cancel, exact: true })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByRole("button", { name: t.common.confirm, exact: true })).toBeFocused();
    await page.evaluate(() => (window as typeof window & { qaReleaseFocusFrames: () => void }).qaReleaseFocusFrames());
    await expect(dialog.getByRole("button", { name: t.common.confirm, exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: t.settings.deleteAccount, exact: true })).toBeFocused();
  });
}

test("API midnight calendar dates stay on the recorded day in a Los Angeles browser", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, timezoneId: "America/Los_Angeles" });
  try {
    const page = await context.newPage();
    await login(page, "en");
    await expect(page.getByTestId("bean-card").first()).toContainText("Aug 31, 2026");
    await page.goto(`/en/beans/${beanId}`);
    await expect(page.getByTestId("bean-detail-header")).toContainText("Aug 31, 2026");
    await expect(page.getByTestId("bean-process-roast-info")).toContainText("Aug 20, 2026");
  } finally { await context.close(); }
});
