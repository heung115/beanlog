#!/usr/bin/env python3
"""Prepare/apply controlled public Auth boundaries; preserve all live image pins."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import time

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('auth_rollout', HERE / 'apply-auth-budgets.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FILES = {
    'snippet': Path('/etc/caddy/beanmap-controlled-signup.Caddyfile'),
    'handler': Path('/etc/beanmap-auth-budgets/plugin/handler.lua'),
}
SOURCES = {
    'snippet': HERE / 'beanmap-controlled-signup.Caddyfile',
    'handler': HERE / 'kong-plugins/beanmap-auth-budgets/handler.lua',
}
PREVIOUS = {
    'snippet': '3a1b97deff2f2f30b659164657ca4f309cf345b655038b5790af61ce3b7aaa53',
    'handler': '9c72df24ad431464ef305883311b3697497345dd9a883aef7167bba8cf34e32c',
}
TOOLS = ['apply-otp-boundary.py', 'apply-auth-budgets.py', 'caddy-version-boundary.py']


def guard_hashes():
    paths = set(base.FILES.values())
    paths.update(base.BASE / name for name in [
        'docker-compose.yml', 'docker-compose.override.yml',
        'docker-compose.client-ip.yml', 'docker-compose.security.yml'])
    paths.update(p for p in Path('/etc/caddy').rglob('*') if p.is_file()
                 and (p.name == 'Caddyfile' or p.suffix in ('.Caddyfile', '.conf')))
    paths.add(base.PLUGIN / 'schema.lua')
    paths.discard(FILES['snippet'])
    return {str(path): base.digest(path) for path in sorted(paths)}


def service_identity():
    item = base.inspect('supabase-kong')
    # Values remain in memory; only a hash is saved in the root-private state.
    configuration = json.dumps([item['Config'], item['HostConfig']], sort_keys=True).encode()
    return {'container': item['Id'], 'image': item['Image'],
            'configuration': hashlib.sha256(configuration).hexdigest()}


def assert_direct_internal_auth():
    item = base.inspect('beanlogapp-api-1')
    environment = dict(value.split('=', 1) for value in item['Config']['Env'])
    if environment.get('AUTH_URL') != 'http://supabase-auth:9999':
        raise ValueError('Account deletion must use the reviewed direct internal Auth endpoint')
    web = base.inspect('beanlogapp-web-1')
    environment = dict(value.split('=', 1) for value in web['Config']['Env'])
    if environment.get('SUPABASE_SERVER_URL') != 'http://beanmap-auth-gateway:8000' or not environment.get('AUTH_CLIENT_IP_SECRET_FILE'):
        raise ValueError('Password recovery must use the verified Next-to-Kong connection')


def prepare(state):
    if state.exists():
        raise ValueError('Choose a new private state directory')
    assert_direct_internal_auth()
    if base.digest(base.PLUGIN / 'schema.lua') != base.digest(HERE / 'kong-plugins/beanmap-auth-budgets/schema.lua'):
        raise ValueError('Installed gateway plugin schema changed; review required')
    for key, path in FILES.items():
        if path.is_symlink() or base.digest(path) != PREVIOUS[key]:
            raise ValueError('Installed ingress differs from the reviewed baseline; review before replacing')
    state.mkdir(mode=0o700, parents=True)
    records = {'files': {}, 'guards': guard_hashes(), 'kong': service_identity(),
               'tools': {name: base.digest(HERE / name) for name in TOOLS}}
    for key, live in FILES.items():
        shutil.copyfile(live, state / (key + '.before'))
        shutil.copyfile(SOURCES[key], state / (key + '.candidate'))
        for suffix in ['before', 'candidate']:
            (state / (key + '.' + suffix)).chmod(0o600)
        records['files'][key] = {'before': base.digest(live), 'candidate': base.digest(SOURCES[key])}
    candidate = state / 'caddy.validation'
    caddy_source = base.FILES['caddy'].read_text()
    if caddy_source.count(str(FILES['snippet'])) != 1:
        raise ValueError('Expected one active controlled Auth ingress import')
    candidate.write_text(caddy_source.replace(str(FILES['snippet']), str(state / 'snippet.candidate')))
    candidate.chmod(0o600)
    base.validate_caddy(candidate)
    # The live declaration and current image are validated without rewriting any
    # compose/secret/config file. Only the plugin candidate mount differs.
    shutil.copyfile(base.FILES['kong'], state / 'kong.candidate')
    (state / 'kong.candidate').chmod(0o600)
    base.validate_kong(state, base.inspect('supabase-kong'))
    (state / 'manifest.json').write_text(json.dumps(records, indent=2) + '\n')
    print('OTP ingress candidates validated; production services and image pins unchanged.')


def reload_kong():
    base.run(['docker', 'restart', 'supabase-kong'])
    for _ in range(40):
        if base.inspect('supabase-kong')['State'].get('Health', {}).get('Status') == 'healthy':
            return
        time.sleep(1)
    raise RuntimeError('Kong did not become healthy')


def apply(state):
    records = json.loads((state / 'manifest.json').read_text())
    if (state / 'applied').exists():
        raise ValueError('OTP boundary was already activated')
    if records['tools'] != {name: base.digest(HERE / name) for name in TOOLS}:
        raise ValueError('Reviewed rollout tools changed')
    if records['guards'] != guard_hashes() or records['kong'] != service_identity():
        raise ValueError('Live configuration or image changed after preparation; prepare again')
    assert_direct_internal_auth()
    for key, path in FILES.items():
        if (path.is_symlink() or base.digest(path) != records['files'][key]['before']
                or base.digest(state / (key + '.candidate')) != records['files'][key]['candidate']):
            raise ValueError('Live ingress or candidate changed after preparation')
    try:
        base.atomic_install(state / 'snippet.candidate', FILES['snippet'])
        base.validate_caddy(base.FILES['caddy'])
        base.run(['systemctl', 'reload', 'caddy'])
        base.atomic_install(state / 'handler.candidate', FILES['handler'])
        reload_kong()
        if records['guards'] != guard_hashes() or records['kong'] != service_identity():
            raise RuntimeError('Unexpected live configuration change during OTP activation')
    except Exception:
        for key, path in FILES.items():
            base.atomic_install(state / (key + '.before'), path)
        base.run(['systemctl', 'reload', 'caddy'])
        reload_kong()
        raise RuntimeError('OTP activation failed; previous ingress files restored') from None
    (state / 'applied').write_text('activated\n')
    print('Public OTP ingress denied; internal Auth, compose, and image pins preserved.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['prepare', 'apply'])
    parser.add_argument('--state-dir', type=Path, required=True)
    args = parser.parse_args()
    if os.geteuid() != 0 or not args.state_dir.is_absolute() or args.state_dir.is_symlink():
        raise ValueError('Root and a private absolute state path are required')
    {'prepare': prepare, 'apply': apply}[args.operation](args.state_dir)


if __name__ == '__main__':
    main()
