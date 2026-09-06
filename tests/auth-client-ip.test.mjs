import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTH_CLIENT_IP_HEADER, CLIENT_IP_HEADER, CLIENT_PROOF_HEADER,
  canonicalClientIp, createTrustedAuthFetch, verifiedClientIp,
} from "../src/lib/security/auth-client-ip.ts";

const proof = "a".repeat(64);
const incoming = (ip = "192.0.2.24", token = proof) => new Headers({
  [CLIENT_IP_HEADER]: ip, [CLIENT_PROOF_HEADER]: token,
});

test("only a constant-time matched ingress proof admits a single canonical client address", () => {
  assert.equal(verifiedClientIp(incoming(), proof), "192.0.2.24");
  assert.equal(verifiedClientIp(incoming("2001:0db8::1"), proof), "2001:db8::1");
  for (const ip of ["1.2.3.4,5.6.7.8", "127.0.0.1:12", "[::1]", "fe80::1%eth0", "host.test", "001.2.3.4", "", " 1.2.3.4"]) {
    assert.equal(canonicalClientIp(ip), null, ip);
  }
  for (const token of ["", "b".repeat(64), "é".repeat(64), `${proof},${proof}`]) {
    assert.equal(verifiedClientIp(incoming("192.0.2.1", token), proof), null);
  }
  assert.equal(verifiedClientIp(incoming(), "short"), null);
});

test("verified IP affects only exact internal GET user lookup and never leaks its proof", async () => {
  const calls = [];
  const transport = createTrustedAuthFetch(incoming(), {
    secretFile: "/fixture/secret", internalUrl: "http://beanmap-auth-gateway:8000",
    readSecret: () => `${proof}\n`,
    fetchImpl: async (input, init) => { calls.push({ input, init }); return new Response("ok"); },
  });
  const headers = {
    authorization: "Bearer fixture-not-an-auth-token",
    [AUTH_CLIENT_IP_HEADER]: "198.51.100.77", [CLIENT_IP_HEADER]: "198.51.100.77", [CLIENT_PROOF_HEADER]: proof,
  };
  await transport("http://beanmap-auth-gateway:8000/auth/v1/user", { headers });
  assert.equal(calls[0].init.headers.get(AUTH_CLIENT_IP_HEADER), "192.0.2.24");
  assert.equal(calls[0].init.headers.get("authorization"), headers.authorization);
  for (const [url, method] of [
    ["http://beanmap-auth-gateway:8000/auth/v1/token", "POST"],
    ["http://beanmap-auth-gateway:8000/auth/v1/user", "PUT"],
    ["http://beanmap-auth-gateway:8000/auth/v1/user?x=1", "GET"],
    ["https://api.beanmap.site/auth/v1/user", "GET"],
    ["http://different-host:8000/auth/v1/user", "GET"],
  ]) await transport(url, { method, headers });
  for (const [index, call] of calls.entries()) {
    assert.equal(call.init.headers.get(CLIENT_PROOF_HEADER), null);
    assert.equal(call.init.headers.get(CLIENT_IP_HEADER), null);
    if (index) assert.equal(call.init.headers.get(AUTH_CLIENT_IP_HEADER), null);
  }
});

test("missing, forged or unreadable ingress configuration keeps the original bounded source-IP behavior", async () => {
  for (const options of [
    { readSecret: () => { throw new Error("unreadable"); } },
    { readSecret: () => "weak" },
    { readSecret: () => proof, internalUrl: "https://api.beanmap.site" },
  ]) {
    let forwarded;
    const transport = createTrustedAuthFetch(incoming(), {
      secretFile: "/fixture/secret", internalUrl: "http://beanmap-auth-gateway:8000",
      ...options,
      fetchImpl: async (_input, init) => { forwarded = init.headers.get(AUTH_CLIENT_IP_HEADER); return new Response(); },
    });
    await transport("http://beanmap-auth-gateway:8000/auth/v1/user");
    assert.equal(forwarded, null);
  }
});
