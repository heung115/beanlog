import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { newPasswordIssue, NEW_PASSWORD_MIN_CHARACTERS, NEW_PASSWORD_MAX_BYTES } from "../src/lib/security/password-policy.ts";
import { compromisedPasswordHashes } from "../src/lib/security/password-blocklist.ts";
import { validateRegistrationFields, validateNewPassword } from "../src/lib/validation/auth.ts";

function fields(password) {
  const result = new FormData();
  for (const [key, value] of Object.entries({ displayName: "Fixture", password, passwordConfirm: password, acceptedTerms: "on" })) result.set(key, value);
  return result;
}

test("new credentials require fifteen Unicode characters and respect Auth's actual byte limit", async () => {
  assert.equal(NEW_PASSWORD_MIN_CHARACTERS, 15);
  assert.equal(NEW_PASSWORD_MAX_BYTES, 72);
  for (const value of [undefined, null, 123456, "123456", "aB7xQ2".repeat(2), "한글비밀번호열넷자미만", "🫘".repeat(14), "a".repeat(73), "다".repeat(25), "\ud800".repeat(15)]) {
    assert.equal(await newPasswordIssue(value), "password_length");
  }
});

test("normal passphrases, Unicode, spaces and at least sixty-four ASCII characters work", async () => {
  for (const value of ["Juniper lanterns drift beyond rivers", "새벽의 커피와 조용한 창가의 빛", "🫘☕🌄🌿🍂🌧️🌙✨🌻🌊🌲🍃🌅🏡🫖", "  Copper garden under violet skies  ", "0123456789AbCdEf-".repeat(4), "Copper garden under violet skies".padEnd(72, " ")]) {
    assert.equal(await newPasswordIssue(value), null);
    assert.equal(await validateRegistrationFields(fields(value)), null);
    assert.equal(await validateNewPassword(fields(value)), null);
  }
});

test("complete common, compromised and repeated values are rejected locally on both forms", async () => {
  assert.ok(compromisedPasswordHashes.length >= 10000);
  for (const value of ["passwordpassword", "PASSWORDPASSWORD", "ｐａｓｓｗｏｒｄｐａｓｓｗｏｒｄ", "12345678901234567890", "correct horse battery staple", "a".repeat(64), "한".repeat(15)]) {
    assert.equal(await newPasswordIssue(value), "password_compromised");
    assert.deepEqual(await validateRegistrationFields(fields(value)), { error: "password_compromised", field: "password" });
    assert.deepEqual(await validateNewPassword(fields(value)), { error: "password_compromised", field: "password" });
  }
  // A blocklist matches the full value, not arbitrary dictionary substrings.
  assert.equal(await newPasswordIssue("My passwordpassword vase drifts at dusk"), null);
});

test("the blocklist contains only digests and password checks do not send requests", async () => {
  assert.ok(compromisedPasswordHashes.every((entry) => /^[a-f0-9]{64}$/.test(entry)));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("Password policy attempted a network request"); };
  try { assert.equal(await newPasswordIssue("Copper garden under violet skies"), null); }
  finally { globalThis.fetch = originalFetch; }
});

test("registration and reset keep exact Unicode/whitespace confirmation and allow paste", async () => {
  const data = fields("  Copper garden under violet skies  ");
  data.set("passwordConfirm", "Copper garden under violet skies");
  for (const validate of [validateRegistrationFields, validateNewPassword]) {
    assert.deepEqual(await validate(data), { error: "password_mismatch", field: "passwordConfirm" });
  }
  for (const path of ["src/app/[locale]/signup/page.tsx", "src/components/auth/password-recovery-form.tsx"]) {
    const source = readFileSync(path, "utf8");
    assert.ok(source.includes("minLength={15}"));
    assert.ok(source.includes("maxLength={72}"));
    assert.ok(source.includes('autoComplete="new-password"'));
    assert.doesNotMatch(source, /onPaste|onCopy|onCut/);
  }
});
