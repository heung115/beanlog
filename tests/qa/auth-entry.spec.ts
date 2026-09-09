import { expect, test } from "@playwright/test";
import ko from "../../src/i18n/ko.json" with { type: "json" };
import en from "../../src/i18n/en.json" with { type: "json" };
import { landingCopy } from "../../src/content/landing";

for (const locale of ["ko", "en"] as const) {
  for (const mobile of [false, true]) {
    test(`${mobile ? "@mobile " : ""}${locale} login and signup are visible entry choices and preserve the destination`, async ({ page }, info) => {
      test.setTimeout(90_000);
      if (mobile) await page.setViewportSize({ width: 320, height: 740 });
      const t = locale === "ko" ? ko.auth : en.auth;
      const copy = landingCopy[locale];
      await page.goto(`/${locale}`);
      const hero = page.locator('[data-landing-section="hero"]');
      for (const [name, route] of [[t.login, "login"], [t.signup, "signup"]]) {
        const link = hero.getByRole("link", { name, exact: true });
        await expect(link).toBeInViewport();
        await expect(link).toHaveAttribute("href", `/${locale}/${route}`);
      }
      await expect(hero.getByRole("link", { name: copy.primaryAction, exact: true })).toHaveAttribute("href", `/${locale}/try`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: info.outputPath("landing.png") });
      await hero.getByRole("link", { name: t.signup, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/signup$`));

      for (const query of ["?draft=1", `?${new URLSearchParams({ next: `/${locale}/stats` })}`]) {
        await page.goto(`/${locale}/signup${query}`);
        const navigation = page.locator("main").getByRole("navigation", { name: `${t.login} / ${t.signup}`, exact: true });
        await expect(navigation.getByRole("link", { name: t.signup, exact: true })).toHaveAttribute("aria-current", "page");
        const login = navigation.getByRole("link", { name: t.login, exact: true });
        await expect(login).toBeInViewport();
        await expect(login).toHaveAttribute("href", `/${locale}/login${query}`);
        const firstInput = page.locator('main input:not([type="hidden"])').first();
        expect((await login.boundingBox())!.y).toBeLessThan((await firstInput.boundingBox())!.y);
        await expect(page.locator('[name="password"]')).toHaveAttribute("autocomplete", "new-password");
        await page.screenshot({ path: info.outputPath(query === "?draft=1" ? "signup.png" : "signup-next.png") });
        await login.click();
        await expect(page).toHaveURL(`/${locale}/login${query}`);
        await expect(navigation.getByRole("link", { name: t.login, exact: true })).toHaveAttribute("aria-current", "page");
        await expect(navigation.getByRole("link", { name: t.signup, exact: true })).toHaveAttribute("href", `/${locale}/signup${query}`);
        await expect(page.locator('[name="password"]')).toHaveAttribute("autocomplete", "current-password");
        await expect(page.locator('[name="displayName"]')).toHaveCount(0);
        await expect(page.locator('button[type="submit"]')).toHaveText(t.login);
        await expect(page.getByRole("button", { name: t.loginWithGoogle, exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: t.loginWithKakao, exact: true })).toBeVisible();
        await expect(page.locator('[name="next"]')).toHaveValue(query === "?draft=1" ? `/${locale}/beans/new?draft=1` : `/${locale}/stats`);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      }
    });
  }
}
