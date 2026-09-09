import fs from 'node:fs';
import { lotReviewKey } from '../src/data/origin-guides/lot-publication.ts';
import { isHeldLotSource } from '../src/data/origin-guides/lot-source-policy.ts';
import { originSpecialtyProfiles } from '../src/data/origin-guides/specialty-research/index.ts';

import { lotConditionalReleases } from '../src/data/origin-guides/lot-conditional-releases.ts';

const audit = JSON.parse(fs.readFileSync(new URL('../src/data/origin-guides/audits/lot-review-2026-09-09.json', import.meta.url), 'utf8'));
const live = new Map();
for (const profile of originSpecialtyProfiles) for (const lot of profile.lots) {
  const key = lotReviewKey(lot);
  const entry = live.get(key) ?? { lot, regions: new Set() };
  entry.regions.add(profile.regionId);
  live.set(key, entry);
}
const reviews = [];
for (const row of audit.rows) {
  if (row.publicationDecision !== 'include-facts') continue;
  if (!['verified', 'partial'].includes(row.status) || row.rightsStatus === 'restriction-found') throw new Error(`Unreviewed publication: ${row.key}`);
  const current = live.get(row.key);
  if (!current || lotReviewKey(row.lot) !== row.key || current.lot.sources.some(source => isHeldLotSource(source.url))) continue;
  const regionIds = row.regions.map(region => region.id).filter(id => current.regions.has(id));
  const sourceUrls = current.lot.sources.map(source => source.url).filter(url => row.checkedUrls.includes(url));
  const verifiedFields = row.publishedFields;
  if (!regionIds.length || !sourceUrls.length || !verifiedFields.includes('location')) continue;
  const supportedFields = new Set([...(row.verifiedFields ?? []), ...Object.keys(row.acceptedCorrection?.fields ?? {})]);
  if (verifiedFields.some(field => !supportedFields.has(field))) throw new Error(`Unsupported publication field: ${row.key}`);
  reviews.push({ key: row.key, regionIds, decision: 'include-facts', verifiedFields, sourceUrls,
    ...(row.acceptedCorrection ? { corrections: row.acceptedCorrection.fields } : {}) });
}
for (const release of lotConditionalReleases) {
  const row = audit.rows.find(row => row.key === release.key);
  const current = live.get(release.key);
  if (!row || !current || lotReviewKey(row.lot) !== release.key || release.corrections ||
      release.decision !== 'include-facts' || !release.verifiedFields.includes('location') ||
      release.verifiedFields.some(field => !row.verifiedFields.includes(field)) ||
      release.regionIds.some(id => !current.regions.has(id) || !row.regions.some(region => region.id === id)) ||
      release.sourceUrls.some(url => !row.checkedUrls.includes(url)) ||
      current.lot.sources.length !== release.originalSourceUrls.length ||
      current.lot.sources.some(source => !release.originalSourceUrls.includes(source.url))) {
    throw new Error(`Conditional release no longer matches reviewed evidence: ${release.key}`);
  }
  if (reviews.some(review => review.key === release.key)) throw new Error(`Duplicate release: ${release.key}`);
  reviews.push({ key: release.key, regionIds: release.regionIds, decision: release.decision,
    verifiedFields: release.verifiedFields, sourceUrls: release.sourceUrls });
}
fs.writeFileSync(new URL('../src/data/origin-guides/lot-publication-reviews.ts', import.meta.url),
  'import type { LotPublicationReview } from "./lot-publication.ts";\n\nexport const lotPublicationReviews: LotPublicationReview[] = ' + JSON.stringify(reviews, null, 2) + ';\n');
console.log(`Published factual reviews: ${reviews.length}`);
