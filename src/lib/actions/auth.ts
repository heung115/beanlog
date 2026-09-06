"use server";

import {
  createClient,
  createPublicClient,
  setSessionPersistencePreference,
  clearSessionCookies,
} from "@/lib/supabase/server";
import { redirect, RedirectType } from "next/navigation";
import { z } from "zod";
import { resolvePostAuthPath } from "@/lib/security/redirect";
import { getRequestAppOrigin } from "@/lib/admin/private-access";
import { validateRegistrationFields, validateNewPassword, type RegistrationField } from "@/lib/validation/auth";
import { isTemporaryAuthError } from "@/lib/supabase/auth-recovery";

export type SignInState = {
  error?: "invalid_credentials" | "email_not_confirmed" | "rate_limited" | "temporarily_unavailable";
};

export type SignUpState = {
  error?: "display_name_required" | "password_length" | "password_mismatch" | "agreement_required" | "signup_failed" | "temporarily_unavailable";
  field?: RegistrationField;
};

export type PasswordResetState = {
  error?: "invalid_email" | "temporarily_unavailable" | "password_length" | "password_mismatch" | "expired" | "same_password";
  field?: "email" | "password" | "passwordConfirm";
  sent?: boolean;
};

function authFormDestination(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "ko";
  const next = formData.get("draft") === "1" ? `/${locale}/beans/new?draft=1` : resolvePostAuthPath(formData.get("next"));
  const query = new URLSearchParams();
  if (next !== "/explore") query.set("next", next);
  return { locale, next, query };
}

function signInError(error: unknown): SignInState {
  if (error && typeof error === "object") {
    const failure = error as { code?: string; status?: number; name?: string };
    if (failure.status === 429 || failure.code === "over_request_rate_limit") {
      return { error: "rate_limited" };
    }
    if ((failure.status ?? 0) >= 500 || failure.name === "AuthRetryableFetchError") {
      return { error: "temporarily_unavailable" };
    }
    if (failure.code === "email_not_confirmed" || failure.code === "invalid_credentials") {
      return { error: failure.code };
    }
  }
  // A failed request does not establish that the supplied password is wrong.
  return { error: "temporarily_unavailable" };
}

const signInSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(1024),
});

const signUpSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(6).max(128),
  displayName: z.string().trim().min(1).max(50),
  acceptedTerms: z.literal(true),
});

export async function signUp(
  email: string,
  password: string,
  displayName: string,
  acceptedTerms: boolean
) {
  const parsed = signUpSchema.safeParse({ email, password, displayName, acceptedTerms });
  if (!parsed.success) return { error: "Invalid signup data" };

  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
    },
  });

  if (error) {
    return { error: "Unable to create account" };
  }

  // The profiles row is created by the handle_new_user database trigger from
  // raw_user_meta_data.display_name; no separate data write is needed here.
  return { success: true };
}

export async function signUpAction(_previousState: SignUpState, formData: FormData): Promise<SignUpState> {
  const issue = validateRegistrationFields(formData);
  if (issue) return issue;
  let result;
  try {
    result = await signUp(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""), String(formData.get("displayName") ?? ""), formData.get("acceptedTerms") === "on");
  } catch {
    return { error: "temporarily_unavailable" };
  }
  if (result.error) return { error: "signup_failed" };
  const { locale, query } = authFormDestination(formData);
  if (formData.get("draft") === "1") {
    query.delete("next");
    query.set("draft", "1");
  }
  redirect(`/${locale}/signup/check-email${query.size ? `?${query}` : ""}`);
}

export async function requestPasswordResetAction(_previousState: PasswordResetState, formData: FormData): Promise<PasswordResetState> {
  const email = z.string().trim().email().max(320).safeParse(formData.get("email"));
  if (!email.success) return { error: "invalid_email", field: "email" };
  const { locale, next } = authFormDestination(formData);
  try {
    const supabase = await createClient({ persistSession: false });
    const callback = new URL("/api/auth/callback", await getRequestAppOrigin());
    callback.searchParams.set("mode", "recovery");
    callback.searchParams.set("locale", locale);
    if (next !== "/explore") callback.searchParams.set("next", next);
    const { error } = await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: callback.toString() });
    // Account-specific errors and per-address throttling must not reveal whether
    // an address is registered. Only a general service outage is distinguished.
    if (error && ((error.status ?? 0) >= 500 || error.name === "AuthRetryableFetchError")) {
      return { error: "temporarily_unavailable" };
    }
    return { sent: true };
  } catch {
    return { error: "temporarily_unavailable" };
  }
}

export async function updatePasswordAction(_previousState: PasswordResetState, formData: FormData): Promise<PasswordResetState> {
  const issue = validateNewPassword(formData);
  if (issue) return issue;
  const { locale, query } = authFormDestination(formData);
  try {
    const supabase = await createClient({ persistSession: false });
    // getUser verifies the cookie-backed session with Auth; getSession alone
    // would only trust the caller's locally stored claims.
    const { data, error: identityError } = await supabase.auth.getUser();
    if (identityError || !data.user) {
      return { error: isTemporaryAuthError(identityError) ? "temporarily_unavailable" : "expired" };
    }
    const { error } = await supabase.auth.updateUser({ password: String(formData.get("password")) });
    if (error) return { error: error.code === "same_password" ? "same_password" : "temporarily_unavailable", field: error.code === "same_password" ? "password" : undefined };
    // The password has already changed. A remote logout failure must not tell
    // the user that reset failed, or retain credentials in this browser.
    try { await supabase.auth.signOut({ scope: "local" }); } catch { /* Local cookies are still removed below. */ }
  } catch {
    return { error: "temporarily_unavailable" };
  }
  await clearSessionCookies();
  query.set("passwordReset", "1");
  redirect(`/${locale}/login?${query}`);
}

export async function signInAction(
  _previousState: SignInState,
  formData: FormData
): Promise<SignInState> {
  const credentials = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!credentials.success) {
    return { error: "invalid_credentials" };
  }

  const persistSession = formData.get("remember") === "on";
  const nextPath = resolvePostAuthPath(formData.get("next"));
  try {
    const supabase = await createClient({ persistSession });
    const { error } = await supabase.auth.signInWithPassword({
      email: credentials.data.email,
      password: credentials.data.password,
    });
    if (error) return signInError(error);
  } catch (error) {
    return signInError(error);
  }

  await setSessionPersistencePreference(persistSession);
  redirect(nextPath);
}

export async function signInWithOAuth(
  provider: "google" | "kakao",
  acceptedTerms: boolean,
  next?: string
) {
  if (acceptedTerms !== true) {
    return { error: "Terms must be accepted" };
  }

  // The authorize URL must use the browser-accessible Supabase host, while
  // the shared server adapter persists the PKCE verifier for the callback.
  const supabase = await createPublicClient({ persistSession: true });
  const appUrl = await getRequestAppOrigin();
  const callbackUrl = new URL("/api/auth/callback", appUrl);
  callbackUrl.searchParams.set("next", resolvePostAuthPath(next));

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callbackUrl.toString(),
    },
  });

  if (error) {
    return { error: "OAuth sign-in is unavailable" };
  }

  await setSessionPersistencePreference(true);
  if (data.url) {
    redirect(data.url);
  }
}

export async function signOut(locale = "ko") {
  const supabase = await createClient();
  // A normal sign-out should revoke only the current browser session. The SSR
  // storage adapter removes every chunk of the auth cookie even when the
  // remote session has already expired.
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) return { error: "sign_out_failed" as const };
  await setSessionPersistencePreference(true);
  redirect(`/${locale === "en" ? "en" : "ko"}?loggedOut=1`, RedirectType.replace);
}
