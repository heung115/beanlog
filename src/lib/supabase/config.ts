import { getSupabaseCookieName } from "./cookie-name";
import { shouldUseSecureCookies } from "./session-persistence";

const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!publicSupabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");
}

export const supabaseCookieOptions = {
  name: getSupabaseCookieName(publicSupabaseUrl),
  httpOnly: true,
  sameSite: "lax",
  secure: shouldUseSecureCookies(
    process.env.NODE_ENV,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.QA_ALLOW_INSECURE_LOOPBACK_AUTH
  ),
} as const;
