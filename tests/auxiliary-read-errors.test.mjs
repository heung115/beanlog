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

function fixture(apiFetch) {
  const exports = {};
  vm.runInNewContext(outputText, { exports, require(name) {
    if (name === "zod") return { z };
    if (name === "@/lib/supabase/server") return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "qa" } }, error: null }) } }) };
    if (name === "@/lib/api/client") return { apiFetch, ApiError };
    if (["@/lib/validation/beans", "next/cache", "next/navigation", "next/headers", "@/i18n/routing"].includes(name)) return {};
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  return exports;
}

test("unavailable filter choices are explicit and a retry returns the full set", async () => {
  let calls = 0;
  const choices = { origins: ["Ethiopia"], roasteries: ["Sample roastery"], varietals: ["Heirloom"] };
  const actions = fixture(async () => { if (++calls === 1) throw new ApiError(503); return choices; });
  assert.equal((await actions.getBeanFilterOptions()).error, "Unable to load filter options");
  assert.equal(await actions.getBeanFilterOptions(), choices);
});

test("a verified empty filter set remains a successful result", async () => {
  const actions = fixture(async () => ({ origins: [], roasteries: [], varietals: [] }));
  assert.equal((await actions.getBeanFilterOptions()).error, undefined);
});

test("an export size limit is distinct from a connection failure", async () => {
  for (const status of [413, 503]) {
    const actions = fixture(async () => { throw new ApiError(status); });
    const result = await actions.exportData();
    if (status === 413) assert.equal(result.error, "export_limit");
    else assert.equal(result, null);
  }
});
