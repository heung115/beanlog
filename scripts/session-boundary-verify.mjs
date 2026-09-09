/** Opt-in live session checks. Disposable accounts only; no email dispatch. */
import { execFile } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

if (process.env.BEANMAP_PRODUCTION_VERIFY !== "authorized") {
  throw new Error("Set BEANMAP_PRODUCTION_VERIFY=authorized only after deployment is ready.");
}
process.umask(0o077);
const gateway = "https://api.beanmap.site";
const bridgeSource = readFileSync(new URL("./prod-security-verify.bridge.py", import.meta.url), "utf8");
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const runId = randomUUID();
const users = ["a", "b"].map(suffix => ({
  email: `beanmap-security-verify-${runId}-${suffix}@local.test`,
  password: randomBytes(32).toString("hex"), id: null,
}));
let anonKey;
let stage = "create disposable accounts";
let failures = 0;
const report = (check, status = "PASS") => console.log(JSON.stringify({ check, status }));
function bridge(operation, user, parameters = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile("ssh", ["oracle", "sudo python3 -c " + quote(bridgeSource)],
      { timeout: 45000, maxBuffer: 100000 }, (error, stdout) => {
        if (error) return reject(new Error("Administrative verification bridge failed"));
        try { resolve(JSON.parse(stdout)); } catch { reject(new Error("Invalid bridge response")); }
      });
    child.stdin.end(JSON.stringify({ operation, ...user, ...parameters }));
  });
}
async function call(path, bearer, method = "GET", body) {
  const response = await fetch(gateway + path, {
    method, headers: { apikey: anonKey, Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  let data;
  try { data = await response.json(); } catch { data = null; }
  return { status: response.status, data };
}
const api = (user, bearer, probe, parameters = {}) => bridge("api-probe", user, { bearer, probe, ...parameters });
try {
  for (const user of users) {
    const created = await bridge("create", user);
    user.id = created.id;
    anonKey = created.anonKey;
  }
  const sessions = [];
  for (const user of users) {
    const login = await call("/auth/v1/token?grant_type=password", anonKey, "POST", { email: user.email, password: user.password });
    assert.equal(login.status, 200);
    assert.equal(typeof login.data.access_token, "string");
    sessions.push(login.data.access_token);
  }
  const [a, b] = sessions;
  stage = "current session API canary creation and cross-user isolation";
  const created = await api(users[0], a, "create-canary");
  assert.equal(created.status, 201);
  const beanId = created.data.id;
  assert.match(beanId, /^[a-f0-9-]{36}$/);
  const own = await call(`/rest/v1/beans?id=eq.${beanId}&select=id`, a);
  assert.equal(own.status, 200);
  assert.deepEqual(own.data, [{ id: beanId }]);
  assert.deepEqual((await call(`/rest/v1/beans?id=eq.${beanId}&select=id`, b)).data, []);
  report(stage);

  stage = "API edit versions reject missing null and stale updates";
  const original = await api(users[0], a, "read-canary");
  assert.equal(original.status, 200);
  const originalVersion = original.data.beans.find(bean => bean.id === beanId).updated_at;
  for (const probe of ["update-canary-missing-version", "update-canary-null-version"]) {
    assert.equal((await api(users[0], a, probe, { beanId })).status, 400);
  }
  assert.equal((await api(users[0], a, "update-canary", { beanId, expectedUpdatedAt: originalVersion })).status, 200);
  const staleEdit = await api(users[0], a, "update-canary", { beanId, expectedUpdatedAt: originalVersion });
  assert.equal(staleEdit.status, 409);
  assert.equal(staleEdit.data?.error, "record_conflict");
  report(stage);

  stage = "raw origin contacts are inaccessible and curated API names remain available";
  for (const bearer of [anonKey, a]) {
    const raw = await call("/rest/v1/origin_entities?select=*&limit=1", bearer);
    assert.ok([401, 403].includes(raw.status));
    assert.equal(raw.data?.code, "42501");
  }
  const countries = await api(users[0], a, "origin-countries");
  assert.equal(countries.status, 200);
  const country = countries.data.find(value => value.name_en === "Ethiopia");
  assert.ok(country);
  const regions = await api(users[0], a, "origin-regions", { countryId: country.id });
  assert.equal(regions.status, 200);
  assert.ok(regions.data.length > 0);
  let curated = [];
  for (const region of regions.data.slice(0, 10)) {
    const entities = await api(users[0], a, "origin-entities", { countryId: country.id, regionId: region.id });
    assert.equal(entities.status, 200);
    curated.push(...entities.data);
    if (curated.length > 0) break;
  }
  assert.ok(curated.length > 0);
  for (const entity of curated) {
    assert.equal(Object.hasOwn(entity, "phone"), false);
    assert.equal(Object.hasOwn(entity, "email"), false);
    assert.equal(Object.hasOwn(entity, "contact_name"), false);
    assert.doesNotMatch(entity.name, /@|\b(?:phone|telephone|mobile|email|fax)\b|[0-9](?:[0-9\s().+\-]*[0-9]){6}/i);
  }
  report(stage);

  stage = "catalog-mismatched direct mutation RPC is denied";
  const differentCountry = countries.data.find(value => value.id !== country.id);
  assert.ok(differentCountry);
  const mismatched = await call("/rest/v1/rpc/create_bean_record", a, "POST", {
    p_bean: { name: "Disposable rejected catalog mismatch", roastery: "Verification", bean_type: "single_origin",
      origin_country: differentCountry.name_en, origin_country_id: differentCountry.id,
      origin_region_id: regions.data[0].id, origin_entity_id: curated[0].id,
      process_method: "washed", roast_level: "light", consumed_at: "2026-09-08",
      place_type: "home", overall_score: 8 }, p_tags: [], p_components: [],
  });
  assert.equal(mismatched.status, 403);
  assert.equal(mismatched.data?.code, "42501");
  report(stage);

  stage = "ordinary session account deletion proof and mutation RPC rejection";
  for (const probe of ["delete-missing-proof", "delete-invalid-proof"]) {
    assert.ok([400, 401, 403].includes((await api(users[0], a, probe)).status));
  }
  for (const [name, payload] of [
    ["create_bean_record", { p_bean: {}, p_tags: [], p_components: [] }],
    ["update_bean_record", { p_id: beanId, p_bean: {}, p_tags: [], p_components: [] }],
    ["delete_bean_record", { p_id: beanId }], ["delete_current_account", {}],
  ]) {
    const denied = await call(`/rest/v1/rpc/${name}`, a, "POST", payload);
    assert.equal(denied.status, 403);
    assert.equal(denied.data?.code, "42501");
  }
  const directProfile = await call(`/rest/v1/profiles?id=eq.${users[0].id}`, a, "PATCH", { display_name: "Direct write must not persist" });
  assert.equal(directProfile.status, 403);
  assert.equal(directProfile.data?.code, "42501");
  assert.equal((await call("/auth/v1/user", a)).status, 200);
  report(stage);

  stage = "global logout revokes the old bearer in Auth";
  assert.equal((await call("/auth/v1/logout?scope=global", a, "POST")).status, 204);
  assert.ok([401, 403].includes((await call("/auth/v1/user", a)).status));
  report(stage);

  stage = "revoked bearer cannot read or mutate PostgREST data";
  for (const table of ["profiles", "beans", "tasting_tags", "blend_components"]) {
    const denied = await call(`/rest/v1/${table}?select=id`, a);
    assert.equal(denied.status, 200);
    assert.deepEqual(denied.data, []);
  }
  const write = await call(`/rest/v1/profiles?id=eq.${users[0].id}`, a, "PATCH", { display_name: "Revoked write must not persist" });
  assert.ok([200, 204, 403].includes(write.status));
  const mutation = await call("/rest/v1/rpc/delete_bean_record", a, "POST", { p_id: beanId });
  assert.equal(mutation.status, 403);
  report(stage);

  stage = "revoked bearer cannot read or mutate through the Go API";
  for (const probe of ["read-canary", "read-profile", "create-canary", "delete-invalid-proof"]) {
    assert.equal((await api(users[0], a, probe)).status, 401);
  }
  report(stage);

  stage = "unrelated session and fresh login retain only legitimate records";
  assert.equal((await call("/auth/v1/user", b)).status, 200);
  assert.equal((await api(users[1], b, "read-profile")).status, 200);
  const fresh = await call("/auth/v1/token?grant_type=password", anonKey, "POST", { email: users[0].email, password: users[0].password });
  assert.equal(fresh.status, 200);
  const list = await api(users[0], fresh.data.access_token, "read-canary");
  assert.equal(list.status, 200);
  assert.deepEqual(list.data.beans.map(bean => bean.id), [beanId]);
  const profile = await api(users[0], fresh.data.access_token, "read-profile");
  assert.equal(profile.status, 200);
  assert.notEqual(profile.data.display_name, "Revoked write must not persist");
  report(stage);
} catch {
  // Do not print assertions: values can contain credentials, session material,
  // or data returned by an unexpected regression. Only stage names leave memory.
  report(stage, "FAIL");
  failures++;
} finally {
  for (const user of users) {
    if (!user.id) continue;
    try {
      assert.equal((await bridge("delete", user)).deleted, true);
      report("disposable account cleanup");
    } catch {
      console.log(JSON.stringify({ check: "disposable account cleanup", status: "FAIL", runId }));
      failures++;
    }
  }
}
process.exitCode = failures ? 1 : 0;
