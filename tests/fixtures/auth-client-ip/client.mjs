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
} else if (mode === "operation-budgets") {
  const send = (path, headers={}) => status(`http://fixture-caddy:8081/auth/v1/${path}`, {method:"POST", headers:{apikey:"fixture-only-api-key",...headers}});
  result={forgedGrantStatus:await send("token?grant_type=password", {"X-Beanmap-Auth-Client-IP":otherIp,"X-Forwarded-For":otherIp})};
  for (const path of ["signup","recover","otp"]) {
    const count={}; for(let i=0;i<11;i++) {const code=path==="signup" ? await status("http://fixture-caddy:8080/auth-signup",{method:"POST"}) : await send(path);count[code]=(count[code]??0)+1;} result[path]=count;
  }
  for (const [key,path] of [["verify","verify"],["refresh","token?grant_type=refresh_token"],["logout","logout"]]) result[key]=await send(path);
  result.signupSpellingsBlocked=true;
  for(const path of ["signup","signup/","%73ignup","signup%2f","%2573ignup","./signup","other/../signup","//signup"]) {
    if(await send(path,{"X-Beanmap-Auth-Client-IP":otherIp,"X-Forwarded-For":otherIp})!==404) result.signupSpellingsBlocked=false;
  }
  result.untrustedDirectSignup=await status("http://beanmap-auth-gateway:8000/auth/v1/signup",{method:"POST",headers:{apikey:"fixture-only-api-key","X-Beanmap-Auth-Client-IP":otherIp}});
  result.adminDenied=await send("admin/users");
  result.internalAdminDenied=await status("http://beanmap-auth-gateway:8000/auth/v1/admin/users",{headers:{apikey:"fixture-only-api-key"}});
  result.admin=await status("http://beanmap-auth-gateway:8000/auth/v1/admin/users",{headers:{apikey:"fixture-only-admin-key"}});
  const identity = await fetch("http://fixture-caddy:8081/auth/v1/verify",{method:"POST",headers:{apikey:"fixture-only-api-key","X-Beanmap-Auth-Rate-Identity":"deletion:forged","X-Beanmap-Auth-Client-IP":otherIp}}).then(r=>r.json());
  result.nativeIdentityReplaced=identity.rateIdentity !== "deletion:forged" && identity.rateIdentity.startsWith("public:");
  result.adminSpellingsBlocked=true;
  for(const path of ["admin/users","%61dmin/users","admin%2Fusers","admin//users","./admin/users","other/../admin/users"]){
    if(await send(path,{apikey:"fixture-only-admin-key"})!==404) result.adminSpellingsBlocked=false;
  }
  // Exhaust the IP aggregate across different operations. Requests rejected by
  // operation/IP limits must not consume the shared public or admin capacity.
  let aggregateRejected = false;
  for(const path of ["token?grant_type=refresh_token","authorize","callback","other"]){
    for(let i=0;i<125;i++){if(await send(path)===429) aggregateRejected=true;}
  }
  result.aggregateBounded=aggregateRejected;
  let rejected = 0;
  for(let batch=0;batch<400;batch++) {
    const codes=await Promise.all(Array.from({length:25},()=>send("other")));
    rejected += codes.filter(code=>code===429).length;
  }
  result.deniedTrafficCannotSpendGlobal=rejected===10000;
  result.adminAfterPublicExhaustion=await status("http://beanmap-auth-gateway:8000/auth/v1/admin/users",{headers:{apikey:"fixture-only-admin-key"}});
} else if (mode === "after-recreate") {
  result={user:await status("http://fixture-caddy:8080/auth-check")};
}
// Never serialize response objects or arbitrary result properties. Project only
// literal HTTP statuses, bounded numeric counters, and boolean assertions.
function httpStatus(value) {
  for (const code of [200, 401, 403, 404, 429]) if (value === code) return code;
  throw new Error("Unexpected fixture HTTP status");
}
function histogram(value) {
  const counts = {};
  for (const code of [200, 429]) {
    const count = value?.[code];
    if (count === undefined) continue;
    if (!Number.isSafeInteger(count) || count < 0 || count > 10000) throw new Error("Invalid fixture count");
    counts[code] = Number(count);
  }
  if (Object.keys(value).length !== Object.keys(counts).length) throw new Error("Unexpected fixture count status");
  return counts;
}
let report;
if (mode === "exhaust-user" || mode === "exhaust-token") report = histogram(result);
else if (mode === "second-client" || mode === "after-recreate") report = { user:httpStatus(result.user) };
else if (mode === "token-other-client") report = { token:httpStatus(result.token) };
else if (mode === "spoof") report = {
  throughWeb:httpStatus(result.throughWeb), directKong:httpStatus(result.directKong), publicApi:httpStatus(result.publicApi),
};
else if (mode === "auth-boundaries") report = {
  missingKey:httpStatus(result.missingKey), invalidJwt:httpStatus(result.invalidJwt),
  privateDenied:httpStatus(result.privateDenied), privateAllowed:httpStatus(result.privateAllowed),
};
else if (mode === "operation-budgets") report = {
  forgedGrantStatus:httpStatus(result.forgedGrantStatus), signup:histogram(result.signup), recover:histogram(result.recover), otp:histogram(result.otp),
  verify:httpStatus(result.verify), refresh:httpStatus(result.refresh), logout:httpStatus(result.logout),
  signupSpellingsBlocked:result.signupSpellingsBlocked === true, untrustedDirectSignup:httpStatus(result.untrustedDirectSignup),
  adminDenied:httpStatus(result.adminDenied), internalAdminDenied:httpStatus(result.internalAdminDenied), admin:httpStatus(result.admin),
  nativeIdentityReplaced:result.nativeIdentityReplaced === true, adminSpellingsBlocked:result.adminSpellingsBlocked === true,
  aggregateBounded:result.aggregateBounded === true, deniedTrafficCannotSpendGlobal:result.deniedTrafficCannotSpendGlobal === true,
  adminAfterPublicExhaustion:httpStatus(result.adminAfterPublicExhaustion),
};
else throw new Error("Unknown fixture mode");
console.log(JSON.stringify(report));
