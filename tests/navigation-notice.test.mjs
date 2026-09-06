import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/navigation-notice.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const exports = {};
vm.runInNewContext(outputText, { exports });
const { saveNavigationNotice, consumeNavigationNotice } = exports;

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test("save feedback reaches the next document once in either language", () => {
  for (const message of ["기록을 저장했어요", "Record saved"]) {
    const storage = memoryStorage();
    assert.equal(saveNavigationNotice(storage, message, 1000), true);
    assert.equal(consumeNavigationNotice(storage, 1500), message);
    assert.equal(consumeNavigationNotice(storage, 1501), null);
  }
});

test("stale, future, malformed and oversized notices are discarded", () => {
  for (const raw of [
    "broken", "null", JSON.stringify({ message: "saved", createdAt: 1000 }),
    JSON.stringify({ message: "saved", createdAt: 100000 }),
    JSON.stringify({ message: "saved", createdAt: "45000" }),
    JSON.stringify({ message: "x".repeat(501), createdAt: 45000 }),
  ]) {
    const storage = memoryStorage();
    storage.setItem("beanmap:navigation-notice", raw);
    assert.equal(consumeNavigationNotice(storage, 46000), null);
    assert.equal(storage.getItem("beanmap:navigation-notice"), null);
  }
});

test("blocked browser storage does not break saving or page loading", () => {
  const fail = () => { throw new Error("Storage blocked"); };
  const storage = { getItem: fail, setItem: fail, removeItem: fail };
  assert.equal(saveNavigationNotice(storage, "saved"), false);
  assert.equal(consumeNavigationNotice(storage), null);
});
