"use server";

import {
  createClient,
  createPublicClient,
} from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";

export type SignInState = { error?: string };

const signInSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(1024),
});

const signUpSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(50),
});

export async function signUp(email: string, password: string, displayName: string) {
  const parsed = signUpSchema.safeParse({ email, password, displayName });
  if (!parsed.success) return { error: "Invalid signup data" };

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
    },
  });

  if (error) {
    return { error: "Unable to create account" };
  }

  if (data.user) {
    await supabase.from("profiles").upsert({
      id: data.user.id,
      email: parsed.data.email,
      display_name: parsed.data.displayName,
      locale: "ko",
    });
  }

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
    return { error: "Invalid credentials" };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: credentials.data.email,
    password: credentials.data.password,
  });

  if (error) {
    return { error: "Invalid credentials" };
  }

  redirect("/explore");
}

export async function signInWithOAuth(provider: "google" | "kakao") {
  // The authorize URL must use the browser-accessible Supabase host, while
  // the shared server adapter persists the PKCE verifier for the callback.
  const supabase = await createPublicClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100"}/api/auth/callback`,
    },
  });

  if (error) {
    return { error: "OAuth sign-in is unavailable" };
  }

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
  redirect("/login");
}
