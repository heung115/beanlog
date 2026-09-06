import { createHmac } from "node:crypto";
const [mode, otherIp] = process.argv.slice(2);
const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
const payload = Buffer.from(JSON.stringify({ sub: "00000000-0000-4000-8000-000000000001", exp: Math.floor(Date.now()/1000)+3600 })).toString("base64url");
const signature = createHmac("sha256", "fixture-signing-key-not-for-production").update(`${header}.${payload}`).digest("base64url");
const authorization = `Bearer ${header}.${payload}.${signature}`;
const status = async (url, options={}) => (await fetch(url, { ...options, headers: { authorization, ...(options.headers ?? {}) } })).status;
let result;
if (mode === "exhaust-user") {
  const count = {};
  for (let i=0;i<601;i++) { const code = await status("http://fixture-caddy:8080/auth-check"); count[code]=(count[code]??0)+1; }
  result=count;
} else if (mode === "second-client") {
  result={user:await status("http://fixture-caddy:8080/auth-check",{headers:{"x-beanmap-client-ip":otherIp,"x-beanmap-client-proof":"forged","x-beanmap-auth-client-ip":otherIp}})};
} else if (mode === "spoof") {
  result={
    throughWeb: await status("http://fixture-caddy:8080/auth-check",{headers:{"x-beanmap-client-ip":otherIp,"x-beanmap-client-proof":"forged","x-beanmap-auth-client-ip":otherIp}}),
    directKong: await status("http://beanmap-auth-gateway:8000/auth/v1/user",{headers:{apikey:"fixture-only-api-key","x-beanmap-auth-client-ip":otherIp}}),
    publicApi: await status("http://fixture-caddy:8081/auth/v1/user",{headers:{apikey:"fixture-only-api-key","x-beanmap-auth-client-ip":otherIp}}),
  };
} else if (mode === "auth-boundaries") {
  result={
    missingKey:await status("http://beanmap-auth-gateway:8000/auth/v1/user"),
    invalidJwt:await status("http://fixture-caddy:8080/auth-check",{headers:{authorization:"Bearer invalid.fixture.signature"}}),
    privateDenied:await status("http://fixture-caddy:8082/auth-check"),
    privateAllowed:await status("http://fixture-caddy:8082/auth-check",{headers:{"Tailscale-User-Login":"fixture-owner","x-beanmap-client-ip":otherIp,"x-beanmap-client-proof":"forged"}}),
  };
} else if (mode === "exhaust-token") {
  const count = {};
  for (let i=0;i<61;i++) { const code = await status("http://fixture-caddy:8080/auth-token",{method:"POST"}); count[code]=(count[code]??0)+1; }
  result=count;
} else if (mode === "token-other-client") {
  result={token:await status("http://fixture-caddy:8080/auth-token",{method:"POST"})};
} else if (mode === "after-recreate") {
  result={user:await status("http://fixture-caddy:8080/auth-check")};
}
console.log(JSON.stringify(result));
