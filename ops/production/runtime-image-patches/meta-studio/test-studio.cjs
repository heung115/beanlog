'use strict';
const assert=require('node:assert/strict'),{createRequire}=require('node:module');
const app=createRequire('/app/apps/studio/server.js'),next=createRequire(app.resolve('next')),sharp=next('sharp');
(async()=>{
 assert.equal(sharp.versions.sharp,'0.35.4');
 assert(Number(sharp.versions.vips.split('.')[1])>=18);
 for(const format of ['png','jpeg','webp','avif','tiff','gif']){
  const encoded=await sharp({create:{width:8,height:6,channels:3,background:'#9e7155'}}).toFormat(format).toBuffer();
  const decoded=await sharp(encoded).resize(4,3).png().toBuffer();
  const meta=await sharp(decoded).metadata();assert.equal(meta.width,4);assert.equal(meta.height,3);
 }
 const optimizer=next('next/dist/server/image-optimizer');assert.equal(typeof optimizer.imageOptimizer,'function');
 console.log(JSON.stringify({result:'PASS',node:process.version,next:app('next/package.json').version,sharp:sharp.versions.sharp,libvips:sharp.versions.vips,formats:6,nextImageOptimizerLoaded:true}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
