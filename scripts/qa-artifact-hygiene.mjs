import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOTS = ["test-results", "qa-report", "playwright-report"];
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** Only generated report roots; never follow symlinks or inspect file contents. */
export function prepareQaArtifacts(root, now = Date.now()) {
  const counts = { removed: 0, protected: 0 };
  function visit(entry) {
    let stat;
    try { stat = fs.lstatSync(entry); } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    if (stat.isSymbolicLink()) return;
    if (stat.isDirectory()) {
      fs.chmodSync(entry, 0o700);
      for (const child of fs.readdirSync(entry)) visit(path.join(entry, child));
    } else if (stat.isFile()) {
      if (now - stat.mtimeMs > RETENTION_MS) {
        fs.unlinkSync(entry);
        counts.removed++;
      } else {
        fs.chmodSync(entry, 0o600);
        counts.protected++;
      }
    }
  }
  for (const name of ROOTS) visit(path.join(root, name));
  return counts;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(prepareQaArtifacts(path.resolve(fileURLToPath(new URL("..", import.meta.url))))));
}
