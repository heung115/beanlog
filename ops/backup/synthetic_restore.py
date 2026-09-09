#!/usr/bin/env python3
"""Fresh, network-isolated synthetic DB drill. Never accepts production data."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import uuid

spec = importlib.util.spec_from_file_location('backup', Path(__file__).with_name('backup.py'))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


def run(command, data=None):
    return subprocess.check_output(command, input=data, stderr=subprocess.DEVNULL)


def decrypt_pipe(age, identity, encrypted, command):
    # Authenticate every byte before allowing SQL to execute in the empty target.
    subprocess.run([age, '-d', '-i', str(identity), str(encrypted)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    cipher = subprocess.Popen([age, '-d', '-i', str(identity), str(encrypted)], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    receiver = subprocess.Popen(command, stdin=cipher.stdout, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    cipher.stdout.close()
    receiver_status, cipher_status = receiver.wait(), cipher.wait()
    if receiver_status or cipher_status:
        raise RuntimeError('Decryption or restore failed')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--age', required=True)
    parser.add_argument('--age-keygen', required=True)
    parser.add_argument('--image', default='postgres:17-alpine')
    parser.add_argument('--report', required=True, type=Path)
    args = parser.parse_args()
    os.umask(0o077)
    suffix = uuid.uuid4().hex[:12]
    source, target = 'beanmap-backup-fixture-' + suffix, 'beanmap-backup-restore-' + suffix
    started = time.monotonic()
    containers = []
    try:
        with tempfile.TemporaryDirectory(prefix='beanmap-synthetic-backup-') as temporary:
            root = Path(temporary); encrypted = root / 'encrypted'; encrypted.mkdir(mode=0o700)
            keys = root / 'independent-key'; keys.mkdir(mode=0o700); identity = keys / 'synthetic-only.agekey'
            run([args.age_keygen, '-o', str(identity)])
            recipient = run([args.age_keygen, '-y', str(identity)]).decode().strip()
            for name, admin in ((source, 'postgres'), (target, 'restore_admin')):
                run(['docker', 'run', '-d', '--name', name, '--network', 'none', '--memory', '256m', '--cpus', '0.5', '--pids-limit', '100',
                     '--tmpfs', '/var/lib/postgresql/data:rw,nosuid,nodev,size=192m', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-e', 'POSTGRES_USER=' + admin, args.image])
                containers.append(name)
                for attempt in range(60):
                    if subprocess.run(['docker', 'exec', name, 'pg_isready', '-U', admin], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
                        break
                    time.sleep(0.5)
                else:
                    raise RuntimeError('Fresh synthetic DB did not become ready')
            fixture = br'''create role fixture_reader nologin;
create database fixture;
\connect fixture
create schema fixture;
create table fixture.items(id integer primary key, owner_name text not null, note text not null);
insert into fixture.items select n,case when n%2=0 then 'alice' else 'bob' end,'synthetic-'||n from generate_series(1,20) n;
alter table fixture.items enable row level security;
create policy own_rows on fixture.items to fixture_reader using (owner_name='alice');
grant usage on schema fixture to fixture_reader;
grant select on fixture.items to fixture_reader;
'''
            run(['docker', 'exec', '-i', source, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], fixture)
            commands = {'database.dump.age': ['docker', 'exec', source, 'pg_dump', '-U', 'postgres', '-d', 'fixture', '-Fc'],
                        'roles.sql.age': ['docker', 'exec', source, 'pg_dumpall', '-U', 'postgres', '--globals-only']}
            backup.bundle(encrypted, commands, recipient, args.age)
            backup.validate(encrypted)
            try:
                backup.encrypt_command([sys.executable, '-c', "print('synthetic partial output'); raise SystemExit(7)"], root / 'failed-producer.age', recipient, args.age)
            except RuntimeError:
                pass
            else:
                raise RuntimeError('Failed backup producer was accepted')
            tampered = root / 'tampered.age'; data = bytearray((encrypted / 'database.dump.age').read_bytes()); data[-1] ^= 1; tampered.write_bytes(data)
            if subprocess.run([args.age, '-d', '-i', str(identity), str(tampered)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
                raise RuntimeError('Tampered ciphertext was accepted')
            wrong = keys / 'wrong-synthetic.agekey'; run([args.age_keygen, '-o', str(wrong)])
            if subprocess.run([args.age, '-d', '-i', str(wrong), str(encrypted / 'database.dump.age')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
                raise RuntimeError('Wrong identity was accepted')
            decrypt_pipe(args.age, identity, encrypted / 'roles.sql.age', ['docker', 'exec', '-i', target, 'psql', '-X', '-U', 'restore_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'])
            decrypt_pipe(args.age, identity, encrypted / 'database.dump.age', ['docker', 'exec', '-i', target, 'pg_restore', '-U', 'restore_admin', '-d', 'postgres', '--create', '--exit-on-error'])
            fingerprint = "select md5(string_agg(id||':'||owner_name||':'||note,',' order by id)) from fixture.items;"
            before = run(['docker', 'exec', source, 'psql', '-X', '-U', 'postgres', '-d', 'fixture', '-Atc', fingerprint])
            after = run(['docker', 'exec', target, 'psql', '-X', '-U', 'restore_admin', '-d', 'fixture', '-Atc', fingerprint])
            if before != after:
                raise RuntimeError('Restored synthetic rows differ')
            count = run(['docker', 'exec', target, 'psql', '-X', '-U', 'restore_admin', '-d', 'fixture', '-Atc', 'set role fixture_reader; select count(*) from fixture.items;']).decode().strip().splitlines()[-1]
            if count != '10':
                raise RuntimeError('Restored role/policy did not filter rows')
            report = {'synthetic_only': True, 'status': 'passed', 'checks': ['ciphertext manifest', 'producer-failure rejection', 'tamper rejection', 'wrong-key rejection', 'fresh DB role restore', 'fresh DB data/schema restore', 'all-row fingerprint', 'least-privilege RLS query'],
                      'seconds': round(time.monotonic() - started, 2), 'completed_at': backup.now().isoformat(),
                      'postgres_image_id': run(['docker', 'image', 'inspect', '--format', '{{.Id}}', args.image]).decode().strip(),
                      'postgres_version': run(['docker', 'exec', target, 'postgres', '--version']).decode().strip(),
                      'age_version': run([args.age, '--version']).decode().strip(),
                      'production_backup_created': False, 'production_restore_proven': False}
            args.report.write_text(json.dumps(report, indent=2) + '\n')
            print(json.dumps(report))
    finally:
        for name in containers:
            subprocess.run(['docker', 'rm', '-f', '-v', name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)


if __name__ == '__main__':
    main()
