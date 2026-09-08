#!/usr/bin/env python3
"""Root-only, explicitly started coordinated SQL/app release. No default execution."""
from __future__ import annotations

import argparse
import copy
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import stat
import subprocess
import time
import urllib.request

STATE = Path('/var/lib/beanmap-deploy')
APP = Path('/srv/beanlog/app')
SOURCE = Path('/srv/beanlog/app-src')
REPO = STATE / 'repository.git'
SECRET = Path('/etc/beanmap-private-console/auth-rate-id.secret')
MIGRATIONS = ('00029_', '00030_', '00031_', '00032_')


def migration_sources(source: Path) -> list[tuple[str, str, str]]:
    result = []
    for prefix in MIGRATIONS:
        found = sorted((source / 'supabase/migrations').glob(prefix + '*.sql'))
        if len(found) != 1:
            raise ValueError(f'Expected exactly one {prefix} migration')
        raw = found[0].read_text()
        # Repository migrations explicitly wrap themselves. Remove only their
        # unique outer transaction, retaining every function/DO block body.
        begins = list(re.finditer(r'^begin;\s*$', raw, re.I | re.M))
        commits = list(re.finditer(r'^commit;\s*$', raw, re.I | re.M))
        if len(begins) != 1 or len(commits) != 1 or begins[0].start() >= commits[0].start():
            raise ValueError(f'Unexpected transaction boundaries: {found[0].name}')
        prefix_text = raw[:begins[0].start()]
        suffix_text = raw[commits[0].end():]
        if any(line.strip() and not line.lstrip().startswith('--') for line in (prefix_text + suffix_text).splitlines()):
            raise ValueError(f'SQL outside transaction: {found[0].name}')
        digest = hashlib.sha256(raw.encode()).hexdigest()
        result.append((found[0].name, digest, raw[begins[0].end():commits[0].start()]))
    return result


def transaction_sql(source: Path, applied: dict[str, str]) -> str:
    migrations = migration_sources(source)
    expected = {name: checksum for name, checksum, _ in migrations}
    if applied and applied != expected:
        raise ValueError('Partial or changed migration ledger; manual review required')
    chunks = ["begin;", "set local lock_timeout = '10s';", "set local statement_timeout = '120s';"]
    if not applied:
        chunks.extend(body for _, _, body in migrations)
        chunks.append('''create table beanmap_security.release_migrations (
          name text primary key, sha256 text not null, applied_at timestamptz not null default now()
        );
        alter table beanmap_security.release_migrations owner to postgres;
        revoke all on beanmap_security.release_migrations from public, anon, authenticated, service_role, beanmap_api_runtime;''')
        chunks.extend(f"insert into beanmap_security.release_migrations(name,sha256) values ('{name}','{checksum}');" for name, checksum, _ in migrations)
    chunks.append((source / 'scripts/verify-function-acls.sql').read_text())
    chunks.append('commit;')
    return '\n'.join(chunks) + '\n'


def verify_overlay(before: dict, after: dict) -> None:
    """Permit only the reviewed API auth endpoint and private secret mount."""
    expected = copy.deepcopy(before)
    api = expected['services']['api']
    api.setdefault('environment', {}).update(AUTH_URL='http://supabase-auth:9999', AUTH_RATE_ID_SECRET_FILE='/run/secrets/auth_rate_id')
    api['secrets'] = [entry for entry in api.get('secrets', []) if entry['source'] != 'auth_rate_id']
    api['secrets'].append({'source': 'auth_rate_id', 'target': '/run/secrets/auth_rate_id'})
    expected.setdefault('secrets', {})['auth_rate_id'] = {'name': expected['name'] + '_auth_rate_id', 'file': str(SECRET)}
    # Compose sorts named collections. Secret sequence order is not material.
    for config in (expected, after):
        for service in config['services'].values():
            if 'secrets' in service:
                service['secrets'] = sorted(service['secrets'], key=lambda entry: entry['source'])
    if expected != after:
        raise ValueError('Candidate changes existing Compose fields beyond the reviewed API additions')


def private_write(path: Path, content: str | bytes, mode=0o600):
    temporary = path.with_name(path.name + '.new')
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW
    fd = os.open(temporary, flags, mode)
    try:
        with os.fdopen(fd, 'wb') as output:
            output.write(content.encode() if isinstance(content, str) else content)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


class Rollout:
    def __init__(self, directory: Path):
        self.directory = directory
        self.log = open(directory / 'operator.log', 'ab', buffering=0)
        self.sql_started = False

    def status(self, phase: str, **fields):
        private_write(self.directory / 'status.json', json.dumps({'phase': phase, 'time': dt.datetime.now(dt.timezone.utc).isoformat(), **fields}) + '\n')
        print(phase, flush=True)

    def run(self, args, *, data=None, capture=False, stdout=None):
        result = subprocess.run([str(arg) for arg in args], input=data, stdout=subprocess.PIPE if capture else (stdout or self.log), stderr=self.log, check=True)
        return result.stdout.decode().strip() if capture else None

    def compose(self, security=None):
        return ['docker', 'compose', '--project-directory', APP, '-f', APP / 'docker-compose.yml', '-f', APP / 'docker-compose.client-ip.yml', '-f', security or APP / 'docker-compose.security.yml']

    def psql(self, sql, capture=False):
        return self.run(['docker', 'exec', '-i', 'supabase-db', 'psql', '-X', '-U', 'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], data=sql.encode(), capture=capture)

    def github(self, suffix):
        request = urllib.request.Request('https://api.github.com/repos/heung115/beanlog/' + suffix, headers={'Accept': 'application/vnd.github+json', 'User-Agent': 'beanmap-coordinated-release', 'Cache-Control': 'no-cache'})
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)

    def verified_release(self):
        request_file = self.directory / 'release.json'
        info = request_file.lstat()
        if info.st_uid != 0 or info.st_mode & 0o077 or not stat.S_ISREG(info.st_mode):
            raise ValueError('Release request must be a root-owned private regular file')
        request = json.loads(request_file.read_text())
        sha, run_id = request['sha'], str(request['run_id'])
        if not re.fullmatch('[0-9a-f]{40}', sha) or not re.fullmatch('[1-9][0-9]*', run_id):
            raise ValueError('Invalid release identity')
        run = self.github('actions/runs/' + run_id)
        if not (run['head_sha'] == sha and run['head_branch'] == 'main' and run['event'] == 'push' and run['path'] == '.github/workflows/ci-cd.yml' and run['repository']['full_name'] == 'heung115/beanlog'):
            raise ValueError('CI run does not identify this main release')
        jobs = self.github('actions/runs/' + run_id + '/jobs?per_page=100')['jobs']
        if not any(job['name'] == 'Verify' and job['status'] == 'completed' and job['conclusion'] == 'success' for job in jobs):
            raise ValueError('Required Verify job has not succeeded')
        self.run(['git', '--git-dir=' + str(REPO), 'fetch', '--force', 'https://github.com/heung115/beanlog.git', '+refs/heads/main:refs/heads/main'])
        if self.run(['git', '--git-dir=' + str(REPO), 'rev-parse', 'refs/heads/main'], capture=True) != sha:
            raise ValueError('Release is no longer latest main')
        current = (STATE / 'deployed-sha').read_text().strip()
        if not re.fullmatch('[0-9a-f]{40}', current):
            raise ValueError('Invalid current release identity')
        self.run(['git', '--git-dir=' + str(REPO), 'merge-base', '--is-ancestor', current, sha])
        return sha

    def apply(self):
        sha = self.verified_release()
        attempt = self.directory / ('attempt-' + dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S') + '-' + secrets.token_hex(3))
        attempt.mkdir(mode=0o700)
        source = attempt / 'source'
        source.mkdir(mode=0o700)
        archive = attempt / 'release.tar'
        with archive.open('wb') as out:
            self.run(['git', '--git-dir=' + str(REPO), 'archive', '--format=tar', sha], stdout=out)
        self.run(['tar', '-xf', archive, '-C', source])
        before = json.loads(self.run(self.compose() + ['config', '--format', 'json'], capture=True))
        candidate = source / 'ops/production/compose.security-app.yml'
        after = json.loads(self.run(self.compose(candidate) + ['config', '--format', 'json'], capture=True))
        verify_overlay(before, after)
        # Save host config and the entire existing source separately from images.
        for filename in ('docker-compose.yml', 'docker-compose.client-ip.yml', 'docker-compose.security.yml'):
            shutil.copy2(APP / filename, attempt / ('previous-' + filename))
        self.run(['tar', '-czf', attempt / 'previous-app-source.tar.gz', '-C', SOURCE, '.'])
        old_images = {name: self.run(['docker', 'inspect', '--format', '{{.Image}}', f'beanlogapp-{name}-1'], capture=True) for name in ('web', 'api')}
        private_write(attempt / 'previous-images.json', json.dumps(old_images))
        for name, image in old_images.items():
            self.run(['docker', 'image', 'tag', image, f'beanmap-rollout-backup/{name}:{attempt.name}'])
        if SECRET.exists():
            info = SECRET.lstat()
            if SECRET.is_symlink() or info.st_uid != 1001 or info.st_gid != 1001 or info.st_mode & 0o777 != 0o400 or info.st_size != 64:
                raise ValueError('Existing auth rate identity secret has unexpected metadata')
        else:
            fd = os.open(SECRET, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o400)
            with os.fdopen(fd, 'wb') as out:
                os.fchown(out.fileno(), 1001, 1001)
                out.write(secrets.token_hex(32).encode())
                out.flush()
                os.fsync(out.fileno())
        # The secret is private and never included in source archives or logs.
        self.run(['rsync', '-a', '--delete', '--exclude=.env*', '--exclude=.audit-report.md', '--exclude=CONTEXT.md', '--exclude=.staging/', str(source) + '/', str(SOURCE) + '/'])
        self.status('building', sha=sha, attempt=attempt.name)
        self.run(self.compose(candidate) + ['build', '--build-arg', 'NEXT_DEPLOYMENT_ID=' + sha])
        expected_images = {name: self.run(['docker', 'image', 'inspect', '--format', '{{.Id}}', after['services'][name]['image']], capture=True) for name in ('web', 'api')}
        if self.run(['docker', 'image', 'inspect', '--format', '{{index .Config.Labels "site.beanmap.deployment-id"}}', expected_images['web']], capture=True) != sha:
            raise ValueError('Built web image does not identify the approved release')
        # A fresh check prevents replacing with an obsolete main after a long build.
        if self.verified_release() != sha:
            raise ValueError('Release identity changed during build')
        self.status('backing-up-database', sha=sha)
        with (attempt / 'database.dump').open('wb') as out:
            self.run(['docker', 'exec', 'supabase-db', 'pg_dump', '-U', 'supabase_admin', '-d', 'postgres', '-Fc'], stdout=out)
        with (attempt / 'globals.sql').open('wb') as out:
            self.run(['docker', 'exec', 'supabase-db', 'pg_dumpall', '-U', 'supabase_admin', '--globals-only'], stdout=out)
        with (attempt / 'database.dump').open('rb') as dump:
            subprocess.run(['docker', 'exec', '-i', 'supabase-db', 'pg_restore', '--list'], stdin=dump, stdout=self.log, stderr=self.log, check=True)
        ledger_exists = self.psql("select to_regclass('beanmap_security.release_migrations') is not null;", True) == 't'
        applied = json.loads(self.psql("select coalesce(json_object_agg(name,sha256),'{}'::json) from beanmap_security.release_migrations;", True)) if ledger_exists else {}
        sql = transaction_sql(source, applied)
        private_write(attempt / 'migration-transaction.sql', sql)
        if self.verified_release() != sha:
            raise ValueError('Release identity changed during database backup')
        # Install the reviewed overlay before SQL, with no container recreation.
        private_write(APP / 'docker-compose.security.yml', candidate.read_text())
        self.status('applying-sql', sha=sha)
        # Any uncertainty from this point onward keeps both locks, including a
        # lost connection while COMMIT may have succeeded. Resume checks ledger.
        self.sql_started = True
        self.psql(sql)
        self.status('replacing-app', sha=sha)
        self.run(self.compose() + ['up', '-d', '--no-build', '--remove-orphans', '--wait', '--wait-timeout', '180'])
        for name, expected in expected_images.items():
            actual = json.loads(self.run(['docker', 'inspect', f'beanlogapp-{name}-1'], capture=True))[0]
            if actual['Image'] != expected or actual['State'].get('Health', {}).get('Status') != 'healthy':
                raise ValueError('Running app image or health does not match release')
        self.run(['docker', 'exec', 'beanlogapp-web-1', 'node', 'scripts/verify-image-runtime.mjs'])
        self.psql((source / 'scripts/verify-function-acls.sql').read_text())
        self.run(['curl', '--fail', '--silent', '--show-error', '--max-time', '20', '--output', '/dev/null', 'http://127.0.0.1:3100/ko/login'])
        private_write(STATE / 'deployed-sha', sha + '\n')
        self.status('complete', sha=sha, attempt=attempt.name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true', help='explicitly authorize acquiring deployment locks and waiting for release.json')
    parser.add_argument('--state-dir', type=Path, required=True)
    args = parser.parse_args()
    if not args.execute or os.geteuid() != 0:
        parser.error('Execution requires root and explicit --execute')
    os.umask(0o077)
    directory = args.state_dir.resolve()
    directory.mkdir(parents=True, mode=0o700, exist_ok=True)
    info = directory.stat()
    if info.st_uid != 0 or info.st_mode & 0o077:
        parser.error('State directory must be root-owned and private')
    STATE.mkdir(mode=0o700, exist_ok=True)
    # Match the existing poller→wrapper order; no service or timer is stopped.
    with (STATE / 'deploy.lock').open('a') as poller, (STATE / 'deploy-execution.lock').open('a') as execution:
        fcntl.flock(poller, fcntl.LOCK_EX)
        fcntl.flock(execution, fcntl.LOCK_EX)
        rollout = Rollout(directory)
        rollout.status('locked-waiting-for-release')
        while not (directory / 'release.json').exists():
            time.sleep(2)
        while True:
            try:
                rollout.apply()
                return
            except Exception as error:
                # Error details/command output remain only in the private log.
                rollout.log.write((type(error).__name__ + ': ' + str(error) + '\n').encode())
                rollout.status('failed-locks-held', sql_may_be_applied=rollout.sql_started)
                # Never leave new main eligible for the old deployer after a
                # failed coordinated release. An operator must fix then resume.
                while not (directory / 'resume').exists():
                    time.sleep(2)
                (directory / 'resume').unlink()


if __name__ == '__main__':
    main()
