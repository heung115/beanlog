"use server";

import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { redirect } from "next/navigation";
import { z } from "zod";

export type SignInState = { error?: string };

const signInSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function signUp(email: string, password: string, displayName: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    await supabase.from("profiles").upsert({
      id: data.user.id,
      email,
      display_name: displayName,
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
    return { error: error.message };
  }

  redirect("/explore");
}

export async function signInWithOAuth(provider: "google" | "kakao") {
  // signInWithOAuth only constructs an authorize URL (no network request),
  // and the returned URL is opened in the *browser*.
  // Therefore we must use the browser-accessible Supabase URL here,
  // NOT the Docker-internal SUPABASE_SERVER_URL.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.url) {
    redirect(data.url);
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
