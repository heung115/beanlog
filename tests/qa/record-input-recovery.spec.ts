import { randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { admin, ensureUser, qaApiURL, signIn } from "./helpers";
import ko from "../../src/i18n/ko.json" with { type: "json" };
import en from "../../src/i18n/en.json" with { type: "json" };

for (const locale of ["ko", "en"] as const) {
  test(`${locale} cleared dates, staged tags and café switching survive saving`, async ({ page, request }) => {
    test.skip(!qaApiURL, "Requires isolated staging API");
    test.setTimeout(90_000);
    const t = locale === "ko" ? ko : en;
    const user = { email: `beanmap-qa-record-recovery-${randomUUID()}@local.test`, password: randomBytes(24).toString("hex") };
    const id = await ensureUser(user.email, user.password);
    try {
      const { session } = await signIn(user.email, user.password);
      const headers = { Authorization: `Bearer ${session.access_token}` };
      const created = await request.post(`${qaApiURL}/api/beans`, { headers, data: {
        name: "Record recovery", roastery: "Keyboard roastery", bean_type: "single_origin", origin_country: "Ethiopia",
        process_method: "washed", roast_level: "medium", place_type: "cafe", cafe_name: "Remember this café",
        overall_score: 8, consumed_at: "2026-09-06T00:00:00Z", note: "Preserve this note.",
        roast_date: "2026-09-01", purchased_at: "2026-09-02",
      } });
      expect(created.status()).toBe(201);
      const bean = await created.json() as { id: string };
      await page.goto(`/${locale}/login`);
      await page.locator('[name="email"]').fill(user.email);
      await page.locator('[name="password"]').fill(user.password);
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
      await page.goto(`/${locale}/beans/${bean.id}/edit`);
      await page.locator('[name="roast_date"]').fill("");
      await page.locator('[name="purchased_at"]').fill("");
      await page.getByLabel(t.beans.tastingNotesPlaceholder, { exact: true }).fill("Uncommitted custom tag");
      // Save directly from a pending custom tag; no Enter press should be required.
      await page.getByRole("button", { name: t.beans.save, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
      await expect(page.getByRole("status").filter({ hasText: t.beans.saved })).toHaveText(t.beans.saved);
      const saved = await (await request.get(`${qaApiURL}/api/beans/${bean.id}`, { headers })).json();
      expect(saved).toMatchObject({ roast_date: null, purchased_at: null });
      expect(saved.tasting_tags).toEqual(expect.arrayContaining([expect.objectContaining({ tag: "uncommitted-custom-tag" })]));

      await page.goto(`/${locale}/beans/${bean.id}/edit`);
      const home = page.getByRole("radio", { name: t.beans.home, exact: true });
      const cafe = page.getByRole("radio", { name: t.beans.cafe, exact: true });
      await home.click();
      await cafe.click();
      await expect(page.locator('[name="cafe_name"]')).toHaveValue("Remember this café");
      await home.click();
      await page.getByRole("button", { name: t.beans.save, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
      const homeSaved = await (await request.get(`${qaApiURL}/api/beans/${bean.id}`, { headers })).json();
      expect(homeSaved).toMatchObject({ place_type: "home", cafe_name: null });
    } finally {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw error;
    }
  });
}

for (const locale of ["ko", "en"] as const) {
  test(`${locale} invalid inputs and failed saves preserve a decimal blend for retry`, async ({ page, request }) => {
    test.skip(!qaApiURL, "Requires isolated staging API");
    test.setTimeout(90_000);
    const t = locale === "ko" ? ko : en;
    const user = { email: `beanmap-qa-record-validation-${randomUUID()}@local.test`, password: randomBytes(24).toString("hex") };
    const id = await ensureUser(user.email, user.password);
    let releaseSave = () => {};
    try {
      const { session } = await signIn(user.email, user.password);
      const headers = { Authorization: `Bearer ${session.access_token}` };
      await page.goto(`/${locale}/login`);
      await page.locator('[name="email"]').fill(user.email);
      await page.locator('[name="password"]').fill(user.password);
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
      await page.evaluate(() => localStorage.setItem("recent_roasteries", JSON.stringify(["Keyboard roastery"])));
      await page.goto(`/${locale}/beans/new`);
      await page.locator('[name="name"]').fill("Recover this blend");
      const roastery = page.locator('[name="roastery"]');
      await roastery.fill("Keyboard");
      await roastery.press("ArrowDown");
      await page.getByRole("button", { name: "Keyboard roastery", exact: true }).press("Enter");
      await expect(roastery).toHaveValue("Keyboard roastery");
      await page.locator('[name="origin_country"]').fill("Ethiopia");
      await page.locator('[name="note"]').fill("Keep the whole tasting note on failure.");
      await expect(page.locator('[name="name"]')).toHaveAttribute("maxlength", "200");
      await expect(page.locator('[name="note"]')).toHaveAttribute("maxlength", "2000");
      const altitude = page.locator('[name="altitude_m"]');
      await altitude.fill("-1");
      const save = page.getByRole("button", { name: t.beans.save, exact: true });
      await save.click();
      await expect(page.locator("#bean-form-errors")).toContainText(t.beans.minimumField.replace("{field}", t.beans.altitude).replace("{min}", "0"));
      await expect(altitude).toBeFocused();
      await expect(altitude).toHaveAttribute("aria-invalid", "true");
      await expect(page.locator('[name="note"]')).toHaveValue("Keep the whole tasting note on failure.");
      await altitude.fill("1800");

      // Arrow keys move and select within the bean-type radio group.
      await page.getByRole("radio", { name: t.beans.singleOrigin, exact: true }).focus();
      await page.keyboard.press("ArrowRight");
      await expect(page.getByRole("radio", { name: t.beans.blend, exact: true })).toBeFocused();
      await page.locator('[name="blend_origin_0"]').fill("Brazil");
      await page.locator('[name="blend_percentage_0"]').fill("33.3");
      await page.getByRole("button", { name: t.beans.addComponent, exact: true }).click();
      await page.locator('[name="blend_origin_1"]').fill("Colombia");
      await page.locator('[name="blend_percentage_1"]').fill("66.7");
      await page.locator('[name="blend_percentage_0"]').fill("33.333");
      await page.locator('[name="blend_percentage_1"]').fill("66.667");
      await save.click();
      await expect(page.locator("#bean-form-errors")).toContainText(t.beans.percentagePrecision);
      await expect(page.locator('[name="blend_percentage_0"]')).toBeFocused();
      await expect(page.locator('[name="blend_percentage_0"]')).toHaveValue("33.333");
      await page.locator('[name="blend_percentage_0"]').fill("33.3");
      await page.locator('[name="blend_percentage_1"]').fill("66.7");
      const blendRegion = page.locator('[name="blend_region_0"]');
      await blendRegion.fill("Minas");
      const regionOption = page.getByRole("option").filter({ hasText: "Minas Gerais" }).first();
      await expect(regionOption).toBeVisible({ timeout: 15_000 });
      await regionOption.click();
      const regionText = await blendRegion.inputValue();
      await page.getByRole("button", { name: t.beans.addFarmProducer, exact: false }).first().click();
      const blendFarm = page.locator('[name="blend_farm_producer_0"]');
      await blendFarm.fill("Remember the blend producer");
      await page.locator('[name="blend_origin_0"]').focus();
      await page.locator('[name="blend_origin_0"]').press("Tab");
      await expect(blendRegion).toHaveValue(regionText);
      await expect(blendFarm).toHaveValue("Remember the blend producer");
      await blendRegion.focus();
      await blendRegion.press("Tab");
      await expect(blendFarm).toHaveValue("Remember the blend producer");
      await page.getByRole("button", { name: t.beans.moreDetails, exact: true }).click();
      const aromaOne = page.getByRole("radio", { name: `${t.beans.aroma} 1`, exact: true });
      await aromaOne.focus();
      await page.keyboard.press("ArrowRight");
      await expect(page.getByRole("radio", { name: `${t.beans.aroma} 2`, exact: true })).toHaveAttribute("aria-checked", "true");
      await page.keyboard.press("End");
      await expect(page.getByRole("radio", { name: `${t.beans.aroma} 5`, exact: true })).toBeFocused();
      await page.keyboard.press("Home");
      await expect(aromaOne).toHaveAttribute("aria-checked", "true");
      const tag = page.getByLabel(t.beans.tastingNotesPlaceholder, { exact: true });
      await tag.fill("柑橘");
      await page.getByRole("button", { name: t.beans.addTag, exact: true }).click();
      await expect(tag).toHaveValue("");
      await tag.fill("Retry tag");

      let mutationHeld = false;
      const gate = new Promise<void>((resolve) => { releaseSave = resolve; });
      await page.route("**/beans/new", async (route) => {
        const req = route.request();
        if (req.method() === "POST" && req.headers()["next-action"]) {
          const args = req.postDataJSON() as unknown[];
          if (Array.isArray(args) && args.length === 1 && args[0] && typeof args[0] === "object" && "name" in args[0]) {
            mutationHeld = true;
            await gate;
            await route.fulfill({ status: 503, contentType: "text/plain", body: "Temporary staging test failure" });
            return;
          }
        }
        await route.continue();
      });
      await save.click();
      await expect.poll(() => mutationHeld).toBe(true);
      await expect(page.locator('[name="name"]')).toBeDisabled();
      await expect(tag).toBeDisabled();
      await expect(page.getByRole("radio", { name: t.beans.singleOrigin, exact: true })).toBeDisabled();
      releaseSave();
      await expect(page.locator("#bean-form-errors")).toContainText(t.beans.saveFailed);
      await expect(page.locator("#bean-form-errors")).toBeFocused();
      await expect(page.locator('[name="name"]')).toBeEnabled();
      await expect(page.locator('[name="name"]')).toHaveValue("Recover this blend");
      await expect(page.locator('[name="blend_percentage_0"]')).toHaveValue("33.3");
      await expect(tag).toHaveValue("Retry tag");
      await page.unrouteAll({ behavior: "wait" });
      await page.locator('button[name="continue"]').click();
      await expect(page.locator('[name="name"]')).toHaveValue("");
      await expect(page.locator('[name="name"]')).toBeFocused();
      await expect(roastery).toHaveValue("Keyboard roastery");
      await expect(page.locator("#bean-form-errors")).toHaveCount(0);
      const list = await (await request.get(`${qaApiURL}/api/beans`, { headers })).json();
      expect(list.beans).toHaveLength(1);
      const saved = await (await request.get(`${qaApiURL}/api/beans/${list.beans[0].id}`, { headers })).json();
      expect(saved.blend_components.map((item: { percentage: number }) => item.percentage)).toEqual([33.3, 66.7]);
      expect(saved.tasting_tags).toEqual(expect.arrayContaining([
        expect.objectContaining({ tag: "柑橘" }), expect.objectContaining({ tag: "retry-tag" }),
      ]));
    } finally {
      releaseSave();
      await page.unrouteAll({ behavior: "wait" });
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw error;
    }
  });
}
