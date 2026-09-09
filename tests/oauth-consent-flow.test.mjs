import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as proof from "../src/lib/security/oauth-consent-proof.ts";

const userId="c3700000-0000-0000-0000-000000000001",sessionId="d3700000-0000-0000-0000-000000000001";
const token="fixture."+Buffer.from(JSON.stringify({sub:userId,session_id:sessionId})).toString("base64url")+".fixture";
function fixture({pending=true,verified=true,provider="google",pkce=true}={}) {
 const jar=new Map(pkce?[["fixture-code-verifier",{value:"fixture-verifier"}]]:[]), calls=[];
 const deps={
  "node:fs":{readFileSync:()=>"a".repeat(64)},
  "next/headers":{cookies:async()=>({get:name=>jar.get(name),getAll:()=>[...jar].map(([name,value])=>({name,value:value.value})),set:(name,value,options)=>jar.set(name,{value,options}),delete:name=>jar.delete(name)})},
  "../supabase/config":{supabaseCookieOptions:{name:"fixture",secure:true}},
  "./oauth-consent-proof":proof,
 };
 const source=ts.transpileModule(readFileSync(new URL("../src/lib/security/oauth-consent.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 vm.runInNewContext(source,{exports,Buffer,AbortSignal,process:{env:{SIGNUP_CONSENT_SECRET_FILE:"/fixture-key"}},require:name=>{assert.ok(name in deps,name);return deps[name];}});
 const client={auth:{getSession:async()=>({data:{session:{access_token:token}},error:null}),getUser:async access=>{
  calls.push(["user",access]);return {data:{user:verified?{id:userId,app_metadata:{provider,beanmap_pending_consent:pending}}:null},error:verified?null:{status:401}};
 }},rpc:(name,args)=>({abortSignal:async signal=>{calls.push(["rpc",name,args,signal]);return {data:true,error:null};}})};
 return {api:exports,jar,calls,client};
}
test("preconsent cookie is HttpOnly, bound to the PKCE cookie and consumed once",async()=>{
 const {api,jar}=fixture();await api.storeOAuthPreconsent("google");
 const cookie=jar.get("beanmap-oauth-preconsent");
 assert.equal(cookie.options.httpOnly,true);assert.equal(cookie.options.secure,true);assert.equal(cookie.options.sameSite,"lax");
 assert.equal(cookie.options.maxAge,600);
 const value=await api.takeOAuthPreconsent();assert.equal(value.provider,"google");assert.equal(await api.takeOAuthPreconsent(),null);
 const missing=fixture({pkce:false});await assert.rejects(missing.api.storeOAuthPreconsent("google"));
});
test("callback checks exact Auth token and matching provider before a session-bound RPC",async()=>{
 const {api,client,calls}=fixture();
 assert.equal(await api.completeOAuthCallbackConsent(client,token,null),false);
 assert.equal(await api.completeOAuthCallbackConsent(client,token,{provider:"kakao",nonce:"b".repeat(64)}),false);
 assert.equal(calls.some(call=>call[0]==="rpc"),false);
 assert.equal(await api.completeOAuthCallbackConsent(client,token,{provider:"google",nonce:"b".repeat(64)}),true);
 const call=calls.find(call=>call[0]==="rpc");assert.equal(call[1],"complete_oauth_consent");
 assert.equal(call[2].assertion.user_id,userId);assert.equal(call[2].assertion.session_id,sessionId);assert.equal(call[2].assertion.nonce,"b".repeat(64));
 assert.ok(calls.filter(call=>call[0]==="user").every(call=>call[1]===token));
});
test("unverified identity cannot complete and legacy OAuth remains unchanged",async()=>{
 const denied=fixture({verified:false});await assert.rejects(denied.api.completeExplicitOAuthConsent(denied.client));
 assert.equal(denied.calls.some(call=>call[0]==="rpc"),false);
 const legacy=fixture({pending:false});assert.equal(await legacy.api.completeOAuthCallbackConsent(legacy.client,token,null),true);
 assert.equal(legacy.calls.some(call=>call[0]==="rpc"),false);
});
test("explicit acceptance still binds completion to the exact verified session",async()=>{
 const {api,client,calls}=fixture();assert.equal(await api.completeExplicitOAuthConsent(client),true);
 assert.equal(calls[0][0],"user");assert.equal(calls[0][1],token);
 assert.equal(calls[1][2].assertion.session_id,sessionId);
});
