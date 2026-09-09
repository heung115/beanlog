#!/usr/bin/env python3
"""GCS transport for already encrypted bundles; never creates cloud resources."""
import argparse
import base64
import datetime as dt
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import ssl
import subprocess
import sys
import urllib.parse
import urllib.request

spec = importlib.util.spec_from_file_location('backup', Path(__file__).with_name('backup.py'))
backup = importlib.util.module_from_spec(spec); spec.loader.exec_module(backup)
identity_spec = importlib.util.spec_from_file_location('gcs_identity', Path(__file__).with_name('gcs_identity.py'))
identity_module = importlib.util.module_from_spec(identity_spec); identity_spec.loader.exec_module(identity_module)
FREE_REGIONS = {'US-WEST1', 'US-CENTRAL1', 'US-EAST1'}
HARD_BYTES = 4_000_000_000  # Conservative bound below advertised 5 GB-months.


def eligible(bucket):
    iam = bucket.get('iamConfiguration', {})
    if bucket.get('location', '').upper() not in FREE_REGIONS or bucket.get('storageClass') != 'STANDARD':
        raise ValueError('Bucket must be regional Standard in a free-tier US region')
    if not iam.get('uniformBucketLevelAccess', {}).get('enabled') or iam.get('publicAccessPrevention') != 'enforced':
        raise ValueError('Uniform access and enforced public access prevention are required')
    if bucket.get('versioning', {}).get('enabled') or bucket.get('autoclass', {}).get('enabled'):
        raise ValueError('Versioning or automatic storage-class changes are not supported')
    if bucket.get('retentionPolicy') or bucket.get('defaultEventBasedHold'):
        raise ValueError('Retention policies/holds are not supported; never lock retention')
    if int(bucket.get('softDeletePolicy', {}).get('retentionDurationSeconds', 0)) != 0:
        raise ValueError('Soft delete must be disabled to bound retained storage')


def capacity(existing, incoming, maximum=HARD_BYTES):
    if type(maximum) is not int or not 0 < maximum <= HARD_BYTES:
        raise ValueError('Invalid conservative capacity limit')
    if existing < 0 or incoming <= 0 or existing + incoming > maximum:
        raise ValueError('Upload exceeds conservative free-tier capacity')


DENIED_PERMISSIONS = {'storage.objects.update', 'storage.objects.delete', 'storage.objects.setIamPolicy',
                      'storage.buckets.setIamPolicy', 'storage.buckets.update', 'storage.buckets.delete'}
READ_PERMISSIONS = {'storage.buckets.get', 'storage.buckets.getIamPolicy', 'storage.objects.list'}


class SameHostRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        parsed = urllib.parse.urlsplit(newurl)
        if parsed.scheme != 'https' or parsed.hostname != 'storage.googleapis.com' or parsed.port not in (None, 443) or parsed.username or parsed.password:
            raise ValueError('Refusing cross-host credential redirect')
        return super().redirect_request(request, fp, code, msg, headers, newurl)


class Cloud(identity_module.DedicatedIdentity):
    def __init__(self, settings, role='writer'):
        super().__init__(settings, role)
        self.requests = 0

    def get(self, path, **query):
        if self.role == 'writer':
            target = 'b/' + urllib.parse.quote(self.settings['bucket'], safe='')
            if path != target and not path.startswith(target + '/'):
                raise ValueError('Writer API request is outside the approved bucket')
            if path.startswith(target + '/o/') and not urllib.parse.unquote(path[len(target + '/o/'):]).startswith('beanmap/'):
                raise ValueError('Writer object read is outside the approved backup prefix')
        if self.role == 'auditor' and query.get('alt') == 'media':
            raise ValueError('The capacity auditor cannot download object contents')
        self.requests += 1
        if self.requests > 60:
            raise ValueError('Read request budget exceeded; refuse incomplete inventory')
        url = 'https://storage.googleapis.com/storage/v1/' + path
        if query: url += '?' + urllib.parse.urlencode(query, doseq=True)
        request = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + self.token})
        cafile = '/etc/ssl/cert.pem' if Path('/etc/ssl/cert.pem').is_file() else None
        context = ssl.create_default_context(cafile=cafile)
        opener = urllib.request.build_opener(SameHostRedirect(), urllib.request.HTTPSHandler(context=context))
        with opener.open(request, timeout=30) as response:
            return json.load(response)

    def pages(self, path, **query):
        found = []
        while True:
            page = self.get(path, **query); found.extend(page.get('items', []))
            if not page.get('nextPageToken'): return found
            query['pageToken'] = page['nextPageToken']

    def billing_inventory(self, project, name):
        if self.role != 'auditor': raise ValueError('Only the dedicated capacity auditor can inspect billing scope')
        billing = self.cli(['billing', 'projects', 'describe', project])
        if not billing.get('billingEnabled') or not billing.get('billingAccountName'):
            raise ValueError('Cannot verify active free-tier billing scope')
        projects = self.cli(['billing', 'projects', 'list', '--billing-account', billing['billingAccountName'].split('/')[-1]])
        if not projects or project not in [p['projectId'] for p in projects]:
            raise ValueError('Incomplete billing-project inventory')
        total, target, objects = 0, None, []
        for item in projects:
            for bucket in self.pages('b', project=item['projectId']):
                # Other storage classes/regions can already incur costs: do not
                # silently call the whole billing account free in that case.
                eligible(bucket)
                if bucket['name'] != name:
                    raise ValueError('Unreviewed additional bucket in shared billing pool')
                quoted = urllib.parse.quote(bucket['name'], safe='')
                versions = self.pages('b/' + quoted + '/o', versions='true')
                # This destination was created with soft delete disabled. Its
                # reviewed metageneration is pinned before any upload; old
                # soft-deleted objects are not silently assumed inventoried.
                for obj in versions:
                    if obj.get('storageClass') != 'STANDARD':
                        raise ValueError('Non-Standard object detected')
                    total += int(obj['size'])
                if bucket['name'] == name:
                    if item['projectId'] != project:
                        raise ValueError('Bucket belongs to a different project')
                    target, objects = bucket, versions
        if target is None: raise ValueError('Approved target bucket does not exist')
        policy = self.cli(['storage', 'buckets', 'get-iam-policy', 'gs://' + name])
        if any(member in ('allUsers', 'allAuthenticatedUsers') for binding in policy.get('bindings', []) for member in binding.get('members', [])):
            raise ValueError('Public IAM binding found')
        return total, target, objects

    def check_permissions(self, name):
        denied = DENIED_PERMISSIONS | ({'storage.objects.get', 'storage.objects.create'} if self.role == 'auditor' else set())
        checked = READ_PERMISSIONS | denied
        result = self.get('b/' + urllib.parse.quote(name, safe='') + '/iam/testPermissions', permissions=sorted(checked))
        granted = set(result.get('permissions', []))
        if granted & denied or not READ_PERMISSIONS <= granted or granted - checked:
            raise ValueError('Backup identity has missing read permissions or forbidden mutation permissions')

    def inventory(self, project, name):
        if self.role != 'writer': raise ValueError('Uploader inventory requires the dedicated writer identity')
        if project != self.settings['project'] or name != self.settings['bucket']:
            raise ValueError('Inventory target differs from reviewed settings')
        auditor = Cloud(self.settings, role='auditor')
        auditor.check_permissions(name)
        total, reviewed, objects = auditor.billing_inventory(project, name)
        self.check_permissions(name)
        quoted = urllib.parse.quote(name, safe='')
        current = self.get('b/' + quoted)
        eligible(current)
        if current.get('name') != name or current.get('projectNumber') != reviewed.get('projectNumber') or str(current.get('metageneration')) != str(reviewed.get('metageneration')):
            raise ValueError('Target bucket changed during independent capacity review')
        policy = self.cli(['storage', 'buckets', 'get-iam-policy', 'gs://' + name])
        if any(member in ('allUsers', 'allAuthenticatedUsers') for binding in policy.get('bindings', []) for member in binding.get('members', [])):
            raise ValueError('Public IAM binding found')
        return total, current, objects


def config(path):
    value = json.loads(Path(path).read_text())
    if not re.fullmatch(r'[a-z][a-z0-9-]{4,61}[a-z0-9]', value.get('project', '')) or not re.fullmatch(r'[a-z0-9][a-z0-9-]{1,61}[a-z0-9]', value.get('bucket', '')):
        raise ValueError('Invalid project or bucket')
    if value.get('prefix') != 'beanmap' or value.get('retention_days') != 30:
        raise ValueError('Only reviewed beanmap prefix and 30-day policy are supported')
    if not re.fullmatch(r'[1-9][0-9]*', str(value.get('bucket_metageneration', ''))):
        raise ValueError('Pin the bucket metageneration after reviewed private creation')
    capacity(0, 1, value.get('maximum_pool_bytes', HARD_BYTES))
    return value


def verify_lifecycle(bucket, expected_metageneration=None):
    if expected_metageneration is not None and str(bucket.get('metageneration')) != str(expected_metageneration):
        raise ValueError('Bucket settings changed after reviewed creation; re-review required')
    rules = bucket.get('lifecycle', {}).get('rule', [])
    expected = {'action': {'type': 'Delete'}, 'condition': {'age': 30, 'matchesPrefix': ['beanmap/daily/']}}
    if rules != [expected]:
        raise ValueError('Bucket must have only the reviewed daily-prefix lifecycle rule')


def upload(settings, directory, mode, *, approved=False, cloud=None):
    if not approved: raise ValueError('Run upload only for the user-approved GCP backup target')
    if not backup.NAME.fullmatch(directory.name): raise ValueError('Invalid completed backup directory')
    manifest = backup.validate(directory)
    if mode == 'daily' and any(name in manifest['files'] for name in ('images.tar.age', 'images.tar.gz.age', 'images.delta.tar.gz.age', 'image-base.json.age')):
        raise ValueError('Daily image copies would exhaust free storage')
    if mode not in ('daily', 'baseline'): raise ValueError('Invalid backup kind')
    cloud = cloud or Cloud(settings)
    total, bucket, objects = cloud.inventory(settings['project'], settings['bucket'])
    verify_lifecycle(bucket, settings['bucket_metageneration'])
    incoming = sum(path.stat().st_size for path in directory.iterdir())
    if mode == 'daily' and incoming > 50_000_000:
        raise ValueError('Daily bundle exceeds reviewed 50 MB bound')
    if mode == 'baseline' and incoming > 1_600_000_000:
        raise ValueError('Image baseline exceeds reviewed 1.6 GB bound')
    prefix = 'beanmap/' + mode + '/' + directory.name + '/'
    existing = {obj['name']: obj for obj in objects if obj['name'].startswith(prefix)}
    allowed_names = {prefix + path.name for path in directory.iterdir()}
    if set(existing) - allowed_names:
        raise ValueError('Unexpected object in this backup prefix')
    remaining = sum(path.stat().st_size for path in directory.iterdir() if prefix + path.name not in existing)
    capacity(total, max(remaining, 1), settings.get('maximum_pool_bytes', HARD_BYTES))
    if prefix + 'manifest.json' in existing and remaining:
        raise ValueError('Existing completion manifest has missing objects')
    # Success manifest goes last, only after all ciphertext objects are verified.
    ordered = sorted(path for path in directory.iterdir() if path.name != 'manifest.json') + [directory / 'manifest.json']
    for path in ordered:
        md5 = hashlib.md5(usedforsecurity=False)
        with path.open('rb') as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b''): md5.update(block)
        encoded = base64.b64encode(md5.digest()).decode()
        remote = 'gs://' + settings['bucket'] + '/' + prefix + path.name
        prior = existing.get(prefix + path.name)
        if prior is not None:
            if int(prior['size']) != path.stat().st_size or prior.get('md5Hash') != encoded or prior.get('metadata', {}).get('sha256') != backup.digest(path):
                raise ValueError('Existing object differs; never overwrite it')
            continue
        cloud.copy(path, remote, md5=encoded, sha256=backup.digest(path))
        obj = cloud.get('b/' + urllib.parse.quote(settings['bucket'], safe='') + '/o/' + urllib.parse.quote(prefix + path.name, safe=''))
        if int(obj['size']) != path.stat().st_size or obj.get('md5Hash') != encoded or obj.get('metadata', {}).get('sha256') != backup.digest(path):
            raise ValueError('Uploaded encrypted object failed integrity verification')
    return {'status': 'uploaded', 'mode': mode, 'bytes': incoming, 'pool_bytes': total + remaining, 'restore_verified': False}


def remote_status(settings, cloud=None):
    cloud = cloud or Cloud(settings)
    total, bucket, objects = cloud.inventory(settings['project'], settings['bucket'])
    verify_lifecycle(bucket, settings['bucket_metageneration'])
    if total > settings.get('maximum_pool_bytes', HARD_BYTES):
        raise ValueError('Stored backup pool exceeds conservative limit')
    manifests = [obj for obj in objects if re.fullmatch(r'beanmap/(daily|baseline)/backup-\d{8}T\d{6}Z-[0-9a-f]{8}/manifest\.json', obj['name'])]
    if not manifests: return {'status': 'missing', 'within_rpo': False, 'pool_bytes': total}
    latest = max(manifests, key=lambda obj: obj['name'].split('/')[2])
    document = cloud.get('b/' + urllib.parse.quote(settings['bucket'], safe='') + '/o/' + urllib.parse.quote(latest['name'], safe=''), alt='media', generation=latest['generation'])
    if document.get('format') != backup.FORMAT or not {'database.dump.age', 'roles.sql.age'} <= document.get('files', {}).keys():
        raise ValueError('Remote completion manifest is incomplete')
    prefix = latest['name'].rsplit('/', 1)[0] + '/'
    available = {obj['name']: obj for obj in objects}
    for name, expected in document['files'].items():
        if name not in backup.COMPONENTS: raise ValueError('Unexpected remote component')
        obj = available.get(prefix + name)
        if obj is None or int(obj['size']) != expected['bytes'] or obj.get('metadata', {}).get('sha256') != expected['sha256']:
            raise ValueError('Remote encrypted backup is incomplete or changed')
    age = (backup.now() - dt.datetime.fromisoformat(document['created_at'])).total_seconds()
    good = -300 <= age <= 24 * 3600
    return {'status': 'fresh' if good else 'stale', 'within_rpo': good, 'age_hours': round(age / 3600, 3),
            'pool_bytes': total, 'backup': prefix.rstrip('/'), 'restore_verified': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['preflight', 'upload', 'status'])
    parser.add_argument('--config', required=True)
    parser.add_argument('--directory', type=Path)
    parser.add_argument('--mode', choices=['daily', 'baseline'], default='daily')
    parser.add_argument('--approved-gcp-backup', action='store_true')
    args = parser.parse_args(); os.umask(0o077)
    try:
        settings = config(args.config)
        if args.operation == 'preflight':
            total, bucket, _ = Cloud(settings).inventory(settings['project'], settings['bucket'])
            verify_lifecycle(bucket, settings['bucket_metageneration']); capacity(total, 1, settings.get('maximum_pool_bytes', HARD_BYTES))
            result = {'status': 'eligible', 'pool_bytes': total, 'limit_bytes': settings.get('maximum_pool_bytes', HARD_BYTES), 'region': bucket['location']}
        elif args.operation == 'status':
            result = remote_status(settings)
        else:
            if args.directory is None: raise ValueError('Completed encrypted directory is required')
            with (args.directory.parent / '.gcs-upload.lock').open('a') as lock:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                result = upload(settings, args.directory, args.mode, approved=args.approved_gcp_backup)
        print(json.dumps(result)); return 2 if result.get('within_rpo') is False else 0
    except Exception as error:
        print(json.dumps({'status': 'failed', 'reason': type(error).__name__}), file=sys.stderr); return 1


if __name__ == '__main__': raise SystemExit(main())
