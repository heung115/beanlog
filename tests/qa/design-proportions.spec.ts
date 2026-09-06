import { expect, test } from "@playwright/test";
import { qaUser } from "./helpers";

for (const locale of ["ko", "en"] as const) {
  test(`${locale} populated stats remain within the viewport with long bean names`, async ({ page }) => {
    await page.goto(`/${locale}/login`);
    await page.locator('[name="email"]').fill(qaUser.email);
    await page.locator('[name="password"]').fill(qaUser.password);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${locale}/stats`);
      await expect(page.getByTestId("stats-summary")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      if (locale === "en") {
        await expect(page.locator("main")).not.toContainText(/\d(?:cups|pts)/);
      }
    }
  });

  test(`${locale} origin rows give descriptions room across screen sizes`, async ({ page }) => {
    for (const width of [390, 768, 1024, 1366]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${locale}/origins`);
      const rows = page.locator("[data-origin-row]");
      await expect(rows).toHaveCount(20);
      const sizes = await rows.evaluateAll((elements) => elements.map((element) => {
        const row = element.getBoundingClientRect();
        const name = element.querySelector("[data-origin-name]")!.getBoundingClientRect();
        const flavor = element.querySelector("[data-origin-flavor]")!.getBoundingClientRect();
        const altitude = element.querySelector("[data-origin-altitude]")!.getBoundingClientRect();
        return {
          left: row.left, right: row.right, height: row.height,
          nameRight: name.right, flavorLeft: flavor.left, flavorRight: flavor.right,
          flavorWidth: flavor.width, altitudeLeft: altitude.left, altitudeWidth: altitude.width,
        };
      }));
      for (const size of sizes) {
        expect(size.left).toBeGreaterThanOrEqual(0);
        expect(size.right).toBeLessThanOrEqual(width);
        if (width >= 768) {
          expect(size.flavorWidth).toBeGreaterThanOrEqual(200);
          expect(size.flavorWidth).toBeGreaterThan(size.altitudeWidth * 1.8);
          expect(size.flavorLeft).toBeGreaterThan(size.nameRight);
          expect(size.altitudeLeft).toBeGreaterThan(size.flavorRight);
          expect(size.height).toBeLessThanOrEqual(150);
        }
      }
    }
  });

  test(`${locale} landing content fits tablet grids without hidden clipping`, async ({ page }) => {
    for (const width of [390, 768, 1024, 1366]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${locale}`);
      const clipped = await page.locator("main h2, main h3, main p, main li").evaluateAll((elements) =>
        elements.filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.left < 0 || rect.right > window.innerWidth + 1;
        }).map((element) => element.textContent)
      );
      expect(clipped).toEqual([]);
      const headingSizes = await page.locator(".landing-section-title").evaluateAll((elements) =>
        elements.map((element) => Number.parseFloat(getComputedStyle(element).fontSize))
      );
      expect(headingSizes).toHaveLength(4);
      expect(Math.max(...headingSizes)).toBeLessThanOrEqual(44);
    }
  });
}
