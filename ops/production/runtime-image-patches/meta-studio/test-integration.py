#!/usr/bin/env python3
import subprocess, pathlib, time, json, uuid
ROOT=pathlib.Path(__file__).resolve().parent
prefix='beanmap-patch-fixture-'+uuid.uuid4().hex[:12]
owned=[]; network_id=None
label='beanmap.patch.fixture='+prefix
network=prefix+'-net'; db=prefix+'-db'; meta=prefix+'-meta'; studio=prefix+'-studio'
def run(args,**kw):
 result=subprocess.run(args,text=True,capture_output=True,**kw)
 if result.returncode: raise RuntimeError(result.stderr[-1500:])
 return result.stdout.strip()
def docker(*args):
 result=run(['docker',*args])
 if args[:2]==('run','-d'): owned.append(result)
 return result
try:
 network_id=docker('network','create','--internal','--label',label,network)
 docker('run','-d','--label',label,'--name',db,'--network',network,'--network-alias','fixture-db','--memory','512m','--cpus','1','--pids-limit','128','--tmpfs','/var/lib/postgresql/data:rw,size=256m','-e','POSTGRES_PASSWORD=isolated-fixture-only','postgres:17-alpine')
 for i in range(60):
  if subprocess.run(['docker','exec',db,'pg_isready','-U','postgres'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0: break
  time.sleep(.5)
 else: raise RuntimeError('Fixture DB readiness failed')
 docker('exec',db,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-c',"CREATE ROLE supabase_admin WITH LOGIN SUPERUSER PASSWORD 'isolated-fixture-only';")
 docker('run','-d','--label',label,'--name',meta,'--network',network,'--network-alias','fixture-meta','--memory','512m','--cpus','1','--pids-limit','128','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--tmpfs','/tmp:rw,size=64m','-e','PG_META_PORT=8080','-e','PG_META_DB_HOST=fixture-db','-e','PG_META_DB_PASSWORD=isolated-fixture-only','-v',str(ROOT/'test-integration.mjs')+':/test-integration.mjs:ro','beanmap-postgres-meta:v0.96.6-security-p4')
 print(docker('exec',meta,'node','/test-integration.mjs'))
 docker('run','-d','--label',label,'--name',studio,'--network',network,'--memory','1536m','--cpus','1','--pids-limit','256','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--tmpfs','/tmp:rw,size=64m','--tmpfs','/app/apps/studio/.next/cache:rw,uid=1000,gid=1000,size=64m','-e','HOSTNAME=0.0.0.0','-e','PORT=3000','-e','STUDIO_PG_META_URL=http://fixture-meta:8080','-e','POSTGRES_HOST=fixture-db','-e','POSTGRES_PASSWORD=isolated-fixture-only','-e','NEXT_PUBLIC_IS_PLATFORM=false','-e','SUPABASE_URL=http://fixture-meta:8080','-e','SUPABASE_PUBLIC_URL=http://fixture-meta:8080','beanmap-studio:2026.08.03-security-p4')
 code='''const assert=require('assert/strict');(async()=>{for(let i=0;i<60;i++){try{await fetch('http://127.0.0.1:3000');break}catch{await new Promise(r=>setTimeout(r,500))}}let out=[];for(const p of ['/api/platform/profile','/api/platform/projects','/project/default','/api/platform/pg-meta/default/tables']){const r=await fetch('http://127.0.0.1:3000'+p,{redirect:'manual'});assert([200,307].includes(r.status),p+':'+r.status);out.push([p,r.status]);await r.arrayBuffer()}const q=await fetch('http://127.0.0.1:3000/api/platform/pg-meta/default/query',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'select 7 as value'})});const qt=await q.text();assert.equal(q.status,200,'Studio query proxy '+qt.slice(0,500));assert.deepEqual(JSON.parse(qt),[{value:7}]);console.log(JSON.stringify({result:'PASS',studioHttp:out,studioMetaQueryProxy:true}))})().catch(e=>{console.error(e.message);process.exit(1)})'''
 print(docker('exec',studio,'node','-e',code))
 print(json.dumps({'result':'PASS','network':'internal','publishedPorts':0,'productionMounts':0}))
finally:
 for cid in reversed(owned):
  found=docker('inspect','--format','{{index .Config.Labels "beanmap.patch.fixture"}}',cid)
  if found!=prefix: raise RuntimeError('Fixture ownership changed; refusing cleanup')
  docker('rm','-f',cid)
 if network_id:
  found=docker('network','inspect','--format','{{index .Labels "beanmap.patch.fixture"}}',network_id)
  if found!=prefix: raise RuntimeError('Network ownership changed; refusing cleanup')
  docker('network','rm',network_id)
