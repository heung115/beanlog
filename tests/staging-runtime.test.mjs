import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  deriveStagingRuntime,
  renderSupabaseConfig,
} from "../scripts/staging-runtime.mjs";

const compose = fs.readFileSync(
  new URL("../docker-compose.staging.yml", import.meta.url),
  "utf8"
);
const stagingRuntime = fs.readFileSync(
  new URL("../scripts/staging.mjs", import.meta.url),
  "utf8"
);
const packageJson = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")
);
const seedScript = fs.readFileSync(
  new URL("../scripts/seed-unspecialty-test-account.mjs", import.meta.url),
  "utf8"
);
const qaHelpers = fs.readFileSync(
  new URL("./qa/helpers.ts", import.meta.url),
  "utf8"
);
const stagingCredentials = fs.readFileSync(
  new URL("../scripts/staging-credentials.mjs", import.meta.url),
  "utf8"
);

test("the staging web uses the HMR development image with read-only source mounts", () => {
  assert.match(
    compose,
    /^name: \$\{STAGING_COMPOSE_PROJECT_NAME:-beanlog-staging\}$/m
  );
  assert.match(compose, /target: dev/);
  assert.match(compose, /\.\/src:\/app\/src:ro/);
  assert.match(compose, /\.\/public:\/app\/public:ro/);
  assert.match(compose, /\/app\/\.next:rw/);
  assert.match(compose, /mem_limit: 3g/);
});

test("staging startup never force-recreates the web container", () => {
  const forceRecreateCalls = [...stagingRuntime.matchAll(/compose\(\[(.*?)\]\);/gs)]
    .map(([, args]) => args)
    .filter((args) => args.includes('"--force-recreate"'));

  assert.equal(forceRecreateCalls.length, 1);
  assert.match(forceRecreateCalls[0], /"api"/);
  assert.doesNotMatch(forceRecreateCalls[0], /"web"/);
});

test("an existing API database credential is reused across staging startups", () => {
  assert.match(stagingRuntime, /storedDatabaseUrl \?\? provisionApiDatabaseRole\(\)/);
  assert.match(stagingRuntime, /if \(storedDatabaseUrl\)/);
});

test("the primary checkout keeps its established staging endpoints", () => {
  const primaryRoot = path.resolve("/repo/coffee-info");
  const runtime = deriveStagingRuntime({
    root: primaryRoot,
    gitCommonDir: path.join(primaryRoot, ".git"),
  });

  assert.equal(runtime.isPrimary, true);
  assert.equal(runtime.runtimeRoot, path.join(primaryRoot, ".staging"));
  assert.equal(runtime.composeProject, "beanlog-staging");
  assert.equal(runtime.supabaseProject, "beanlog-staging");
  assert.equal(runtime.web, 3100);
  assert.equal(runtime.api, 8180);
  assert.equal(runtime.supabaseApi, 55321);
});

test("linked worktrees receive isolated projects, runtime roots, and valid ports", () => {
  const gitCommonDir = path.resolve("/repo/coffee-info/.git");
  const first = deriveStagingRuntime({
    root: "/worktrees/alpha/coffee-info",
    gitCommonDir,
  });
  const second = deriveStagingRuntime({
    root: "/worktrees/beta/coffee-info",
    gitCommonDir,
  });

  assert.equal(first.isPrimary, false);
  assert.equal(second.isPrimary, false);
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.runtimeRoot, second.runtimeRoot);
  assert.notEqual(first.composeProject, second.composeProject);
  assert.notEqual(first.supabaseProject, second.supabaseProject);

  for (const key of [
    "web",
    "api",
    "supabaseApi",
    "supabaseDb",
    "supabaseShadow",
    "supabaseStudio",
    "supabaseMail",
    "supabasePooler",
  ]) {
    assert.ok(first[key] >= 1 && first[key] <= 65535, `${key} is valid`);
    assert.notEqual(first[key], second[key], `${key} is isolated`);
  }
});

test("the Supabase template is rendered for the selected worktree", () => {
  const template = fs.readFileSync(
    new URL("../staging/supabase/config.toml", import.meta.url),
    "utf8"
  );
  const runtime = deriveStagingRuntime({
    root: "/worktrees/auth/coffee-info",
    gitCommonDir: "/repo/coffee-info/.git",
  });
  const rendered = renderSupabaseConfig(template, runtime);

  assert.match(rendered, new RegExp(`project_id = "${runtime.supabaseProject}"`));
  assert.match(
    rendered,
    new RegExp(`\\[api\\][\\s\\S]*?port = ${runtime.supabaseApi}`)
  );
  assert.match(
    rendered,
    new RegExp(
      `\\[db\\][\\s\\S]*?port = ${runtime.supabaseDb}[\\s\\S]*?shadow_port = ${runtime.supabaseShadow}`
    )
  );
  assert.match(
    rendered,
    new RegExp(`\\[db\\.pooler\\][\\s\\S]*?port = ${runtime.supabasePooler}`)
  );
  assert.match(
    rendered,
    new RegExp(`\\[studio\\][\\s\\S]*?port = ${runtime.supabaseStudio}`)
  );
  assert.match(
    rendered,
    new RegExp(`\\[local_smtp\\][\\s\\S]*?port = ${runtime.supabaseMail}`)
  );
  assert.match(rendered, new RegExp(`site_url = "http://localhost:${runtime.web}"`));
  assert.match(
    rendered,
    new RegExp(`http://localhost:${runtime.web}/api/auth/callback`)
  );
});

test("staging commands consistently use the derived worktree runtime", () => {
  assert.match(stagingRuntime, /deriveStagingRuntime/);
  assert.match(stagingRuntime, /runtime\.runtimeRoot/);
  assert.match(stagingRuntime, /runtime\.composeProject/);
  assert.match(stagingRuntime, /runtime\.supabaseProject/);
  assert.match(stagingRuntime, /renderSupabaseConfig/);
  assert.match(stagingRuntime, /STAGING_SUPABASE_NETWORK/);
  assert.match(stagingRuntime, /STAGING_DEPLOYMENT_ID/);
  assert.doesNotMatch(stagingRuntime, /supabase_(kong|db|studio|inbucket)_beanlog-staging/);
  assert.doesNotMatch(stagingRuntime, /--project-id", "beanlog-staging"/);
  assert.match(seedScript, /deriveStagingRuntime/);
  assert.match(seedScript, /runtime\.runtimeRoot/);
  assert.match(qaHelpers, /deriveStagingRuntime/);
  assert.match(qaHelpers, /runtime\.runtimeRoot/);
  assert.match(stagingRuntime, /ensureQaCredentials\(runtimeRoot\)/);
  assert.match(stagingCredentials, /mode: 0o600/);
});

test("the legacy local development files remain available", () => {
  assert.equal(fs.existsSync(new URL("../docker-compose.yml", import.meta.url)), true);
  assert.equal(fs.existsSync(new URL("../supabase/config.toml", import.meta.url)), true);
  assert.equal(fs.existsSync(new URL("../scripts/local.mjs", import.meta.url)), false);
  assert.equal(fs.existsSync(new URL("../docs/LOCAL.md", import.meta.url)), false);
  assert.equal(fs.existsSync(new URL("../.local", import.meta.url)), false);
  assert.equal(
    Object.keys(packageJson.scripts).some((name) => name.startsWith("local:")),
    false
  );
  assert.match(packageJson.scripts.dev, /scripts\/staging\.mjs up/);
  assert.doesNotMatch(compose, /LOCAL_|beanlog-local|local-supabase/);
  assert.doesNotMatch(stagingRuntime, /path\.join\(root, "\.local"\)/);
});
