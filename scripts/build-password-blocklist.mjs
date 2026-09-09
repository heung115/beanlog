// Offline, deterministic generation from the pinned MIT-licensed public corpus.
// Download the source listed in password-policy.md separately; never supply user
// passwords or a credential export. Only the public source checksum is accepted.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const expected = "424a3e03a17df0a2bc2b3ca749d81b04e79d59cb7aeec8876a5a3f308d0caf51";
const file = process.argv[2];
if (!file || process.argv.length !== 3) throw new Error("Usage: node scripts/build-password-blocklist.mjs PATH_TO_PINNED_PUBLIC_CORPUS");
const raw = readFileSync(file);
if (createHash("sha256").update(raw).digest("hex") !== expected) throw new Error("Unexpected public corpus checksum; no output written");
const entries = raw.toString("utf8").replace(/^\uFEFF/, "").split(/\r?\n/)
  .filter((value) => Array.from(value).length >= 15 && Buffer.byteLength(value, "utf8") <= 72);
// Public examples and long trivial values supplement the compromised corpus.
entries.push("correct horse battery staple", "correcthorsebatterystaple", "passwordpassword", "12345678901234567890");
const hashes = [...new Set(entries.map((value) => createHash("sha256").update(value.normalize("NFKC").toLowerCase()).digest("hex")))].sort();
writeFileSync(new URL("../src/lib/security/password-blocklist.ts", import.meta.url),
  "// Generated from the MIT-licensed SecLists corpus; see password-policy.md.\n// SHA-256 hashes of complete NFKC/lowercase entries, never account credentials.\nexport const compromisedPasswordHashes: readonly string[] = " + JSON.stringify(hashes, null, 2) + ";\n");
console.log(`Public blocklist generated: ${hashes.length} hashes; credential values omitted.`);
