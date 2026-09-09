#!/usr/bin/env python3
"""Build and exercise only disposable PostgREST candidate containers on Oracle."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import time
import uuid

HERE = Path(__file__).resolve().parent
BASE = 'beanlog-postgrest:v14.12-p2'
BASE_ID = 'sha256:9cdfdf899e1c1be1a78a5ca5912568ea143344e3d503f4ca0b3aec39e8bc776e'
CANDIDATE = 'beanlog-postgrest:v14.12-runtime-20260909'
DB_IMAGE = 'beanlog-postgres:17.11-supabase136-p1'
PREFIX = 'beanmap-postgrest-runtime-fixture-20260909'

def run(args, **kwargs):
    return subprocess.check_output(args, stderr=subprocess.STDOUT, text=True, **kwargs)

def inspect(name):
    return json.loads(run(['docker', 'inspect', name]))[0]

def in_image(image, args):
    return run(['docker', 'run', '--rm', '--network', 'none', '--entrypoint', args[0], image, *args[1:]])

def packages(image):
    return dict(line.split(' ', 1) for line in in_image(image, ['dpkg-query', '-W', '-f=${Package} ${Version}\n']).splitlines())

def linked_files(image):
    output = in_image(image, ['ldd', '/usr/bin/postgrest'])
    if 'not found' in output:
        raise RuntimeError('PostgREST runtime library missing')
    paths = sorted(set(re.findall(r'(/[^\s]+)', output)) | {'/usr/bin/postgrest'})
    return {line.split(None, 1)[1].strip(): line.split()[0] for line in in_image(image, ['sha256sum', *paths]).splitlines()}

def main():
    assert inspect(BASE)['Id'] == BASE_ID, 'Base image tag changed'
    original_config = inspect(BASE)['Config']
    before = packages(BASE)
    runtime_before = linked_files(BASE)
    build = run(['docker', 'build', '--network', 'none', '--pull=false', '-t', CANDIDATE, str(HERE)])
    (HERE / 'build.log').write_text(build)
    after = packages(CANDIDATE)
    assert all(after[name] == before[name] for name in after), 'A retained package changed'
    assert linked_files(CANDIDATE) == runtime_before, 'Executable or linked runtime bytes changed'
    assert not any(name.endswith('-dev') or name in ['gcc', 'cpp', 'binutils', 'linux-libc-dev'] for name in after)
    assert inspect(CANDIDATE)['Config']['User'] == original_config['User'] == '1000:1000'
    assert inspect(CANDIDATE)['Config']['Cmd'] == original_config['Cmd'] == ['postgrest']
    assert inspect(CANDIDATE)['Config']['Env'] == original_config['Env']
    version = in_image(CANDIDATE, ['postgrest', '--version']).strip()
    assert version == 'PostgREST 14.12'
    report = {'base_image': BASE_ID, 'candidate_image': inspect(CANDIDATE)['Id'], 'version': version,
              'dockerfile_sha256': hashlib.sha256((HERE / 'Dockerfile').read_bytes()).hexdigest(),
              'packages_before': len(before), 'packages_after': len(after),
              'removed_packages': sorted(set(before) - set(after)),
              'executable_and_linked_libraries_unchanged': True,
              'preserved_linked_file_count': len(runtime_before), 'user_and_command_preserved': True}
    (HERE / 'packages-before.json').write_text(json.dumps(before, indent=2) + '\n')
    (HERE / 'packages-after.json').write_text(json.dumps(after, indent=2) + '\n')
    (HERE / 'runtime-files.json').write_text(json.dumps(runtime_before, indent=2) + '\n')
    owner = uuid.uuid4().hex
    prefix = PREFIX + '-' + owner[:12]
    db, rest, net, client = prefix + '-db', prefix + '-rest', prefix + '-net', prefix + '-client'
    label = 'org.beanmap.fixture-owner=' + owner
    created_containers = {}
    network_id = None
    def create_container(name, args):
        container_id = run(['docker', 'run', '-d', '--name', name, '--label', label, *args]).strip()
        created_containers[name] = container_id
    def owned_container(name):
        if name not in created_containers:
            return False
        try:
            item = inspect(created_containers[name])
            return item['Id'] == created_containers[name] and item['Config']['Labels'].get('org.beanmap.fixture-owner') == owner
        except subprocess.CalledProcessError:
            return False
    certs = HERE / ('fixture-tls-' + owner)
    certs.mkdir()
    certs.chmod(0o755)
    run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=fixture-db',
         '-keyout', str(certs / 'server.key'), '-out', str(certs / 'server.crt')])
    run(['chown', '100:101', str(certs / 'server.key'), str(certs / 'server.crt')])
    (certs / 'server.key').chmod(0o600)
    try:
        network_id = run(['docker', 'network', 'create', '--internal', '--label', label, net]).strip()
        create_container(db, ['--network', net, '--network-alias', 'fixture-db',
             '--user', '100:101', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
             '--memory', '384m', '--cpus', '1', '--tmpfs', '/tmp:rw,uid=100,gid=101,size=128m',
             '-v', str(certs) + ':/fixture-tls:ro', '--entrypoint', 'sh', DB_IMAGE, '-ec',
             'initdb -D /tmp/fixture-db --auth=trust --no-locale >/tmp/init.log; '
             "printf '%s\\n' 'hostssl postgres fixture_auth samenet trust' >> /tmp/fixture-db/pg_hba.conf; "
             'exec postgres -D /tmp/fixture-db -c listen_addresses=* -c unix_socket_directories=/tmp '
             '-c shared_preload_libraries= -c ssl=on -c ssl_cert_file=/fixture-tls/server.crt '
             '-c ssl_key_file=/fixture-tls/server.key'])
        for attempt in range(100):
            try:
                run(['docker', 'exec', db, 'psql', '-h', '/tmp', '-U', 'postgres', '-Atqc', 'select 1'])
                break
            except subprocess.CalledProcessError:
                time.sleep(0.3)
        else:
            raise RuntimeError('Disposable database failed to start')
        sql = '''create role fixture_auth login noinherit;
create role fixture_anon nologin;
grant fixture_anon to fixture_auth;
create schema api;
create table api.items(id integer primary key, value text not null);
insert into api.items values(1,'synthetic fixture');
grant usage on schema api to fixture_anon;
grant select,insert,update,delete on api.items to fixture_anon;
create function api.tls_active() returns boolean language sql stable security definer set search_path='' as
$$select ssl from pg_catalog.pg_stat_ssl where pid=pg_catalog.pg_backend_pid()$$;
grant execute on function api.tls_active() to fixture_anon;'''
        run(['docker', 'exec', '-i', db, 'psql', '-h', '/tmp', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], input=sql)
        create_container(rest, ['--network', net, '--network-alias', 'fixture-rest', '--read-only', '--cap-drop', 'ALL',
             '--security-opt', 'no-new-privileges', '--memory', '192m', '--cpus', '1',
             '--tmpfs', '/tmp:rw,noexec,nosuid,size=16m',
             '-e', 'PGRST_DB_URI=postgres://fixture_auth@fixture-db:5432/postgres?sslmode=require',
             '-e', 'PGRST_DB_SCHEMAS=api', '-e', 'PGRST_DB_ANON_ROLE=fixture_anon', CANDIDATE])
        create_container(client, ['--network', net, '--read-only', '--cap-drop', 'ALL',
             '--security-opt', 'no-new-privileges', '--memory', '96m', '--cpus', '0.5',
             '--entrypoint', 'node', 'node:22.23.2-alpine3.24', '-e', 'setInterval(()=>{},1000)'])
        def request(path, method='GET', body=None):
            options = {'method':method,'headers':{'Content-Type':'application/json','Prefer':'return=representation'}}
            if body is not None:
                options['body'] = json.dumps(body)
            code = 'const r=await fetch(' + json.dumps('http://fixture-rest:3000'+path) + ',' + json.dumps(options) + ');const b=await r.text();console.log(JSON.stringify([r.status,b?JSON.parse(b):null]));'
            return tuple(json.loads(run(['docker', 'exec', client, 'node', '--input-type=module', '-e', code])))
        for attempt in range(100):
            try:
                status, rows = request('/items')
                assert status == 200 and rows == [{'id': 1, 'value': 'synthetic fixture'}]
                break
            except (OSError, AssertionError, subprocess.CalledProcessError):
                time.sleep(0.3)
        else:
            raise RuntimeError('Disposable PostgREST failed to serve schema')
        assert request('/rpc/tls_active') == (200, True)
        assert request('/items', 'POST', {'id': 2, 'value': 'insert fixture'})[0] == 201
        assert request('/items?id=eq.2', 'PATCH', {'value': 'updated fixture'}) == (200, [{'id': 2, 'value': 'updated fixture'}])
        assert request('/items?id=eq.2', 'DELETE')[0] == 200
        assert request('/items?id=eq.2') == (200, [])
        assert inspect(rest)['State']['Running']
        report['isolated_database'] = {'postgres_version': '17.11', 'tls_required_and_confirmed': True,
                 'anonymous_role_schema_read': True, 'insert_update_delete': True,
                 'read_only_rootfs': True, 'capabilities_dropped': True, 'nonroot_uid': 1000,
                 'host_ports_published': False, 'production_network_or_data_used': False}
    finally:
        for name in [rest, db]:
            if not owned_container(name):
                continue
            logs = subprocess.run(['docker', 'logs', name], capture_output=True, text=True)
            (HERE / (name + '.log')).write_text(logs.stdout + logs.stderr)
        for name in [client, rest, db]:
            if owned_container(name):
                subprocess.run(['docker', 'rm', '-f', created_containers[name]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if network_id:
            network = inspect(network_id)
            if network['Id'] == network_id and network['Labels'].get('org.beanmap.fixture-owner') == owner:
                subprocess.run(['docker', 'network', 'rm', network_id], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for file in certs.iterdir():
            file.unlink()
        certs.rmdir()
    (HERE / 'verification.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))

if __name__ == '__main__':
    main()
