import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { beanFormSchema } from "../src/lib/validation/beans.ts";

const { outputText } = ts.transpileModule(readFileSync(new URL("../src/lib/actions/beans.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
class ApiError extends Error { constructor(status) { super("Request failed"); this.status = status; } }
const id = "afc386fe-8af5-47a7-9f1b-3173f2bfae34";
const bean = { name: "Saved coffee", roastery: "QA", bean_type: "single_origin", origin_country: "Ethiopia", process_method: "washed", roast_level: "light", consumed_at: "2026-09-06", place_type: "home", overall_score: 8, note: "A draft", tags: [], blend_components: [] };
function fixture({ user = true, status } = {}) {
  const writes = [], revalidated = [];
  const exports = {};
  vm.runInNewContext(outputText, { exports, require(name) {
    if (name === "zod") return { z };
    if (name === "@/lib/supabase/server") return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: user ? { id: "qa" } : null }, error: null }) } }) };
    if (name === "@/lib/validation/beans") return { beanFormSchema, beanIdSchema: z.uuid() };
    if (name === "@/lib/api/client") return { ApiError, apiFetch: async (_path, options) => { writes.push(options.body); if (status) throw new ApiError(status); return { success: true, id }; } };
    if (name === "next/cache") return { revalidatePath: (path) => revalidated.push(path) };
    if (["next/navigation", "next/headers", "@/i18n/routing"].includes(name)) return {};
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  return { ...exports, writes, revalidated };
}

test("the exact microsecond record version reaches the atomic API update", async () => {
  const actions = fixture();
  const version = "2026-09-06T12:34:56.123456+00:00";
  assert.equal((await actions.updateBean(id, bean, version)).success, true);
  assert.equal(actions.writes[0].expected_updated_at, version);
  assert.equal(actions.revalidated.length, 3);
  const invalid = fixture();
  assert.ok((await invalid.updateBean(id, bean, "not-a-timestamp")).error);
  assert.equal(invalid.writes.length, 0);
});

test("conflicts and expired sessions remain distinguishable from connection failures", async () => {
  for (const [status, expected] of [[409, "record_conflict"], [401, "Unauthorized"], [503, "Unable to update bean"]]) {
    const actions = fixture({ status });
    assert.equal((await actions.updateBean(id, bean)).error, expected);
    assert.equal(actions.revalidated.length, 0);
  }
  assert.equal((await fixture({ user: false }).updateBean(id, bean)).error, "Unauthorized");
  assert.equal((await fixture({ status: 401 }).createBean(bean)).error, "Unauthorized");
});
