import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const CREDENTIALS_FILE_NAME = "qa-credentials.secret";

function credentialFile(runtimeRoot) {
  return path.join(runtimeRoot, CREDENTIALS_FILE_NAME);
}

function validateCredentials(value) {
  for (const account of [value?.primary, value?.isolation]) {
    if (
      typeof account?.email !== "string" ||
      !account.email.endsWith("@local.test") ||
      typeof account?.password !== "string" ||
      account.password.length < 24
    ) {
      throw new Error("Staging QA credentials are invalid.");
    }
  }
  return value;
}

function readCredentials(file) {
  return validateCredentials(JSON.parse(fs.readFileSync(file, "utf8")));
}

function newAccount(label) {
  const suffix = randomBytes(12).toString("hex");
  return {
    email: `beanmap-qa-${label}-${suffix}@local.test`,
    password: randomBytes(32).toString("base64url"),
  };
}

export function ensureQaCredentials(runtimeRoot) {
  const file = credentialFile(runtimeRoot);
  fs.mkdirSync(runtimeRoot, { recursive: true });

  try {
    const credentials = readCredentials(file);
    fs.chmodSync(file, 0o600);
    return credentials;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const credentials = {
    primary: newAccount("primary"),
    isolation: newAccount("isolation"),
  };

  try {
    fs.writeFileSync(file, `${JSON.stringify(credentials)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    return readCredentials(file);
  }

  fs.chmodSync(file, 0o600);
  return credentials;
}
