import assert from 'node:assert/strict';
import test from 'node:test';
import { lotReviewKey, publishLotFacts } from '../src/data/origin-guides/lot-publication.ts';
import { lotConditionalReleases } from '../src/data/origin-guides/lot-conditional-releases.ts';
const lot = { name: 'Farm A — Washed', producer: 'Producer A', location: 'Region A', varieties: ['Bourbon'], process: {ko:'워시드',en:'Washed'}, flavorNotes:{ko:['복숭아'],en:['Peach']},harvest:'2025',sources:[{url:'https://example.org/farm-a',title:'Farm A',publisher:'Farm A',accessedAt:'2026-09-09'}] };
const review = {key:lotReviewKey(lot),regionIds:['test-region'],decision:'include-facts',verifiedFields:['location','varieties'],sourceUrls:[lot.sources[0].url]};
test('unreviewed and held lots are never published',()=>{
  assert.equal(publishLotFacts(lot),null);
  assert.equal(publishLotFacts(lot,{...review,decision:'hold'}),null);
});
test('changed lot facts and missing geographic evidence invalidate publication',()=>{
  assert.equal(publishLotFacts({...lot,location:'Region B'},review),null);
  assert.equal(publishLotFacts(lot,{...review,verifiedFields:['varieties']}),null);
  assert.equal(publishLotFacts(lot,{...review,sourceUrls:['https://example.org/other']}),null);
});
test('only reviewed fields reach the public lot details',()=>{
  const result=publishLotFacts(lot,review);
  assert.deepEqual(result.varieties,['Bourbon']);assert.equal(result.producer,undefined);
  assert.equal(result.process,undefined);assert.equal(result.harvest,undefined);
  assert.deepEqual(result.flavorNotes,{ko:[],en:[]});assert.equal(result.name,'Farm A');
});

test('explicitly restricted sources cannot be published by a mistaken inclusion review',()=>{
  const restricted={...lot,sources:[{...lot.sources[0],url:'https://sucafina.com/na/offerings/example'}]};
  assert.equal(publishLotFacts(restricted,{...review,key:lotReviewKey(restricted),sourceUrls:[restricted.sources[0].url]}),null);
});

test('published reviews have field evidence and never expose a pending or restricted record', async()=>{
  const fs=await import('node:fs');
  const {lotPublicationReviews}=await import('../src/data/origin-guides/lot-publication-reviews.ts');
  const audit=JSON.parse(fs.readFileSync(new URL('../src/data/origin-guides/audits/lot-review-2026-09-09.json',import.meta.url),'utf8'));
  const byKey=new Map(audit.rows.map(row=>[row.key,row]));
  assert.equal(byKey.size,audit.counts.uniqueRecords);
  for(const published of lotPublicationReviews){
    const row=byKey.get(published.key);assert.ok(row,published.key);
    const release=lotConditionalReleases.find(entry=>entry.key===published.key);
    if(release){
      assert.ok(published.verifiedFields.every(field=>row.verifiedFields.includes(field)));
      assert.ok(published.sourceUrls.every(url=>row.checkedUrls.includes(url)));
      assert.ok(publishLotFacts(row.lot,published));
      continue;
    }
    assert.equal(row.publicationDecision,'include-facts');
    assert.ok(['verified','partial'].includes(row.status));
    assert.equal(row.rightsStatus==='restriction-found',false);
    assert.deepEqual(published.verifiedFields,row.publishedFields);
    assert.equal(published.key,lotReviewKey(row.lot));
    assert.deepEqual(published.regionIds,row.regions.map(region=>region.id));
  }
});

 test('conditional releases stay bound to exact facts, sources and verified fields',async()=>{
  const fs=await import('node:fs');
  const audit=JSON.parse(fs.readFileSync(new URL('../src/data/origin-guides/audits/lot-review-2026-09-09.json',import.meta.url),'utf8'));
  assert.equal(lotConditionalReleases.length,8);
  for(const release of lotConditionalReleases){
    const original=audit.rows.find(row=>row.key===release.key).lot;
    const published=publishLotFacts(original,release);
    assert.ok(published);
    assert.deepEqual(published.flavorNotes,{ko:[],en:[]});
    assert.equal(published.harvest,undefined);
    assert.equal(publishLotFacts({...original,location:'Changed location'},release),null);
    assert.equal(publishLotFacts({...original,sources:[...original.sources,{...original.sources[0],url:'https://sucafina.com/new'}]},release),null);
    assert.equal(publishLotFacts(original,{...release,verifiedFields:[...release.verifiedFields,'flavorNotes']}),null);
    assert.equal(publishLotFacts(original,{...release,corrections:{location:'Elsewhere'}}),null);
    assert.deepEqual(published.sources.map(source=>source.url),release.sourceUrls);
  }
  const unreviewed={...lot,sources:[{...lot.sources[0],url:'https://onyxcoffeelab.com/products/unreviewed'}]};
  assert.equal(publishLotFacts(unreviewed,{...review,key:lotReviewKey(unreviewed),sourceUrls:[unreviewed.sources[0].url]}),null);
 });
