import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  assertProductionQaNodeVersion,
  deriveProductionQaConfig,
  deriveStagingRuntime,
  productionQaBuildArguments,
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
    /^name: \$\{STAGING_COMPOSE_PROJECT_NAME:-beanmap-staging\}$/m
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

test("application containers are isolated from Supabase management services", () => {
  const webService = compose.match(/\n  web:[\s\S]*?\n  api:/)?.[0] ?? "";
  const apiService = compose.match(/\n  api:[\s\S]*?\nnetworks:/)?.[0] ?? "";

  assert.doesNotMatch(webService, /staging-supabase/);
  assert.doesNotMatch(apiService, /staging-supabase/);
  assert.match(webService, /staging-gateway/);
  assert.match(apiService, /staging-gateway/);
  assert.match(apiService, /staging-database/);
  assert.match(stagingRuntime, /ensurePrivateServiceNetworks/);
  assert.match(stagingRuntime, /meta,studio/);
});

test("the primary checkout keeps its established staging endpoints", () => {
  const primaryRoot = path.resolve("/repo/beanmap");
  const runtime = deriveStagingRuntime({
    root: primaryRoot,
    gitCommonDir: path.join(primaryRoot, ".git"),
  });

  assert.equal(runtime.isPrimary, true);
  assert.equal(runtime.runtimeRoot, path.join(primaryRoot, ".staging"));
  assert.equal(runtime.composeProject, "beanmap-staging");
  assert.equal(runtime.supabaseProject, "beanmap-staging");
  assert.equal(runtime.web, 3100);
  assert.equal(runtime.productionQaWeb, 4100);
  assert.equal(runtime.qaLock, 5100);
  assert.equal(runtime.api, 8180);
  assert.equal(runtime.supabaseApi, 55321);
});

test("linked worktrees receive isolated projects, runtime roots, and valid ports", () => {
  const gitCommonDir = path.resolve("/repo/beanmap/.git");
  const first = deriveStagingRuntime({
    root: "/worktrees/alpha/beanmap",
    gitCommonDir,
  });
  const second = deriveStagingRuntime({
    root: "/worktrees/beta/beanmap",
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
    "productionQaWeb",
    "api",
    "qaLock",
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

test("production QA derives isolated browser and host-side service endpoints", () => {
  const runtime = deriveStagingRuntime({
    root: "/worktrees/production-qa/beanmap",
    gitCommonDir: "/repo/beanmap/.git",
  });
  const config = deriveProductionQaConfig({
    runtime,
    stagingEnv: {
      STAGING_PUBLIC_SUPABASE_URL: "http://localhost:43121",
      STAGING_SUPABASE_ANON_KEY: "test-anon-key",
      STAGING_SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      STAGING_API_PORT: "18180",
      STAGING_DEPLOYMENT_ID: "isolated-staging",
    },
    serverActionsEncryptionKey: "production-qa-encryption-key",
    baseEnv: {
      PRESERVED_ENV: "yes",
      NODE_ENV: "development",
      QA_PRIMARY_PASSWORD: "must-not-reach-app",
      QA_SUPABASE_SERVICE_ROLE_KEY: "must-not-reach-app",
      STAGING_SUPABASE_SERVICE_ROLE_KEY: "must-not-reach-app",
      DATABASE_URL: "must-not-reach-app",
    },
  });

  assert.equal(config.appUrl, `http://localhost:${runtime.productionQaWeb}`);
  assert.equal(config.apiUrl, "http://127.0.0.1:18180");
  assert.equal(config.publicSupabaseUrl, "http://localhost:43121");
  assert.equal(config.processEnv.QA_PRIMARY_PASSWORD, undefined);
  assert.equal(config.processEnv.QA_SUPABASE_SERVICE_ROLE_KEY, undefined);
  assert.equal(config.processEnv.STAGING_SUPABASE_SERVICE_ROLE_KEY, undefined);
  assert.equal(config.processEnv.DATABASE_URL, undefined);
  assert.deepEqual(
    {
      PRESERVED_ENV: config.processEnv.PRESERVED_ENV,
      NODE_ENV: config.processEnv.NODE_ENV,
      NEXT_PUBLIC_SUPABASE_URL: config.processEnv.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: config.processEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_APP_URL: config.processEnv.NEXT_PUBLIC_APP_URL,
      SUPABASE_SERVER_URL: config.processEnv.SUPABASE_SERVER_URL,
      GO_API_URL: config.processEnv.GO_API_URL,
      NEXT_DEPLOYMENT_ID: config.processEnv.NEXT_DEPLOYMENT_ID,
      NEXT_SERVER_ACTIONS_ENCRYPTION_KEY:
        config.processEnv.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY,
      QA_ALLOW_INSECURE_LOOPBACK_AUTH:
        config.processEnv.QA_ALLOW_INSECURE_LOOPBACK_AUTH,
      HOSTNAME: config.processEnv.HOSTNAME,
      PORT: config.processEnv.PORT,
    },
    {
      PRESERVED_ENV: "yes",
      NODE_ENV: "production",
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:43121",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      NEXT_PUBLIC_APP_URL: `http://localhost:${runtime.productionQaWeb}`,
      SUPABASE_SERVER_URL: "http://127.0.0.1:43121",
      GO_API_URL: "http://127.0.0.1:18180",
      NEXT_DEPLOYMENT_ID: "isolated-staging-production-qa",
      NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: "production-qa-encryption-key",
      QA_ALLOW_INSECURE_LOOPBACK_AUTH: "1",
      HOSTNAME: "127.0.0.1",
      PORT: String(runtime.productionQaWeb),
    }
  );
});

test("production QA refuses incomplete staging configuration", () => {
  assert.throws(
    () =>
      deriveProductionQaConfig({
        runtime: { productionQaWeb: 4100, composeProject: "beanmap-staging" },
        stagingEnv: {},
        serverActionsEncryptionKey: "test-key",
      }),
    /Missing STAGING_PUBLIC_SUPABASE_URL/
  );
  assert.throws(
    () =>
      deriveProductionQaConfig({
        runtime: { productionQaWeb: 4100, composeProject: "beanmap-staging" },
        stagingEnv: {
          STAGING_PUBLIC_SUPABASE_URL: "http:\/\/localhost:55321",
          STAGING_SUPABASE_ANON_KEY: "test-anon-key",
          STAGING_SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
          STAGING_API_PORT: "8180",
        },
      }),
    /Missing production QA server actions encryption key/
  );
});

test("production QA accepts only the supported Node 22 engine range", () => {
  assert.doesNotThrow(() => assertProductionQaNodeVersion("22.18.0"));
  assert.doesNotThrow(() => assertProductionQaNodeVersion("22.99.0"));
  assert.throws(() => assertProductionQaNodeVersion("22.17.9"), /requires Node\.js/);
  assert.throws(() => assertProductionQaNodeVersion("23.0.0"), /requires Node\.js/);
  assert.throws(() => assertProductionQaNodeVersion("18.18.0"), /requires Node\.js/);
});

test("production QA preserves Turbopack unless worktree dependencies resolve outside it", () => {
  assert.deepEqual(
    productionQaBuildArguments({
      nextCli: "/repo/node_modules/next/dist/bin/next",
      root: "/repo",
      nodeModulesRealPath: "/repo/node_modules",
    }),
    ["/repo/node_modules/next/dist/bin/next", "build"]
  );
  assert.deepEqual(
    productionQaBuildArguments({
      nextCli: "/worktree/node_modules/next/dist/bin/next",
      root: "/worktree",
      nodeModulesRealPath: "/repo/node_modules",
    }),
    ["/worktree/node_modules/next/dist/bin/next", "build", "--webpack"]
  );
});

test("the Supabase template is rendered for the selected worktree", () => {
  const template = fs.readFileSync(
    new URL("../staging/supabase/config.toml", import.meta.url),
    "utf8"
  );
  const runtime = deriveStagingRuntime({
    root: "/worktrees/auth/beanmap",
    gitCommonDir: "/repo/beanmap/.git",
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
  assert.match(stagingRuntime, /STAGING_GATEWAY_NETWORK/);
  assert.match(stagingRuntime, /STAGING_DATABASE_NETWORK/);
  assert.match(stagingRuntime, /STAGING_DEPLOYMENT_ID/);
  assert.doesNotMatch(stagingRuntime, /supabase_(kong|db|studio|inbucket)_beanmap-staging/);
  assert.doesNotMatch(stagingRuntime, /--project-id", "beanmap-staging"/);
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
  assert.equal(
    packageJson.scripts["staging:qa:production"],
    "node scripts/staging.mjs qa:production"
  );
  assert.doesNotMatch(compose, /LOCAL_|beanmap-local|local-supabase/);
  assert.doesNotMatch(stagingRuntime, /path\.join\(root, "\.local"\)/);
});
