import { expect, test } from "@playwright/test";

for (const [browserLocale, expectedLocale] of [["ko-KR", "ko"], ["en-US", "en"], ["fr-FR", "ko"]] as const) {
  test(`first visit chooses ${expectedLocale} for browser language ${browserLocale}`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ locale: browserLocale, baseURL });
    try {
      const page = await context.newPage();
      await page.goto("/?source=first-visit");
      await expect(page).toHaveURL(new RegExp(`/${expectedLocale}\\?source=first-visit$`));
      await expect(page.locator("html")).toHaveAttribute("lang", expectedLocale);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    } finally {
      await context.close();
    }
  });
}

for (const locale of ["ko", "en"] as const) {
  test(`${locale} public pages keep manual language controls in settings`, async ({ page }) => {
    for (const path of ["", "/origins", "/login", "/signup", "/signup/check-email"]) {
      await page.goto(`/${locale}${path}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("group", { name: /^(언어|Language)$/ })).toHaveCount(0);
      await expect(page.getByRole("link", { name: /^(영어로 전환|Switch to Korean)$/ })).toHaveCount(0);
    }
  });
}
