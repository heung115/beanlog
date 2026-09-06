import { randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { admin, ensureUser, qaApiURL, qaBaseURL, signIn } from "./helpers";
import ko from "../../src/i18n/ko.json" with { type: "json" };
import en from "../../src/i18n/en.json" with { type: "json" };

for (const locale of ["ko", "en"] as const) {
  test(`${locale} native form saves visible optional fields without JavaScript`, async ({ browser, request }) => {
    test.skip(!qaApiURL, "Requires isolated staging API");
    test.setTimeout(90_000);
    const t = locale === "ko" ? ko : en;
    const user = { email: `beanmap-qa-native-recovery-${randomUUID()}@local.test`, password: randomBytes(24).toString("hex") };
    const id = await ensureUser(user.email, user.password);
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL: qaBaseURL });
    try {
      const page = await context.newPage();
      await page.goto(`/${locale}/login`);
      await page.locator('[name="email"]').fill(user.email);
      await page.locator('[name="password"]').fill(user.password);
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
      await page.goto(`/${locale}/beans/new`);
      await page.locator('[name="name"]').fill("Native optional fields");
      await page.locator('[name="roastery"]').fill("Sample roastery");
      await page.locator('[name="origin_country"]').fill("Ethiopia");
      await page.locator('[name="origin_subregions"]').fill("Yirgacheffe, Kochere");
      await page.locator('[name="altitude_m"]').fill("1900");
      await page.locator('[name="harvest_year"]').fill("2026");
      await page.locator('[name="note"]').fill("Optional fields should be retained without JavaScript.");
      await page.getByRole("button", { name: t.beans.save, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
      await expect(page.locator('[data-bean-card]')).toContainText("Native optional fields");
      const { session } = await signIn(user.email, user.password);
      const response = await request.get(`${qaApiURL}/api/beans`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      expect(response.ok()).toBe(true);
      const body = await response.json();
      expect(body.beans).toHaveLength(1);
      expect(body.beans[0]).toMatchObject({ altitude_m: 1900, harvest_year: 2026, origin_subregions: ["Yirgacheffe", "Kochere"] });
      await page.goto(`/${locale}/beans/new?error=save`);
      await expect(page.getByRole("alert")).toContainText(t.beans.nativeSaveFailed);
    } finally {
      await context.close();
      const result = await admin.auth.admin.deleteUser(id);
      if (result.error) throw result.error;
    }
  });
}
