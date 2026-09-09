#!/usr/bin/env python3
"""Verified, single-parent OCI image deltas. No network or Docker side effects.

Image layer contents are never extracted or executed. Only a small allowlist of
outer OCI files is materialized in private temporary storage, and a fresh tar is
written only after every reference, blob and uncompressed layer digest passes.
"""
from __future__ import annotations
import argparse
from contextlib import contextmanager
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import tarfile
import tempfile

SHA = re.compile(r'[0-9a-f]{64}\Z')
DIGEST = re.compile(r'sha256:([0-9a-f]{64})\Z')
BLOB = re.compile(r'blobs/sha256/([0-9a-f]{64})\Z')
BACKUP = re.compile(r'backup-\d{8}T\d{6}Z-[0-9a-f]{8}\Z')
TOP = {'index.json', 'manifest.json', 'oci-layout'}
OCI_MANIFEST = 'application/vnd.oci.image.manifest.v1+json'
OCI_CONFIG = 'application/vnd.oci.image.config.v1+json'
OCI_INDEX = 'application/vnd.oci.image.index.v1+json'
MANIFEST_TYPES = {OCI_MANIFEST, 'application/vnd.docker.distribution.manifest.v2+json'}
INDEX_TYPES = {OCI_INDEX, 'application/vnd.docker.distribution.manifest.list.v2+json'}
CONFIG_TYPES = {OCI_CONFIG, 'application/vnd.docker.container.image.v1+json'}
LAYER_TYPES = {'application/vnd.oci.image.layer.v1.tar', 'application/vnd.oci.image.layer.v1.tar+gzip',
               'application/vnd.docker.image.rootfs.diff.tar', 'application/vnd.docker.image.rootfs.diff.tar.gzip'}
MAX_ARCHIVE = 8 * 1024**3
MAX_MEMBER = 2 * 1024**3
MAX_TOTAL = 8 * 1024**3
MAX_LAYER = 4 * 1024**3
MAX_INFLATED = 16 * 1024**3
MAX_FILES = 4096
MAX_JSON = 2 * 1024**2
CHUNK = 1024**2


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


@contextmanager
def regular(path):
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(descriptor, 'rb') as stream:
        info = os.fstat(stream.fileno())
        require(stat.S_ISREG(info.st_mode), 'Input must be a regular non-symlink file')
        yield stream


def file_info(path):
    digest = hashlib.sha256(); size = 0
    with regular(path) as stream:
        for chunk in iter(lambda: stream.read(CHUNK), b''):
            size += len(chunk)
            require(size <= MAX_ARCHIVE, 'Input archive size limit exceeded')
            digest.update(chunk)
    return {'bytes': size, 'sha256': digest.hexdigest()}


def json_bytes(data):
    require(len(data) <= MAX_JSON, 'JSON size limit exceeded')
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, 'Duplicate JSON key')
            result[key] = value
        return result
    return json.loads(data, object_pairs_hook=pairs,
                      parse_constant=lambda _: (_ for _ in ()).throw(ValueError('Non-finite JSON number')))


def read_json(path):
    with regular(path) as stream:
        return json_bytes(stream.read(MAX_JSON + 1))


def private(path):
    path = Path(path)
    require(not path.is_symlink(), 'Private directory cannot be a symlink')
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    info = path.stat()
    require(info.st_uid == os.geteuid() and not info.st_mode & 0o077, 'Private directory must be owned and mode 0700')
    return path


class BoundedReader:
    def __init__(self, stream, limit):
        self.stream = stream; self.limit = limit; self.total = 0

    def read(self, size=-1):
        # Covers padding and PAX headers too, not just declared file payloads.
        data = self.stream.read(min(size if size >= 0 else CHUNK, self.limit - self.total + 1))
        self.total += len(data)
        require(self.total <= self.limit, 'Expanded tar stream size limit exceeded')
        return data


class StrictTarInfo(tarfile.TarInfo):
    def _proc_member(self, archive):
        # These allowed OCI paths fit USTAR. Reject extension payloads before
        # tarfile reads them into memory (member-level checks happen too late).
        require(self.type in {tarfile.REGTYPE, tarfile.AREGTYPE, tarfile.DIRTYPE},
                'Extended or nonregular outer tar headers are forbidden')
        return super()._proc_member(archive)


def read_archive(path, directory):
    """Read all outer members, including trailing members; never tar.extract()."""
    entries = {}; seen = set(); total = 0
    with regular(path) as raw:
        require(os.fstat(raw.fileno()).st_size <= MAX_ARCHIVE, 'Input archive size limit exceeded')
        magic = raw.read(2); raw.seek(0)
        stream = gzip.GzipFile(fileobj=raw) if magic == b'\x1f\x8b' else raw
        bounded = BoundedReader(stream, MAX_TOTAL + MAX_FILES * 4096 + 10240)
        try:
            with tarfile.open(fileobj=bounded, mode='r|', ignore_zeros=True, tarinfo=StrictTarInfo) as archive:
                for member in archive:
                    name = member.name
                    require(name not in seen, 'Repeated outer tar member')
                    seen.add(name)
                    require(len(seen) <= MAX_FILES, 'Outer tar member count limit exceeded')
                    require(not member.pax_headers.get('GNU.sparse.map') and member.sparse is None,
                            'Sparse tar members are forbidden')
                    if member.isdir():
                        require(name in {'blobs', 'blobs/sha256'} and member.size == 0, 'Unexpected outer tar directory')
                        continue
                    require(member.isfile() and (name in TOP or BLOB.fullmatch(name)), 'Unsafe or unsupported outer tar member')
                    require(0 < member.size <= (MAX_JSON if name in TOP else MAX_MEMBER), 'Outer member size limit exceeded')
                    total += member.size
                    require(total <= MAX_TOTAL, 'Expanded archive size limit exceeded')
                    target = directory / str(len(entries))
                    digest = hashlib.sha256(); copied = 0
                    with archive.extractfile(member) as source, target.open('xb') as output:
                        os.chmod(target, 0o600)
                        for chunk in iter(lambda: source.read(CHUNK), b''):
                            copied += len(chunk); digest.update(chunk); output.write(chunk)
                    require(copied == member.size, 'Truncated outer member')
                    checksum = digest.hexdigest()
                    if match := BLOB.fullmatch(name):
                        require(checksum == match[1], 'OCI blob filename/hash mismatch')
                    entries[name] = {'bytes': copied, 'sha256': checksum, 'path': target}
            # Reach authenticated gzip EOF/CRC even after the tar parser ends.
            while bounded.read(CHUNK):
                raise ValueError('Unexpected data after outer tar')
        finally:
            if stream is not raw:
                stream.close()
    require(entries, 'Empty image archive')
    return entries


def entry_json(entries, name):
    require(name in entries and entries[name]['bytes'] <= MAX_JSON, 'Missing or oversized OCI JSON')
    return read_json(entries[name]['path'])


def descriptor(entries, value, media_type):
    require(isinstance(value, dict) and value.get('mediaType') == media_type, 'Unsupported OCI descriptor type')
    require(isinstance(value.get('digest'), str), 'Invalid OCI descriptor digest type')
    match = DIGEST.fullmatch(value.get('digest', ''))
    require(match is not None, 'Invalid OCI descriptor digest')
    name = 'blobs/sha256/' + match[1]
    require(name in entries and type(value.get('size')) is int and entries[name]['bytes'] == value['size'], 'Missing OCI descriptor or size mismatch')
    require(not value.get('urls') and not value.get('data'), 'External or inline OCI descriptor is forbidden')
    return name


def image_ids(values):
    require(isinstance(values, list) and 1 <= len(values) <= 8 and all(isinstance(value, str) and DIGEST.fullmatch(value) for value in values), 'Invalid expected image IDs')
    return sorted(set(values))


def resolve_manifest(entries, item, required):
    """Docker save can preserve a multi-platform index ID and its ARM child."""
    visited = set()
    for _ in range(5):
        require(isinstance(item, dict) and item.get('mediaType') in MANIFEST_TYPES | INDEX_TYPES, 'Unsupported image descriptor')
        name = descriptor(entries, item, item['mediaType'])
        require(name not in visited, 'Cyclic image index'); visited.add(name); required.add(name)
        value = entry_json(entries, name)
        require(isinstance(value, dict) and value.get('schemaVersion') == 2 and value.get('mediaType') == item['mediaType'], 'Image descriptor/content type differs')
        if item['mediaType'] in MANIFEST_TYPES:
            return value
        children = value.get('manifests')
        require(isinstance(children, list) and 1 <= len(children) <= 64, 'Invalid multi-platform image index')
        selected = [child for child in children if isinstance(child, dict) and isinstance(child.get('platform'), dict)
                    and child['platform'].get('os') == 'linux' and child['platform'].get('architecture') == 'arm64'
                    and child['platform'].get('variant', 'v8') == 'v8']
        require(len(selected) == 1, 'Image index must select exactly one linux/arm64 child')
        for child in children:
            if child is selected[0] or not isinstance(child, dict) or not isinstance(child.get('digest'), str):
                continue
            match = DIGEST.fullmatch(child['digest'])
            if not match or 'blobs/sha256/' + match[1] not in entries:
                # A native Docker save can omit non-native platform content.
                continue
            collect_attestation(entries, child, selected[0]['digest'], required)
        item = selected[0]
    raise ValueError('Image index depth limit exceeded')


def config_descriptor(entries, value):
    require(isinstance(value, dict) and value.get('mediaType') in CONFIG_TYPES, 'Unsupported image config type')
    return descriptor(entries, value, value['mediaType'])


def collect_attestation(entries, child, native_digest, required):
    annotations = child.get('annotations', {})
    require(child.get('platform') == {'architecture': 'unknown', 'os': 'unknown'}
            and annotations.get('vnd.docker.reference.type') == 'attestation-manifest'
            and annotations.get('vnd.docker.reference.digest') == native_digest,
            'Unexpected saved secondary-platform image')
    name = descriptor(entries, child, OCI_MANIFEST); required.add(name)
    value = entry_json(entries, name)
    require(isinstance(value, dict) and value.get('schemaVersion') == 2 and value.get('mediaType') == OCI_MANIFEST,
            'Invalid image attestation manifest')
    config_name = config_descriptor(entries, value.get('config')); required.add(config_name)
    config = entry_json(entries, config_name)
    require(isinstance(config, dict) and config.get('architecture') == 'unknown' and config.get('os') == 'unknown'
            and isinstance(config.get('rootfs'), dict) and config['rootfs'].get('type') == 'layers', 'Invalid image attestation configuration')
    layers = value.get('layers')
    require(isinstance(layers, list) and 1 <= len(layers) <= 8, 'Invalid image attestation layers')
    for layer in layers:
        blob = descriptor(entries, layer, 'application/vnd.in-toto+json'); required.add(blob)
        require(isinstance(entry_json(entries, blob), dict), 'Invalid image attestation document')
    require(config['rootfs'].get('diff_ids') == [layer['digest'] for layer in layers], 'Image attestation diff_ids differ')


def validate_oci(entries, expected_ids):
    expected_ids = image_ids(expected_ids)
    require(TOP <= entries.keys(), 'Incomplete OCI archive')
    require(entry_json(entries, 'oci-layout') == {'imageLayoutVersion': '1.0.0'}, 'Unsupported OCI layout')
    index = entry_json(entries, 'index.json')
    require(isinstance(index, dict) and index.get('schemaVersion') == 2 and index.get('mediaType') == OCI_INDEX, 'Unsupported OCI index')
    manifests = index.get('manifests')
    require(isinstance(manifests, list) and len(manifests) == len(expected_ids), 'Unexpected OCI image count')
    require(all(isinstance(item, dict) and isinstance(item.get('digest'), str) for item in manifests), 'Invalid OCI image index entry')
    actual_ids = [item.get('digest') for item in manifests if isinstance(item, dict)]
    require(sorted(actual_ids) == expected_ids, 'OCI index does not match expected image IDs')
    required = set(TOP); images = []; inflated = 0; checked_layers = {}
    for item in manifests:
        manifest = resolve_manifest(entries, item, required)
        config_name = config_descriptor(entries, manifest.get('config')); required.add(config_name)
        config = entry_json(entries, config_name)
        require(isinstance(config, dict), 'Invalid image configuration')
        require(config.get('os') == 'linux' and config.get('architecture') == 'arm64', 'Image platform is not reviewed linux/arm64')
        rootfs = config.get('rootfs', {})
        require(isinstance(rootfs, dict), 'Invalid image root filesystem')
        layers = manifest.get('layers')
        require(isinstance(layers, list) and 0 < len(layers) <= 128 and rootfs.get('type') == 'layers', 'Invalid image layer list')
        diff_ids = rootfs.get('diff_ids')
        require(isinstance(diff_ids, list) and len(diff_ids) == len(layers) and all(isinstance(value, str) and DIGEST.fullmatch(value) for value in diff_ids), 'Invalid uncompressed layer digests')
        layer_names = []
        for layer, diff_id in zip(layers, diff_ids):
            require(isinstance(layer, dict) and layer.get('mediaType') in LAYER_TYPES, 'Unsupported image layer encoding')
            layer_name = descriptor(entries, layer, layer['mediaType']); required.add(layer_name); layer_names.append(layer_name)
            cache_key = (layer_name, layer['mediaType'])
            if cache_key not in checked_layers:
                digest = hashlib.sha256(); size = 0
                with regular(entries[layer_name]['path']) as raw:
                    stream = gzip.GzipFile(fileobj=raw) if layer['mediaType'].endswith('gzip') else raw
                    try:
                        for chunk in iter(lambda: stream.read(CHUNK), b''):
                            size += len(chunk); inflated += len(chunk)
                            require(size <= MAX_LAYER and inflated <= MAX_INFLATED, 'Uncompressed image layer size limit exceeded')
                            digest.update(chunk)
                    finally:
                        if stream is not raw:
                            stream.close()
                checked_layers[cache_key] = 'sha256:' + digest.hexdigest()
            require(checked_layers[cache_key] == diff_id, 'Image layer diff_id mismatch')
        images.append((config_name, tuple(layer_names)))
    docker = entry_json(entries, 'manifest.json')
    require(isinstance(docker, list) and len(docker) == len(images), 'Invalid Docker compatibility manifest')
    docker_images = []
    for item in docker:
        require(isinstance(item, dict) and set(item) == {'Config', 'RepoTags', 'Layers'}, 'Unexpected Docker manifest fields')
        require(item['RepoTags'] in (None, []), 'Tagged image archives are not permitted')
        require(isinstance(item['Layers'], list) and all(isinstance(name, str) for name in item['Layers']), 'Invalid Docker layer list')
        docker_images.append((item['Config'], tuple(item['Layers'])))
    require(sorted(docker_images) == sorted(images), 'Docker/OCI image configuration or layer order differs')
    require(required == set(entries), 'Unreferenced OCI payload is forbidden')
    return {'images_verified': len(images), 'files_verified': len(entries), 'unique_layers_verified': len(checked_layers)}


def select_oci(base, unique, expected_ids):
    """Select only the complete candidate graph, never unrelated parent images."""
    require(TOP <= unique.keys(), 'Delta is missing its own OCI metadata')
    available = {**base, **unique}; names = set(TOP)
    index = entry_json(unique, 'index.json')
    require(isinstance(index, dict) and isinstance(index.get('manifests'), list), 'Invalid delta index')
    require(all(isinstance(item, dict) and isinstance(item.get('digest'), str) for item in index['manifests']), 'Invalid delta index entry')
    require(sorted(item.get('digest', '') for item in index['manifests']) == image_ids(expected_ids), 'Delta index differs from expected image IDs')
    for item in index['manifests']:
        manifest = resolve_manifest(available, item, names)
        names.add(config_descriptor(available, manifest.get('config')))
        require(isinstance(manifest.get('layers'), list), 'Invalid delta layers')
        for layer in manifest['layers']:
            require(isinstance(layer, dict) and layer.get('mediaType') in LAYER_TYPES, 'Invalid delta layer')
            names.add(descriptor(available, layer, layer['mediaType']))
    require(set(unique) <= names, 'Unreferenced delta payload is forbidden')
    return {name: available[name] for name in names}


def parent_reference(value):
    fields = {'backup_name', 'image_file', 'ciphertext_bytes', 'ciphertext_sha256', 'manifest_sha256', 'object_generation', 'manifest_generation'}
    require(isinstance(value, dict) and set(value) == fields, 'Invalid parent reference fields')
    require(isinstance(value['backup_name'], str) and BACKUP.fullmatch(value['backup_name']), 'Invalid parent backup name')
    require(value['image_file'] in {'images.tar.age', 'images.tar.gz.age'}, 'Only a full-image parent is supported')
    require(type(value['ciphertext_bytes']) is int and 0 < value['ciphertext_bytes'] <= MAX_ARCHIVE, 'Invalid parent ciphertext size')
    for key in ['ciphertext_sha256', 'manifest_sha256']:
        require(isinstance(value[key], str) and SHA.fullmatch(value[key]), 'Invalid parent checksum')
    for key in ['object_generation', 'manifest_generation']:
        require(isinstance(value[key], str) and re.fullmatch(r'[1-9][0-9]{0,24}', value[key]), 'Parent object generations must be pinned')
    return value


def validate_info(value):
    require(isinstance(value, dict) and set(value) == {'bytes', 'sha256'} and type(value['bytes']) is int and 0 < value['bytes'] <= MAX_ARCHIVE
            and isinstance(value['sha256'], str) and SHA.fullmatch(value['sha256']), 'Invalid artifact fingerprint')


def metadata(value, trusted_parent, expected_ids):
    require(isinstance(value, dict) and set(value) == {'format', 'parent', 'base_archive', 'delta_archive', 'expected_image_ids', 'files'}, 'Unsupported image delta metadata')
    require(type(value['format']) is int and value['format'] == 1, 'Unsupported image delta format')
    require(parent_reference(value['parent']) == parent_reference(trusted_parent), 'Parent reference differs from trusted generation receipt')
    require(image_ids(value['expected_image_ids']) == image_ids(expected_ids), 'Metadata image IDs differ from reviewed inventory')
    validate_info(value['base_archive']); validate_info(value['delta_archive'])
    require(isinstance(value['files'], dict) and 3 < len(value['files']) <= MAX_FILES, 'Invalid image delta file inventory')
    for name, info in value['files'].items():
        require(isinstance(name, str) and (name in TOP or BLOB.fullmatch(name)), 'Unsafe image delta inventory path')
        require(isinstance(info, dict) and set(info) == {'source', 'bytes', 'sha256'} and info['source'] in {'base', 'delta'}, 'Invalid delta file source')
        validate_info({key: info[key] for key in ['bytes', 'sha256']})
        require(name not in TOP or info['source'] == 'delta', 'Top-level OCI metadata must come from delta')
    return value


def write_tar(entries, path, compressed=False):
    """No replace: publish a complete new archive, then clean partials on error."""
    tar_bytes = sum(512 + ((entry['bytes'] + 511) // 512) * 512 for entry in entries.values()) + 1024
    tar_bytes = ((tar_bytes + tarfile.RECORDSIZE - 1) // tarfile.RECORDSIZE) * tarfile.RECORDSIZE
    require(tar_bytes <= MAX_ARCHIVE, 'Output archive size limit exceeded')
    created = False
    try:
        with Path(path).open('xb') as output:
            created = True; os.chmod(path, 0o600)
            stream = gzip.GzipFile(fileobj=output, mode='wb', filename='', mtime=0, compresslevel=1) if compressed else output
            try:
                with tarfile.open(fileobj=stream, mode='w|', format=tarfile.USTAR_FORMAT) as archive:
                    for name, entry in sorted(entries.items()):
                        info = tarfile.TarInfo(name); info.size = entry['bytes']; info.mode = 0o600
                        with regular(entry['path']) as source:
                            archive.addfile(info, source)
            finally:
                if stream is not output:
                    stream.close()
            output.flush(); os.fsync(output.fileno())
    except BaseException:
        if created:
            Path(path).unlink(missing_ok=True)
        raise


def write_json(value, path):
    created = False
    try:
        with Path(path).open('x') as output:
            created = True; os.chmod(path, 0o600)
            json.dump(value, output, indent=2); output.write('\n'); output.flush(); os.fsync(output.fileno())
    except BaseException:
        if created:
            Path(path).unlink(missing_ok=True)
        raise


def create(base_archive, candidate_archive, trusted_parent, expected_ids, delta_output, metadata_output, workspace):
    parent_reference(trusted_parent); expected_ids = image_ids(expected_ids)
    with tempfile.TemporaryDirectory(prefix='image-delta-', dir=private(workspace)) as temporary:
        directory = Path(temporary); (directory / 'base').mkdir(); (directory / 'candidate').mkdir()
        base = read_archive(base_archive, directory / 'base')
        candidate = read_archive(candidate_archive, directory / 'candidate')
        result = validate_oci(candidate, expected_ids)
        sources = {name: ('base' if name not in TOP and name in base and all(base[name][key] == entry[key] for key in ['bytes', 'sha256']) else 'delta') for name, entry in candidate.items()}
        unique = {name: entry for name, entry in candidate.items() if sources[name] == 'delta'}
        require(not Path(metadata_output).exists(), 'Metadata output already exists')
        write_tar(unique, delta_output, compressed=True)
        try:
            value = {'format': 1, 'parent': trusted_parent, 'base_archive': file_info(base_archive), 'delta_archive': file_info(delta_output),
                     'expected_image_ids': expected_ids, 'files': {name: {'source': sources[name], 'bytes': entry['bytes'], 'sha256': entry['sha256']} for name, entry in sorted(candidate.items())}}
            write_json(value, metadata_output)
        except BaseException:
            Path(delta_output).unlink(missing_ok=True)
            raise
        return {**result, 'base_files': len(candidate) - len(unique), 'delta_files': len(unique), 'delta_bytes': value['delta_archive']['bytes']}


def seal(base_archive, delta_archive, trusted_parent, expected_ids, metadata_output, workspace):
    """Validate an already measured small delta without copying the full candidate."""
    parent_reference(trusted_parent); expected_ids = image_ids(expected_ids)
    require(not Path(metadata_output).exists(), 'Metadata output already exists')
    with tempfile.TemporaryDirectory(prefix='image-seal-', dir=private(workspace)) as temporary:
        directory = Path(temporary); (directory / 'base').mkdir(); (directory / 'delta').mkdir()
        base = read_archive(base_archive, directory / 'base'); unique = read_archive(delta_archive, directory / 'delta')
        combined = select_oci(base, unique, expected_ids)
        result = validate_oci(combined, expected_ids)
        value = {'format': 1, 'parent': trusted_parent, 'base_archive': file_info(base_archive), 'delta_archive': file_info(delta_archive),
                 'expected_image_ids': expected_ids, 'files': {name: {'source': 'delta' if name in unique else 'base', 'bytes': entry['bytes'], 'sha256': entry['sha256']} for name, entry in sorted(combined.items())}}
        write_json(value, metadata_output)
        return {**result, 'base_files': len(combined) - len(unique), 'delta_files': len(unique), 'delta_bytes': value['delta_archive']['bytes']}


def reconstruct(base_archive, delta_archive, reference, trusted_parent, expected_ids, output, workspace, *, expected_parent_ids=None):
    value = metadata(reference, trusted_parent, expected_ids)
    require(file_info(base_archive) == value['base_archive'], 'Parent plaintext archive fingerprint mismatch')
    require(file_info(delta_archive) == value['delta_archive'], 'Delta archive fingerprint mismatch')
    with tempfile.TemporaryDirectory(prefix='image-reconstruct-', dir=private(workspace)) as temporary:
        directory = Path(temporary); (directory / 'base').mkdir(); (directory / 'delta').mkdir()
        base = read_archive(base_archive, directory / 'base'); delta = read_archive(delta_archive, directory / 'delta')
        parent_result = validate_oci(base, expected_parent_ids) if expected_parent_ids is not None else None
        require(set(delta) == {name for name, info in value['files'].items() if info['source'] == 'delta'}, 'Delta file inventory differs')
        combined = {}
        for name, info in value['files'].items():
            source = base if info['source'] == 'base' else delta
            require(name in source and all(source[name][key] == info[key] for key in ['bytes', 'sha256']), 'Missing or mismatched referenced image file')
            combined[name] = source[name]
        result = validate_oci(combined, expected_ids)
        write_tar(combined, output)
        try:
            fingerprint = file_info(output)
        except BaseException:
            Path(output).unlink(missing_ok=True)
            raise
        return {**result, 'output': fingerprint, 'parent_verified': True,
                **({'parent_images_verified': parent_result['images_verified']} if parent_result else {})}


def decrypt(age, identity, source, destination):
    with Path(destination).open('xb') as output, tempfile.TemporaryFile() as errors:
        os.chmod(destination, 0o600)
        process = subprocess.Popen([age, '--decrypt', '--identity', str(identity), str(source)], stdout=subprocess.PIPE, stderr=errors)
        size = 0
        try:
            for chunk in iter(lambda: process.stdout.read(CHUNK), b''):
                size += len(chunk)
                require(size <= MAX_ARCHIVE, 'Decrypted image component size limit exceeded')
                output.write(chunk)
            require(process.wait() == 0, 'Encrypted image component authentication failed')
        finally:
            if process.poll() is None:
                process.kill()
            process.wait(); process.stdout.close()


def reconstruct_encrypted(base_ciphertext, delta_ciphertext, reference_ciphertext, identity, trusted_parent, expected_ids, output, workspace, age='age', *, expected_parent_ids):
    """Caller first validates current bundle ciphertexts and pinned GCS receipts.

    Authentication must finish before any decrypted bytes are parsed or loaded.
    This function does not invoke Docker, alter tags, or contact cloud storage.
    """
    parent_reference(trusted_parent)
    expected_parent_ids = image_ids(expected_parent_ids)
    require(file_info(base_ciphertext) == {'bytes': trusted_parent['ciphertext_bytes'], 'sha256': trusted_parent['ciphertext_sha256']}, 'Parent ciphertext fingerprint mismatch')
    with regular(identity) as key:
        info = os.fstat(key.fileno())
        require(info.st_uid == os.geteuid() and not info.st_mode & 0o077, 'Age identity must be private and owned')
    with tempfile.TemporaryDirectory(prefix='image-decrypt-', dir=private(workspace)) as temporary:
        directory = Path(temporary)
        for source, name in [(reference_ciphertext, 'reference.json'), (base_ciphertext, 'base.tar'), (delta_ciphertext, 'delta.tar.gz')]:
            decrypt(age, identity, source, directory / name)
        return reconstruct(directory / 'base.tar', directory / 'delta.tar.gz', read_json(directory / 'reference.json'), trusted_parent, expected_ids, output, workspace, expected_parent_ids=expected_parent_ids)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['create', 'seal', 'reconstruct', 'reconstruct-encrypted'])
    parser.add_argument('--base', required=True); parser.add_argument('--delta', required=True)
    parser.add_argument('--reference', required=True); parser.add_argument('--parent-receipt', required=True)
    parser.add_argument('--expected-image-id', action='append', required=True)
    parser.add_argument('--expected-parent-image-id', action='append', help='Each parent inventory image ID; required for encrypted recovery')
    parser.add_argument('--workspace', required=True); parser.add_argument('--candidate'); parser.add_argument('--output'); parser.add_argument('--identity'); parser.add_argument('--age', default='age')
    args = parser.parse_args(); parent = read_json(args.parent_receipt)
    if args.action == 'create':
        require(args.candidate is not None, 'Candidate archive is required')
        result = create(args.base, args.candidate, parent, args.expected_image_id, args.delta, args.reference, args.workspace)
    elif args.action == 'seal':
        result = seal(args.base, args.delta, parent, args.expected_image_id, args.reference, args.workspace)
    elif args.action == 'reconstruct':
        require(args.output is not None, 'Output archive is required')
        result = reconstruct(args.base, args.delta, read_json(args.reference), parent, args.expected_image_id, args.output, args.workspace, expected_parent_ids=args.expected_parent_image_id)
    else:
        require(args.output is not None and args.identity is not None, 'Output archive and private identity are required')
        result = reconstruct_encrypted(args.base, args.delta, args.reference, args.identity, parent, args.expected_image_id, args.output, args.workspace, args.age, expected_parent_ids=args.expected_parent_image_id)
    print(json.dumps(result))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, tarfile.TarError, EOFError) as error:
        raise SystemExit('Image delta validation failed: ' + str(error)) from None
