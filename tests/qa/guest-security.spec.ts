import { randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { admin, ensureUser } from "./helpers";
import ko from "../../src/i18n/ko.json" with { type: "json" };

const key = "beanmap:guest-bean-draft";
const bean = { name: "Private guest coffee", roastery: "Guest roastery", bean_type: "single_origin", origin_country: "Ethiopia", process_method: "washed", roast_level: "medium", consumed_at: "2026-09-07", place_type: "home", overall_score: 7, note: "Private browser note", tags: [], blend_components: [] };

test("expired guest content is physically removed and a saved draft can be discarded", async ({ page }) => {
  await page.goto("/ko/try");
  await page.evaluate(({ key, bean }) => localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date(0).toISOString(), bean })), { key, bean });
  await page.reload();
  await expect(page.locator('[name="name"]')).toHaveValue("");
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBeNull();
  await page.evaluate(({ key, bean }) => localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), bean })), { key, bean });
  await page.reload();
  await expect(page.getByRole("article", { name: ko.guest.savedTitle })).toContainText(bean.name);
  await page.getByRole("button", { name: ko.draft.discard, exact: true }).click();
  await expect(page.locator('[name="name"]')).toHaveValue("");
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBeNull();
});

for (const importing of [true, false]) {
  test(`guest login ${importing ? "transfers to account-scoped tab storage" : "clears both guest stores"}`, async ({ page }) => {
    const user = { email: `beanmap-qa-guest-security-${randomUUID()}@local.test`, password: randomBytes(24).toString("hex") };
    const id = await ensureUser(user.email, user.password);
    try {
      await page.goto(`/ko/login${importing ? "?draft=1" : ""}`);
      await page.evaluate(({ key, bean }) => {
        localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), bean }));
        sessionStorage.setItem("beanmap:record-draft:v1:guest", "old unfinished guest copy");
      }, { key, bean });
      await page.locator('[name="email"]').fill(user.email);
      await page.locator('[name="password"]').fill(user.password);
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(new RegExp(importing ? "/ko/beans/new\\?draft=1$" : "/ko/explore$"));
      if (importing) {
        await expect(page.locator('[name="name"]')).toHaveValue(bean.name);
        await expect.poll(() => page.evaluate(id => sessionStorage.getItem(`beanmap:record-draft:v1:user:${encodeURIComponent(id)}:new`), id)).toContain(bean.name);
      }
      await expect.poll(() => page.evaluate(key => localStorage.getItem(key), key)).toBeNull();
      expect(await page.evaluate(() => sessionStorage.getItem("beanmap:record-draft:v1:guest"))).toBeNull();
      if (importing) {
        await page.reload();
        await expect(page.locator('[name="name"]')).toHaveValue(bean.name);
      }
    } finally { await admin.auth.admin.deleteUser(id); }
  });
}
