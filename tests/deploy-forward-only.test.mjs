import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

const directory = mkdtempSync(path.join(os.tmpdir(), "beanmap-deploy-history-"));
after(() => rmSync(directory, { recursive: true, force: true }));
const git = (...args) => execFileSync("git", ["-C", directory, ...args], { encoding: "utf8" }).trim();
git("init", "--quiet", "--initial-branch=main");
git("config", "user.name", "Deployment regression fixture");
git("config", "user.email", "deployment-fixture@example.test");
function commit(message) {
  git("-c", "commit.gpgsign=false", "commit", "--quiet", "--allow-empty", "-m", message);
  return git("rev-parse", "HEAD");
}
const older = commit("older verified release");
const current = commit("current deployed release");
const newer = commit("new verified release");
git("checkout", "--quiet", "-b", "diverging-history", older);
const diverging = commit("verified but diverging release");
const brokenHistory = execFileSync("git", ["-C", directory, "hash-object", "-t", "commit", "-w", "--stdin"], {
  encoding: "utf8",
  input: `tree ${git("rev-parse", "HEAD^{tree}")}\nparent ${"f".repeat(40)}\nauthor Fixture <fixture@example.test> 1 +0000\ncommitter Fixture <fixture@example.test> 1 +0000\n\nMissing parent fixture\n`,
}).trim();

const source = readFileSync(new URL("../scripts/beanmap-deploy-poller.sh", import.meta.url), "utf8");
// Execute the production guard against real Git history, without a network,
// deployment command, host state, or an independently reimplemented comparison.
const guard = source.match(/# BEGIN forward-only deployment guard\n([\s\S]*?)# END forward-only deployment guard/)?.[1];
assert.ok(guard, "Production deployment guard is required");
const unchanged = source.match(/if \[\[ "\$verified_sha" == "\$deployed_sha" \]\]; then\n  exit 0\nfi/)?.[0];
assert.ok(unchanged, "An unchanged release must exit before replacement");
function check(deployed, candidate) {
  return spawnSync("bash", ["-c", `set -euo pipefail\n${unchanged}\n${guard}\nprintf 'DEPLOY_NEXT\\n'`], {
    encoding: "utf8",
    env: { ...process.env, repository_dir: path.join(directory, ".git"), deployed_sha: deployed, verified_sha: candidate },
  });
}

test("a stale successful main release cannot roll back a newer deployed release", () => {
  const result = check(current, older);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /ignored an older or diverging/);
});
test("a verified descendant may advance the deployed release", () => {
  const result = check(current, newer);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "DEPLOY_NEXT\n");
});
test("a force-pushed or unrelated history cannot silently replace deployment", () => {
  const result = check(current, diverging);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
});
test("an unchanged successful release does not redeploy", () => {
  const result = check(current, current);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
});
test("a Git history error is a failure, not a successful stale-release skip", () => {
  const result = check(brokenHistory, newer);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /cannot compare the current deployment history/);
});
test("an unknown, blank or malformed deployment state fails closed", () => {
  for (const deployed of ["f".repeat(40), "invalid-state", ""]) {
    const result = check(deployed, newer);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /cannot verify the current deployment/);
  }
});
test("superseded webhooks allow fallback without deleting a potentially newer request file", () => {
  const selection = source.match(/# BEGIN superseded trigger selection\n([\s\S]*?)# END superseded trigger selection/)?.[1];
  assert.ok(selection);
  for (const [requested, expected] of [[older, ""], [diverging, ""], [newer, newer], ["f".repeat(40), "f".repeat(40)]]) {
    const result = spawnSync("bash", ["-c", `set -euo pipefail\n${selection}\nprintf '%s' "$requested_sha"`], {
      encoding: "utf8",
      env: { ...process.env, repository_dir: path.join(directory, ".git"), deployed_sha: current, requested_sha: requested, requested_run_id: "123" },
    });
    assert.equal(result.status, 0);
    assert.equal(result.stdout, expected);
  }
});
