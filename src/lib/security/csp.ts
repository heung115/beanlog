import { randomBytes } from "node:crypto";

export function createScriptNonce(): string {
  return randomBytes(24).toString("base64");
}

export function contentSecurityPolicy(nonce?: string, development = process.env.NODE_ENV === "development"): string {
  if (nonce && !/^[A-Za-z0-9+/]{32}$/.test(nonce)) throw new Error("Invalid script nonce");
  let supabaseOrigin = "'self'";
  try {
    supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:55321").origin;
  } catch { /* Invalid configuration must not expand the policy. */ }
  return [
    "default-src 'self'",
    `script-src 'self'${nonce ? ` 'nonce-${nonce}'` : ""}${development ? " 'unsafe-eval'" : ""}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob:",
    `connect-src 'self' ${supabaseOrigin}${development ? " http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*" : ""}`,
    "object-src 'none'",
    "frame-src 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

/** Preserve locale/cookie overrides while forwarding the trusted rendering policy. */
export function applyNonceHeaders(headers: Headers, nonce: string, policy: string, requestHeaders: Headers): void {
  if (!headers.has("x-middleware-override-headers")) {
    const names: string[] = [];
    requestHeaders.forEach((value, name) => {
      names.push(name);
      headers.set(`x-middleware-request-${name}`, value);
    });
    headers.set("x-middleware-override-headers", names.join(","));
  }
  const overridden = new Set((headers.get("x-middleware-override-headers") ?? "").split(",").filter(Boolean));
  for (const [name, value] of [["x-nonce", nonce], ["content-security-policy", policy]]) {
    overridden.add(name);
    headers.set(`x-middleware-request-${name}`, value);
  }
  headers.set("x-middleware-override-headers", [...overridden].join(","));
  headers.set("Content-Security-Policy", policy);
  // A shared cache must never reuse a document's nonce for another request.
  headers.set("Cache-Control", "no-store");
}
