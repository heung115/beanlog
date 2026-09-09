import { expect, test } from '@playwright/test';
import { originRegionGuides, regionGuidePath } from '../../src/data/origin-guides';
import { getVarietyGuides } from '../../src/data/coffee-varieties';

for (const locale of ['ko', 'en']) {
  test(`${locale} variety details expand without opening sources or overflowing on mobile`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`/${locale}/origins/colombia/pitalito`);
    const profiles = page.getByTestId('region-variety-profiles');
    await expect(profiles).not.toHaveAttribute('open');
    await profiles.locator(':scope > summary').click();
    const ombligon = profiles.locator('[data-variety-profile="ombligon"]');
    await expect(ombligon).toBeVisible();
    await expect(ombligon).toContainText(locale === 'ko' ? '옴블리곤' : 'Ombligon');
    await expect(ombligon.locator('[data-variety-sources]')).not.toHaveAttribute('open');
    await ombligon.locator('[data-variety-sources] > summary').click();
    await expect(ombligon.getByRole('link').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByTestId('region-sources')).not.toHaveAttribute('open');
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
