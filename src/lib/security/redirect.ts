const localDevelopmentOrigin = "http://localhost:3100";

/** Only real, localized application pages may be post-login destinations. */
export function resolvePostAuthPath(value: unknown): string {
  if (typeof value !== "string" || !/^\/(ko|en)\//.test(value) || value.includes("\\")) {
    return "/explore";
  }
  const destination = new URL(value, localDevelopmentOrigin);
  const allowed = /^\/(ko|en)\/(explore|stats|settings|beans\/(new|[0-9a-f-]{36}(\/edit)?))\/?$/i;
  return destination.origin === localDevelopmentOrigin && allowed.test(destination.pathname)
    ? `${destination.pathname}${destination.search}${destination.hash}`
    : "/explore";
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
