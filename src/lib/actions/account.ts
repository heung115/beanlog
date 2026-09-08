"use server";

import { cookies } from "next/headers";
import { redirect, RedirectType } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api/client";
import { clearSessionCookies } from "@/lib/supabase/server";
import { shouldUseSecureCookies } from "@/lib/supabase/session-persistence";

const CHALLENGE_COOKIE = "beanmap-account-deletion";
export type AccountDeletionError = "invalid_code" | "challenge_expired" | "rate_limited" | "session_expired" | "temporarily_unavailable" | "email_unavailable";
const knownErrors = new Set<AccountDeletionError>([
  "invalid_code", "challenge_expired", "rate_limited", "session_expired", "temporarily_unavailable", "email_unavailable",
]);

function failure(error: unknown): { error: AccountDeletionError } {
  if (error instanceof ApiError) {
    if (knownErrors.has(error.message as AccountDeletionError)) return { error: error.message as AccountDeletionError };
    if (error.status === 401) return { error: "session_expired" };
    if (error.status === 429) return { error: "rate_limited" };
  }
  return { error: "temporarily_unavailable" };
}

export async function requestAccountDeletionCode(): Promise<{ sent: true } | { error: AccountDeletionError }> {
  try {
    // The API obtains the verified account email itself and binds the challenge
    // to the exact authenticated session. No caller-supplied email is accepted.
    const result = await apiFetch<{ challenge: string; expires_in: number }>("/api/account/deletion-challenge", { method: "POST", body: {} });
    if (!/^[a-f0-9]{64}$/.test(result.challenge) || result.expires_in !== 300) return { error: "temporarily_unavailable" };
    (await cookies()).set(CHALLENGE_COOKIE, result.challenge, {
      httpOnly: true, sameSite: "strict", path: "/", maxAge: 300,
      secure: shouldUseSecureCookies(process.env.NODE_ENV, process.env.NEXT_PUBLIC_APP_URL, process.env.QA_ALLOW_INSECURE_LOOPBACK_AUTH),
    });
    return { sent: true };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteAccount(locale = "ko", code = ""): Promise<{ error: AccountDeletionError }> {
  if (typeof code !== "string" || !/^\d{6,10}$/.test(code)) return { error: "invalid_code" };
  const cookieStore = await cookies();
  const challenge = cookieStore.get(CHALLENGE_COOKIE)?.value;
  if (!challenge || !/^[a-f0-9]{64}$/.test(challenge)) return { error: "challenge_expired" };
  try {
    const result = await apiFetch<{ success: boolean }>("/api/account/delete", { method: "POST", body: { challenge, code } });
    if (result.success !== true) return { error: "temporarily_unavailable" };
  } catch (error) {
    return failure(error);
  }
  // The API has committed deletion. A subsequent remote logout is neither
  // needed nor allowed to turn completed deletion into a retryable failure.
  cookieStore.delete(CHALLENGE_COOKIE);
  await clearSessionCookies();
  redirect(`/${locale === "en" ? "en" : "ko"}?accountDeleted=1`, RedirectType.replace);
}
