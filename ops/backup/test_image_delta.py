import copy
import gzip
import io
import json
from pathlib import Path
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).parent))
import image_delta as delta


def encode(value):
    return json.dumps(value, separators=(',', ':')).encode()


def layer(text):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode='w') as archive:
        item = tarfile.TarInfo('fixture.txt'); data = text.encode(); item.size = len(data)
        archive.addfile(item, io.BytesIO(data))
    return output.getvalue()


def images(new=False, *, wrong_diff=False, wrong_order=False, wrong_size=False, platform='arm64', count=4, docker_layers=False):
    files = {}; index = []; docker = []
    def blob(data, media):
        digest = delta.sha(data); files['blobs/sha256/' + digest] = data
        return {'mediaType': media, 'digest': 'sha256:' + digest, 'size': len(data)}
    for number in range(count):
        raw = [layer('shared'), layer(('new-' if new else 'old-') + str(number))]
        media = 'application/vnd.docker.image.rootfs.diff.tar.gzip' if docker_layers else 'application/vnd.oci.image.layer.v1.tar+gzip'
        descriptors = [blob(gzip.compress(value, mtime=0), media) for value in raw]
        config = {'architecture': platform, 'os': 'linux', 'rootfs': {'type': 'layers', 'diff_ids': ['sha256:' + delta.sha(value) for value in raw]}}
        if wrong_diff: config['rootfs']['diff_ids'][0] = 'sha256:' + 'a' * 64
        config_descriptor = blob(encode(config), delta.OCI_CONFIG)
        if wrong_size: descriptors[0]['size'] += 1
        manifest = {'schemaVersion': 2, 'mediaType': delta.OCI_MANIFEST, 'config': config_descriptor, 'layers': descriptors}
        index.append(blob(encode(manifest), delta.OCI_MANIFEST))
        layers = ['blobs/sha256/' + item['digest'][7:] for item in descriptors]
        docker.append({'Config': 'blobs/sha256/' + config_descriptor['digest'][7:], 'RepoTags': None, 'Layers': layers[::-1] if wrong_order else layers})
    files.update({'index.json': encode({'schemaVersion': 2, 'mediaType': delta.OCI_INDEX, 'manifests': index}),
                  'manifest.json': encode(docker), 'oci-layout': encode({'imageLayoutVersion': '1.0.0'})})
    return files, sorted(item['digest'] for item in index)


def archive(path, files, extra=()):
    with tarfile.open(path, mode='w') as output:
        for name, data in files.items():
            item = tarfile.TarInfo(name); item.size = len(data)
            output.addfile(item, io.BytesIO(data))
        for item, data in extra:
            output.addfile(item, io.BytesIO(data))


class ImageDeltaTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name); self.root.chmod(0o700)
        self.base = self.root / 'base.tar'; self.candidate = self.root / 'candidate.tar'
        self.diff = self.root / 'delta.tar.gz'; self.ref = self.root / 'reference.json'; self.output = self.root / 'restored.tar'
        self.parent = {'backup_name': 'backup-20260909T040802Z-e55a4bc5', 'image_file': 'images.tar.gz.age',
                       'ciphertext_bytes': 123, 'ciphertext_sha256': 'a' * 64, 'manifest_sha256': 'b' * 64,
                       'object_generation': '123456789', 'manifest_generation': '123456790'}
        self.base_files, self.base_ids = images(); self.files, self.ids = images(new=True)
        archive(self.base, self.base_files); archive(self.candidate, self.files)

    def create(self):
        return delta.create(self.base, self.candidate, self.parent, self.ids, self.diff, self.ref, self.root)

    def restore(self, reference=None, **overrides):
        return delta.reconstruct(self.base, self.diff, reference or delta.read_json(self.ref), overrides.get('parent', self.parent),
                                 overrides.get('ids', self.ids), self.output, self.root)

    def test_shared_blob_delta_reconstructs_every_file_and_four_exact_images(self):
        result = self.create(); restored = self.restore()
        self.assertEqual(result['base_files'], 1)
        self.assertEqual(restored['images_verified'], 4)
        with tarfile.open(self.output) as output:
            self.assertEqual({member.name: output.extractfile(member).read() for member in output}, self.files)
        self.assertEqual(self.output.stat().st_mode & 0o777, 0o600)
        self.assertFalse(any(path.name.startswith(('image-delta-', 'image-reconstruct-')) for path in self.root.iterdir()))

    def test_sealing_a_small_delta_needs_no_full_candidate_archive(self):
        self.create(); expected = delta.read_json(self.ref); self.ref.unlink(); self.candidate.unlink()
        result = delta.seal(self.base, self.diff, self.parent, self.ids, self.ref, self.root)
        self.assertEqual(result['images_verified'], 4)
        self.assertEqual(delta.read_json(self.ref), expected)
        self.restore()

    def test_shared_blob_only_parent_cannot_prove_full_recovery_inventory(self):
        shared = next(name for name in self.base_files if name.startswith('blobs/') and self.base_files[name] in self.files.values())
        archive(self.base, {shared: self.base_files[shared]})
        self.create()
        # Reconstructing the selected candidates alone can work, but full
        # recovery must reject a parent which omitted all unchanged images.
        with self.assertRaisesRegex(ValueError, 'Incomplete OCI archive'):
            delta.reconstruct(self.base, self.diff, delta.read_json(self.ref), self.parent, self.ids, self.output, self.root, expected_parent_ids=self.base_ids)
        self.assertFalse(self.output.exists())

    def test_expected_inventory_accepts_shared_ids_but_limits_service_count(self):
        self.assertEqual(delta.image_ids([self.ids[0]] * 8), [self.ids[0]])
        with self.assertRaises(ValueError): delta.image_ids([self.ids[0]] * 9)

    def test_all_eight_images_and_docker_gzip_layers_validate(self):
        files, ids = images(new=True, count=8, docker_layers=True)
        archive(self.candidate, files)
        with tempfile.TemporaryDirectory(dir=self.root) as directory:
            result = delta.validate_oci(delta.read_archive(self.candidate, Path(directory)), ids)
        self.assertEqual(result['images_verified'], 8)

    def test_multi_platform_ids_resolve_exact_arm64_child_and_reject_ambiguity(self):
        for ambiguous in [False, True]:
            files = dict(self.files); index = json.loads(files['index.json']); wrapped = []
            for child in index['manifests']:
                selected = dict(child, platform={'os': 'linux', 'architecture': 'arm64', 'variant': 'v8'})
                children = [selected, selected] if ambiguous else [selected, {'mediaType': delta.OCI_MANIFEST, 'digest': 'sha256:' + '0' * 64, 'size': 12, 'platform': {'os': 'linux', 'architecture': 'amd64'}}]
                encoded = encode({'schemaVersion': 2, 'mediaType': delta.OCI_INDEX, 'manifests': children})
                digest = delta.sha(encoded); files['blobs/sha256/' + digest] = encoded
                wrapped.append({'mediaType': delta.OCI_INDEX, 'digest': 'sha256:' + digest, 'size': len(encoded)})
            files['index.json'] = encode(dict(index, manifests=wrapped)); archive(self.candidate, files)
            ids = [item['digest'] for item in wrapped]
            with tempfile.TemporaryDirectory(dir=self.root) as directory:
                entries = delta.read_archive(self.candidate, Path(directory))
                if ambiguous:
                    with self.assertRaisesRegex(ValueError, 'exactly one'): delta.validate_oci(entries, ids)
                else:
                    self.assertEqual(delta.validate_oci(entries, ids)['images_verified'], 4)

    def test_native_index_preserves_digest_checked_buildkit_attestation_closure(self):
        files = dict(self.files); index = json.loads(files['index.json']); wrapped = []
        def blob(value, media):
            data = encode(value); digest = delta.sha(data); files['blobs/sha256/' + digest] = data
            return {'mediaType': media, 'digest': 'sha256:' + digest, 'size': len(data)}
        for child in index['manifests']:
            statement = blob({'_type': 'https://in-toto.io/Statement/v0.1', 'subject': [{'digest': {'sha256': child['digest'][7:]}}], 'predicate': {}}, 'application/vnd.in-toto+json')
            config = blob({'architecture': 'unknown', 'os': 'unknown', 'rootfs': {'type': 'layers', 'diff_ids': [statement['digest']]}}, delta.OCI_CONFIG)
            attest = blob({'schemaVersion': 2, 'mediaType': delta.OCI_MANIFEST, 'config': config, 'layers': [statement]}, delta.OCI_MANIFEST)
            attest.update(platform={'architecture': 'unknown', 'os': 'unknown'}, annotations={'vnd.docker.reference.type': 'attestation-manifest', 'vnd.docker.reference.digest': child['digest']})
            native = dict(child, platform={'architecture': 'arm64', 'os': 'linux'})
            wrapped.append(blob({'schemaVersion': 2, 'mediaType': delta.OCI_INDEX, 'manifests': [native, attest]}, delta.OCI_INDEX))
        files['index.json'] = encode(dict(index, manifests=wrapped)); archive(self.candidate, files)
        with tempfile.TemporaryDirectory(dir=self.root) as directory:
            result = delta.validate_oci(delta.read_archive(self.candidate, Path(directory)), [item['digest'] for item in wrapped])
        self.assertEqual(result['files_verified'], len(files))

    def test_wrong_generation_manifest_parent_hash_and_image_ids_fail_before_output(self):
        self.create()
        for field, changed in [('object_generation', '999'), ('manifest_generation', '999'), ('manifest_sha256', 'c' * 64), ('ciphertext_sha256', 'd' * 64)]:
            with self.subTest(field=field):
                other = dict(self.parent, **{field: changed})
                with self.assertRaises(ValueError): self.restore(parent=other)
                self.assertFalse(self.output.exists())
        with self.assertRaises(ValueError): self.restore(ids=['sha256:' + 'e' * 64])

    def test_parent_and_delta_tampering_fail_before_parsing_or_output(self):
        self.create()
        for target in [self.base, self.diff]:
            original = target.read_bytes(); target.write_bytes(original + b'tampered')
            with self.assertRaisesRegex(ValueError, 'fingerprint mismatch'): self.restore()
            self.assertFalse(self.output.exists()); target.write_bytes(original)

    def test_missing_and_extra_delta_files_are_rejected_even_with_updated_outer_hash(self):
        self.create(); reference = delta.read_json(self.ref)
        with tarfile.open(self.diff) as source:
            values = {member.name: source.extractfile(member).read() for member in source}
        for missing in [True, False]:
            changed = dict(values)
            if missing: changed.pop('oci-layout')
            else: changed['blobs/sha256/' + delta.sha(b'extra')] = b'extra'
            archive(self.diff, changed); reference['delta_archive'] = delta.file_info(self.diff)
            with self.assertRaisesRegex(ValueError, 'inventory differs'): self.restore(reference)
            self.assertFalse(self.output.exists())

    def test_bad_reused_blob_hash_and_path_cannot_be_hidden_by_archive_fingerprint(self):
        self.create(); reference = delta.read_json(self.ref)
        name = next(name for name, info in reference['files'].items() if info['source'] == 'base')
        corrupted = dict(self.base_files); corrupted[name] = b'corrupted'
        archive(self.base, corrupted); reference['base_archive'] = delta.file_info(self.base)
        with self.assertRaisesRegex(ValueError, 'blob filename/hash mismatch'): self.restore(reference)
        self.assertFalse(self.output.exists())

    def test_outer_tar_links_traversal_devices_duplicate_sparse_and_unknown_paths(self):
        cases = [('../escape', tarfile.REGTYPE), ('/escape', tarfile.REGTYPE), ('blobs/../escape', tarfile.REGTYPE),
                 ('blobs\\sha256\\x', tarfile.REGTYPE), ('repositories', tarfile.REGTYPE),
                 ('index.json', tarfile.SYMTYPE), ('index.json', tarfile.LNKTYPE), ('index.json', tarfile.CHRTYPE),
                 ('index.json', tarfile.FIFOTYPE), ('index.json', tarfile.GNUTYPE_SPARSE)]
        for name, kind in cases:
            with self.subTest(name=name, kind=kind):
                target = self.root / 'bad.tar'; item = tarfile.TarInfo(name); item.type = kind; item.linkname = '/escape'
                archive(target, {}, [(item, b'')])
                extracted = self.root / 'read'; extracted.mkdir(exist_ok=True)
                with self.assertRaises((ValueError, tarfile.TarError)): delta.read_archive(target, extracted)
        item = tarfile.TarInfo('index.json'); item.size = 2
        archive(self.root / 'duplicate.tar', {'index.json': b'{}'}, [(item, b'{}')])
        with tempfile.TemporaryDirectory(dir=self.root) as directory:
            with self.assertRaisesRegex(ValueError, 'Repeated'): delta.read_archive(self.root / 'duplicate.tar', Path(directory))

    def test_blob_hash_and_diff_id_and_descriptor_size_and_layer_order_and_platform(self):
        for kwargs, message in [({'wrong_diff': True}, 'diff_id'), ({'wrong_order': True}, 'layer order'),
                                ({'wrong_size': True}, 'size mismatch'), ({'platform': 'amd64'}, 'platform')]:
            with self.subTest(kwargs=kwargs):
                files, expected = images(new=True, **kwargs); archive(self.candidate, files)
                with tempfile.TemporaryDirectory(dir=self.root) as directory:
                    entries = delta.read_archive(self.candidate, Path(directory))
                    with self.assertRaisesRegex(ValueError, message): delta.validate_oci(entries, expected)
        corrupted = dict(self.files); name = next(name for name in corrupted if name.startswith('blobs/'))
        corrupted[name] = b'wrong'; archive(self.candidate, corrupted)
        with tempfile.TemporaryDirectory(dir=self.root) as directory:
            with self.assertRaisesRegex(ValueError, 'filename/hash'): delta.read_archive(self.candidate, Path(directory))

    def test_unreferenced_blob_and_duplicate_json_keys_are_rejected(self):
        changed = dict(self.files); changed['blobs/sha256/' + delta.sha(b'extra')] = b'extra'
        archive(self.candidate, changed)
        with tempfile.TemporaryDirectory(dir=self.root) as directory:
            with self.assertRaisesRegex(ValueError, 'Unreferenced'):
                delta.validate_oci(delta.read_archive(self.candidate, Path(directory)), self.ids)
        with self.assertRaisesRegex(ValueError, 'Duplicate JSON'): delta.json_bytes(b'{"format":1,"format":2}')

    def test_size_member_count_and_inflation_budgets_are_enforced(self):
        for setting, bound in [('MAX_TOTAL', 3), ('MAX_FILES', 1), ('MAX_MEMBER', 1)]:
            with tempfile.TemporaryDirectory(dir=self.root) as directory, patch.object(delta, setting, bound):
                with self.assertRaises(ValueError): delta.read_archive(self.candidate, Path(directory))
        with tempfile.TemporaryDirectory(dir=self.root) as directory:
            entries = delta.read_archive(self.candidate, Path(directory))
            with patch.object(delta, 'MAX_LAYER', 1):
                with self.assertRaisesRegex(ValueError, 'layer size limit'): delta.validate_oci(entries, self.ids)

    def test_padding_bomb_and_hidden_trailing_tar_members_do_not_escape_limits(self):
        bomb = self.root / 'padding.gz'; bomb.write_bytes(gzip.compress(b'\0' * 50000))
        with tempfile.TemporaryDirectory(dir=self.root) as directory, patch.object(delta, 'MAX_TOTAL', 1), patch.object(delta, 'MAX_FILES', 1):
            with self.assertRaisesRegex(ValueError, 'stream size limit'): delta.read_archive(bomb, Path(directory))
        tail = self.root / 'tail.tar'; archive(tail, {'../escape': b'not allowed'})
        hidden = self.root / 'hidden.tar'; hidden.write_bytes(self.candidate.read_bytes() + tail.read_bytes())
        with tempfile.TemporaryDirectory(dir=self.root) as directory:
            with self.assertRaisesRegex(ValueError, 'Unsafe'): delta.read_archive(hidden, Path(directory))

    def test_pax_and_gnu_long_headers_are_rejected_before_payload_allocation(self):
        for extension in [tarfile.XHDTYPE, tarfile.XGLTYPE, tarfile.SOLARIS_XHDTYPE, tarfile.GNUTYPE_LONGNAME, tarfile.GNUTYPE_LONGLINK]:
            header = tarfile.TarInfo('metadata'); header.type = extension; header.size = 1_000_000_000
            bad = self.root / 'header.tar'; bad.write_bytes(header.tobuf(format=tarfile.USTAR_FORMAT))
            with tempfile.TemporaryDirectory(dir=self.root) as directory:
                with self.assertRaisesRegex(ValueError, 'headers are forbidden'): delta.read_archive(bad, Path(directory))

    def test_references_cannot_chain_and_require_generation_and_strict_file_rules(self):
        self.create(); reference = delta.read_json(self.ref)
        for key, value in [('image_file', 'images.delta.tar.gz.age'), ('object_generation', ''), ('ciphertext_bytes', True)]:
            with self.assertRaises(ValueError): delta.parent_reference(dict(self.parent, **{key: value}))
        for mutation in [lambda value: value['files'].update({'../escape': next(iter(value['files'].values()))}),
                         lambda value: value['files']['index.json'].update(source='base')]:
            changed = copy.deepcopy(reference); mutation(changed)
            with self.assertRaises(ValueError): self.restore(changed)

    def test_symlinks_and_existing_output_are_never_followed_or_replaced(self):
        self.create(); self.output.write_bytes(b'keep')
        with self.assertRaises(FileExistsError): self.restore()
        self.assertEqual(self.output.read_bytes(), b'keep')
        link = self.root / 'base-link'; link.symlink_to(self.base)
        with self.assertRaises(OSError): delta.file_info(link)

    def test_owned_outputs_are_removed_when_metadata_or_final_hashing_fails(self):
        with patch.object(delta.json, 'dump', side_effect=OSError('fixture disk failure')):
            with self.assertRaises(OSError): self.create()
        self.assertFalse(self.diff.exists()); self.assertFalse(self.ref.exists())
        self.create(); original = delta.file_info
        def fingerprint(path):
            if Path(path) == self.output: raise OSError('fixture read failure')
            return original(path)
        with patch.object(delta, 'file_info', side_effect=fingerprint):
            with self.assertRaises(OSError): self.restore()
        self.assertFalse(self.output.exists())

    def test_output_padding_size_is_checked_before_creating_a_file(self):
        payload = self.root / 'payload'; payload.write_bytes(b'x')
        with patch.object(delta, 'MAX_ARCHIVE', 100):
            with self.assertRaisesRegex(ValueError, 'Output archive size'):
                delta.write_tar({'index.json': {'path': payload, 'bytes': 1}}, self.output)
        self.assertFalse(self.output.exists())

    def test_parent_ciphertext_mismatch_precedes_age_or_filesystem_plaintext(self):
        self.base.write_bytes(b'not expected')
        with patch.object(delta, 'decrypt') as decrypt:
            with self.assertRaisesRegex(ValueError, 'ciphertext fingerprint'):
                delta.reconstruct_encrypted(self.base, self.diff, self.ref, self.root / 'key', self.parent, self.ids, self.output, self.root, expected_parent_ids=self.base_ids)
            decrypt.assert_not_called()

    def test_authentication_failure_cannot_parse_partial_plaintext_or_leave_files(self):
        cipher = self.root / 'cipher.age'; cipher.write_bytes(b'ciphertext')
        key = self.root / 'key'; key.write_text('fixture'); key.chmod(0o600)
        age = self.root / 'fake-age'; age.write_text("#!/bin/sh\nprintf '{}'; exit 1\n"); age.chmod(0o700)
        info = delta.file_info(cipher)
        parent = dict(self.parent, ciphertext_bytes=info['bytes'], ciphertext_sha256=info['sha256'])
        with patch.object(delta, 'reconstruct') as reconstruct:
            with self.assertRaisesRegex(ValueError, 'authentication failed'):
                delta.reconstruct_encrypted(cipher, cipher, cipher, key, parent, self.ids, self.output, self.root, str(age), expected_parent_ids=self.base_ids)
            reconstruct.assert_not_called()
        self.assertFalse(self.output.exists())
        self.assertFalse(any(path.name.startswith('image-decrypt-') for path in self.root.iterdir()))


if __name__ == '__main__': unittest.main()
