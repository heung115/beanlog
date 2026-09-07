import assert from 'node:assert/strict';
import test from 'node:test';
import { labelTableRows } from '../src/lib/coffee/bean-label-table-layout.ts';
const row=(text,x,y,width=90,height=20,confidence=96)=>({text,bbox:{x0:x,x1:x+width,y0:y,y1:y+height},confidence,words:[{text,confidence}]});
test('parallel field headers read the value in their own column',()=>{
  const source=[row('PROCESS',20,100),row('VARIETY',190,100),row('Washed',20,126),row('Various',190,126)];
  const before=structuredClone(source);
  assert.deepEqual(labelTableRows(source).map(r=>r.text),['PROCESS Washed','VARIETY Various']);
  assert.deepEqual(source,before);
});
test('low confidence and intervening text cannot be skipped to a desired value',()=>{
  for(const first of [row('Unreadable',20,126,90,20,40),row('Country:',20,126)]){
    const source=[row('PROCESS',20,100),row('VARIETY',190,100),first,row('Gesha',190,126),row('Washed',20,151)];
    assert.deepEqual(labelTableRows(source),source);
  }
});
test('one heading cannot reclassify a separate column or a distant value',()=>{
  for(const source of [
    [row('PROCESS',20,100),row('Washed',20,126)],
    [row('PROCESS',20,100),row('VARIETY',190,100),row('Washed',20,170),row('Gesha',190,170)],
    [row('PROCESS',20,100),row('VARIETY',190,100),row('Washed Gesha',20,126,280)],
  ])assert.deepEqual(labelTableRows(source),source);
});
test('all column pairs survive scaling and translation with source text intact',()=>{
  const rows=[row('가공방식:',20,100),row('품종:',190,100),row('Natural',20,126),row('74158',190,126)];
  for(const scale of [.5,1,4]){
    const transformed=rows.map(r=>({...r,bbox:Object.fromEntries(Object.entries(r.bbox).map(([k,v])=>[k,v*scale+70]))}));
    assert.deepEqual(labelTableRows(transformed).map(r=>r.text),['가공방식: Natural','품종: 74158']);
  }
});
