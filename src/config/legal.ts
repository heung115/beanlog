import { LEGAL_EFFECTIVE_DATE } from "@/config/legal-version";

const configuredOperatorName = process.env.LEGAL_OPERATOR_NAME?.trim();
const configuredOperatorNameEn = process.env.LEGAL_OPERATOR_NAME_EN?.trim();
const configuredContactEmail = process.env.LEGAL_CONTACT_EMAIL?.trim();

export const legal = {
  effectiveDate: LEGAL_EFFECTIVE_DATE,
  operatorName: configuredOperatorName || "beanmap 운영팀",
  operatorNameEn: configuredOperatorNameEn || configuredOperatorName || "beanmap team",
  contactEmail: configuredContactEmail || "",
  oraclePrivacyUrl: "https://www.oracle.com/kr/legal/privacy/services-privacy-policy/",
} as const;
