import { randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { admin, ensureUser } from "./helpers";
import ko from "../../src/i18n/ko.json" with { type: "json" };
import en from "../../src/i18n/en.json" with { type: "json" };

for (const locale of ["ko", "en"] as const) {
  for (const mobile of [false, true]) {
    test(`${mobile ? "@mobile " : ""}${locale} failed login preserves email and session preference for retry`, async ({ page, context }) => {
      const user = { email: `beanmap-qa-retry-${randomUUID()}@local.test`, password: randomBytes(24).toString("hex") };
      const id = await ensureUser(user.email, user.password);
      const t = locale === "ko" ? ko : en;
      try {
        await page.goto(`/${locale}/login?next=${encodeURIComponent(`/${locale}/stats`)}`);
        await page.locator('[name="email"]').fill(user.email);
        await page.locator('[name="password"]').fill("deliberately-incorrect-qa-password");
        await page.locator('[name="remember"]').uncheck();
        await page.locator('button[type="submit"]').click();
        await expect(page.locator("main").getByRole("alert")).toHaveText(t.auth.loginError);
        await expect(page.locator('[name="email"]')).toHaveValue(user.email);
        await expect(page.locator('[name="remember"]')).not.toBeChecked();
        await page.locator('[name="password"]').fill(user.password);
        await page.locator('button[type="submit"]').click();
        await expect(page).toHaveURL(new RegExp(`/${locale}/stats$`));
        await expect(page.getByTestId("stats-empty-state")).toBeVisible();
        const authCookies = (await context.cookies()).filter(cookie => cookie.name.includes("auth-token"));
        expect(authCookies.length).toBeGreaterThan(0);
        expect(authCookies.every(cookie => cookie.expires === -1)).toBe(true);
        await page.reload();
        await expect(page.getByTestId("stats-empty-state")).toBeVisible();
      } finally {
        await admin.auth.admin.deleteUser(id);
      }
    });
  }
}
