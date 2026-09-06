import { expect, test } from "@playwright/test";

for (const viewport of [
  { name: "desktop", width: 1366, height: 900 },
  { name: "@mobile", width: 320, height: 740 },
]) {
  test.describe(`${viewport.name} origin navigation`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const locale of ["ko", "en"]) {
      test(`${locale} skip link reaches unobscured main content`, async ({ page, browserName }) => {
        await page.goto(`/${locale}/origins`);
        const main = page.getByRole("main");
        const heading = main.getByRole("heading", { level: 1 });
        const topBar = page.locator("header").first();
        await expect(heading).toBeVisible();

        // WebKit's default keyboard mode includes links with Option+Tab.
        const nextLinkKey = browserName === "webkit" ? "Alt+Tab" : "Tab";
        await page.keyboard.press(nextLinkKey);
        await expect(page.locator('a[href="#main-content"]')).toBeFocused();
        await page.keyboard.press("Enter");

        await expect(page).toHaveURL(new RegExp(`/${locale}/origins#main-content$`));
        await expect(heading).toBeInViewport({ ratio: 1 });
        await expect.poll(async () => {
          const title = await heading.boundingBox();
          const header = await topBar.boundingBox();
          return title && header ? title.y >= header.y + header.height : false;
        }).toBe(true);
        await expect(main).toBeFocused();

        await page.keyboard.press(nextLinkKey);
        await expect(page.getByRole("navigation", {
          name: locale === "ko" ? "산지 권역 바로가기" : "Jump to an origin region",
        }).getByRole("link").first()).toBeFocused();
      });

      for (const slug of ["colombia", "vietnam"]) {
        test(`${locale} origin guide returns to ${slug} below the header`, async ({ page }) => {
          await page.goto(`/${locale}/origins`);
          const country = page.locator(`#origin-${slug}`);
          await country.scrollIntoViewIfNeeded();
          await country.click();
          await expect(page).toHaveURL(new RegExp(`/${locale}/origins/${slug}$`));

          await page.locator("article").getByRole("link", {
            name: locale === "ko" ? "커피 산지 정보" : "Coffee origins",
            exact: true,
          }).click();

          await expect(page).toHaveURL(new RegExp(`/${locale}/origins#origin-${slug}$`));
          await expect(country).toBeInViewport({ ratio: 1 });
          await expect(country).toBeFocused();
          await expect.poll(async () => {
            const row = await country.boundingBox();
            const topBar = await page.locator("header").first().boundingBox();
            return row && topBar ? row.y >= topBar.y + topBar.height : false;
          }).toBe(true);
          await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
        });
      }
    }
  });
}
