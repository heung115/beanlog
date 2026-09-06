const localDevelopmentOrigin = "http://localhost:3100";

/** Only real, localized application pages may be post-login destinations. */
export function resolvePostAuthPath(value: unknown): string {
  if (typeof value !== "string" || !/^\/(ko|en)\//.test(value) || value.includes("\\")) {
    return "/explore";
  }
  const destination = new URL(value, localDevelopmentOrigin);
  const allowed = /^\/(ko|en)\/(explore|stats|settings|admin|beans\/(new|[0-9a-f-]{36}(\/edit)?))\/?$/i;
  return destination.origin === localDevelopmentOrigin && allowed.test(destination.pathname)
    ? `${destination.pathname}${destination.search}${destination.hash}`
    : "/explore";
}

export type OAuthFailureKind = "expired" | "cancelled" | "failed";

export function getOAuthFailureKind(error: string | null, code: string | null): OAuthFailureKind {
  if (["bad_oauth_state", "flow_state_expired", "flow_state_not_found"].includes(code ?? "")) return "expired";
  return error === "access_denied" ? "cancelled" : "failed";
}

/** Keep retries localized and never reflect provider descriptions or external destinations. */
export function resolveAuthFailurePath(next: unknown, kind: OAuthFailureKind, preferredLocale?: string): string {
  const destination = resolvePostAuthPath(next);
  const locale = destination.match(/^\/(ko|en)\//)?.[1]
    ?? (preferredLocale === "ko" || preferredLocale === "en" ? preferredLocale : undefined);
  const query = new URLSearchParams({ authError: kind });
  if (destination !== "/explore") query.set("next", destination);
  return `${locale ? `/${locale}` : ""}/login?${query}`;
}

/** Recovery callbacks may only select a localized recovery screen and safe app destination. */
export function resolvePasswordRecoveryPath(next: unknown, preferredLocale?: string, expired = false): string {
  const destination = resolvePostAuthPath(next);
  const locale = preferredLocale === "en" || preferredLocale === "ko" ? preferredLocale
    : destination.match(/^\/(ko|en)\//)?.[1] ?? "ko";
  const query = new URLSearchParams();
  if (expired) query.set("recoveryError", "expired");
  if (destination !== "/explore") query.set("next", destination);
  return `/${locale}/${expired ? "forgot-password" : "reset-password"}${query.size ? `?${query}` : ""}`;
}

function trustedOrigin(configuredAppUrl: string): string {
  try {
    const url = new URL(configuredAppUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return localDevelopmentOrigin;
    }
    return url.origin;
  } catch {
    return localDevelopmentOrigin;
  }
}

export function resolveTrustedAppRedirect(
  requestedPath: string | null,
  configuredAppUrl: string,
  fallbackPath = "/explore"
): URL {
  const origin = trustedOrigin(configuredAppUrl);
  const rawPath = requestedPath ?? fallbackPath;
  if (
    !rawPath.startsWith("/") ||
    rawPath.startsWith("//") ||
    rawPath.includes("\\")
  ) {
    return new URL(fallbackPath, origin);
  }

  const candidate = new URL(rawPath, origin);
  return candidate.origin === origin ? candidate : new URL(fallbackPath, origin);
}
