import { randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { admin, stagingSupabaseUrl } from "./helpers";
import ko from "../../src/i18n/ko.json" with { type: "json" };
import en from "../../src/i18n/en.json" with { type: "json" };

for (const locale of ["ko", "en"] as const) {
  test(`${locale} signup email can be confirmed and login resumes the requested page`, async ({ page, context }) => {
    test.setTimeout(60_000);
    const supabase = new URL(stagingSupabaseUrl);
    test.skip(!["localhost", "127.0.0.1"].includes(supabase.hostname), "Local Mailpit is only available in local staging.");
    const mailBase = `http://localhost:${Number(supabase.port) + 3}`;
    const email = `beanmap-qa-confirm-${randomUUID()}@local.test`;
    const password = randomBytes(24).toString("hex");
    const t = locale === "ko" ? ko : en;
    try {
      await page.goto(`/${locale}/signup?next=${encodeURIComponent(`/${locale}/stats`)}`);
      await page.locator('[name="displayName"]').fill("Coffee QA");
      await page.locator('[name="email"]').fill(email);
      await page.locator('[name="password"]').fill(password);
      await page.locator('[name="passwordConfirm"]').fill(password);
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: t.auth.signup, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/signup/check-email\\?next=`));
      let messageId: string | undefined;
      await expect.poll(async () => {
        const inbox = await (await fetch(`${mailBase}/api/v1/messages`)).json();
        messageId = inbox.messages.find((message: { To: { Address: string }[] }) => message.To.some((recipient) => recipient.Address === email))?.ID;
        return Boolean(messageId);
      }).toBe(true);
      const message = await (await fetch(`${mailBase}/api/v1/message/${messageId}`)).json();
      const link = String(message.Text).match(/https?:\/\/[^\s<>]*\/auth\/v1\/verify[^\s<>]*/)?.[0];
      expect(Boolean(link)).toBe(true);
      const confirmation = await context.newPage();
      await confirmation.goto(link!);
      await confirmation.close();
      const listed = await admin.auth.admin.listUsers({ perPage: 1000 });
      expect(Boolean(listed.data.users.find((user) => user.email === email)?.email_confirmed_at)).toBe(true);
      await page.getByRole("link", { name: t.auth.checkEmailGoLogin, exact: true }).click();
      await page.locator('[name="email"]').fill(email);
      await page.locator('[name="password"]').fill(password);
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/stats$`));
      await expect(page.getByTestId("stats-empty-state")).toBeVisible();
    } finally {
      const listed = await admin.auth.admin.listUsers({ perPage: 1000 });
      const user = listed.data.users.find((candidate) => candidate.email === email);
      if (user) await admin.auth.admin.deleteUser(user.id);
    }
  });
}
