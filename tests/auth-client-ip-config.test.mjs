import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

// Exercise the actual candidate generators, including reuse/collision failures.
test("network and Caddy candidates reserve exact trust, preserve routes, and reject ambiguous state", () => {
  const script = String.raw`
import importlib.util, ipaddress, json
from pathlib import Path
root=Path.cwd()
def module(name, file):
    spec=importlib.util.spec_from_file_location(name, root/file)
    result=importlib.util.module_from_spec(spec);spec.loader.exec_module(result);return result
p=module('provision','ops/production/provision-auth-client-ip.py')
c=module('caddy','ops/production/prepare-client-ip-caddy.py')
def rejected(fn):
    try: fn()
    except ValueError: return
    raise AssertionError('Ambiguous configuration accepted')
selected=p.plan([{'Name':'none','IPAM':{'Config':None}}],[{'dst':'172.31.240.0/24'}])
assert selected['subnet']=='172.31.241.0/29'
assert not ipaddress.ip_address(selected['web_ip']) in ipaddress.ip_network(selected['dynamic_range'])
existing={'Name':p.NETWORK,'Labels':p.OWNER,'Driver':'bridge','IPAM':{'Config':[{'Subnet':selected['subnet'],'Gateway':selected['gateway'],'IPRange':selected['dynamic_range']}]},'Containers':{}}
assert p.plan([existing],[])==selected
bad=json.loads(json.dumps(existing));bad['Labels']={};rejected(lambda:p.plan([bad],[]))
bad=json.loads(json.dumps(existing));bad['IPAM']['Config'][0]['IPRange']=selected['subnet'];rejected(lambda:p.plan([bad],[]))
bad=json.loads(json.dumps(existing));bad['Containers']={'unknown':{'Name':'untrusted','IPv4Address':selected['web_ip']+'/29'}};rejected(lambda:p.plan([bad],[]))
rejected(lambda:p.plan([],[{'dst':'172.16.0.0/12'},{'dst':'192.168.0.0/16'}]))
app,kong=p.overrides(selected)
env=kong['services']['kong']['environment']
assert env=={'KONG_TRUSTED_IPS':selected['web_ip']+'/32','KONG_REAL_IP_HEADER':'X-Beanmap-Auth-Client-IP','KONG_REAL_IP_RECURSIVE':'off'}
assert 'supabase_net' in app['services']['web']['networks'] and 'default' in kong['services']['kong']['networks']
assert app['services']['web']['networks']['auth-client-ip']['ipv4_address']==selected['web_ip']
assert 'ports' not in app['services']['web'] and 'ports' not in kong['services']['kong']
public='beanmap.site {\n @admin path /ko/admin* /en/admin*\n respond @admin 404\n reverse_proxy 127.0.0.1:3100\n}\napi.beanmap.site {\n reverse_proxy 127.0.0.1:8000\n}\n'
private=(root/'ops/private-console/deploy/beanmap-private.Caddyfile').read_text()
for source,is_private in [(public,False),(private,True)]:
    candidate=c.prepare(source,is_private)
    assert candidate==c.prepare(candidate,is_private)
    assert c.FORWARD.strip() in candidate
    assert 'header_up X-Beanmap-Client-IP {remote_host}' in candidate
    if not is_private:
        assert c.STRIP.strip() in candidate and 'respond @admin 404' in candidate
    else:
        assert 'BEANMAP_TAILSCALE_OWNER' in candidate and 'BEANMAP_ADMIN_INGRESS_SECRET' in candidate
rejected(lambda:c.prepare(public.replace('reverse_proxy 127.0.0.1:3100','reverse_proxy 127.0.0.1:3100 {\nheader_up X-Beanmap-Client-IP {header.X-Spoof}\n}')))
rejected(lambda:c.prepare(public+public))
# A matching rule in some unrelated block must not bypass target-block insertion.
foreign='(unrelated) {\n'+c.FORWARD+'\n}\n'+public
assert c.prepare(foreign).count('header_up X-Beanmap-Client-IP {remote_host}')==2
print('ok')
`;
  assert.equal(execFileSync("python3", ["-B", "-c", script], { encoding: "utf8" }).trim(), "ok");
});
