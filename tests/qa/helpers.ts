import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const hasExternalQaEnvironment = Boolean(
  process.env.QA_SUPABASE_URL &&
    process.env.QA_SUPABASE_ANON_KEY &&
    process.env.QA_SUPABASE_SERVICE_ROLE_KEY
);
const status = hasExternalQaEnvironment
  ? ""
  : execFileSync("npx", ["supabase", "status", "-o", "env"], {
      encoding: "utf8",
    });

function envValue(name: string): string {
  const match = status.match(new RegExp(`^${name}="?([^"\\n]+)"?$`, "m"));
  if (!match) throw new Error(`Missing ${name} from local Supabase status`);
  return match[1];
}

export const qaBaseURL = process.env.QA_BASE_URL ?? "http://localhost:3000";
export const qaApiURL = process.env.QA_API_URL;
export const localSupabaseUrl = process.env.QA_SUPABASE_URL ?? envValue("API_URL");
export const localAnonKey = process.env.QA_SUPABASE_ANON_KEY ?? envValue("ANON_KEY");
const serviceRoleKey =
  process.env.QA_SUPABASE_SERVICE_ROLE_KEY ?? envValue("SERVICE_ROLE_KEY");

export const admin = createClient(localSupabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const qaUser = {
  email: "beanlog-qa-primary@local.test",
  password: "Qa-Local-Only-2026!",
};

export const qaOtherUser = {
  email: "beanlog-qa-isolation@local.test",
  password: "Qa-Isolation-Only-2026!",
};

export async function ensureUser(email: string, password: string) {
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  const existing = listed.users.find((user) => user.email === email);
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) throw error;
    return existing.id;
  }

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
  const client = createClient(localSupabaseUrl, localAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw error ?? new Error("QA sign-in failed");
  return { client, session: data.session };
}
