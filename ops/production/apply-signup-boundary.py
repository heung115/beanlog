#!/usr/bin/env python3
"""Prepare or reversibly apply the email-signup boundary on an existing deployment."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import shutil
from urllib.parse import unquote, urlsplit

HERE = Path(__file__).resolve().parent
CONTROL_FILES = ['apply-signup-boundary.py', 'prepare-signup-boundary.py', 'apply-auth-budgets.py', 'prepare-auth-budgets.py', 'caddy-version-boundary.py']

def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, HERE / filename)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value

base = module('auth_rollout', 'apply-auth-budgets.py')
generator = module('signup_candidates', 'prepare-signup-boundary.py')
SNIPPET = Path('/etc/caddy/beanmap-controlled-signup.Caddyfile')
FILES = {key: base.FILES[key] for key in ['kong', 'caddy', 'overlay']}
FILES.update({name: base.PLUGIN / name for name in ['handler.lua', 'schema.lua']})


def prepare(state):
    if state.exists() or SNIPPET.exists():
        raise ValueError('Choose a fresh state directory and review any existing signup boundary')
    state.mkdir(mode=0o700, parents=True)
    web_ip = base.inspect('beanlogapp-web-1')['NetworkSettings']['Networks']['beanmap-auth-client-ip']['IPAddress']
    records = {}
    for key, live in FILES.items():
        if live.is_symlink():
            raise ValueError('Refusing symlink configuration')
        shutil.copy2(live, state / (key + '.before'))
        if key == 'kong':
            value = generator.kong_policy(live.read_text(), web_ip)
        elif key == 'caddy':
            value = generator.caddy_policy(live.read_text())
        elif key == 'overlay':
            value = generator.overlay(live.read_text())
        else:
            value = (HERE / 'kong-plugins/beanmap-auth-budgets' / key).read_text()
        candidate = state / (key + '.candidate')
        candidate.write_text(value)
        candidate.chmod(0o600)
        records[key] = {'before': base.digest(live), 'candidate': base.digest(candidate)}
    snippet = state / 'controlled-signup.Caddyfile'
    shutil.copyfile(HERE / 'beanmap-controlled-signup.Caddyfile', snippet)
    snippet.chmod(0o600)
    records['tools'] = {name: base.digest(HERE / name) for name in CONTROL_FILES}
    records['snippet'] = base.digest(snippet)
    validation = state / 'caddy.validation'
    validation.write_text((state / 'caddy.candidate').read_text().replace(str(SNIPPET), str(snippet)))
    validation.chmod(0o600)
    base.validate_caddy(validation)
    base.validate_kong(state, base.inspect('supabase-kong'))
    (state / 'manifest.json').write_text(json.dumps(records, indent=2) + '\n')
    print('Signup candidates validated. No running configuration or service changed.')


def apply(state):
    records = json.loads((state / 'manifest.json').read_text())
    if records.get('tools') != {name: base.digest(HERE / name) for name in CONTROL_FILES}:
        raise ValueError('Rollout or Caddy safety gate changed after preparation')
    if (state / 'applied').exists() or SNIPPET.exists():
        raise ValueError('Signup boundary already activated or changed')
    for key, live in FILES.items():
        if base.digest(live) != records[key]['before'] or base.digest(state / (key + '.candidate')) != records[key]['candidate']:
            raise ValueError('Configuration changed after preparation')
    if base.digest(state / 'controlled-signup.Caddyfile') != records['snippet']:
        raise ValueError('Reviewed ingress snippet changed')
    # Key values are never returned or logged. Operator provisioning and the
    # application release must precede activation of the gateway boundary.
    auth_environment = dict(item.split('=', 1) for item in base.inspect('supabase-auth')['Config']['Env'])
    auth_database = auth_environment.get('GOTRUE_DB_DATABASE_URL', '')
    if unquote(urlsplit(auth_database).username or '') != 'supabase_auth_admin':
        raise ValueError('Auth must use its dedicated non-superuser database identity')
    db_fingerprint = base.run(['docker', 'exec', 'supabase-db', 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-Atqc',
                     "select encode(extensions.digest(secret,'sha256'),'hex') from beanmap_signup.signing_key where id and octet_length(secret)=32"])
    web_fingerprint = base.run(['docker', 'exec', 'beanlogapp-web-1', 'node', '-e',
        'const fs=require("fs"),crypto=require("crypto");const p=process.env.SIGNUP_CONSENT_SECRET_FILE;if(!p)process.exit(1);const value=fs.readFileSync(p,"utf8").trim();if(!/^[a-f0-9]{64}$/.test(value))process.exit(1);process.stdout.write(crypto.createHash("sha256").update(Buffer.from(value,"hex")).digest("hex"))'])
    if not db_fingerprint.strip() or db_fingerprint.strip() != web_fingerprint.strip():
        raise ValueError('Provision the matching signed-consent migration and web key first')
    installed_snippet = False
    try:
        base.atomic_install(state / 'controlled-signup.Caddyfile', SNIPPET, 0o644)
        installed_snippet = True
        for key, live in FILES.items():
            base.atomic_install(state / (key + '.candidate'), live)
        base.run(base.COMPOSE + ['config', '--quiet'], cwd=base.BASE)
        base.validate_caddy(FILES['caddy'])
        base.run(['systemctl', 'reload', 'caddy'])
        base.run(base.COMPOSE + ['up', '-d', '--no-deps', '--no-build', '--wait', 'kong', 'auth'], cwd=base.BASE)
        for name in ['supabase-kong', 'supabase-auth']:
            if base.inspect(name)['State'].get('Health', {}).get('Status') != 'healthy':
                raise RuntimeError('Auth gateway did not become healthy')
    except Exception:
        for key, live in FILES.items():
            base.atomic_install(state / (key + '.before'), live)
        base.run(['systemctl', 'reload', 'caddy'])
        base.run(base.COMPOSE + ['up', '-d', '--no-deps', '--no-build', '--wait', 'kong', 'auth'], cwd=base.BASE)
        if installed_snippet:
            SNIPPET.unlink()
        raise RuntimeError('Signup gateway activation failed; previous gateway configuration restored') from None
    (state / 'applied').write_text('activated\n')
    print('Signup boundary activated. Original gateway files retained privately.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['prepare', 'apply'])
    parser.add_argument('--state-dir', type=Path, required=True)
    args = parser.parse_args()
    if os.geteuid() != 0 or not args.state_dir.is_absolute() or args.state_dir.is_symlink():
        raise ValueError('Root and a private absolute state path are required')
    {'prepare': prepare, 'apply': apply}[args.operation](args.state_dir)

if __name__ == '__main__': main()
