import { expect, test } from '@playwright/test';
import { originRegionGuides, regionGuidePath } from '../../src/data/origin-guides';
import { getVarietyGuides } from '../../src/data/coffee-varieties';
import { varietyDisplayNames } from '../../src/data/coffee-varieties/display';

for (const locale of ['ko', 'en']) {
  test(`${locale} variety details reopen independently of sources without overflowing on mobile`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`/${locale}/origins/colombia/pitalito`);
    const profiles = page.getByTestId('region-variety-profiles');
    const summary = profiles.locator(':scope > summary');
    const names = profiles.getByTestId('region-variety-names');
    const regionSources = page.getByTestId('region-sources');
    await expect(summary).toHaveText(locale === 'ko' ? '재배 품종' : 'Grown varieties');
    await expect(profiles).not.toHaveAttribute('open');
    await expect(names).toBeHidden();
    await expect(page.getByTestId('region-processing')).toBeVisible();
    await summary.focus();
    await summary.press('Enter');
    await expect(names).toBeVisible();
    await expect(names).toContainText('Laurina');
    await expect(names).toContainText('Ombligon');
    const ombligon = profiles.locator('[data-variety-profile="ombligon"]');
    await expect(ombligon).toBeVisible();
    await expect(ombligon).toContainText(locale === 'ko' ? '옴블리곤' : 'Ombligon');
    await expect(ombligon.locator('[data-variety-sources]')).not.toHaveAttribute('open');
    await summary.click();
    await expect(names).toBeHidden();
    await expect(ombligon).toBeHidden();
    await expect(page.getByTestId('region-processing')).toBeVisible();
    await summary.click();
    await expect(names).toBeVisible();
    await expect(ombligon).toBeVisible();
    await expect(ombligon.locator('[data-variety-sources]')).not.toHaveAttribute('open');
    await ombligon.locator('[data-variety-sources] > summary').click();
    await expect(ombligon.getByRole('link').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(regionSources).not.toHaveAttribute('open');
    await regionSources.locator(':scope > summary').click();
    await expect(names).toBeVisible();
    await summary.click();
    await expect(names).toBeHidden();
    await expect(regionSources).toHaveAttribute('open', '');
    await expect(regionSources.getByRole('link').first()).toBeVisible();
  });

  test(`${locale} published variety names remain available without matching profiles`, async ({ page }) => {
    const guide = originRegionGuides.find(entry => entry.id === 'vietnam-lam-dong')!;
    const names = varietyDisplayNames(guide.varieties);
    expect(names.length).toBeGreaterThan(0);
    expect(getVarietyGuides(guide.varieties)).toHaveLength(0);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`/${locale}${regionGuidePath(guide)}`);
    const varieties = page.getByTestId('region-variety-profiles');
    const publishedNames = varieties.getByTestId('region-variety-names');
    await expect(varieties).toBeVisible();
    await expect(varieties).not.toHaveAttribute('open');
    await expect(publishedNames).toBeHidden();
    await varieties.locator(':scope > summary').click();
    await expect(publishedNames).toBeVisible();
    await expect(publishedNames).toHaveText(names.join(' · '));
    await expect(varieties.locator('[data-variety-profile]')).toHaveCount(0);
    await expect(page.getByTestId('region-sources')).not.toHaveAttribute('open');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('every origin exposes exactly the profiles supported by its cultivated variety names', async ({ request }) => {
  for (const guide of originRegionGuides) {
    const expected = getVarietyGuides(guide.varieties).map(x => x.id).sort();
    for (const locale of ['ko', 'en']) {
      const response = await request.get(`/${locale}${regionGuidePath(guide)}`);
      expect(response.status(), `${locale}/${guide.id}`).toBe(200);
      const html = await response.text();
      const actual = [...html.matchAll(/data-variety-profile="([^"]+)"/g)].map(x => x[1]).sort();
      expect(actual, `${locale}/${guide.id}`).toEqual(expected);
    }
  }
});
