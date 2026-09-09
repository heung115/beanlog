#!/usr/bin/env python3
"""One approved runtime-image stage; preserve live Compose settings and DB data."""
import argparse
import copy
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time

TARGETS = {
    'db': ('supabase-db', 'db', 'beanlogsupabase', '/srv/beanlog/supabase/docker'),
    'rest': ('supabase-rest', 'rest', 'beanlogsupabase', '/srv/beanlog/supabase/docker'),
    'meta': ('beanmap-private-meta', 'private-meta', 'beanmap-private-console', '/opt/beanmap-private-console/deploy'),
    'studio': ('beanmap-private-studio', 'private-studio', 'beanmap-private-console', '/opt/beanmap-private-console/deploy'),
}
COMPOSE_FILES = {
    'beanlogsupabase': ('docker-compose.yml', 'docker-compose.override.yml', 'docker-compose.client-ip.yml', 'docker-compose.security.yml'),
    'beanmap-private-console': ('compose.yml',),
}
DB_MOUNTS = {'/var/lib/postgresql/data': '/srv/beanlog/supabase/docker/volumes/db/data',
             '/etc/postgresql-custom': '/var/lib/docker/volumes/beanlogsupabase_db-config/_data'}
LOCKS = ('/var/lib/beanmap-deploy/deploy.lock', '/var/lib/beanmap-deploy/deploy-execution.lock')
IMAGE = re.compile(r'^sha256:[a-f0-9]{64}$')


def sha(data): return hashlib.sha256(data).hexdigest()


def run(*argv):
    # Rendered Compose, dumps and subprocess diagnostics may contain secrets.
    result = subprocess.run(argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode: raise RuntimeError('Command failed; no subprocess data emitted')
    return result.stdout


def manifest(value):
    if set(value) != {'format', 'images'} or value['format'] != 1 or not isinstance(value['images'], dict):
        raise ValueError('Invalid rollout manifest')
    if not value['images'] or set(value['images']) - TARGETS.keys(): raise ValueError('Unknown service')
    for pair in value['images'].values():
        if not isinstance(pair, dict) or set(pair) != {'old', 'new'}: raise ValueError('Image pair required')
        if any(not isinstance(v, str) or not IMAGE.fullmatch(v) for v in pair.values()): raise ValueError('Immutable image ID required')
        if pair['old'] == pair['new']: raise ValueError('Unchanged image')
    return value


def checked_files(stage, live):
    container, service, project, directory = TARGETS[stage]
    labels = live.get('Config', {}).get('Labels', {})
    expected = [str(Path(directory) / name) for name in COMPOSE_FILES[project]]
    if live['Name'] != '/' + container or labels.get('com.docker.compose.project') != project or labels.get('com.docker.compose.service') != service:
        raise ValueError('Live service identity changed')
    if labels.get('com.docker.compose.project.working_dir') != directory or labels.get('com.docker.compose.project.config_files', '').split(',') != expected:
        raise ValueError('Compose stack differs from reviewed complete file chain')
    return [Path(name) for name in expected]


def image_only(before, after, service, new):
    expected = copy.deepcopy(before); expected['services'][service]['image'] = new
    if after != expected: raise ValueError('Candidate changes settings other than the selected image')


def replacement(original, service, image):
    """Edit only one scalar; full Compose rendering is the semantic authority."""
    if not original.endswith(b'\n'): raise ValueError('Compose source must end with a newline')
    lines = original.decode('utf-8').splitlines(keepends=True)
    headers = [i for i, line in enumerate(lines) if re.fullmatch(r'services:\s*(?:#.*)?\n?', line)]
    if len(headers) != 1: raise ValueError('Expected one plain top-level services mapping')
    start = headers[0] + 1
    end = next((i for i in range(start, len(lines)) if re.match(r'[^\s#]', lines[i])), len(lines))
    service_headers = [i for i in range(start, end) if re.fullmatch(r'  ' + re.escape(service) + r':\s*(?:#.*)?\n?', lines[i])]
    if len(service_headers) > 1: raise ValueError('Duplicate selected service')
    insertion = '    image: ' + image + '\n'
    if not service_headers:
        # A non-plain spelling may be an anchor/flow mapping; do not add a duplicate.
        if any(re.match(r'\s*[\'"]?' + re.escape(service) + r'[\'"]?\s*:', line) for line in lines[start:end]):
            raise ValueError('Unsupported selected service spelling')
        lines[end:end] = ['  ' + service + ':\n', insertion]
    else:
        index = service_headers[0]
        stop = next((i for i in range(index + 1, end) if re.match(r'  [^\s#]', lines[i])), end)
        image_lines = [i for i in range(index + 1, stop) if re.match(r'    image:', lines[i])]
        if len(image_lines) > 1: raise ValueError('Duplicate image scalar')
        if image_lines: lines[image_lines[0]] = insertion
        else: lines.insert(index + 1, insertion)
    return ''.join(lines).encode('utf-8')


def private_write(path, data):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        with os.fdopen(fd, 'wb') as stream:
            fd = None
            stream.write(data); stream.flush(); os.fsync(stream.fileno())
    except BaseException:
        if fd is not None: os.close(fd)
        path.unlink(missing_ok=True)
        raise


def atomic_replace(path, expected, body):
    if path.is_symlink() or path.read_bytes() != expected: raise ValueError('Compose source changed; refuse overwrite')
    stat = path.stat(); temporary = path.with_name(path.name + '.runtime-image-new')
    private_write(temporary, body)
    try:
        os.chown(temporary, stat.st_uid, stat.st_gid); os.chmod(temporary, stat.st_mode & 0o777)
        os.replace(temporary, path)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise


def record(directory, **state):
    path = directory / 'state.json'; temporary = directory / 'state.next.json'
    body = json.dumps({**state, 'updated_at_unix': time.time()}, indent=2).encode() + b'\n'
    private_write(temporary, body)
    try: temporary.replace(path)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise


def inspect(container): return json.loads(run('docker', 'inspect', container))[0]


def wait_healthy(container, image):
    for _ in range(60):
        live = inspect(container)
        if live['Image'] != image: raise RuntimeError('Live image mismatch')
        if live['State'].get('Health', {}).get('Status') == 'healthy': return
        if live['State'].get('Status') in ('dead', 'exited'): break
        time.sleep(2)
    raise RuntimeError('Container did not become healthy')


def compose_command(stage, files):
    _, _, project, directory = TARGETS[stage]
    argv = ['docker', 'compose', '--project-name', project, '--project-directory', directory,
            '--env-file', str(Path(directory) / '.env')]
    for path in files: argv += ['-f', str(path)]
    return argv


def physical_backup(directory, live, old_image):
    mounts = {item['Destination']: item['Source'] for item in live['Mounts'] if item['Destination'] in DB_MOUNTS}
    if mounts != DB_MOUNTS: raise ValueError('DB mount sources changed')
    uid = run('docker', 'exec', 'supabase-db', 'id', '-u', 'postgres').decode().strip()
    gid = run('docker', 'exec', 'supabase-db', 'id', '-g', 'postgres').decode().strip()
    if not uid.isdigit() or not gid.isdigit(): raise ValueError('Invalid postgres owner')
    required = sum(int(run('du', '-sb', source).split()[0]) for source in mounts.values()) * 2 + 1024**3
    if shutil.disk_usage(directory).free < required: raise ValueError('Insufficient local recovery space')
    # SQL stays root-private; it is never automatically replayed against production.
    sql = run('docker', 'exec', 'supabase-db', 'pg_dumpall', '-U', 'supabase_admin', '--clean', '--if-exists')
    if not sql: raise RuntimeError('Empty logical backup')
    private_write(directory / 'latest-cluster.sql', sql)
    return uid + ':' + gid


def stopped_backup(directory, old_image, user):
    run('docker', 'stop', '--time', '60', 'supabase-db')
    if inspect('supabase-db')['State']['Running']: raise RuntimeError('DB is still running')
    state = run('docker', 'run', '--rm', '--network', 'none', '--read-only', '--cap-drop', 'ALL',
                '--security-opt', 'no-new-privileges', '--user', user, '--mount',
                'type=bind,src=' + DB_MOUNTS['/var/lib/postgresql/data'] + ',dst=/backup,readonly',
                '--entrypoint', 'pg_controldata', old_image, '/backup').decode()
    if not any(line.startswith('Database cluster state:') and line.split(':', 1)[1].strip() == 'shut down' for line in state.splitlines()):
        raise RuntimeError('DB did not shut down cleanly')
    for source, filename in zip(DB_MOUNTS.values(), ('data.tar', 'db-config.tar')):
        run('tar', '--xattrs', '--acls', '--numeric-owner', '-C', source, '-cpf', str(directory / filename), '.')
        if not (directory / filename).stat().st_size: raise RuntimeError('Empty physical backup')
    checksums = {}
    for name in ('latest-cluster.sql', 'data.tar', 'db-config.tar'):
        with (directory / name).open('rb') as stream: checksums[name] = hashlib.file_digest(stream, 'sha256').hexdigest()
    private_write(directory / 'backup-checksums.json', json.dumps(checksums, indent=2).encode())


def execute(stage, pair, directory):
    container, service, _, _ = TARGETS[stage]
    live = inspect(container); files = checked_files(stage, live)
    if live['Image'] != pair['old'] or live['State'].get('Health', {}).get('Status') != 'healthy':
        raise ValueError('Source image or health differs from approved baseline')
    for image in pair.values():
        info = json.loads(run('docker', 'image', 'inspect', image))[0]
        if info['Id'] != image or info['Architecture'] != 'arm64' or info['Os'] != 'linux': raise ValueError('Local image identity/platform mismatch')
    if any(p.is_symlink() or not p.is_file() for p in files): raise ValueError('Unsafe Compose source path')
    originals = {p: p.read_bytes() for p in files}
    env = Path(TARGETS[stage][3]) / '.env'
    env_before = env.read_bytes()
    command = compose_command(stage, files)
    before = json.loads(run(*command, 'config', '--format', 'json'))
    configured = run('docker', 'image', 'inspect', before['services'][service]['image'], '--format', '{{.Id}}').decode().strip()
    if configured != pair['old']: raise ValueError('Configured image differs from running old image')
    new_body = replacement(originals[files[-1]], service, pair['new'])
    candidate = directory / 'candidate-overlay.yml'; private_write(candidate, new_body)
    candidate_command = compose_command(stage, [*files[:-1], candidate])
    image_only(before, json.loads(run(*candidate_command, 'config', '--format', 'json')), service, pair['new'])
    for index, path in enumerate(files): private_write(directory / f'compose-source-{index}.yml', originals[path])
    private_write(directory / 'source-hashes.json', json.dumps({str(p): sha(b) for p,b in originals.items()}, indent=2).encode())
    # Prepare and validate an immutable rollback override before any DB stop.
    # Recovery must not depend on another source rewrite succeeding.
    rollback_file = directory / 'rollback-image.yml'
    private_write(rollback_file, ('services:\n  ' + service + ':\n    image: ' + pair['old'] + '\n').encode())
    rollback_command = compose_command(stage, [*files, rollback_file])
    image_only(before, json.loads(run(*rollback_command, 'config', '--format', 'json')), service, pair['old'])
    old_version = None
    if stage == 'db':
        old_version = run('docker', 'exec', container, 'psql', '-U', 'supabase_admin', '-d', 'postgres', '-Atc', 'SHOW server_version_num').decode().strip()
        if old_version != '170011': raise ValueError('This patch rehearsal requires PostgreSQL 17.11')
        for image in pair.values():
            version = run('docker', 'run', '--rm', '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--entrypoint', 'postgres', image, '--version').decode().strip()
            if not re.fullmatch(r'postgres \(PostgreSQL\) 17\.11(?:\s.*)?', version): raise ValueError('PostgreSQL binary version changed')
        db_user = physical_backup(directory, live, pair['old'])
    record(directory, status='prepared', stage=stage, images=pair)
    changed = False; stopped = False
    try:
        if any(p.read_bytes() != b for p,b in originals.items()) or env.read_bytes() != env_before:
            raise ValueError('Compose inputs changed during preparation')
        if stage == 'db':
            # Mark before the stop attempt so even partial stop failures restart old.
            stopped = True; stopped_backup(directory, pair['old'], db_user)
            record(directory, status='stopped-cluster-backup-complete', stage=stage, images=pair)
        atomic_replace(files[-1], originals[files[-1]], new_body); changed = True
        image_only(before, json.loads(run(*command, 'config', '--format', 'json')), service, pair['new'])
        record(directory, status='replacing-image', stage=stage, images=pair)
        run(*command, 'up', '-d', '--no-deps', '--pull', 'never', '--timeout', '60', service)
        wait_healthy(container, pair['new'])
        if stage == 'db' and run('docker','exec',container,'psql','-U','supabase_admin','-d','postgres','-Atc','SHOW server_version_num').decode().strip() != old_version:
            raise RuntimeError('Running DB version changed')
        record(directory, status='healthy-awaiting-independent-validation', stage=stage, images=pair)
    except BaseException:
        try:
            source_repair_required = False
            if changed or stopped:
                if changed:
                    rollback_body = replacement(originals[files[-1]], service, pair['old'])
                    try: atomic_replace(files[-1], new_body, rollback_body)
                    except Exception: source_repair_required = True
                # The pre-created override pins old even if chown/fsync/replace
                # failed. If source never changed, no source write is attempted.
                image_only(before, json.loads(run(*rollback_command, 'config', '--format', 'json')), service, pair['old'])
                if stage == 'db': run('docker', 'stop', '--time', '60', container)
                run(*rollback_command, 'up', '-d', '--no-deps', '--pull', 'never', '--timeout', '60', service)
                wait_healthy(container, pair['old'])
            record(directory, status='failed-old-image-restored' if changed or stopped else 'failed-before-change',
                   stage=stage, images=pair, source_repair_required=source_repair_required,
                   rollback_override_active=changed or stopped)
        except BaseException:
            record(directory, status='manual-recovery-required', stage=stage, images=pair)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', required=True, type=Path)
    parser.add_argument('--stage', required=True, choices=TARGETS)
    parser.add_argument('--state-directory', required=True, type=Path)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args(); os.umask(0o077)
    if not args.apply or os.geteuid() != 0: raise ValueError('Coordinator approval and root --apply required')
    plan = manifest(json.loads(args.manifest.read_text()))
    if args.stage not in plan['images']: raise ValueError('Stage not approved in manifest')
    directory = args.state_directory
    if not directory.is_absolute() or directory.is_symlink() or not str(directory).startswith('/srv/beanlog/security-') or directory.exists():
        raise ValueError('Use a fresh private /srv/beanlog/security-* stage directory')
    if directory.parent.is_symlink(): raise ValueError('State parent must not be a symlink')
    handles = []
    try:
        for lock in LOCKS:
            handle = open(lock, 'a'); handles.append(handle); fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        directory.mkdir(mode=0o700, parents=True)
        private_write(directory / 'approved-manifest.json', json.dumps(plan, indent=2).encode())
        execute(args.stage, plan['images'][args.stage], directory)
        print(json.dumps({'stage': args.stage, 'status': 'healthy-awaiting-independent-validation'}))
        return 0
    except BaseException as error:
        print(json.dumps({'stage': args.stage, 'status': 'failed', 'reason': type(error).__name__}))
        return 1
    finally:
        for handle in reversed(handles): handle.close()


if __name__ == '__main__':
    try: raise SystemExit(main())
    except (ValueError, OSError, RuntimeError):
        print(json.dumps({'status': 'preflight-failed'})); raise SystemExit(1)
