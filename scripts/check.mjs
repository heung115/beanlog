#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fast = process.argv.includes("--fast");
const buildVerificationEnv = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "build-verification-anon-key",
  NEXT_PUBLIC_APP_URL:
    process.env.NEXT_PUBLIC_APP_URL ?? "https://example.com",
};

const checks = [
  { name: "TypeScript", command: "npm", args: ["run", "typecheck"] },
  { name: "ESLint", command: "npm", args: ["run", "lint"] },
  { name: "Node unit tests", command: "npm", args: ["run", "test:node"] },
  { name: "Go race tests", command: "npm", args: ["run", "test:go"] },
  { name: "Go vet", command: "npm", args: ["run", "vet:go"] },
  {
    name: "Go format",
    command: "gofmt",
    args: ["-l", "server"],
    rejectOutput: true,
  },
  {
    name: "Audit harness syntax",
    command: "bash",
    args: ["-n", "scripts/audit.sh"],
  },
  {
    name: "Design policy",
    command: "npm",
    args: ["run", "design:lint"],
    warnOnOutputPattern: /"warnings":\s*[1-9]/,
  },
  { name: "Git whitespace", command: "git", args: ["diff", "--check"] },
  ...(!fast
    ? [{
        name: "Production build",
        command: "npm",
        args: ["run", "build"],
        env: buildVerificationEnv,
      }]
    : []),
];

const results = [];

for (const check of checks) {
  console.log(`\n=== ${check.name} ===`);
  const startedAt = performance.now();
  const captureOutput = check.rejectOutput || check.warnOnOutputPattern;
  const result = spawnSync(check.command, check.args, {
    cwd: root,
    env: check.env ?? process.env,
    stdio: captureOutput ? "pipe" : "inherit",
    encoding: captureOutput ? "utf8" : undefined,
  });
  const duration = ((performance.now() - startedAt) / 1000).toFixed(1);
  const unexpectedOutput = check.rejectOutput && result.stdout?.trim();
  if (captureOutput && result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (captureOutput && result.stderr) {
    process.stderr.write(result.stderr);
  }
  const warning =
    result.status === 0 &&
    !unexpectedOutput &&
    check.warnOnOutputPattern?.test(result.stdout ?? "");
  const status =
    result.status !== 0 || unexpectedOutput ? "FAIL" : warning ? "WARN" : "PASS";
  results.push({ name: check.name, status, duration, error: result.error });

  if (result.error) {
    console.error(`${check.name} could not start: ${result.error.message}`);
  }
}

console.log("\n=== Quality summary ===");
for (const result of results) {
  console.log(`${result.status.padEnd(4)}  ${result.name} (${result.duration}s)`);
}

const failures = results.filter((result) => result.status === "FAIL");
const warnings = results.filter((result) => result.status === "WARN");
if (failures.length > 0) {
  console.error(`\n${failures.length} quality check(s) failed.`);
  process.exitCode = 1;
} else if (warnings.length > 0) {
  console.log(`\nAll checks completed with ${warnings.length} warning group(s).`);
} else {
  console.log(`\nAll ${results.length} quality checks passed${fast ? " (fast mode)" : ""}.`);
}
