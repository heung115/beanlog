'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root='/usr/src/app', patched='/opt/beanmap-meta-runtime/node_modules';
const versions={fastify:'5.12.3','find-my-way':'9.9.0','@fastify/cors':'11.3.0','@fastify/swagger':'9.8.1','fastify-metrics':'12.1.0'};
for(const [name,version] of Object.entries(versions)){
 const target=path.join(root,'node_modules',name),source=path.join(patched,name);
 assert.equal(JSON.parse(fs.readFileSync(path.join(source,'package.json'))).version,version);
 assert(fs.existsSync(target),`Expected existing ${name}`);
 fs.rmSync(target,{recursive:true,force:true});fs.symlinkSync(source,target,'dir');
}
const file=path.join(root,'dist/server/server.js');let code=fs.readFileSync(file,'utf8');
for(const factory of ['buildApp','buildAdminApp']){
 const old=`${factory}({ logger })`;assert.equal(code.split(old).length-1,1);
 code=code.replace(old,`${factory}({ loggerInstance: logger })`);
}
fs.writeFileSync(file,code);
const manifest=path.join(root,'package.json'),pkg=JSON.parse(fs.readFileSync(manifest));
for(const [name,version] of Object.entries(versions))if(pkg.dependencies[name])pkg.dependencies[name]=version;
fs.writeFileSync(manifest,JSON.stringify(pkg,null,2)+'\n');
// The independent patch lock records the replacement graph. Obsolete npm
// installation caches cannot describe the now-overlaid runtime faithfully.
for(const file of ['package-lock.json','node_modules/.package-lock.json'])fs.rmSync(path.join(root,file),{force:true});
console.log('Meta runtime overlay and Fastify logger migration verified');
