import { expect, test } from "@playwright/test";
import ko from "../../src/i18n/ko.json" with { type: "json" };
import en from "../../src/i18n/en.json" with { type: "json" };

for (const locale of ["ko", "en"] as const) {
  const t = locale === "ko" ? ko : en;
  test(`${locale} expired or cancelled social sign-in explains how to retry`, async ({ page }) => {
    await page.goto(`/${locale}?error=invalid_request&error_code=bad_oauth_state&error_description=private-provider-detail`);
    await expect(page).toHaveURL(new RegExp(`/${locale}/login\\?authError=expired$`));
    await expect(page.locator("main").getByRole("alert")).toHaveText(t.auth.socialExpired);
    await expect(page.locator("main")).not.toContainText("private-provider-detail");

    const next = `/${locale}/beans/new?draft=1`;
    await page.goto(`/api/auth/callback?error=access_denied&next=${encodeURIComponent(next)}`);
    await expect(page.locator("main").getByRole("alert")).toHaveText(t.auth.socialCancelled);
    await expect(page.locator('input[name="next"]')).toHaveValue(next);
    await expect(page).toHaveURL(new RegExp(`/${locale}/login\\?authError=cancelled&next=`));
  });

  for (const form of ["login", "signup"]) {
    test(`${locale} ${form} social sign-in shows progress and recovers from a connection failure`, async ({ page }) => {
      await page.goto(`/${locale}/${form}`);
      await page.locator('[name="email"]').fill("beanmap-qa-social@local.test");
      await page.locator('main input[type="checkbox"]').last().check();
      await expect(page.locator('[name="email"]')).toHaveValue("beanmap-qa-social@local.test");
      let attempts = 0;
      let release: () => void = () => {};
      let failure = new Promise<void>((resolve) => { release = resolve; });
      await page.route("**/*", async (route) => {
        if (route.request().method() !== "POST" || !route.request().headers()["next-action"]) return route.continue();
        attempts++;
        await failure;
        await route.abort("failed");
      });
      for (let attempt = 1; attempt <= 2; attempt++) {
        if (attempt === 2) failure = new Promise<void>((resolve) => { release = resolve; });
        await page.getByRole("button", { name: t.auth.loginWithGoogle, exact: true }).click();
        await expect(page.getByRole("button", { name: t.auth.socialConnecting, exact: true })).toBeDisabled();
        await expect(page.getByRole("button", { name: t.auth.loginWithKakao, exact: true })).toBeDisabled();
        await expect.poll(() => attempts).toBe(attempt);
        release();
        await expect(page.locator("main").getByRole("alert")).toHaveText(t.auth.socialError);
        await expect(page.getByRole("button", { name: t.auth.loginWithGoogle, exact: true })).toBeEnabled();
        await expect(page.locator('[name="email"]')).toHaveValue("beanmap-qa-social@local.test");
      }
    });
  }
}
