import { randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { admin, ensureUser } from "./helpers";
import ko from "../../src/i18n/ko.json" with { type: "json" };
import en from "../../src/i18n/en.json" with { type: "json" };

for (const locale of ["ko", "en"] as const) {
  for (const mobile of [false, true]) {
    test(`${mobile ? "@mobile " : ""}${locale} login connection failure preserves the form and destination for retry`, async ({ page, context }) => {
      const account = {
        email: `beanmap-qa-login-availability-${randomUUID()}@local.test`,
        password: randomBytes(24).toString("hex"),
      };
      const id = await ensureUser(account.email, account.password);
      const t = locale === "ko" ? ko : en;
      const next = `/${locale}/stats`;
      try {
        await page.goto(`/${locale}/login?next=${encodeURIComponent(next)}`);
        await page.locator('[name="email"]').fill(account.email);
        await page.locator('[name="password"]').fill(account.password);
        await page.locator('[name="remember"]').uncheck();

        let attempts = 0;
        let release: () => void = () => {};
        const waiting = new Promise<void>((resolve) => { release = resolve; });
        await page.route("**/*", async (route) => {
          if (route.request().method() !== "POST" || !route.request().headers()["next-action"]) {
            return route.continue();
          }
          attempts++;
          await waiting;
          await route.abort("failed");
        });

        const login = page.getByRole("button", { name: t.auth.login, exact: true });
        await login.click();
        await expect(login).toBeDisabled();
        await login.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
        await expect.poll(() => attempts).toBe(1);
        release();

        await expect(page.locator("main").getByRole("alert")).toHaveText(t.auth.loginUnavailable);
        await expect(page.getByText(t.auth.loginError, { exact: true })).toHaveCount(0);
        await expect(login).toBeEnabled();
        await expect(page.locator('[name="email"]')).toHaveValue(account.email);
        await expect(page.locator('[name="password"]')).toHaveValue(account.password);
        await expect(page.locator('[name="remember"]')).not.toBeChecked();
        await expect(page.locator('[name="next"]')).toHaveValue(next);
        await expect(page).toHaveURL(new RegExp(`/${locale}/login\\?next=`));
        await page.screenshot({ path: test.info().outputPath("login-connection-retry.png") });

        await page.unrouteAll();
        await login.click();
        await expect(page).toHaveURL(new RegExp(`${next}$`));
        await expect(page.getByTestId("stats-empty-state")).toBeVisible();
        const authCookies = (await context.cookies()).filter(cookie => cookie.name.includes("auth-token"));
        expect(authCookies.length).toBeGreaterThan(0);
        expect(authCookies.every(cookie => cookie.expires === -1)).toBe(true);
      } finally {
        await page.unrouteAll({ behavior: "ignoreErrors" });
        await admin.auth.admin.deleteUser(id);
      }
    });
  }
}
