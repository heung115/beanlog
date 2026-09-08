#!/usr/bin/env python3
"""Isolated Caddy→real application fetch helper→Kong trust-chain regression."""
import importlib.util
import ipaddress
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / 'tests/fixtures/auth-client-ip'
NODE = 'node:22.23.2-alpine3.24@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32'
KONG = 'public.ecr.aws/supabase/kong:2.8.1'
CADDY = 'caddy:2.10.2-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d'
run_id = str(os.getpid())
network = 'beanmap-auth-ip-test-' + run_id
names = {part: f'{network}-{part}' for part in ['web', 'kong', 'caddy', 'a', 'b', 'probe']}
created = []


def run(args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=60)
    if result.returncode:
        raise RuntimeError(f'Fixture command failed: {args[0:3]}: {result.stderr[-1500:]}')
    return result.stdout.strip()


def launch(part, address, image, extra, command=None, aliases=None):
    args = ['docker', 'run', '-d', '--name', names[part], '--network', network]
    if address:
        args += ['--ip', address]
    for alias in aliases or []:
        args += ['--network-alias', alias]
    args += extra + [image] + (command or [])
    run(args)
    if part not in created:
        created.append(part)


def client(part, mode, other=None):
    args = ['docker', 'exec', names[part], 'node', '/fixture/client.mjs', mode]
    if other:
        args.append(other)
    return json.loads(run(args))


spec = importlib.util.spec_from_file_location('provision', ROOT / 'ops/production/provision-auth-client-ip.py')
provision = importlib.util.module_from_spec(spec)
spec.loader.exec_module(provision)
ids = run(['docker', 'network', 'ls', '-q']).split()
networks = json.loads(run(['docker', 'network', 'inspect', *ids])) if ids else []
selected = provision.plan(networks, [])
subnet = ipaddress.ip_network(selected['subnet'])
web_ip, kong_ip = selected['web_ip'], selected['kong_ip']
a_ip, b_ip = str(subnet.network_address+5), str(subnet.network_address+6)
summary = {}
try:
    run(['docker', 'network', 'create', '--subnet', selected['subnet'], '--gateway', selected['gateway'], '--ip-range', selected['dynamic_range'], network])
    with tempfile.TemporaryDirectory(prefix='beanmap-auth-ip-fixture-') as temporary:
        proof = Path(temporary)/'proof'
        proof.write_text('a'*64+'\n')
        def start_web():
            launch('web', web_ip, NODE, [
                '-v', f'{FIXTURE}:/fixture:ro',
                '-v', f'{ROOT}/src/lib/security/auth-client-ip.ts:/auth-client-ip.ts:ro',
                '-v', f'{proof}:/proof:ro',
                '-e', 'AUTH_CLIENT_IP_SECRET_FILE=/proof',
                '-e', 'SUPABASE_SERVER_URL=http://beanmap-auth-gateway:8000',
            ], ['node', '/fixture/web.mjs'], ['fixture-web'])
        start_web()
        launch('kong', kong_ip, KONG, [
            '-v', f'{FIXTURE}/kong.yml:/fixture/kong.yml:ro',
            '-e', 'KONG_DATABASE=off', '-e', 'KONG_DECLARATIVE_CONFIG=/fixture/kong.yml',
            '-e', 'KONG_PROXY_LISTEN=0.0.0.0:8000', '-e', 'KONG_ADMIN_LISTEN=off',
            '-v', f'{ROOT}/ops/production/kong-plugins/beanmap-auth-budgets:/usr/local/share/lua/5.1/kong/plugins/beanmap-auth-budgets:ro',
            '-e', f'KONG_TRUSTED_IPS={web_ip}/32,{subnet.network_address+4}/32',
            '-e', 'KONG_NGINX_HTTP_LUA_SHARED_DICT=beanmap_auth_budgets 10m',
            '-e', 'KONG_REAL_IP_HEADER=X-Beanmap-Auth-Client-IP', '-e', 'KONG_REAL_IP_RECURSIVE=off',
            '-e', 'KONG_PLUGINS=bundled,beanmap-auth-budgets', '-e', 'KONG_DNS_ORDER=LAST,A,CNAME',
        ], aliases=['beanmap-auth-gateway'])
        launch('caddy', str(subnet.network_address+4), CADDY, [
            '-v', f'{FIXTURE}/Caddyfile:/etc/caddy/Caddyfile:ro',
            '-e', 'BEANMAP_AUTH_CLIENT_IP_SECRET='+'a'*64,
        ], aliases=['fixture-caddy'])
        for part, address in [('a', a_ip), ('b', b_ip)]:
            launch(part, address, NODE, ['-v', f'{FIXTURE}:/fixture:ro'], ['node', '-e', 'setInterval(()=>{},10000)'])
        for attempt in range(30):
            state = json.loads(run(['docker', 'inspect', names['kong']]))[0]['State']
            if not state['Running']:
                raise RuntimeError('Kong fixture stopped: ' + subprocess.check_output(['docker', 'logs', names['kong']], stderr=subprocess.STDOUT, text=True)[-3000:])
            try:
                ready = run(['docker','exec',names['a'],'node','-e',"fetch('http://beanmap-auth-gateway:8000/').then(r=>{if(r.status!==404)process.exit(1)}).catch(()=>process.exit(1))"])
                break
            except RuntimeError:
                time.sleep(.5)
        else:
            raise RuntimeError('Kong fixture did not become ready')
        # Avoid a fixed-window reset in the middle of the bounded local burst.
        seconds = time.time() % 60
        if seconds > 15:
            time.sleep(60-seconds+.1)
        summary['client_a_600_per_minute'] = client('a', 'exhaust-user')
        assert summary['client_a_600_per_minute'] == {'200':600,'429':1}, summary
        summary['client_b_separate_bucket'] = client('b', 'second-client', a_ip)
        assert summary['client_b_separate_bucket'] == {'user':200}, summary
        summary['forged_headers'] = client('a', 'spoof', b_ip)
        assert summary['forged_headers']['throughWeb'] == 429, summary
        assert summary['forged_headers']['directKong'] == 429, summary
        assert summary['forged_headers']['publicApi'] == 429, summary
        summary['auth_and_private_boundaries'] = client('b', 'auth-boundaries', a_ip)
        assert summary['auth_and_private_boundaries'] == {'missingKey':401,'invalidJwt':401,'privateDenied':404,'privateAllowed':200}, summary
        summary['token_limit_unchanged'] = client('a', 'exhaust-token')
        assert summary['token_limit_unchanged'] == {'200':60,'429':1}, summary
        summary['token_other_client_separate_write_limit'] = client('b', 'token-other-client')
        assert summary['token_other_client_separate_write_limit'] == {'token':200}, summary
        summary['independent_operation_budgets'] = client('a', 'operation-budgets', b_ip)
        assert summary['independent_operation_budgets'] == {'forgedPassword':429,'signup':{'200':10,'429':1},'recover':{'200':10,'429':1},'otp':{'200':10,'429':1},'verify':200,'refresh':200,'logout':200,'adminDenied':404,'internalAdminDenied':403,'admin':200,'nativeIdentityReplaced':True,'adminSpellingsBlocked':True,'aggregateBounded':True,'deniedTrafficCannotSpendGlobal':True,'adminAfterPublicExhaustion':200}, summary
        fixture_logs = subprocess.check_output(['docker', 'logs', names['kong']], stderr=subprocess.STDOUT, text=True)
        assert 'scope=client-total' in fixture_logs, 'Aggregate IP limiter was not exercised'
        assert 'scope=public-total' not in fixture_logs, 'Rejected traffic consumed the global budget'
        summary['client_b_after_client_a_total_exhaustion'] = client('b', 'second-client', a_ip)
        assert summary['client_b_after_client_a_total_exhaustion'] == {'user':200}, summary
        # Free the dynamic slot while the fixed web address is absent. An auto-IP
        # container must take .6, never the reserved .2; recreating web must work.
        run(['docker','rm','-f',names['web'],names['b']])
        launch('probe', None, NODE, [], ['node','-e','setInterval(()=>{},10000)'])
        actual_probe = json.loads(run(['docker','inspect',names['probe']]))[0]['NetworkSettings']['Networks'][network]['IPAddress']
        assert actual_probe == b_ip and actual_probe != web_ip
        start_web()
        actual_web = json.loads(run(['docker','inspect',names['web']]))[0]['NetworkSettings']['Networks'][network]['IPAddress']
        assert actual_web == web_ip
        run(['docker','rm','-f',names['probe']])
        launch('b',b_ip,NODE,['-v',f'{FIXTURE}:/fixture:ro'],['node','-e','setInterval(()=>{},10000)'])
        time.sleep(.5)
        summary['recreation_preserves_static_ip'] = actual_web == web_ip
        summary['lookup_after_recreate'] = client('b','after-recreate')
        assert summary['lookup_after_recreate'] == {'user':200}, summary
        print(json.dumps(summary,indent=2))
finally:
    for part in reversed(created):
        subprocess.run(['docker','rm','-f',names[part]],capture_output=True)
    subprocess.run(['docker','network','rm',network],capture_output=True)
