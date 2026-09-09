import type { OriginGuideSource, OriginGuideText } from "../origin-guides/types.ts";

export interface CoffeeVarietyGuide {
  id: string;
  name: string;
  nameKo: string;
  /** Only spellings explicitly referring to this entry, not genetically distinct descendants. */
  aliases: string[];
  classification: "cultivar" | "selection" | "population" | "trade-name";
  summary: OriginGuideText;
  lineage?: OriginGuideText;
  growing?: OriginGuideText;
  traits?: OriginGuideText;
  sources: OriginGuideSource[];
}
