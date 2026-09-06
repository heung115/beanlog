import { randomBytes, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { admin, ensureUser, qaApiURL, signIn, stagingSupabaseUrl } from "./helpers";
import ko from "../../src/i18n/ko.json" with { type: "json" };
import en from "../../src/i18n/en.json" with { type: "json" };

const draftPrefix = "beanmap:record-draft:v1:";
test.beforeAll(() => {
  if ([stagingSupabaseUrl, qaApiURL].some((url) => url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))) {
    throw new Error("Draft recovery tests require isolated local services");
  }
});
async function login(page: Page, locale: string, user: { email: string; password: string }) {
  await page.goto(`/${locale}/login`);
  await page.locator('[name="email"]').fill(user.email);
  await page.locator('[name="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
}

for (const locale of ["ko", "en"] as const) {
  const t = locale === "ko" ? ko : en;

  test(`${locale} guest unfinished input survives reload/back and deliberate discard`, async ({ page }) => {
    await page.goto(`/${locale}/try`);
    await page.locator('[name="name"]').fill("Unfinished guest coffee");
    await page.locator('[name="note"]').fill("  Keep this unfinished thought.\n");
    await expect(page.getByTestId("record-draft-notice")).toContainText(t.draft.saved);
    await page.reload();
    await expect(page.locator('[name="name"]')).toHaveValue("Unfinished guest coffee");
    await expect(page.locator('[name="roastery"]')).toHaveValue("");
    await expect(page.locator('[name="note"]')).toHaveValue("  Keep this unfinished thought.\n");
    await expect(page.getByTestId("record-draft-notice")).toContainText(t.draft.recovered);
    await page.goto(`/${locale}`);
    await page.goBack();
    await expect(page.locator('[name="name"]')).toHaveValue("Unfinished guest coffee");
    await page.getByRole("button", { name: t.draft.discard, exact: true }).click();
    await expect(page.getByRole("button", { name: t.draft.keepEditing, exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: t.draft.discard, exact: true })).toBeFocused();
    await page.getByRole("button", { name: t.draft.discard, exact: true }).click();
    await page.getByRole("button", { name: t.draft.keepEditing, exact: true }).click();
    await expect(page.locator('[name="name"]')).toHaveValue("Unfinished guest coffee");
    await page.getByRole("button", { name: t.draft.discard, exact: true }).click();
    await page.getByRole("button", { name: t.draft.discardYes, exact: true }).click();
    await expect(page.locator('[name="name"]')).toHaveValue("");
    await page.reload();
    await expect(page.locator('[name="name"]')).toHaveValue("");
    await expect(page.getByTestId("record-draft-notice")).toHaveCount(0);
  });

  test(`${locale} guest explicit save clears recovery and a later unfinished edit wins`, async ({ page }) => {
    await page.goto(`/${locale}/try`);
    for (const [name, value] of Object.entries({ name: "Saved guest", roastery: "Guest roastery", origin_country: "Ethiopia", note: "A completed note." })) {
      await page.locator(`[name="${name}"]`).fill(value);
    }
    await page.getByRole("button", { name: t.guest.temporarySave, exact: true }).click();
    await expect(page.getByRole("article", { name: t.guest.savedTitle })).toBeVisible();
    expect(await page.evaluate((key) => sessionStorage.getItem(key), draftPrefix + "guest")).toBeNull();
    await page.getByRole("button", { name: t.guest.edit, exact: true }).click();
    await page.locator('[name="note"]').fill("An unfinished revision.");
    await expect(page.getByTestId("record-draft-notice")).toBeVisible();
    await page.reload();
    await expect(page.locator('[name="note"]')).toHaveValue("An unfinished revision.");
    await page.getByRole("button", { name: t.draft.discard, exact: true }).click();
    await page.getByRole("button", { name: t.draft.discardYes, exact: true }).click();
    await expect(page.getByRole("article", { name: t.guest.savedTitle })).toContainText("A completed note.");
    await page.reload();
    await expect(page.getByRole("article", { name: t.guest.savedTitle })).toContainText("A completed note.");
  });

  test(`${locale} unavailable draft storage warns before an unfinished reload`, async ({ page }) => {
    test.setTimeout(30_000);
    await page.addInitScript(() => {
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key.startsWith("beanmap:record-draft:")) throw new DOMException("Unavailable", "QuotaExceededError");
        return setItem.call(this, key, value);
      };
    });
    await page.goto(`/${locale}/try`);
    await page.locator('[name="name"]').click();
    await page.locator('[name="name"]').fill("Keep me if storage fails");
    await expect(page.getByTestId("record-draft-notice")).toContainText(t.draft.unavailable);
    const dialogPromise = page.waitForEvent("dialog", { timeout: 10_000 });
    // A dismissed reload has no navigation event for page.reload() to await.
    await page.evaluate(() => { setTimeout(() => window.location.reload(), 0); });
    const dialog = await dialogPromise;
    expect(dialog.type()).toBe("beforeunload");
    await dialog.dismiss();
    await expect(page.locator('[name="name"]')).toHaveValue("Keep me if storage fails");
  });

  test(`${locale} account drafts preserve hidden fields and tags, isolate records, and clear on save`, async ({ page, request }) => {
    test.skip(!qaApiURL, "Requires isolated staging API");
    test.setTimeout(150_000);
    const user = { email: `beanmap-qa-draft-${randomUUID()}@local.test`, password: randomBytes(24).toString("hex") };
    const id = await ensureUser(user.email, user.password);
    try {
      const { session } = await signIn(user.email, user.password);
      const headers = { Authorization: `Bearer ${session.access_token}` };
      await login(page, locale, user);
      await page.goto(`/${locale}/beans/new`);
      await page.locator('[name="name"]').fill("Recovered account coffee");
      await page.locator('[name="roastery"]').fill("Draft roastery");
      await page.locator('[name="origin_country"]').fill("Ethiopia");
      await page.locator('[name="cafe_name"]').fill("Keep this café");
      await page.locator('[name="note"]').fill("Recover this account note.");
      await page.getByRole("button", { name: t.beans.moreDetails, exact: true }).click();
      await page.getByLabel(t.beans.tastingNotesPlaceholder, { exact: true }).fill("Pending draft tag");
      await page.getByRole("radio", { name: t.beans.home, exact: true }).click();
      await page.getByRole("radio", { name: t.beans.blend, exact: true }).click();
      await page.reload();
      await expect(page.getByRole("radio", { name: t.beans.blend, exact: true })).toHaveAttribute("aria-checked", "true");
      await expect(page.getByLabel(t.beans.tastingNotesPlaceholder, { exact: true })).toHaveValue("Pending draft tag");
      await page.getByRole("radio", { name: t.beans.singleOrigin, exact: true }).click();
      await expect(page.locator('[name="origin_country"]')).toHaveValue(/^(Ethiopia|에티오피아)$/);
      await page.getByRole("radio", { name: t.beans.cafe, exact: true }).click();
      await expect(page.locator('[name="cafe_name"]')).toHaveValue("Keep this café");
      await page.getByRole("button", { name: t.common.cancel, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
      await page.goto(`/${locale}/beans/new`);
      await expect(page.locator('[name="name"]')).toHaveValue("Recovered account coffee");
      await page.getByRole("button", { name: t.beans.saveAndAddAnother, exact: true }).click();
      await expect(page.locator('[name="name"]')).toHaveValue("");
      await expect(page.locator('[name="roastery"]')).toHaveValue("Draft roastery");
      expect(await page.evaluate((key) => sessionStorage.getItem(key), `${draftPrefix}user:${id}:new`)).toBeNull();

      const list = await (await request.get(`${qaApiURL}/api/beans`, { headers })).json();
      const saved = (Array.isArray(list) ? list : list.beans ?? list.data).find((bean: { name: string }) => bean.name === "Recovered account coffee");
      expect(saved).toBeTruthy();
      await page.goto(`/${locale}/beans/${saved.id}/edit`);
      await page.locator('[name="note"]').fill("Unsaved edit");
      await page.reload();
      await expect(page.locator('[name="note"]')).toHaveValue("Unsaved edit");
      await page.goto(`/${locale}/beans/new`);
      await expect(page.locator('[name="name"]')).toHaveValue("");
      await page.goto(`/${locale}/beans/${saved.id}/edit`);
      await expect(page.locator('[name="note"]')).toHaveValue("Unsaved edit");
      await page.getByRole("button", { name: t.draft.discard, exact: true }).click();
      await page.getByRole("button", { name: t.draft.discardYes, exact: true }).click();
      await expect(page.locator('[name="note"]')).toHaveValue("Recover this account note.");
      await page.locator('[name="note"]').fill("Saved edit");
      await page.getByRole("button", { name: t.beans.save, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
      expect(await page.evaluate((key) => sessionStorage.getItem(key), `${draftPrefix}user:${id}:edit:${saved.id}`)).toBeNull();

      await page.goto(`/${locale}/beans/${saved.id}/edit`);
      await page.locator('[name="note"]').fill("My unfinished competing edit");
      await expect(page.getByTestId("record-draft-notice")).toBeVisible();
      const updated = await request.put(`${qaApiURL}/api/beans/${saved.id}`, { headers, data: {
        name: saved.name, roastery: saved.roastery, bean_type: "single_origin", origin_country: "Ethiopia",
        process_method: "washed", roast_level: "medium", place_type: "home", overall_score: 8,
        consumed_at: "2026-09-06T00:00:00Z", note: "Updated elsewhere",
      } });
      expect(updated.status()).toBe(200);
      await page.reload();
      await expect(page.getByTestId("record-draft-notice")).toContainText(t.draft.conflict);
      await expect(page.locator('[name="note"]')).toHaveValue("Updated elsewhere");
      await expect(page.locator('[name="note"]')).toBeDisabled();
      await page.getByRole("button", { name: t.draft.restore, exact: true }).click();
      await expect(page.locator('[name="note"]')).toHaveValue("My unfinished competing edit");
      await expect(page.locator('[name="note"]')).toBeEnabled();
      expect((await (await request.get(`${qaApiURL}/api/beans/${saved.id}`, { headers })).json()).note).toBe("Updated elsewhere");
    } finally {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw error;
    }
  });
}

test("unfinished account drafts do not appear for another account in the same tab", async ({ page, context }) => {
  test.setTimeout(120_000);
  const users = [1, 2].map(() => ({ email: `beanmap-qa-draft-owner-${randomUUID()}@local.test`, password: randomBytes(24).toString("hex") }));
  const ids: string[] = [];
  try {
    for (const user of users) ids.push(await ensureUser(user.email, user.password));
    await login(page, "en", users[0]);
    await page.goto("/en/beans/new");
    await page.locator('[name="name"]').fill("First account's private draft");
    await expect(page.getByTestId("record-draft-notice")).toContainText(en.draft.saved);
    await context.clearCookies();
    await login(page, "en", users[1]);
    await page.goto("/en/beans/new");
    await expect(page.locator('[name="name"]')).toHaveValue("");
    await expect(page.getByTestId("record-draft-notice")).toHaveCount(0);
    await page.locator('[name="name"]').fill("Second account's private draft");
    await expect(page.getByTestId("record-draft-notice")).toContainText(en.draft.saved);
    await context.clearCookies();
    await login(page, "en", users[0]);
    await page.goto("/en/beans/new");
    await expect(page.locator('[name="name"]')).toHaveValue("First account's private draft");
  } finally {
    for (const id of ids) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw error;
    }
  }
});
