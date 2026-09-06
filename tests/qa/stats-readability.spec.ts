import { randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import axe from "axe-core";
import { admin, ensureUser, qaApiURL, signIn } from "./helpers";
import ko from "../../src/i18n/ko.json" with { type: "json" };
import en from "../../src/i18n/en.json" with { type: "json" };

for (const locale of ["ko", "en"] as const) {
  for (const mobile of [false, true]) {
    test(`${mobile ? "@mobile " : ""}${locale} statistics expose exact values and recover a failed load`, async ({ page, request }, info) => {
      test.skip(!qaApiURL, "Requires isolated staging API");
      test.setTimeout(90_000);
      await page.setViewportSize({ width: mobile ? 320 : 1366, height: 900 });
      const t = locale === "ko" ? ko : en;
      const user = { email: `beanmap-qa-stats-readable-${randomUUID()}@local.test`, password: randomBytes(24).toString("hex") };
      const id = await ensureUser(user.email, user.password);
      const longVarietal = `Heirloom${"선택품종".repeat(20)}`;
      try {
        const { session } = await signIn(user.email, user.password);
        const headers = { Authorization: `Bearer ${session.access_token}` };
        for (const [index, score] of [8.5, 9.5].entries()) {
          const result = await request.post(`${qaApiURL}/api/beans`, { headers, data: {
            name: `Readability sample ${index + 1}`, roastery: "Sample roastery", bean_type: "single_origin",
            origin_country: "Ethiopia", origin_region: "Yirgacheffe", varietal: longVarietal,
            process_method: "washed", roast_level: "medium", place_type: "home", overall_score: score,
            consumed_at: "2026-08-15T00:00:00Z", note: "A clearly labeled QA sample.",
          } });
          expect(result.status()).toBe(201);
        }
        await page.goto(`/${locale}/login`);
        await page.locator('[name="email"]').fill(user.email);
        await page.locator('[name="password"]').fill(user.password);
        await page.locator('button[type="submit"]').click();
        await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));

        let failed = false;
        await page.route(`**/${locale}/stats`, async (route) => {
          if (!failed && route.request().method() === "POST") {
            failed = true;
            await route.abort("connectionfailed");
          } else await route.continue();
        });
        await page.goto(`/${locale}/stats`);
        await expect(page.getByRole("alert").filter({ hasText: t.common.loadError })).toBeVisible();
        await expect(page.getByTestId("stats-empty-state")).toHaveCount(0);
        await page.getByRole("button", { name: t.common.retry, exact: true }).click();
        await expect(page.getByTestId("stats-summary")).toContainText(`2${locale === "en" ? " " : ""}${t.stats.recordUnit}`);

        const disclosures = page.locator("details");
        await expect(disclosures).toHaveCount(3);
        for (const disclosure of await disclosures.all()) await disclosure.locator("summary").click();
        const varietalTable = page.getByRole("table", { name: t.stats.byVarietal, exact: true });
        await expect(varietalTable.getByRole("row", { name: `${longVarietal} 2`, exact: true })).toBeVisible();
        const monthly = page.getByRole("table", { name: t.stats.monthlyTrend, exact: true });
        await expect(monthly).toContainText(locale === "ko" ? "2026년 8월" : "Aug 2026");
        const distribution = page.getByRole("table", { name: t.stats.scoreDistribution, exact: true });
        const range = t.stats.scoreRange.replace("{from}", "8").replace("{to}", "9");
        await expect(distribution.getByRole("row", { name: `${range} 1`, exact: true })).toBeVisible();
        await expect(distribution).toContainText(t.stats.scorePerfect);
        await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}nextjs-portal{display:none!important}" });
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
        await page.addScriptTag({ content: axe.source });
        const violations = await page.evaluate(async () => (await (window as typeof window & { axe: typeof axe }).axe.run(document, { resultTypes: ["violations"] })).violations.filter((v) => ["serious", "critical"].includes(v.impact ?? "")).map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })));
        expect(violations).toEqual([]);
        await page.screenshot({ path: info.outputPath("statistics-readable.png"), fullPage: true });
      } finally {
        const result = await admin.auth.admin.deleteUser(id);
        if (result.error) throw result.error;
      }
    });
  }
}
