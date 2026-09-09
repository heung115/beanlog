import { expect, test } from "@playwright/test";
import { originGuideCountries, originRegionGuides, regionGuidePath } from "../../src/data/origin-guides";

for (const locale of ["ko", "en"]) {
  test(`${locale} country-first index reveals regions progressively`, async ({ page, request }) => {
    await page.goto(`/${locale}/origins`);
    await expect(page.locator("[data-region-row]")).toHaveCount(0);
    await expect(page.locator("[data-origin-row]")).toHaveCount(originGuideCountries.length);
    await page.locator('#origin-ethiopia').click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/origins/ethiopia$`));
    await expect(page.locator('[data-region-row]')).toHaveCount(originRegionGuides.filter(g => g.country === 'Ethiopia' && !g.parentId).length);
    await expect(page.locator('[data-region-row][href$="/gedeb"]')).toHaveCount(0);
    await page.locator('[data-region-row][href$="/yirgacheffe"]').click();
    await expect(page.locator('[data-testid="region-children"] [href$="/gedeb"]')).toBeVisible();
    await page.locator('[data-testid="region-children"] [href$="/gedeb"]').click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/origins/ethiopia/gedeb$`));
    for (const country of originGuideCountries) {
      const guide = originRegionGuides.find((item) => item.country === country.country)!;
      const path = regionGuidePath(guide).split("/").slice(0, 3).join("/");
      const response = await request.get(`/${locale}${path}`);
      expect(response.status(), country.country).toBe(200);
      expect(await response.text()).toContain(locale === "ko" ? country.countryKo : country.country);
    }
  });

  test(`${locale} regional search works without JavaScript and keeps filters in the URL`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    try {
      await page.goto(`/${locale}/origins`);
      await page.locator("[data-origin-search] > summary").click();
      await page.locator("#origin-search").fill("Narino");
      await page.getByRole("button", { name: locale === "ko" ? "찾기" : "Search", exact: true }).click();
      await expect(page).toHaveURL(/q=Narino/);
      const narino = page.locator('[data-region-row][href$="/colombia/narino"]');
      await expect(narino).toBeVisible();
      await expect(narino).toContainText("Nariño");
      await narino.click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/origins/colombia/narino$`));
      await expect(page.getByRole("heading", { level: 1 })).toContainText(locale === "ko" ? "나리뇨" : "Nariño");
      await expect(page.locator('article a[href^="https://"]')).not.toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test(`${locale} microregion filter preserves country boundaries and handles empty searches`, async ({ page }) => {
    await page.goto(`/${locale}/origins`);
    await page.locator("[data-origin-search] > summary").click();
    await page.locator("#origin-country-filter").selectOption("Costa Rica");
    await page.locator("#origin-kind-filter").selectOption("microregion");
    await page.getByRole("button", { name: locale === "ko" ? "찾기" : "Search", exact: true }).click();
    const expected = originRegionGuides.filter((guide) => guide.country === "Costa Rica" && guide.kind === "microregion");
    expect(expected.length).toBeGreaterThan(0);
    await expect(page.locator("[data-region-row]")).toHaveCount(expected.length);
    for (const href of await page.locator("[data-region-row]").evaluateAll((rows) => rows.map((row) => row.getAttribute("href")))) {
      expect(href).toContain(`/${locale}/origins/costa-rica/`);
    }
    await page.locator("#origin-search").fill("no-such-region-123456");
    await page.getByRole("button", { name: locale === "ko" ? "찾기" : "Search", exact: true }).click();
    await expect(page.locator("[data-region-row]")).toHaveCount(0);
    await expect(page.getByText(locale === "ko" ? /조건에 맞는 산지가 없습니다/ : /No origins match/)).toBeVisible();
  });

  test(`${locale} every researched region has a public rendered detail and unknown regions return 404`, async ({ request }) => {
    for (const guide of originRegionGuides) {
      const response = await request.get(`/${locale}${regionGuidePath(guide)}`);
      expect(response.status(), guide.id).toBe(200);
      const html = await response.text();
      expect(html).toContain(guide.name);
      expect(html).toContain(guide.sources[0].url.replaceAll("&", "&amp;"));
    }
    for (const path of ["/origins/ethiopia/missing-region", "/origins/kenya/yirgacheffe"]) {
      const response = await request.get(`/${locale}${path}`);
      expect(response.status()).toBe(404);
      expect(await response.text()).toContain(locale === "ko" ? "페이지를 찾을 수 없습니다" : "Page not found");
    }
  });
}

test("@mobile regional guide and search fit a 320px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  for (const path of ["/ko/origins", "/ko/origins/ethiopia", "/ko/origins/ethiopia/yirgacheffe"]) {
    await page.goto(path);
    await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
