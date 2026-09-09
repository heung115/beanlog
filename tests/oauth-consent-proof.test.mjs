import assert from "node:assert/strict";
import test from "node:test";
import { issueOAuthPreconsent, verifyOAuthPreconsent, pkceConsentBinding, oauthConsentAssertion } from "../src/lib/security/oauth-consent-proof.ts";

const secret="a".repeat(64),nonce="b".repeat(64),binding="c".repeat(64),now=1788888888000;
test("OAuth preconsent binds a specific provider and PKCE verifier, expires and rejects tampering",()=>{
 const token=issueOAuthPreconsent("google",binding,secret,now,nonce);
 assert.equal(verifyOAuthPreconsent(token,binding,secret,now).provider,"google");
 for(const [value,pkce,key,time] of [[token,"d".repeat(64),secret,now],[token,binding,"e".repeat(64),now],[token,binding,secret,now+601000],[token+"x",binding,secret,now],[undefined,binding,secret,now],[token,null,secret,now]]){
  assert.equal(verifyOAuthPreconsent(value,pkce,key,time),null);
 }
 const [payload,signature]=token.split(".");
 const changed=JSON.parse(Buffer.from(payload,"base64url"));changed.provider="kakao";
 assert.equal(verifyOAuthPreconsent(Buffer.from(JSON.stringify(changed)).toString("base64url")+"."+signature,binding,secret,now),null);
});
test("PKCE binding includes only exact verifier cookie chunks and cannot migrate to another flow",()=>{
 const entries=[{name:"session-code-verifier.1",value:"second"},{name:"session-code-verifier.0",value:"first"},{name:"attacker",value:"ignored"}];
 const first=pkceConsentBinding(entries,"session");
 assert.equal(first,pkceConsentBinding([...entries].reverse(),"session"));
 assert.notEqual(first,pkceConsentBinding([{name:"session-code-verifier",value:"different-flow"}],"session"));
 assert.equal(pkceConsentBinding([{name:"session-code-verifier.evil",value:"spoof"}],"session"),null);
});
test("completion has a separate signing purpose and binds exact user and original session",()=>{
 const user="c3700000-0000-0000-0000-000000000001",session="d3700000-0000-0000-0000-000000000001";
 const proof=oauthConsentAssertion(user,session,"google",secret,nonce,now);
 // Independent Python hmac.new(bytes.fromhex("a" * 64), canonical, hashlib.sha256)
 // vector for the fixed fields below, prefixed by "beanmap-oauth-consent-v1\n".
 assert.deepEqual(proof, {
  user_id:user, session_id:session, provider:"google", terms_version:"2026-08-26",
  privacy_version:"2026-08-26", issued_at:1788888888, nonce, source:"oauth-signup", path:"/consent",
  signature:"79f7fc635f548db89759fc4cbf8de1af6ab572e2cee6a7d6695ee1063b08b32e",
 });
 const preconsent=issueOAuthPreconsent("google",binding,secret,now,nonce);
 assert.notEqual(proof.signature,preconsent.split(".")[1]);
 assert.notEqual(proof.signature,oauthConsentAssertion(user,"d3700000-0000-0000-0000-000000000002","google",secret,nonce,now).signature);
 assert.notEqual(proof.signature,oauthConsentAssertion("c3700000-0000-0000-0000-000000000002",session,"google",secret,nonce,now).signature);
 assert.throws(()=>oauthConsentAssertion(user,"invalid","google",secret));
});
