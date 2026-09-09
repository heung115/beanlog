import { lotConditionalReleases } from "./lot-conditional-releases.ts";
import { isHeldLotSource } from "./lot-source-policy.ts";
import { createHash } from "node:crypto";
import type { OriginSpecialtyLot } from "./types.ts";
import { specialtyProfileById } from "./specialty-research/index.ts";
import { lotPublicationReviews } from "./lot-publication-reviews.ts";

export type LotFactField = "location" | "producer" | "varieties" | "process" | "flavorNotes" | "harvest";
export interface LotPublicationReview {
  key: string;
  regionIds: string[];
  decision: "include-facts" | "hold";
  verifiedFields: LotFactField[];
  sourceUrls: string[];
  corrections?: Partial<Pick<OriginSpecialtyLot, LotFactField>>;
}

export function lotReviewKey(lot: OriginSpecialtyLot): string {
  return createHash("sha256").update(JSON.stringify([
    lot.name, lot.producer || "", lot.location, lot.harvest || "",
    lot.varieties, lot.process || null, lot.flavorNotes,
  ])).digest("hex").slice(0, 16);
}

export function publishLotFacts(lot: OriginSpecialtyLot, review?: LotPublicationReview): OriginSpecialtyLot | null {
  if (!review || review.key !== lotReviewKey(lot) || review.decision !== "include-facts") return null;
  const fields = new Set(review.verifiedFields);
  if (lot.sources.some((source) => isHeldLotSource(source.url))) {
    const release = lotConditionalReleases.find((entry) => entry.key === review.key);
    if (!release || review.corrections ||
        review.regionIds.some((id) => !release.regionIds.includes(id)) ||
        review.verifiedFields.some((field) => !release.verifiedFields.includes(field)) ||
        review.sourceUrls.some((url) => !release.sourceUrls.includes(url)) ||
        lot.sources.length !== release.originalSourceUrls.length ||
        lot.sources.some((source) => !release.originalSourceUrls.includes(source.url))) return null;
  }
  const sources = lot.sources.filter((source) => review.sourceUrls.includes(source.url));
  if (!fields.has("location") || !sources.length) return null;
  if (!["varieties", "process", "flavorNotes"].some((field) => fields.has(field as LotFactField))) return null;
  const facts = { ...lot, ...review.corrections };
  return {
    name: facts.name.split(/\s[—–]\s/)[0],
    location: facts.location,
    ...(fields.has("producer") && facts.producer ? { producer: facts.producer } : {}),
    varieties: fields.has("varieties") ? facts.varieties : [],
    ...(fields.has("process") && facts.process ? { process: facts.process } : {}),
    flavorNotes: fields.has("flavorNotes") ? facts.flavorNotes : { ko: [], en: [] },
    ...(fields.has("harvest") && facts.harvest ? { harvest: facts.harvest } : {}),
    sources,
  };
}

const reviewsByKey = new Map(lotPublicationReviews.map((review) => [review.key, review]));
export function getPublishedLots(regionId: string): OriginSpecialtyLot[] {
  return (specialtyProfileById.get(regionId)?.lots ?? []).flatMap((lot) => {
    const review = reviewsByKey.get(lotReviewKey(lot));
    if (!review?.regionIds.includes(regionId)) return [];
    const published = publishLotFacts(lot, review);
    return published ? [published] : [];
  });
}
