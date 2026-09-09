import { africaVarietyEvidence } from "./africa.ts";
import { southVarietyEvidence } from "./south.ts";
import { centralVarietyEvidence } from "./central.ts";
import { asiaVarietyEvidence } from "./asia.ts";
import { additionalVarietyEvidence } from "./additional.ts";

export const originVarietyEvidence = [
  ...africaVarietyEvidence, ...southVarietyEvidence, ...centralVarietyEvidence,
  ...asiaVarietyEvidence, ...additionalVarietyEvidence,
];
