import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { readFileSync } from "node:fs";
import { signupConsentAssertion } from "../../src/lib/security/signup-consent";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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

export const qaEmptyUser = {
  email: process.env.QA_EMPTY_EMAIL ?? storedQaCredentials.empty.email,
  password: process.env.QA_EMPTY_PASSWORD ?? storedQaCredentials.empty.password,
};

if (
  !qaEmptyUser.email.startsWith("beanmap-qa-empty-") ||
  !qaEmptyUser.email.endsWith("@local.test") ||
  qaEmptyUser.password.length < 24
) {
  throw new Error("The empty-state QA account must use dedicated generated credentials.");
}

export async function ensureUser(email: string, password: string) {
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  const existing = listed.users.find((user) => user.email === email);
  // Updating an existing user, even with the same password, revokes all of
  // their refresh tokens. Existing QA users are immutable here so running the
  // test suite cannot log out another browser session.
  if (existing) return existing.id;

  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(stagingSupabaseUrl).hostname)
    || !/^beanmap-qa-[a-z0-9-]+@local\.test$/.test(email)) {
    throw new Error("Signed QA provisioning requires a local disposable fixture");
  }
  const secretFile = process.env.QA_SIGNUP_CONSENT_SECRET_FILE ?? path.join(runtime.runtimeRoot, "signup-consent.secret");
  const consent = signupConsentAssertion(email, readFileSync(secretFile, "utf8").trim());
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "beanmap QA", beanmap_signup_consent: consent },
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

// Legacy fixtures intentionally bypass HTTP normalization, but only inside the
// isolated local database using the same session-bound role as the Go API.
export async function localFixtureRpc(
  client: SupabaseClient,
  name: "create_bean_record" | "update_bean_record" | "delete_bean_record",
  parameters: Record<string, unknown>,
  legacyColumns?: { roastery: string }
): Promise<{ data: string | boolean | null; error: { code: string } | null }> {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(stagingSupabaseUrl).hostname)) {
    throw new Error("Raw legacy fixtures require isolated loopback staging");
  }
  const { data: { session } } = await client.auth.getSession();
  if (!session || !session.user.email?.startsWith("beanmap-qa-") || !session.user.email.endsWith("@local.test")) {
    throw new Error("Raw legacy fixture account guard rejected");
  }
  const container = process.env.QA_DB_CONTAINER ?? (hasExternalQaEnvironment ? "" : `supabase_db_${runtime.supabaseProject}`);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/.test(container)) throw new Error("Explicit local QA_DB_CONTAINER is required");
  const claims = JSON.parse(Buffer.from(session.access_token.split(".")[1], "base64url").toString());
  if (claims.sub !== session.user.id || typeof claims.session_id !== "string") throw new Error("Fixture session claims missing");
  const literal = (value: unknown) => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
  const args = name === "delete_bean_record"
    ? `${literal(parameters.p_id)} #>> '{}'`
    : [literal(parameters.p_bean), literal(parameters.p_tags ?? []), literal(parameters.p_components ?? [])].join(", ");
  const invocation = name === "delete_bean_record"
    ? `public.delete_bean_record((${args})::uuid)`
    : name === "update_bean_record"
      ? `public.update_bean_record((${literal(parameters.p_id)} #>> '{}')::uuid, ${args})`
      : `public.create_bean_record(${args})`;
  if (legacyColumns && (name !== "create_bean_record" || Object.keys(legacyColumns).some(key => key !== "roastery")
    || typeof legacyColumns.roastery !== "string" || legacyColumns.roastery.length > 200)) {
    throw new Error("Legacy storage fixture fields rejected");
  }
  // Reproduce historic whitespace only after a valid current-session creation.
  // The private repair targets that returned row and its exact disposable owner.
  const operation = legacyColumns
    ? `DO $fixture$ BEGIN PERFORM set_config('beanmap.qa_fixture_id', (${invocation})::text, true); END $fixture$;
       RESET ROLE;
       UPDATE public.beans SET roastery=(${literal(legacyColumns.roastery)} #>> '{}')
         WHERE id=current_setting('beanmap.qa_fixture_id')::uuid AND user_id=(${literal(session.user.id)} #>> '{}')::uuid;
       SELECT to_json(current_setting('beanmap.qa_fixture_id'));`
    : `SELECT to_json(${invocation});`;
  const sql = `BEGIN; SET LOCAL ROLE beanmap_api_runtime; SET LOCAL request.jwt.claims = '${JSON.stringify(claims).replaceAll("'", "''")}'; ${operation} COMMIT;`;
  try {
    const output = execFileSync("docker", ["exec", "-i", container, "psql", "-U", "supabase_admin", "-d", "postgres", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"], {
      input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 30000,
    });
    return { data: JSON.parse(output.trim()), error: null };
  } catch (error) {
    const stderr = String((error as { stderr?: string }).stderr ?? "");
    return { data: null, error: { code: stderr.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1] ?? "FIXTURE_FAILURE" } };
  }
}

export async function qaAuthenticatedApi(client: SupabaseClient, path: string, method: string, body?: Record<string, unknown>) {
  if (!qaApiURL) throw new Error("QA_API_URL is required for authenticated fixture mutations");
  const { data: { session } } = await client.auth.getSession();
  if (!session) throw new Error("QA fixture session missing");
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`${qaApiURL}${path}`, {
      method, headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000),
    });
    // Fixture preparation obeys the real API budget. Behavioral security tests
    // use raw requests so retries cannot conceal a rate-limit regression.
    if (response.status === 429 && attempt < 2) {
      await response.body?.cancel();
      const delay = Number(response.headers.get("retry-after"));
      await new Promise(resolve => setTimeout(resolve, Math.min(30, Math.max(1, Number.isFinite(delay) ? delay : 10)) * 1000));
      continue;
    }
    if (!response.ok) throw new Error(`QA fixture API failed (${response.status})`);
    return response.json();
  }
  throw new Error("QA fixture API retry budget exhausted");
}

export async function qaBeanApi(client: SupabaseClient, path: string, method: string, body?: Record<string, unknown>) {
  return qaAuthenticatedApi(client, `/api/beans${path}`, method, body);
}


/** Synthetic pending-provider state; no external OAuth exchange or consent event. */
export function localPendingOAuthUser(email: string, password: string, provider: "google" | "kakao"): string {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(stagingSupabaseUrl).hostname)
    || !/^beanmap-qa-oauth-[a-f0-9-]+@local\.test$/.test(email)
    || !/^[a-f0-9]{48}$/.test(password) || !["google", "kakao"].includes(provider)) {
    throw new Error("Synthetic OAuth fixture guard rejected");
  }
  const container = process.env.QA_DB_CONTAINER ?? (hasExternalQaEnvironment ? "" : `supabase_db_${runtime.supabaseProject}`);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/.test(container)) throw new Error("Explicit local QA_DB_CONTAINER is required");
  const id = randomUUID();
  const payload = JSON.stringify({ id, email, password, provider }).replaceAll("'", "''");
  const sql = `BEGIN;
    DO $fixture$ DECLARE v jsonb := '${payload}'::jsonb; BEGIN
      INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
      VALUES((v->>'id')::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',v->>'email',extensions.crypt(v->>'password',extensions.gen_salt('bf')),now(),'','','','',jsonb_build_object('provider',v->>'provider','providers',jsonb_build_array(v->>'provider')),'{"display_name":"Synthetic local OAuth QA"}',now(),now());
      INSERT INTO auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at)
      VALUES(v->>'id',(v->>'id')::uuid,jsonb_build_object('sub',v->>'id','email',v->>'email','email_verified',true),'email',now(),now());
      INSERT INTO beanmap_signup.pending_oauth_consent(user_id,provider) VALUES((v->>'id')::uuid,v->>'provider');
      UPDATE auth.users SET raw_app_meta_data=raw_app_meta_data||'{"beanmap_pending_consent":true}'::jsonb WHERE id=(v->>'id')::uuid;
      IF EXISTS(SELECT 1 FROM beanmap_signup.consent_events WHERE user_id=(v->>'id')::uuid) THEN RAISE EXCEPTION 'Unexpected synthetic consent event'; END IF;
    END $fixture$;
    COMMIT;`;
  try {
    execFileSync("docker", ["exec", "-i", container, "psql", "-U", "supabase_admin", "-d", "postgres", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"],
      { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 30000 });
  } catch {
    throw new Error("Local pending-provider fixture creation failed");
  }
  return id;
}
