import { createHmac, randomBytes, randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { LEGAL_EFFECTIVE_DATE } from "../../config/legal-version.ts";
import { createTrustedAuthFetch, verifiedClientIp } from "./auth-client-ip.ts";

export const SIGNUP_CONSENT_VERSION = LEGAL_EFFECTIVE_DATE;
export const SIGNUP_CONSENT_SOURCE = "email-signup";
export const SIGNUP_CONSENT_PATH = "/signup";

export function signupConsentAssertion(email: string, secret: string, now = Date.now(), nonce = randomBytes(32).toString("hex")) {
  if (!/^[a-f0-9]{64}$/.test(secret) || !/^[a-f0-9]{64}$/.test(nonce)) throw new Error("Signup consent configuration unavailable");
  const assertion = {
    email: email.toLowerCase(), terms_version: SIGNUP_CONSENT_VERSION,
    privacy_version: SIGNUP_CONSENT_VERSION, issued_at: Math.floor(now / 1000), nonce,
    source: SIGNUP_CONSENT_SOURCE, path: SIGNUP_CONSENT_PATH,
  };
  const canonical = ["beanmap-signup-v1", assertion.email, assertion.terms_version, assertion.privacy_version,
    assertion.issued_at, assertion.nonce, assertion.source, assertion.path].join("\n");
  return { ...assertion, signature: createHmac("sha256", Buffer.from(secret, "hex")).update(canonical).digest("hex") };
}

type SignupRequest = { email: string; password: string; displayName: string };
type SignupOptions = {
  internalUrl?: string; anonKey?: string; secretFile?: string; ingressSecretFile?: string;
  readSecret?: (path: string) => string; fetchImpl?: typeof fetch;
  clock?: () => number; sleep?: (milliseconds: number) => Promise<void>; jitter?: () => number;
};

/** Stateless signup: Auth response bodies, sessions and cookies never reach the caller. */
export async function controlledSignup(input: SignupRequest, incoming: Headers, options: SignupOptions = {}) {
  const readSecret = options.readSecret ?? ((path: string) => readFileSync(path, "utf8").trim());
  const secretFile = options.secretFile ?? process.env.SIGNUP_CONSENT_SECRET_FILE;
  const ingressSecretFile = options.ingressSecretFile ?? process.env.AUTH_CLIENT_IP_SECRET_FILE;
  const base = new URL(options.internalUrl ?? process.env.SUPABASE_SERVER_URL ?? "https://invalid.invalid");
  const anonKey = options.anonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!secretFile || !ingressSecretFile || !anonKey || base.protocol !== "http:" || base.username || base.password || base.search || base.hash) {
    throw new Error("Signup consent configuration unavailable");
  }
  if (!verifiedClientIp(incoming, readSecret(ingressSecretFile))) throw new Error("Verified signup ingress required");
  const assertion = signupConsentAssertion(input.email, readSecret(secretFile));
  const clock = options.clock ?? (() => performance.now());
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const started = clock();
  const responseDelay = 3000 + (options.jitter ?? (() => randomInt(0, 251)))();
  const transport = createTrustedAuthFetch(incoming, {
    secretFile: ingressSecretFile, internalUrl: base.href, readSecret,
    fetchImpl: options.fetchImpl ?? fetch,
  });
  try {
    const result = await transport(`${base.origin}${base.pathname.replace(/\/$/, "")}/auth/v1/signup`, {
      method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(2500),
      headers: { "content-type": "application/json", apikey: anonKey, authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ email: input.email, password: input.password, data: {
        display_name: input.displayName, beanmap_signup_consent: assertion,
      } }),
    });
    // Even successful responses differ for duplicate/new accounts. Do not parse
    // them, persist returned sessions, reflect status, or forward Set-Cookie.
    await result.body?.cancel();
  } catch {
    // An interrupted upstream request also yields the same public result. The
    // bounded response must not become an account-existence timing oracle.
  }
  await sleep(Math.max(0, responseDelay - (clock() - started)));
  return { success: true as const };
}
