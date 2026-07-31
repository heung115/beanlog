import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import {
  deriveStagingRuntime,
  renderSupabaseConfig,
} from "./staging-runtime.mjs";
import { ensureQaCredentials } from "./staging-credentials.mjs";

const root = path.resolve(import.meta.dirname, "..");
const gitCommonDirOutput = execFileSync(
  "git",
  ["rev-parse", "--git-common-dir"],
  { cwd: root, encoding: "utf8" }
).trim();
const runtime = deriveStagingRuntime({
  root,
  gitCommonDir: path.resolve(root, gitCommonDirOutput),
});
const runtimeRoot = runtime.runtimeRoot;
const runtimeSupabase = path.join(runtimeRoot, "supabase");
const envFile = path.join(runtimeRoot, "docker.env");
const databaseSecretFile = path.join(runtimeRoot, "api-database-url.secret");
const composeFile = path.join(root, "docker-compose.staging.yml");
const command = process.argv[2] ?? "help";

function run(bin, args, options = {}) {
  const { capture, env: extraEnv, ...execOptions } = options;
  return execFileSync(bin, args, {
    cwd: root,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    ...execOptions,
    env: { ...process.env, COMPOSE_PROGRESS: "plain", ...extraEnv },
  });
}

function compose(args, options = {}) {
  if (!fs.existsSync(envFile)) {
    throw new Error("Staging environment is missing. Run `npm run staging:up` first.");
  }
  return run(
    "docker",
    [
      "compose",
      "--project-name",
      runtime.composeProject,
      "--env-file",
      envFile,
      "-f",
      composeFile,
      ...args,
    ],
    {
      ...options,
      env: {
        STAGING_COMPOSE_PROJECT_NAME: runtime.composeProject,
        STAGING_SUPABASE_NETWORK: `supabase_network_${runtime.supabaseProject}`,
        ...(options.env ?? {}),
      },
    }
  );
}

function copyRuntimeConfig() {
  fs.mkdirSync(runtimeSupabase, { recursive: true });
  const template = fs.readFileSync(
    path.join(root, "staging", "supabase", "config.toml"),
    "utf8"
  );
  fs.writeFileSync(
    path.join(runtimeSupabase, "config.toml"),
    renderSupabaseConfig(template, runtime)
  );
  fs.cpSync(path.join(root, "supabase", "seed.sql"), path.join(runtimeSupabase, "seed.sql"));
  fs.rmSync(path.join(runtimeSupabase, "migrations"), { recursive: true, force: true });
  fs.cpSync(path.join(root, "supabase", "migrations"), path.join(runtimeSupabase, "migrations"), {
    recursive: true,
  });
}

function supabase(args, options = {}) {
  return run("npx", ["supabase", ...args, "--workdir", runtimeRoot], options);
}

function readStatus() {
  return JSON.parse(
    run(
      "npx",
      ["supabase", "status", "-o", "json", "--workdir", runtimeRoot],
      { capture: true, stdio: ["ignore", "pipe", "pipe"] }
    )
  );
}

function dockerRequest(method, requestPath, body) {
  const socketPath = process.env.DOCKER_HOST?.startsWith("unix://")
    ? process.env.DOCKER_HOST.slice("unix://".length)
    : "/var/run/docker.sock";
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        socketPath,
        path: requestPath,
        method,
        headers: payload
          ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
          : undefined,
      },
      (response) => {
        let responseBody = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => (responseBody += chunk));
        response.on("end", () => {
          if ((response.statusCode ?? 500) >= 400) {
            reject(new Error(`Docker API ${method} ${requestPath} failed: ${response.statusCode} ${responseBody}`));
            return;
          }
          resolve(responseBody ? JSON.parse(responseBody) : undefined);
        });
      }
    );
    request.on("error", reject);
    if (payload) request.write(payload);
    request.end();
  });
}

async function bindContainerPortsToLoopback(containerName) {
  const inspected = JSON.parse(
    run("docker", ["inspect", containerName], { capture: true })
  )[0];
  const bindings = inspected.HostConfig.PortBindings ?? {};
  const hardenedBindings = Object.fromEntries(
    Object.entries(bindings).map(([port, entries]) => [
      port,
      entries?.map((entry) => ({ ...entry, HostIp: "127.0.0.1" })) ?? null,
    ])
  );
  const alreadyHardened = Object.values(bindings)
    .flatMap((entries) => entries ?? [])
    .every((entry) => entry.HostIp === "127.0.0.1");
  if (alreadyHardened) return;

  const endpoints = Object.fromEntries(
    Object.entries(inspected.NetworkSettings.Networks).map(([networkName, network]) => [
      networkName,
      {
        Aliases: (network.Aliases ?? []).filter(
          (alias) => alias !== inspected.Id.slice(0, 12)
        ),
        IPAMConfig: network.IPAMConfig,
        Links: network.Links,
        DriverOpts: network.DriverOpts,
      },
    ])
  );
  const config = {
    ...inspected.Config,
    HostConfig: { ...inspected.HostConfig, PortBindings: hardenedBindings },
    NetworkingConfig: { EndpointsConfig: endpoints },
  };
  delete config.Hostname;

  await dockerRequest("POST", `/containers/${inspected.Id}/stop?t=20`);
  await dockerRequest("DELETE", `/containers/${inspected.Id}?force=1`);
  const created = await dockerRequest(
    "POST",
    `/containers/create?name=${encodeURIComponent(containerName)}`,
    config
  );
  await dockerRequest("POST", `/containers/${created.Id}/start`);
}

async function hardenSupabaseBindings() {
  for (const name of [
    `supabase_kong_${runtime.supabaseProject}`,
    `supabase_db_${runtime.supabaseProject}`,
    `supabase_studio_${runtime.supabaseProject}`,
    `supabase_inbucket_${runtime.supabaseProject}`,
  ]) {
    await bindContainerPortsToLoopback(name);
  }
}

function provisionApiDatabaseRole() {
  const password = randomBytes(32).toString("base64url");
  const sql = `
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'beanlog_api') then
    create role beanlog_api login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
end;
$$;
alter role beanlog_api with login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password '${password}';
do $$
declare
  granted_role record;
begin
  for granted_role in
    select role.rolname, grantor.rolname as grantor_name
    from pg_auth_members membership
    join pg_roles role on role.oid = membership.roleid
    join pg_roles member on member.oid = membership.member
    join pg_roles grantor on grantor.oid = membership.grantor
    where member.rolname = 'beanlog_api'
  loop
    execute format(
      'revoke %I from beanlog_api granted by %I',
      granted_role.rolname,
      granted_role.grantor_name
    );
  end loop;
end;
$$;
grant authenticated to beanlog_api;
`;
  const result = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      `supabase_db_${runtime.supabaseProject}`,
      "psql",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "supabase_admin",
      "-d",
      "postgres",
      "-q",
    ],
    {
      cwd: root,
      input: sql,
      encoding: "utf8",
      stdio: ["pipe", "ignore", "pipe"],
    }
  );
  if (result.status !== 0) {
    throw new Error("Failed to provision the staging API database role.");
  }
  return `postgresql://beanlog_api:${encodeURIComponent(password)}@db:5432/postgres?sslmode=disable&application_name=beanlog-api`;
}

function writeEnvironment(status, databaseUrl) {
  const appUrl = `http://localhost:${runtime.web}`;
  const publicSupabaseUrl = `http://localhost:${runtime.supabaseApi}`;
  const values = {
    STAGING_COMPOSE_PROJECT_NAME: runtime.composeProject,
    STAGING_SUPABASE_NETWORK: `supabase_network_${runtime.supabaseProject}`,
    STAGING_DEPLOYMENT_ID: runtime.composeProject,
    STAGING_WEB_PORT: String(runtime.web),
    STAGING_API_PORT: String(runtime.api),
    STAGING_APP_URL: appUrl,
    STAGING_PUBLIC_SUPABASE_URL: publicSupabaseUrl,
    STAGING_INTERNAL_SUPABASE_URL: "http://kong:8000",
    STAGING_SUPABASE_ANON_KEY: status.ANON_KEY,
    STAGING_SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    STAGING_DATABASE_URL_FILE: databaseSecretFile,
    STAGING_JWKS_URL: "http://kong:8000/auth/v1/.well-known/jwks.json",
    STAGING_JWT_ISSUER: `${status.API_URL}/auth/v1`,
  };
  fs.mkdirSync(runtimeRoot, { recursive: true });
  fs.writeFileSync(databaseSecretFile, `${databaseUrl}\n`, { mode: 0o600 });
  fs.chmodSync(databaseSecretFile, 0o600);
  fs.writeFileSync(
    envFile,
    `${Object.entries(values)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")}\n`,
    { mode: 0o600 }
  );
  fs.chmodSync(envFile, 0o600);
  ensureQaCredentials(runtimeRoot);
}

function readStoredDatabaseUrl() {
  try {
    return fs.readFileSync(databaseSecretFile, "utf8").trim() || undefined;
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
}

async function waitFor(url, label, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status > 0 && response.status < 500) return;
    } catch {
      // Container may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`${label} did not become ready within ${timeoutMs / 1000}s`);
}

function readEnv() {
  return Object.fromEntries(
    fs
      .readFileSync(envFile, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      })
  );
}

async function up() {
  run("docker", ["info"], { stdio: "ignore" });
  copyRuntimeConfig();
  run(
    "npx",
    [
      "supabase",
      "start",
      "--exclude",
      "realtime,storage-api,imgproxy,logflare,vector,edge-runtime",
      "--workdir",
      runtimeRoot,
    ],
    { capture: true, stdio: ["ignore", "pipe", "pipe"] }
  );
  supabase(["migration", "up", "--local"]);
  const status = readStatus();
  const storedDatabaseUrl = readStoredDatabaseUrl();
  const databaseUrl = storedDatabaseUrl ?? provisionApiDatabaseRole();
  writeEnvironment(status, databaseUrl);
  await hardenSupabaseBindings();
  if (storedDatabaseUrl) {
    // Source files are mounted into the Next.js development container, so an
    // ordinary staging:up is idempotent and does not interrupt browser sessions.
    compose(["up", "-d", "--build", "--remove-orphans"]);
  } else {
    // A newly provisioned database password must be read by a fresh API
    // process. Recreate only the API; never replace the web container for an
    // API secret rotation.
    compose(["up", "-d", "--build", "--remove-orphans", "web"]);
    compose(["up", "-d", "--build", "--force-recreate", "api"]);
  }
  await waitFor(`http://localhost:${runtime.web}/ko/login`, "Beanlog web");
  await waitFor(`http://localhost:${runtime.api}/health`, "Beanlog API");
  console.log("\nBeanlog staging development environment is ready:");
  console.log(`  Runtime:  ${runtime.id}`);
  console.log(`  App:      http://localhost:${runtime.web}`);
  console.log(`  API:      http://localhost:${runtime.api}/health`);
  console.log(`  Supabase: http://localhost:${runtime.supabaseApi}`);
  console.log(`  Studio:   http://localhost:${runtime.supabaseStudio}`);
  console.log("Run `npm run staging:qa` for the test suite.");
}

async function qa() {
  const env = readEnv();
  const qaCredentials = ensureQaCredentials(runtimeRoot);
  await waitFor(env.STAGING_APP_URL, "Beanlog web", 20_000);
  const result = spawnSync("npx", ["playwright", "test", ...process.argv.slice(3)], {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      QA_EXTERNAL_SERVER: "1",
      QA_BASE_URL: env.STAGING_APP_URL,
      QA_API_URL: `http://localhost:${env.STAGING_API_PORT}`,
      QA_SUPABASE_URL: env.STAGING_PUBLIC_SUPABASE_URL,
      QA_PUBLIC_SUPABASE_URL: env.STAGING_PUBLIC_SUPABASE_URL,
      QA_SUPABASE_ANON_KEY: env.STAGING_SUPABASE_ANON_KEY,
      QA_SUPABASE_SERVICE_ROLE_KEY: env.STAGING_SUPABASE_SERVICE_ROLE_KEY,
      QA_PRIMARY_EMAIL: qaCredentials.primary.email,
      QA_PRIMARY_PASSWORD: qaCredentials.primary.password,
      QA_ISOLATION_EMAIL: qaCredentials.isolation.email,
      QA_ISOLATION_PASSWORD: qaCredentials.isolation.password,
    },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function down() {
  if (fs.existsSync(envFile)) compose(["down", "--remove-orphans"]);
  if (fs.existsSync(path.join(runtimeSupabase, "config.toml"))) {
    supabase(["stop", "--project-id", runtime.supabaseProject]);
  }
  console.log("Staging environment stopped. Database volumes were preserved.");
}

function status() {
  if (fs.existsSync(envFile)) compose(["ps"]);
  if (fs.existsSync(path.join(runtimeSupabase, "config.toml"))) {
    const checks = [
      ["App", `http://localhost:${runtime.web}/ko/login`],
      ["API", `http://localhost:${runtime.api}/health`],
      ["Supabase", `http://localhost:${runtime.supabaseApi}/auth/v1/health`],
      ["Studio", `http://localhost:${runtime.supabaseStudio}`],
    ];
    for (const [label, url] of checks) console.log(`${label.padEnd(9)} ${url}`);
  }
}

function logs() {
  compose(["logs", "--tail", "200"]);
}

switch (command) {
  case "up":
    await up();
    break;
  case "qa":
    await qa();
    break;
  case "down":
    down();
    break;
  case "status":
    status();
    break;
  case "logs":
    logs();
    break;
  case "harden":
    await hardenSupabaseBindings();
    console.log("Staging Supabase ports are bound to 127.0.0.1 only.");
    break;
  default:
    console.log("Usage: node scripts/staging.mjs <up|qa|status|logs|down|harden>");
}
