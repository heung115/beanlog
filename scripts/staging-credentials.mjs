import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const CREDENTIALS_FILE_NAME = "qa-credentials.secret";

function credentialFile(runtimeRoot) {
  return path.join(runtimeRoot, CREDENTIALS_FILE_NAME);
}

function validateCredentials(value) {
  for (const account of [value?.primary, value?.isolation, value?.empty]) {
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
  const value = JSON.parse(fs.readFileSync(file, "utf8"));
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
  if (value.empty) validateCredentials(value);
  return value;
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
    let credentials = readCredentials(file);
    if (!credentials.empty) {
      credentials = { ...credentials, empty: newAccount("empty") };
      fs.writeFileSync(file, `${JSON.stringify(credentials)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
    }
    fs.chmodSync(file, 0o600);
    return validateCredentials(credentials);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const credentials = {
    primary: newAccount("primary"),
    isolation: newAccount("isolation"),
    empty: newAccount("empty"),
  };

  try {
    fs.writeFileSync(file, `${JSON.stringify(credentials)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    return ensureQaCredentials(runtimeRoot);
  }

  fs.chmodSync(file, 0o600);
  return credentials;
}
