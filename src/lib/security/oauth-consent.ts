import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseCookieOptions } from "../supabase/config";
import { issueOAuthPreconsent, verifyOAuthPreconsent, pkceConsentBinding, oauthConsentAssertion, type OAuthPreconsent, type ConsentProvider } from "./oauth-consent-proof";

const COOKIE="beanmap-oauth-preconsent";
function secret() {
  const path=process.env.SIGNUP_CONSENT_SECRET_FILE;
  if(!path)throw new Error("Consent configuration unavailable");
  const value=readFileSync(path,"utf8").trim();
  if(!/^[a-f0-9]{64}$/.test(value))throw new Error("Consent configuration unavailable");
  return value;
}
export async function storeOAuthPreconsent(provider:ConsentProvider) {
  const jar=await cookies();
  const binding=pkceConsentBinding(jar.getAll(),supabaseCookieOptions.name);
  if(!binding)throw new Error("Verified PKCE flow required");
  jar.set(COOKIE,issueOAuthPreconsent(provider,binding,secret()),{
    httpOnly:true,secure:supabaseCookieOptions.secure,sameSite:"lax",path:"/",maxAge:600,
  });
}
/** Read before code exchange consumes the matching verifier; clear the one-use browser proof. */
export async function takeOAuthPreconsent():Promise<OAuthPreconsent|null> {
  const jar=await cookies();
  const token=jar.get(COOKIE)?.value;
  if(!token)return null;
  jar.delete(COOKIE);
  return verifyOAuthPreconsent(token,pkceConsentBinding(jar.getAll(),supabaseCookieOptions.name),secret());
}

async function verifiedOAuthSession(client:SupabaseClient,accessToken:string) {
  const {data,error}=await client.auth.getUser(accessToken);
  if(error || !data.user)throw new Error("Verified OAuth session required");
  if(data.user.app_metadata?.beanmap_pending_consent!==true)return {pending:false as const};
  const provider=data.user.app_metadata.provider;
  if(provider!=="google" && provider!=="kakao")throw new Error("Verified OAuth provider required");
  const claims=JSON.parse(Buffer.from(accessToken.split(".")[1],"base64url").toString("utf8"));
  if(claims.sub!==data.user.id || typeof claims.session_id!=="string")throw new Error("Verified OAuth session required");
  return {pending:true as const,userId:data.user.id,sessionId:claims.session_id,provider:provider as ConsentProvider};
}
async function finish(client:SupabaseClient,session:{userId:string;sessionId:string;provider:ConsentProvider},nonce?:string) {
  const assertion=oauthConsentAssertion(session.userId,session.sessionId,session.provider,secret(),nonce);
  const {data,error}=await client.rpc("complete_oauth_consent",{assertion}).abortSignal(AbortSignal.timeout(3500));
  return !error && data===true;
}
export async function completeOAuthCallbackConsent(client:SupabaseClient,accessToken:string,preconsent:OAuthPreconsent|null) {
  const session=await verifiedOAuthSession(client,accessToken);
  if(!session.pending)return true;
  if(!preconsent || preconsent.provider!==session.provider)return false;
  return finish(client,session,preconsent.nonce);
}
export async function completeExplicitOAuthConsent(client:SupabaseClient) {
  const {data,error}=await client.auth.getSession();
  if(error || !data.session?.access_token)return false;
  const session=await verifiedOAuthSession(client,data.session.access_token);
  return !session.pending || finish(client,session);
}
