import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { shouldUseSecureCookies } from "../supabase/session-persistence";
import { RecoveryProofStore, RECOVERY_PROOF_TTL_SECONDS, verifiedRecoveryIdentity } from "./recovery-proof-store";

const COOKIE_NAME = "beanmap-recovery-proof";
const store = new RecoveryProofStore();

export async function issuePasswordRecoveryProof(supabase: SupabaseClient, accessToken: string, verifiedCallback: "pkce" | "recovery-otp"): Promise<boolean> {
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return false;
  // Older Auth versions label verifyOtp recovery sessions as generic OTP.
  // Only a successful verifyOtp(type: recovery) callback may use this branch.
  const identity = verifiedRecoveryIdentity(accessToken, data.user.id, verifiedCallback !== "recovery-otp");
  if (!identity) return false;
  const cookieStore = await cookies();
  const token = await store.issue(identity);
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: RECOVERY_PROOF_TTL_SECONDS,
    secure: shouldUseSecureCookies(process.env.NODE_ENV, process.env.NEXT_PUBLIC_APP_URL, process.env.QA_ALLOW_INSECURE_LOOPBACK_AUTH),
  });
  return true;
}

export async function checkPasswordRecoveryProof(supabase: SupabaseClient, userId: string, consume = false): Promise<boolean> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) return false;
  // Validate the exact token whose session_id is used, including after refresh.
  const verified = await supabase.auth.getUser(session.access_token);
  if (verified.error || verified.data.user?.id !== userId) return false;
  const identity = verifiedRecoveryIdentity(session.access_token, userId);
  if (!identity) return false;
  const cookieStore = await cookies();
  const valid = await store.check(cookieStore.get(COOKIE_NAME)?.value, identity, consume);
  // Retain the inert cookie until expiry: deleting it here makes Next re-render
  // the protected page before a rejected update can show its recovery guidance.
  // Replay prevention is the atomic server-side consumed marker.
  return valid;
}
