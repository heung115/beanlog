import { expect, test } from '@playwright/test';
import { getPublishedLots } from '../../src/data/origin-guides/lot-publication';
import { originRegionGuides, getCountryRegionGuides, regionGuidePath } from '../../src/data/origin-guides';

for (const locale of ['ko', 'en']) {
  test(`${locale} region searches reach the correct origin and its regional facts`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`/${locale}/origins?q=Puno&country=Peru`);
    const rows = page.locator('[data-region-row]');
    await expect(rows).toHaveCount(1);
    await expect(rows).toHaveAttribute('href', `/${locale}/origins/peru/puno`);
    await rows.click();
    const lotDetails = page.getByTestId('specialty-lots');
    if (await lotDetails.count()) await expect(lotDetails.locator('[data-specialty-lot]').first()).toBeVisible();
    await expect(page.getByTestId('region-flavors')).toBeVisible();
    await expect(page.getByTestId('region-sources')).not.toHaveAttribute('open');
    await expect(page.getByTestId('origin-guide-notes')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`${locale} country-first browsing retains geographical order and all discovery origins`, async ({ page }) => {
    await page.goto(`/${locale}/origins`);
    await expect(page.locator('[data-origin-search]')).not.toHaveAttribute('open');
    await expect(page.locator('[data-region-row]')).toHaveCount(0);
    await page.locator('#origin-indonesia').click();
    const expected = getCountryRegionGuides('Indonesia').filter((guide) => !guide.parentId);
    await expect(page.locator('[data-region-row]')).toHaveCount(expected.length);
    expect(await page.locator('[data-region-row]').evaluateAll((rows) => rows.map((row) => row.getAttribute('href')))).toEqual(expected.map((guide) => `/${locale}${regionGuidePath(guide)}`));
    await expect(page.locator('[data-region-row][href$="/kintamani"]')).toBeVisible();
    await page.goto(`/${locale}/origins?q=China&country=China`);
    await expect(page.locator('[data-region-row]')).toHaveCount(originRegionGuides.filter((guide) => guide.country === 'China').length);
  });
}

test('every origin publishes only reviewed lot facts in both languages', async ({ request }) => {
  for (const guide of originRegionGuides) {
    for (const locale of ['ko', 'en']) {
      const response = await request.get(`/${locale}${regionGuidePath(guide)}`);
      expect(response.status(), `${locale}/${guide.id}`).toBe(200);
      const html = await response.text();
      expect((html.match(/data-specialty-lot="true"/g) ?? []).length, `${locale}/${guide.id}`).toBe(getPublishedLots(guide.id).length);
      expect(html).toContain('data-testid="region-flavors"');
      expect(html).toContain('data-testid="region-sources"');
    }
  }
});

test('Korean region names lead to microregions on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(`/ko/origins?q=${encodeURIComponent('치리노스')}`);
  const link = page.locator('[data-region-row][href="/ko/origins/peru/chirinos"]');
  await expect(link).toBeVisible();
  await link.click();
  const lotDetails = page.getByTestId('specialty-lots');
  if (await lotDetails.count()) await expect(lotDetails.locator('[data-specialty-lot]').first()).toBeVisible();
  await expect(page.getByTestId('region-environment')).toBeVisible();
  await expect(page.getByTestId('region-sources')).not.toHaveAttribute('open');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('region facts preserve flavors and varieties without naming sales offerings', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/ko/origins/madagascar/haute-matsiatra');
  await expect(page.locator('[data-specialty-lot]')).toHaveCount(getPublishedLots('madagascar-haute-matsiatra').length);
  await expect(page.getByTestId('region-flavors')).toContainText('헤이즐넛');
  await expect(page.locator('#region-varieties-title')).toBeVisible();
  await expect(page.getByTestId('region-sources')).not.toHaveAttribute('open');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const locale of ['ko', 'en']) {
  test(`${locale} Idido displays reviewed lot details immediately`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`/${locale}/origins/ethiopia/idido`);
    await expect(page.locator('[data-specialty-lot]')).toHaveCount(getPublishedLots('ethiopia-idido').length);
    const details = page.getByTestId('specialty-lots');
    if (await details.count()) {
      await expect(details.locator(':scope > summary')).toHaveCount(0);
      await expect(details.locator('[data-specialty-lot]').first()).toBeVisible();
      await expect(details.locator('[data-lot-sources]').first()).not.toHaveAttribute('open');
    }
    await expect(page.getByTestId('region-flavors')).toContainText(locale === 'ko' ? '망고' : 'Mango');
    await expect(page.getByTestId('region-flavors')).toContainText(locale === 'ko' ? '향미 기록' : 'Recorded flavors');
    await expect(page.getByTestId('region-sources')).not.toHaveAttribute('open');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
