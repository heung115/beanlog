import { randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { admin, ensureUser, qaApiURL, signIn } from "./helpers";
import en from "../../src/i18n/en.json" with { type: "json" };

test("blend lookups keep pending and empty results across edits and sibling completions", async ({ page, request }) => {
  test.skip(!qaApiURL, "The isolated fixture is created through the staging Go API");
  test.setTimeout(90_000);
  const user = {
    email: `beanmap-qa-blend-lookups-${randomUUID()}@local.test`,
    password: randomBytes(24).toString("hex"),
  };
  const userId = await ensureUser(user.email, user.password);
  try {
    const { session } = await signIn(user.email, user.password);
    const created = await request.post(`${qaApiURL}/api/beans`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      data: {
        name: "Lookup regression blend", roastery: "QA", bean_type: "blend",
        process_method: "washed", roast_level: "medium", place_type: "home",
        overall_score: 8, consumed_at: new Date().toISOString(), note: "",
        blend_components: [
          { origin_country: "Brazil", origin_region: "Minas Gerais", percentage: 60, sort_order: 0 },
          { origin_country: "Colombia", origin_region: "Huila", percentage: 40, sort_order: 1 },
        ],
      },
    });
    expect(created.status()).toBe(201);
    const bean = await created.json() as { id: string };

    await page.goto("/en/login");
    await page.locator('[name="email"]').fill(user.email);
    await page.locator('[name="password"]').fill(user.password);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/en\/explore$/);

    const calls = new Map<string, number>();
    let releaseFirstLookup!: () => void;
    const firstLookup = new Promise<void>((resolve) => { releaseFirstLookup = resolve; });
    let finishEdit!: () => void;
    const editedWhilePending = new Promise<void>((resolve) => { finishEdit = resolve; });
    let heldFirstLookup = false;
    await page.route(`**/beans/${bean.id}/edit`, async (route) => {
      const request = route.request();
      if (request.method() !== "POST" || !request.headers()["next-action"]) {
        await route.continue();
        return;
      }
      const args = request.postDataJSON() as unknown[];
      // Country catalog and bean-loading calls also belong to BeanForm.
      if (args.length === 0 || (args.length === 1 && args[0] === bean.id)) {
        await route.continue();
        return;
      }
      const key = JSON.stringify(args);
      calls.set(key, (calls.get(key) ?? 0) + 1);
      if (!heldFirstLookup) {
        heldFirstLookup = true;
        releaseFirstLookup();
        await editedWhilePending;
      }
      const response = await route.fetch();
      // Stagger siblings so the first cache update rerenders the composer
      // before the next response resolves, as real Server Actions do.
      await new Promise((resolve) => setTimeout(resolve, 100));
      await route.fulfill({ response });
    });

    await page.goto(`/en/beans/${bean.id}/edit`);
    await firstLookup;
    const percentage = page.getByLabel(en.beans.componentPercentage, { exact: true }).first();
    await percentage.fill("59");
    finishEdit();
    await page.waitForLoadState("networkidle");

    // Two countries each need regions, entities, and prior subregions. This
    // isolated user's subregion lookups return [], which is still cached.
    expect(calls.size).toBe(6);
    expect(Object.fromEntries(calls)).toEqual(Object.fromEntries(
      [...calls.keys()].map((key) => [key, 1])
    ));
    await expect(percentage).toHaveValue("59");

    await percentage.fill("60");
    await page.locator('[name="blend_varietal_1"]').fill("QA varietal");
    await page.waitForLoadState("networkidle");
    expect([...calls.values()]).toEqual(Array(6).fill(1));

    // A real unmount/remount gets its own cache, including per-user history.
    await page.getByRole("radio", { name: en.beans.singleOrigin, exact: true }).click();
    await expect(page.locator('[name="origin_country"]')).toBeVisible();
    await page.getByRole("radio", { name: en.beans.blend, exact: true }).click();
    await expect(page.locator('[name="blend_origin_0"]')).toBeVisible();
    await expect.poll(() => [...calls.values()].reduce((sum, count) => sum + count, 0)).toBe(12);
    await page.waitForLoadState("networkidle");
    expect(calls.size).toBe(6);
    expect(Object.fromEntries(calls)).toEqual(Object.fromEntries(
      [...calls.keys()].map((key) => [key, 2])
    ));
  } finally {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
  }
});
