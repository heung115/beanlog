"use server";

import { createClient } from "@/lib/supabase/server";
import { apiFetch } from "@/lib/api/client";
import type { Profile } from "@/types/database";

export interface CurrentUserIdentity {
  displayName: string;
}

/** A small, safe-to-render identity for the app chrome. */
export async function getCurrentUserIdentity(): Promise<CurrentUserIdentity | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // display_name lives in the profiles table (data), so it comes from the Go
  // API; presence/identity still comes from Supabase Auth.
  let profileDisplayName = "";
  try {
    const profile = await apiFetch<{ display_name: string | null }>("/api/profile");
    profileDisplayName = profile.display_name?.trim() ?? "";
  } catch {
    // fall back to auth metadata / email below
  }

  const metadataDisplayName =
    typeof user.user_metadata.display_name === "string"
      ? user.user_metadata.display_name.trim()
      : "";
  const emailName = user.email?.split("@")[0] ?? "";
  const displayName =
    profileDisplayName || metadataDisplayName || emailName || "User";

  return { displayName };
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  try {
    return await apiFetch<Profile>("/api/profile");
  } catch {
    return null;
  }
}
