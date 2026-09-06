import { randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import ko from "../../src/i18n/ko.json" with { type: "json" };
import en from "../../src/i18n/en.json" with { type: "json" };
import { landingCopy } from "../../src/content/landing";
import { getSupabaseCookieName } from "../../src/lib/supabase/cookie-name";
import { SESSION_ONLY_COOKIE_NAME } from "../../src/lib/supabase/session-persistence";
import { admin, browserSupabaseUrl, ensureUser } from "./helpers";

for (const locale of ["ko", "en"] as const) {
  const t = locale === "ko" ? ko : en;
  test(`${locale} deleting a dedicated empty account confirms completion at the public home`, async ({ page }) => {
    const account = { email: `beanmap-qa-delete-${randomUUID()}@local.test`, password: randomBytes(24).toString("hex") };
    const id = await ensureUser(account.email, account.password);
    try {
      await page.goto(`/${locale}/login`);
      await page.locator('[name="email"]').fill(account.email);
      await page.locator('[name="password"]').fill(account.password);
      await page.locator('[name="remember"]').uncheck();
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
      await page.goto(`/${locale}/settings`);
      await expect(page.locator('[name="displayName"]')).toBeEnabled();
      await page.getByRole("button", { name: t.settings.deleteAccount, exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: t.common.confirm, exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: landingCopy[locale].accountDeleted })).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`/${locale}$`));
      await expect(page.locator('[name="email"], [name="displayName"]')).toHaveCount(0);
      expect((await admin.auth.admin.getUserById(id)).data.user).toBeNull();
      const authCookie = getSupabaseCookieName(browserSupabaseUrl);
      expect((await page.context().cookies()).filter(({ name }) => name === authCookie || name.startsWith(`${authCookie}.`) || name === SESSION_ONLY_COOKIE_NAME)).toEqual([]);
      await page.screenshot({ path: test.info().outputPath("account-deleted.png") });
      await page.reload();
      await expect(page).toHaveURL(new RegExp(`/${locale}$`));
      await expect(page.getByRole("status").filter({ hasText: landingCopy[locale].accountDeleted })).toHaveCount(0);
      await page.goto(`/${locale}/settings`);
      await expect(page).toHaveURL(new RegExp(`/${locale}/login\\?next=`));
    } finally {
      // Only the generated, empty test account is eligible for cleanup.
      await admin.auth.admin.deleteUser(id);
    }
  });
}
