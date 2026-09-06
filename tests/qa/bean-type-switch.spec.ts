import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { BeanWithTags } from "../../src/types/database";
import { expect, test, type Page } from "@playwright/test";
import { admin, ensureUser } from "./helpers";
import ko from "../../src/i18n/ko.json" with { type: "json" };
import en from "../../src/i18n/en.json" with { type: "json" };

async function fillSingleOrigin(page: Page) {
  await page.locator('[name="origin_country"]').fill("QA Single Origin");
  await page.locator('[name="origin_region"]').fill("QA Region");
  await page.locator('[name="farm_producer"]').fill("QA Farm");
  await page.locator('[name="varietal"]').fill("QA Varietal");
  await page.locator('[name="altitude_m"]').fill("1800");
  await page.locator('[name="harvest_year"]').fill("2025");
}

async function expectSingleOrigin(page: Page) {
  await expect(page.locator('[name="origin_country"]')).toHaveValue("QA Single Origin");
  await expect(page.locator('[name="origin_region"]')).toHaveValue("QA Region");
  await expect(page.locator('[name="farm_producer"]')).toHaveValue("QA Farm");
  await expect(page.locator('[name="varietal"]')).toHaveValue("QA Varietal");
  await expect(page.locator('[name="altitude_m"]')).toHaveValue("1800");
  await expect(page.locator('[name="harvest_year"]')).toHaveValue("2025");
}

async function exportedBean(page: Page, locale: string, exportLabel: string): Promise<BeanWithTags> {
  await page.goto(`/${locale}/settings`);
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: exportLabel, exact: true }).click();
  const contents = JSON.parse(await readFile((await (await downloaded).path())!, "utf8"));
  expect(contents.beans).toHaveLength(1);
  return contents.beans[0];
}

for (const locale of ["ko", "en"] as const) {
  const t = locale === "ko" ? ko : en;
  for (const mobile of [false, true]) {
    test(`${mobile ? "@mobile " : ""}${locale} type changes preserve input and save only the selected type`, async ({ page }) => {
      test.setTimeout(90_000);
      const user = {
        email: `beanmap-qa-type-switch-${randomUUID()}@local.test`,
        password: randomBytes(24).toString("hex"),
      };
      const userId = await ensureUser(user.email, user.password);
      try {
        await page.goto(`/${locale}/login`);
        await page.locator('[name="email"]').fill(user.email);
        await page.locator('[name="password"]').fill(user.password);
        await page.locator('button[type="submit"]').click();
        await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
        await page.goto(`/${locale}/beans/new`);
        await page.locator('[name="name"]').fill("종류 전환 Type switch");
        await page.locator('[name="roastery"]').fill("QA Roastery");
        await page.locator('[name="note"]').fill("입력한 내용을 유지합니다. Keep my tasting note.");
        await fillSingleOrigin(page);

        const single = page.getByRole("radio", { name: t.beans.singleOrigin, exact: true });
        const blend = page.getByRole("radio", { name: t.beans.blend, exact: true });
        const save = page.locator('button[type="submit"]:not([name="continue"])');
        const percentage = page.getByLabel(t.beans.componentPercentage, { exact: true }).first();
        await blend.click();
        await page.locator('[name="blend_origin_0"]').fill("QA Blend Origin");
        await percentage.fill("100");
        await single.click();
        await expectSingleOrigin(page);
        await blend.click();
        await expect(page.locator('[name="blend_origin_0"]')).toHaveValue("QA Blend Origin");
        await expect(percentage).toHaveValue("100");
        await single.click();
        await save.click();
        await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));

        const created = await exportedBean(page, locale, t.settings.export);
        expect(created).toMatchObject({
          bean_type: "single_origin", origin_country: "QA Single Origin", origin_region: "QA Region",
          farm_producer: "QA Farm", varietal: "QA Varietal", altitude_m: 1800, harvest_year: 2025,
          blend_components: [],
        });

        // An existing single origin can be changed to a blend without retaining
        // hidden country, producer, varietal or harvest details in the record.
        await page.goto(`/${locale}/beans/${created.id}/edit`);
        await blend.click();
        await page.locator('[name="blend_origin_0"]').fill("QA Blend Origin");
        await percentage.fill("100");
        await single.click();
        await expectSingleOrigin(page);
        await blend.click();
        await expect(percentage).toHaveValue("100");
        await save.click();
        await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
        const blended = await exportedBean(page, locale, t.settings.export);
        expect(blended).toMatchObject({
          bean_type: "blend", origin_country: null, origin_region: null, farm_producer: null,
          varietal: null, altitude_m: null, harvest_year: null,
        });
        expect(blended.blend_components).toHaveLength(1);
        expect(blended.blend_components![0]).toMatchObject({ origin_country: "QA Blend Origin", percentage: 100 });

        // Editing a saved blend back to a single origin removes its old
        // components, while toggling before saving keeps both drafts intact.
        await page.goto(`/${locale}/beans/${created.id}/edit`);
        await single.click();
        await fillSingleOrigin(page);
        await blend.click();
        await expect(page.locator('[name="blend_origin_0"]')).toHaveValue("QA Blend Origin");
        await expect(percentage).toHaveValue("100");
        await single.click();
        await expectSingleOrigin(page);
        await save.click();
        await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
        const restored = await exportedBean(page, locale, t.settings.export);
        expect(restored).toMatchObject({ bean_type: "single_origin", origin_country: "QA Single Origin", blend_components: [] });
      } finally {
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (error) throw error;
      }
    });
  }
}
