'use strict';
const {execFileSync}=require('node:child_process');
const lines=execFileSync('dpkg-query',['-W','-f=${binary:Package}\t${db:Status-Abbrev}\n'],{encoding:'utf8'}).trim().split('\n');
const names=lines.filter(line=>line.split('\t')[1]?.startsWith('ii')).map(line=>line.split('\t')[0]).filter(name=>{
 const base=name.split(':')[0];return base.endsWith('-dev')||/^(gcc|g\+\+|cpp)(-\d+)?$/.test(base)||['make','build-essential','libc-dev-bin','dpkg-dev'].includes(base);
});
if(names.length)execFileSync('apt-get',['purge','--yes',...names],{stdio:'inherit'});
const installed=execFileSync('dpkg-query',['-W','-f=${binary:Package}\t${db:Status-Abbrev}\n'],{encoding:'utf8'});
if(installed.split('\n').some(line=>line.startsWith('linux-libc-dev')&&line.split('\t')[1]?.startsWith('ii')))throw Error('Kernel headers remain');
console.log('Removed build-only packages: '+names.length);
