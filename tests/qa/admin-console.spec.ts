import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer, request as httpRequest, type Server } from "node:http";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { deriveStagingRuntime } from "../../scripts/staging-runtime.mjs";
import { ADMIN_INGRESS_HEADER } from "../../src/lib/security/admin-boundary";
import {
  admin,
  ensureUser,
  qaApiURL,
  qaBaseURL,
  qaUser,
  signIn,
  stagingAnonKey,
  stagingSupabaseUrl,
} from "./helpers";

const root = process.cwd();
const gitCommonDir = path.resolve(root, execFileSync("git", ["rev-parse", "--git-common-dir"], {
  cwd: root,
  encoding: "utf8",
}).trim());
const runtime = deriveStagingRuntime({ root, gitCommonDir });
const supabaseUrl = new URL(stagingSupabaseUrl);
const isLocalStaging = ["localhost", "127.0.0.1", "[::1]"].includes(supabaseUrl.hostname)
  && Number(supabaseUrl.port) === runtime.supabaseApi;

// Deployment preparation is external to this spec: apply migration 00025 and
// mount the same generated secret file into web/API before running private QA.
// Web needs ADMIN_PRIVATE_ORIGIN and QA_ALLOW_INSECURE_LOOPBACK_AUTH=true.
// This process needs QA_ADMIN_PRIVATE_ORIGIN and QA_ADMIN_INGRESS_SECRET_FILE.
// The disposable loopback gateway injects the secret; it never enters browser
// headers, JavaScript, screenshots, or Playwright's recorded request traces.
function privateQaConfig(): { origin: URL; secret: string } | null {
  const configuredOrigin = process.env.QA_ADMIN_PRIVATE_ORIGIN;
  const secretFile = process.env.QA_ADMIN_INGRESS_SECRET_FILE;
  if (!configuredOrigin && !secretFile) return null;
  if (!configuredOrigin || !secretFile) {
    throw new Error("Private admin QA requires both QA_ADMIN_PRIVATE_ORIGIN and QA_ADMIN_INGRESS_SECRET_FILE.");
  }
  const origin = new URL(configuredOrigin);
  const upstream = new URL(qaBaseURL);
  if (!isLocalStaging || origin.protocol !== "http:"
    || !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
    || !["localhost", "127.0.0.1", "[::1]"].includes(upstream.hostname)
    || upstream.protocol !== "http:" || origin.origin === upstream.origin
    || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash
    || Number(origin.port) < 1024 || Number(origin.port) > 65535) {
    throw new Error("Private admin QA requires a distinct loopback HTTP origin with an explicit unprivileged port and local staging.");
  }
  const secret = readFileSync(secretFile, "utf8").trim();
  if (secret.length < 32 || secret.length > 512 || /\s/.test(secret)) {
    throw new Error("The generated private QA ingress secret must contain 32–512 non-whitespace characters.");
  }
  return { origin, secret };
}

const privateConfig = privateQaConfig();
const privateSetupReason = "Private QA requires local staging with migration 00025, matching mounted web/API ingress secrets, and QA_ADMIN_PRIVATE_ORIGIN plus QA_ADMIN_INGRESS_SECRET_FILE.";
let gateway: Server | undefined;

test.beforeAll(async () => {
  if (!privateConfig) return;
  gateway = createServer((incoming, outgoing) => {
    if (incoming.headers.host !== privateConfig.origin.host) {
      outgoing.writeHead(404, { "Cache-Control": "no-store" }).end();
      return;
    }
    const target = new URL(qaBaseURL);
    const headers = { ...incoming.headers };
    delete headers.forwarded;
    delete headers["x-forwarded-for"];
    headers.host = privateConfig.origin.host;
    headers["x-forwarded-host"] = privateConfig.origin.host;
    headers["x-forwarded-proto"] = privateConfig.origin.protocol.slice(0, -1);
    headers[ADMIN_INGRESS_HEADER] = privateConfig.secret;
    const upstream = httpRequest({
      hostname: target.hostname.replace(/^\[|\]$/g, ""),
      port: target.port,
      path: incoming.url,
      method: incoming.method,
      headers,
      timeout: 30_000,
    }, (response) => {
      outgoing.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(outgoing);
    });
    upstream.on("timeout", () => upstream.destroy());
    upstream.on("error", () => {
      if (!outgoing.headersSent) outgoing.writeHead(502);
      outgoing.end("Private QA upstream unavailable");
    });
    incoming.on("aborted", () => upstream.destroy());
    incoming.pipe(upstream);
  });
  await new Promise<void>((resolve, reject) => {
    gateway!.once("error", reject);
    gateway!.listen(Number(privateConfig.origin.port), privateConfig.origin.hostname.replace(/^\[|\]$/g, ""), resolve);
  });
});

test.afterAll(async () => {
  if (!gateway) return;
  const stopped = new Promise<void>((resolve, reject) => {
    gateway!.close((error) => error ? reject(error) : resolve());
  });
  gateway.closeAllConnections();
  await stopped;
});

function privateUrl(pathname: string): string {
  if (!privateConfig) throw new Error(privateSetupReason);
  return new URL(pathname, privateConfig.origin).toString();
}

function untrustedIngressHeaders(): Array<Record<string, string>> {
  return [{}, { [ADMIN_INGRESS_HEADER]: randomBytes(32).toString("hex") }];
}

type ApiOptions = { headers?: Record<string, string>; data?: unknown; params?: Record<string, string | number> };
function privateApiClient() {
  async function send(method: string, address: string, options: ApiOptions = {}) {
    if (!privateConfig || !qaApiURL) throw new Error(privateSetupReason);
    const url = new URL(address);
    const expected = new URL(qaApiURL);
    if (url.origin !== expected.origin || !url.pathname.startsWith("/api/admin/")
      || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
      throw new Error("Private QA credentials may only be sent to the configured loopback admin API.");
    }
    for (const [key, value] of Object.entries(options.params ?? {})) url.searchParams.set(key, String(value));
    // Node fetch keeps this server-only secret outside Playwright's trace.
    const response = await fetch(url, {
      method, redirect: "manual", signal: AbortSignal.timeout(30_000),
      headers: { ...options.headers, "Content-Type": "application/json", [ADMIN_INGRESS_HEADER]: privateConfig.secret },
      body: options.data === undefined ? undefined : JSON.stringify(options.data),
    });
    return { status: () => response.status, headers: () => Object.fromEntries(response.headers), json: () => response.json() };
  }
  return { get: (url: string, options?: ApiOptions) => send("GET", url, options), put: (url: string, options?: ApiOptions) => send("PUT", url, options) };
}

const rpcProbes = [
  ["beanmap_is_admin", {}],
  ["beanmap_admin_overview", {}],
  ["beanmap_admin_audit", {}],
  ["beanmap_admin_update_catalog", {
    p_kind: "country", p_id: 1, p_name_ko: "forged", p_expected_name_ko: null, p_reason: "must fail",
  }],
] as const;

async function expectPublicAdminRpcsUnavailable(client: Awaited<ReturnType<typeof signIn>>["client"]) {
  for (const [name, parameters] of rpcProbes) {
    const result = await client.rpc(name, parameters);
    expect(result.status, `${name} is absent from public PostgREST`).toBe(404);
    expect(result.error).toMatchObject({ code: "PGRST202" });
  }
  const privateRpc = await client.schema("beanmap_private").rpc("beanmap_is_admin");
  expect(privateRpc.status).toBe(406);
  expect(privateRpc.error).toMatchObject({ code: "PGRST106" });
  const privateTable = await client.schema("beanmap_private").from("admin_users").select("*");
  expect(privateTable.status).toBe(406);
  expect(privateTable.error).toMatchObject({ code: "PGRST106" });
}

function sql(statement: string): string {
  if (!isLocalStaging) throw new Error("Admin fixtures may only use the matching local staging database.");
  return execFileSync("docker", [
    "exec", "-i", `supabase_db_${runtime.supabaseProject}`,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atq",
  ], { input: statement, encoding: "utf8" }).trim();
}

function uuid(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error("Invalid generated QA user UUID");
  }
  return value;
}

function account() {
  return {
    email: `beanmap-qa-admin-${randomUUID()}@local.test`,
    password: randomBytes(32).toString("base64url"),
  };
}

async function login(page: Page, credentials: { email: string; password: string }, privateIngress = false) {
  await page.goto(privateIngress ? privateUrl("/ko/login") : "/ko/login");
  await page.locator('[name="email"]').fill(credentials.email);
  await page.locator('[name="password"]').fill(credentials.password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/ko\/explore$/);
  if (privateIngress) expect(new URL(page.url()).origin).toBe(privateConfig!.origin.origin);
}

async function withAdmin(
  run: (fixture: {
    credentials: ReturnType<typeof account>;
    userId: string;
    countryId: number;
    countryName: string;
    token: string;
    client: Awaited<ReturnType<typeof signIn>>["client"];
  }) => Promise<void>,
) {
  const credentials = account();
  const userId = uuid(await ensureUser(credentials.email, credentials.password));
  const fixtureKey = `qa-admin-${randomUUID()}`;
  const countryName = `QA Admin ${fixtureKey}`;
  let countryId: number | undefined;
  try {
    sql(`INSERT INTO beanmap_private.admin_users (user_id) VALUES ('${userId}');`);
    countryId = Number(sql(`INSERT INTO public.origin_countries (source_key, name_en, name_ko)
      VALUES ('${fixtureKey}', '${countryName}', NULL) RETURNING id;`));
    if (!Number.isSafeInteger(countryId) || countryId <= 0) throw new Error("Invalid QA country fixture ID");
    const { client, session } = await signIn(credentials.email, credentials.password);
    await run({ credentials, userId, countryId, countryName, token: session.access_token, client });
  } finally {
    try {
      // The audit and country cleanup is restricted to the newly generated fixture.
      if (countryId !== undefined && Number.isSafeInteger(countryId) && countryId > 0) {
        sql(`DELETE FROM beanmap_private.admin_catalog_audit WHERE actor_id = '${userId}';
          DELETE FROM public.origin_countries WHERE id = ${countryId} AND source_key = '${fixtureKey}';`);
      }
      sql(`DELETE FROM beanmap_private.admin_users WHERE user_id = '${userId}';`);
    } finally {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
    }
  }
}

test("public admin routes return 404 before authentication, including forged ingress headers", async ({ request }) => {
  for (const pathname of ["/admin", "/ko/admin", "/en/admin", "/api/admin/access"]) {
    for (const headers of untrustedIngressHeaders()) {
      const response = await request.get(pathname, { maxRedirects: 0, headers });
      expect(response.status()).toBe(404);
      expect(response.headers()["cache-control"]).toContain("no-store");
      expect(response.headers().location).toBeUndefined();
    }
  }
});

test("public access stays unavailable even for an authenticated administrator", async ({ page }) => {
  test.skip(!isLocalStaging, "Disposable administrator provisioning requires the matching local staging database.");
  await withAdmin(async ({ credentials, client }) => {
    await login(page, credentials);
    await page.goto("/ko/settings");
    await expect(page.locator('[name="displayName"]')).toBeEnabled();
    await expect(page.getByRole("link", { name: "관리자 페이지", exact: true })).toHaveCount(0);
    for (const locale of ["ko", "en"]) {
      expect((await page.goto(`/${locale}/admin`))?.status()).toBe(404);
      const forged = await page.request.get(`/${locale}/admin`, {
        maxRedirects: 0, headers: { [ADMIN_INGRESS_HEADER]: randomBytes(32).toString("hex") },
      });
      expect(forged.status()).toBe(404);
    }
    await expectPublicAdminRpcsUnavailable(client);
  });
});

test("private ingress redirects anonymous visitors and denies ordinary members", async ({ page, request }) => {
  test.skip(!privateConfig, privateSetupReason);
  for (const locale of ["ko", "en"]) {
    const response = await request.get(privateUrl(`/${locale}/admin`), { maxRedirects: 0 });
    expect(response.status()).toBeGreaterThanOrEqual(300);
    expect(response.status()).toBeLessThan(400);
    const location = new URL(response.headers().location, privateUrl("/"));
    expect(location.origin).toBe(privateConfig!.origin.origin);
    expect(location.pathname).toBe(`/${locale}/login`);
    expect(location.searchParams.get("next")).toBe(`/${locale}/admin`);
  }
  await login(page, qaUser, true);
  await page.goto(privateUrl("/ko/settings"));
  await expect(page.getByRole("link", { name: "관리자 페이지", exact: true })).toHaveCount(0);
  await page.goto(privateUrl("/ko/admin"));
  await expect(page.getByRole("heading", { level: 1, name: "관리자 권한이 필요합니다" })).toBeVisible();
  await expect(page.getByLabel("산지 검색")).toHaveCount(0);
});

test("ingress authentication and user-editable metadata cannot replace the admin allowlist", async ({ request: publicRequest }) => {
  test.skip(!privateConfig || !qaApiURL, privateSetupReason);
  const request = privateApiClient();
  const credentials = account();
  const userId = await ensureUser(credentials.email, credentials.password);
  try {
    const { client } = await signIn(credentials.email, credentials.password);
    const { error: metadataError } = await client.auth.updateUser({ data: {
      role: "admin", is_admin: true, app_metadata: { role: "admin", is_admin: true },
    } });
    expect(metadataError).toBeNull();
    const { client: spoofed, session } = await signIn(credentials.email, credentials.password);
    const headers = { Authorization: `Bearer ${session.access_token}` };
    await expectPublicAdminRpcsUnavailable(spoofed);
    const access = await request.get(`${qaApiURL}/api/admin/access`, { headers });
    expect(access.status()).toBe(200);
    expect(await access.json()).toEqual({ is_admin: false });

    for (const endpoint of ["access", "overview", "catalog?kind=country", "audit"]) {
      for (const ingress of untrustedIngressHeaders()) {
        expect((await publicRequest.get(`${qaApiURL}/api/admin/${endpoint}`, { headers: { ...headers, ...ingress } })).status()).toBe(404);
        expect((await publicRequest.get(`${qaApiURL}/api/admin/${endpoint}`, { headers: ingress })).status()).toBe(404);
      }
      if (endpoint !== "access") {
        expect((await request.get(`${qaApiURL}/api/admin/${endpoint}`, { headers })).status()).toBe(403);
      }
      expect((await request.get(`${qaApiURL}/api/admin/${endpoint}`)).status()).toBe(401);
    }
    const update = await request.put(`${qaApiURL}/api/admin/catalog/country/1`, {
      headers, data: { name_ko: "forged", expected_name_ko: null, reason: "must fail" },
    });
    expect(update.status()).toBe(403);

    const { error: allowlistWriteError } = await spoofed.schema("beanmap_private")
      .from("admin_users").insert({ user_id: userId });
    expect(allowlistWriteError).not.toBeNull();
    const { error: auditReadError } = await spoofed.schema("beanmap_private")
      .from("admin_catalog_audit").select("*");
    expect(auditReadError).not.toBeNull();

    for (const [name, parameters] of rpcProbes) {
      const anonymous = await publicRequest.post(`${stagingSupabaseUrl}/rest/v1/rpc/${name}`, {
        headers: { apikey: stagingAnonKey, Authorization: `Bearer ${stagingAnonKey}` },
        data: parameters,
      });
      expect(anonymous.status(), `${name} is absent for anonymous callers`).toBe(404);
      expect(await anonymous.json()).toMatchObject({ code: "PGRST202" });
    }
  } finally {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
  }
});

test("private admin API returns aggregate counts and makes audited, conflict-safe catalog edits", async ({ request: publicRequest }) => {
  test.skip(!privateConfig || !qaApiURL, privateSetupReason);
  const request = privateApiClient();
  await withAdmin(async ({ countryId, countryName, credentials, token, userId, client }) => {
    const headers = { Authorization: `Bearer ${token}` };
    for (const ingress of untrustedIngressHeaders()) {
      const outside = await publicRequest.get(`${qaApiURL}/api/admin/overview`, { headers: { ...headers, ...ingress } });
      expect(outside.status()).toBe(404);
      const outsideWrite = await publicRequest.put(`${qaApiURL}/api/admin/catalog/country/${countryId}`, {
        headers: { ...headers, ...ingress },
        data: { name_ko: "외부 수정 차단", expected_name_ko: null, reason: "QA 외부 요청 차단" },
      });
      expect(outsideWrite.status()).toBe(404);
    }
    const access = await request.get(`${qaApiURL}/api/admin/access`, { headers });
    expect(access.status()).toBe(200);
    expect(await access.json()).toEqual({ is_admin: true });
    await expectPublicAdminRpcsUnavailable(client);
    const overview = await request.get(`${qaApiURL}/api/admin/overview`, { headers });
    expect(overview.status()).toBe(200);
    expect(overview.headers()["cache-control"]).toContain("no-store");
    const counts = await overview.json();
    expect(Object.keys(counts).sort()).toEqual([
      "active_users_30d", "beans", "countries", "entities", "new_beans_30d", "new_users_30d", "regions", "users",
    ]);
    for (const count of Object.values(counts)) {
      expect(Number.isSafeInteger(count)).toBe(true);
      expect(count as number).toBeGreaterThanOrEqual(0);
    }
    expect(JSON.stringify(counts)).not.toContain(credentials.email);
    expect(counts.users).toBeGreaterThan(1);
    expect(counts.countries).toBe(Number(sql("SELECT count(*) FROM public.origin_countries;")));
    expect(counts.beans).toBe(Number(sql("SELECT count(*) FROM public.beans;")));
    const { data: visibleBeans, error: beansError } = await client.from("beans").select("id");
    expect(beansError).toBeNull();
    expect(visibleBeans).toEqual([]);
    const { data: visibleProfiles, error: profilesError } = await client.from("profiles").select("id");
    expect(profilesError).toBeNull();
    expect(visibleProfiles).toEqual([{ id: userId }]);

    for (const kind of ["country", "region", "entity"]) {
      const response = await request.get(`${qaApiURL}/api/admin/catalog`, { headers, params: { kind, offset: 0 } });
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toMatchObject({ limit: 25, offset: 0 });
      expect(data.items.length).toBeLessThanOrEqual(25);
      expect(data.total).toBeGreaterThanOrEqual(data.items.length);
      expect(data.items.every((item: { kind: string }) => item.kind === kind)).toBe(true);
    }
    const endpoint = `${qaApiURL}/api/admin/catalog/country/${countryId}`;
    const invalid = await request.put(endpoint, { headers, data: { name_ko: "검증", expected_name_ko: null, reason: "" } });
    expect(invalid.status()).toBe(400);
    const updated = await request.put(endpoint, { headers, data: {
      name_ko: "관리자 검증 국가", expected_name_ko: null, reason: "QA 한국어 표기 확인",
    } });
    expect(updated.status()).toBe(200);
    expect(await updated.json()).toEqual({ ok: true });
    const stale = await request.put(endpoint, { headers, data: {
      name_ko: "덮어쓰면 안 되는 값", expected_name_ko: null, reason: "QA 동시 수정 확인",
    } });
    expect(stale.status()).toBe(409);
    const catalog = await request.get(`${qaApiURL}/api/admin/catalog`, {
      headers, params: { kind: "country", q: countryName, offset: 0 },
    });
    expect(await catalog.json()).toMatchObject({
      total: 1, items: [{ id: countryId, name: countryName, name_ko: "관리자 검증 국가" }],
    });
    const audit = await request.get(`${qaApiURL}/api/admin/audit`, { headers });
    expect(audit.status()).toBe(200);
    const changes = (await audit.json()).items.filter((entry: { item_id: number; kind: string }) => entry.kind === "country" && entry.item_id === countryId);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      kind: "country", item_id: countryId, item_name: countryName, old_name_ko: null,
      new_name_ko: "관리자 검증 국가", reason: "QA 한국어 표기 확인",
    });
    expect(Number.isNaN(Date.parse(changes[0].created_at))).toBe(false);
    // Allowlisting never grants unrestricted writes to the underlying catalog.
    const rawWrite = await publicRequest.patch(`${stagingSupabaseUrl}/rest/v1/origin_countries?id=eq.${countryId}`, {
      headers: { ...headers, apikey: stagingAnonKey }, data: { name_ko: "감사 없이 수정" },
    });
    expect(rawWrite.status()).toBe(403);
    expect(sql(`SELECT name_ko FROM public.origin_countries WHERE id = ${countryId};`)).toBe("관리자 검증 국가");

    const regionId = Number(sql(`INSERT INTO public.origin_regions
      (source_key, country_id, name, display_name, is_canonical)
      VALUES ('qa-admin-region-${userId}', ${countryId}, 'QA Region', 'QA Region', true) RETURNING id;`));
    const entityId = Number(sql(`INSERT INTO public.origin_entities (source_key, country_id, region_id, name)
      VALUES ('qa-admin-entity-${userId}', ${countryId}, ${regionId}, 'QA Farm') RETURNING id;`));
    for (const [kind, id] of [["region", regionId], ["entity", entityId]] as const) {
      expect(Number.isSafeInteger(id) && id > 0).toBe(true);
      const route = `${qaApiURL}/api/admin/catalog/${kind}/${id}`;
      const tooLong = await request.put(route, { headers, data: {
        name_ko: "가".repeat(121), expected_name_ko: null, reason: "QA 글자 제한 확인",
      } });
      expect(tooLong.status()).toBe(400);
      const boundary = await request.put(route, { headers, data: {
        name_ko: "가".repeat(120), expected_name_ko: null, reason: "QA 한글 120자 저장",
      } });
      expect(boundary.status()).toBe(200);
      const clear = await request.put(route, { headers, data: {
        name_ko: "", expected_name_ko: "가".repeat(120), reason: "QA 한글 표기 지우기",
      } });
      expect(clear.status()).toBe(200);
      const table = kind === "region" ? "origin_regions" : "origin_entities";
      expect(sql(`SELECT name_ko IS NULL FROM public.${table} WHERE id = ${id};`)).toBe("t");
      if (kind === "region") {
        expect(sql(`SELECT display_name_ko IS NULL FROM public.origin_regions WHERE id = ${id};`)).toBe("t");
      }
    }

    // A token issued while allowlisted cannot retain access after revocation.
    sql(`DELETE FROM beanmap_private.admin_users WHERE user_id = '${userId}';`);
    const revoked = await request.get(`${qaApiURL}/api/admin/overview`, { headers });
    expect(revoked.status()).toBe(403);
    const revokedAccess = await request.get(`${qaApiURL}/api/admin/access`, { headers });
    expect(await revokedAccess.json()).toEqual({ is_admin: false });
    await expectPublicAdminRpcsUnavailable(client);
  });
});

for (const suffix of ["", " @mobile"]) {
  test(`admin can search, cancel, and save a Korean catalog label${suffix}`, async ({ page }) => {
    test.skip(!privateConfig, privateSetupReason);
    await withAdmin(async ({ credentials, countryId, countryName }) => {
      await login(page, credentials, true);
      await page.goto(privateUrl("/ko/settings"));
      await page.getByRole("link", { name: "관리자 페이지", exact: true }).click();
      await expect(page).toHaveURL(/\/ko\/admin$/);
      await expect(page.getByRole("heading", { level: 1, name: "서비스 관리" })).toBeVisible();
      expect((await page.content()).includes(privateConfig!.secret)).toBe(false);
      // Next may stream page metadata alongside the inherited layout metadata.
      // Every robots directive must keep the console out of search results.
      await expect.poll(async () => {
        const directives = await page.locator('meta[name="robots"]').evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("content") ?? ""));
        return directives.length > 0 && directives.every((value) => value.includes("noindex"));
      }).toBe(true);
      await page.getByLabel("분류", { exact: true }).selectOption("country");
      await page.getByLabel("산지 검색", { exact: true }).fill(countryName);
      await page.getByRole("button", { name: "검색", exact: true }).click();
      await expect(page.getByRole("button", { name: /수정$/ })).toHaveCount(1);
      await page.getByRole("button", { name: /수정$/ }).click();
      await page.getByLabel("한글 표기", { exact: true }).fill("취소할 표기");
      await page.getByLabel("변경 사유", { exact: true }).fill("저장하지 않는 변경");
      await page.getByRole("button", { name: "취소", exact: true }).click();
      expect(sql(`SELECT name_ko IS NULL FROM public.origin_countries WHERE id = ${countryId};`)).toBe("t");
      await page.getByRole("button", { name: /수정$/ }).click();
      await expect(page.getByLabel("한글 표기", { exact: true })).toHaveValue("");
      await page.getByLabel("한글 표기", { exact: true }).fill("관리자 화면 검증");
      await page.getByLabel("변경 사유", { exact: true }).fill("QA 화면에서 한국어 표기 검증");
      await page.getByRole("button", { name: "저장", exact: true }).click();
      await expect(page.getByText("저장했습니다.", { exact: true })).toBeVisible();
      expect(sql(`SELECT name_ko FROM public.origin_countries WHERE id = ${countryId};`)).toBe("관리자 화면 검증");
      await expect(page.getByText("QA 화면에서 한국어 표기 검증", { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await page.screenshot({ path: test.info().outputPath("admin-catalog.png"), fullPage: true });
      await page.goto(privateUrl("/en/admin"));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page).toHaveURL(/\/en\/admin$/);
    });
  });
}
