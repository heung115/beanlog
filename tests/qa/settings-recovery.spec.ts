import { randomBytes, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import ko from "../../src/i18n/ko.json" with { type: "json" };
import en from "../../src/i18n/en.json" with { type: "json" };
import { admin, ensureUser, qaApiURL, signIn } from "./helpers";

const account = { email: `beanmap-qa-settings-${randomUUID()}@local.test`, password: randomBytes(24).toString("hex") };
let accountId: string;
const savedName = "Saved settings name";

test.beforeAll(async () => {
  if (!qaApiURL || !["localhost", "127.0.0.1"].includes(new URL(qaApiURL).hostname)) {
    throw new Error("Settings recovery tests require the isolated local staging API");
  }
  accountId = await ensureUser(account.email, account.password);
});
test.afterAll(async () => {
  if (accountId) {
    const { error } = await admin.auth.admin.deleteUser(accountId);
    if (error) throw error;
  }
});

async function openSettings(page: Page, locale: "ko" | "en") {
  const { session } = await signIn(account.email, account.password);
  const headers = { Authorization: `Bearer ${session.access_token}` };
  const response = await page.request.put(`${qaApiURL}/api/profile`, { headers, data: { display_name: savedName, locale } });
  expect(response.ok()).toBe(true);
  await page.goto(`/${locale}/login`);
  await page.locator('[name="email"]').fill(account.email);
  await page.locator('[name="password"]').fill(account.password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
  await page.goto(`/${locale}/settings`);
  await expect(page.locator('[name="displayName"]')).toHaveValue(savedName);
  await expect(page.locator('[name="displayName"]')).toBeEnabled();
  return headers;
}

async function holdNextAction(page: Page, outcome: "abort" | "continue" = "abort") {
  let attempts = 0;
  let release: () => void = () => {};
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/*", async (route) => {
    if (route.request().method() !== "POST" || !route.request().headers()["next-action"]) return route.continue();
    attempts++;
    await waiting;
    if (outcome === "abort") await route.abort("failed");
    else await route.continue();
  });
  return { count: () => attempts, release };
}

for (const locale of ["ko", "en"] as const) {
  const t = locale === "ko" ? ko : en;
  test(`${locale} settings validate whitespace and keep save/export errors retryable`, async ({ page }) => {
    test.setTimeout(90_000);
    const headers = await openSettings(page, locale);
    const profile = page.locator("[data-settings-section]").filter({ has: page.getByRole("heading", { name: t.settings.profile, exact: true }) });
    const input = page.locator('[name="displayName"]');
    const save = profile.getByRole("button", { name: t.settings.saveProfile, exact: true });
    const failure = await holdNextAction(page);
    await input.fill("   ");
    await save.click();
    await expect(profile.getByRole("alert")).toHaveText(t.settings.nameRequired);
    await expect(input).toBeFocused();
    expect(failure.count()).toBe(0);

    await input.fill("Retried settings name");
    await save.click();
    await expect(save).toBeDisabled();
    await expect(page.getByRole("radio", { name: "English", exact: true })).toBeDisabled();
    await expect(input).toBeDisabled();
    failure.release();
    await expect(profile.getByRole("alert")).toHaveText(t.settings.saveError);
    await page.waitForTimeout(5500);
    await expect(profile.getByRole("alert")).toHaveText(t.settings.saveError);
    await expect(input).toHaveValue("Retried settings name");
    await page.unrouteAll();
    const retry = await holdNextAction(page, "continue");
    // A tab draft also has role=status. In English its text contains "saved",
    // so a substring match would mistake it for completed account persistence.
    const savedNotice = page.getByRole("status").getByText(t.settings.saved, { exact: true });
    try {
      await profile.getByRole("button", { name: t.common.retry, exact: true }).click();
      await expect.poll(retry.count).toBe(1);
      await expect(save).toBeDisabled();
      await expect(profile.getByTestId("record-draft-notice")).toContainText(t.draft.saved);
      await expect(savedNotice).toHaveCount(0);
      expect(await (await page.request.get(`${qaApiURL}/api/profile`, { headers })).json()).toMatchObject({ display_name: savedName });
    } finally {
      retry.release();
    }
    await expect(savedNotice).toBeVisible();
    await expect(save).toBeEnabled();
    await expect(profile.getByRole("alert")).toHaveCount(0);
    expect(await (await page.request.get(`${qaApiURL}/api/profile`, { headers })).json()).toMatchObject({ display_name: "Retried settings name" });
    await page.unrouteAll();
    await page.reload();
    await expect(input).toHaveValue("Retried settings name");
    await expect(profile.getByTestId("record-draft-notice")).toHaveCount(0);

    const exportSection = page.locator("[data-settings-section]").filter({ has: page.getByRole("heading", { name: t.settings.exportData, exact: true }) });
    const exportFailure = await holdNextAction(page);
    await exportSection.getByRole("button", { name: t.settings.export, exact: true }).click();
    await expect(exportSection.getByRole("button", { name: t.settings.exporting, exact: true })).toBeDisabled();
    exportFailure.release();
    await expect(exportSection.getByRole("alert")).toHaveText(t.settings.exportError);
    await page.unrouteAll();
    const download = page.waitForEvent("download");
    await exportSection.getByRole("button", { name: t.common.retry, exact: true }).click();
    expect((await download).suggestedFilename()).toMatch(/^beanmap-export-.*\.json$/);
    await expect(exportSection.getByRole("alert")).toHaveCount(0);
  });

  test(`${locale} language keyboard selection preserves an unsaved name through retry and reload`, async ({ page }) => {
    test.setTimeout(90_000);
    const headers = await openSettings(page, locale);
    const next = locale === "ko" ? "en" : "ko";
    const nextT = next === "ko" ? ko : en;
    const input = page.locator('[name="displayName"]');
    await input.fill("Unsaved language draft");
    const language = page.getByRole("radiogroup", { name: t.settings.language, exact: true });
    const active = language.getByRole("radio", { checked: true });
    await expect(active).toHaveAttribute("tabindex", "0");
    await expect(language.getByRole("radio", { checked: false })).toHaveAttribute("tabindex", "-1");
    const failure = await holdNextAction(page);
    await active.focus();
    await active.press("ArrowRight");
    await expect(page.getByRole("button", { name: t.settings.saveProfile, exact: true })).toBeDisabled();
    failure.release();
    const languageSection = page.locator("[data-settings-section]").filter({ has: language });
    await expect(languageSection.getByRole("alert")).toHaveText(t.settings.languageError);
    await expect(input).toHaveValue("Unsaved language draft");
    await page.unrouteAll();
    await languageSection.getByRole("button", { name: t.common.retry, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${next}/settings$`));
    await expect(input).toHaveValue("Unsaved language draft");
    await expect(page.getByRole("radio", { checked: true })).toHaveAttribute("tabindex", "0");
    await expect(page.getByRole("radio", { checked: true })).toBeFocused();
    expect(await (await page.request.get(`${qaApiURL}/api/profile`, { headers })).json()).toMatchObject({ display_name: savedName, locale: next });
    await page.reload();
    await expect(input).toHaveValue("Unsaved language draft");
    await page.getByRole("button", { name: nextT.settings.saveProfile, exact: true }).click();
    await expect(page.getByRole("status").getByText(nextT.settings.saved, { exact: true })).toBeVisible();
    expect(await (await page.request.get(`${qaApiURL}/api/profile`, { headers })).json()).toMatchObject({ display_name: "Unsaved language draft", locale: next });
  });

  test(`${locale} an empty name draft survives a server conflict and can be deliberately discarded`, async ({ page }) => {
    const headers = await openSettings(page, locale);
    const input = page.locator('[name="displayName"]');
    await input.fill("");
    await expect(page.getByTestId("record-draft-notice")).toContainText(t.draft.saved);
    const update = await page.request.put(`${qaApiURL}/api/profile`, { headers, data: { display_name: "Changed elsewhere", locale } });
    expect(update.ok()).toBe(true);
    await page.reload();
    await expect(page.getByTestId("record-draft-notice")).toContainText(t.draft.conflict);
    await expect(input).toBeDisabled();
    await expect(input).toHaveValue("Changed elsewhere");
    await page.getByRole("button", { name: t.draft.restore, exact: true }).click();
    await expect(input).toBeEnabled();
    await expect(input).toHaveValue("");
    expect(await (await page.request.get(`${qaApiURL}/api/profile`, { headers })).json()).toMatchObject({ display_name: "Changed elsewhere" });
    await page.getByRole("button", { name: t.draft.discard, exact: true }).click();
    await page.getByRole("button", { name: t.draft.discardYes, exact: true }).click();
    await expect(input).toHaveValue("Changed elsewhere");
    await expect(page.getByTestId("record-draft-notice")).toHaveCount(0);
  });
}
