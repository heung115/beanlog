#!/usr/bin/env python3
"""Bounded real Auth /otp → Mailpit → /verify compatibility regression.

Uses existing images only, one internal network, no published ports or volumes,
random fixture credentials, and immutable-ID cleanup. No production service is
queried. Run with --help for image selectors; defaults match local staging.
"""
import argparse
import json
import os
from pathlib import Path
import secrets
import subprocess
import tempfile
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
OWNER = 'site.beanmap.fixture.internal-auth-otp'


def command(args, *, data=None, timeout=60, allow_failure=False):
    result = subprocess.run(['docker', *args], input=data, capture_output=True, text=True, timeout=timeout)
    if result.returncode and not allow_failure:
        # Docker/Auth stderr may contain connection strings or credentials.
        safe = next((line for line in result.stderr.splitlines() if line.startswith('FIXTURE_CHECK_FAILED: ')), None)
        raise RuntimeError(safe or f'Docker {args[0]} failed (exit {result.returncode}); output suppressed')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--auth-image', default='public.ecr.aws/supabase/gotrue:v2.192.0')
    parser.add_argument('--postgres-image', default='postgres:17-alpine')
    parser.add_argument('--mailpit-image', default='public.ecr.aws/supabase/mailpit:v1.30.2')
    parser.add_argument('--caddy-image', default='sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d')
    parser.add_argument('--node-image', default='sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32')
    args = parser.parse_args()
    run_id = str(uuid.uuid4())
    prefix = 'beanmap-otp-' + run_id
    images = {name: json.loads(command(['image', 'inspect', value]).stdout)[0]['Id'] for name, value in {
        'auth': args.auth_image, 'db': args.postgres_image, 'mail': args.mailpit_image, 'probe': args.node_image, 'caddy': args.caddy_image,
    }.items()}
    containers = []
    network_id = None
    cleanup_errors = []
    summary = None
    with tempfile.TemporaryDirectory(prefix=prefix + '-') as temporary:
        private = Path(temporary)
        os.chmod(private, 0o700)
        password = secrets.token_hex(32)
        jwt_secret = secrets.token_hex(32)

        def env_file(name, values):
            path = private / name
            path.write_text(''.join(f'{key}={value}\n' for key, value in values.items()))
            os.chmod(path, 0o600)
            return str(path)

        def launch(part, extra, tail=None):
            output = command(['run', '-d', '--pull=never', '--name', prefix + '-' + part,
                '--label', OWNER + '=' + run_id, '--network', network_id, '--network-alias', part,
                '--restart=no', '--cpus=0.5', '--memory=256m', '--pids-limit=100',
                '--security-opt=no-new-privileges:true', '--cap-drop=ALL',
                *extra, images[part], *(tail or [])]).stdout.strip()
            if len(output) != 64 or any(c not in '0123456789abcdef' for c in output):
                raise RuntimeError('Docker did not return an immutable container ID')
            containers.append(output)
            return output

        try:
            network_id = command(['network', 'create', '--internal', '--label', OWNER + '=' + run_id, prefix]).stdout.strip()
            if len(network_id) != 64 or any(c not in '0123456789abcdef' for c in network_id):
                raise RuntimeError('Docker did not return an immutable network ID')
            db = launch('db', ['--env-file', env_file('postgres.env', {'POSTGRES_PASSWORD': password,
                'POSTGRES_DB': 'postgres', 'PGDATA': '/var/lib/postgresql/data/pgdata'}),
                '--tmpfs', '/var/lib/postgresql/data:rw,nosuid,nodev,size=192m',
                '--tmpfs', '/var/run/postgresql:rw,nosuid,nodev,size=8m',
                '--user', 'postgres', '--entrypoint', 'docker-entrypoint.sh'], ['postgres'])
            for _ in range(45):
                if command(['exec', db, 'pg_isready', '-U', 'postgres'], allow_failure=True).returncode == 0:
                    break
                time.sleep(0.5)
            else:
                raise RuntimeError('Isolated PostgreSQL did not become ready')
            command(['exec', '-i', db, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
                data='CREATE SCHEMA IF NOT EXISTS auth; CREATE EXTENSION IF NOT EXISTS pgcrypto; ALTER ROLE postgres SET search_path = auth, public;')
            launch('mail', ['--read-only', '--tmpfs', '/tmp:rw,nosuid,nodev,size=32m',
                '-e', 'MP_MAX_MESSAGES=10', '-e', 'MP_DISABLE_VERSION_CHECK=true'])
            # This template has no remote resources and displays only the OTP.
            probe = launch('probe', ['--read-only', '--tmpfs', '/tmp:rw,nosuid,nodev,size=8m'],
                ['node', '-e', "require('http').createServer((q,s)=>{s.setHeader('Content-Type','text/html');s.end('<html><body><p>{{ .Token }}</p></body></html>')}).listen(8080,'0.0.0.0')"])
            launch('auth', ['--read-only', '--tmpfs', '/tmp:rw,nosuid,nodev,size=16m',
                '--env-file', env_file('auth.env', {
                    'GOTRUE_API_HOST': '0.0.0.0', 'GOTRUE_API_PORT': '9999',
                    'API_EXTERNAL_URL': 'http://auth:9999', 'GOTRUE_SITE_URL': 'http://probe:8080',
                    'GOTRUE_DB_DRIVER': 'postgres',
                    'GOTRUE_DB_DATABASE_URL': f'postgres://postgres:{password}@db:5432/postgres?sslmode=disable',
                    'GOTRUE_JWT_SECRET': jwt_secret, 'GOTRUE_JWT_EXP': '300',
                    'GOTRUE_JWT_AUD': 'authenticated', 'GOTRUE_JWT_DEFAULT_GROUP_NAME': 'authenticated',
                    'GOTRUE_JWT_ADMIN_ROLES': 'service_role', 'GOTRUE_DISABLE_SIGNUP': 'false',
                    'GOTRUE_EXTERNAL_EMAIL_ENABLED': 'true', 'GOTRUE_MAILER_AUTOCONFIRM': 'false',
                    'GOTRUE_SMTP_HOST': 'mail', 'GOTRUE_SMTP_PORT': '1025',
                    'GOTRUE_SMTP_ADMIN_EMAIL': 'fixture@local.test', 'GOTRUE_SMTP_SENDER_NAME': 'OTP fixture',
                    'GOTRUE_SMTP_MAX_FREQUENCY': '1s', 'GOTRUE_RATE_LIMIT_EMAIL_SENT': '10',
                    'GOTRUE_RATE_LIMIT_HEADER': 'X-Beanmap-Auth-Rate-Identity',
                    'GOTRUE_MAILER_OTP_LENGTH': '6', 'GOTRUE_MAILER_OTP_EXP': '300',
                    'GOTRUE_MAILER_TEMPLATES_MAGIC_LINK': 'http://probe:8080/template',
                    'GOTRUE_MAILER_TEMPLATES_RECOVERY': 'http://probe:8080/template',
                    'GOTRUE_LOG_LEVEL': 'error',
                })])
            caddy_config = private / 'Caddyfile'
            caddy_config.write_text('{\n admin off\n auto_https off\n}\n'
                + (ROOT / 'ops/production/beanmap-controlled-signup.Caddyfile').read_text()
                + '\n:8080 {\n route {\n import beanmap_controlled_signup\n uri strip_prefix /auth/v1\n reverse_proxy auth:9999\n }\n}\n')
            os.chmod(caddy_config, 0o644)
            launch('caddy', ['--cap-add=NET_BIND_SERVICE', '--read-only', '--tmpfs', '/data:rw,nosuid,nodev,size=8m',
                '--tmpfs', '/config:rw,nosuid,nodev,size=8m', '-v', f'{caddy_config}:/etc/caddy/Caddyfile:ro'])
            client = (ROOT / 'tests/fixtures/internal-auth-otp/client.mjs').read_text()
            # Secrets enter the client only through stdin; never argv or output.
            payload = json.dumps({'jwtSecret': jwt_secret, 'password': secrets.token_hex(32),
                'rateSecret': secrets.token_hex(32), 'runID': run_id})
            source = 'const config = ' + payload + ';\n' + client
            output = command(['exec', '-i', probe, 'node', '--input-type=module'], data=source, timeout=75).stdout
            summary = json.loads(output)
            summary['images'] = images
        finally:
            for container_id in reversed(containers):
                inspected = command(['inspect', container_id], allow_failure=True)
                if inspected.returncode:
                    cleanup_errors.append('container inspection failed')
                    continue
                labels = json.loads(inspected.stdout)[0]['Config'].get('Labels') or {}
                if labels.get(OWNER) != run_id:
                    cleanup_errors.append('container owner mismatch')
                    continue
                if command(['rm', '-f', '-v', container_id], allow_failure=True).returncode:
                    cleanup_errors.append('container removal failed')
            if network_id:
                inspected = command(['network', 'inspect', network_id], allow_failure=True)
                if inspected.returncode == 0 and (json.loads(inspected.stdout)[0].get('Labels') or {}).get(OWNER) == run_id:
                    if command(['network', 'rm', network_id], allow_failure=True).returncode:
                        cleanup_errors.append('network removal failed')
                else:
                    cleanup_errors.append('network owner could not be verified')
            if cleanup_errors:
                raise RuntimeError('; '.join(cleanup_errors))
    summary['cleanup'] = 'all created containers and internal network removed; no persistent volumes or build cache created'
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
