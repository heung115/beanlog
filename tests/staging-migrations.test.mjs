import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { splitStagingMigrations, privilegedStagingMigration } from "../scripts/staging-migrations.mjs";

test("CLI bootstrap excludes only reviewed privileged migrations", () => {
  const plan = splitStagingMigrations(fs.readdirSync(new URL("../supabase/migrations/", import.meta.url)));
  assert.ok(plan.bootstrap.includes("00027_bean_edit_concurrency.sql"));
  assert.equal(plan.privileged.length, 10);
  assert.ok(plan.privileged.every(name => !plan.bootstrap.includes(name)));
  assert.throws(() => splitStagingMigrations(["00099_unreviewed.sql"]), /Review new migrations/);
});

test("reviewed migration wrappers preserve SQL and bind idempotency to exact content", () => {
  const name = "00028_function_execution_allowlist.sql";
  const source = fs.readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
  const sql = privilegedStagingMigration(name, source);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /history mismatch/);
  assert.match(sql, /Unverified privileged staging migration history/);
  assert.match(sql, /ALTER DEFAULT PRIVILEGES|alter default privileges/);
  assert.notEqual(sql, privilegedStagingMigration(name, source + "\n"));
  assert.throws(() => privilegedStagingMigration("00099_other.sql", source));
  assert.throws(() => privilegedStagingMigration(name, "select 1;"), /transaction/);
});
