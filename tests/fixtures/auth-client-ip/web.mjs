import http from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createTrustedAuthFetch } from "/auth-client-ip.ts";

// Disposable cryptographically checked upstream. These are synthetic credentials.
const signingKey = "fixture-signing-key-not-for-production";
function validJwt(value) {
  const token = /^Bearer (.+)$/.exec(value ?? "")?.[1];
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const expected = createHmac("sha256", signingKey).update(`${parts[0]}.${parts[1]}`).digest("base64url");
  if (parts[2].length !== expected.length || !timingSafeEqual(Buffer.from(parts[2]), Buffer.from(expected))) return false;
  try { return JSON.parse(Buffer.from(parts[1], "base64url")).exp > Date.now() / 1000; } catch { return false; }
}
http.createServer((request, response) => {
  if (request.url === "/auth/v1/user" && !validJwt(request.headers.authorization)) {
    response.writeHead(401); response.end("invalid signature"); return;
  }
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ verified: request.url === "/auth/v1/user", rateIdentity: request.headers["x-beanmap-auth-rate-identity"] }));
}).listen(9999, "0.0.0.0");

http.createServer(async (request, response) => {
  if (request.url === "/health") { response.end("ok"); return; }
  try {
    const trustedFetch = createTrustedAuthFetch(new Headers(request.headers));
    const token = request.url === "/auth-token" || request.url === "/auth-signup";
    const endpoint = request.url === "/auth-signup" ? "signup" : token ? "token" : "user";
    const result = await trustedFetch(`${process.env.SUPABASE_SERVER_URL}/auth/v1/${endpoint}`, {
      method: token ? "POST" : "GET",
      headers: { authorization: request.headers.authorization ?? "", apikey: "fixture-only-api-key" },
      ...(token ? { body: "fixture" } : {}),
    });
    response.writeHead(result.status, Object.fromEntries(result.headers));
    response.end(await result.text());
  } catch {
    response.writeHead(500); response.end("fixture transport failure");
  }
}).listen(3000, "0.0.0.0");
