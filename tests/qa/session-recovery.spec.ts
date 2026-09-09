import { randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import ko from "../../src/i18n/ko.json" with { type: "json" };
import en from "../../src/i18n/en.json" with { type: "json" };
import { admin, ensureUser } from "./helpers";

for (const locale of ["ko", "en"] as const) {
  const t = locale === "ko" ? ko : en;
  test(`${locale} session recovery preserves the destination and retries without signing in again`, async ({ page }) => {
    const account = { email: `beanmap-qa-recovery-${randomUUID()}@local.test`, password: randomBytes(24).toString("hex") };
    const id = await ensureUser(account.email, account.password);
    try {
      await page.goto(`/${locale}/login`);
      await page.locator('[name="email"]').fill(account.email);
      await page.locator('[name="password"]').fill(account.password);
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
      const destination = `/${locale}/settings?from=journal`;
      await page.goto(`/${locale}/session-unavailable?next=${encodeURIComponent(destination)}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(t.auth.sessionUnavailableTitle);
      await expect(page.locator("main")).toContainText(t.auth.sessionUnavailableDescription);
      await expect(page.locator('[name="email"], [name="displayName"], [data-bean-card]')).toHaveCount(0);
      const retry = page.getByRole("link", { name: t.auth.sessionRetry, exact: true });
      await expect(retry).toHaveAttribute("href", destination);
      await page.screenshot({ path: test.info().outputPath("session-recovery.png") });
      await retry.click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/settings\\?from=journal$`));
      await expect(page.locator('[name="displayName"]')).toBeEnabled();

      await page.goto(`/${locale}/session-unavailable?next=${encodeURIComponent("https://example.com/private")}`);
      await expect(page.getByRole("link", { name: t.auth.sessionRetry, exact: true })).toHaveAttribute("href", `/${locale}/explore`);
      await page.getByRole("link", { name: t.auth.sessionHome, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
    } finally {
      await admin.auth.admin.deleteUser(id);
    }
  });
}
