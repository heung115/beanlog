"use server";

import {
  createClient,
  createPublicClient,
  setSessionPersistencePreference,
} from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";

export type SignInState = {
  error?: "invalid_credentials" | "email_not_confirmed";
};

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

const guestDraftDestinationSchema = z.enum([
  "/ko/beans/new?draft=1",
  "/en/beans/new?draft=1",
]);

function resolvePostAuthPath(value: FormDataEntryValue | string | null | undefined) {
  const parsed = guestDraftDestinationSchema.safeParse(value);
  return parsed.success ? parsed.data : "/explore";
}

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
  const supabase = await createClient({ persistSession });

  const { error } = await supabase.auth.signInWithPassword({
    email: credentials.data.email,
    password: credentials.data.password,
  });

  if (error) {
    return {
      error:
        error.code === "email_not_confirmed"
          ? "email_not_confirmed"
          : "invalid_credentials",
    };
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";
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

export async function signOut() {
  const supabase = await createClient();
  // A normal sign-out should revoke only the current browser session. The SSR
  // storage adapter removes every chunk of the auth cookie even when the
  // remote session has already expired.
  await supabase.auth.signOut({ scope: "local" });
  await setSessionPersistencePreference(true);
  redirect("/login");
}
