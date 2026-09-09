import importlib.util
import io
import json
from pathlib import Path
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace
sys.path.insert(0, str(Path(__file__).parent))
import restore_drill as drill


class RestoreDrillTests(unittest.TestCase):
    def runtime(self):
        return [{'Name': '/' + name, 'Image': 'sha256:' + format(index + 1, '064x')} for index, name in enumerate(drill.backup.CONTAINERS)]

    def test_full_inventory_requires_all_services_and_immutable_ids(self):
        good = self.runtime()
        self.assertEqual(len(drill.runtime_images(good)), 8)
        for bad in [good[:-1], good + [good[0]], [good[0]] * 8, [dict(item, Image='latest') for item in good]]:
            with self.assertRaises(ValueError): drill.runtime_images(bad)

    def test_full_or_complete_delta_pair_are_mutually_exclusive(self):
        self.assertEqual(drill.image_components({'files': {'images.tar.gz.age': {}}}), ('full', 'images.tar.gz.age'))
        self.assertEqual(drill.image_components({'files': {'images.delta.tar.gz.age': {}, 'image-base.json.age': {}}}), ('delta', None))
        for names in [[], ['images.delta.tar.gz.age'], ['image-base.json.age'], ['images.tar.age', 'images.tar.gz.age'], ['images.tar.age', 'images.delta.tar.gz.age', 'image-base.json.age']]:
            with self.assertRaises(ValueError): drill.image_components({'files': dict.fromkeys(names, {})})

    def test_full_restore_checks_every_runtime_image_not_only_database(self):
        inventory = self.runtime()
        def inspect(command, *args, **kwargs):
            return json.dumps([{'Id': command[-1] if command[-1] != inventory[-1]['Image'] else 'sha256:' + 'f' * 64}]).encode()
        with patch.object(drill, 'load_verified_full_images', return_value={'images_verified': 8}), patch.object(drill, 'run', side_effect=inspect):
            with self.assertRaisesRegex(RuntimeError, 'runtime image identity'):
                drill.load_recovery_images(SimpleNamespace(age='age'), Path('/private/key'), Path('/private/bundle'), {'files': {'images.tar.gz.age': {}}}, inventory)

    def test_cached_runtime_images_cannot_hide_a_missing_full_archive_config(self):
        from test_image_delta import images, archive
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); files, ids = images(count=8)
            missing_config = json.loads(files['manifest.json'])[-1]['Config']
            files.pop(missing_config); source = root / 'missing-image.tar'; archive(source, files)
            inventory = [{'Name': '/' + name, 'Image': image} for name, image in zip(drill.backup.CONTAINERS, ids)]
            def decrypt(age, identity, encrypted, output):
                output.write_bytes(source.read_bytes())
            def cached(command):
                return json.dumps([{'Id': command[-1]}]).encode()
            with patch.object(drill.image_delta, 'decrypt', side_effect=decrypt), patch.object(drill, 'run', side_effect=cached) as cache, patch.object(drill.subprocess, 'run', return_value=SimpleNamespace(returncode=0)) as load:
                with self.assertRaisesRegex(ValueError, 'Missing OCI descriptor'):
                    drill.load_recovery_images(SimpleNamespace(age='age', image_workspace=root), root / 'key', root, {'files': {'images.tar.gz.age': {}}}, inventory)
                load.assert_not_called(); cache.assert_not_called()
            self.assertEqual(list(root.glob('restore-full-images-*')), [])

    def test_delta_must_cover_later_web_api_changes_before_loading_anything(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); parent = root / 'backup-20260909T040802Z-e55a4bc5'; parent.mkdir()
            (parent / 'manifest.json').write_text('{}')
            receipt = {'backup_name': parent.name, 'image_file': 'images.tar.gz.age', 'ciphertext_bytes': 123,
                       'ciphertext_sha256': 'a' * 64, 'manifest_sha256': drill.backup.digest(parent / 'manifest.json'),
                       'object_generation': '123', 'manifest_generation': '124'}
            receipt_path = root / 'receipt.json'; receipt_path.write_text(json.dumps(receipt))
            before = self.runtime(); after = self.runtime(); after[0]['Image'] = 'sha256:' + 'b' * 64; after[4]['Image'] = 'sha256:' + 'c' * 64
            args = SimpleNamespace(age='age', parent_bundle=parent, parent_receipt=receipt_path, image_workspace=root,
                                   expected_delta_image_id=[after[0]['Image']])
            parent_manifest = {'files': {'images.tar.gz.age': {'bytes': 123, 'sha256': 'a' * 64}}}
            with patch.object(drill.backup, 'validate', return_value=parent_manifest), patch.object(drill, 'decrypt', return_value=json.dumps(before).encode()), patch.object(drill, 'load_images') as load, patch.object(drill.image_delta, 'reconstruct_encrypted') as reconstruct:
                with self.assertRaisesRegex(ValueError, 'every changed runtime'):
                    drill.load_recovery_images(args, root / 'key', root, {'files': {'images.delta.tar.gz.age': {}, 'image-base.json.age': {}}}, after)
                load.assert_not_called(); reconstruct.assert_not_called()

    def test_delta_verification_precedes_all_loads_and_failure_leaves_no_output(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); parent = root / 'backup-20260909T040802Z-e55a4bc5'; parent.mkdir()
            (parent / 'manifest.json').write_text('{}')
            receipt = {'backup_name': parent.name, 'image_file': 'images.tar.gz.age', 'ciphertext_bytes': 123,
                       'ciphertext_sha256': 'a' * 64, 'manifest_sha256': drill.backup.digest(parent / 'manifest.json'),
                       'object_generation': '123', 'manifest_generation': '124'}
            receipt_path = root / 'receipt.json'; receipt_path.write_text(json.dumps(receipt))
            before = self.runtime(); after = self.runtime(); after[0]['Image'] = 'sha256:' + 'b' * 64
            args = SimpleNamespace(age='age', parent_bundle=parent, parent_receipt=receipt_path, image_workspace=root,
                                   expected_delta_image_id=[after[0]['Image']])
            parent_manifest = {'files': {'images.tar.gz.age': {'bytes': 123, 'sha256': 'a' * 64}}}
            current = {'files': {'images.delta.tar.gz.age': {}, 'image-base.json.age': {}}}
            events = []
            def reconstruct(*arguments, **kwargs):
                self.assertEqual(kwargs['expected_parent_ids'], [item['Image'] for item in before])
                events.append('verified'); arguments[6].write_bytes(b'verified archive fixture')
                return {'files_verified': 7, 'parent_images_verified': 8}
            def inspect(command):
                return json.dumps([{'Id': command[-1]}]).encode()
            with patch.object(drill.backup, 'validate', return_value=parent_manifest), patch.object(drill, 'decrypt', return_value=json.dumps(before).encode()), patch.object(drill.image_delta, 'reconstruct_encrypted', side_effect=reconstruct), patch.object(drill, 'load_images', side_effect=lambda *args: events.append('parent-load')), patch.object(drill.subprocess, 'run', side_effect=lambda *args, **kwargs: (events.append('delta-load') or SimpleNamespace(returncode=0))), patch.object(drill, 'run', side_effect=inspect):
                result = drill.load_recovery_images(args, root / 'key', root, current, after)
            self.assertEqual(events, ['verified', 'parent-load', 'delta-load'])
            self.assertEqual(result['runtime_images_verified'], 8)
            self.assertEqual(result['changed_runtime_images'], 1)
            self.assertFalse(any(path.name.startswith('restore-image-delta-') for path in root.iterdir()))
            with patch.object(drill.backup, 'validate', return_value=parent_manifest), patch.object(drill, 'decrypt', return_value=json.dumps(before).encode()), patch.object(drill.image_delta, 'reconstruct_encrypted', side_effect=ValueError('Bad digest')), patch.object(drill, 'load_images') as load:
                with self.assertRaises(ValueError): drill.load_recovery_images(args, root / 'key', root, current, after)
                load.assert_not_called()
            with patch.object(drill.backup, 'validate', return_value=current), patch.object(drill, 'load_images') as load:
                with self.assertRaisesRegex(ValueError, 'cannot themselves'): drill.load_recovery_images(args, root / 'key', root, current, after)
                load.assert_not_called()

    def test_authorization_precedes_all_io(self):
        with patch.object(drill, 'validate_identity') as check:
            with self.assertRaises(ValueError): drill.drill(SimpleNamespace(approved_production_restore=False))
            check.assert_not_called()

    def test_identity_permissions_and_symlink(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'key'; path.write_text('fixture'); path.chmod(0o600)
            drill.validate_identity(path)
            path.chmod(0o644)
            with self.assertRaises(ValueError): drill.validate_identity(path)
            link = Path(temp) / 'link'; link.symlink_to(path)
            with self.assertRaises(ValueError): drill.validate_identity(link)

    def test_only_exact_existing_bootstrap_create_removed(self):
        source = b'CREATE ROLE postgres;\nCREATE ROLE supabase_admin;\nALTER ROLE supabase_admin SUPERUSER;\nGRANT postgres TO supabase_admin GRANTED BY supabase_admin;\n'
        result = drill.restore_roles(source)
        self.assertEqual(result, source.replace(b'CREATE ROLE supabase_admin;\n', b''))
        for invalid in (b'', source + b'CREATE ROLE supabase_admin;\n'):
            with self.assertRaises(ValueError): drill.restore_roles(invalid)

    def test_image_requires_exact_single_immutable_database(self):
        good = {'Name': '/supabase-db', 'Image': 'sha256:' + 'a'*64}
        self.assertEqual(drill.database_image([good]), good['Image'])
        for inventory in ([], [good, good], [{'Name': '/supabase-db', 'Image': 'postgres:latest'}]):
            with self.assertRaises(ValueError): drill.database_image(inventory)

    def test_config_traversal_links_devices_duplicates_rejected(self):
        for bad in ('../escape', '/escape', 'symlink', 'device', 'duplicate'):
            with self.subTest(bad=bad):
                output = io.BytesIO()
                with tarfile.open(fileobj=output, mode='w') as archive:
                    key = tarfile.TarInfo('./pgsodium_root.key'); key.size=1
                    archive.addfile(key, io.BytesIO(b'x'))
                    item = tarfile.TarInfo('./pgsodium_root.key' if bad=='duplicate' else bad)
                    if bad == 'symlink': item.type=tarfile.SYMTYPE; item.linkname='/escape'
                    if bad == 'device': item.type=tarfile.CHRTYPE
                    archive.addfile(item)
                with self.assertRaises(ValueError): drill.check_config_archive(output.getvalue())

    def test_copy_fingerprint_checks_content_empty_tables_and_escaping(self):
        data = b'COPY auth.users (id, value) FROM stdin;\n1\tsecret\\nnot-another-row\n\\.\nCOPY public.empty (id) FROM stdin;\n\\.\n'
        fingerprints = drill.copy_fingerprints(data)
        self.assertEqual(fingerprints[b'auth.users'][0], 1)
        self.assertEqual(fingerprints[b'public.empty'][0], 0)
        self.assertNotEqual(fingerprints, drill.copy_fingerprints(data.replace(b'secret', b'changed')))
        for malformed in (b'', data[:-3], data + data):
            with self.assertRaises(ValueError): drill.copy_fingerprints(malformed)

    def test_copy_fingerprints_ignore_order_but_preserve_duplicates(self):
        prefix = b'COPY auth.audit_log_entries (id) FROM stdin;\n'
        first = prefix + b'one\ntwo\none\n\\.\n'
        reordered = prefix + b'two\none\none\n\\.\n'
        changed = prefix + b'two\none\ntwo\n\\.\n'
        self.assertEqual(drill.copy_fingerprints(first), drill.copy_fingerprints(reordered))
        self.assertNotEqual(drill.copy_fingerprints(first), drill.copy_fingerprints(changed))
        missing = prefix + b'one\ntwo\n\\.\n'
        extra = prefix + b'one\ntwo\none\none\n\\.\n'
        self.assertNotEqual(drill.copy_fingerprints(first), drill.copy_fingerprints(missing))
        self.assertNotEqual(drill.copy_fingerprints(first), drill.copy_fingerprints(extra))

    def test_remote_docker_endpoint_rejected(self):
        with patch.dict('os.environ', {}, clear=True), patch.object(drill, 'run', return_value=json.dumps([{'Endpoints':{'docker':{'Host':'ssh://production'}}}]).encode()):
            with self.assertRaises(ValueError): drill.validate_local_engine()
        with patch.dict('os.environ', {'DOCKER_HOST':'unix:///tmp/other'}):
            with self.assertRaises(ValueError): drill.validate_local_engine()

    def test_fresh_database_uses_no_network_or_published_ports(self):
        database = drill.OfflineDatabase('sha256:' + 'a'*64)
        def result(command, *args, **kwargs):
            return b'1' if 'psql' in command else b''
        with patch.object(drill, 'run', side_effect=result) as run:
            database.create(b'fixture-config')
        commands = [call.args[0] for call in run.call_args_list]
        docker_runs = [command for command in commands if command[:2] == ['docker','run']]
        self.assertEqual(len(docker_runs), 2)
        for command in docker_runs:
            self.assertEqual(command[command.index('--network') + 1], 'none')
            self.assertIn('--read-only', command)
            self.assertIn('--cap-drop', command)
            self.assertNotIn('-p', command)
            self.assertNotIn('--publish', command)
        prep = docker_runs[0][-1]
        self.assertLess(prep.index('chmod 700'), prep.index('chown -R'))
        server = docker_runs[-1]
        self.assertIn('max_worker_processes=0', server[-1])
        self.assertTrue(any('postgresql-custom,readonly' in value for value in server))
        self.assertNotIn('POSTGRES_PASSWORD', ' '.join(server))

    def test_sequence_state_changes_are_detected(self):
        first = b"SELECT pg_catalog.setval('public.id_seq', 4, true);\n"
        second = b"SELECT pg_catalog.setval('public.id_seq', 5, true);\n"
        self.assertNotEqual(drill.sequence_states(first), drill.sequence_states(second))

    def test_report_is_private_and_never_overwrites_existing_files(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'report.json'
            drill.write_report(path, {'status': 'passed'})
            self.assertEqual(json.loads(path.read_text()), {'status': 'passed'})
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            with self.assertRaises(FileExistsError): drill.write_report(path, {})
            link = Path(temp) / 'symlink.json'; link.symlink_to(path)
            with self.assertRaises(FileExistsError): drill.write_report(link, {})

    def test_cleanup_refuses_foreign_volume(self):
        database=drill.OfflineDatabase('sha256:'+'a'*64); database.volumes=['foreign']
        with patch.object(drill, 'run', return_value=b'{}') as run:
            with self.assertRaises(RuntimeError): database.close()
            self.assertEqual(run.call_count,1)


if __name__ == '__main__': unittest.main()
