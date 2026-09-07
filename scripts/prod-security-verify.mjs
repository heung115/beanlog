/** Explicit production checks using disposable accounts; no traces or screenshots. */
import { execFile } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { chromium, expect } from "@playwright/test";

const site = "https://beanmap.site";
const api = "https://api.beanmap.site";
if (process.env.BEANMAP_PRODUCTION_VERIFY !== "authorized") {
  throw new Error("Set BEANMAP_PRODUCTION_VERIFY=authorized only after deployment is ready.");
}
process.umask(0o077);
const python = readFileSync(new URL("./prod-security-verify.bridge.py", import.meta.url), "utf8");
const shellQuote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const runId = randomUUID();
const users = ["a", "b"].map(suffix => ({
  email: `beanmap-security-verify-${runId}-${suffix}@local.test`,
  password: randomBytes(32).toString("hex"), id: null,
}));
const ko = JSON.parse(readFileSync(new URL("../src/i18n/ko.json", import.meta.url), "utf8"));
let anonKey;
let browser;
let stage = "launch";
let failures = 0;
const report = (name, status = "PASS") => console.log(JSON.stringify({ check: name, status }));

function bridge(operation, user) {
  return new Promise((resolve, reject) => {
    const child = execFile("ssh", ["oracle", "sudo python3 -c " + shellQuote(python)],
      { timeout: 45000, maxBuffer: 100000 }, (error, stdout) => {
        if (error) return reject(new Error(`Host bridge ${operation} failed`));
        try { resolve(JSON.parse(stdout)); } catch { reject(new Error("Invalid bridge response")); }
      });
    child.stdin.end(JSON.stringify({ operation, ...user }));
  });
}

async function login(page, user, password = user.password) {
  await page.goto(site + "/ko/login");
  await page.locator('[name="email"]').fill(user.email);
  await page.locator('[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/ko\/explore$/, { timeout: 30000 });
}

async function token(context) {
  const parts = (await context.cookies()).filter(c => /auth-token(?:\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const encoded = parts.map(c => c.value).join("").replace(/^base64-/, "");
  return JSON.parse(Buffer.from(encoded, "base64url").toString()).access_token;
}

async function call(path, bearer, method = "GET", body) {
  const response = await fetch(api + path, {
    method, headers: { apikey: anonKey, Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = null; }
  return { status: response.status, data };
}

async function recoveryPage(user, context) {
  const { tokenHash } = await bridge("recovery", user);
  const callback = new URL("/api/auth/callback", site);
  callback.search = new URLSearchParams({ token_hash: tokenHash, type: "recovery", locale: "ko" }).toString();
  const page = await context.newPage();
  await page.goto(callback.toString());
  await expect(page).toHaveURL(/\/ko\/reset-password/, { timeout: 30000 });
  const cookies = await context.cookies();
  expect(cookies.some(c => c.name === "beanmap-recovery-proof" && c.httpOnly && c.secure)).toBe(true);
  return { page, callback: callback.toString(), cookies };
}

function replayOptions(request) {
  return { data: request.postDataBuffer(), headers: {
    "next-action": request.headers()["next-action"],
    "content-type": request.headers()["content-type"], origin: site,
  } };
}

try {
  browser = await chromium.launch({ headless: true });
  for (const user of users) {
    stage = "create disposable account";
    const created = await bridge("create", user);
    user.id = created.id;
    anonKey = created.anonKey;
  }
  const ordinaryContext = await browser.newContext();
  const ordinary = await ordinaryContext.newPage();
  stage = "ordinary session recovery-page rejection";
  await login(ordinary, users[0]);
  const originalToken = await token(ordinaryContext);
  await ordinary.goto(site + "/ko/reset-password");
  await expect(ordinary).toHaveURL(/\/ko\/forgot-password\?recoveryError=expired/);
  report(stage);

  stage = "public Auth fresh-bearer PUT/PATCH rejection";
  for (const method of ["PUT", "PATCH"]) {
    for (const path of ["/auth/v1/user", "/auth/v1//user", "/auth/v1/%75ser", "/auth/v1/user/"]) {
      expect((await call(path, originalToken, method, { password: randomBytes(32).toString("hex") })).status).toBe(405);
    }
  }
  report(stage);

  stage = "authorized recovery password change";
  const recoveryContext = await browser.newContext();
  const recovered = await recoveryPage(users[0], recoveryContext);
  const newPassword = randomBytes(32).toString("hex");
  const actionPending = recovered.page.waitForRequest(r => r.method() === "POST" && Boolean(r.headers()["next-action"]));
  await recovered.page.locator('[name="password"]').fill(newPassword);
  await recovered.page.locator('[name="passwordConfirm"]').fill(newPassword);
  await recovered.page.locator('button[type="submit"]').click();
  const action = await actionPending;
  await expect(recovered.page).toHaveURL(/\/ko\/login\?passwordReset=1/, { timeout: 30000 });
  expect((await recoveryContext.cookies()).filter(c => c.name.includes("auth-token"))).toHaveLength(0);
  report(stage);

  stage = "old password rejected and new password accepted";
  await recovered.page.locator('[name="email"]').fill(users[0].email);
  await recovered.page.locator('[name="password"]').fill(users[0].password);
  await recovered.page.locator('button[type="submit"]').click();
  await expect(recovered.page.locator("main").getByRole("alert").filter({ hasText: ko.auth.loginError })).toBeVisible();
  await recovered.page.locator('[name="password"]').fill(newPassword);
  await recovered.page.locator('button[type="submit"]').click();
  await expect(recovered.page).toHaveURL(/\/ko\/explore$/, { timeout: 30000 });
  users[0].password = newPassword;
  report(stage);

  stage = "ordinary authenticated session server-action rejection";
  const ordinaryResult = await recoveryContext.request.post(action.url(), replayOptions(action));
  expect((await ordinaryResult.text()).includes('"error":"expired"')).toBe(true);
  report(stage);

  stage = "consumed proof and original email-token replay rejection";
  const replayContext = await browser.newContext();
  await replayContext.addCookies(recovered.cookies);
  const proofReplay = await replayContext.request.post(action.url(), replayOptions(action));
  expect((await proofReplay.text()).includes('"error":"expired"')).toBe(true);
  await replayContext.clearCookies();
  const replayPage = await replayContext.newPage();
  await replayPage.goto(recovered.callback);
  await expect(replayPage).toHaveURL(/\/ko\/forgot-password\?recoveryError=expired/);
  report(stage);

  stage = "rejected same-password update consumes proof";
  const rejectedContext = await browser.newContext();
  const rejected = await recoveryPage(users[0], rejectedContext);
  const failedPending = rejected.page.waitForRequest(r => r.method() === "POST" && Boolean(r.headers()["next-action"]));
  await rejected.page.locator('[name="password"]').fill(newPassword);
  await rejected.page.locator('[name="passwordConfirm"]').fill(newPassword);
  await rejected.page.locator('button[type="submit"]').click();
  const failedAction = await failedPending;
  await expect(rejected.page.locator("#password-reset-error")).toHaveText(ko.auth.passwordMustDiffer);
  await rejectedContext.addCookies(rejected.cookies);
  const failedReplay = await rejectedContext.request.post(failedAction.url(), replayOptions(failedAction));
  expect((await failedReplay.text()).includes('"error":"expired"')).toBe(true);
  report(stage);

  stage = "RPC CRUD and cross-user isolation";
  const tokenA = await token(recoveryContext);
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await login(other, users[1]);
  const tokenB = await token(otherContext);
  const bean = { name: "Disposable security verification", roastery: "Verification",
    bean_type: "single_origin", origin_country: "Kenya", process_method: "washed",
    roast_level: "light", consumed_at: "2026-09-07", place_type: "home", overall_score: 8, note: "Disposable" };
  const create = await call("/rest/v1/rpc/create_bean_record", tokenA, "POST", { p_bean: bean, p_tags: [], p_components: [] });
  expect(create.status).toBe(200);
  expect(typeof create.data).toBe("string");
  const beanId = create.data;
  const own = await call(`/rest/v1/beans?id=eq.${beanId}&select=id,name,updated_at`, tokenA);
  expect(own.data).toHaveLength(1);
  const cross = await call(`/rest/v1/beans?id=eq.${beanId}&select=id`, tokenB);
  expect(cross.status).toBe(200);
  expect(cross.data).toEqual([]);
  const badUpdate = await call("/rest/v1/rpc/update_bean_record", tokenB, "POST", { p_id: beanId, p_bean: bean, p_tags: [], p_components: [] });
  expect(badUpdate.status).toBeGreaterThanOrEqual(400);
  const update = await call("/rest/v1/rpc/update_bean_record", tokenA, "POST", {
    p_id: beanId, p_bean: { ...bean, note: "Updated disposable", expected_updated_at: own.data[0].updated_at }, p_tags: [], p_components: [],
  });
  expect(update.status).toBe(200);
  const updated = await call(`/rest/v1/beans?id=eq.${beanId}&select=note`, tokenA);
  expect(updated.data[0].note).toBe("Updated disposable");
  const direct = await call(`/rest/v1/beans?id=eq.${beanId}`, tokenA, "PATCH", { note: "Direct write must fail" });
  expect(direct.data?.code).toBe("42501");
  const deleted = await call("/rest/v1/rpc/delete_bean_record", tokenA, "POST", { p_id: beanId });
  expect(deleted.status).toBe(200);
  expect(deleted.data).toBe(true);
  expect((await call(`/rest/v1/beans?id=eq.${beanId}&select=id`, tokenA)).data).toEqual([]);
  report(stage);

  stage = "allowed profile PATCH and internal function ACL";
  const profile = await call(`/rest/v1/profiles?id=eq.${users[0].id}`, tokenA, "PATCH", { display_name: "Disposable verified profile", locale: "ko" });
  expect(profile.status).toBe(204);
  const profileRead = await call(`/rest/v1/profiles?id=eq.${users[0].id}&select=display_name`, tokenA);
  expect(profileRead.data[0].display_name).toBe("Disposable verified profile");
  const restricted = await call("/rest/v1/rpc/check_rate_limit", tokenA, "POST", { p_action: "verify", p_max_count: 1, p_window_minutes: 60 });
  expect(restricted.data?.code).toBe("42501");
  report(stage);

  stage = "guest expired draft removal and image header validation";
  const guest = await (await browser.newContext()).newPage();
  await guest.goto(site + "/ko/try");
  const draftKey = "beanmap:guest-bean-draft";
  await guest.evaluate(({ key, bean }) => localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date(0).toISOString(), bean })),
    { key: draftKey, bean: { ...bean, tags: [], blend_components: [] } });
  await guest.reload();
  await expect(guest.locator('[name="name"]')).toHaveValue("");
  expect(await guest.evaluate(key => localStorage.getItem(key), draftKey)).toBeNull();
  await guest.evaluate(({ key, bean }) => localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), bean })),
    { key: draftKey, bean: { ...bean, tags: [], blend_components: [] } });
  await guest.reload();
  await expect(guest.getByRole("article", { name: ko.guest.savedTitle })).toContainText(bean.name);
  await guest.getByRole("button", { name: ko.draft.discard, exact: true }).click();
  expect(await guest.evaluate(key => localStorage.getItem(key), draftKey)).toBeNull();
  await guest.locator('[name="name"]').fill("Guest input survives rejected image");
  const file = guest.locator('input[type="file"]');
  await file.setInputFiles({ name: "invalid.png", mimeType: "image/png", buffer: Buffer.from("not an image") });
  await expect(guest.getByRole("status").filter({ hasText: ko.beans.labelImport.errors.invalid_image })).toBeVisible();
  const giant = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  giant.writeUInt32BE(6000, 16);
  giant.writeUInt32BE(6000, 20);
  await file.setInputFiles({ name: "giant.png", mimeType: "image/png", buffer: giant });
  await expect(guest.getByRole("status").filter({ hasText: ko.beans.labelImport.errors.image_too_large })).toBeVisible();
  await expect(guest.locator('[name="name"]')).toHaveValue("Guest input survives rejected image");
  report(stage);
} catch {
  // Playwright errors can embed callback URLs, password fields or session material.
  // Report the named assertion stage only; investigate with a separately scoped run.
  report(stage, "FAIL");
  failures++;
} finally {
  if (browser) await browser.close();
  for (const user of users) {
    if (!user.id) continue;
    try {
      const result = await bridge("delete", user);
      expect(result.deleted).toBe(true);
      report("disposable account cleanup");
    } catch {
      console.log(JSON.stringify({ check: "disposable account cleanup", status: "FAIL", runId }));
      failures++;
    }
  }
}
process.exitCode = failures ? 1 : 0;
