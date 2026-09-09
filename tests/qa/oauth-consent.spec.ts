import { randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { admin, localPendingOAuthUser, qaApiURL, signIn, stagingSupabaseUrl } from "./helpers";
import ko from "../../src/i18n/ko.json" with { type: "json" };
import en from "../../src/i18n/en.json" with { type: "json" };

for (const [locale, provider] of [["ko", "google"], ["en", "kakao"]] as const) {
  test(`${locale} synthetic local OAuth pending account completes consent before data access`, async ({ page, request }) => {
    test.setTimeout(60_000);
    test.skip(!qaApiURL || ![stagingSupabaseUrl, qaApiURL].every(value => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(value).hostname)), "Synthetic provider state is restricted to local Auth");
    const email = `beanmap-qa-oauth-${randomUUID()}@local.test`;
    const password = randomBytes(24).toString("hex");
    const t = locale === "ko" ? ko : en;
    const id = localPendingOAuthUser(email, password, provider);
    try {
      expect((await admin.auth.admin.getUserById(id)).data.user!.app_metadata.beanmap_pending_consent).toBe(true);
      const { client, session } = await signIn(email, password);
      const headers = { Authorization: `Bearer ${session.access_token}` };
      expect((await request.get(`${qaApiURL}/api/beans`, { headers })).status()).toBe(401);
      const before = await client.from("beans").select("id");
      expect(before.error).toBeNull();
      expect(before.data).toEqual([]);
      await page.goto(`/${locale}/login?next=${encodeURIComponent(`/${locale}/stats`)}`);
      await page.locator('[name="email"]').fill(email);
      await page.locator('[name="password"]').fill(password);
      await page.locator('button[type="submit"]').click();
      await expect(page.getByRole("heading", { name: t.auth.consentTitle, exact: true })).toBeVisible({ timeout: 15000 });
      await page.goto(`/${locale}/stats`);
      await expect(page).toHaveURL(new RegExp(`/${locale}/consent\\?`));
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: t.auth.consentSubmit, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/stats$`));
      await expect(page.getByTestId("stats-empty-state")).toBeVisible();
      expect((await request.get(`${qaApiURL}/api/beans`, { headers })).status()).toBe(200);
      const updated = await admin.auth.admin.getUserById(id);
      expect(updated.error).toBeNull();
      expect(updated.data.user!.app_metadata.beanmap_pending_consent).toBeUndefined();
    } finally {
      const deleted = await admin.auth.admin.deleteUser(id);
      if (deleted.error) throw deleted.error;
    }
  });
}
