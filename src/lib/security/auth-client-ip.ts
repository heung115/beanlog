import { timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { isIP } from "node:net";

export const CLIENT_IP_HEADER = "x-beanmap-client-ip";
export const CLIENT_PROOF_HEADER = "x-beanmap-client-proof";
export const AUTH_CLIENT_IP_HEADER = "x-beanmap-auth-client-ip";

type TrustedClientOptions = {
  secretFile?: string;
  internalUrl?: string;
  readSecret?: (file: string) => string;
  fetchImpl?: typeof fetch;
};

export function canonicalClientIp(value: string | null): string | null {
  // A single address only: no forwarded lists, ports, brackets or zone IDs.
  if (!value || value !== value.trim() || /[\s,%\[\]]/.test(value) || !isIP(value)) return null;
  if (isIP(value) === 4) return value;
  return new URL(`http://[${value}]/`).hostname.slice(1, -1);
}

export function verifiedClientIp(requestHeaders: Headers, secret: string): string | null {
  const proof = requestHeaders.get(CLIENT_PROOF_HEADER);
  if (!/^[a-f0-9]{64}$/.test(secret) || !proof || !/^[a-f0-9]{64}$/.test(proof)) return null;
  if (!timingSafeEqual(Buffer.from(secret), Buffer.from(proof))) return null;
  return canonicalClientIp(requestHeaders.get(CLIENT_IP_HEADER));
}

/** Only Caddy-proven addresses may affect explicitly allowed internal Auth requests. */
export function createTrustedAuthFetch(
  requestHeaders: Headers,
  options: TrustedClientOptions = {},
): typeof fetch {
  const fetchImpl = options.fetchImpl ?? fetch;
  const secretFile = options.secretFile ?? process.env.AUTH_CLIENT_IP_SECRET_FILE;
  const internalUrl = options.internalUrl ?? process.env.SUPABASE_SERVER_URL;
  let clientIp: string | null = null;
  let authEndpoint: URL | null = null;
  try {
    if (secretFile && internalUrl) {
      const secret = (options.readSecret ?? ((file) => readFileSync(file, "utf8")))(secretFile).trim();
      clientIp = verifiedClientIp(requestHeaders, secret);
      const base = new URL(internalUrl);
      // Deployment supplies the private gateway address; credentials and URL
      // suffixes would make the endpoint ambiguous and must disable forwarding.
      if (base.protocol === "http:" && !base.username && !base.password && !base.search && !base.hash) {
        authEndpoint = new URL(`${base.origin}${base.pathname.replace(/\/$/, "")}/auth/v1/`);
      }
    }
  } catch {
    // A missing/unreadable secret retains the original bounded shared bucket.
  }

  return async (input, init) => {
    const request = input instanceof Request ? input : null;
    const target = new URL(request?.url ?? String(input));
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
    const headers = new Headers(init?.headers ?? request?.headers);
    // The proof never leaves Next. Supplied bucket headers are always removed,
    // including from administrator endpoints and public/external destinations.
    headers.delete(CLIENT_PROOF_HEADER);
    headers.delete(CLIENT_IP_HEADER);
    headers.delete(AUTH_CLIENT_IP_HEADER);
    headers.delete("x-beanmap-auth-rate-identity");
    const endpoint = authEndpoint && target.origin === authEndpoint.origin
      && target.pathname.startsWith(authEndpoint.pathname)
      ? target.pathname.slice(authEndpoint.pathname.length) : null;
    const allowed = endpoint === "user" ? ["GET", "PUT", "PATCH"]
      : ["token", "signup", "recover", "otp", "verify", "logout", "resend", "reauthenticate"].includes(endpoint ?? "")
        ? ["POST"] : [];
    if (clientIp && allowed.includes(method) && !target.hash && !target.username && !target.password) {
      headers.set(AUTH_CLIENT_IP_HEADER, clientIp);
    }
    return fetchImpl(input, { ...init, headers });
  };
}
