#!/usr/bin/env python3
"""Bounded generation-pinned GCS media download for encrypted recovery files."""
import argparse
import base64
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import ssl
import time
import urllib.parse
import urllib.request

spec = importlib.util.spec_from_file_location('gcs', Path(__file__).with_name('gcs.py'))
gcs = importlib.util.module_from_spec(spec); spec.loader.exec_module(gcs)
RANGE_BYTES = 32 * 1024**2


class SameHostRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        parsed = urllib.parse.urlsplit(newurl)
        if parsed.scheme != 'https' or parsed.hostname != 'storage.googleapis.com' or parsed.port not in (None, 443) or parsed.username or parsed.password:
            raise ValueError('Refusing cross-host credential redirect')
        return super().redirect_request(request, fp, code, msg, headers, newurl)


def open_range(cloud, bucket, name, generation, start, end):
    url = 'https://storage.googleapis.com/download/storage/v1/b/' + urllib.parse.quote(bucket, safe='') + '/o/' + urllib.parse.quote(name, safe='')
    url += '?' + urllib.parse.urlencode({'alt': 'media', 'generation': generation})
    request = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + cloud.token, 'Range': f'bytes={start}-{end}', 'Accept-Encoding': 'identity'})
    context = ssl.create_default_context(cafile='/etc/ssl/cert.pem' if Path('/etc/ssl/cert.pem').exists() else None)
    opener = urllib.request.build_opener(SameHostRedirect(), urllib.request.HTTPSHandler(context=context))
    return opener.open(request, timeout=30)


def download(cloud, bucket, name, metadata, target, expected_sha, *, progress=None):
    size = int(metadata['size']); generation = metadata['generation']
    if not 0 < size <= 1_600_000_000 or not str(generation).isdigit():
        raise ValueError('Object exceeds reviewed bounds or lacks immutable generation')
    if metadata.get('metadata', {}).get('sha256') != expected_sha:
        raise ValueError('Remote object does not match the completed manifest')
    if target.exists():
        if target.is_symlink() or target.stat().st_size != size or gcs.backup.digest(target) != expected_sha:
            raise ValueError('Existing local target differs; never overwrite it')
        return {'status': 'already-verified', 'bytes': size}
    temporary = target.with_name(target.name + '.direct-partial')
    sha = hashlib.sha256(); md5 = hashlib.md5(usedforsecurity=False)
    deadline = time.monotonic() + 1800; completed = 0
    created = False
    try:
        descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        created = True
        with os.fdopen(descriptor, 'wb') as output:
            for start in range(0, size, RANGE_BYTES):
                end = min(start + RANGE_BYTES, size) - 1
                with open_range(cloud, bucket, name, generation, start, end) as response:
                    if response.status != 206 or response.headers.get('Content-Range') != f'bytes {start}-{end}/{size}':
                        raise ValueError('Unexpected range response')
                    received = 0
                    while received < end - start + 1:
                        if time.monotonic() > deadline: raise TimeoutError('Object download deadline exceeded')
                        chunk = response.read(min(1024**2, end - start + 1 - received))
                        if not chunk: raise ValueError('Truncated range response')
                        output.write(chunk); sha.update(chunk); md5.update(chunk); received += len(chunk)
                    if response.read(1): raise ValueError('Oversized range response')
                completed += received
                if progress: progress(completed, size)
            output.flush(); os.fsync(output.fileno())
        if completed != size or sha.hexdigest() != expected_sha or base64.b64encode(md5.digest()).decode() != metadata.get('md5Hash'):
            raise ValueError('Downloaded object failed size/SHA256/MD5 validation')
        temporary.replace(target)
        return {'status': 'verified', 'bytes': size}
    except BaseException:
        if created: temporary.unlink(missing_ok=True)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True)
    parser.add_argument('--directory', type=Path, required=True)
    parser.add_argument('--remote-prefix', required=True)
    args = parser.parse_args(); os.umask(0o077)
    try:
        settings = gcs.config(args.config); directory = gcs.backup.private_directory(args.directory)
        if not args.remote_prefix.startswith('beanmap/baseline/') or not gcs.backup.NAME.fullmatch(args.remote_prefix.rsplit('/', 1)[-1]):
            raise ValueError('Only a known completed baseline prefix is accepted')
        manifest = json.loads((directory / 'manifest.json').read_text())
        cloud = gcs.Cloud(settings['gcloud'])
        total, bucket, objects = cloud.inventory(settings['project'], settings['bucket'])
        gcs.verify_lifecycle(bucket, settings['bucket_metageneration'])
        if total > settings.get('maximum_pool_bytes', gcs.HARD_BYTES): raise ValueError('Pool exceeds reviewed bound')
        by_name = {obj['name']: obj for obj in objects}
        for filename, expected in manifest['files'].items():
            if filename not in gcs.backup.COMPONENTS: raise ValueError('Unknown encrypted component')
            name = args.remote_prefix + '/' + filename
            metadata = by_name[name]
            if int(metadata['size']) != expected['bytes']: raise ValueError('Manifest size mismatch')
            def progress(done, size):
                print(json.dumps({'component': filename, 'received_bytes': done, 'total_bytes': size}), flush=True)
            print(json.dumps(download(cloud, settings['bucket'], name, metadata, directory / filename, expected['sha256'], progress=progress)), flush=True)
        gcs.backup.validate(directory)
        print(json.dumps({'status': 'complete-verified', 'directory': str(directory)})); return 0
    except Exception as error:
        print(json.dumps({'status': 'failed', 'reason': type(error).__name__})); return 1


if __name__ == '__main__': raise SystemExit(main())
