import { execFileSync } from "node:child_process";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const fixtures = JSON.parse(
  fs.readFileSync(new URL("tests/fixtures/unspecialty-july-2026.json", root), "utf8")
);
const status = execFileSync("npx", ["supabase", "status", "-o", "env"], {
  cwd: root,
  encoding: "utf8",
});
const dbUrl = status.match(/^DB_URL="?([^"\n]+)"?$/m)?.[1];
if (!dbUrl) throw new Error("Local Supabase DB_URL not found");

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const nullable = (value) => (value === undefined ? "null" : quote(value));
const numberOrNull = (value) => (value === undefined ? "null" : String(value));
const values = fixtures
  .map(
    (bean, index) => `(
      (select id from target), ${quote(bean.name)}, '커피화 로스터스', 'single_origin',
      ${quote(bean.origin_country)}, ${nullable(bean.origin_region)},
      ${nullable(bean.farm_producer)}, ${nullable(bean.varietal)},
      ${quote(bean.process_method)}, ${nullable(bean.process_detail)},
      ${index % 3 === 0 ? "'light'" : "'medium'"},
      ${quote(new Date(Date.UTC(2026, 6, 30, 12, index)).toISOString())}::timestamptz,
      'home', ${(7 + (index % 4) * 0.5).toFixed(1)},
      '[source:unspecialty-775] 언스페셜티 7월 월픽 상품 정보 기반 테스트 등록',
      'online', ${numberOrNull(bean.price)}, ${numberOrNull(bean.weight_g)}, '2026-07-30'::date
    )`
  )
  .join(",\n");

const sql = `
with target as (
  select id from auth.users where email = 'beanlog-test@local.dev'
), source_rows (
  user_id, name, roastery, bean_type, origin_country, origin_region,
  farm_producer, varietal, process_method, process_detail, roast_level,
  consumed_at, place_type, overall_score, note, purchase_source, price,
  weight_g, purchased_at
) as (values ${values})
insert into public.beans (
  user_id, name, roastery, bean_type, origin_country, origin_region,
  farm_producer, varietal, process_method, process_detail, roast_level,
  consumed_at, place_type, overall_score, note, purchase_source, price,
  weight_g, purchased_at
)
select * from source_rows
where not exists (
  select 1 from public.beans existing
  where existing.user_id = source_rows.user_id and existing.name = source_rows.name
);
`;

execFileSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-c", sql], {
  cwd: root,
  stdio: "inherit",
});
