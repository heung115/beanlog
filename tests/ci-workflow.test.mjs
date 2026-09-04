import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workflow = fs.readFileSync(
  new URL("../.github/workflows/ci-cd.yml", import.meta.url),
  "utf8"
);
const goMod = fs.readFileSync(
  new URL("../server/go.mod", import.meta.url),
  "utf8"
);

const triggerBlock = workflow.slice(
  workflow.indexOf("on:"),
  workflow.indexOf("\npermissions:")
);

function branchFilters(eventName) {
  const event = triggerBlock.match(
    new RegExp(`^  ${eventName}:\\n    branches:\\n((?:      - .+\\n)+)`, "m")
  )?.[1];

  assert.ok(event, `${eventName} should declare branch filters`);
  return [...event.matchAll(/^\s+-\s+["']?([^"'\n]+)["']?$/gm)].map(
    (match) => match[1]
  );
}

test("CI avoids duplicate push and pull request verification", () => {
  assert.deepEqual(branchFilters("push"), ["main"]);
  assert.deepEqual(branchFilters("pull_request"), ["main"]);
});

test("CI dependency installation stays cache-first and avoids incidental network work", () => {
  assert.match(
    workflow,
    /run: npm ci --prefer-offline --no-audit --no-fund/
  );
});

test("CI derives the Go toolchain from the module declaration", () => {
  const moduleVersion = goMod.match(/^go (\d+\.\d+\.\d+)$/m)?.[1];

  assert.ok(moduleVersion, "server/go.mod should declare a patch-level Go version");
  assert.match(workflow, /go-version-file: server\/go\.mod/);
  assert.doesNotMatch(workflow, /^\s+GO_VERSION:/m);
});
