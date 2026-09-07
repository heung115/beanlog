import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Report file names only; never print matching credentials or source lines.
export function hasSecretPattern(value) {
  return /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|GOCSPX-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk_live_[A-Za-z0-9]{16,}|sk-[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(value);
}

export function scanTrackedFiles(root) {
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
  const findings = [];
  for (const file of files) {
    const sensitivePath = /\.(?:secret|pem|key|p12|pfx|har|log)(?:\.|$)|(?:^|\/)\.env(?:\.|$)/i.test(file)
      && !/(?:^|\/)\.env\.example$/.test(file);
    const value = readFileSync(path.join(root, file));
    if (sensitivePath || (!value.includes(0) && hasSecretPattern(value.toString("utf8")))) findings.push(file);
  }
  return findings;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const findings = scanTrackedFiles(path.resolve(fileURLToPath(new URL("..", import.meta.url))));
  if (findings.length) {
    console.error(`Sensitive file or credential pattern detected (paths only):\n${findings.join("\n")}`);
    process.exitCode = 1;
  } else console.log("Tracked files pass sensitive-path and credential-pattern checks.");
}
