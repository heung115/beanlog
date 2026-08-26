import { createHash } from "node:crypto";
import path from "node:path";

const PRIMARY_PORTS = {
  web: 3100,
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
    api: 12000 + slot,
    supabaseApi: supabaseBase + 1,
    supabaseDb: supabaseBase + 2,
    supabaseShadow: supabaseBase,
    supabaseStudio: supabaseBase + 3,
    supabaseMail: supabaseBase + 4,
    supabasePooler: supabaseBase + 9,
  };
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
