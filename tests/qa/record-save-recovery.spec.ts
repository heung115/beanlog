import { randomBytes, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { admin, ensureUser, qaApiURL, qaBaseURL, signIn, stagingSupabaseUrl } from "./helpers";
import ko from "../../src/i18n/ko.json" with { type: "json" };
import en from "../../src/i18n/en.json" with { type: "json" };

type Account = { id: string; email: string; password: string; headers: { Authorization: string } };
type Locale = "ko" | "en";
const recentPrefix = "beanmap:recent-roasteries:v1:";
const draftPrefix = "beanmap:record-draft:v1:";

test.beforeAll(() => {
  for (const url of [qaBaseURL, qaApiURL, stagingSupabaseUrl]) {
    if (!url || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) {
      throw new Error("Record save regressions require isolated loopback services");
    }
  }
});

async function createAccount(): Promise<Account> {
  const email = `beanmap-qa-save-recovery-${randomUUID()}@local.test`;
  const password = randomBytes(24).toString("hex");
  const id = await ensureUser(email, password);
  try {
    const { session } = await signIn(email, password);
    return { id, email, password, headers: { Authorization: `Bearer ${session.access_token}` } };
  } catch (error) {
    await admin.auth.admin.deleteUser(id);
    throw error;
  }
}

async function removeAccount(account: Account) {
  const { error } = await admin.auth.admin.deleteUser(account.id);
  if (error) throw error;
}

async function login(page: Page, account: Account, locale: Locale = "ko") {
  await page.goto(`/${locale}/login`);
  await submitLogin(page, account);
  await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
}

async function submitLogin(page: Page, account: Account) {
  await page.locator('[name="email"]').fill(account.email);
  await page.locator('[name="password"]').fill(account.password);
  await page.locator('button[type="submit"]').click();
}

async function fillNewRecord(page: Page, name: string, roastery: string, locale: Locale = "ko") {
  const t = locale === "ko" ? ko : en;
  await page.locator('[name="name"]').fill(name);
  await page.locator('[name="roastery"]').fill(roastery);
  await page.getByRole("radio", { name: t.beans.home, exact: true }).click();
  await page.locator('[name="origin_country"]').fill("Ethiopia");
  await page.locator('[name="origin_country"]').press("Tab");
  await page.locator('[name="consumed_at"]').fill("2026-09-06");
  await page.locator('[name="note"]').fill(`Note for ${name}`);
  await expect(page.locator('[name="name"]')).toHaveValue(name);
  await expect(page.locator('[name="roastery"]')).toHaveValue(roastery);
}

async function seedRecord(request: APIRequestContext, account: Account, extra: Record<string, unknown> = {}) {
  const response = await request.post(`${qaApiURL}/api/beans`, { headers: account.headers, data: {
    name: "Two-tab recovery record", roastery: "Recovery roastery", bean_type: "single_origin",
    origin_country: "Ethiopia", varietal: "Geisha", process_method: "washed", roast_level: "medium",
    place_type: "home", overall_score: 8, consumed_at: "2026-09-06T00:00:00Z", note: "Original server note",
    ...extra,
  } });
  expect(response.status()).toBe(201);
  return (await response.json()).id as string;
}

async function readRecord(request: APIRequestContext, account: Account, id: string) {
  const response = await request.get(`${qaApiURL}/api/beans/${id}`, { headers: account.headers });
  expect(response.status()).toBe(200);
  return response.json();
}

for (const locale of ["ko", "en"] as const) {
  const t = locale === "ko" ? ko : en;
  test(`${locale} two stale editors preserve the first save and recover the second draft explicitly`, async ({ page, context, request }, info) => {
    test.setTimeout(120_000);
    const account = await createAccount();
    const second = await context.newPage();
    try {
      const id = await seedRecord(request, account);
      await login(page, account, locale);
      const editPath = `/${locale}/beans/${id}/edit`;
      await page.goto(editPath);
      await second.goto(editPath);
      await expect(page.locator('[name="note"]')).toHaveValue("Original server note");
      await expect(second.locator('[name="note"]')).toHaveValue("Original server note");
      await page.locator('[name="note"]').fill("Saved by first tab");
      await second.locator('[name="note"]').fill("Unfinished second-tab draft");
      await expect(second.getByTestId("record-draft-notice")).toContainText(t.draft.saved);

      await page.getByRole("button", { name: t.beans.save, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
      expect((await readRecord(request, account, id)).note).toBe("Saved by first tab");
      await second.getByRole("button", { name: t.beans.save, exact: true }).click();
      await expect(second.locator("#bean-form-errors")).toContainText(t.beans.saveConflict);
      await expect(second.locator("#bean-form-errors")).toBeFocused();
      await expect(second.locator('[name="note"]')).toHaveValue("Unfinished second-tab draft");
      expect((await readRecord(request, account, id)).note).toBe("Saved by first tab");
      const draftKey = `${draftPrefix}user:${account.id}:edit:${id}`;
      expect(await second.evaluate((key) => JSON.parse(sessionStorage.getItem(key)!).value.form.note, draftKey)).toBe("Unfinished second-tab draft");
      await second.screenshot({ path: info.outputPath("conflict-preserves-draft.png"), fullPage: true });

      await second.getByRole("button", { name: t.beans.loadLatestRecord, exact: true }).click();
      await expect(second.getByTestId("record-draft-notice")).toContainText(t.draft.conflict);
      await expect(second.locator('[name="note"]')).toHaveValue("Saved by first tab");
      await expect(second.locator('[name="note"]')).toBeDisabled();
      await second.getByRole("button", { name: t.draft.restore, exact: true }).click();
      await expect(second.locator('[name="note"]')).toHaveValue("Unfinished second-tab draft");
      expect((await readRecord(request, account, id)).note).toBe("Saved by first tab");
      await second.getByRole("button", { name: t.beans.save, exact: true }).click();
      await expect(second).toHaveURL(new RegExp(`/${locale}/explore$`));
      expect((await readRecord(request, account, id)).note).toBe("Unfinished second-tab draft");
      expect(await second.evaluate((key) => sessionStorage.getItem(key), draftKey)).toBeNull();
    } finally {
      await second.close();
      await removeAccount(account);
    }
  });

  test(`${locale} expired browser session keeps the draft and returns from sign-in to the authoring page`, async ({ page, context, request }, info) => {
    test.setTimeout(120_000);
    const account = await createAccount();
    try {
      await login(page, account, locale);
      await page.goto(`/${locale}/beans/new`);
      await fillNewRecord(page, "Survives expired session", "Session roastery", locale);
      await expect(page.getByTestId("record-draft-notice")).toContainText(t.draft.saved);
      // Remove this context's auth cookies while leaving the already-open form
      // and tab storage intact, as happens when the server can no longer use a session.
      await context.clearCookies();
      await page.getByRole("button", { name: t.beans.save, exact: true }).click();
      const signInLink = page.getByRole("link", { name: t.beans.signInToResume, exact: true });
      await expect(signInLink).toBeVisible();
      await expect(page.locator('[name="name"]')).toHaveValue("Survives expired session");
      const href = await signInLink.getAttribute("href");
      const loginUrl = new URL(href!, qaBaseURL);
      expect(new URL(loginUrl.searchParams.get("next")!, qaBaseURL).pathname).toBe(`/${locale}/beans/new`);
      await page.screenshot({ path: info.outputPath("session-save-recovery.png"), fullPage: true });
      await signInLink.click();
      await expect(page.locator('[name="email"]')).toBeVisible();
      await submitLogin(page, account);
      await expect(page).toHaveURL(new RegExp(`/${locale}/beans/new(?:\\?|$)`));
      await expect(page.locator('[name="name"]')).toHaveValue("Survives expired session");
      await expect(page.locator('[name="note"]')).toHaveValue("Note for Survives expired session");
      await expect(page.getByTestId("record-draft-notice")).toContainText(t.draft.recovered);
      await page.getByRole("button", { name: t.beans.save, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/explore$`));
      const listed = await (await request.get(`${qaApiURL}/api/beans`, { headers: account.headers })).json();
      expect(listed.beans).toHaveLength(1);
      expect(listed.beans[0].name).toBe("Survives expired session");
    } finally { await removeAccount(account); }
  });
}

test("two accounts in one browser keep separate recent roasteries", async ({ page, context }, info) => {
  test.setTimeout(120_000);
  const accounts: Account[] = [];
  try {
    accounts.push(await createAccount());
    accounts.push(await createAccount());
    for (const [index, account] of accounts.entries()) {
      await context.clearCookies();
      await login(page, account);
      await page.goto("/ko/beans/new");
      await page.locator('[name="roastery"]').focus();
      await expect(page.locator("[data-roastery-option]")).toHaveCount(0);
      await fillNewRecord(page, `Owner ${index} record`, `Private roastery ${index}`);
      await page.getByRole("button", { name: ko.beans.saveAndAddAnother, exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: ko.beans.saved })).toContainText(ko.beans.saved);
      await expect(page.locator('[name="name"]')).toHaveValue("");
      await expect(page.locator('[name="name"]')).toBeFocused();
      expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), recentPrefix + account.id)).toEqual([`Private roastery ${index}`]);
      await page.locator('[name="roastery"]').fill("");
      await page.locator('[name="roastery"]').focus();
      await expect(page.locator("[data-roastery-option]")).toHaveText([`Private roastery ${index}`]);
    }
    await context.clearCookies();
    await login(page, accounts[0]);
    await page.goto("/ko/beans/new");
    await page.locator('[name="roastery"]').fill("");
    await page.locator('[name="roastery"]').focus();
    await expect(page.locator("[data-roastery-option]")).toHaveText(["Private roastery 0"]);
    const recents = await page.evaluate((ids) => ids.map((id) => JSON.parse(localStorage.getItem(`beanmap:recent-roasteries:v1:${id}`)!)), accounts.map((account) => account.id));
    expect(recents).toEqual([["Private roastery 0"], ["Private roastery 1"]]);
    await page.screenshot({ path: info.outputPath("owner-scoped-recents.png"), fullPage: true });
  } finally { for (const account of accounts) await removeAccount(account); }
});

test("malformed and legacy recent storage cannot crash the mobile authoring form", async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 320, height: 900 });
  const account = await createAccount();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  try {
    await login(page, account);
    for (const [raw, expected] of [
      ['{"not":"an array"}', []],
      ['{"broken"', []],
      [JSON.stringify([null, 8, {}, ["nested"], "Safe recent", " Safe recent ", "x".repeat(201)]), ["Safe recent"]],
    ] as [string, string[]][]) {
      await page.evaluate(({ key, raw }) => {
        localStorage.setItem(key, raw);
        localStorage.setItem("recent_roasteries", JSON.stringify(["Another account's legacy history"]));
      }, { key: recentPrefix + account.id, raw });
      await page.goto("/ko/beans/new");
      await expect(page.locator('[name="name"]')).toBeEnabled();
      await page.locator('[name="roastery"]').focus();
      await expect(page.locator("[data-roastery-option]")).toHaveText(expected);
      expect(await page.evaluate(() => localStorage.getItem("recent_roasteries"))).toBeNull();
    }
    expect(pageErrors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: info.outputPath("malformed-storage-320.png"), fullPage: true });
  } finally { await removeAccount(account); }
});

test("Korean picked and free-text multi-varietals save canonical values for singles and blends", async ({ page, request }, info) => {
  test.setTimeout(150_000);
  const account = await createAccount();
  try {
    await login(page, account);
    await page.goto("/ko/beans/new");
    await fillNewRecord(page, "Picked Korean varietal", "Canonical roastery");
    await page.locator('[name="varietal"]').fill("게이샤");
    await page.getByRole("option").filter({ hasText: "게이샤" }).first().click();
    await page.getByRole("button", { name: ko.beans.saveAndAddAnother, exact: true }).click();
    await expect(page.locator('[name="name"]')).toHaveValue("");
    await fillNewRecord(page, "Typed Korean varietals", "Canonical roastery");
    await page.locator('[name="varietal"]').fill("게이샤，버본, GEISHA, Custom Local");
    await page.getByRole("button", { name: ko.beans.saveAndAddAnother, exact: true }).click();
    await expect(page.locator('[name="name"]')).toHaveValue("");
    await fillNewRecord(page, "Typed blend varietals", "Canonical roastery");
    await page.getByRole("radio", { name: ko.beans.blend, exact: true }).click();
    await page.locator('[name="blend_origin_0"]').fill("Ethiopia");
    await page.locator('[name="blend_percentage_0"]').fill("100");
    await page.locator('[name="blend_varietal_0"]').fill("티피카, 게이샤，GEISHA");
    await page.getByRole("button", { name: ko.beans.save, exact: true }).click();
    await expect(page).toHaveURL(/\/ko\/explore$/);
    const listed = await (await request.get(`${qaApiURL}/api/beans`, { headers: account.headers })).json();
    expect(listed.beans).toHaveLength(3);
    const byName = new Map(listed.beans.map((bean: { name: string; id: string }) => [bean.name, bean.id]));
    const picked = await readRecord(request, account, byName.get("Picked Korean varietal") as string);
    const typed = await readRecord(request, account, byName.get("Typed Korean varietals") as string);
    const blend = await readRecord(request, account, byName.get("Typed blend varietals") as string);
    expect(picked.varietal).toBe("Geisha");
    expect(typed.varietal).toBe("Geisha, Bourbon, Custom Local");
    expect(blend.varietal).toBeNull();
    expect(blend.blend_components[0].varietal).toBe("Typica, Geisha");
    await info.attach("canonical-storage.json", { body: Buffer.from(JSON.stringify({ picked: picked.varietal, typed: typed.varietal, blend: blend.blend_components[0].varietal }, null, 2)), contentType: "application/json" });
    await page.screenshot({ path: info.outputPath("canonical-records.png"), fullPage: true });
  } finally { await removeAccount(account); }
});

test("a temporary save failure retains text and offers a sign-in link back to the same form", async ({ page }, info) => {
  test.setTimeout(90_000);
  const account = await createAccount();
  try {
    await login(page, account, "en");
    await page.goto("/en/beans/new");
    await fillNewRecord(page, "Temporary failure draft", "Retry roastery", "en");
    await page.route("**/en/beans/new", async (route) => {
      const request = route.request();
      if (request.method() === "POST" && request.headers()["next-action"]) {
        try {
          const args = request.postDataJSON();
          if (Array.isArray(args) && args[0]?.name === "Temporary failure draft") {
            await route.fulfill({ status: 503, contentType: "text/plain", body: "Controlled local QA save failure" });
            return;
          }
        } catch { /* Unrelated requests continue. */ }
      }
      await route.continue();
    });
    await page.getByRole("button", { name: en.beans.save, exact: true }).click();
    await expect(page.locator("#bean-form-errors")).toContainText(en.beans.saveFailed);
    await expect(page.locator('[name="name"]')).toHaveValue("Temporary failure draft");
    const link = page.getByRole("link", { name: en.beans.signInToResume, exact: true });
    await expect(link).toBeVisible();
    const next = new URL((await link.getAttribute("href"))!, qaBaseURL).searchParams.get("next");
    expect(new URL(next!, qaBaseURL).pathname).toBe("/en/beans/new");
    await page.screenshot({ path: info.outputPath("temporary-save-failure.png"), fullPage: true });
    await page.unrouteAll({ behavior: "wait" });
    await link.click();
    await expect(page).toHaveURL(/\/en\/beans\/new\?/);
    await expect(page.locator('[name="name"]')).toHaveValue("Temporary failure draft");
    await page.getByRole("button", { name: en.beans.save, exact: true }).click();
    await expect(page).toHaveURL(/\/en\/explore$/);
  } finally {
    await page.unrouteAll({ behavior: "wait" });
    await removeAccount(account);
  }
});

test("slow hydration cannot erase text typed into the server-rendered authoring form", async ({ page, browser, request }, info) => {
  test.setTimeout(120_000);
  const account = await createAccount();
  let releaseScripts = () => {};
  let blockedScripts = 0;
  try {
    await login(page, account);
    const native = await browser.newContext({ baseURL: qaBaseURL, javaScriptEnabled: false, storageState: await page.context().storageState() });
    try {
      const nativePage = await native.newPage();
      await nativePage.goto("/ko/beans/new");
      await expect(nativePage.locator('[name="name"]')).toBeEditable();
      await expect(nativePage.locator('[name="roastery"]')).toBeEditable();
      await nativePage.locator('[name="name"]').fill("Native input remains usable");
      await expect(nativePage.locator('[name="name"]')).toHaveValue("Native input remains usable");
      await nativePage.locator('[name="roastery"]').fill("Native roastery");
      await nativePage.locator('[name="origin_country"]').fill("Ethiopia");
      await nativePage.locator('[name="note"]').fill("Native slider score persists without JavaScript");
      await nativePage.locator('input[type="range"]').press("End");
      for (let i = 0; i < 3; i++) await nativePage.locator('input[type="range"]').press("ArrowLeft");
      await expect(nativePage.locator('input[type="range"]')).toHaveValue("8.5");
      await nativePage.getByRole("button", { name: ko.beans.save, exact: true }).click();
      await expect(nativePage).toHaveURL(/\/ko\/explore$/);
      const response = await request.get(`${qaApiURL}/api/beans`, { headers: account.headers });
      expect(response.status()).toBe(200);
      const records = (await response.json()).beans;
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({ name: "Native input remains usable", overall_score: 8.5 });
      await writeFile(info.outputPath("native-score-saved.json"), JSON.stringify({ name: records[0].name, overall_score: records[0].overall_score }, null, 2));
    } finally { await native.close(); }

    const scriptsReady = new Promise<void>((resolve) => { releaseScripts = resolve; });
    await page.route("**/*", async (route) => {
      if (route.request().resourceType() === "script") {
        blockedScripts++;
        await scriptsReady;
      }
      await route.continue();
    });
    await page.goto("/ko/beans/new", { waitUntil: "commit" });
    const name = page.locator('[name="name"]');
    const roastery = page.locator('[name="roastery"]');
    const note = page.locator('[name="note"]');
    const altitude = page.locator('[name="altitude_m"]');
    const consumedAt = page.locator('[name="consumed_at"]');
    const roastLevel = page.locator('[name="roast_level"]');
    const score = page.locator('input[type="range"]');
    await expect(name).toBeVisible();
    await expect.poll(() => blockedScripts).toBeGreaterThan(0);
    const protectedBeforeHydration = !(await name.isEditable());
    if (!protectedBeforeHydration) {
      await name.pressSequentially("Early typed coffee", { delay: 10 });
      await roastery.pressSequentially("Early typed roastery", { delay: 10 });
      await note.pressSequentially("Early tasting note\nSecond line", { delay: 5 });
      await altitude.fill("1750");
      await consumedAt.fill("2026-08-20");
      await roastLevel.selectOption("dark");
      await score.focus();
      await score.press("End");
      for (let i = 0; i < 3; i++) await score.press("ArrowLeft");
    }
    const before = { name: await name.inputValue(), roastery: await roastery.inputValue(), note: await note.inputValue(), altitude: await altitude.inputValue(), consumedAt: await consumedAt.inputValue(), roastLevel: await roastLevel.inputValue(), score: await score.inputValue(), protectedBeforeHydration, blockedScripts };
    await page.screenshot({ path: info.outputPath("hydration-before.png"), fullPage: true });
    releaseScripts();
    await page.waitForLoadState("load");
    await expect(name).toBeEditable();
    // A state-changing user action proves hydration completed and exposes any
    // controlled-state overwrite of the native text entered before scripts ran.
    await page.getByRole("radio", { name: ko.beans.home, exact: true }).click();
    await expect(page.getByRole("radio", { name: ko.beans.home, exact: true })).toHaveAttribute("aria-checked", "true");
    const after = { name: await name.inputValue(), roastery: await roastery.inputValue(), note: await note.inputValue(), altitude: await altitude.inputValue(), consumedAt: await consumedAt.inputValue(), roastLevel: await roastLevel.inputValue(), score: await score.inputValue() };
    const valueEvidence = info.outputPath("hydration-values.json");
    await writeFile(valueEvidence, JSON.stringify({ before, after }, null, 2));
    await info.attach("hydration-values.json", { path: valueEvidence, contentType: "application/json" });
    await page.screenshot({ path: info.outputPath("hydration-after.png"), fullPage: true });
    if (!protectedBeforeHydration) {
      await expect(name).toHaveValue("Early typed coffee");
      await expect(roastery).toHaveValue("Early typed roastery");
      await expect(note).toHaveValue("Early tasting note\nSecond line");
      await expect(altitude).toHaveValue("1750");
      await expect(consumedAt).toHaveValue("2026-08-20");
      await expect(roastLevel).toHaveValue("dark");
      await expect(score).toHaveValue("8.5");
    }
  } finally {
    releaseScripts();
    await page.unrouteAll({ behavior: "wait" });
    await removeAccount(account);
  }
});

test("clearing a purchase source preserves the whole edit draft after reload", async ({ page, request }, info) => {
  test.setTimeout(90_000);
  const account = await createAccount();
  try {
    const id = await seedRecord(request, account, { purchase_source: "online" });
    expect((await readRecord(request, account, id)).purchase_source).toBe("online");
    await login(page, account);
    // Edit forms are loaded by client code, so there is no editable SSR source
    // select before hydration. Exercise the reachable clear-and-recover flow.
    await page.goto(`/ko/beans/${id}/edit`);
    const source = page.locator('[name="purchase_source"]');
    const note = page.locator('[name="note"]');
    await expect(source).toHaveValue("online");
    await source.selectOption("");
    await note.fill("Preserve this note after clearing the purchase source");
    await page.locator('[name="roast_level"]').selectOption("dark");
    await expect(note).toHaveValue("Preserve this note after clearing the purchase source");
    await expect(source).toHaveValue("");
    await expect(page.getByTestId("record-draft-notice")).toContainText(ko.draft.saved);
    const draftKey = `${draftPrefix}user:${account.id}:edit:${id}`;
    const draft = await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key)!), draftKey);
    await writeFile(info.outputPath("purchase-source-draft-before-reload.json"), JSON.stringify({ purchase_source: draft.value.form.purchase_source ?? null, note: draft.value.form.note }, null, 2));
    await page.reload();
    await page.screenshot({ path: info.outputPath("purchase-source-recovered.png"), fullPage: true });
    await expect(note).toHaveValue("Preserve this note after clearing the purchase source");
    await expect(source).toHaveValue("");
    await expect(page.getByTestId("record-draft-notice")).toContainText(ko.draft.recovered);
    expect((await readRecord(request, account, id)).note).toBe("Original server note");
  } finally {
    await removeAccount(account);
  }
});

test("guest draft import retains new typing during slow hydration and restores untouched fields", async ({ page, request }, info) => {
  test.setTimeout(120_000);
  const account = await createAccount();
  let releaseScripts = () => {};
  let blockedScripts = 0;
  try {
    await login(page, account);
    await page.evaluate((draft) => localStorage.setItem("beanmap:guest-bean-draft", JSON.stringify(draft)), {
      version: 1, savedAt: new Date().toISOString(), bean: {
        name: "Old guest name", roastery: "Guest draft roastery", bean_type: "single_origin",
        origin_country: "Ethiopia", process_method: "natural", roast_level: "light",
        consumed_at: "2026-08-18", place_type: "home", overall_score: 9,
        note: "Old guest note", tags: [], blend_components: [],
      },
    });
    const ready = new Promise<void>((resolve) => { releaseScripts = resolve; });
    await page.route("**/*", async (route) => {
      if (route.request().resourceType() === "script") {
        blockedScripts++;
        await ready;
      }
      await route.continue();
    });
    await page.goto("/ko/beans/new?draft=1", { waitUntil: "commit" });
    const name = page.locator('[name="name"]');
    const note = page.locator('[name="note"]');
    await expect(name).toBeEditable();
    await expect.poll(() => blockedScripts).toBeGreaterThan(0);
    await name.pressSequentially("New typed guest name", { delay: 10 });
    await note.pressSequentially("New typed guest note", { delay: 10 });
    await expect(name).toHaveValue("New typed guest name");
    await expect(note).toHaveValue("New typed guest note");
    await page.screenshot({ path: info.outputPath("guest-before-hydration.png"), fullPage: true });
    releaseScripts();
    await page.waitForLoadState("load");
    await expect(page.getByText(ko.guest.draftLoaded, { exact: true })).toBeVisible();
    await page.locator('[name="roast_level"]').selectOption("dark");
    const merged = {
      name: await name.inputValue(), note: await note.inputValue(),
      roastery: await page.locator('[name="roastery"]').inputValue(),
      origin_country: await page.locator('[name="origin_country"]').inputValue(),
      process_method: await page.locator('[name="process_method"]').inputValue(),
      consumed_at: await page.locator('[name="consumed_at"]').inputValue(),
      overall_score: await page.locator('input[type="range"]').inputValue(),
    };
    await writeFile(info.outputPath("guest-hydration-values.json"), JSON.stringify({ blockedScripts, merged }, null, 2));
    await page.screenshot({ path: info.outputPath("guest-after-hydration.png"), fullPage: true });
    expect(merged).toEqual({ name: "New typed guest name", note: "New typed guest note", roastery: "Guest draft roastery", origin_country: "에티오피아", process_method: "natural", consumed_at: "2026-08-18", overall_score: "9" });
    await page.getByRole("button", { name: ko.beans.save, exact: true }).click();
    await expect(page).toHaveURL(/\/ko\/explore$/);
    const response = await request.get(`${qaApiURL}/api/beans`, { headers: account.headers });
    expect(response.status()).toBe(200);
    const records = (await response.json()).beans;
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ ...merged, origin_country: "Ethiopia", overall_score: 9, roast_level: "dark", consumed_at: "2026-08-18T00:00:00Z" });
    expect(await page.evaluate(() => localStorage.getItem("beanmap:guest-bean-draft"))).toBeNull();
  } finally {
    releaseScripts();
    await page.unrouteAll({ behavior: "wait" });
    await removeAccount(account);
  }
});
