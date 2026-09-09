import { compromisedPasswordHashes } from "./password-blocklist.ts";

export const NEW_PASSWORD_MIN_CHARACTERS = 15;
// Auth v2.195.0 checks bcrypt's byte limit before hashing. Do not advertise or
// silently truncate values that the identity service cannot actually store.
export const NEW_PASSWORD_MAX_BYTES = 72;
export type NewPasswordIssue = "password_length" | "password_compromised";
const blocked = new Set(compromisedPasswordHashes);

/** Checks new credentials locally; never used to reject an existing login. */
export async function newPasswordIssue(password: unknown): Promise<NewPasswordIssue | null> {
  if (typeof password !== "string" || !password.isWellFormed()
    || Array.from(password).length < NEW_PASSWORD_MIN_CHARACTERS
    || new TextEncoder().encode(password).length > NEW_PASSWORD_MAX_BYTES) {
    return "password_length";
  }
  // Normalization is for whole-value blocklist comparison only. The caller
  // forwards the exact original credential to Auth, including Unicode/spaces.
  const comparison = password.normalize("NFKC").toLowerCase();
  const characters = Array.from(comparison);
  if (characters.every((character) => character === characters[0])) return "password_compromised";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(comparison));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return blocked.has(hash) ? "password_compromised" : null;
}
