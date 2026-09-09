#!/usr/bin/env python3
"""Restore an authorized encrypted baseline into disposable, offline Docker volumes.

Only the database is started. Plaintext is kept in process memory or disposable
Docker volumes; subprocess diagnostics and source inventory are never printed.
"""
from __future__ import annotations
import argparse
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tarfile
import time
import uuid
import backup

LABEL = 'dev.beanmap.restore-drill'
LIMIT = 256 * 1024 * 1024
COPY = re.compile(rb'^COPY ((?:"(?:[^"]|"")+"|[a-z_][a-z_0-9]*)\.(?:"(?:[^"]|"")+"|[a-z_][a-z_0-9]*)) \(.*\) FROM stdin;\n$')


def run(command, data=None, limit=LIMIT):
    result = subprocess.run(command, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode or len(result.stdout) > limit:
        raise RuntimeError('Private restore subprocess failed')
    return result.stdout


def decrypt(age, identity, path, limit=LIMIT):
    # subprocess completion verifies the authenticated EOF before bytes are used.
    return run([age, '--decrypt', '--identity', str(identity), str(path)], limit=limit)


def validate_identity(path):
    if path.is_symlink() or not path.is_file():
        raise ValueError('Identity must be a regular private file')
    stat = path.stat()
    if stat.st_uid != os.geteuid() or stat.st_mode & 0o077:
        raise ValueError('Identity must be owned by this user with mode 0600')


def validate_local_engine():
    if os.environ.get('DOCKER_HOST') or os.environ.get('DOCKER_CONTEXT'):
        raise ValueError('Explicit Docker endpoint overrides are not permitted')
    context = json.loads(run(['docker', 'context', 'inspect']))
    if len(context) != 1 or not context[0]['Endpoints']['docker']['Host'].startswith('unix://'):
        raise ValueError('Restore requires a local Unix-socket Docker engine')


def database_image(inventory):
    matches = [item for item in inventory if item.get('Name') == '/supabase-db']
    if len(matches) != 1 or not re.fullmatch(r'sha256:[0-9a-f]{64}', matches[0].get('Image', '')):
        raise ValueError('Backup must identify exactly one immutable database image')
    return matches[0]['Image']


def check_config_archive(data):
    seen, total = set(), 0
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:') as archive:
        for member in archive:
            path = PurePosixPath(member.name)
            if path.is_absolute() or '..' in path.parts or str(path) in seen or not (member.isdir() or member.isfile()):
                raise ValueError('Unsafe configuration archive member')
            seen.add(str(path)); total += member.size
            if total > 16 * 1024 * 1024:
                raise ValueError('Configuration archive is too large')
    if 'pgsodium_root.key' not in seen:
        raise ValueError('Required database key configuration is missing')


def restore_roles(data):
    lines = data.splitlines(keepends=True)
    bootstrap = [line for line in lines if line.rstrip(b'\r\n') == b'CREATE ROLE supabase_admin;']
    if len(bootstrap) != 1:
        raise ValueError('Unsupported globals bootstrap role')
    # initdb already owns this role; keep its ALTER statements and all grantors.
    return b''.join(line for line in lines if line.rstrip(b'\r\n') != b'CREATE ROLE supabase_admin;')


def sequence_states(data):
    return sorted(line for line in data.splitlines() if line.startswith(b'SELECT pg_catalog.setval('))


def copy_fingerprints(data):
    result, current, count, digest = {}, None, 0, None
    for line in io.BytesIO(data):
        if current is not None:
            if line == b'\\.\n':
                result[current] = (count, digest.digest())
                current = None
            else:
                count += 1; digest.update(line)
        elif match := COPY.match(line):
            current = match.group(1)
            if current in result:
                raise ValueError('Repeated COPY table in archive')
            count, digest = 0, hashlib.sha256()
    if current is not None or not result:
        raise ValueError('Incomplete or empty COPY data archive')
    return result


def load_images(age, identity, path):
    # Authenticate the entire encrypted archive before importing any image.
    with open(os.devnull, 'wb') as sink:
        result = subprocess.run([age, '-d', '-i', str(identity), str(path)], stdout=sink, stderr=subprocess.PIPE)
        if result.returncode:
            raise RuntimeError('Image archive authentication failed')
    commands = [[age, '-d', '-i', str(identity), str(path)]]
    if path.name == 'images.tar.gz.age':
        commands.append(['gzip', '-d'])
    commands.append(['docker', 'image', 'load', '--quiet'])
    processes = []
    # No archive plaintext or command diagnostics are written to a host file.
    with open(os.devnull, 'wb') as sink:
        try:
            for index, command in enumerate(commands):
                previous = processes[-1].stdout if processes else None
                process = subprocess.Popen(command, stdin=previous, stdout=sink if index == len(commands)-1 else subprocess.PIPE, stderr=sink)
                if previous is not None: previous.close()
                processes.append(process)
            codes = [process.wait() for process in reversed(processes)]
            if any(codes): raise RuntimeError('Image archive import failed')
        finally:
            for process in processes:
                if process.poll() is None: process.kill()
            for process in processes: process.wait()


class OfflineDatabase:
    def __init__(self, image):
        self.token = uuid.uuid4().hex
        self.name = 'beanmap-restore-' + self.token
        self.image = image
        self.volumes = []
        self.started = False

    def command(self, *args):
        return ['docker', 'exec', '-i', self.name, *args]

    def psql(self, sql):
        return run(self.command('psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'supabase_admin', '-d', 'postgres'), sql)

    def create(self, config):
        for suffix in ('data', 'config'):
            name = self.name + '-' + suffix
            run(['docker', 'volume', 'create', '--label', LABEL + '=' + self.token, name])
            self.volumes.append(name)
        mounts = ['--mount', 'type=volume,src=' + self.volumes[0] + ',dst=/drill-data', '--mount', 'type=volume,src=' + self.volumes[1] + ',dst=/etc/postgresql-custom']
        run(['docker', 'run', '--rm', '-i', '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--cap-add', 'CHOWN', '--cap-add', 'DAC_OVERRIDE', *mounts, '--entrypoint', 'sh', self.image, '-ec',
             'tar -xf - -C /etc/postgresql-custom; chown -R 100:101 /drill-data /etc/postgresql-custom; chmod 700 /drill-data'], config)
        mounts[-1] += ',readonly'
        init = ('initdb -U supabase_admin -D /drill-data --auth-local=trust --auth-host=reject >/tmp/init.log 2>&1; '
                'exec postgres -D /drill-data -c config_file=/etc/postgresql/postgresql.conf '
                '-c hba_file=/drill-data/pg_hba.conf -c data_directory=/drill-data '
                '-c listen_addresses= -c unix_socket_directories=/tmp -c ssl=off '
                '-c max_worker_processes=0 -c archive_mode=off -c logging_collector=off '
                '-c log_statement=none -c log_min_messages=panic -c log_min_error_statement=panic')
        self.started = True
        run(['docker', 'run', '-d', '--name', self.name, '--label', LABEL + '=' + self.token,
             '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
             '--user', '100:101', '--memory', '2g', '--cpus', '2', '--pids-limit', '256',
             '--tmpfs', '/tmp:rw,nosuid,nodev,size=128m', '-e', 'PGHOST=/tmp', *mounts,
             '--entrypoint', 'sh', self.image, '-ec', init])
        for _ in range(90):
            try:
                if self.psql(b'SELECT 1;').strip() == b'1': return
            except RuntimeError:
                pass
            time.sleep(1)
        raise RuntimeError('Isolated database did not become ready')

    def close(self):
        if self.started and run(['docker', 'container', 'ls', '-aq', '--filter', 'name=^/' + self.name + '$']).strip():
            labels = json.loads(run(['docker', 'inspect', '--format', '{{json .Config.Labels}}', self.name]))
            if labels.get(LABEL) != self.token: raise RuntimeError('Refusing cleanup of an unowned container')
            run(['docker', 'rm', '-f', '-v', self.name])
        for volume in reversed(self.volumes):
            labels = json.loads(run(['docker', 'volume', 'inspect', '--format', '{{json .Labels}}', volume]))
            if labels.get(LABEL) != self.token: raise RuntimeError('Refusing cleanup of an unowned volume')
            run(['docker', 'volume', 'rm', volume])


def progress(phase):
    print(json.dumps({'restore_phase': phase}), flush=True)


def drill(args):
    if not args.approved_production_restore:
        raise ValueError('Explicit authorization is required before reading the production bundle')
    identity = Path(args.identity).expanduser(); validate_identity(identity)
    directory = Path(args.bundle).expanduser().resolve()
    manifest = backup.validate(directory)
    required = {'database.dump.age', 'roles.sql.age', 'postgres-config.tar.age', 'runtime-inventory.json.age'}
    if not required <= manifest['files'].keys(): raise ValueError('Baseline lacks database recovery components')
    image_files = set(manifest['files']) & {'images.tar.age', 'images.tar.gz.age'}
    if len(image_files) != 1: raise ValueError('Baseline needs exactly one archived image bundle')
    validate_local_engine()
    acl_script = Path(args.acl_check_script).read_bytes()
    if not acl_script or len(acl_script) > 1024*1024: raise ValueError('Invalid deployed ACL checker')
    started = time.monotonic()
    progress('authenticating encrypted baseline')
    # Authenticate even configuration components that this DB-only drill never executes.
    with open(os.devnull, 'wb') as sink:
        for filename in manifest['files']:
            checked = subprocess.run([args.age, '-d', '-i', str(identity), str(directory / filename)], stdout=sink, stderr=subprocess.PIPE)
            if checked.returncode: raise RuntimeError('Encrypted component authentication failed')
    inventory = json.loads(decrypt(args.age, identity, directory / 'runtime-inventory.json.age', 2*1024*1024))
    image = database_image(inventory)
    config = decrypt(args.age, identity, directory / 'postgres-config.tar.age', 16*1024*1024)
    check_config_archive(config)
    roles = restore_roles(decrypt(args.age, identity, directory / 'roles.sql.age', 2*1024*1024))
    dump = decrypt(args.age, identity, directory / 'database.dump.age')
    progress('loading archived immutable images')
    load_images(args.age, identity, directory / image_files.pop())
    if json.loads(run(['docker', 'image', 'inspect', image]))[0]['Id'] != image:
        raise RuntimeError('Archived database image identity mismatch')
    database = OfflineDatabase(image)
    restore_started = time.monotonic()
    try:
        progress('initializing isolated database')
        database.create(config)
        progress('restoring roles and database')
        database.psql(roles)
        expected_sql = run(database.command('pg_restore', '--data-only', '--file=-'), dump)
        expected = copy_fingerprints(expected_sql)
        run(database.command('pg_restore', '--exit-on-error', '-U', 'supabase_admin', '-d', 'postgres'), dump)
        restored_at = time.monotonic()
        progress('verifying data, privileges and Vault')
        actual_sql = run(database.command('pg_dump', '-U', 'supabase_admin', '-d', 'postgres', '--data-only'))
        actual = copy_fingerprints(actual_sql)
        if sequence_states(expected_sql) != sequence_states(actual_sql): raise RuntimeError('Restored sequence state differs from archive')
        if expected != actual: raise RuntimeError('Restored table data differs from the archived snapshot')
        # Role attributes and current production RLS boundary must survive restore.
        checks = database.psql(b"""SELECT json_build_object(
          'postgres_not_superuser', NOT (SELECT rolsuper FROM pg_roles WHERE rolname='postgres'),
          'admin_superuser', (SELECT rolsuper FROM pg_roles WHERE rolname='supabase_admin'),
          'auth_rls', (SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN ('auth.users'::regclass,'auth.sessions'::regclass)),
          'public_tables_rls', (SELECT bool_and(relrowsecurity) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'));
        """)
        checks = json.loads(checks)
        if not all(value is True for value in checks.values()): raise RuntimeError('Restored database security checks failed')
        database.psql(acl_script)
        checks['deployed_function_acl_checker'] = True
        version = database.psql(b'SHOW server_version;').decode().strip()
        # Exercise Vault inside a rollback without reading any restored secret.
        vault = database.psql(br"""BEGIN; SELECT vault.create_secret('restore-drill-synthetic-value', 'restore-drill-' || gen_random_uuid()::text) AS id \gset
        SELECT decrypted_secret = 'restore-drill-synthetic-value' FROM vault.decrypted_secrets WHERE id = :'id'; ROLLBACK;
        """)
        if vault.strip() != b't': raise RuntimeError('Restored Vault configuration check failed')
        return {'status': 'passed', 'scope': 'production-database-only', 'baseline_created_at': manifest['created_at'],
                'database_version': version, 'archived_image_match': True, 'ciphertext_integrity': True,
                'table_data_fingerprints_match': True, 'sequence_states_match': True, 'tables_verified': len(expected), 'security_checks': checks,
                'vault_roundtrip': True, 'database_restore_seconds': round(restored_at-restore_started, 3),
                'total_seconds': round(time.monotonic()-started, 3), 'network': 'none',
                'limitations': ['Full-service recovery time is not proven.', 'Point-in-time recovery is not proven.',
                                'External Auth, SMTP, webhooks and application services were not started.',
                                'Data compared with the archived database snapshot; later production writes are outside this baseline.',
                                'Background workers were disabled during this isolated drill.']}
    finally:
        progress('removing owned restore containers and volumes')
        database.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--approved-production-restore', action='store_true')
    parser.add_argument('--bundle', required=True); parser.add_argument('--identity', required=True)
    parser.add_argument('--acl-check-script', required=True, help='Exact deployed revision read-only ACL checker')
    parser.add_argument('--age', default='age'); parser.add_argument('--report', required=True)
    args = parser.parse_args()
    try:
        report = drill(args)
        path = Path(args.report)
        with path.open('x', opener=lambda name, flags: os.open(name, flags, 0o600)) as target:
            json.dump(report, target, indent=2); target.write('\n')
        print(json.dumps(report))
        return 0
    except Exception as error:
        print('Production restore drill failed (' + type(error).__name__ + '); private diagnostics suppressed.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
