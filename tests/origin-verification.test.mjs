import assert from 'node:assert/strict';
import test from 'node:test';
import { originRegionGuides } from '../src/data/origin-guides/index.ts';

test('every regional profile identifies the scope and sources of its flavor notes', () => {
  for (const guide of originRegionGuides) {
    const review = guide.verification;
    assert.ok(review, guide.id);
    assert.match(review.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(['regional', 'lot', 'mixed'].includes(review.flavorBasis), guide.id);
    assert.ok(review.flavorContext.ko.trim() && review.flavorContext.en.trim(), guide.id);
    assert.ok(review.flavorSourceUrls.length > 0, guide.id);
    assert.equal(new Set(review.flavorSourceUrls).size, review.flavorSourceUrls.length, guide.id);
    for (const url of review.flavorSourceUrls) {
      assert.ok(guide.sources.some(source => source.url === url), `${guide.id}: evidence must have source metadata`);
    }
  }
});
