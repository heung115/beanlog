export function getSupabaseCookieName(supabaseUrl: string) {
  const url = new URL(supabaseUrl);
  return `sb-${url.hostname.split(".")[0]}-auth-token`;
}
