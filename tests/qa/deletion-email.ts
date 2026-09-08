import { expect, type Page } from "@playwright/test";
import { browserSupabaseUrl } from "./helpers";

/** Only the isolated Mailpit fixture is eligible for email-code reads. */
export async function accountDeletionCode(page: Page, email: string): Promise<string> {
  const origin = new URL(browserSupabaseUrl);
  origin.port = String(Number(origin.port) + 3);
  const mail = new URL(process.env.QA_MAIL_URL ?? origin.origin);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(mail.hostname) || !/^beanmap-qa-[a-z0-9-]+@local\.test$/.test(email)) {
    throw new Error("Deletion email verification requires a local disposable fixture");
  }
  let messageId: string | undefined;
  await expect.poll(async () => {
    const response = await page.request.get(new URL("/api/v1/search", mail).toString(), { params: { query: `to:${email}` } });
    if (!response.ok()) return false;
    const body = await response.json() as { messages: Array<{ ID: string }> };
    messageId = body.messages[0]?.ID;
    return Boolean(messageId);
  }, { timeout: 15000 }).toBe(true);
  const message = await page.request.get(new URL(`/api/v1/message/${messageId}`, mail).toString());
  expect(message.ok()).toBe(true);
  const body = await message.json() as { HTML: string; Text: string };
  const token = body.HTML.match(/<p\b[^>]*>\s*(\d{6,10})\s*<\/p>/i)?.[1];
  if (!token) throw new Error("The local verification email did not contain a numeric code");
  return token;
}
