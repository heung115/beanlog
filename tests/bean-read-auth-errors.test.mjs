import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";

const source = readFileSync(new URL("../src/lib/actions/beans.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});

function actionsWithAuth(response) {
  let apiCalls = 0;
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require(name) {
      if (name === "zod") return { z };
      if (name === "@/lib/supabase/server") {
        return { createClient: async () => ({ auth: { getUser: async () => response } }) };
      }
      if (name === "@/lib/validation/beans") return { beanIdSchema: z.string().uuid() };
      if (name === "@/lib/api/client") {
        return { apiFetch: async () => { apiCalls++; return null; } };
      }
      if (["next/cache", "next/navigation", "next/headers", "@/i18n/routing"].includes(name)) return {};
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return { actions: exports, apiCalls: () => apiCalls };
}

for (const status of [429, 503]) {
  test(`auth HTTP ${status} cannot appear as empty stats or a missing bean`, async () => {
    const { actions, apiCalls } = actionsWithAuth({ data: { user: null }, error: { status } });
    await assert.rejects(actions.getBeanStats(), /Unable to verify session/);
    await assert.rejects(actions.getBeanById("7cf5684a-aea4-4c57-b5c6-06e37053b3dc"), /Unable to verify session/);
    assert.equal((await actions.getBeans()).error, "Unable to verify session");
    assert.equal((await actions.getBeanFilterOptions()).error, "Unable to load filter options");
    assert.equal(apiCalls(), 0);
  });
}

test("a missing session cannot appear as an empty journal", async () => {
  const { actions, apiCalls } = actionsWithAuth({ data: { user: null }, error: null });
  assert.equal((await actions.getBeans()).error, "Unable to verify session");
  assert.equal((await actions.getBeanFilterOptions()).error, "Unable to load filter options");
  assert.equal(apiCalls(), 0);
});

test("a verified user with no records still receives empty statistics", async () => {
  const { actions, apiCalls } = actionsWithAuth({ data: { user: { id: "test-user" } }, error: null });
  assert.equal(await actions.getBeanStats(), null);
  assert.equal(apiCalls(), 1);
});
