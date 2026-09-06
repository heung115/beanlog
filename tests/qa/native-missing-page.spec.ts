import { expect, test } from "@playwright/test";

for (const locale of ["ko", "en"] as const) {
  test(`${locale} missing pages provide localized recovery without JavaScript`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    try {
      const page = await context.newPage();
      for (const route of [`/${locale}/does-not-exist`, `/${locale}/origins/not-a-country`, `/${locale}/origins/not.a.country`]) {
        const response = await page.goto(route);
        expect(response?.status()).toBe(404);
        await expect(page.getByRole("main")).toHaveCount(1);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(locale === "ko" ? "페이지를 찾을 수 없습니다." : "Page not found");
        const home = page.getByRole("link", { name: locale === "ko" ? "홈으로 돌아가기" : "Return home", exact: true });
        await expect(home).toHaveAttribute("href", `/${locale}`);
        await home.click();
        await expect(page).toHaveURL(new RegExp(`/${locale}$`));
      }
    } finally { await context.close(); }
  });
}
