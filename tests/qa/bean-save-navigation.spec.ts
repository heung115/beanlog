import { randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { admin, ensureUser, qaApiURL, signIn } from "./helpers";
import { recentRoasteriesKey } from "../../src/lib/coffee/recent-roasteries";
import ko from "../../src/i18n/ko.json" with { type: "json" };
import en from "../../src/i18n/en.json" with { type: "json" };

for (const locale of ["ko", "en"] as const) {
  test(`${locale} saving with pending origin lookups opens a fresh journal document`, async ({ page, request }) => {
    test.skip(!qaApiURL, "The isolated fixture is created through the staging Go API");
    test.setTimeout(90_000);
    const t = locale === "ko" ? ko : en;
    const user = {
      email: `beanmap-qa-save-navigation-${randomUUID()}@local.test`,
      password: randomBytes(24).toString("hex"),
    };
    const userId = await ensureUser(user.email, user.password);
    let releaseLookup = () => {};
    try {
      const { session } = await signIn(user.email, user.password);
      const headers = { Authorization: `Bearer ${session.access_token}` };
      const created = await request.post(`${qaApiURL}/api/beans`, {
        headers,
        data: {
          name: "Pending lookup save", roastery: "Before save", bean_type: "blend",
          process_method: "washed", roast_level: "medium", place_type: "home",
          overall_score: 8, consumed_at: new Date().toISOString(), note: "Keep this tasting note.",
          blend_components: [
            { origin_country: "Brazil", origin_region: "Minas Gerais", percentage: 60, sort_order: 0 },
            { origin_country: "Colombia", origin_region: "Huila", percentage: 40, sort_order: 1 },
          ],
        },
      });
      expect(created.status()).toBe(201);
      const bean = await created.json() as { id: string };

      await page.goto(`/${locale}/login`);
      await page.locator('[name="email"]').fill(user.email);
      await page.locator('[name="password"]').fill(user.password);
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`), { timeout: 20_000 });

      const lookupGate = new Promise<void>((resolve) => { releaseLookup = resolve; });
      let lookupHeld = false;
      let mutationSent = false;
      let journalDocuments = 0;
      page.on("request", (req) => {
        if (req.isNavigationRequest() && req.frame() === page.mainFrame()
          && new URL(req.url()).pathname === `/${locale}/explore`) {
          journalDocuments++;
        }
      });
      await page.route(`**/beans/${bean.id}/edit`, async (route) => {
        const req = route.request();
        if (req.method() !== "POST" || !req.headers()["next-action"]) {
          await route.continue();
          return;
        }
        const args = req.postDataJSON() as unknown[];
        if (args.length === 3 && args[0] === bean.id && typeof args[2] === "string") {
          mutationSent = true;
          await route.continue();
          return;
        }
        // Block one real lookup while Save queues its mutation behind it.
        // Sibling country/region results can enqueue further lookups as the
        // mutation resolves, reproducing the router-action overlap.
        if (!lookupHeld && args.length === 1 && typeof args[0] === "object") {
          lookupHeld = true;
          await lookupGate;
        }
        await route.continue();
      });

      await page.goto(`/${locale}/beans/${bean.id}/edit`);
      await expect.poll(() => lookupHeld).toBe(true);
      await page.locator('[name="roastery"]').fill("After save");
      const save = page.getByRole("button", { name: t.beans.save, exact: true });
      await save.click();
      await expect(page.getByRole("button", { name: t.beans.saving, exact: true })).toBeDisabled();
      expect(mutationSent).toBe(false);
      releaseLookup();

      await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`), { timeout: 20_000 });
      // A document navigation abandons the old page's action queue. A late
      // lookup therefore cannot put the saved edit screen back in place.
      expect(journalDocuments).toBe(1);
      await page.waitForLoadState("networkidle");
      await expect(page.getByTestId("bean-card")).toHaveCount(1);
      await expect(page.getByTestId("bean-card")).toContainText("After save");
      await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
      expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "[]"), recentRoasteriesKey(userId))).toContain("After save");
      expect(await page.evaluate(() => localStorage.getItem("recent_roasteries"))).toBeNull();
      const stored = await request.get(`${qaApiURL}/api/beans/${bean.id}`, { headers });
      expect(stored.status()).toBe(200);
      expect(await stored.json()).toMatchObject({ roastery: "After save", note: "Keep this tasting note." });

      // Save-and-add-another keeps the active document and the roastery draft.
      await page.goto(`/${locale}/beans/new`);
      await page.locator('[name="name"]').fill("Next tasting");
      await page.locator('[name="roastery"]').fill("After save");
      await page.locator('[name="origin_country"]').fill("QA Origin");
      await page.locator('[name="note"]').fill("A second tasting note.");
      await page.locator('button[name="continue"]').click();
      await expect(page.locator('[name="name"]')).toHaveValue("");
      await expect(page.locator('[name="roastery"]')).toHaveValue("After save");
      await expect(page).toHaveURL(new RegExp(`/${locale}/beans/new$`));
      expect(journalDocuments).toBe(1);
    } finally {
      releaseLookup();
      await page.unrouteAll({ behavior: "wait" });
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
    }
  });
}
