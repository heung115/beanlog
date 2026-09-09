'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const app=createRequire('/app/apps/studio/server.js'),next=createRequire(app.resolve('next'));
const original=path.dirname(next.resolve('sharp/package.json'));
assert.equal(JSON.parse(fs.readFileSync(path.join(original,'package.json'))).version,'0.34.5');
assert(original.startsWith('/app/node_modules/.pnpm/sharp@0.34.5/'));
const target='/opt/beanmap-studio-runtime/node_modules/sharp';
assert.equal(JSON.parse(fs.readFileSync(path.join(target,'package.json'))).version,'0.35.4');
fs.rmSync(original,{recursive:true});fs.symlinkSync(target,original,'dir');
// Only sharp's obsolete prebuilt native binaries are removed. Existing Next
// links retain their path, but resolve the new locked sharp installation.
const store='/app/node_modules/.pnpm';let removed=0;
for(const entry of fs.readdirSync(store))if(entry.startsWith('@img+sharp-')){fs.rmSync(path.join(store,entry),{recursive:true});removed++;}
assert(removed>=2);
console.log('Studio Next-resolved Sharp overlay verified; obsolete native packages removed');
