import { randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { expect, test, type Page } from "@playwright/test";
import { admin, browserSupabaseUrl, ensureUser, qaBaseURL, stagingSupabaseUrl } from "./helpers";
import ko from "../../src/i18n/ko.json" with { type: "json" };
import en from "../../src/i18n/en.json" with { type: "json" };

const require = createRequire(import.meta.url);
const isLocal = (url: string) => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
const localMailUrl = new URL(stagingSupabaseUrl);
localMailUrl.port = String(Number(localMailUrl.port) + 3);
const mailUrl = process.env.QA_MAIL_URL ?? localMailUrl.origin;

test.beforeAll(() => {
  // These tests create and remove disposable accounts. Never run them on production.
  for (const url of [qaBaseURL, stagingSupabaseUrl, browserSupabaseUrl, mailUrl]) {
    if (!isLocal(url)) throw new Error("Authentication recovery audit requires isolated local services");
  }
});

async function fillSignup(page: Page, waitForHydration = true) {
  await page.locator('[name="displayName"]').fill("Recovery audit");
  await page.locator('[name="email"]').fill("beanmap-audit@local.test");
  await page.locator('[name="password"]').fill("AuditPassword123!");
  await page.locator('[name="passwordConfirm"]').fill("AuditPassword123!");
  await page.locator('main input[type="checkbox"]').check();
  // The consent-driven provider state confirms hydration without a fixed delay.
  if (waitForHydration) await expect(page.locator('main button[type="button"]').first()).toBeEnabled();
}

async function blockActions(page: Page) {
  let attempts = 0;
  await page.route("**/*", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    attempts++;
    return route.abort("failed");
  });
  return () => attempts;
}

for (const locale of ["ko", "en"] as const) {
  const t = locale === "ko" ? ko : en;

  test(`${locale} signup cannot put credentials in a URL without JavaScript`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
    const page = await context.newPage();
    try {
      await page.goto(`/${locale}/signup?draft=1`);
      const submitted: Array<{ method: string; query: string[] }> = [];
      await page.route("**/*", async (route) => {
        const request = route.request();
        if (request.isNavigationRequest() || request.method() === "POST") {
          submitted.push({ method: request.method(), query: [...new URL(request.url()).searchParams.keys()] });
          return route.abort("aborted");
        }
        return route.continue();
      });
      await fillSignup(page, false);
      const submit = page.locator('button[type="submit"]');
      if (await submit.isDisabled()) {
        await expect(page.locator("main")).toContainText(/JavaScript|자바스크립트/i);
      } else {
        await submit.click({ noWaitAfter: true });
        await expect.poll(() => submitted.length).toBeGreaterThan(0);
        expect(submitted.every((request) => request.method === "POST")).toBe(true);
        expect(submitted.flatMap((request) => request.query)).not.toEqual(expect.arrayContaining(["password"]));
        expect(submitted.flatMap((request) => request.query)).not.toEqual(expect.arrayContaining(["passwordConfirm"]));
      }
    } finally {
      await context.close();
    }
  });

  test(`${locale} the recovery request has a safe native POST fallback`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
    const page = await context.newPage();
    try {
      await page.goto(`/${locale}/forgot-password?draft=1`);
      const submitted: Array<{ method: string; query: string[] }> = [];
      await page.route("**/*", async (route) => {
        const request = route.request();
        if (request.isNavigationRequest() || request.method() === "POST") {
          submitted.push({ method: request.method(), query: [...new URL(request.url()).searchParams.keys()] });
          return route.abort("aborted");
        }
        return route.continue();
      });
      await page.locator('[name="email"]').fill("native-recovery-audit@local.test");
      await page.locator('button[type="submit"]').click({ noWaitAfter: true });
      await expect.poll(() => submitted.length).toBeGreaterThan(0);
      expect(submitted.every((request) => request.method === "POST")).toBe(true);
      expect(submitted.flatMap((request) => request.query)).not.toContain("email");
    } finally {
      await context.close();
    }
  });

  for (const mobile of [false, true]) {
    const prefix = `${mobile ? "@mobile " : ""}${locale}`;

    test(`${prefix} signup identifies blank names and mismatched confirmation before sending`, async ({ page }) => {
      if (mobile) await page.setViewportSize({ width: 320, height: 844 });
      const attempts = await blockActions(page);
      await page.goto(`/${locale}/signup`);
      await fillSignup(page);
      const name = page.locator('[name="displayName"]');
      const confirmation = page.locator('[name="passwordConfirm"]');
      const submit = page.locator('button[type="submit"]');
      await name.fill("   ");
      await submit.click();
      await expect(name).toBeFocused();
      await expect(name).toHaveAttribute("aria-invalid", "true");
      await expect(name).toHaveAttribute("aria-describedby", /signup-form-error/);
      await expect(page.locator("#signup-form-error")).toBeVisible();
      expect(attempts()).toBe(0);

      await name.fill("Recovery audit");
      await confirmation.fill("DifferentPassword123!");
      await submit.click();
      await expect(confirmation).toBeFocused();
      await expect(confirmation).toHaveAttribute("aria-invalid", "true");
      await expect(confirmation).toHaveAttribute("aria-describedby", /signup-form-error/);
      await expect(page.locator("#signup-form-error")).toHaveText(t.auth.passwordMismatch);
      expect(attempts()).toBe(0);
    });

    test(`${prefix} signup exposes password limits before submission`, async ({ page }) => {
      if (mobile) await page.setViewportSize({ width: 320, height: 844 });
      await page.goto(`/${locale}/signup`);
      const password = page.locator('[name="password"]');
      await expect(password).toHaveAttribute("minlength", "6");
      await expect(password).toHaveAttribute("maxlength", "128");
      await expect(password).toHaveAttribute("aria-describedby", /password-requirements/);
      await expect(page.locator("#password-requirements")).toBeVisible();
      await expect(password).toHaveAccessibleDescription(/6.*128/);
    });

    for (const form of ["login", "signup"] as const) {
      test(`${prefix} ${form} failed submission returns keyboard focus for Enter retry`, async ({ page }) => {
        if (mobile) await page.setViewportSize({ width: 320, height: 844 });
        const attempts = await blockActions(page);
        await page.goto(`/${locale}/${form}?draft=1`);
        if (form === "signup") await fillSignup(page);
        else {
          await page.locator('[name="email"]').fill("beanmap-audit@local.test");
          await page.locator('[name="password"]').fill("AuditPassword123!");
          await page.locator('[name="remember"]').uncheck();
        }
        const submit = page.locator('button[type="submit"]');
        for (let attempt = 1; attempt <= 2; attempt++) {
          if (attempt === 1) await submit.click();
          else await page.keyboard.press("Enter");
          await expect.poll(attempts).toBe(attempt);
          await expect(page.locator("main").getByRole("alert")).toBeVisible();
          await expect(submit).toBeEnabled();
          await expect(submit).toBeFocused();
          await expect(page.locator('[name="email"]')).toHaveValue("beanmap-audit@local.test");
          await expect(page.locator('[name="password"]')).toHaveValue("AuditPassword123!");
        }
        if (form === "login") await expect(page.locator('[name="remember"]')).not.toBeChecked();
        await page.addScriptTag({ path: require.resolve("axe-core") });
        const violations = await page.evaluate(async () => {
          const axe = (window as unknown as { axe: { run: (context: Element, options: unknown) => Promise<{ violations: unknown[] }> } }).axe;
          return (await axe.run(document.querySelector("main")!, { runOnly: { type: "rule", values: ["color-contrast"] } })).violations;
        });
        expect(violations).toEqual([]);
        if (mobile) {
          await page.locator("main").getByRole("alert").evaluate((alert) => alert.scrollIntoView({ block: "center", behavior: "instant" }));
          await page.screenshot({ path: test.info().outputPath(`${locale}-${form}-error-viewport.png`), fullPage: false });
        }
      });
    }
  }

  test(`${locale} failed social sign-in restores its provider button for keyboard retry`, async ({ page }) => {
    const attempts = await blockActions(page);
    await page.goto(`/${locale}/login`);
    await page.locator('main input[type="checkbox"]').last().check();
    const provider = page.getByRole("button", { name: t.auth.loginWithGoogle, exact: true });
    await provider.click();
    await expect(page.locator("main").getByRole("alert")).toHaveText(t.auth.socialError);
    await expect(provider).toBeFocused();
    await page.keyboard.press("Enter");
    await expect.poll(attempts).toBe(2);
    await expect(provider).toBeFocused();
  });

  test(`${locale} password recovery entry and expired links preserve draft destinations`, async ({ page }) => {
    const next = `/${locale}/beans/new?draft=1`;
    await page.goto(`/${locale}/login?draft=1`);
    await page.locator(`main a[href*="/${locale}/forgot-password"]`).click();
    expect(new URL(page.url()).searchParams.get("draft") === "1" || new URL(page.url()).searchParams.get("next") === next).toBe(true);
    await expect(page.locator('[name="email"]')).toBeVisible();

    await page.goto(`/api/auth/callback?mode=recovery&locale=${locale}&next=${encodeURIComponent(next)}&token_hash=invalid-audit-token&type=recovery`);
    await expect(page).toHaveURL(new RegExp(`/${locale}/forgot-password\\?`));
    expect(new URL(page.url()).searchParams.get("recoveryError")).toBe("expired");
    expect(new URL(page.url()).searchParams.get("next")).toBe(next);
    await expect(page.locator("main").getByRole("alert")).toBeVisible();
    await page.goto(`/${locale}/reset-password?next=${encodeURIComponent(next)}`);
    await expect(page).toHaveURL(new RegExp(`/${locale}/forgot-password\\?`));
    expect(new URL(page.url()).searchParams.get("next")).toBe(next);
  });

  test(`${locale} an unregistered recovery request replaces the expired warning with public delivery guidance`, async ({ page }) => {
    await page.goto(`/${locale}/forgot-password?recoveryError=expired`);
    await expect(page.locator("main").getByRole("alert")).toBeVisible();
    await page.locator('[name="email"]').fill(`beanmap-qa-unregistered-${randomUUID()}@local.test`);
    await page.locator('button[type="submit"]').click();
    await expect(page.getByRole("heading", { name: t.auth.resetEmailSentTitle, exact: true })).toBeVisible();
    await expect(page.getByText(t.auth.resetEmailSentDescription, { exact: true })).toBeVisible();
    await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  });

  test(`${locale} a generated recovery link changes the password, signs out, and cannot be reused`, async ({ page }) => {
    const email = `beanmap-qa-password-reset-${randomUUID()}@local.test`;
    const oldPassword = randomBytes(24).toString("hex");
    const newPassword = randomBytes(24).toString("hex");
    const id = await ensureUser(email, oldPassword);
    const next = `/${locale}/stats`;
    const callback = new URL("/api/auth/callback", qaBaseURL);
    callback.search = new URLSearchParams({ mode: "recovery", locale, next }).toString();
    try {
      // Admin generateLink returns a test token without sending a recovery email.
      const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo: callback.toString() } });
      expect(error).toBeNull();
      expect(data.properties?.hashed_token).toBeTruthy();
      callback.searchParams.set("token_hash", data.properties!.hashed_token);
      callback.searchParams.set("type", "recovery");
      await page.goto(callback.toString());
      await expect(page).toHaveURL(new RegExp(`/${locale}/reset-password\\?`));
      expect(new URL(page.url()).searchParams.get("next")).toBe(next);
      await page.locator('[name="password"]').fill(newPassword);
      await page.locator('[name="passwordConfirm"]').fill("mismatching-confirmation");
      await page.locator('button[type="submit"]').click();
      await expect(page.locator('[name="passwordConfirm"]')).toBeFocused();
      await expect(page.locator('[name="passwordConfirm"]')).toHaveAttribute("aria-invalid", "true");
      await page.locator('[name="passwordConfirm"]').fill(newPassword);
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/login\\?`));
      expect(new URL(page.url()).searchParams.get("passwordReset")).toBe("1");
      expect(new URL(page.url()).searchParams.get("next")).toBe(next);
      await expect(page.locator("main").getByRole("status")).toHaveText(t.auth.passwordResetComplete);
      expect((await page.context().cookies()).filter((cookie) => cookie.name.includes("auth-token"))).toHaveLength(0);
      await page.locator('[name="email"]').fill(email);
      await page.locator('[name="password"]').fill(oldPassword);
      await page.locator('button[type="submit"]').click();
      await expect(page.locator("main").getByRole("alert").filter({ hasText: t.auth.loginError })).toBeVisible();
      await page.locator('[name="password"]').fill(newPassword);
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(new RegExp(`${next}$`));
      await page.goto(`/${locale}/login?next=${encodeURIComponent(next)}`);
      await expect(page).toHaveURL(new RegExp(`${next}$`));
      const replayContext = await page.context().browser()!.newContext();
      try {
        const replay = await replayContext.newPage();
        await replay.goto(callback.toString());
        await expect(replay).toHaveURL(new RegExp(`/${locale}/forgot-password\\?`));
        expect(new URL(replay.url()).searchParams.get("recoveryError")).toBe("expired");
      } finally {
        await replayContext.close();
      }
    } finally {
      await admin.auth.admin.deleteUser(id);
    }
  });

  test(`${locale} a real recovery email completes the same-browser PKCE flow`, async ({ page, request }) => {
    const email = `beanmap-qa-pkce-reset-${randomUUID()}@local.test`;
    const oldPassword = randomBytes(24).toString("hex");
    const newPassword = randomBytes(24).toString("hex");
    const id = await ensureUser(email, oldPassword);
    const next = `/${locale}/beans/new?draft=1`;
    try {
      await page.goto(`/${locale}/forgot-password?draft=1`);
      await page.locator('[name="email"]').fill(email);
      await page.locator('button[type="submit"]').click();
      await expect(page.getByRole("heading", { name: t.auth.resetEmailSentTitle, exact: true })).toBeVisible();
      let messageId: string | undefined;
      await expect.poll(async () => {
        const response = await request.get(`${mailUrl}/api/v1/search`, { params: { query: `to:${email}` } });
        expect(response.ok()).toBe(true);
        const mailbox = await response.json() as { messages: Array<{ ID: string }> };
        messageId = mailbox.messages[0]?.ID;
        return messageId;
      }, { timeout: 15_000 }).toBeTruthy();
      const messageResponse = await request.get(`${mailUrl}/api/v1/message/${messageId}`);
      const message = await messageResponse.json() as { HTML: string; Text: string };
      const match = message.HTML.match(/href=["']([^"']*\/auth\/v1\/verify[^"']*)["']/i)
        ?? message.Text.match(/(https?:\/\/[^\s<>]*\/auth\/v1\/verify[^\s<>]*)/i);
      expect(match).toBeTruthy();
      const recoveryLink = new URL(match![1].replaceAll("&amp;", "&"));
      expect(isLocal(recoveryLink.toString())).toBe(true);
      let pkceCallbackSeen = false;
      page.on("request", (navigation) => {
        const url = new URL(navigation.url());
        if (url.pathname === "/api/auth/callback" && url.searchParams.get("mode") === "recovery" && url.searchParams.has("code")) pkceCallbackSeen = true;
      });
      await page.goto(recoveryLink.toString());
      await expect(page).toHaveURL(new RegExp(`/${locale}/reset-password\\?`));
      expect(pkceCallbackSeen).toBe(true);
      expect(new URL(page.url()).searchParams.get("next")).toBe(next);
      await page.locator('[name="password"]').fill(newPassword);
      await page.locator('[name="passwordConfirm"]').fill(newPassword);
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/login\\?`));
      await expect(page.locator("main").getByRole("status")).toHaveText(t.auth.passwordResetComplete);
      await page.locator('[name="email"]').fill(email);
      await page.locator('[name="password"]').fill(newPassword);
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/beans/new\\?draft=1$`));
    } finally {
      await admin.auth.admin.deleteUser(id);
    }
  });
}
