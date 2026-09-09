import { roasterNewSpecialtyProfiles } from "./roaster-new.ts";
import { productDiscoveryProfiles } from "./product-discovery.ts";
import { africaSpecialtyProfiles } from "./africa.ts";
import { southSpecialtyProfiles } from "./south.ts";
import { centralSpecialtyProfiles } from "./central.ts";
import { asiaSpecialtyProfiles } from "./asia.ts";
import { additionalSpecialtyProfiles } from "./additional.ts";
import { buildSpecialtyIndex } from "./model.ts";
import type { OriginSpecialtyProfile, OriginVarietyEvidence } from "../types.ts";

export const originSpecialtyProfiles: OriginSpecialtyProfile[] = [
  ...africaSpecialtyProfiles,
  ...southSpecialtyProfiles,
  ...centralSpecialtyProfiles,
  ...asiaSpecialtyProfiles,
  ...additionalSpecialtyProfiles,
  ...roasterNewSpecialtyProfiles,
  ...productDiscoveryProfiles,
];

export const specialtyProfileById = buildSpecialtyIndex(originSpecialtyProfiles);

export const specialtyVarietyEvidence: OriginVarietyEvidence[] = originSpecialtyProfiles.flatMap((profile) =>
  profile.lots.flatMap((lot) => lot.varieties.map((variety) => ({
    regionId: profile.regionId, variety, producer: lot.producer, sources: lot.sources,
  }))),
);
