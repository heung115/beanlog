import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { LEGAL_EFFECTIVE_DATE } from "../../config/legal-version.ts";

export type ConsentProvider = "google" | "kakao";
export type OAuthPreconsent = { provider: ConsentProvider; terms_version: string; privacy_version: string; issued_at: number; nonce: string; pkce_binding: string };
const validSecret = (secret: string) => /^[a-f0-9]{64}$/.test(secret);
const mac = (value: string, secret: string) => createHmac("sha256", Buffer.from(secret,"hex")).update(value).digest("hex");
export function pkceConsentBinding(entries: Array<{name:string;value:string}>, storageKey: string): string | null {
  const name=storageKey+"-code-verifier";
  const selected=entries.filter(item=>item.name===name || (item.name.startsWith(name+".") && /^\d+$/.test(item.name.slice(name.length+1)))).sort((a,b)=>a.name.localeCompare(b.name));
  return selected.length ? createHash("sha256").update(JSON.stringify(selected.map(({name,value})=>[name,value]))).digest("hex") : null;
}
export function issueOAuthPreconsent(provider: ConsentProvider, pkceBinding: string, secret: string, now=Date.now(), nonce=randomBytes(32).toString("hex")) {
  if (!validSecret(secret) || !["google","kakao"].includes(provider) || !/^[a-f0-9]{64}$/.test(pkceBinding) || !/^[a-f0-9]{64}$/.test(nonce)) throw new Error("Consent configuration unavailable");
  const payload:OAuthPreconsent={provider,terms_version:LEGAL_EFFECTIVE_DATE,privacy_version:LEGAL_EFFECTIVE_DATE,issued_at:Math.floor(now/1000),nonce,pkce_binding:pkceBinding};
  const encoded=Buffer.from(JSON.stringify(payload)).toString("base64url");
  return encoded+"."+mac("beanmap-oauth-preconsent-v1\n"+encoded,secret);
}
export function verifyOAuthPreconsent(token:string|undefined, pkceBinding:string|null, secret:string, now=Date.now()):OAuthPreconsent|null {
  if(!token || token.length>2048 || !validSecret(secret) || !pkceBinding)return null;
  const [encoded,signature,...extra]=token.split(".");
  if(extra.length || !/^[A-Za-z0-9_-]+$/.test(encoded) || !/^[a-f0-9]{64}$/.test(signature??""))return null;
  const expected=mac("beanmap-oauth-preconsent-v1\n"+encoded,secret);
  if(!timingSafeEqual(Buffer.from(expected),Buffer.from(signature)))return null;
  try {
    const value=JSON.parse(Buffer.from(encoded,"base64url").toString("utf8"));
    if(!["google","kakao"].includes(value.provider) || value.terms_version!==LEGAL_EFFECTIVE_DATE || value.privacy_version!==LEGAL_EFFECTIVE_DATE
      || !Number.isSafeInteger(value.issued_at) || value.issued_at<Math.floor(now/1000)-600 || value.issued_at>Math.floor(now/1000)+30
      || !/^[a-f0-9]{64}$/.test(value.nonce) || value.pkce_binding!==pkceBinding)return null;
    return value as OAuthPreconsent;
  } catch {return null;}
}
export function oauthConsentAssertion(userId:string, sessionId:string, provider:ConsentProvider, secret:string, nonce=randomBytes(32).toString("hex"), now=Date.now()) {
  const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
  if(!validSecret(secret) || !uuid.test(userId) || !uuid.test(sessionId) || !["google","kakao"].includes(provider) || !/^[a-f0-9]{64}$/.test(nonce))throw new Error("Verified OAuth session required");
  const payload={user_id:userId,session_id:sessionId,provider,terms_version:LEGAL_EFFECTIVE_DATE,privacy_version:LEGAL_EFFECTIVE_DATE,issued_at:Math.floor(now/1000),nonce,source:"oauth-signup",path:"/consent"};
  const canonical=["beanmap-oauth-consent-v1",payload.user_id,payload.session_id,payload.provider,payload.terms_version,payload.privacy_version,payload.issued_at,payload.nonce,payload.source,payload.path].join("\n");
  return {...payload,signature:mac(canonical,secret)};
}
