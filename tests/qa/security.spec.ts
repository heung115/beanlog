import { expect, test } from "@playwright/test";
import { resolveTrustedAppRedirect } from "../../src/lib/security/redirect";
import {
  admin,
  ensureUser,
  localAnonKey,
  localSupabaseUrl,
  qaApiURL,
  qaOtherUser,
  qaUser,
  signIn,
} from "./helpers";

test("OAuth redirects stay on the configured application origin", () => {
  const appUrl = "https://beanlog.example/application-path";
  for (const maliciousNext of [
    "https://attacker.example/phish",
    "//attacker.example/phish",
    "/\\attacker.example/phish",
    "\\attacker.example/phish",
    "javascript:alert(1)",
  ]) {
    const destination = resolveTrustedAppRedirect(maliciousNext, appUrl);
    expect(destination.origin).toBe("https://beanlog.example");
    expect(destination.pathname).toBe("/explore");
  }

  const valid = resolveTrustedAppRedirect("/ko/explore?sort=recent", appUrl);
  expect(valid.href).toBe("https://beanlog.example/ko/explore?sort=recent");
});

test("security headers and unauthenticated route protection are enforced", async ({ request }) => {
  const response = await request.get("/ko/explore", { maxRedirects: 0 });
  expect(response.status()).toBeGreaterThanOrEqual(300);
  expect(response.status()).toBeLessThan(400);
  expect(response.headers()["location"]).toContain("/login");

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
  expect(poisonedCallback.headers().location).toBe("http://localhost:3100/login");
});

test("RLS prevents cross-user reads, inserts, updates, and deletes", async () => {
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
  expect(updateError).toBeNull();
  expect(changed).toEqual([]);

  const { data: deleted, error: deleteError } = await primary
    .from("beans")
    .delete()
    .eq("id", otherBean!.id)
    .select("id");
  expect(deleteError).toBeNull();
  expect(deleted).toEqual([]);

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
  expect(insertError).toBeTruthy();

  const { error: foreignTagError } = await primary.from("tasting_tags").insert({
    bean_id: otherBean!.id,
    user_id: (await primary.auth.getUser()).data.user!.id,
    tag: "foreign-parent",
    category: "other",
  });
  expect(foreignTagError).toBeTruthy();

  const { error: foreignComponentError } = await primary.from("blend_components").insert({
    bean_id: otherBean!.id,
    user_id: (await primary.auth.getUser()).data.user!.id,
    origin_country: "Kenya",
    percentage: 100,
    sort_order: 0,
  });
  expect(foreignComponentError).toBeTruthy();
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
  const response = await request.post(`${localSupabaseUrl}/rest/v1/rpc/create_bean_record`, {
    headers: {
      apikey: localAnonKey,
      Authorization: `Bearer ${localAnonKey}`,
      "Content-Type": "application/json",
    },
    data: { p_bean: {}, p_tags: [], p_components: [] },
  });
  expect(response.status()).toBe(401);

  const deleteResponse = await request.post(
    `${localSupabaseUrl}/rest/v1/rpc/delete_current_account`,
    {
      headers: {
        apikey: localAnonKey,
        Authorization: `Bearer ${localAnonKey}`,
        "Content-Type": "application/json",
      },
      data: {},
    }
  );
  expect(deleteResponse.status()).toBe(401);

  const rateLimitResponse = await request.post(
    `${localSupabaseUrl}/rest/v1/rpc/check_rate_limit`,
    {
      headers: {
        apikey: localAnonKey,
        Authorization: `Bearer ${localAnonKey}`,
        "Content-Type": "application/json",
      },
      data: { p_action: "anonymous-probe", p_max_count: 1, p_window_minutes: 1 },
    }
  );
  expect(rateLimitResponse.status()).toBe(401);
});

test("Go API rejects forged JWTs and rolls back database child failures", async ({ request }) => {
  test.skip(!qaApiURL, "Go API security checks run against Docker staging");

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
    email: `beanlog-qa-delete-${suffix}@local.test`,
    password: "Qa-Delete-Only-2026!",
  };
  const disposableId = await ensureUser(disposable.email, disposable.password);
  let deleted = false;

  try {
    const { client } = await signIn(disposable.email, disposable.password);
    const { error: insertError } = await client.from("beans").insert({
      user_id: disposableId,
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
