import { expect, test } from "@playwright/test";
import axe from "axe-core";

for (const locale of ["ko", "en"] as const) {
  for (const mobile of [false, true]) {
    test(`${mobile ? "@mobile " : ""}${locale} all origin guides, legal pages, confirmation and missing routes fit and remain accessible`, async ({ page }, info) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width: mobile ? 320 : 1366, height: 900 });
      await page.goto(`/${locale}/origins`);
      const paths = await page.locator("[data-origin-row]").evaluateAll((rows) => rows.map((row) => row.getAttribute("href")!));
      expect(paths).toHaveLength(20);
      const routes = [...paths, `/${locale}/terms`, `/${locale}/privacy`, `/${locale}/signup/check-email?next=${encodeURIComponent(`/${locale}/stats`)}`, `/${locale}/does-not-exist`, `/${locale}/origins/not-a-country`];
      const evidence = [];
      for (const route of routes) {
        await page.goto(route);
        await expect(page.locator("h1")).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}nextjs-portal{display:none!important}" });
        await page.evaluate(() => document.fonts.ready);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        expect(overflow, route).toBeLessThanOrEqual(1);
        await page.addScriptTag({ content: axe.source });
        const violations = await page.evaluate(async () => (await (window as typeof window & { axe: typeof axe }).axe.run(document, { resultTypes: ["violations"] })).violations.filter((v) => ["serious", "critical"].includes(v.impact ?? "")).map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })));
        expect(violations, route).toEqual([]);
        if (route.includes("does-not-exist") || route.includes("not-a-country")) {
          await expect(page.locator("h1")).toHaveText(locale === "ko" ? "페이지를 찾을 수 없습니다." : "Page not found");
          await expect(page.getByRole("main")).toHaveCount(1);
        }
        if (route.includes("check-email")) {
          await expect(page.locator(`a[href^="/${locale}/login?next="]`)).toHaveAttribute("href", `/${locale}/login?next=${encodeURIComponent(`/${locale}/stats`)}`);
        }
        evidence.push({ route, width: mobile ? 320 : 1366, overflow, seriousOrCritical: violations.length });
      }
      await info.attach("page-coverage", { body: JSON.stringify(evidence, null, 2), contentType: "application/json" });
    });
  }
}
