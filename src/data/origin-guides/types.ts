export interface OriginGuideText {
  ko: string;
  en: string;
}

export interface OriginGuideSource {
  title: string;
  url: string;
  publisher: string;
  accessedAt: string;
}

export interface OriginVarietyEvidence {
  regionId: string;
  variety: string;
  producer?: string;
  sources: OriginGuideSource[];
}

export interface OriginGuideVerification {
  reviewedAt: string;
  flavorBasis: "regional" | "lot" | "mixed";
  flavorContext: OriginGuideText;
  flavorSourceUrls: string[];
}

/** Coffee-trade geography; parentId is a browsing relationship, not an administrative assertion. */
export interface OriginRegionGuide {
  id: string;
  country: string;
  name: string;
  nameKo: string;
  kind: "region" | "microregion";
  parentId?: string;
  aliases: string[];
  summary: OriginGuideText;
  environment: OriginGuideText;
  // Omit when a regional range cannot be verified; never inherit a country range.
  altitude?: { min: number; max: number };
  flavorNotes: { ko: string[]; en: string[] };
  varieties: string[];
  processes: { ko: string[]; en: string[] };
  specialty: OriginGuideText;
  sources: OriginGuideSource[];
  verification: OriginGuideVerification;
}

export interface OriginSpecialtyLot {
  name: string;
  producer?: string;
  location: string;
  varieties: string[];
  process?: OriginGuideText;
  flavorNotes: { ko: string[]; en: string[] };
  harvest?: string;
  sources: OriginGuideSource[];
}

export interface OriginSpecialtyProfile {
  regionId: string;
  priority: "focus" | "standard" | "background";
  /** Internal editorial reasoning, never a cup score or public methodology paragraph. */
  rationale: string;
  sources: OriginGuideSource[];
  lots: OriginSpecialtyLot[];
}
