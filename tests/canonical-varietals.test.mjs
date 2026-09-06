import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalVarietal,canonicalizeVarietals,splitCanonicalVarietals,trimCoffeeWhitespace,VARIETAL_ALIASES} from '../src/lib/coffee/canonical-varietals.ts';
test('both labels of every catalog varietal store the same canonical value',()=>{
  for(const[en,ko]of VARIETAL_ALIASES){assert.equal(canonicalVarietal(ko),en);assert.equal(canonicalVarietal(en.toUpperCase()),en);}
});
test('legacy Unicode whitespace produces the same option and exact-filter value as Go',()=>{
  const whitespace='\t\n\v\f\r \u0085\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000';
  assert.equal(canonicalVarietal(whitespace+'게이샤'+whitespace),'Geisha');
  assert.equal(trimCoffeeWhitespace(whitespace+'QA Unicode'+whitespace),'QA Unicode');
  // BOM is stripped by JS trim(), but is not whitespace in Go or PostgreSQL's
  // option normalizer. Preserve it instead of creating an unselectable option.
  assert.equal(canonicalVarietal('\ufeffGeisha\ufeff'),'\ufeffGeisha\ufeff');
});
test('multiple varietals normalize labels and remove aliases without losing custom names',()=>{
  assert.equal(canonicalizeVarietals('게이샤, Geisha，버본, bourbon, Custom Cultivar'),'Geisha, Bourbon, Custom Cultivar');
  assert.deepEqual(splitCanonicalVarietals('  New Selection, new selection '),['New Selection']);
});
