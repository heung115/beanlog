import { randomBytes } from "node:crypto";
import { lstat, mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const RECOVERY_PROOF_TTL_SECONDS = 600;
const MAX_PROOFS = 2048;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
export type RecoveryIdentity = { userId: string; sessionId: string };

/** Parse only tokens returned by Auth or validated by getUser(exactToken). */
export function verifiedRecoveryIdentity(accessToken: string, userId: string, requireRecovery = false, now = Date.now()): RecoveryIdentity | null {
  try {
    const claims = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8"));
    if (claims.sub !== userId || typeof claims.session_id !== "string" || !claims.session_id ||
        typeof claims.exp !== "number" || claims.exp * 1000 <= now) return null;
    if (requireRecovery && (!Array.isArray(claims.amr) || !claims.amr.some((entry: { method?: unknown; timestamp?: unknown }) =>
      entry.method === "recovery" && typeof entry.timestamp === "number" &&
      entry.timestamp * 1000 <= now + 30_000 && entry.timestamp * 1000 > now - RECOVERY_PROOF_TTL_SECONDS * 1000))) return null;
    return { userId, sessionId: claims.session_id };
  } catch { return null; }
}

/** The web container's private tmpfs is shared by workers. Missing state fails closed. */
export class RecoveryProofStore {
  private directory: string;

  constructor(directory = join(tmpdir(), `beanmap-recovery-${process.getuid?.() ?? "web"}`)) { this.directory = directory; }

  async issue(identity: RecoveryIdentity, now = Date.now()): Promise<string> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const directoryStat = await lstat(this.directory);
    if (!directoryStat.isDirectory() || (directoryStat.mode & 0o777) !== 0o700 ||
        (process.getuid && directoryStat.uid !== process.getuid())) {
      throw new Error("Recovery proof directory must be private");
    }
    let active = 0;
    for (const name of await readdir(this.directory)) {
      if (!TOKEN_PATTERN.test(name.replace(/\.used$/, ""))) continue;
      const path = join(this.directory, name);
      try {
        if ((await stat(path)).mtimeMs + RECOVERY_PROOF_TTL_SECONDS * 1000 <= now) await unlink(path);
        else active++;
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    }
    if (active >= MAX_PROOFS) throw new Error("Recovery proof capacity reached");
    const token = randomBytes(32).toString("hex");
    await writeFile(join(this.directory, token), JSON.stringify({ ...identity, expiresAt: now + RECOVERY_PROOF_TTL_SECONDS * 1000 }), { flag: "wx", mode: 0o600 });
    return token;
  }

  async check(token: string | undefined, identity: RecoveryIdentity, consume = false, now = Date.now()): Promise<boolean> {
    if (!token || !TOKEN_PATTERN.test(token)) return false;
    const path = join(this.directory, token);
    try {
      const proof = JSON.parse(await readFile(path, "utf8"));
      if (proof.userId !== identity.userId || proof.sessionId !== identity.sessionId ||
          typeof proof.expiresAt !== "number" || proof.expiresAt <= now) return false;
      // Exclusive creation provides one winner across concurrent workers. Keep
      // the consumed marker until expiry; cookie deletion alone is replayable.
      if (consume) {
        await writeFile(`${path}.used`, "", { flag: "wx", mode: 0o600 });
      } else {
        try { await stat(`${path}.used`); return false; } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      }
      return true;
    } catch (error) {
      if (["ENOENT", "EEXIST"].includes((error as NodeJS.ErrnoException).code ?? "") || error instanceof SyntaxError) return false;
      throw error;
    }
  }
}
