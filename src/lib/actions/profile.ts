"use server";

import { createClient } from "@/lib/supabase/server";
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const metadataDisplayName =
    typeof user.user_metadata.display_name === "string"
      ? user.user_metadata.display_name.trim()
      : "";
  const emailName = user.email?.split("@")[0] ?? "";
  const displayName =
    profile?.display_name?.trim() || metadataDisplayName || emailName || "User";

  return { displayName };
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return data;
}
