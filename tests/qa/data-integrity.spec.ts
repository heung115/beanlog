import { randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { admin, ensureUser, qaApiURL, signIn, localFixtureRpc } from "./helpers";
import { loadExploreWindow } from "../../src/lib/coffee/explore-navigation";

test("data filters, refreshed pagination, varietal statistics and atomic edit versions preserve records", async ({ request, page }) => {
  test.skip(!qaApiURL || !["localhost", "127.0.0.1"].includes(new URL(qaApiURL).hostname), "This mutation regression only runs against isolated local staging.");
  test.setTimeout(180_000);
  const user = { email: `beanmap-qa-data-${randomUUID()}@local.test`, password: randomBytes(24).toString("hex") };
  const userId = await ensureUser(user.email, user.password);
  try {
    const { session, client } = await signIn(user.email, user.password);
    const headers = { Authorization: `Bearer ${session.access_token}` };
    const base = { roastery: "Fixture Roastery", bean_type: "single_origin", origin_country: "Ethiopia", process_method: "washed", roast_level: "medium", consumed_at: "2026-03-15T12:00:00.000Z", place_type: "home", overall_score: 7.5, note: "A disposable data-integrity fixture.", tags: [], blend_components: [] };
    async function add(name: string, extra: Record<string, unknown> = {}) {
      const response = await request.post(`${qaApiURL}/api/beans`, { headers, data: { ...base, name, ...extra } });
      expect(response.status(), await response.text()).toBe(201);
      return (await response.json()).id as string;
    }
    async function list(query: Record<string, string | number> = {}) {
      const response = await request.get(`${qaApiURL}/api/beans`, { headers, params: query });
      expect(response.status(), await response.text()).toBe(200);
      return response.json();
    }
    for (let i = 1; i <= 25; i += 1) await add(`Page ${String(i).padStart(2, "0")}`);
    await add("Percent 100%", { roastery: "QA", consumed_at: "2026-01-15", varietal: "Bourbon" });
    await add("Under_score", { roastery: "QA Roastery", consumed_at: "2026-04-15", varietal: "Bourbon, Typica" });
    expect((await list({ search: "%" })).beans.map((b: { name: string }) => b.name)).toEqual(["Percent 100%"]);
    expect((await list({ search: "_" })).beans.map((b: { name: string }) => b.name)).toEqual(["Under_score"]);
    expect((await list({ roastery: "QA" })).beans.map((b: { name: string }) => b.name)).toEqual(["Percent 100%"]);
    expect((await list({ score_min: 7.5, score_max: 7.5 })).count).toBe(27);

    const staleFirst = await list({ page: 0, limit: 20 });
    expect(staleFirst.beans).toHaveLength(20);
    await page.goto("/en/login");
    await page.locator("[name=email]").fill(user.email);
    await page.locator("[name=password]").fill(user.password);
    await page.locator("button[type=submit]").click();
    await expect(page).toHaveURL(/\/en\/explore$/);
    await expect(page.getByTestId("bean-card")).toHaveCount(20);
    const inserted = await add("Inserted after first page", { consumed_at: "2026-09-06" });
    const refreshed = await loadExploreWindow(1, async (page, limit) => list({ page, limit }));
    expect(refreshed.beans).toHaveLength(28);
    expect(new Set(refreshed.beans.map((b) => b.id)).size).toBe(28);
    expect(refreshed.beans.some((b) => b.id === inserted)).toBe(true);
    await page.getByRole("button", { name: "Load more", exact: true }).click();
    await expect(page.getByTestId("bean-card")).toHaveCount(28);
    const cardLinks = await page.getByTestId("bean-card").evaluateAll((cards) => cards.map((card) => card.querySelector("a")?.getAttribute("href")));
    expect(new Set(cardLinks).size).toBe(28);
    await expect(page.getByTestId("bean-card").filter({ hasText: "Inserted after first page" })).toHaveCount(1);

    await add("Korean Geisha", { varietal: "게이샤" });
    await add("English Geisha", { varietal: "Geisha" });
    // A legacy server-role record must also match the new canonical filter.
    const { tags: _tags, blend_components: _components, ...legacyBase } = base;
    void _tags; void _components;
    const legacy = await localFixtureRpc(client, "create_bean_record", { p_bean: { ...legacyBase, name: "Legacy Geisha", varietal: "게이샤" }, p_tags: [], p_components: [] });
    expect(legacy.error).toBeNull();
    expect((await list({ varietal: "Geisha" })).count).toBe(3);
    expect((await list({ varietal: "게이샤" })).count).toBe(3);
    await add("Yellow Bourbon", { varietal: "Yellow Bourbon" });
    expect((await list({ varietal: "Bourbon" })).count).toBe(2);
    await add("Ethiopia Brazil blend", { bean_type: "blend", origin_country: "", blend_components: [
      { origin_country: "Ethiopia", varietal: "Heirloom", percentage: 50 },
      { origin_country: "Brazil", varietal: "Geisha, 게이샤", percentage: 50 },
    ] });
    expect((await list({ origin_country: "Brazil", bean_type: "blend" })).count).toBe(1);
    expect((await list({ varietal: "Heirloom", bean_type: "blend" })).count).toBe(1);
    const options = await request.get(`${qaApiURL}/api/beans/filter-options`, { headers });
    const available = await options.json();
    expect(available.origins).toContain("Brazil");
    expect(available.varietals).toContain("Heirloom");
    expect(available.varietals).not.toContain("게이샤");
    const statsResponse = await request.get(`${qaApiURL}/api/stats`, { headers });
    expect(statsResponse.status(), await statsResponse.text()).toBe(200);
    const stats = await statsResponse.json();
    expect(stats.by_varietal).toEqual(expect.arrayContaining([{ key: "Bourbon", count: 2 }, { key: "Typica", count: 1 }, { key: "Geisha", count: 4 }, { key: "Heirloom", count: 1 }]));
    expect(stats.by_month).toEqual(expect.arrayContaining([{ key: "2026-02", count: 0 }, { key: "2026-08", count: 0 }]));

    const current = await (await request.get(`${qaApiURL}/api/beans/${inserted}`, { headers })).json();
    const record = current.bean ?? current;
    for (const version of [undefined, null]) {
      const withoutVersion = await request.put(`${qaApiURL}/api/beans/${inserted}`, {
        headers, data: { ...base, name: "Rejected edit without version", expected_updated_at: version },
      });
      expect(withoutVersion.status()).toBe(400);
    }
    const updates = await Promise.all(["Editor A", "Editor B"].map((note) => request.put(`${qaApiURL}/api/beans/${inserted}`, { headers, data: { ...base, name: "Concurrent edit", note, expected_updated_at: record.updated_at } })));
    expect(updates.map((r) => r.status()).sort()).toEqual([200, 409]);
    const conflict = updates.find((r) => r.status() === 409)!;
    expect(await conflict.json()).toEqual({ error: "record_conflict" });
    const after = await (await request.get(`${qaApiURL}/api/beans/${inserted}`, { headers })).json();
    expect((after.bean ?? after).updated_at).not.toBe(record.updated_at);

    await page.getByRole("searchbox").fill("%");
    await expect(page.getByTestId("bean-card")).toHaveCount(1);
    await expect(page.getByTestId("bean-card")).toContainText("Percent 100%");
  } finally {
    const result = await admin.auth.admin.deleteUser(userId);
    if (result.error) throw result.error;
  }
});

test("legacy whitespace and stale blend headers cannot create unselectable or misleading filters", async ({ request, page }) => {
  test.skip(!qaApiURL || !["localhost", "127.0.0.1"].includes(new URL(qaApiURL).hostname), "Legacy mutation fixtures require isolated local staging.");
  const user = { email: `beanmap-qa-legacy-filter-${randomUUID()}@local.test`, password: randomBytes(24).toString("hex") };
  const userId = await ensureUser(user.email, user.password);
  try {
    const { session, client } = await signIn(user.email, user.password);
    const headers = { Authorization: `Bearer ${session.access_token}` };
    const whitespace = "\t\n\v\f\r \u0085\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000";
    const base = { name: "Legacy whitespace record", roastery: `${whitespace}QA Unicode${whitespace}`, bean_type: "single_origin", origin_country: "Ethiopia", varietal: `${whitespace}Geisha${whitespace}, Bourbon`, process_method: "washed", roast_level: "medium", consumed_at: "2026-03-15T12:00:00.000Z", place_type: "home", overall_score: 7.5, note: "Legacy data preserved for filter regression" };
    const single = await localFixtureRpc(client, "create_bean_record", { p_bean: base, p_tags: [], p_components: [] }, { roastery: base.roastery });
    expect(single.error).toBeNull();
    const blend = await localFixtureRpc(client, "create_bean_record", { p_bean: { ...base, name: "Legacy stale blend header", roastery: "Blend roastery", bean_type: "blend", origin_country: "Kenya", varietal: "Bourbon, StaleHeaderVariety" }, p_tags: [], p_components: [{ origin_country: "Brazil", varietal: "Geisha", percentage: 100, sort_order: 0 }] });
    expect(blend.error).toBeNull();
    const bom = await localFixtureRpc(client, "create_bean_record", { p_bean: { ...base, name: "Legacy BOM record", roastery: "\ufeffQA BOM\ufeff", varietal: "\ufeffGeisha\ufeff" }, p_tags: [], p_components: [] }, { roastery: "\ufeffQA BOM\ufeff" });
    expect(bom.error).toBeNull();
    async function count(query: Record<string, string>) {
      const response = await request.get(`${qaApiURL}/api/beans`, { headers, params: query });
      expect(response.status()).toBe(200);
      return (await response.json()).count;
    }
    expect.soft(await count({ roastery: "QA Unicode" })).toBe(1);
    expect.soft(await count({ varietal: "Geisha" })).toBe(2);
    expect.soft(await count({ varietal: "Bourbon", bean_type: "blend" })).toBe(0);
    expect.soft(await count({ origin_country: "Kenya", bean_type: "blend" })).toBe(0);
    expect.soft(await count({ origin_country: "Brazil", bean_type: "blend" })).toBe(1);
    expect.soft(await count({ roastery: "\ufeffQA BOM\ufeff" })).toBe(1);
    expect.soft(await count({ varietal: "\ufeffGeisha\ufeff" })).toBe(1);
    const response = await request.get(`${qaApiURL}/api/beans/filter-options`, { headers });
    const options = await response.json();
    expect.soft(options.roasteries).toContain("QA Unicode");
    expect.soft(options.origins).toEqual(["Brazil", "Ethiopia"]);
    expect.soft(options.varietals).toEqual(["Bourbon", "Geisha", "\ufeffGeisha\ufeff"]);
    await page.goto("/en/login");
    await page.locator("[name=email]").fill(user.email);
    await page.locator("[name=password]").fill(user.password);
    await page.locator("button[type=submit]").click();
    await expect(page).toHaveURL(/\/en\/explore$/);
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    const varietals = page.getByRole("combobox", { name: "Varietal", exact: true });
    const varietalValues = await varietals.locator("option").evaluateAll((items) => items.map((item) => (item as HTMLOptionElement).value).filter(Boolean));
    expect.soft(varietalValues).toEqual(["Bourbon", "Geisha", "\ufeffGeisha\ufeff"]);
    const roasteries = page.getByRole("combobox", { name: "Roastery", exact: true });
    await roasteries.selectOption("QA Unicode");
    await expect(page.getByTestId("bean-card")).toHaveCount(1);
    await expect(page.getByTestId("bean-card")).toContainText("Legacy whitespace record");
    await roasteries.selectOption("\ufeffQA BOM\ufeff");
    await expect(page.getByTestId("bean-card")).toHaveCount(1);
    await expect(page.getByTestId("bean-card")).toContainText("Legacy BOM record");
  } finally {
    const result = await admin.auth.admin.deleteUser(userId);
    if (result.error) throw result.error;
  }
});
