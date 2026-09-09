import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { controlledSignup, signupConsentAssertion, SIGNUP_CONSENT_VERSION } from "../src/lib/security/signup-consent.ts";

const secret = "a".repeat(64), proof = "b".repeat(64);
const incoming = new Headers({"x-beanmap-client-ip":"192.0.2.5","x-beanmap-client-proof":proof});
const options = {internalUrl:"http://beanmap-auth-gateway:8000",anonKey:"fixture-only-key",secretFile:"/consent",ingressSecretFile:"/ingress",readSecret:path=>path==="/consent"?secret:proof};
const input = {email:"fixture@example.test",password:"Synthetic Password 72",displayName:"Fixture"};

test("assertion binds normalized email, immutable document versions, time, nonce and source", () => {
 const assertion=signupConsentAssertion("FIXTURE@example.test",secret,1788888888000,"c".repeat(64));
 assert.equal(assertion.email,"fixture@example.test");
 assert.equal(assertion.terms_version,SIGNUP_CONSENT_VERSION);
 assert.equal(assertion.privacy_version,SIGNUP_CONSENT_VERSION);
 const canonical=["beanmap-signup-v1",assertion.email,assertion.terms_version,assertion.privacy_version,assertion.issued_at,assertion.nonce,assertion.source,assertion.path].join("\n");
 assert.equal(assertion.signature,createHmac("sha256",Buffer.from(secret,"hex")).update(canonical).digest("hex"));
 assert.throws(()=>signupConsentAssertion(input.email,"weak"));
});

test("signup fails before Auth without verified ingress or strong signing material", async () => {
 for(const requestHeaders of [new Headers(),new Headers({"x-beanmap-client-ip":"192.0.2.5","x-beanmap-client-proof":"c".repeat(64)})]) {
  await assert.rejects(controlledSignup(input,requestHeaders,{...options,fetchImpl:async()=>assert.fail("Auth called")}));
 }
 await assert.rejects(controlledSignup(input,incoming,{...options,readSecret:path=>path==="/consent"?"weak":proof}));
});

test("fresh, duplicate, rejected and interrupted Auth responses have identical shape and bounded timing", async () => {
 const cases=[{status:200,body:{id:"new",identities:[{id:"private"}]}},{status:200,body:{id:"duplicate",identities:[]}},{status:400,body:{message:"already registered"}},{status:429,body:{}},{status:500,body:{}},null];
 for(const result of cases){
  let elapsed=0,requestBody,requestHeaders;
  const response=await controlledSignup(input,incoming,{...options,clock:()=>elapsed,jitter:()=>125,sleep:async ms=>{elapsed+=ms;},fetchImpl:async(_url,init)=>{
   requestBody=JSON.parse(init.body);requestHeaders=init.headers;elapsed=120;
   if(!result)throw new Error("timeout");
   return new Response(JSON.stringify(result.body),{status:result.status,headers:{"set-cookie":"private=session"}});
  }});
  assert.deepEqual(response,{success:true});
  assert.equal(elapsed,3125);
  assert.equal(requestHeaders.get("x-beanmap-client-proof"),null);
  assert.equal(requestHeaders.get("x-beanmap-auth-client-ip"),"192.0.2.5");
  assert.equal(requestBody.data.beanmap_signup_consent.email,input.email);
  assert.equal(requestBody.data.display_name,"Fixture");
 }
});
