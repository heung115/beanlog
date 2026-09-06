import { expect, test } from "@playwright/test";
import ko from "../../src/i18n/ko.json" with { type: "json" };
import en from "../../src/i18n/en.json" with { type: "json" };
import { RECORD_DRAFT_PREFIX, serializeRecordDraft } from "../../src/lib/coffee/record-draft";

const sample = (name: string) => ({
  name, roastery: "Stored guest roastery", bean_type: "single_origin", origin_country: "Ethiopia",
  process_method: "washed", roast_level: "medium", consumed_at: "2026-08-20", place_type: "home",
  overall_score: 7, note: "Stored guest note", tags: [], blend_components: [],
});
for (const locale of ["ko", "en"] as const) {
  const t = locale === "ko" ? ko : en;
  for (const stored of ["empty", "local", "session", "both"] as const) {
    test(`${locale} guest delayed hydration protects early fields and ${stored} draft recovery keeps newer input`, async ({ page, baseURL }, info) => {
      test.setTimeout(60000);
      if (!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) throw new Error("Guest hydration QA is limited to isolated local apps");
      const local = stored === "local" || stored === "both"
        ? JSON.stringify({ version: 1, savedAt: new Date().toISOString(), bean: sample("Previously saved guest record") }) : null;
      const session = stored === "session" || stored === "both"
        ? serializeRecordDraft(sample("Newer unfinished guest record"), null) : null;
      await page.addInitScript(({ local, session, key }) => {
        // Seed once: a reload must read the user's newly written draft, not our fixture again.
        if (sessionStorage.getItem("beanmap-qa:guest-hydration-seeded")) return;
        sessionStorage.setItem("beanmap-qa:guest-hydration-seeded", "1");
        if (local) localStorage.setItem("beanmap:guest-bean-draft", local);
        if (session) sessionStorage.setItem(key, session);
      }, { local, session, key: RECORD_DRAFT_PREFIX + "guest" });
      let release = () => {};
      let scriptsBlocked = 0;
      const scriptsReady = new Promise<void>((resolve) => { release = resolve; });
      await page.route("**/*", async (route) => {
        if (route.request().resourceType() === "script") {
          scriptsBlocked++;
          await scriptsReady;
        }
        await route.continue();
      });
      try {
        await page.goto(`/${locale}/try`, { waitUntil: "commit" });
        const name = page.locator('[name="name"]');
        await expect(name).toBeVisible();
        await expect.poll(() => scriptsBlocked).toBeGreaterThan(0);
        for (const field of ["name", "roastery", "origin_country", "consumed_at", "note", "process_method", "roast_level"]) {
          await expect(page.locator(`[name="${field}"]`)).toBeDisabled();
        }
        await expect(page.getByRole("button", { name: t.guest.temporarySave, exact: true })).toBeDisabled();
        const before = { scriptsBlocked, nameDisabled: await name.isDisabled(), name: await name.inputValue() };
        release();
        await page.waitForLoadState("load");
        if (stored === "local") {
          await expect(page.getByRole("article", { name: t.guest.savedTitle })).toContainText("Previously saved guest record");
          await page.getByRole("button", { name: t.guest.edit, exact: true }).click();
        }
        await expect(name).toBeEditable();
        await expect(name).toHaveValue(stored === "empty" ? "" : stored === "local" ? "Previously saved guest record" : "Newer unfinished guest record");
        const edited = `${locale} newest user input after hydration`;
        await name.pressSequentially(edited, { delay: 1 });
        const expectedName = await name.inputValue();
        await page.locator('[name="roastery"]').fill("Newly typed roastery");
        await page.locator('[name="note"]').fill("New note\nPreserve this line");
        await page.locator('[name="process_method"]').selectOption("natural");
        await expect(name).toHaveValue(expectedName);
        // Immediate reload exercises storage persistence without waiting for a notice or timer.
        await page.reload();
        await expect(name).toBeEditable();
        await expect(name).toHaveValue(expectedName);
        await expect(page.locator('[name="roastery"]')).toHaveValue("Newly typed roastery");
        await expect(page.locator('[name="note"]')).toHaveValue("New note\nPreserve this line");
        await expect(page.locator('[name="process_method"]')).toHaveValue("natural");
        await expect(page.getByRole("article", { name: t.guest.savedTitle })).toHaveCount(0);
        await info.attach("guest-hydration-values.json", {
          contentType: "application/json", body: Buffer.from(JSON.stringify({ stored, before, after: { name: await name.inputValue(), roastery: await page.locator('[name="roastery"]').inputValue(), note: await page.locator('[name="note"]').inputValue() } }, null, 2)),
        });
      } finally {
        release();
        await page.unrouteAll({ behavior: "wait" });
      }
    });
  }
}
