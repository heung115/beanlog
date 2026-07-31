import { execFileSync } from "node:child_process";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { ensureQaCredentials } from "../../scripts/staging-credentials.mjs";
import { deriveStagingRuntime } from "../../scripts/staging-runtime.mjs";

const root = process.cwd();
const gitCommonDir = path.resolve(
  root,
  execFileSync("git", ["rev-parse", "--git-common-dir"], {
    cwd: root,
    encoding: "utf8",
  }).trim()
);
const runtime = deriveStagingRuntime({ root, gitCommonDir });

const hasExternalQaEnvironment = Boolean(
  process.env.QA_SUPABASE_URL &&
    process.env.QA_SUPABASE_ANON_KEY &&
  process.env.QA_SUPABASE_SERVICE_ROLE_KEY
);
const status = hasExternalQaEnvironment
  ? ""
  : (() => {
      return execFileSync(
        "npx",
        ["supabase", "status", "-o", "env", "--workdir", runtime.runtimeRoot],
        { encoding: "utf8" }
      );
    })();

function envValue(name: string): string {
  const match = status.match(new RegExp(`^${name}="?([^"\\n]+)"?$`, "m"));
  if (!match) throw new Error(`Missing ${name} from staging Supabase status`);
  return match[1];
}

export const qaBaseURL = process.env.QA_BASE_URL ?? "http://localhost:3100";
export const qaApiURL = process.env.QA_API_URL;
export const stagingSupabaseUrl = process.env.QA_SUPABASE_URL ?? envValue("API_URL");
// The staging CLI reports 127.0.0.1 while the browser-facing app is configured
// with localhost. Supabase derives its auth cookie name from that hostname, so
// tests must use the same public URL as the app rather than the CLI alias.
export const browserSupabaseUrl = process.env.QA_PUBLIC_SUPABASE_URL ?? (() => {
  if (hasExternalQaEnvironment) return stagingSupabaseUrl;
  const url = new URL(stagingSupabaseUrl);
  url.hostname = new URL(qaBaseURL).hostname;
  return url.toString();
})();
export const stagingAnonKey = process.env.QA_SUPABASE_ANON_KEY ?? envValue("ANON_KEY");
const serviceRoleKey =
  process.env.QA_SUPABASE_SERVICE_ROLE_KEY ?? envValue("SERVICE_ROLE_KEY");
const storedQaCredentials = ensureQaCredentials(runtime.runtimeRoot);

export const admin = createClient(stagingSupabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const qaUser = {
  email: process.env.QA_PRIMARY_EMAIL ?? storedQaCredentials.primary.email,
  password:
    process.env.QA_PRIMARY_PASSWORD ?? storedQaCredentials.primary.password,
};

export const qaOtherUser = {
  email: process.env.QA_ISOLATION_EMAIL ?? storedQaCredentials.isolation.email,
  password:
    process.env.QA_ISOLATION_PASSWORD ?? storedQaCredentials.isolation.password,
};

export async function ensureUser(email: string, password: string) {
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  const existing = listed.users.find((user) => user.email === email);
  // Updating an existing user, even with the same password, revokes all of
  // their refresh tokens. Existing QA users are immutable here so running the
  // test suite cannot log out another browser session.
  if (existing) return existing.id;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Beanlog QA" },
  });
  if (error || !data.user) throw error ?? new Error("QA user creation failed");
  return data.user.id;
}

export async function signIn(email: string, password: string) {
  const client = createClient(stagingSupabaseUrl, stagingAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw error ?? new Error("QA sign-in failed");
  return { client, session: data.session };
}
