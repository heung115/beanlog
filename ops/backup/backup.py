#!/usr/bin/env python3
"""Encrypted host export and off-host pull. Installation/scheduling is external."""
from __future__ import annotations
import argparse
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time

FORMAT = 1
COMPONENTS = {'database.dump.age', 'roles.sql.age', 'recovery-config.tar.age', 'postgres-config.tar.age', 'runtime-inventory.json.age', 'images.tar.age', 'images.tar.gz.age', 'images.delta.tar.gz.age', 'image-base.json.age', 'tailscale-serve.json.age'}
NAME = re.compile(r'^backup-\d{8}T\d{6}Z-[0-9a-f]{8}$')
CONTAINERS = ('supabase-db', 'supabase-auth', 'supabase-rest', 'supabase-kong',
              'beanlogapp-web-1', 'beanlogapp-api-1', 'beanmap-private-meta', 'beanmap-private-studio')


def now():
    return dt.datetime.now(dt.timezone.utc)


def private_directory(path):
    path = Path(path).expanduser()
    if path.is_symlink():
        raise ValueError('Directory must not be a symlink')
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    if path.stat().st_uid != os.geteuid() or path.stat().st_mode & 0o077:
        raise ValueError('Directory must be owned by the current user, mode 0700')
    return path.resolve()


def digest(path):
    h = hashlib.sha256()
    with open(path, 'rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def encrypt_command(command, output, recipient, age='age'):
    """Pipe every producer/compressor into age; check every process exit."""
    commands = command if command and isinstance(command[0], (list, tuple)) else [command]
    commands = [*commands, [age, '--encrypt', '--recipient', recipient]]
    processes = []
    with open(output, 'xb') as target, tempfile.TemporaryFile() as errors:
        try:
            previous = None
            for index, invocation in enumerate(commands):
                process = subprocess.Popen(invocation, stdin=previous.stdout if previous else None,
                    stdout=target if index == len(commands) - 1 else subprocess.PIPE, stderr=errors)
                if previous: previous.stdout.close()
                processes.append(process); previous = process
            statuses = [process.wait() for process in reversed(processes)]
            if any(statuses):
                raise RuntimeError('Backup producer, compressor or encryption failed')
            target.flush(); os.fsync(target.fileno())
        except BaseException:
            for process in reversed(processes):
                if process.poll() is None: process.kill()
                process.wait()
            raise


def bundle(directory, commands, recipient, age='age', *, recovery_scope='database-and-roles'):
    created = now()
    for filename, command in commands.items():
        if filename not in COMPONENTS:
            raise ValueError('Unexpected backup component')
        encrypt_command(command, directory / filename, recipient, age)
    manifest = {'format': FORMAT, 'created_at': created.isoformat(), 'completed_at': now().isoformat(),
                'recovery_scope': recovery_scope,
                'recipient_sha256': hashlib.sha256(recipient.encode()).hexdigest(),
                'files': {name: {'bytes': (directory / name).stat().st_size, 'sha256': digest(directory / name)} for name in commands}}
    (directory / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    return manifest


def export(args):
    if os.geteuid() != 0:
        raise ValueError('Host export requires the reviewed root-installed helper')
    if not re.fullmatch(r'age1[023456789acdefghjklmnpqrstuvwxyz]{58}', args.recipient):
        raise ValueError('Use a dedicated age X25519 public recipient')
    age = shutil.which('age')
    if age is None:
        raise ValueError('Reviewed age installation is required on the source host')
    commands = {
        'database.dump.age': ['docker', 'exec', 'supabase-db', 'pg_dump', '-U', 'supabase_admin', '-d', 'postgres', '--format=custom'],
        'roles.sql.age': ['docker', 'exec', 'supabase-db', 'pg_dumpall', '-U', 'supabase_admin', '--globals-only'],
    }
    scope = 'database-and-roles'
    if args.include_recovery_config:
        paths = [Path('/etc/beanmap-private-console'), Path('/etc/beanmap-auth-client-ip'),
                 Path('/srv/beanlog/app/.env'), Path('/srv/beanlog/app/secrets'),
                 Path('/srv/beanlog/supabase/docker/.env'), Path('/etc/caddy'),
                 Path('/srv/beanlog/supabase/docker/volumes/api'),
                 Path('/opt/beanmap-private-console/deploy/.env'),
                 Path('/opt/beanmap-private-console/deploy/compose.yml'),
                 Path('/usr/local/sbin/beanmap-private-transport'),
                 Path('/etc/systemd/system/beanmap-private-transport.service'),
                 Path('/etc/systemd/system/docker.service.d/beanmap-private-transport.conf'),
                 Path('/etc/systemd/system/caddy.service.d/private-console.conf')]
        for directory in ('/srv/beanlog/app', '/srv/beanlog/supabase/docker'):
            paths.extend(Path(directory).glob('docker-compose*.yml'))
        paths.extend(Path('/srv/beanlog/supabase/docker/volumes/db').glob('*.sql'))
        if not all(path.exists() for path in paths):
            raise ValueError('Required recovery configuration path is missing')
        commands['recovery-config.tar.age'] = ['tar', '-C', '/', '-cf', '-'] + [str(path.relative_to('/')) for path in paths]
        commands['postgres-config.tar.age'] = ['docker', 'exec', 'supabase-db', 'tar', '-C', '/etc/postgresql-custom', '-cf', '-', '.']
        commands['runtime-inventory.json.age'] = ['docker', 'inspect', *CONTAINERS]
        # Capture only Serve routing declarations, never tailscaled.state or node keys.
        commands['tailscale-serve.json.age'] = ['tailscale', 'serve', 'status', '--json']
        scope += '-runtime-config'
    # Shared lock excludes the existing exclusive deployment/migration wrapper.
    # Other manual role/schema changes must follow the same operator lock.
    with tempfile.TemporaryDirectory(prefix='beanmap-encrypted-export-') as temp:
        directory = Path(temp)
        with open('/var/lib/beanmap-deploy/deploy-execution.lock', 'a') as lock:
            fcntl.flock(lock, fcntl.LOCK_SH)
            if args.include_images:
                ids = sorted({subprocess.check_output(['docker', 'inspect', '--format', '{{.Image}}', name], text=True).strip() for name in CONTAINERS})
                commands['images.tar.gz.age'] = [['docker', 'image', 'save', *ids], ['gzip', '-1']]
                scope += '-container-images'
            bundle(directory, commands, args.recipient, age, recovery_scope=scope)
        # Only snapshot production needs the deployment lock; slow transfer must
        # never keep a completed immutable encrypted snapshot blocking a release.
        with tarfile.open(fileobj=sys.stdout.buffer, mode='w|') as archive:
            for path in sorted(directory.iterdir()):
                archive.add(path, arcname=path.name, recursive=False)


def unpack(stream, directory, max_bytes):
    seen, total = set(), 0
    with tarfile.open(fileobj=stream, mode='r|*') as archive:
        for member in archive:
            if member.name not in COMPONENTS | {'manifest.json'} or not member.isfile() or member.name in seen:
                raise ValueError('Unexpected, repeated or unsafe backup archive member')
            total += member.size
            if member.size < 1 or total > max_bytes or (member.name == 'manifest.json' and member.size > 16384):
                raise ValueError('Backup archive exceeds configured limits')
            seen.add(member.name)
            with archive.extractfile(member) as source, (directory / member.name).open('xb') as target:
                shutil.copyfileobj(source, target)
    if not {'manifest.json', 'database.dump.age', 'roles.sql.age'} <= seen:
        raise ValueError('Incomplete backup archive')
    validate(directory)


def validate(directory):
    manifest = json.loads((directory / 'manifest.json').read_text())
    if manifest['format'] != FORMAT or not {'database.dump.age', 'roles.sql.age'} <= manifest['files'].keys():
        raise ValueError('Unsupported or incomplete manifest')
    if set(path.name for path in directory.iterdir()) != set(manifest['files']) | {'manifest.json'}:
        raise ValueError('Manifest does not cover every artifact')
    for name, info in manifest['files'].items():
        path = directory / name
        if name not in COMPONENTS or path.is_symlink() or not path.is_file() or path.stat().st_size != info['bytes'] or digest(path) != info['sha256']:
            raise ValueError('Encrypted backup checksum mismatch')
    return manifest


def configurations(path):
    config = json.loads(Path(path).read_text())
    if config.get('source_alias') != 'oracle':
        raise ValueError('Only the pre-authorized oracle SSH alias is supported')
    if not re.fullmatch(r'age1[023456789acdefghjklmnpqrstuvwxyz]{58}', config.get('recipient', '')):
        raise ValueError('Configure a dedicated public age recipient')
    for field, low, high in [('retention_days', 2, 3650), ('rpo_hours', 1, 720), ('max_archive_gib', 1, 1000)]:
        value = config.get(field)
        if type(value) is not int or not low <= value <= high:
            raise ValueError('Invalid numeric backup policy')
    return config


def prune(directory, retention_days):
    backups = sorted(path for path in directory.iterdir() if path.is_dir() and not path.is_symlink() and NAME.fullmatch(path.name))
    cutoff = now() - dt.timedelta(days=retention_days)
    # Never delete the two newest generations or any unrecognized directory.
    for path in backups[:-2]:
        manifest = validate(path)
        if dt.datetime.fromisoformat(manifest['created_at']) < cutoff:
            shutil.rmtree(path)


def pull(args):
    if not args.approved_production_transfer:
        raise ValueError('Production transfer requires explicit approved-destination authorization')
    config = configurations(args.config)
    directory = private_directory(config['destination'])
    with (directory / '.pull.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        command = ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'oracle', 'sudo', '-n',
                   '/usr/local/libexec/beanmap-backup-source', 'export', '--recipient', config['recipient']]
        if config.get('include_recovery_config') is True:
            command.append('--include-recovery-config')
        if config.get('include_images') is True:
            command.append('--include-images')
        available = shutil.disk_usage(directory).free - 256 * 1024**2
        if available <= 0:
            raise ValueError('Insufficient backup destination space')
        with tempfile.TemporaryDirectory(prefix='.partial-', dir=directory) as temporary, tempfile.TemporaryFile() as errors:
            target = Path(temporary)
            process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=errors)
            try:
                unpack(process.stdout, target, min(available, config['max_archive_gib'] * 1024**3))
                process.stdout.close()
                if process.wait():
                    raise RuntimeError('Remote encrypted export failed')
                name = 'backup-' + now().strftime('%Y%m%dT%H%M%SZ-') + os.urandom(4).hex()
                target.rename(directory / name)
                prune(directory, config['retention_days'])
                print(json.dumps({'status': 'captured', 'backup': name, 'restore_verified': False}))
            finally:
                if process.poll() is None:
                    process.kill()
                process.wait()


def status(args):
    config = configurations(args.config)
    directory = Path(config['destination']).expanduser()
    backups = sorted(path for path in directory.glob('backup-*') if path.is_dir() and not path.is_symlink() and NAME.fullmatch(path.name))
    if not backups:
        print(json.dumps({'status': 'missing', 'within_rpo': False})); return 2
    latest = backups[-1]
    manifest = validate(latest)
    created = dt.datetime.fromisoformat(manifest['created_at'])
    age = (now() - created).total_seconds()
    healthy = -300 <= age <= config['rpo_hours'] * 3600
    print(json.dumps({'status': 'fresh' if healthy else 'stale', 'within_rpo': healthy,
                      'age_hours': round(age / 3600, 2), 'backup': latest.name,
                      'recovery_scope': manifest['recovery_scope'], 'restore_verified': False}))
    return 0 if healthy else 2


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='operation', required=True)
    remote = commands.add_parser('export')
    remote.add_argument('--recipient', required=True)
    remote.add_argument('--include-recovery-config', action='store_true')
    remote.add_argument('--include-images', action='store_true')
    for name in ('pull', 'status'):
        sub = commands.add_parser(name); sub.add_argument('--config', required=True)
        if name == 'pull': sub.add_argument('--approved-production-transfer', action='store_true')
    args = parser.parse_args()
    try:
        return {'export': export, 'pull': pull, 'status': status}[args.operation](args) or 0
    except Exception as error:
        # Do not echo producer stderr, SQL contents, env, keys, or configuration.
        print(json.dumps({'status': 'failed', 'reason': type(error).__name__}), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
