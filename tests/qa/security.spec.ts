import { expect, test } from "@playwright/test";
import { randomBytes } from "node:crypto";
import {
  admin,
  ensureUser,
  stagingAnonKey,
  stagingSupabaseUrl,
  qaApiURL,
  qaBaseURL,
  qaOtherUser,
  qaUser,
  signIn,
  localFixtureRpc,
} from "./helpers";

test("ensuring an existing QA user preserves its active refresh tokens", async () => {
  const disposable = {
    email: `beanmap-qa-session-${Date.now()}-${Math.random().toString(16).slice(2)}@local.test`,
    password: randomBytes(32).toString("base64url"),
  };
  const userId = await ensureUser(disposable.email, disposable.password);

  try {
    const { session } = await signIn(disposable.email, disposable.password);
    await ensureUser(disposable.email, disposable.password);

    const refreshProbe = await signIn(disposable.email, disposable.password);
    const { error } = await refreshProbe.client.auth.refreshSession({
      refresh_token: session.refresh_token,
    });

    expect(error).toBeNull();
  } finally {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
  }
});

test("security headers and unauthenticated route protection are enforced", async ({ request }) => {
  const response = await request.get("/ko/explore", { maxRedirects: 0 });
  expect(response.status()).toBeGreaterThanOrEqual(300);
  expect(response.status()).toBeLessThan(400);
  expect(response.headers()["location"]).toBe(
    "/ko/login?next=%2Fko%2Fexplore"
  );

  const login = await request.get("/ko/login");
  expect(login.headers()["x-frame-options"]).toBe("DENY");
  expect(login.headers()["x-content-type-options"]).toBe("nosniff");
  expect(login.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(login.headers()["permissions-policy"]).toContain("camera=()");
  expect(login.headers()["x-powered-by"]).toBeUndefined();

  const poisonedCallback = await request.get(
    "/api/auth/callback?next=%2F%2Fattacker.example%2Fphish",
    {
      headers: {
        Host: "attacker.example",
        "X-Forwarded-Host": "attacker.example",
        "X-Forwarded-Proto": "https",
        Cookie: "NEXT_LOCALE=en",
      },
      maxRedirects: 0,
    }
  );
  expect(poisonedCallback.status()).toBeGreaterThanOrEqual(300);
  expect(poisonedCallback.status()).toBeLessThan(400);
  expect(poisonedCallback.headers().location).toBe(new URL("/en/login?authError=failed", qaBaseURL).toString());
});

test("RLS and table privileges prevent cross-user access and direct writes", async () => {
  const { client: primary } = await signIn(qaUser.email, qaUser.password);
  const { client: other } = await signIn(qaOtherUser.email, qaOtherUser.password);
  const { data: otherBean, error: otherReadError } = await other
    .from("beans")
    .select("id,user_id")
    .eq("name", "[QA] 다른 사용자 비공개 원두")
    .single();
  expect(otherReadError).toBeNull();
  expect(otherBean).toBeTruthy();

  const { data: leaked, error: leakError } = await primary
    .from("beans")
    .select("id")
    .eq("id", otherBean!.id);
  expect(leakError).toBeNull();
  expect(leaked).toEqual([]);

  const { data: changed, error: updateError } = await primary
    .from("beans")
    .update({ note: "cross-user overwrite" })
    .eq("id", otherBean!.id)
    .select("id");
  expect(updateError).toMatchObject({ code: "42501" });
  expect(changed).toBeNull();

  const { data: deleted, error: deleteError } = await primary
    .from("beans")
    .delete()
    .eq("id", otherBean!.id)
    .select("id");
  expect(deleteError).toMatchObject({ code: "42501" });
  expect(deleted).toBeNull();

  const { error: insertError } = await primary.from("beans").insert({
    user_id: otherBean!.user_id,
    name: "cross-user insert",
    roastery: "attacker",
    bean_type: "single_origin",
    origin_country: "Kenya",
    process_method: "washed",
    roast_level: "light",
    consumed_at: new Date().toISOString(),
    place_type: "home",
    overall_score: 8,
    note: "must fail",
  });
  expect(insertError).toMatchObject({ code: "42501" });

  const { error: foreignTagError } = await primary.from("tasting_tags").insert({
    bean_id: otherBean!.id,
    user_id: (await primary.auth.getUser()).data.user!.id,
    tag: "foreign-parent",
    category: "other",
  });
  expect(foreignTagError).toMatchObject({ code: "42501" });

  const { error: foreignComponentError } = await primary.from("blend_components").insert({
    bean_id: otherBean!.id,
    user_id: (await primary.auth.getUser()).data.user!.id,
    origin_country: "Kenya",
    percentage: 100,
    sort_order: 0,
  });
  expect(foreignComponentError).toMatchObject({ code: "42501" });
});

test("authenticated PostgREST writes cannot bypass bean or profile invariants", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const disposable = {
    email: `beanmap-qa-direct-write-${suffix}@local.test`,
    password: randomBytes(32).toString("base64url"),
  };
  const userId = await ensureUser(disposable.email, disposable.password);

  try {
    const { client } = await signIn(disposable.email, disposable.password);
    const beanPayload = {
      name: "[QA] direct-write boundary",
      roastery: "QA Security",
      bean_type: "single_origin",
      origin_country: "Kenya",
      process_method: "washed",
      roast_level: "light",
      consumed_at: "2026-07-30T12:00:00.000Z",
      place_type: "home",
      overall_score: 8,
      note: "only verified RPCs may mutate beans",
    };

    const invalidBlendName = `[QA] invalid direct blend ${suffix}`;
    const { error: invalidBlendError } = await client.from("beans").insert({
      ...beanPayload,
      user_id: userId,
      name: invalidBlendName,
      bean_type: "blend",
      origin_country: null,
    });
    expect.soft(invalidBlendError, "direct invalid blend insert").toMatchObject({ code: "42501" });

    const { data: blendId, error: blendCreateError } = await localFixtureRpc(client,
      "create_bean_record",
      {
        p_bean: {
          ...beanPayload,
          name: `[QA] valid RPC blend ${suffix}`,
          bean_type: "blend",
          origin_country: null,
        },
        p_tags: [],
        p_components: [
          { origin_country: "Kenya", percentage: 60, sort_order: 0 },
          { origin_country: "Ethiopia", percentage: 40, sort_order: 1 },
        ],
      }
    );
    expect(blendCreateError).toBeNull();

    const { error: componentUpdateError } = await client
      .from("blend_components")
      .update({ percentage: 10 })
      .eq("bean_id", blendId);
    expect.soft(componentUpdateError, "direct component percentage update").toMatchObject({ code: "42501" });

    const { data: blendComponentsBeforeDelete } = await client
      .from("blend_components")
      .select("id")
      .eq("bean_id", blendId)
      .order("sort_order");
    const { error: componentDeleteError } = await client
      .from("blend_components")
      .delete()
      .eq("id", blendComponentsBeforeDelete?.[0]?.id);
    expect.soft(componentDeleteError, "direct component delete").toMatchObject({ code: "42501" });

    const { data: singleId, error: singleCreateError } = await localFixtureRpc(client,
      "create_bean_record",
      {
        p_bean: { ...beanPayload, name: `[QA] valid RPC single ${suffix}` },
        p_tags: [],
        p_components: [],
      }
    );
    expect(singleCreateError).toBeNull();

    const { error: componentInsertError } = await client
      .from("blend_components")
      .insert({
        bean_id: singleId,
        user_id: userId,
        origin_country: "Colombia",
        percentage: 100,
        sort_order: 0,
      });
    expect.soft(componentInsertError, "direct single-origin component insert").toMatchObject({ code: "42501" });

    const { error: tagInsertError } = await client.from("tasting_tags").insert({
      bean_id: singleId,
      user_id: userId,
      tag: "direct-write",
      category: "other",
    });
    expect.soft(tagInsertError, "direct tasting tag insert").toMatchObject({ code: "42501" });

    const { error: beanUpdateError } = await client
      .from("beans")
      .update({ bean_type: "blend", origin_country: null })
      .eq("id", singleId);
    expect.soft(beanUpdateError, "direct bean update").toMatchObject({ code: "42501" });

    const { data: originalProfile, error: profileReadError } = await client
      .from("profiles")
      .select("email,created_at,display_name,locale")
      .eq("id", userId)
      .single();
    expect(profileReadError).toBeNull();
    const { error: protectedProfileError } = await client
      .from("profiles")
      .update({ email: `forged-${suffix}@local.test`, created_at: "2000-01-01T00:00:00Z" })
      .eq("id", userId);
    expect.soft(protectedProfileError, "protected profile column update").toMatchObject({ code: "42501" });

    const { error: allowedProfileError } = await client
      .from("profiles")
      .update({ display_name: "Allowed QA Name", locale: "en" })
      .eq("id", userId);
    expect(allowedProfileError).toMatchObject({ code: "42501" });

    const oversizedTagsName = `[QA] oversized tags ${suffix}`;
    const { error: oversizedTagsError } = await localFixtureRpc(client, "create_bean_record", {
      p_bean: { ...beanPayload, name: oversizedTagsName },
      p_tags: Array.from({ length: 101 }, (_, index) => ({
        tag: `limit-${index}`,
        category: "other",
      })),
      p_components: [],
    });
    expect.soft(oversizedTagsError, "RPC tag limit").toMatchObject({ code: "22023" });

    const oversizedComponentsName = `[QA] oversized components ${suffix}`;
    const { error: oversizedComponentsError } = await localFixtureRpc(client, "create_bean_record", {
      p_bean: {
        ...beanPayload,
        name: oversizedComponentsName,
        bean_type: "blend",
        origin_country: null,
      },
      p_tags: [],
      p_components: Array.from({ length: 51 }, (_, index) => ({
        origin_country: `Origin ${index}`,
        percentage: index === 0 ? 100 : 0,
        sort_order: index,
      })),
    });
    expect.soft(oversizedComponentsError, "RPC component limit").toMatchObject({ code: "22023" });

    const { error: oversizedUpdateError } = await localFixtureRpc(client, "update_bean_record", {
      p_id: singleId,
      p_bean: { ...beanPayload, name: `[QA] oversized update ${suffix}` },
      p_tags: Array.from({ length: 101 }, (_, index) => ({
        tag: `update-limit-${index}`,
        category: "other",
      })),
      p_components: [],
    });
    expect.soft(oversizedUpdateError, "RPC update tag limit").toMatchObject({ code: "22023" });

    const { error: beanDeleteError } = await client.from("beans").delete().eq("id", singleId);
    expect.soft(beanDeleteError, "direct bean delete").toMatchObject({ code: "42501" });

    const { count: invalidBlendCount } = await client
      .from("beans")
      .select("id", { count: "exact", head: true })
      .eq("name", invalidBlendName);
    expect.soft(invalidBlendCount, "invalid blend was not persisted").toBe(0);

    const { count: oversizedPayloadCount } = await client
      .from("beans")
      .select("id", { count: "exact", head: true })
      .in("name", [oversizedTagsName, oversizedComponentsName]);
    expect.soft(oversizedPayloadCount, "oversized RPC payloads were not persisted").toBe(0);

    const { data: components } = await client
      .from("blend_components")
      .select("percentage")
      .eq("bean_id", blendId)
      .order("sort_order");
    expect.soft(components?.map((component) => Number(component.percentage))).toEqual([60, 40]);

    const { data: singleComponents } = await client
      .from("blend_components")
      .select("id")
      .eq("bean_id", singleId);
    expect.soft(singleComponents).toEqual([]);

    const { data: protectedProfile } = await client
      .from("profiles")
      .select("email,created_at,display_name,locale")
      .eq("id", userId)
      .single();
    expect.soft(protectedProfile?.email).toBe(originalProfile?.email);
    expect.soft(protectedProfile?.created_at).toBe(originalProfile?.created_at);
    expect.soft(protectedProfile?.display_name).toBe(originalProfile?.display_name);
    expect.soft(protectedProfile?.locale).toBe(originalProfile?.locale);
  } finally {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
  }
});

test("atomic RPC rolls back the parent when a child row is invalid", async () => {
  const { client } = await signIn(qaUser.email, qaUser.password);
  const name = "[QA:atomic] invalid child must roll back";
  const { error } = await localFixtureRpc(client, "create_bean_record", {
    p_bean: {
      name,
      roastery: "QA Atomic",
      bean_type: "single_origin",
      origin_country: "Kenya",
      process_method: "washed",
      roast_level: "light",
      consumed_at: "2026-07-30",
      place_type: "home",
      overall_score: 8,
      note: "atomic rollback test",
    },
    p_tags: [{ tag: "x".repeat(51), category: "other" }],
    p_components: [],
  });
  expect(error).toBeTruthy();
  const { count } = await client.from("beans").select("id", { count: "exact", head: true }).eq("name", name);
  expect(count).toBe(0);
});

test("anonymous clients cannot execute mutation RPCs", async ({ request }) => {
  const response = await request.post(`${stagingSupabaseUrl}/rest/v1/rpc/create_bean_record`, {
    headers: {
      apikey: stagingAnonKey,
      Authorization: `Bearer ${stagingAnonKey}`,
      "Content-Type": "application/json",
    },
    data: { p_bean: {}, p_tags: [], p_components: [] },
  });
  expect(response.status()).toBe(401);

  const deleteResponse = await request.post(
    `${stagingSupabaseUrl}/rest/v1/rpc/delete_current_account`,
    {
      headers: {
        apikey: stagingAnonKey,
        Authorization: `Bearer ${stagingAnonKey}`,
        "Content-Type": "application/json",
      },
      data: {},
    }
  );
  expect(deleteResponse.status()).toBe(401);

  const rateLimitResponse = await request.post(
    `${stagingSupabaseUrl}/rest/v1/rpc/check_rate_limit`,
    {
      headers: {
        apikey: stagingAnonKey,
        Authorization: `Bearer ${stagingAnonKey}`,
        "Content-Type": "application/json",
      },
      data: { p_action: "anonymous-probe", p_max_count: 1, p_window_minutes: 1 },
    }
  );
  expect(rateLimitResponse.status()).toBe(401);
});

test("Go API rejects forged JWTs and rolls back database child failures", async ({ request }) => {
  test.skip(!qaApiURL, "Go API security checks run against staging");

  const unsignedToken = [
    "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0",
    "eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjo0MTAyNDQ0ODAwfQ",
    "",
  ].join(".");
  const forged = await request.get(`${qaApiURL}/api/beans`, {
    headers: {
      Authorization: `Bearer ${unsignedToken}`,
    },
  });
  expect(forged.status()).toBe(401);

  const { client, session } = await signIn(qaUser.email, qaUser.password);
  const isolatedList = await request.get(`${qaApiURL}/api/beans?limit=100`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  expect(isolatedList.status()).toBe(200);
  const isolatedListBody = (await isolatedList.json()) as {
    beans: Array<{ name: string; user_id: string }>;
  };
  expect(isolatedListBody.beans.length).toBeGreaterThan(0);
  expect(
    isolatedListBody.beans.some(
      (bean) => bean.name === "[QA] 다른 사용자 비공개 원두"
    )
  ).toBe(false);

  const name = `[QA:go-atomic] ${Date.now()}`;
  const invalidChild = await request.post(`${qaApiURL}/api/beans`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    data: {
      name,
      roastery: "QA Go Atomic",
      bean_type: "single_origin",
      origin_country: "Kenya",
      process_method: "washed",
      roast_level: "light",
      consumed_at: "2026-07-30T12:00:00.000Z",
      place_type: "home",
      overall_score: 8,
      note: "parent must roll back",
      // Both rows pass request validation; the second insert fails the
      // database's unique(bean_id, tag) constraint inside the transaction.
      tags: [
        { tag: "duplicate-child", category: "other" },
        { tag: "duplicate-child", category: "other" },
      ],
    },
  });
  expect(invalidChild.status()).toBe(400);

  const { count, error } = await client
    .from("beans")
    .select("id", { count: "exact", head: true })
    .eq("name", name);
  expect(error).toBeNull();
  expect(count).toBe(0);

  const validName = `[QA:go-lifecycle] ${Date.now()}`;
  const validCreate = await request.post(`${qaApiURL}/api/beans`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    data: {
      name: validName,
      roastery: "QA Go Lifecycle",
      bean_type: "blend",
      process_method: "washed",
      roast_level: "medium",
      consumed_at: "2026-07-30T12:00:00.000Z",
      place_type: "home",
      overall_score: 8,
      note: "verified mutation RPC lifecycle",
      blend_components: [
        { origin_country: "Kenya", percentage: 60 },
        { origin_country: "Ethiopia", percentage: 40 },
      ],
    },
  });
  const validCreateBody = await validCreate.text();
  expect(validCreate.status(), validCreateBody).toBe(201);
  const validBeanId = (JSON.parse(validCreateBody) as { id: string }).id;

  const validDelete = await request.delete(`${qaApiURL}/api/beans/${validBeanId}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  expect(validDelete.status()).toBe(200);
  const deletedLookup = await request.get(`${qaApiURL}/api/beans/${validBeanId}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  expect(deletedLookup.status()).toBe(404);

  const profileBeforeResponse = await request.get(`${qaApiURL}/api/profile`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  expect(profileBeforeResponse.status()).toBe(200);
  const profileBefore = (await profileBeforeResponse.json()) as {
    display_name: string | null;
    locale: string;
    email: string;
    created_at: string;
  };
  const profileUpdate = await request.put(`${qaApiURL}/api/profile`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    data: { display_name: "beanmap QA Security", locale: "en" },
  });
  expect(profileUpdate.status()).toBe(200);
  const profileAfterResponse = await request.get(`${qaApiURL}/api/profile`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const profileAfter = (await profileAfterResponse.json()) as typeof profileBefore;
  expect(profileAfter.display_name).toBe("beanmap QA Security");
  expect(profileAfter.locale).toBe("en");
  expect(profileAfter.email).toBe(profileBefore.email);
  expect(profileAfter.created_at).toBe(profileBefore.created_at);

  const profileRestore = await request.put(`${qaApiURL}/api/profile`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    data: {
      display_name: profileBefore.display_name ?? "beanmap QA",
      locale: profileBefore.locale,
    },
  });
  expect(profileRestore.status()).toBe(200);

  const removedLegacyDelete = await request.delete(`${qaApiURL}/api/account`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  expect(removedLegacyDelete.status()).toBe(404);

  const oversizedBody = await request.post(`${qaApiURL}/api/beans`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    data: { padding: "x".repeat(65 * 1024) },
  });
  expect(oversizedBody.status()).toBe(400);
});

test("ordinary sessions cannot delete accounts without a verified deletion challenge", async ({ request }) => {
  test.skip(!qaApiURL, "Deletion boundary checks require the Go API");
  const disposable = {
    email: `beanmap-qa-delete-${Date.now()}-${randomBytes(6).toString("hex")}@local.test`,
    password: randomBytes(32).toString("base64url"),
  };
  const id = await ensureUser(disposable.email, disposable.password);
  try {
    const { client, session } = await signIn(disposable.email, disposable.password);
    const { error } = await client.rpc("delete_current_account");
    expect(error).toMatchObject({ code: "42501" });
    for (const body of [{}, { challenge: "a".repeat(64) }, { challenge: "a".repeat(64), code: "000000" }]) {
      const response = await request.post(`${qaApiURL}/api/account/delete`, {
        headers: { Authorization: `Bearer ${session.access_token}` }, data: body,
      });
      expect([400, 401, 403]).toContain(response.status());
    }
    const { data: alive, error: aliveError } = await admin.auth.admin.getUserById(id);
    expect(aliveError).toBeNull();
    expect(alive.user?.id).toBe(id);
  } finally {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw error;
  }
});

test("authenticated browser roles cannot execute internal mutation RPCs", async () => {
  const { client } = await signIn(qaUser.email, qaUser.password);
  for (const [name, payload] of [
    ["create_bean_record", { p_bean: {}, p_tags: [], p_components: [] }],
    ["update_bean_record", { p_id: "00000000-0000-0000-0000-000000000000", p_bean: {}, p_tags: [], p_components: [] }],
    ["delete_bean_record", { p_id: "00000000-0000-0000-0000-000000000000" }],
  ] as const) {
    const { error } = await client.rpc(name, payload);
    expect(error).toMatchObject({ code: "42501" });
  }
});

test("revoked sessions lose Auth, PostgREST and Go API access immediately", async ({ request }) => {
  test.skip(!qaApiURL || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(qaApiURL).hostname), "Session mutation regression requires isolated loopback staging");
  const user = {
    email: `beanmap-qa-revocation-${Date.now()}-${randomBytes(6).toString("hex")}@local.test`,
    password: randomBytes(32).toString("hex"),
  };
  const id = await ensureUser(user.email, user.password);
  try {
    const { session } = await signIn(user.email, user.password);
    const headers = { apikey: stagingAnonKey, Authorization: `Bearer ${session.access_token}` };
    const payload = { name: "[QA] session canary", roastery: "QA", bean_type: "single_origin", origin_country: "Kenya", process_method: "washed", roast_level: "light", consumed_at: "2026-09-08", place_type: "home", overall_score: 8, tags: [], blend_components: [] };
    const created = await request.post(`${qaApiURL}/api/beans`, { headers, data: payload });
    expect(created.status()).toBe(201);
    const beanId = (await created.json()).id;
    const ownBefore = await request.get(`${stagingSupabaseUrl}/rest/v1/beans?id=eq.${beanId}&select=id`, { headers });
    expect(await ownBefore.json()).toEqual([{ id: beanId }]);

    const logout = await request.post(`${stagingSupabaseUrl}/auth/v1/logout?scope=global`, { headers });
    expect(logout.status()).toBe(204);
    expect([401, 403]).toContain((await request.get(`${stagingSupabaseUrl}/auth/v1/user`, { headers })).status());
    for (const table of ["profiles", "beans", "tasting_tags", "blend_components"]) {
      const stale = await request.get(`${stagingSupabaseUrl}/rest/v1/${table}?select=id`, { headers });
      expect(stale.status()).toBe(200);
      expect(await stale.json()).toEqual([]);
    }
    const staleProfile = await request.patch(`${stagingSupabaseUrl}/rest/v1/profiles?id=eq.${id}`, {
      headers, data: { display_name: "Revoked profile write" },
    });
    expect([200, 204, 403]).toContain(staleProfile.status());
    expect((await request.get(`${qaApiURL}/api/beans`, { headers })).status()).toBe(401);
    expect((await request.post(`${qaApiURL}/api/beans`, { headers, data: payload })).status()).toBe(401);
    expect((await request.delete(`${qaApiURL}/api/beans/${beanId}`, { headers })).status()).toBe(401);

    const { client: fresh } = await signIn(user.email, user.password);
    const { data: retained, error: retainedError } = await fresh.from("beans").select("id");
    expect(retainedError).toBeNull();
    expect(retained).toEqual([{ id: beanId }]);
    const { data: profile } = await fresh.from("profiles").select("display_name").eq("id", id).single();
    expect(profile?.display_name).not.toBe("Revoked profile write");
  } finally {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw error;
  }
});

test("origin contacts cannot be fetched directly while curated entity names remain usable", async ({ request }) => {
  test.skip(!qaApiURL, "Origin API boundary checks require local staging");
  const { session } = await signIn(qaUser.email, qaUser.password);
  const headers = { apikey: stagingAnonKey, Authorization: `Bearer ${session.access_token}` };
  for (const bearer of [stagingAnonKey, session.access_token]) {
    const raw = await request.get(`${stagingSupabaseUrl}/rest/v1/origin_entities?select=*&limit=1`, {
      headers: { apikey: stagingAnonKey, Authorization: `Bearer ${bearer}` },
    });
    expect([401, 403]).toContain(raw.status());
    expect((await raw.json()).code).toBe("42501");
  }
  const countries = await request.get(`${qaApiURL}/api/origins/countries`, { headers });
  expect(countries.status()).toBe(200);
  const country = ((await countries.json()) as Array<{ id: number; name_en: string }>).find(value => value.name_en === "Ethiopia");
  expect(country).toBeTruthy();
  const regions = await request.get(`${qaApiURL}/api/origins/countries/${country!.id}/regions`, { headers });
  expect(regions.status()).toBe(200);
  const candidates = await regions.json() as Array<{ id: number }>;
  let entities: Array<Record<string, unknown>> = [];
  for (const region of candidates.slice(0, 10)) {
    const response = await request.get(`${qaApiURL}/api/origins/countries/${country!.id}/regions/${region.id}/entities`, { headers });
    expect(response.status()).toBe(200);
    entities = await response.json();
    if (entities.length) break;
  }
  expect(entities.length).toBeGreaterThan(0);
  for (const entity of entities) {
    expect(Object.keys(entity).sort()).toEqual(["entity_type", "id", "name", "name_ko"]);
    expect(entity.name).not.toMatch(/@|\b(?:phone|telephone|mobile|email|fax)\b|[0-9](?:[0-9\s().+\-]*[0-9]){6}/i);
  }
});
