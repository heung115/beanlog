#!/usr/bin/env python3
"""Prepare and reversibly activate the reviewed Oracle Auth gateway policy."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import time

HERE = Path(__file__).resolve().parent
CONTROL_FILES = ['apply-auth-budgets.py', 'prepare-auth-budgets.py', 'caddy-version-boundary.py']
BASE = Path('/srv/beanlog/supabase/docker')
FILES = {
    'kong': BASE / 'volumes/api/kong.yml',
    'caddy': Path('/etc/caddy/Caddyfile'),
    'overlay': BASE / 'docker-compose.client-ip.yml',
    'expiry': BASE / '.env',
}
PLUGIN = Path('/etc/beanmap-auth-budgets/plugin')
MONITOR_FILES = {
    'beanmap-auth-budget-monitor.py': Path('/usr/local/sbin/beanmap-auth-budget-monitor'),
    'beanmap-auth-budget-monitor.service': Path('/etc/systemd/system/beanmap-auth-budget-monitor.service'),
    'beanmap-auth-budget-monitor.timer': Path('/etc/systemd/system/beanmap-auth-budget-monitor.timer'),
}
COMPOSE = ['docker', 'compose', '--env-file', str(BASE / '.env')]
for name in ['docker-compose.yml', 'docker-compose.override.yml', 'docker-compose.client-ip.yml', 'docker-compose.security.yml']:
    COMPOSE += ['-f', str(BASE / name)]


def run(args, **kwargs):
    # Config/CLI diagnostics may contain expanded API keys. Never echo them.
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kwargs)
    if result.returncode:
        raise RuntimeError('Validation or service command failed; secret-bearing diagnostics suppressed')
    return result.stdout


def inspect(name):
    return json.loads(run(['docker', 'inspect', name]))[0]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def atomic_install(source, target, mode=None):
    if target.is_symlink():
        raise ValueError('Refusing symlink target')
    previous = target.stat() if target.exists() else None
    temporary = target.with_name(target.name + '.auth-budgets-candidate')
    if temporary.exists():
        raise ValueError('Candidate already exists')
    shutil.copyfile(source, temporary)
    os.chmod(temporary, mode if mode is not None else previous.st_mode & 0o777)
    if previous:
        os.chown(temporary, previous.st_uid, previous.st_gid)
    os.replace(temporary, target)


def validate_caddy(path):
    spec = importlib.util.spec_from_file_location('caddy_version_boundary', HERE / 'caddy-version-boundary.py')
    boundary = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(boundary)
    sources = [path.read_text()]
    # Read loaded configuration families only, never environment/credential files.
    for candidate in Path('/etc/caddy').rglob('*'):
        if candidate.is_file() and (candidate.name == 'Caddyfile' or candidate.suffix in ('.Caddyfile', '.conf')):
            sources.append(candidate.read_text())
    boundary.assert_safe(run(['/usr/bin/caddy', 'version']).decode(), sources)
    run(['systemd-run', '--wait', '--pipe', '--collect',
         '--property=EnvironmentFile=/etc/beanmap-private-console/caddy.env',
         '--property=EnvironmentFile=/etc/beanmap-auth-client-ip/caddy.env',
         '/usr/bin/caddy', 'validate', '--config', str(path), '--adapter', 'caddyfile'])


def validate_kong(state, container):
    # Use the existing renderer and actual running image with no network, ports,
    # production mounts or Auth requests. Environment values stay root-private.
    env = dict(item.split('=', 1) for item in container['Config']['Env'])
    env.update(KONG_PLUGINS='bundled,beanmap-auth-budgets', KONG_PREFIX='/tmp/kong',
               KONG_DECLARATIVE_CONFIG='/tmp/kong.yml', KONG_NGINX_HTTP_LUA_SHARED_DICT='beanmap_auth_budgets 10m')
    envfile = state / 'validation.env'
    envfile.write_text(''.join(key + '=' + value + '\n' for key, value in env.items()))
    envfile.chmod(0o600)
    renderer = (BASE / 'volumes/api/kong-entrypoint.sh').read_text()
    old = 'exec /entrypoint.sh kong docker-start'
    if renderer.count(old) != 1:
        raise ValueError('Existing Kong renderer changed; review required')
    script = state / 'validate-kong.sh'
    script.write_text(renderer.replace(old, 'exec /entrypoint.sh kong config parse "$KONG_DECLARATIVE_CONFIG"'))
    script.chmod(0o600)
    try:
        run(['docker', 'run', '--rm', '--network', 'none', '--user', '0:0', '--read-only',
             '--tmpfs', '/tmp:rw,nosuid,nodev,size=64m', '--env-file', str(envfile),
             '-v', str(state / 'kong.candidate') + ':/home/kong/temp.yml:ro',
             '-v', str(script) + ':/validate-kong.sh:ro',
             '-v', str(HERE / 'kong-plugins/beanmap-auth-budgets') + ':/usr/local/share/lua/5.1/kong/plugins/beanmap-auth-budgets:ro',
             '--entrypoint', 'sh', container['Image'], '/validate-kong.sh'])
    finally:
        envfile.unlink(missing_ok=True)


def prepare(state):
    if state.exists():
        raise ValueError('Choose a new private state directory')
    state.mkdir(mode=0o700, parents=True)
    spec = importlib.util.spec_from_file_location('prepare_budgets', HERE / 'prepare-auth-budgets.py')
    generator = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(generator)
    container = inspect('supabase-kong')
    nets = container['NetworkSettings']['Networks']
    web_ip = inspect('beanlogapp-web-1')['NetworkSettings']['Networks']['beanmap-auth-client-ip']['IPAddress']
    host_ip = nets['beanlogsupabase_default']['Gateway']
    records = {}
    for kind, live in FILES.items():
        shutil.copy2(live, state / (kind + '.before'))
        source = live.read_text()
        value = generator.overlay(source, web_ip, host_ip) if kind == 'overlay' else {
            'kong': lambda source: generator.kong_policy(source, web_ip), 'caddy': generator.caddy_policy, 'expiry': generator.expiry,
        }[kind](source)
        candidate = state / (kind + '.candidate')
        candidate.write_text(value)
        candidate.chmod(0o600)
        records[kind] = {'before': digest(live), 'candidate': digest(candidate)}
    records['tools'] = {name: digest(HERE / name) for name in CONTROL_FILES}
    records['plugin'] = {name: digest(HERE / 'kong-plugins/beanmap-auth-budgets' / name) for name in ['handler.lua', 'schema.lua']}
    records['monitor'] = {name: digest(HERE / name) for name in MONITOR_FILES}
    if any(path.exists() for path in MONITOR_FILES.values()):
        raise ValueError('Monitor already installed; review existing configuration')
    if PLUGIN.exists():
        raise ValueError('Plugin already installed; review existing rollout before replacing')
    validate_kong(state, container)
    validate_caddy(state / 'caddy.candidate')
    (state / 'manifest.json').write_text(json.dumps(records, indent=2) + '\n')
    print('Candidates validated; services unchanged. State: ' + str(state))


def apply(state):
    records = json.loads((state / 'manifest.json').read_text())
    if records.get('tools') != {name: digest(HERE / name) for name in CONTROL_FILES}:
        raise ValueError('Rollout or Caddy safety gate changed after preparation')
    if (state / 'applied').exists():
        raise ValueError('This rollout already completed')
    for kind, live in FILES.items():
        if digest(live) != records[kind]['before'] or digest(state / (kind + '.candidate')) != records[kind]['candidate']:
            raise ValueError('Configuration changed after preparation; prepare a fresh candidate')
    for name, sha in records['plugin'].items():
        if digest(HERE / 'kong-plugins/beanmap-auth-budgets' / name) != sha:
            raise ValueError('Plugin source changed after preparation')
    for name, sha in records['monitor'].items():
        if digest(HERE / name) != sha or MONITOR_FILES[name].exists():
            raise ValueError('Monitor source or installation changed after preparation')
    if PLUGIN.exists():
        raise ValueError('Plugin unexpectedly exists')
    # The template is deployed by the ordinary web release first. No email is sent.
    body = run(['curl', '--fail', '--silent', '--max-time', '15', 'https://beanmap.site/auth-templates/magic-link.html'])
    if b'{{ .Token }}' not in body or b'{{ .ConfirmationURL }}' not in body:
        raise ValueError('Deploy the reviewed email template before activating Auth')
    PLUGIN.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
    PLUGIN.mkdir(mode=0o755)
    for name in records['plugin']:
        target = PLUGIN / name
        shutil.copyfile(HERE / 'kong-plugins/beanmap-auth-budgets' / name, target)
        target.chmod(0o644)
    PLUGIN.chmod(0o755)
    installed_monitors = []
    try:
        for kind, live in FILES.items():
            atomic_install(state / (kind + '.candidate'), live)
        run(COMPOSE + ['config', '--quiet'], cwd=BASE)
        validate_caddy(FILES['caddy'])
        # Caddy overwrites the verified identity before Kong begins trusting it.
        run(['systemctl', 'reload', 'caddy'])
        run(COMPOSE + ['up', '-d', '--no-deps', '--no-build', '--wait', 'kong', 'auth'], cwd=BASE)
        for name in ['supabase-kong', 'supabase-auth']:
            if inspect(name)['State'].get('Health', {}).get('Status') != 'healthy':
                raise RuntimeError('Auth gateway did not become healthy')
        for name, target in MONITOR_FILES.items():
            atomic_install(HERE / name, target, 0o755 if name.endswith('.py') else 0o644)
            installed_monitors.append(target)
        run(['systemctl', 'daemon-reload'])
        run(['systemctl', 'enable', '--now', 'beanmap-auth-budget-monitor.timer'])
    except Exception:
        for kind, live in FILES.items():
            atomic_install(state / (kind + '.before'), live)
        run(['systemctl', 'reload', 'caddy'])
        run(COMPOSE + ['up', '-d', '--no-deps', '--no-build', '--wait', 'kong', 'auth'], cwd=BASE)
        if installed_monitors:
            subprocess.run(['systemctl', 'disable', '--now', 'beanmap-auth-budget-monitor.timer'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            for target in installed_monitors:
                target.unlink(missing_ok=True)
            run(['systemctl', 'daemon-reload'])
        for name in records['plugin']:
            (PLUGIN / name).unlink(missing_ok=True)
        PLUGIN.rmdir()
        raise RuntimeError('Activation failed and prior configuration was restored') from None
    (state / 'applied').write_text(str(int(time.time())) + '\n')
    print('Auth gateway activated; original configuration retained in private state directory.')


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('operation', choices=['prepare', 'apply'])
    p.add_argument('--state-dir', type=Path, required=True)
    a = p.parse_args()
    if os.geteuid() != 0:
        raise ValueError('Run on the reviewed Oracle host as root')
    if not a.state_dir.is_absolute() or a.state_dir.is_symlink():
        raise ValueError('A private absolute state directory is required')
    {'prepare': prepare, 'apply': apply}[a.operation](a.state_dir)

if __name__ == '__main__':
    main()
