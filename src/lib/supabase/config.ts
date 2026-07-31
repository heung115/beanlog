import { getSupabaseCookieName } from "./cookie-name";

const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!publicSupabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");
}

export const supabaseCookieOptions = {
  name: getSupabaseCookieName(publicSupabaseUrl),
} as const;
