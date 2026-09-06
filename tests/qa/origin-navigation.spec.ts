import { expect, test } from "@playwright/test";

for (const viewport of ["desktop", "@mobile"]) {
  for (const locale of ["ko", "en"]) {
    test(`${viewport} ${locale} origin guide returns to the country in the list`, async ({ page }) => {
      await page.goto(`/${locale}/origins`);
      const country = page.locator("#origin-vietnam");
      await country.scrollIntoViewIfNeeded();
      await country.click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/origins/vietnam$`));

      await page.locator("article").getByRole("link", {
        name: locale === "ko" ? "커피 산지 정보" : "Coffee origins",
        exact: true,
      }).click();

      await expect(page).toHaveURL(new RegExp(`/${locale}/origins#origin-vietnam$`));
      await expect(country).toBeInViewport({ ratio: 1 });
      await expect.poll(async () => {
        const row = await country.boundingBox();
        const topBar = await page.locator("header").first().boundingBox();
        return row && topBar ? row.y >= topBar.y + topBar.height : false;
      }).toBe(true);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
    });
  }
}
