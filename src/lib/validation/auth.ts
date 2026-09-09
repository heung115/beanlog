import { newPasswordIssue } from "../security/password-policy.ts";

export type RegistrationField = "displayName" | "password" | "passwordConfirm" | "acceptedTerms";
export type RegistrationIssue = {
  error: "display_name_required" | "password_length" | "password_compromised" | "password_mismatch" | "agreement_required";
  field: RegistrationField;
};

/** Read the submitted native values, including edits made before hydration. */
export async function validateRegistrationFields(values: FormData): Promise<RegistrationIssue | null> {
  if (!String(values.get("displayName") ?? "").trim()) {
    return { error: "display_name_required", field: "displayName" };
  }
  const password = String(values.get("password") ?? "");
  const issue = await newPasswordIssue(password);
  if (issue) return { error: issue, field: "password" };
  if (password !== String(values.get("passwordConfirm") ?? "")) {
    return { error: "password_mismatch", field: "passwordConfirm" };
  }
  if (values.get("acceptedTerms") !== "on") {
    return { error: "agreement_required", field: "acceptedTerms" };
  }
  return null;
}

export async function validateNewPassword(values: FormData) {
  const password = String(values.get("password") ?? "");
  const issue = await newPasswordIssue(password);
  if (issue) return { error: issue, field: "password" } as const;
  if (password !== String(values.get("passwordConfirm") ?? "")) {
    return { error: "password_mismatch", field: "passwordConfirm" } as const;
  }
  return null;
}
