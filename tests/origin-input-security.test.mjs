import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
import * as guides from "../src/data/origin-guides/index.ts";

const source = readFileSync(new URL("../src/lib/actions/origins.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
test("autocomplete validates type and UTF-16 length before contacting the API", async () => {
  const calls = [];
  const exports = {};
  vm.runInNewContext(compiled, { exports, require(name) {
    if (name === "zod") return { z };
    if (name === "@/data/origin-guides") return guides;
    if (name === "@/lib/api/client") return { apiFetch: async (...args) => { calls.push(args); return []; } };
    throw Error(name);
  } });
  for (const query of [{ country: "x".repeat(101) }, { country: "ok", region: "x".repeat(201) }, { country: 5 }, { country: " " }, { country: "😀".repeat(51) }]) {
    assert.equal((await exports.getUserOriginSubregions(query)).length, 0);
  }
  assert.equal(calls.length, 0);
  await exports.getUserOriginSubregions({ country: "  Ethiopia  ", region: "  Sidama " });
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [["/api/origins/subregions", { query: { country: "Ethiopia", region: "Sidama" } }]]);
});

test("researched suggestions remain available during API failure without leaking into another country", async () => {
  const exports = {};
  vm.runInNewContext(compiled, { exports, require(name) {
    if (name === "zod") return { z };
    if (name === "@/data/origin-guides") return guides;
    if (name === "@/lib/api/client") return { apiFetch: async () => { throw new Error("unavailable"); } };
    throw Error(name);
  } });
  const chains = await exports.getUserOriginSubregions({ country: "Ethiopia", region: "Yirgacheffe" });
  assert.ok(chains.some((chain) => chain.includes("Gedeb")));
  assert.equal((await exports.getUserOriginSubregions({ country: "Kenya", region: "Yirgacheffe" })).length, 0);
});
