import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseCookieOptions } from "./config";
import {
  applySessionPersistence,
  SESSION_ONLY_COOKIE_NAME,
  SESSION_ONLY_COOKIE_VALUE,
  shouldPersistSession,
  shouldUseSecureCookies,
} from "./session-persistence";

type ClientOptions = {
  persistSession?: boolean;
};

async function createServerSupabaseClient(url: string, options?: ClientOptions) {
  const cookieStore = await cookies();
  const persistSession =
    options?.persistSession ??
    shouldPersistSession(cookieStore.get(SESSION_ONLY_COOKIE_NAME)?.value);

  return createServerClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: supabaseCookieOptions,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(
                name,
                value,
                applySessionPersistence(options, persistSession)
              )
            );
          } catch {
            // Server component — safe to ignore
          }
        },
      },
    }
  );
}

export async function createClient(options?: ClientOptions) {
  return createServerSupabaseClient(
    process.env.SUPABASE_SERVER_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    options
  );
}

export async function createPublicClient(options?: ClientOptions) {
  return createServerSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    options
  );
}

export async function setSessionPersistencePreference(
  persistSession: boolean
) {
  const cookieStore = await cookies();

  if (persistSession) {
    cookieStore.delete(SESSION_ONLY_COOKIE_NAME);
    return;
  }

  cookieStore.set(SESSION_ONLY_COOKIE_NAME, SESSION_ONLY_COOKIE_VALUE, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: shouldUseSecureCookies(
      process.env.NODE_ENV,
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.QA_ALLOW_INSECURE_LOOPBACK_AUTH
    ),
  });
}
