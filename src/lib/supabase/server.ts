import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseCookieOptions } from "./config";

async function createServerSupabaseClient(url: string) {
  const cookieStore = await cookies();

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
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server component — safe to ignore
          }
        },
      },
    }
  );
}

export async function createClient() {
  return createServerSupabaseClient(
    process.env.SUPABASE_SERVER_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!
  );
}

export async function createPublicClient() {
  return createServerSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!);
}
