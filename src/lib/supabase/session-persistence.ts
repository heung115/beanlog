export const SESSION_ONLY_COOKIE_NAME = "beanmap-session-only";
export const SESSION_ONLY_COOKIE_VALUE = "1";

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

type CookieOptions = {
  expires?: Date;
  maxAge?: number;
  [key: string]: unknown;
};

/**
 * Supabase deliberately writes long-lived auth cookies by default. When the
 * user opts out of "stay signed in", turn those cookies into browser-session
 * cookies while preserving the security and path attributes supplied by SSR.
 */
export function applySessionPersistence<T extends CookieOptions>(
  options: T,
  persistSession: boolean
): T {
  if (persistSession) return options;

  const sessionOptions = { ...options };
  delete sessionOptions.expires;
  delete sessionOptions.maxAge;
  return sessionOptions;
}

export function shouldPersistSession(
  sessionOnlyPreference: string | undefined
) {
  return sessionOnlyPreference !== SESSION_ONLY_COOKIE_VALUE;
}

/**
 * Browsers reject Secure cookies delivered over plain HTTP. Keep production
 * cookies fail-closed everywhere except when production-mode QA explicitly
 * opts into an HTTP loopback URL.
 */
export function shouldUseSecureCookies(
  nodeEnv: string | undefined,
  appUrl: string | undefined,
  allowInsecureLoopbackAuth: string | undefined
) {
  if (nodeEnv !== "production") return false;
  if (allowInsecureLoopbackAuth !== "1" || !appUrl) return true;

  try {
    const url = new URL(appUrl);
    return !(
      url.protocol === "http:" && LOOPBACK_HOSTNAMES.has(url.hostname)
    );
  } catch {
    return true;
  }
}
