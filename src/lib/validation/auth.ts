export type RegistrationField = "displayName" | "password" | "passwordConfirm" | "acceptedTerms";
export type RegistrationIssue = {
  error: "display_name_required" | "password_length" | "password_mismatch" | "agreement_required";
  field: RegistrationField;
};

/** Read the submitted native values, including edits made before hydration. */
export function validateRegistrationFields(values: FormData): RegistrationIssue | null {
  if (!String(values.get("displayName") ?? "").trim()) {
    return { error: "display_name_required", field: "displayName" };
  }
  const password = String(values.get("password") ?? "");
  if (password.length < 6 || password.length > 128) {
    return { error: "password_length", field: "password" };
  }
  if (password !== String(values.get("passwordConfirm") ?? "")) {
    return { error: "password_mismatch", field: "passwordConfirm" };
  }
  if (values.get("acceptedTerms") !== "on") {
    return { error: "agreement_required", field: "acceptedTerms" };
  }
  return null;
}

export function validateNewPassword(values: FormData) {
  const password = String(values.get("password") ?? "");
  if (password.length < 6 || password.length > 128) {
    return { error: "password_length", field: "password" } as const;
  }
  if (password !== String(values.get("passwordConfirm") ?? "")) {
    return { error: "password_mismatch", field: "passwordConfirm" } as const;
  }
  return null;
}
