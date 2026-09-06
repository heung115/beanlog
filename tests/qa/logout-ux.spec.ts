import { randomBytes, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import ko from "../../src/i18n/ko.json" with { type: "json" };
import en from "../../src/i18n/en.json" with { type: "json" };
import { landingCopy } from "../../src/content/landing";
import { getSupabaseCookieName } from "../../src/lib/supabase/cookie-name";
import { SESSION_ONLY_COOKIE_NAME } from "../../src/lib/supabase/session-persistence";
import { admin, browserSupabaseUrl, ensureUser } from "./helpers";

const account = {
  email: `beanmap-qa-logout-${randomUUID()}@local.test`,
  password: randomBytes(24).toString("hex"),
};
let accountId: string;
test.beforeAll(async () => { accountId = await ensureUser(account.email, account.password); });
test.afterAll(async () => { if (accountId) await admin.auth.admin.deleteUser(accountId); });

async function login(page: Page, locale: "ko" | "en") {
  await page.goto(`/${locale}/login`);
  await page.locator('[name="email"]').fill(account.email);
  await page.locator('[name="password"]').fill(account.password);
  await page.locator('[name="remember"]').uncheck();
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
}

for (const locale of ["ko", "en"] as const) {
  const t = locale === "ko" ? ko : en;
  const copy = landingCopy[locale];
  test(`${locale} logout completes at the public home and stays signed out on reload and back`, async ({ page }) => {
    await login(page, locale);
    await page.getByRole("link", { name: t.nav.settings, exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/settings$`));
    await expect(page.locator('[name="displayName"]')).toBeEnabled();
    await page.getByRole("button", { name: t.auth.logout, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}(?:\\?loggedOut=1)?$`));
    await expect(page.getByRole("status").filter({ hasText: copy.logoutComplete })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/${locale}$`));
    await expect(page.getByRole("link", { name: copy.primaryAction, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: copy.origins.viewAll, exact: true })).toBeVisible();
    await expect(page.locator('[name="email"], [name="displayName"]')).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath("logout-complete.png") });
    const authCookie = getSupabaseCookieName(browserSupabaseUrl);
    expect((await page.context().cookies()).filter(({ name }) => name === authCookie || name.startsWith(`${authCookie}.`) || name === SESSION_ONLY_COOKIE_NAME)).toEqual([]);

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/${locale}/login(?:\\?|$)`));
    await expect(page.locator('[name="email"]')).toBeVisible();
    await expect(page.locator('[name="displayName"], [data-bean-card]')).toHaveCount(0);
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`/${locale}$`));
    await page.reload();
    await expect(page.getByRole("status").filter({ hasText: copy.logoutComplete })).toHaveCount(0);
    await page.goBack();
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/${locale}/login(?:\\?|$)`));
    await page.goto(`/${locale}/settings`);
    await expect(page).toHaveURL(new RegExp(`/${locale}/login\\?next=`));
    await expect(page.locator('[name="displayName"]')).toHaveCount(0);
  });

  test(`${locale} logout prevents duplicate requests and recovers from a connection failure`, async ({ page }) => {
    await login(page, locale);
    await page.goto(`/${locale}/settings`);
    await expect(page.locator('[name="displayName"]')).toBeEnabled();
    await page.locator('[name="displayName"]').fill("Unsaved profile draft");
    let attempts = 0;
    let release: () => void = () => {};
    const waiting = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/*", async (route) => {
      if (route.request().method() !== "POST" || !route.request().headers()["next-action"]) return route.continue();
      attempts++;
      await waiting;
      await route.abort("failed");
    });
    const logout = page.getByRole("button", { name: t.auth.logout, exact: true });
    await logout.click();
    await expect(page.getByRole("button", { name: t.auth.loggingOut, exact: true })).toBeDisabled();
    await page.getByRole("button", { name: t.auth.loggingOut, exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
    await expect.poll(() => attempts).toBe(1);
    release();
    await expect(page.locator("main").getByRole("alert")).toHaveText(t.auth.logoutError);
    await expect(logout).toBeEnabled();
    await expect(page).toHaveURL(new RegExp(`/${locale}/settings$`));
    await expect(page.locator('[name="displayName"]')).toHaveValue("Unsaved profile draft");
    await page.screenshot({ path: test.info().outputPath("logout-retry.png") });
    await page.unrouteAll();
    const authenticatedSettings = await page.request.get(`/${locale}/settings`, { maxRedirects: 0 });
    expect(authenticatedSettings.status()).toBe(200);
    await logout.click();
    await expect(page.getByRole("status").filter({ hasText: copy.logoutComplete })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/${locale}$`));
  });
}
