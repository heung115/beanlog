import "server-only";

import { readFileSync } from "node:fs";
import { headers } from "next/headers";
import {
  trustedPrivateAdminOrigin,
  type RequestHeaders,
} from "@/lib/security/admin-boundary";

/** Never expose this context through a page prop, action result, or response. */
export function privateAdminContext(requestHeaders: RequestHeaders): { origin: string; secret: string } | null {
  const secretFile = process.env.ADMIN_INGRESS_SECRET_FILE;
  if (!secretFile) return null;
  let secret: string;
  try {
    // This path is trusted deployment configuration. A missing
    // or unreadable secret fails closed in development and production alike.
    secret = readFileSync(secretFile, "utf8").trim();
  } catch {
    return null;
  }
  const origin = trustedPrivateAdminOrigin(requestHeaders, {
    origin: process.env.ADMIN_PRIVATE_ORIGIN,
    secret,
    allowInsecureLoopback: ["1", "true"].includes(process.env.QA_ALLOW_INSECURE_LOOPBACK_AUTH ?? ""),
  });
  return origin && secret ? { origin, secret } : null;
}

export async function getPrivateAdminContext() {
  return privateAdminContext(await headers());
}

/** OAuth must return to the same host that holds its host-only PKCE cookie. */
export async function getRequestAppOrigin(requestHeaders?: RequestHeaders): Promise<string> {
  const privateContext = privateAdminContext(requestHeaders ?? await headers());
  return privateContext?.origin ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";
}
