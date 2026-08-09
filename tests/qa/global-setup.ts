import fs from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureUser, qaOtherUser, qaUser, signIn } from "./helpers";

type Fixture = {
  name: string;
  origin_country: string;
  origin_region?: string;
  farm_producer?: string;
  varietal?: string;
  process_method: string;
  process_detail?: string;
  price?: number;
  weight_g?: number;
};

async function deleteAllBeans(client: SupabaseClient, userId: string) {
  const { data: beans, error: listError } = await client
    .from("beans")
    .select("id")
    .eq("user_id", userId);
  if (listError) throw listError;

  for (const bean of beans ?? []) {
    const { data: deleted, error } = await client.rpc("delete_bean_record", {
      p_id: bean.id,
    });
    if (error || !deleted) throw error ?? new Error(`Failed to delete QA bean ${bean.id}`);
  }
}

async function createBean(
  client: SupabaseClient,
  bean: Record<string, unknown>,
  tags: Array<{ tag: string; category: string }> = []
) {
  const { data, error } = await client.rpc("create_bean_record", {
    p_bean: bean,
    p_tags: tags,
    p_components: [],
  });
  if (error || !data) throw error ?? new Error("Failed to create QA bean");
  return data as string;
}

export default async function globalSetup() {
  const primaryId = await ensureUser(qaUser.email, qaUser.password);
  const isolationId = await ensureUser(qaOtherUser.email, qaOtherUser.password);
  const { client: primary } = await signIn(qaUser.email, qaUser.password);
  const { client: isolation } = await signIn(qaOtherUser.email, qaOtherUser.password);

  // handle_new_user creates profiles. Update only the caller-owned display fields;
  // never use service-role table access in this harness.
  const { error: primaryProfileError } = await primary
    .from("profiles")
    .update({ display_name: "Beanlog QA", locale: "ko" })
    .eq("id", primaryId);
  if (primaryProfileError) throw primaryProfileError;
  const { error: isolationProfileError } = await isolation
    .from("profiles")
    .update({ display_name: "Beanlog QA Isolation", locale: "ko" })
    .eq("id", isolationId);
  if (isolationProfileError) throw isolationProfileError;

  const fixturePath = path.join(process.cwd(), "tests/fixtures/unspecialty-july-2026.json");
  const fixtures = JSON.parse(await fs.readFile(fixturePath, "utf8")) as Fixture[];
  const sourceNote = "[QA:unspecialty-775] 언스페셜티 7월 월픽 상품 정보 기반 테스트 등록";

  // These accounts are dedicated to the automated harness. Clear every row,
  // including a partially-written row left by an older broken API build, so
  // each run starts from an exact and reproducible 30-record boundary.
  await deleteAllBeans(primary, primaryId);
  await deleteAllBeans(isolation, isolationId);

  const rows = fixtures.map((fixture, index) => ({
    ...fixture,
    roastery: "커피화 로스터스",
    bean_type: "single_origin",
    roast_level: index % 3 === 0 ? "light" : "medium",
    consumed_at: new Date(Date.UTC(2026, 6, 30, 12, index)).toISOString(),
    place_type: "home",
    overall_score: 7 + (index % 4) * 0.5,
    purchase_source: "online",
    purchased_at: "2026-07-30",
    note: sourceNote,
  }));
  const baselineCountries = [
    "Vietnam",
    "Burundi",
    "Guatemala",
    "Costa Rica",
    "Rwanda",
    "Bolivia",
    "Mexico",
    "Indonesia",
    "Nicaragua",
    "Honduras",
  ];
  const baselineRows = baselineCountries.map((country, index) => ({
    name: `[QA baseline ${String(index + 1).padStart(2, "0")}] ${country}`,
    roastery: "QA Boundary Roastery",
    bean_type: "single_origin",
    origin_country: country,
    process_method: index % 2 === 0 ? "washed" : "natural",
    roast_level: "medium",
    consumed_at: new Date(Date.UTC(2026, 6, 29, 12, index)).toISOString(),
    place_type: "home",
    overall_score: 7,
    note: "[QA:pagination] 20건 경계와 전체 필터 옵션 검증용",
  }));
  for (const [index, row] of [...rows, ...baselineRows].entries()) {
    await createBean(
      primary,
      row,
      index === 0
        ? [
            { tag: "chocolate", category: "cocoa" },
            { tag: "caramel", category: "sweet" },
          ]
        : []
    );
  }

  await createBean(isolation, {
    name: "[QA] 다른 사용자 비공개 원두",
    roastery: "Isolation Roastery",
    bean_type: "single_origin",
    origin_country: "Panama",
    process_method: "washed",
    roast_level: "light",
    consumed_at: "2026-07-30T12:00:00.000Z",
    place_type: "home",
    overall_score: 9,
    note: "[QA:isolation] 반드시 다른 사용자에게 보이지 않아야 함",
  });
}
