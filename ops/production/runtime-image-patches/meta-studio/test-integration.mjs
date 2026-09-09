import assert from 'node:assert/strict';
const base='http://127.0.0.1:8080', pg='postgresql://postgres:isolated-fixture-only@fixture-db:5432/postgres';
let count=0;
async function request(path,method='GET',body,expected=200){
 const r=await fetch(base+path,{method,headers:{pg,...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
 const text=await r.text();assert.equal(r.status,expected,`${method} ${path}: ${text.slice(0,200)}`);count++;try{return JSON.parse(text)}catch{return text}
}
for(let i=0;i<40;i++){try{await fetch(base+'/health');break}catch{await new Promise(r=>setTimeout(r,500))}}
await request('/health');await request('/');
assert.deepEqual(await request('/query','POST',{query:'select $1::integer as value',parameters:[42]}),[{value:42}]);
await request('/schemas','POST',{name:'patch_fixture'});
assert((await request('/schemas')).some(x=>x.name==='patch_fixture'));
const table=await request('/tables','POST',{schema:'patch_fixture',name:'items'});
assert(Number.isInteger(table.id));
const column=await request('/columns','POST',{table_id:table.id,name:'label',type:'text'});
assert.equal(column.name,'label');
await request(`/tables/${table.id}`);
assert((await request('/tables?included_schemas=patch_fixture')).some(x=>x.id===table.id));
await request('/query','POST',{query:"insert into patch_fixture.items(label) values ('one')"});
assert.deepEqual(await request('/query','POST',{query:'select label from patch_fixture.items'}),[{label:'one'}]);
await request('/query','POST',{query:"update patch_fixture.items set label='two'"});
assert.deepEqual(await request('/query','POST',{query:'select label from patch_fixture.items'}),[{label:'two'}]);
await request('/query/parse','POST',{query:'select 1'});
await request('/query/format','POST',{query:'select 1'});
await request('/query','POST',{query:'delete from patch_fixture.items'});
assert.deepEqual(await request('/query','POST',{query:'select label from patch_fixture.items'}),[]);
await request(`/tables/${table.id}`,'DELETE');
await request('/query','POST',{query:'drop schema patch_fixture'});
const metrics=await fetch('http://127.0.0.1:8081/metrics');assert.equal(metrics.status,200);
console.log(JSON.stringify({result:'PASS',metaHttpCases:count,realPostgresCRUD:true,parameterQuery:true,parser:true,metrics:true}));
