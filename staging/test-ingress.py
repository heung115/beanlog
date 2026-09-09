#!/usr/bin/env python3
"""Disposable Caddy/Node proof test; never touches running staging services."""
import json
import os
from pathlib import Path
import secrets
import subprocess
import tempfile
import time
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
NODE = 'node:22.23.2-alpine3.24@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32'
IMAGE = 'beanmap-staging-ingress-test:local'

def run(*args, check=True):
    result = subprocess.run(args, text=True, capture_output=True)
    if check and result.returncode:
        raise RuntimeError(f'Fixture command failed: {args[0]} {args[1]} (exit {result.returncode})')
    return result

def main():
    suffix = secrets.token_hex(5)
    network, web, ingress = (f'beanmap-ingress-{kind}-{suffix}' for kind in ('net', 'web', 'proxy'))
    run('docker', 'build', '-q', '-f', str(ROOT / 'staging/ingress.Dockerfile'), '-t', IMAGE, str(ROOT / 'staging'))
    run('docker', 'network', 'create', network)
    try:
        with tempfile.TemporaryDirectory(prefix='beanmap-ingress-') as tmp:
            folder = Path(tmp)
            proof = secrets.token_hex(32)
            for name, value in [('proof', proof), ('consent', secrets.token_hex(32)), ('invalid', 'invalid-proof')]:
                path = folder / name
                path.write_text(value)
                path.chmod(0o444)  # Parent directory remains private (0700).
            fixture = folder / 'web.mjs'
            fixture.write_text(r'''
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { verifiedClientIp } from '/repo/src/lib/security/auth-client-ip.ts';
import { controlledSignup } from '/repo/src/lib/security/signup-consent.ts';
const proof = readFileSync('/run/secrets/auth_client_ip','utf8').trim();
http.createServer(async (req,res) => {
 const headers = new Headers(Object.entries(req.headers).map(([k,v])=>[k,Array.isArray(v)?v.join(','):v]));
 const ip = verifiedClientIp(headers,proof);
 let body;
 try {
  if(req.url==='/api/health') body={status:'ok'};
  else if(req.url==='/probe') body={verified:!!ip,ip,spoofedAuthIp:headers.has('x-beanmap-auth-client-ip'),spoofedRateId:headers.has('x-beanmap-auth-rate-identity')};
  else if(req.url==='/qa/signup') {
   let authCalls=0, assertionValid=false,proofForwarded=true,forwardedIp=null;
   const result=await controlledSignup({email:'new-fixture@example.test',password:'Synthetic Password 42',displayName:'Fixture'},headers,{
    internalUrl:'http://auth-fixture:9999',anonKey:'fixture-only-anon',secretFile:'/run/secrets/signup_consent',ingressSecretFile:'/run/secrets/auth_client_ip',
    sleep:async()=>{},clock:()=>0,jitter:()=>0,
    fetchImpl:async(_url,init)=>{
     authCalls++;proofForwarded=init.headers.has('x-beanmap-client-proof');forwardedIp=init.headers.get('x-beanmap-auth-client-ip');
     const a=JSON.parse(init.body).data.beanmap_signup_consent;
     const canonical=['beanmap-signup-v1',a.email,a.terms_version,a.privacy_version,a.issued_at,a.nonce,a.source,a.path].join('\n');
     assertionValid=a.signature===createHmac('sha256',Buffer.from(readFileSync('/run/secrets/signup_consent','utf8').trim(),'hex')).update(canonical).digest('hex');
     return new Response('{"id":"fixture-only"}',{status:200});
    }
   });
   body={...result,authCalls,assertionValid,proofForwarded,forwardedIp};
  } else {res.statusCode=404;body={error:'not found'};}
 } catch {res.statusCode=403;body={error:'verified ingress required'};}
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));
}).listen(3000,'0.0.0.0');
''')
            fixture.chmod(0o444)
            restrictions = ['--read-only', '--user', '1001:1001', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--pids-limit', '100', '--memory', '128m', '--cpus', '0.5', '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=32m,uid=1001,gid=1001,mode=0700', '--tmpfs', '/config:ro,noexec,nosuid,nodev,size=1m,mode=0555', '--tmpfs', '/data:ro,noexec,nosuid,nodev,size=1m,mode=0555']
            run('docker','run','-d','--name',web,'--network',network,'--network-alias','web',*restrictions,
                '-v',f'{ROOT / "src"}:/repo/src:ro','-v',f'{fixture}:/fixture.mjs:ro',
                '-v',f'{folder / "proof"}:/run/secrets/auth_client_ip:ro','-v',f'{folder / "consent"}:/run/secrets/signup_consent:ro',
                NODE,'node','--experimental-strip-types','/fixture.mjs')
            run('docker','run','-d','--name',ingress,'--network',network,'--network-alias','ingress',*restrictions,
                '-p','127.0.0.1::8080','-v',f'{folder / "proof"}:/run/secrets/auth_client_ip:ro',IMAGE)
            binding=json.loads(run('docker','inspect',ingress).stdout)[0]['NetworkSettings']['Ports']['8080/tcp'][0]
            assert binding['HostIp']=='127.0.0.1'
            base='http://127.0.0.1:'+binding['HostPort']
            for _ in range(50):
                try:
                    with urllib.request.urlopen(base+'/api/health',timeout=1) as response:
                        assert json.load(response)=={'status':'ok'}
                    break
                except (OSError,AssertionError): time.sleep(0.1)
            else: raise RuntimeError('Disposable ingress did not become healthy')
            client=r'''
import assert from 'node:assert/strict';
import os from 'node:os';
const local=Object.values(os.networkInterfaces()).flat().find(a=>!a.internal&&a.family==='IPv4').address;
const forged={'X-Beanmap-Client-IP':'198.51.100.99','X-Beanmap-Client-Proof':'f'.repeat(64),'X-Beanmap-Auth-Client-IP':'198.51.100.98','X-Beanmap-Auth-Rate-Identity':'forged','Cookie':'qa-cookie-marker'};
for(const headers of [{},forged]){
 const r=await fetch('http://ingress:8080/probe',{headers});assert.equal(r.status,200);
 assert.deepEqual(await r.json(),{verified:true,ip:local,spoofedAuthIp:false,spoofedRateId:false});
}
const signup=await fetch('http://ingress:8080/qa/signup',{method:'POST',headers:forged});assert.equal(signup.status,200);
assert.deepEqual(await signup.json(),{success:true,authCalls:1,assertionValid:true,proofForwarded:false,forwardedIp:local});
assert.equal((await fetch('http://web:3000/qa/signup',{method:'POST',headers:forged})).status,403);
console.log('Real socket provenance, forged-header replacement, signup consent and direct-bypass rejection PASS');
'''
            result=run('docker','run','--rm','--network',network,NODE,'node','--input-type=module','-e',client)
            print(result.stdout.strip())
            logs=run('docker','logs',ingress).stdout+run('docker','logs',ingress).stderr
            assert proof not in logs and 'qa-cookie-marker' not in logs
            config=json.loads(run('docker','inspect',ingress).stdout)[0]
            assert config['HostConfig']['ReadonlyRootfs'] and config['Config']['User']=='1001:1001'
            assert config['HostConfig']['CapDrop']==['ALL']
            bad=run('docker','run','--rm',*restrictions,'-v',f'{folder / "invalid"}:/run/secrets/auth_client_ip:ro',IMAGE,check=False)
            assert bad.returncode!=0 and 'invalid-proof' not in bad.stdout+bad.stderr
            print('Loopback-only publishing, nonroot/read-only sandbox, secret-free logs and bad-secret rejection PASS')
    finally:
        run('docker','rm','-f',ingress,web,check=False)
        run('docker','network','rm',network,check=False)

if __name__=='__main__': main()
