import { expect, test } from '@playwright/test';
for (const locale of ['ko', 'en']) {
  test(`${locale} region facts omit unsolicited explanations and keep sources collapsed`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    for (const region of ['panama/renacimiento', 'indonesia/kintamani', 'guatemala/new-oriente']) {
      await page.goto(`/${locale}/origins/${region}`);
      await expect(page.getByTestId('flavor-evidence')).toHaveCount(0);
      await expect(page.getByTestId('origin-guide-notes')).toHaveCount(0);
      await expect(page.getByTestId('region-specialty')).toHaveCount(0);
      const sources = page.getByTestId('region-sources');
      await expect(sources).not.toHaveAttribute('open');
      await sources.locator('summary').click();
      await expect(sources.locator('a').first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  });
}
