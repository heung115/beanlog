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
      },
      maxRedirects: 0,
    }
  );
  expect(poisonedCallback.status()).toBeGreaterThanOrEqual(300);
  expect(poisonedCallback.status()).toBeLessThan(400);
  expect(poisonedCallback.headers().location).toBe(new URL("/login", qaBaseURL).toString());
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

    const { data: blendId, error: blendCreateError } = await client.rpc(
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

    const { data: singleId, error: singleCreateError } = await client.rpc(
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
      .select("email,created_at")
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
    expect(allowedProfileError).toBeNull();

    const oversizedTagsName = `[QA] oversized tags ${suffix}`;
    const { error: oversizedTagsError } = await client.rpc("create_bean_record", {
      p_bean: { ...beanPayload, name: oversizedTagsName },
      p_tags: Array.from({ length: 101 }, (_, index) => ({
        tag: `limit-${index}`,
        category: "other",
      })),
      p_components: [],
    });
    expect.soft(oversizedTagsError, "RPC tag limit").toMatchObject({ code: "22023" });

    const oversizedComponentsName = `[QA] oversized components ${suffix}`;
    const { error: oversizedComponentsError } = await client.rpc("create_bean_record", {
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

    const { error: oversizedUpdateError } = await client.rpc("update_bean_record", {
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
    expect.soft(protectedProfile?.display_name).toBe("Allowed QA Name");
    expect.soft(protectedProfile?.locale).toBe("en");
  } finally {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
  }
});

test("atomic RPC rolls back the parent when a child row is invalid", async () => {
  const { client } = await signIn(qaUser.email, qaUser.password);
  const name = "[QA:atomic] invalid child must roll back";
  const { error } = await client.rpc("create_bean_record", {
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

test("account deletion removes only the authenticated disposable user", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const disposable = {
    email: `beanmap-qa-delete-${suffix}@local.test`,
    password: randomBytes(32).toString("base64url"),
  };
  const disposableId = await ensureUser(disposable.email, disposable.password);
  let deleted = false;

  try {
    const { client } = await signIn(disposable.email, disposable.password);
    const { error: insertError } = await client.rpc("create_bean_record", {
      p_bean: {
        name: "[QA] disposable account bean",
        roastery: "QA Delete",
        bean_type: "single_origin",
        origin_country: "Kenya",
        process_method: "washed",
        roast_level: "light",
        consumed_at: "2026-07-30T12:00:00.000Z",
        place_type: "home",
        overall_score: 8,
        note: "must cascade with account deletion",
      },
      p_tags: [],
      p_components: [],
    });
    expect(insertError).toBeNull();

    const { error: deleteError } = await client.rpc("delete_current_account");
    expect(deleteError).toBeNull();
    deleted = true;

    const { data: removedUser, error: removedUserError } =
      await admin.auth.admin.getUserById(disposableId);
    expect(removedUserError).toBeTruthy();
    expect(removedUser.user).toBeNull();

    // The project intentionally does not grant service_role direct table
    // access. Reuse the deleted user's still-signed JWT: PostgREST can verify
    // it until expiry, while the cascaded RLS-visible rows must already be gone.
    const { data: removedProfiles, error: profileReadError } = await client
      .from("profiles")
      .select("id")
      .eq("id", disposableId);
    const { data: removedBeans, error: beanReadError } = await client
      .from("beans")
      .select("id")
      .eq("user_id", disposableId);
    expect(profileReadError).toBeNull();
    expect(beanReadError).toBeNull();
    expect(removedProfiles).toEqual([]);
    expect(removedBeans).toEqual([]);

    const { data: isolationUser, error: isolationError } =
      await admin.auth.admin.listUsers({ perPage: 1000 });
    expect(isolationError).toBeNull();
    expect(isolationUser.users.some((user) => user.email === qaOtherUser.email)).toBe(true);
  } finally {
    if (!deleted) {
      await admin.auth.admin.deleteUser(disposableId);
    }
  }
});
