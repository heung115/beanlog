export const SESSION_ONLY_COOKIE_NAME = "beanmap-session-only";
export const SESSION_ONLY_COOKIE_VALUE = "1";

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
