#!/usr/bin/env python3
"""Disposable Linux namespace only; never run this root test on a real host."""
import http.server
import importlib.util
import ipaddress
import json
import os
from pathlib import Path
import socket
import stat
import subprocess
import sys
import time
import threading
import urllib.request

UID = 996
OWNER = "fixture-owner@example.invalid"
DNS = "fixture.tailnet.invalid"
PATHS = ["/project/default", "/api/platform/profile", "/api/platform/projects", "/api/platform/organizations",
         "/api/platform/pg-meta/default/query", "/api/platform/projects/default/database/query", "/api/platform/anything/not-listed"]

class Backend(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200); self.end_headers(); self.wfile.write(b'{"fixture":true}')
    do_POST = do_GET
    def log_message(self, *_): pass

class IPv6Server(http.server.ThreadingHTTPServer):
    address_family = socket.AF_INET6


def as_uid(uid):
    def change():
        os.setgroups([]); os.setgid(uid); os.setuid(uid)
    return change


def request(uid, target, path, method="GET", owner=True, origin=True):
    # Execute an actual separate OS identity; headers cannot affect connect(2).
    code = r'''
import http.client,json,socket,sys
uid,target,path,method,owner,origin=sys.argv[1:]
try:
 if target.startswith('/'):
  s=socket.socket(socket.AF_UNIX);s.settimeout(3);s.connect(target)
  conn=http.client.HTTPConnection('localhost',timeout=3);conn.sock=s
 else:conn=http.client.HTTPConnection(target,timeout=3)
 headers={}
 if owner=='1':headers['Tailscale-User-Login']='fixture-owner@example.invalid'
 if origin:headers['Origin']=origin
 conn.request(method,path,body='{}' if method=='POST' else None,headers=headers)
 response=conn.getresponse();response.read();print(json.dumps({'status':response.status}))
except (OSError,http.client.HTTPException) as e:
 print(json.dumps({'blocked':True,'errno':getattr(e,'errno',None)}))
'''
    result=subprocess.run([sys.executable,"-c",code,str(uid),target,path,method,"1" if owner else "0",f"https://{DNS}:8443" if origin else ""],
                          capture_output=True,text=True,timeout=5,check=True,preexec_fn=as_uid(uid))
    return json.loads(result.stdout)


def run_tests():
    if os.environ.get("BEANMAP_DISPOSABLE_TRANSPORT_TEST")!="1" or not Path("/.dockerenv").exists():
        raise RuntimeError("This test must run only in its disposable Docker namespace")
    backend4=str(ipaddress.IPv4Address(os.environ["FIXTURE_BACKEND4"]))
    backend6=str(ipaddress.IPv6Address(os.environ["FIXTURE_BACKEND6"]))
    subprocess.run(["ip","link","set","eth0","name","bm-management"],check=True)
    local_addresses=("100.64.0.99","fd7a:115c:a1e0::123")
    subprocess.run(["ip","addr","add",local_addresses[0]+"/32","dev","lo"],check=True)
    subprocess.run(["ip","-6","addr","add",local_addresses[1]+"/128","dev","lo"],check=True)
    local_servers=[]
    for port in (443,8443,9443):
        server=IPv6Server(("::",port),Backend);local_servers.append(server)
        threading.Thread(target=server.serve_forever,daemon=True).start()
        for target in (local_addresses[0]+f":{port}",f"[{local_addresses[1]}]:{port}"):
            assert request(65534,target,PATHS[1]).get("status")==200,"Baseline self-Serve fixture unavailable"
    spec=importlib.util.spec_from_file_location("guard","/fixture/management-transport-guard.py")
    guard=importlib.util.module_from_spec(spec);spec.loader.exec_module(guard)
    for target in (backend4+":3000",f"[{backend6}]:3000"):
        assert request(65534,target,PATHS[0]).get("status")==200,"Baseline fixture must reproduce direct management exposure"
    guard.apply(UID,local_addresses)
    guard.apply(UID,local_addresses) # Idempotence, first hook and no duplicate hooks.
    for port in (443,8443,9443):
        for target in (local_addresses[0]+f":{port}",f"[{local_addresses[1]}]:{port}"):
            assert request(0,target,PATHS[1]).get("status")==200,"Root self-Serve access blocked"
            for path in PATHS:
                assert request(65534,target,path).get("blocked"),"Local process borrowed host tailnet identity"
    for target in (backend4+":3000",f"[{backend6}]:3000"):
        for uid in (0,UID):
            response=request(uid,target,PATHS[0])
            assert response.get("status")==200,f"Trusted proxy transport blocked: UID {uid}, family {6 if target.startswith('[') else 4}, {response}"
        for path in PATHS:
            for method in ("GET","POST"):
                assert request(65534,target,path,method).get("blocked"),"nobody bypassed permissioned proxy through backend IP"
    directory=Path("/run/caddy/private");directory.mkdir(parents=True,mode=0o700);os.chown(directory,UID,UID);os.chmod(directory,0o700)
    for base in (Path("/opt/beanmap-private-console/public"),Path("/var/lib/beanmap-console")):
        base.mkdir(parents=True,exist_ok=True)
    Path("/opt/beanmap-private-console/public/index.html").write_text("fixture")
    Path("/var/lib/beanmap-console/status.json").write_text("{}")
    app=http.server.ThreadingHTTPServer(("127.0.0.1",3100),Backend)
    threading.Thread(target=app.serve_forever,daemon=True).start()
    config=Path("/tmp/Caddyfile");config.write_text("{\n admin off\n auto_https off\n}\n"+Path("/fixture/beanmap-private.Caddyfile").read_text())
    env={**os.environ,"BEANMAP_TAILSCALE_OWNER":OWNER,"BEANMAP_TAILSCALE_DNS":DNS,"BEANMAP_STUDIO_IP":backend4,"BEANMAP_ADMIN_INGRESS_SECRET":"fixture-secret","XDG_DATA_HOME":"/tmp/caddy-data","XDG_CONFIG_HOME":"/tmp/caddy-config"}
    logs=open("/tmp/caddy-fixture.log","w")
    process=subprocess.Popen(["caddy","run","--config",str(config)],env=env,stdout=logs,stderr=logs,preexec_fn=as_uid(UID))
    try:
        for _ in range(100):
            if all((directory/(name+".sock")).exists() for name in ("status","studio","admin")):break
            if process.poll() is not None:raise RuntimeError("Caddy fixture failed; inspect disposable log")
            time.sleep(.05)
        assert stat.S_IMODE(directory.stat().st_mode)==0o700
        for name,port in (("status",9310),("studio",9311),("admin",9312)):
            sock=directory/(name+".sock");info=sock.stat()
            assert stat.S_ISSOCK(info.st_mode) and stat.S_IMODE(info.st_mode)==0o600 and info.st_uid==UID
            for uid in (0,65534):assert request(uid,f"127.0.0.1:{port}","/").get("blocked"),"Legacy loopback TCP listener remains"
            assert request(65534,str(sock),"/").get("blocked"),"nobody could connect to private Unix socket"
            assert request(0,str(sock),"/",owner=False).get("status")==404,"Unix transport bypassed owner check"
        assert request(0,str(directory/"status.sock"),"/",origin=False).get("status")==200
        assert request(0,str(directory/"admin.sock"),"/ko/admin",origin=False).get("status")==200
        for path in PATHS:
            for method in ("GET","POST"):
                assert request(0,str(directory/"studio.sock"),path,method).get("status")==200,"Root Serve-equivalent owner flow failed"
                assert request(65534,str(directory/"studio.sock"),path,method).get("blocked"),"Forged header bypassed Unix permissions"
        assert request(0,str(directory/"studio.sock"),PATHS[4],"POST",origin=False).get("status")==403
        print(json.dumps({"result":"pass","unix_socket_permissions":"0700/0600","nobody_forged_headers":"blocked","direct_management_ipv4_ipv6":"blocked","self_serve_ipv4_ipv6":"blocked","root_owner_platform_paths":len(PATHS),"legacy_tcp_listeners":0,"guard_reapply":"idempotent"}))
    finally:
        process.terminate();process.wait(timeout=5);logs.close()
        app.shutdown();app.server_close()
        for server in local_servers:server.shutdown();server.server_close()

if __name__=="__main__":
    if len(sys.argv)>1 and sys.argv[1]=="backend":IPv6Server(("::",3000),Backend).serve_forever()
    else:run_tests()
