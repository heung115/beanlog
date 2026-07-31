const localDevelopmentOrigin = "http://localhost:3100";

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
