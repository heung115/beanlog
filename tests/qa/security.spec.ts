import { expect, test } from "@playwright/test";
import { localAnonKey, localSupabaseUrl, qaOtherUser, qaUser, signIn } from "./helpers";

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
});
