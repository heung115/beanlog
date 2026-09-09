"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { completeExplicitOAuthConsent } from "@/lib/security/oauth-consent";
import { resolvePostAuthPath } from "@/lib/security/redirect";

export type ConsentState={error?:"agreement_required"|"temporarily_unavailable"};
export async function completeConsentAction(_previous:ConsentState,form:FormData):Promise<ConsentState> {
  if(form.get("acceptedTerms")!=="on")return {error:"agreement_required"};
  try {
    if(!await completeExplicitOAuthConsent(await createClient()))return {error:"temporarily_unavailable"};
  } catch {return {error:"temporarily_unavailable"};}
  const locale=form.get("locale")==="en"?"en":"ko";
  const next=resolvePostAuthPath(form.get("next"));
  redirect(next==="/explore"?`/${locale}/explore`:next);
}
