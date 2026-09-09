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
