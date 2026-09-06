import assert from 'node:assert/strict';
import test from 'node:test';
import {loadExploreWindow} from '../src/lib/coffee/explore-navigation.ts';

test('load more re-reads the prefix after a new record shifts the original first page',async()=>{
  const records=Array.from({length:27},(_,i)=>({id:String(i)}));
  const staleFirstPage=records.slice(0,20);
  records.unshift({id:'new'});
  const calls=[];
  const result=await loadExploreWindow(1,async(page,limit)=>{calls.push({page,limit});return{beans:records.slice(page*limit,(page+1)*limit),count:records.length};});
  assert.deepEqual(calls,[{page:0,limit:40}]);
  assert.deepEqual(result.beans,records);
  assert.equal(new Set(result.beans.map(b=>b.id)).size,28);
  assert.notDeepEqual(result.beans.slice(0,20),staleFirstPage);
});
test('load more re-reads after deletion without skipping the former page boundary',async()=>{
  const records=Array.from({length:30},(_,i)=>({id:String(i)}));records.splice(3,1);
  const result=await loadExploreWindow(1,async(page,limit)=>({beans:records.slice(page*limit,(page+1)*limit),count:records.length}));
  assert.deepEqual(result.beans,records);assert.equal(result.total,29);
});
test('larger restored windows deduplicate overlapping pages and stop at empty data',async()=>{
  const records=Array.from({length:120},(_,i)=>({id:String(i)}));
  const result=await loadExploreWindow(5,async page=>({beans:page===0?records.slice(0,100):[records[99],...records.slice(100)],count:120}));
  assert.equal(result.beans.length,120);assert.equal(new Set(result.beans.map(b=>b.id)).size,120);
  const empty=await loadExploreWindow(10000,async()=>({beans:[],count:99}));assert.deepEqual(empty,{beans:[],total:99});
});
test('failed refresh rejects instead of exposing a partially replaced collection',async()=>{
  await assert.rejects(loadExploreWindow(1,async()=>({beans:[],count:0,error:'offline'})),/Unable to load/);
});
