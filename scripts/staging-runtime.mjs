import { createHash } from "node:crypto";
import path from "node:path";

const PRIMARY_PORTS = {
  web: 3100,
  productionQaWeb: 4100,
  qaLock: 5100,
  api: 8180,
  supabaseApi: 55321,
  supabaseDb: 55322,
  supabaseShadow: 55320,
  supabaseStudio: 55323,
  supabaseMail: 55324,
  supabasePooler: 55329,
};

function shortHash(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 8);
}

function safeSlug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20) || "worktree";
}

export function deriveStagingRuntime({ root, gitCommonDir }) {
  const resolvedRoot = path.resolve(root);
  const primaryRoot = path.dirname(path.resolve(gitCommonDir));
  const isPrimary = resolvedRoot === primaryRoot;

  if (isPrimary) {
    return {
      id: "primary",
      isPrimary,
      runtimeRoot: path.join(resolvedRoot, ".staging"),
      composeProject: "beanmap-staging",
      supabaseProject: "beanmap-staging",
      ...PRIMARY_PORTS,
    };
  }

  const hash = shortHash(resolvedRoot);
  const slot = Number.parseInt(hash.slice(0, 6), 16) % 1000;
  const id = `${safeSlug(path.basename(path.dirname(resolvedRoot)))}-${hash}`;
  const supabaseBase = 30000 + slot * 20;

  return {
    id,
    isPrimary,
    runtimeRoot: path.join(resolvedRoot, ".staging", id),
    composeProject: `beanmap-staging-${id}`,
    supabaseProject: `beanmap-staging-${id}`,
    web: 10000 + slot,
    productionQaWeb: 11000 + slot,
    api: 12000 + slot,
    qaLock: 13000 + slot,
    supabaseApi: supabaseBase + 1,
    supabaseDb: supabaseBase + 2,
    supabaseShadow: supabaseBase,
    supabaseStudio: supabaseBase + 3,
    supabaseMail: supabaseBase + 4,
    supabasePooler: supabaseBase + 9,
  };
}

export function deriveProductionQaConfig({
  runtime,
  stagingEnv,
  serverActionsEncryptionKey,
  baseEnv = {},
}) {
  const requiredValues = [
    "STAGING_PUBLIC_SUPABASE_URL",
    "STAGING_SUPABASE_ANON_KEY",
    "STAGING_SUPABASE_SERVICE_ROLE_KEY",
    "STAGING_API_PORT",
  ];
  for (const name of requiredValues) {
    if (!stagingEnv[name]) {
      throw new Error(`Missing ${name} from the staging environment`);
    }
  }
  if (!serverActionsEncryptionKey) {
    throw new Error("Missing production QA server actions encryption key");
  }

  const publicSupabaseUrl = new URL(stagingEnv.STAGING_PUBLIC_SUPABASE_URL);
  const serverSupabaseUrl = new URL(publicSupabaseUrl);
  serverSupabaseUrl.hostname = "127.0.0.1";

  const appUrl = `http://localhost:${runtime.productionQaWeb}`;
  const apiUrl = `http://127.0.0.1:${stagingEnv.STAGING_API_PORT}`;
  const deploymentId = `${stagingEnv.STAGING_DEPLOYMENT_ID ?? runtime.composeProject}-production-qa`;
  const appBaseEnv = Object.fromEntries(
    Object.entries(baseEnv).filter(
      ([name]) =>
        !name.startsWith("QA_") &&
        !name.startsWith("STAGING_") &&
        name !== "DATABASE_URL" &&
        name !== "SUPABASE_SERVICE_ROLE_KEY"
    )
  );

  return {
    appUrl,
    apiUrl,
    publicSupabaseUrl: publicSupabaseUrl.origin,
    processEnv: {
      ...appBaseEnv,
      NODE_ENV: "production",
      NEXT_PUBLIC_SUPABASE_URL: publicSupabaseUrl.origin,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: stagingEnv.STAGING_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_APP_URL: appUrl,
      SUPABASE_SERVER_URL: serverSupabaseUrl.origin,
      GO_API_URL: apiUrl,
      NEXT_DEPLOYMENT_ID: deploymentId,
      NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: serverActionsEncryptionKey,
      QA_ALLOW_INSECURE_LOOPBACK_AUTH: "1",
      HOSTNAME: "127.0.0.1",
      PORT: String(runtime.productionQaWeb),
    },
  };
}

export function assertProductionQaNodeVersion(version) {
  const [major, minor] = version.split(".").map(Number);
  if (major !== 22 || minor < 18) {
    throw new Error(
      `Production QA requires Node.js >=22.18 <23; current version is ${version}`
    );
  }
}

export function productionQaBuildArguments({ nextCli, root, nodeModulesRealPath }) {
  const relativeNodeModulesPath = path.relative(
    path.resolve(root),
    path.resolve(nodeModulesRealPath)
  );
  const isOutsideWorktree =
    relativeNodeModulesPath === ".." ||
    relativeNodeModulesPath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeNodeModulesPath);
  return [nextCli, "build", ...(isOutsideWorktree ? ["--webpack"] : [])];
}

export function renderSupabaseConfig(template, runtime) {
  const replacements = new Map([
    [55321, runtime.supabaseApi],
    [55322, runtime.supabaseDb],
    [55320, runtime.supabaseShadow],
    [55323, runtime.supabaseStudio],
    [55324, runtime.supabaseMail],
    [55329, runtime.supabasePooler],
  ]);

  let rendered = template.replace(
    /^project_id = ".*"$/m,
    `project_id = "${runtime.supabaseProject}"`
  );
  for (const [source, target] of replacements) {
    rendered = rendered.replaceAll(String(source), String(target));
  }

  const appUrl = `http://localhost:${runtime.web}`;
  return rendered.replaceAll("http://localhost:3100", appUrl);
}
