import { expect, test } from '@playwright/test';

for (const locale of ['ko', 'en']) {
  test(`${locale} search controls retain usable height and do not overlap`, async ({ page }) => {
    for (const width of [320, 654, 768, 820, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${locale}/origins`);
      await page.locator("[data-origin-search] > summary").click();
      const form = page.getByRole('search');
      const controls = await form.locator('input, select, button').evaluateAll(elements => elements.map(element => {
        const r = element.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
      }));
      for (const box of controls) {
        expect(box.height, `${width}px control height`).toBeGreaterThanOrEqual(44);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(width);
      }
      for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
        const a = controls[i], b = controls[j];
        expect(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y, `${width}px controls ${i}/${j} overlap`).toBe(true);
      }
      await page.locator('#origin-country-filter').selectOption('Papua New Guinea');
      await form.getByRole('button').click();
      await expect(page).toHaveURL(/country=Papua\+New\+Guinea/);
      await expect(page.locator('[data-region-row]').first()).toBeVisible();
    }
  });
}
