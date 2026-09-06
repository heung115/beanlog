import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";

const { outputText } = ts.transpileModule(readFileSync(new URL("../src/lib/actions/beans.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});

class ApiError extends Error { constructor(status) { super("Request failed"); this.status = status; } }

function fixture({ apiFailure = false } = {}) {
  const writes = [];
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require(name) {
      if (name === "zod") return { z };
      if (name === "@/lib/supabase/server") return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "qa-user" } } }) } }) };
      if (name === "@/lib/validation/beans") return { beanFormSchema: z.any() };
      if (name === "@/lib/api/client") return { ApiError, apiFetch: async (_path, options) => { if (apiFailure) throw new Error("Unavailable"); writes.push(options.body); return { success: true, id: "qa-record" }; } };
      if (name === "next/cache") return { revalidatePath() {} };
      if (name === "next/navigation") return { redirect: (destination) => { throw Object.assign(new Error("Redirect"), { destination }); } };
      if (["next/headers", "@/i18n/routing"].includes(name)) return {};
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return { save: exports.createBeanFromForm, writes };
}

function form(locale = "ko") {
  const result = new FormData();
  for (const [key, value] of Object.entries({ name: "기본 기록 Native record", roastery: "Sample roastery", bean_type: "single_origin", origin_country: "Ethiopia", origin_subregions: "Yirgacheffe, Kochere", altitude_m: "1900", harvest_year: "2026", process_method: "washed", roast_level: "medium", consumed_at: "2026-09-06", place_type: "home", overall_score: "8.5", note: "Native form values", locale })) result.set(key, value);
  return result;
}

for (const locale of ["ko", "en"]) {
  test(`${locale} native record preserves visible optional origin fields`, async () => {
    const { save, writes } = fixture();
    await assert.rejects(save(form(locale)), (error) => error.destination === `/${locale}/explore`);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].altitude_m, 1900);
    assert.equal(writes[0].harvest_year, 2026);
    assert.deepEqual([...writes[0].origin_subregions], ["Yirgacheffe", "Kochere"]);
  });
}

test("native invalid input and an unavailable API return explicit error states", async () => {
  const invalid = fixture();
  const data = form("en");
  data.set("altitude_m", "-1");
  await assert.rejects(invalid.save(data), (error) => error.destination === "/en/beans/new?error=invalid");
  assert.equal(invalid.writes.length, 0);
  const unavailable = fixture({ apiFailure: true });
  await assert.rejects(unavailable.save(form()), (error) => error.destination === "/ko/beans/new?error=save");
});
