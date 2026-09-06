import { randomBytes, randomUUID } from "node:crypto";
import axe from "axe-core";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { admin, ensureUser, qaUser } from "./helpers";
import ko from "../../src/i18n/ko.json" with { type: "json" };
import en from "../../src/i18n/en.json" with { type: "json" };

test.use({ actionTimeout: 10_000 });

async function login(page: Page, locale: string, user = qaUser) {
  await page.goto(`/${locale}/login`);
  await page.locator('[name="email"]').fill(user.email);
  await page.locator('[name="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
}

async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

for (const locale of ["ko", "en"] as const) {
  const t = locale === "ko" ? ko : en;
  for (const mobile of [false, true]) {
    test(`${mobile ? "@mobile " : ""}${locale} blend validation and failed saves preserve input`, async ({ page }, info) => {
      test.setTimeout(90_000);
      const user = { email: `beanmap-qa-blend-${randomUUID()}@local.test`, password: randomBytes(24).toString("hex") };
      const id = await ensureUser(user.email, user.password);
      const pageErrors: string[] = [];
      const capturePageError = (error: Error) => pageErrors.push(error.message);
      page.on("pageerror", capturePageError);
      try {
        await login(page, locale, user);
        await page.goto(`/${locale}/beans/new`);
        await page.getByRole("radio", { name: t.beans.blend, exact: true }).click();
        await page.locator('[name="name"]').fill("블렌드 Blend journey");
        await page.locator('[name="roastery"]').fill("QA Roastery");
        await page.locator('[name="note"]').fill("초콜릿과 과일. Chocolate and fruit.");
        await page.locator('[name="blend_origin_0"]').fill("Brazil");
        await page.locator('[name="blend_origin_0"]').press("Tab");
        await page.getByLabel(t.beans.componentPercentage, { exact: true }).first().fill("60");
        await page.getByRole("button", { name: t.beans.addComponent, exact: true }).click();
        await page.locator('[name="blend_origin_1"]').fill("Ethiopia");
        await page.locator('[name="blend_origin_1"]').press("Tab");
        await page.getByLabel(t.beans.componentPercentage, { exact: true }).nth(1).fill("30");
        await fits(page);
        const save = page.locator('button[type="submit"]:not([name="continue"])');
        await save.click();
        await expect(page.locator("#bean-form-errors")).toHaveAttribute("role", "alert");
        await expect(page.locator("#bean-form-errors")).toContainText(t.beans.invalidBlend);
        await page.getByLabel(t.beans.componentPercentage, { exact: true }).nth(1).fill("40");
        await page.route("**/*", async (route) => {
          if (route.request().method() === "POST") await route.abort("failed");
          else await route.continue();
        });
        await save.click();
        await expect(page.locator("#bean-form-errors")).toContainText(t.beans.saveFailed);
        await expect(page.locator('[name="name"]')).toHaveValue("블렌드 Blend journey");
        // Measure errors during the simulated outage. WebKit can report a
        // native access-control error for a fetch canceled by a later full
        // document navigation, even when the action promise has a catch.
        page.off("pageerror", capturePageError);
        expect(pageErrors).toEqual([]);
        await page.unroute("**/*");
        await save.click();
        await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
        await page.getByTestId("bean-card").locator('h3 a').click();
        await expect(page.getByTestId("bean-overall-score")).toBeVisible();
        await fits(page);
        await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}nextjs-portal{display:none!important}" });
        await page.screenshot({ path: info.outputPath("blend-detail.png"), fullPage: true });
        await page.getByRole("button", { name: t.beans.edit, exact: true }).click();
        await expect(page.getByLabel(t.beans.componentPercentage, { exact: true }).first()).toHaveValue("60");
        await expect(page.getByLabel(t.beans.componentPercentage, { exact: true }).nth(1)).toHaveValue("40");
        await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}nextjs-portal{display:none!important}" });
        await page.screenshot({ path: info.outputPath("blend-edit.png"), fullPage: true });
        await page.addScriptTag({ content: axe.source });
        const violations = await page.evaluate(async () => (await (window as typeof window & { axe: typeof axe }).axe.run(document, { resultTypes: ["violations"] })).violations.filter((v) => ["serious", "critical"].includes(v.impact ?? "")).map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })));
        expect(violations).toEqual([]);
        await page.goto(`/${locale}/stats`);
        await expect(page.getByTestId("stats-summary")).toContainText("블렌드 Blend journey");
        await page.goto(`/${locale}/settings`);
        const downloadEvent = page.waitForEvent("download");
        await page.getByRole("button", { name: t.settings.export, exact: true }).click();
        const exported = JSON.parse(await readFile((await (await downloadEvent).path())!, "utf8"));
        expect(exported.beans).toHaveLength(1);
        expect(exported.beans[0].origin_country).toBeNull();
        expect(exported.beans[0].blend_components.map((component: { percentage: number }) => component.percentage)).toEqual([60, 40]);
      } finally {
        await admin.auth.admin.deleteUser(id);
      }
    });

    test(`${mobile ? "@mobile " : ""}${locale} record lifecycle preserves price and edits through export and deletion`, async ({ page }) => {
      test.setTimeout(120_000);
      const user = { email: `beanmap-qa-journey-${randomUUID()}@local.test`, password: randomBytes(24).toString("hex") };
      const id = await ensureUser(user.email, user.password);
      const name = `한영 기록 Journey ${randomUUID().slice(0, 8)}`;
      try {
        await login(page, locale, user);
        await expect(page.getByTestId("explore-empty-state")).toBeVisible();
        await page.goto(`/${locale}/beans/new`);
        await page.locator('[name="name"]').fill(name);
        await page.locator('[name="roastery"]').fill("테스트 Roastery");
        await page.locator('[name="origin_country"]').fill("Ethiopia");
        await page.locator('[name="note"]').fill("자스민과 살구. Jasmine and apricot.");
        await page.locator('[name="consumed_at"]').fill("2026-08-10");
        await page.locator('[aria-controls="bean-detail-fields"]').click();
        await page.locator('[name="price"]').fill("22000");
        await page.locator('[name="weight_g"]').fill("200");
        await fits(page);
        await page.locator('button[type="submit"]:not([name="continue"])').click();
        await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
        await page.getByRole("searchbox").fill(name);
        await page.getByTestId("bean-card").filter({ hasText: name }).locator('h3 a').click();
        await expect(page.getByTestId("bean-overall-score")).toBeVisible();
        const detailUrl = new URL(page.url());
        const beanId = detailUrl.pathname.split("/").at(-1)!;
        await page.goto(`/en/beans/${beanId}`);
        await expect(page.locator("main")).toContainText("KRW 22,000");
        await expect(page.locator("main")).not.toContainText("$22,000");
        await page.goto(`/${locale}/beans/${beanId}/edit`);
        await expect(page.locator('[name="price"]')).toHaveValue("22000");
        await page.locator('[name="note"]').fill("수정한 기록 — revised tasting note");
        await page.locator('button[type="submit"]').click();
        await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
        await page.goto(`/${locale}/stats`);
        await expect(page.getByTestId("stats-summary")).toContainText(name);
        await fits(page);
        await page.goto(`/${locale}/settings`);
        await expect(page.locator('[name="displayName"]')).toBeEnabled();
        const downloadEvent = page.waitForEvent("download");
        await page.getByRole("button", { name: t.settings.export, exact: true }).click();
        const download = await downloadEvent;
        const data = JSON.parse(await readFile((await download.path())!, "utf8"));
        expect(data.beans).toHaveLength(1);
        expect(data.beans[0]).toMatchObject({ id: beanId, price: 22000, note: "수정한 기록 — revised tasting note", consumed_at: expect.stringContaining("2026-08-10") });
        await page.goto(`/${locale}/beans/${beanId}/edit`);
        await page.locator('[name="price"]').fill("0");
        await page.locator('button[type="submit"]').click();
        await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
        await page.goto(`/${locale}/beans/${beanId}`);
        await expect(page.locator("main")).toContainText(locale === "ko" ? "0원" : "KRW 0");
        await page.getByRole("button", { name: t.beans.delete, exact: true }).click();
        await fits(page);
        await page.getByRole("button", { name: t.common.cancel, exact: true }).click();
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
        await page.getByRole("button", { name: t.beans.delete, exact: true }).click();
        await page.getByRole("button", { name: t.beans.delete, exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
        await expect(page.getByTestId("explore-empty-state")).toBeVisible();
        await page.goto(`/${locale}/stats`);
        await expect(page.getByTestId("stats-empty-state")).toBeVisible();
      } finally {
        await admin.auth.admin.deleteUser(id);
      }
    });
  }

  test(`${locale} read failures offer retry while missing records remain distinct`, async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, locale);
    const link = page.getByTestId("bean-card").first().locator('h3 a');
    const path = (await link.getAttribute("href"))!;
    const editUrl = new URL(path, page.url());
    editUrl.pathname += "/edit";
    for (const route of [path, editUrl.href, `/${locale}/stats`, `/${locale}/settings`]) {
      await page.route("**/*", async (request) => {
        if (request.request().method() === "POST" && request.request().headers()["next-action"]) await request.abort("failed");
        else await request.continue();
      });
      await page.goto(route);
      await expect(page.locator("main").getByRole("alert")).toContainText(t.common.loadError);
      await expect(page.getByTestId("stats-empty-state")).toHaveCount(0);
      await page.unroute("**/*");
      await page.getByRole("button", { name: t.common.retry, exact: true }).click();
      await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
      const pathname = new URL(route, page.url()).pathname;
      if (pathname.endsWith("/stats")) await expect(page.getByTestId("stats-summary")).toBeVisible();
      else if (pathname.endsWith("/settings")) await expect(page.locator('[name="displayName"]')).toBeEnabled();
      else if (pathname.endsWith("/edit")) await expect(page.locator('[name="name"]')).toBeVisible();
      else await expect(page.getByTestId("bean-overall-score")).toBeVisible();
    }
    await page.goto(`/${locale}/beans/${randomUUID()}`);
    await expect(page.getByText(t.beans.notFound, { exact: true })).toBeVisible();
    await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  });

  test(`${locale} interrupted pagination retries the same page`, async ({ page }) => {
    await login(page, locale);
    const before = await page.getByTestId("bean-card").count();
    const loadMore = page.getByRole("button", { name: locale === "ko" ? "더 보기" : "Load more", exact: true });
    await expect(loadMore).toBeVisible();
    await page.route("**/*", async (route) => {
      if (route.request().method() === "POST") await route.abort("failed");
      else await route.continue();
    });
    await loadMore.click();
    await expect(page.locator("main").getByRole("alert")).toBeVisible();
    await page.unroute("**/*");
    await loadMore.click();
    await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
    await expect.poll(() => page.getByTestId("bean-card").count()).toBeGreaterThan(before);
    const hrefs = await page.getByTestId("bean-card").locator("h3 a").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  test(`${locale} signup explains mismatched passwords and retains the requested destination`, async ({ page }) => {
    await page.goto(`/${locale}/login?next=${encodeURIComponent(`/${locale}/stats`)}`);
    await page.locator("main").getByRole("link", { name: t.auth.goSignup, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/signup\\?next=`));
    await page.locator('[name="displayName"]').fill("QA coffee");
    await page.locator('[name="email"]').fill("beanmap-validation@local.test");
    await page.locator('[name="password"]').fill("long-password-one");
    await page.locator('[name="passwordConfirm"]').fill("long-password-two");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: t.auth.signup, exact: true }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText(t.auth.passwordMismatch);
    await page.locator("main").getByRole("link", { name: t.auth.goLogin, exact: true }).click();
    await expect(page.locator('[name="next"]')).toHaveValue(`/${locale}/stats`);
  });

  test(`${locale} failed account deletion leaves cancel and retry available`, async ({ page }) => {
    await login(page, locale);
    await page.goto(`/${locale}/settings`);
    await expect(page.locator('[name="displayName"]')).toBeEnabled();
    await page.getByRole("button", { name: t.settings.deleteAccount, exact: true }).click();
    await page.route("**/*", async (route) => {
      if (route.request().method() === "POST") await route.abort("failed");
      else await route.continue();
    });
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: t.common.confirm, exact: true }).click();
    await expect(dialog.getByRole("alert")).toHaveText(t.settings.deleteError);
    await expect(dialog.getByRole("button", { name: t.common.confirm, exact: true })).toBeEnabled();
    await dialog.getByRole("button", { name: t.common.cancel, exact: true }).click();
    await expect(dialog).toHaveCount(0);
  });

  test(`${locale} profile and language settings persist across visits and account deletion finishes`, async ({ page, browser }) => {
    test.setTimeout(90_000);
    const user = { email: `beanmap-qa-account-${randomUUID()}@local.test`, password: randomBytes(24).toString("hex") };
    const id = await ensureUser(user.email, user.password);
    try {
      await login(page, locale, user);
      await page.goto(`/${locale}/settings`);
      const name = page.locator('[name="displayName"]');
      await expect(name).toBeEnabled();
      await name.fill("새 이름 New name");
      await page.locator('form button[type="submit"]').click();
      await expect(page.getByRole("banner")).toContainText("새 이름 New name");
      await name.fill("저장하지 않은 이름 Unsaved");
      const other = locale === "ko" ? "en" : "ko";
      await page.getByRole("radio", { name: locale === "ko" ? t.settings.english : t.settings.korean, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${other}/settings$`));
      await expect(page.locator("html")).toHaveAttribute("lang", other);
      const languageCookie = (await page.context().cookies()).find((cookie) => cookie.name === "NEXT_LOCALE");
      expect(languageCookie?.value).toBe(other);
      expect(languageCookie!.expires).toBeGreaterThan(Date.now() / 1000 + 60 * 60 * 24 * 300);
      const revisit = await browser.newContext({ locale: locale === "ko" ? "ko-KR" : "en-US" });
      try {
        // Carry only the durable preference into a new browser session whose
        // browser language disagrees, without copying authentication cookies.
        await revisit.addCookies([languageCookie!]);
        const revisitPage = await revisit.newPage();
        await revisitPage.goto(new URL("/", page.url()).href);
        await expect(revisitPage).toHaveURL(new RegExp(`/${other}$`));
        await expect(revisitPage.locator("html")).toHaveAttribute("lang", other);
      } finally {
        await revisit.close();
      }
      await page.reload();
      const next = other === "ko" ? ko : en;
      await expect(name).toHaveValue("저장하지 않은 이름 Unsaved");
      await expect(page.getByTestId("record-draft-notice")).toContainText(next.draft.recovered);
      await page.getByRole("button", { name: next.draft.discard, exact: true }).click();
      await page.getByRole("button", { name: next.draft.discardYes, exact: true }).click();
      await expect(name).toHaveValue("새 이름 New name");
      await page.getByRole("button", { name: next.auth.logout, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${other}$`));
      await login(page, other, user);
      await page.goto(`/${other}/settings`);
      await expect(name).toHaveValue("새 이름 New name");
      await page.getByRole("button", { name: next.settings.deleteAccount, exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: next.common.confirm, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${other}$`));
      const result = await admin.auth.admin.getUserById(id);
      expect(result.data.user).toBeNull();
    } finally {
      // Only this test's generated account is eligible for cleanup.
      await admin.auth.admin.deleteUser(id);
    }
  });
}
