const configuredOperatorName = process.env.LEGAL_OPERATOR_NAME?.trim();
const configuredContactEmail = process.env.LEGAL_CONTACT_EMAIL?.trim();

export const legal = {
  effectiveDate: "2026-08-26",
  operatorName: configuredOperatorName || "beanmap 운영팀",
  contactEmail: configuredContactEmail || "",
  oraclePrivacyUrl: "https://www.oracle.com/kr/legal/privacy/services-privacy-policy/",
} as const;
