import { expect, test } from '@playwright/test';

test('origin search excludes products, roasters, varieties and tasting notes', async ({ page }) => {
  for (const query of ['에프라인 엘 세로', 'Anastacio Mamani', '커피화', '옴블리곤', '자스민', '[8.12 깜짝 오픈] #26']) {
    await page.goto('/ko/origins?q=' + encodeURIComponent(query));
    await expect(page.locator('[data-region-row]')).toHaveCount(0);
  }
  await page.goto('/ko/origins?q=' + encodeURIComponent('이디도') + '&country=Ethiopia');
  await expect(page.locator('[data-region-row][href="/ko/origins/ethiopia/idido"]')).toBeVisible();
});

test('expanded varieties keep mobile details concise and source list closed', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/ko/origins/colombia/pitalito');
  const varieties = page.locator('section[aria-labelledby="region-varieties-title"]');
  await expect(varieties).toContainText('재배 품종');
  await expect(varieties).toContainText('Laurina');
  await expect(varieties).toContainText('Ombligon');
  await expect(page.getByTestId('region-sources')).not.toHaveAttribute('open');
  await expect(page.getByTestId('origin-guide-notes')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto('/ko/origins/ethiopia/yirgacheffe');
  await expect(page.locator('section[aria-labelledby="region-varieties-title"]')).toContainText('Kurume');
  await expect(page.locator('section[aria-labelledby="region-varieties-title"]')).toContainText('Wolisho');
});
