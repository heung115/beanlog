import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const runtimeRoot = path.join(root, ".staging");
const runtimeSupabase = path.join(runtimeRoot, "supabase");
const envFile = path.join(runtimeRoot, "docker.env");
const composeFile = path.join(root, "docker-compose.staging.yml");
const command = process.argv[2] ?? "help";

function run(bin, args, options = {}) {
  return execFileSync(bin, args, {
    cwd: root,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "inherit"] : "inherit",
    env: { ...process.env, COMPOSE_PROGRESS: "plain", ...(options.env ?? {}) },
    ...options,
  });
}

function compose(args, options = {}) {
  if (!fs.existsSync(envFile)) {
    throw new Error("Staging environment is missing. Run `npm run staging:up` first.");
  }
  return run(
    "docker",
    ["compose", "--env-file", envFile, "-f", composeFile, ...args],
    options
  );
}

function copyRuntimeConfig() {
  fs.mkdirSync(runtimeSupabase, { recursive: true });
  fs.cpSync(path.join(root, "staging", "supabase", "config.toml"), path.join(runtimeSupabase, "config.toml"));
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
    "supabase_kong_beanlog-staging",
    "supabase_db_beanlog-staging",
    "supabase_studio_beanlog-staging",
    "supabase_inbucket_beanlog-staging",
  ]) {
    await bindContainerPortsToLoopback(name);
  }
}

function writeEnvironment(status) {
  const values = {
    STAGING_WEB_PORT: "3100",
    STAGING_API_PORT: "8180",
    STAGING_APP_URL: "http://localhost:3100",
    STAGING_PUBLIC_SUPABASE_URL: "http://localhost:55321",
    STAGING_INTERNAL_SUPABASE_URL: "http://kong:8000",
    STAGING_SUPABASE_ANON_KEY: status.ANON_KEY,
    STAGING_SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    STAGING_DATABASE_URL:
      "postgresql://postgres:postgres@db:5432/postgres?sslmode=disable",
    STAGING_JWKS_URL: "http://kong:8000/auth/v1/.well-known/jwks.json",
  };
  fs.mkdirSync(runtimeRoot, { recursive: true });
  fs.writeFileSync(
    envFile,
    `${Object.entries(values)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")}\n`,
    { mode: 0o600 }
  );
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
  writeEnvironment(status);
  await hardenSupabaseBindings();
  compose(["up", "-d", "--build", "--remove-orphans"]);
  await waitFor("http://localhost:3100/ko/login", "Beanlog web");
  await waitFor("http://localhost:8180/health", "Beanlog API");
  console.log("\nInternal staging is ready:");
  console.log("  App:      http://localhost:3100");
  console.log("  API:      http://localhost:8180/health");
  console.log("  Supabase: http://localhost:55321");
  console.log("  Studio:   http://localhost:55323");
  console.log("Run `npm run staging:qa` for the production-container test suite.");
}

async function qa() {
  const env = readEnv();
  await waitFor(env.STAGING_APP_URL, "Beanlog web", 20_000);
  const result = spawnSync("npx", ["playwright", "test"], {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      QA_EXTERNAL_SERVER: "1",
      QA_BASE_URL: env.STAGING_APP_URL,
      QA_SUPABASE_URL: env.STAGING_PUBLIC_SUPABASE_URL,
      QA_SUPABASE_ANON_KEY: env.STAGING_SUPABASE_ANON_KEY,
      QA_SUPABASE_SERVICE_ROLE_KEY: env.STAGING_SUPABASE_SERVICE_ROLE_KEY,
    },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function down() {
  if (fs.existsSync(envFile)) compose(["down", "--remove-orphans"]);
  if (fs.existsSync(path.join(runtimeSupabase, "config.toml"))) {
    supabase(["stop", "--project-id", "beanlog-staging"]);
  }
  console.log("Staging stopped. Database volumes were preserved.");
}

function status() {
  if (fs.existsSync(envFile)) compose(["ps"]);
  if (fs.existsSync(path.join(runtimeSupabase, "config.toml"))) {
    const checks = [
      ["App", "http://localhost:3100/ko/login"],
      ["API", "http://localhost:8180/health"],
      ["Supabase", "http://localhost:55321/auth/v1/health"],
      ["Studio", "http://localhost:55323"],
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
    console.log("Supabase staging ports are bound to 127.0.0.1 only.");
    break;
  default:
    console.log("Usage: node scripts/staging.mjs <up|qa|status|logs|down|harden>");
}
