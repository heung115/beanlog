import base64, hashlib, hmac, json, os, secrets, subprocess, time, urllib.request, urllib.error, urllib.parse, uuid
from pathlib import Path
ROOT=Path('/srv/beanlog/security-auth-20260907')
DB='beanmap-pg-security-restore'
AUTH='beanmap-auth-security-rehearsal'
NET='beanmap-auth-security-rehearsal'
IMAGE='beanlog-auth:v2.195.0-go1.26.6-p3'
def run(args,input=None):
    return subprocess.check_output(args,input=input,text=True,stderr=subprocess.PIPE).strip()
def docker(*a,input=None): return run(['docker',*a],input)
def sql(q): return docker('exec','-i',DB,'psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1',input=q)
def jwt(payload,key):
    enc=lambda b:base64.urlsafe_b64encode(b).decode().rstrip('=')
    data=enc(b'{"alg":"HS256","typ":"JWT"}')+'.'+enc(json.dumps(payload).encode())
    return data+'.'+enc(hmac.new(key.encode(),data.encode(),hashlib.sha256).digest())
version=int(sql('show server_version_num;'))
assert version>=170011, 'wait for DB17.11 validation'
assert docker('inspect',DB,'--format','{{.Name}}')=='/'+DB
live=json.loads(docker('inspect','supabase-auth'))[0]
env=dict(x.split('=',1) for x in live['Config']['Env'] if '=' in x)
url=urllib.parse.urlsplit(env['GOTRUE_DB_DATABASE_URL'])
assert url.scheme in ('postgres','postgresql')
newurl=urllib.parse.urlunsplit((url.scheme,url.netloc.rsplit('@',1)[0]+'@'+DB+':5432',url.path,url.query,''))
key=secrets.token_hex(32)
cfg={
'GOTRUE_DB_DRIVER':'postgres','GOTRUE_DB_DATABASE_URL':newurl,
'GOTRUE_API_HOST':'0.0.0.0','GOTRUE_API_PORT':'9999',
'API_EXTERNAL_URL':'http://auth-rehearsal.invalid:9999',
'GOTRUE_SITE_URL':'http://auth-rehearsal.invalid',
'GOTRUE_URI_ALLOW_LIST':'http://auth-rehearsal.invalid/**',
'GOTRUE_JWT_SECRET':key,'GOTRUE_JWT_AUD':'authenticated','GOTRUE_JWT_DEFAULT_GROUP_NAME':'authenticated',
'GOTRUE_JWT_ADMIN_ROLES':'service_role','GOTRUE_JWT_EXP':'3600',
'GOTRUE_DISABLE_SIGNUP':'false','GOTRUE_EXTERNAL_EMAIL_ENABLED':'true','GOTRUE_EXTERNAL_PHONE_ENABLED':'false',
'GOTRUE_SMS_AUTOCONFIRM':'false','GOTRUE_MAILER_AUTOCONFIRM':'false',
'GOTRUE_SESSIONS_TIMEBOX':'720h','GOTRUE_SESSIONS_INACTIVITY_TIMEOUT':'168h',
'GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_REAUTHENTICATION':'true',
'GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED':'true',
'GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL':'10',
'GOTRUE_RATE_LIMIT_EMAIL_SENT':'1000','GOTRUE_RATE_LIMIT_TOKEN_REFRESH':'1000',
}
ROOT.mkdir(mode=0o700,exist_ok=True)
p=ROOT/'rehearsal.env';p.write_text('\n'.join(k+'='+v for k,v in cfg.items())+'\n');p.chmod(0o600)
existing=docker('network','ls','--filter','name=^'+NET+'$','--format','{{.Name}}')
if not existing: docker('network','create','--internal',NET)
assert json.loads(docker('network','inspect',NET))[0]['Internal']
dbnet=json.loads(docker('inspect',DB))[0]['NetworkSettings']['Networks']
if 'none' in dbnet: docker('network','disconnect','none',DB)
if NET not in dbnet: docker('network','connect',NET,DB)
ids=[]
results=[]
def check(name,condition):
    if not condition: raise AssertionError(name)
    results.append({'check':name,'passed':True});print(name+': PASS',flush=True)
try:
    docker('run','-d','--name',AUTH,'--network',NET,'--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--tmpfs','/tmp:rw,noexec,nosuid,nodev,size=33554432,mode=1777','--memory','512m','--pids-limit','128','--cpus','1','--env-file',str(p),IMAGE)
    state=json.loads(docker('inspect',AUTH))[0]
    ip=state['NetworkSettings']['Networks'][NET]['IPAddress']
    assert ip and not state['HostConfig']['PortBindings']
    base='http://'+ip+':9999'
    admin=jwt({'role':'service_role','aud':'authenticated','iat':int(time.time()),'exp':int(time.time())+1800},key)
    def request(method,path,data=None,token=None):
        req=urllib.request.Request(base+path,data=json.dumps(data).encode() if data is not None else None,method=method,headers={'Content-Type':'application/json',**({'Authorization':'Bearer '+token} if token else {})})
        try:
            with urllib.request.urlopen(req,timeout=10) as r: return r.status,json.load(r)
        except urllib.error.HTTPError as e: return e.code,json.loads(e.read())
    for _ in range(40):
        try:
            code,health=request('GET','/health')
            if code==200: break
        except (OSError,ValueError): pass
        time.sleep(.5)
    else: raise AssertionError('Auth health startup')
    check('Auth17.11 startup with runtime restrictions',health.get('version')=='v2.195.0')
    code,settings=request('GET','/settings')
    check('phone auth disabled',code==200 and settings['external']['phone'] is False)
    code,data=request('POST','/signup',{'phone':'+12025550199','password':secrets.token_urlsafe(24)})
    check('phone signup rejected',400<=code<500)
    email='auth-rehearsal-'+uuid.uuid4().hex+'@example.invalid'
    password=secrets.token_urlsafe(24)
    code,user=request('POST','/admin/users',{'email':email,'password':password,'email_confirm':True},admin)
    check('disposable account creation',code in (200,201) and bool(user.get('id')))
    uid=user['id'];uuid.UUID(uid);ids.append(uid)
    def login(pw):
        c,d=request('POST','/token?grant_type=password',{'email':email,'password':pw})
        return c,d
    code,session=login(password)
    check('password login',code==200 and bool(session.get('access_token')))
    code,ref=request('POST','/token?grant_type=refresh_token',{'refresh_token':session['refresh_token']})
    check('refresh token rotation',code==200 and ref.get('refresh_token')!=session['refresh_token'])
    sql("update auth.sessions set created_at=now()-interval '25 hours' where user_id='"+uid+"';")
    code,data=request('PUT','/user',{'password':secrets.token_urlsafe(24)},ref['access_token'])
    check('old ordinary session password change rejected',code==400 and data.get('error_code')=='reauthentication_needed')
    code,link=request('POST','/admin/generate_link',{'type':'recovery','email':email,'redirect_to':'http://auth-rehearsal.invalid/reset-password'},admin)
    check('recovery link generated without outbound mail',code==200 and bool(link.get('hashed_token')))
    code,recovered=request('POST','/verify',{'type':'recovery','token_hash':link['hashed_token']})
    check('recovery token verification',code==200 and bool(recovered.get('access_token')))
    claims=json.loads(base64.urlsafe_b64decode(recovered['access_token'].split('.')[1]+'=='))
    check('verified email token AMR attestation',any(x.get('method') in ('recovery','otp') for x in claims.get('amr',[])))
    code,data=request('POST','/verify',{'type':'recovery','token_hash':link['hashed_token']})
    check('recovery token replay rejected',400<=code<500)
    newpassword=secrets.token_urlsafe(24)
    code,data=request('PUT','/user',{'password':newpassword},recovered['access_token'])
    check('verified recovery password change',code==200)
    code,_=login(password);check('old password rejected',400<=code<500)
    code,newsession=login(newpassword);check('new password login',code==200)
    sql("update auth.sessions set created_at=now()-interval '31 days' where user_id='"+uid+"';")
    code,data=request('POST','/token?grant_type=refresh_token',{'refresh_token':newsession['refresh_token']})
    check('30 day session timebox enforced',400<=code<500 and data.get('error_code')=='session_expired')
    code,inactive=login(newpassword);check('fresh login after timebox expiry',code==200)
    sql("update auth.sessions set created_at=now()-interval '8 days',refreshed_at=now()-interval '8 days' where user_id='"+uid+"'; update auth.refresh_tokens set updated_at=now()-interval '8 days' where user_id='"+uid+"';")
    code,data=request('POST','/token?grant_type=refresh_token',{'refresh_token':inactive['refresh_token']})
    check('7 day inactivity expiry enforced',400<=code<500 and data.get('error_code')=='session_expired')
    for uid in ids:
        c,d=request('DELETE','/admin/users/'+uid,token=admin);check('disposable account cleanup',c==200)
    ids=[]
finally:
    # Raw HTTP payloads, temporary credentials, and copied DB URL never go to output.
    (ROOT/'rehearsal-results.json').write_text(json.dumps({'database_version':version,'checks':results},indent=2)+'\n')
    for uid in ids:
        sql("delete from auth.users where id='"+uid+"';")
    subprocess.run(['docker','rm','-f',AUTH],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    subprocess.run(['docker','network','disconnect',NET,DB],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    subprocess.run(['docker','network','rm',NET],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    subprocess.run(['docker','network','connect','none',DB],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    p.unlink(missing_ok=True)
