import { timingSafeEqual } from "node:crypto";

export const ADMIN_INGRESS_HEADER = "x-beanmap-admin-secret";

export type RequestHeaders = Pick<Headers, "get">;
export type PrivateAdminConfig = {
  origin?: string;
  secret?: string;
  allowInsecureLoopback?: boolean;
};

/** A private origin must be an explicit HTTPS origin, never request input. */
function configuredOrigin(config: PrivateAdminConfig): URL | null {
  if (!config.origin) return null;
  try {
    const url = new URL(config.origin);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback && config.allowInsecureLoopback)) {
      return null;
    }
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return url;
  } catch {
    return null;
  }
}

/** Only a gateway-authenticated request on the configured private host passes. */
export function trustedPrivateAdminOrigin(requestHeaders: RequestHeaders, config: PrivateAdminConfig): string | null {
  const origin = configuredOrigin(config);
  const expected = config.secret;
  const supplied = requestHeaders.get(ADMIN_INGRESS_HEADER);
  if (!origin || !expected || expected.length < 32 || expected.length > 512 || /\s/.test(expected)) return null;
  if (!supplied || supplied.length > 512 || supplied.length !== expected.length) return null;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  if (expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) return null;

  // The private gateway overwrites these values; forwarded chains and any
  // mismatched host are rejected rather than selecting a caller-provided hop.
  if (requestHeaders.get("host") !== origin.host) return null;
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  if (forwardedHost !== null && forwardedHost !== origin.host) return null;
  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  if (forwardedProto !== null && forwardedProto !== origin.protocol.slice(0, -1)) return null;
  const requestOrigin = requestHeaders.get("origin");
  if (requestOrigin !== null && requestOrigin !== origin.origin) return null;
  return origin.origin;
}

export function isAdminPath(pathname: string): boolean {
  return /^\/(?:api\/|(?:(?:ko|en)\/)?)(?:admin)(?:\/|$)/.test(pathname);
}
