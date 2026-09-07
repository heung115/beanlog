import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { RecoveryProofStore, verifiedRecoveryIdentity } from "../src/lib/security/recovery-proof-store.ts";

const now = Date.now();
const identity = { userId: "user-a", sessionId: "session-a" };
const claims = { sub: identity.userId, session_id: identity.sessionId, exp: Math.floor(now / 1000) + 3600, amr: [{ method: "recovery", timestamp: Math.floor(now / 1000) }] };
const token = (payload) => `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;

test("Auth-verified recovery claims require a recent recovery method, subject, session and expiry", () => {
  assert.deepEqual(verifiedRecoveryIdentity(token(claims), identity.userId, true, now), identity);
  for (const patch of [
    { sub: "other" }, { session_id: null }, { exp: 0 }, { amr: [] },
    { amr: [{ method: "password", timestamp: Math.floor(now / 1000) }] },
    { amr: [{ method: "recovery", timestamp: Math.floor(now / 1000) - 601 }] },
    { amr: [{ method: "recovery", timestamp: Math.floor(now / 1000) + 60 }] },
  ]) assert.equal(verifiedRecoveryIdentity(token({ ...claims, ...patch }), identity.userId, true, now), null);
});

test("proofs bind user and session, expire, and are consumed once across independent worker stores", async () => {
  const directory = await mkdtemp(join(tmpdir(), "beanmap-proof-test-"));
  try {
    const a = new RecoveryProofStore(directory);
    const b = new RecoveryProofStore(directory);
    const proof = await a.issue(identity);
    assert.equal((await stat(join(directory, proof))).mode & 0o777, 0o600);
    assert.equal(await b.check(proof, { ...identity, userId: "other" }, true), false);
    assert.equal(await b.check(proof, { ...identity, sessionId: "other" }, true), false);
    assert.equal(await b.check("../invalid", identity, true), false);
    assert.equal(await b.check(proof, identity), true);
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => (i % 2 ? a : b).check(proof, identity, true)));
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(await a.check(proof, identity), false);
    const expired = await a.issue(identity, now - 601_000);
    assert.equal(await b.check(expired, identity, true, now), false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
