import datetime as dt
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('backup', Path(__file__).with_name('backup.py'))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class BackupTests(unittest.TestCase):
    def fixture(self, directory, created=None):
        for name in ('database.dump.age', 'roles.sql.age'):
            (directory / name).write_bytes(b'ciphertext-test-only')
        manifest = {'format': 1, 'created_at': (created or backup.now()).isoformat(),
                    'recovery_scope': 'database-and-roles',
                    'files': {name: {'bytes': (directory / name).stat().st_size, 'sha256': backup.digest(directory / name)} for name in ('database.dump.age', 'roles.sql.age')}}
        (directory / 'manifest.json').write_text(json.dumps(manifest))
        return manifest

    def test_corrupt_missing_or_added_component_is_rejected(self):
        for change in ('corrupt', 'missing', 'added'):
            with self.subTest(change=change), tempfile.TemporaryDirectory() as temp:
                directory = Path(temp); self.fixture(directory)
                backup.validate(directory)
                if change == 'corrupt': (directory / 'database.dump.age').write_bytes(b'wrong')
                elif change == 'missing': (directory / 'roles.sql.age').unlink()
                else: (directory / 'unexpected').write_text('bad')
                with self.assertRaises(ValueError): backup.validate(directory)

    def test_serve_configuration_component_is_authenticated_and_not_node_state(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp); manifest = self.fixture(directory)
            name = 'tailscale-serve.json.age'
            (directory / name).write_bytes(b'encrypted-serve-declarations')
            manifest['files'][name] = {'bytes': (directory / name).stat().st_size,
                                       'sha256': backup.digest(directory / name)}
            (directory / 'manifest.json').write_text(json.dumps(manifest))
            self.assertEqual(backup.validate(directory), manifest)
            (directory / name).write_bytes(b'tampered-serve-declarations')
            with self.assertRaises(ValueError): backup.validate(directory)
            self.assertNotIn('tailscaled.state', backup.COMPONENTS)

    def test_complete_archive_roundtrip(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); source = root / 'source'; target = root / 'target'
            source.mkdir(); target.mkdir(); expected = self.fixture(source)
            stream = io.BytesIO()
            with tarfile.open(fileobj=stream, mode='w') as archive:
                for path in source.iterdir(): archive.add(path, arcname=path.name)
            stream.seek(0); backup.unpack(stream, target, 100000)
            self.assertEqual(backup.validate(target), expected)

    def test_archive_traversal_link_duplicate_and_size_rejected(self):
        for kind in ('traversal', 'link', 'duplicate', 'size'):
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as temp:
                stream = io.BytesIO()
                with tarfile.open(fileobj=stream, mode='w') as archive:
                    item = tarfile.TarInfo('../escape' if kind == 'traversal' else 'database.dump.age')
                    item.size = 3
                    if kind == 'link': item.type = tarfile.SYMTYPE; item.linkname = '/tmp/escape'
                    archive.addfile(item, io.BytesIO(b'abc'))
                    if kind == 'duplicate': archive.addfile(item, io.BytesIO(b'abc'))
                stream.seek(0)
                with self.assertRaises(ValueError): backup.unpack(stream, Path(temp), 2 if kind == 'size' else 100000)

    def test_retention_preserves_two_newest_and_unknown_data(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); old = backup.now() - dt.timedelta(days=60)
            for index in range(4):
                folder = root / f'backup-2026010{index + 1}T000000Z-00000000'; folder.mkdir()
                self.fixture(folder, old)
            (root / 'unrelated').mkdir(); (root / '.partial-abandoned').mkdir()
            backup.prune(root, 30)
            self.assertEqual(len(list(root.glob('backup-*'))), 2)
            self.assertTrue((root / 'unrelated').exists())
            self.assertTrue((root / '.partial-abandoned').exists())

    def test_directory_symlink_and_open_permissions_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); destination = root / 'backup'; destination.mkdir(mode=0o755)
            destination.chmod(0o755)
            with self.assertRaises(ValueError): backup.private_directory(destination)
            destination.chmod(0o700); backup.private_directory(destination)
            link = root / 'link'; link.symlink_to(destination, target_is_directory=True)
            with self.assertRaises(ValueError): backup.private_directory(link)

    def test_production_pull_requires_explicit_authorization_before_any_io(self):
        from types import SimpleNamespace
        with patch.object(backup, 'configurations') as config:
            with self.assertRaises(ValueError): backup.pull(SimpleNamespace(approved_production_transfer=False))
            config.assert_not_called()

    def test_expired_or_future_backup_fails_rpo_check(self):
        from types import SimpleNamespace
        for offset in (-48, 2):
            with self.subTest(offset=offset), tempfile.TemporaryDirectory() as temp:
                root = Path(temp); directory = root / 'backup-20260909T000000Z-00000000'; directory.mkdir()
                self.fixture(directory, backup.now() + dt.timedelta(hours=offset))
                with patch.object(backup, 'configurations', return_value={'destination': str(root), 'rpo_hours': 24}), patch('sys.stdout', new_callable=io.StringIO):
                    self.assertEqual(backup.status(SimpleNamespace(config='unused')), 2)


if __name__ == '__main__':
    unittest.main()
