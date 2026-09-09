import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('rollout', Path(__file__).with_name('rollout.py'))
r = importlib.util.module_from_spec(spec); spec.loader.exec_module(r)
OLD = 'sha256:' + 'a' * 64
NEW = 'sha256:' + 'b' * 64


class RolloutTests(unittest.TestCase):
    def test_manifest_rejects_mutable_unknown_and_equal_images(self):
        for images in ({'db': {'old': OLD, 'new': 'latest'}}, {'web': {'old': OLD, 'new': NEW}}, {'db': {'old': OLD, 'new': OLD}}):
            with self.subTest(images=images), self.assertRaises(ValueError): r.manifest({'format': 1, 'images': images})
        self.assertEqual(r.manifest({'format': 1, 'images': {'db': {'old': OLD, 'new': NEW}}})['images']['db']['new'], NEW)

    def test_stack_file_order_and_service_are_exact(self):
        container, service, project, root = r.TARGETS['db']
        labels = {'com.docker.compose.project': project, 'com.docker.compose.service': service,
                  'com.docker.compose.project.working_dir': root,
                  'com.docker.compose.project.config_files': ','.join(str(Path(root) / n) for n in r.COMPOSE_FILES[project])}
        live = {'Name': '/' + container, 'Config': {'Labels': labels}}
        self.assertEqual(len(r.checked_files('db', live)), 4)
        labels['com.docker.compose.project.config_files'] = labels['com.docker.compose.project.config_files'].split(',')[0]
        with self.assertRaises(ValueError): r.checked_files('db', live)

    def test_image_only_rejects_network_secret_or_other_service_change(self):
        before = {'services': {'db': {'image': OLD, 'environment': {'TEST': 'fixture'}, 'networks': ['private']}, 'rest': {'image': OLD}}}
        after = json.loads(json.dumps(before)); after['services']['db']['image'] = NEW
        r.image_only(before, after, 'db', NEW)
        for key, value in [('environment', {'TEST': 'changed'}), ('networks', ['public'])]:
            changed = json.loads(json.dumps(after)); changed['services']['db'][key] = value
            with self.assertRaises(ValueError): r.image_only(before, changed, 'db', NEW)
        after['services']['rest']['image'] = NEW
        with self.assertRaises(ValueError): r.image_only(before, after, 'db', NEW)

    def test_overlay_preserves_unrelated_settings(self):
        original = b'services:\n  rest:\n    read_only: true\n  db:\n    environment:\n      TEST: ${FIXTURE}\nnetworks:\n  private:\n    internal: true\n'
        expected = original.replace(b'  db:\n', b'  db:\n    image: ' + NEW.encode() + b'\n')
        self.assertEqual(r.replacement(original, 'db', NEW), expected)

    def test_atomic_replace_rejects_changed_or_symlink_source(self):
        with tempfile.TemporaryDirectory() as temporary:
            p = Path(temporary) / 'source'; p.write_bytes(b'newer')
            with self.assertRaises(ValueError): r.atomic_replace(p, b'old', b'candidate')
            self.assertEqual(p.read_bytes(), b'newer')
            link = Path(temporary) / 'link'; link.symlink_to(p)
            with self.assertRaises(ValueError): r.atomic_replace(link, b'newer', b'candidate')

    def test_unclean_shutdown_never_creates_physical_backup(self):
        commands = []
        def command(*args):
            commands.append(args)
            return b'Database cluster state: in production\n' if args[:2] == ('docker', 'run') else b''
        with tempfile.TemporaryDirectory() as temporary, patch.object(r, 'run', side_effect=command), patch.object(r, 'inspect', return_value={'State': {'Running': False}}):
            with self.assertRaises(RuntimeError): r.stopped_backup(Path(temporary), OLD, '100:101')
        self.assertFalse(any(c[0] == 'tar' for c in commands))
        self.assertIn('readonly', ' '.join(next(c for c in commands if c[:2] == ('docker', 'run'))))

    def test_private_write_cleans_failed_own_file_and_preserves_existing_file(self):
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary) / 'private'
            with patch.object(r.os, 'fsync', side_effect=OSError('injected fsync')):
                with self.assertRaises(OSError): r.private_write(target, b'partial')
            self.assertFalse(target.exists())
            target.write_bytes(b'unrelated')
            with self.assertRaises(FileExistsError): r.private_write(target, b'candidate')
            self.assertEqual(target.read_bytes(), b'unrelated')

    def test_atomic_replace_preserves_an_unowned_existing_temporary(self):
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary) / 'compose.yml'; source.write_bytes(b'original')
            unowned = source.with_name(source.name + '.runtime-image-new'); unowned.write_bytes(b'unrelated')
            with self.assertRaises(FileExistsError): r.atomic_replace(source, b'original', b'candidate')
            self.assertEqual(source.read_bytes(), b'original')
            self.assertEqual(unowned.read_bytes(), b'unrelated')

    def test_state_replace_failure_cleans_temporary_and_preserves_previous_state(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); r.record(root, status='prepared'); previous = (root / 'state.json').read_bytes()
            with patch.object(r.os, 'replace', side_effect=OSError('injected replace')):
                with self.assertRaises(OSError): r.record(root, status='stopped')
            self.assertFalse((root / 'state.next.json').exists())
            self.assertEqual((root / 'state.json').read_bytes(), previous)

    def test_db_stop_then_source_write_failure_restarts_old_without_second_write(self):
        for failure in ('chown', 'chmod', 'fsync', 'replace'):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary); stage = root / 'stage'; stage.mkdir()
                source = root / 'compose.yml'
                original = b'services:\n  db:\n    image: approved-old\n    read_only: true\n'; source.write_bytes(original)
                (root / '.env').write_text('FIXTURE=only-test\n')
                candidate_temp = source.with_name(source.name + '.runtime-image-new')
                commands = []; stopped = []; faults = []
                real_fsync = r.os.fsync; real_replace = r.os.replace
                def fail():
                    self.assertTrue(stopped, 'Failure must be injected after DB stop')
                    faults.append(failure); raise OSError('injected ' + failure)
                def fsync(fd):
                    if failure == 'fsync' and candidate_temp.exists(): fail()
                    return real_fsync(fd)
                def replace(src, dst):
                    if failure == 'replace' and Path(src) == candidate_temp: fail()
                    return real_replace(src, dst)
                def command(*args):
                    commands.append(args)
                    if args[:3] == ('docker', 'image', 'inspect'):
                        if '--format' in args: return OLD.encode()
                        return json.dumps([{'Id': args[3], 'Architecture': 'arm64', 'Os': 'linux'}]).encode()
                    if 'config' in args:
                        bodies = [Path(args[i + 1]).read_text() for i, arg in enumerate(args) if arg == '-f']
                        image = [line.split(': ', 1)[1] for body in bodies for line in body.splitlines() if line.startswith('    image: ')][-1]
                        return json.dumps({'services': {'db': {'image': image, 'read_only': True}}}).encode()
                    if 'SHOW server_version_num' in args: return b'170011\n'
                    if '--version' in args: return b'postgres (PostgreSQL) 17.11\n'
                    return b''
                live = {'Image': OLD, 'State': {'Health': {'Status': 'healthy'}}}
                with patch.dict(r.TARGETS, {'db': ('supabase-db', 'db', 'fixture', str(root))}), patch.object(r, 'inspect', return_value=live), patch.object(r, 'checked_files', return_value=[source]), patch.object(r, 'run', side_effect=command), patch.object(r, 'physical_backup', return_value='100:101'), patch.object(r, 'stopped_backup', side_effect=lambda *args: stopped.append(True)), patch.object(r, 'wait_healthy') as healthy, patch.object(r.os, 'fsync', side_effect=fsync), patch.object(r.os, 'replace', side_effect=replace), patch.object(r.os, 'chown', side_effect=lambda *args: fail() if failure == 'chown' else None), patch.object(r.os, 'chmod', side_effect=lambda *args: fail() if failure == 'chmod' else None):
                    with self.assertRaises(OSError): r.execute('db', {'old': OLD, 'new': NEW}, stage)
                self.assertEqual(faults, [failure], 'Recovery must not attempt a second source write')
                self.assertEqual(source.read_bytes(), original)
                self.assertFalse(candidate_temp.exists())
                healthy.assert_called_once_with('supabase-db', OLD)
                up = [c for c in commands if 'up' in c]
                self.assertEqual(len(up), 1)
                self.assertIn(str(stage / 'rollback-image.yml'), up[0])
                self.assertEqual(up[0][-1], 'db')
                state = json.loads((stage / 'state.json').read_text())
                self.assertEqual(state['status'], 'failed-old-image-restored')
                self.assertTrue(state['rollback_override_active'])
                self.assertFalse(state['source_repair_required'])
                self.assertFalse(any(c[0] in ('tar', 'rm') or 'pg_restore' in c for c in commands))

    def test_failed_candidate_restores_only_previous_image_and_source(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); stage = root / 'stage'; stage.mkdir()
            source = root / 'compose.yml'; original = b'services:\n  rest:\n    image: approved-old\n    read_only: true\n'; source.write_bytes(original)
            (root / '.env').write_text('FIXTURE=only-test\n'); commands = []
            def command(*args):
                commands.append(args)
                if args[:3] == ('docker', 'image', 'inspect'):
                    if '--format' in args: return OLD.encode()
                    return json.dumps([{'Id': args[3], 'Architecture': 'arm64', 'Os': 'linux'}]).encode()
                if 'config' in args:
                    bodies = [Path(args[i + 1]).read_text() for i, arg in enumerate(args) if arg == '-f']
                    image = [line.split(': ', 1)[1] for body in bodies for line in body.splitlines() if line.startswith('    image: ')][-1]
                    return json.dumps({'services': {'rest': {'image': image, 'read_only': True}}}).encode()
                return b''
            live = {'Image': OLD, 'State': {'Health': {'Status': 'healthy'}}}
            with patch.dict(r.TARGETS, {'rest': ('supabase-rest', 'rest', 'fixture', str(root))}), patch.object(r, 'inspect', return_value=live), patch.object(r, 'checked_files', return_value=[source]), patch.object(r, 'run', side_effect=command), patch.object(r, 'wait_healthy', side_effect=[RuntimeError('candidate failed'), None]), patch.object(r.os, 'chown'):
                with self.assertRaises(RuntimeError): r.execute('rest', {'old': OLD, 'new': NEW}, stage)
            self.assertEqual(source.read_bytes(), r.replacement(original, 'rest', OLD))
            self.assertEqual(json.loads((stage / 'state.json').read_text())['status'], 'failed-old-image-restored')
            up = [c for c in commands if 'up' in c]
            self.assertEqual(len(up), 2)
            self.assertTrue(all('--no-deps' in c and c[-1] == 'rest' for c in up))
            self.assertFalse(any(c[0] in ('tar', 'rm') or 'pg_restore' in c for c in commands))


if __name__ == '__main__': unittest.main()
