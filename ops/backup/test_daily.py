import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('daily', Path(__file__).with_name('daily.py'))
daily = importlib.util.module_from_spec(spec); spec.loader.exec_module(daily)


class DailyTests(unittest.TestCase):
    def invoke(self, root, states):
        return patch.multiple(daily.gcs, config=lambda path: {}, remote_status=lambda settings: next(states))

    def test_fresh_check_clears_previous_failure_without_copying(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); (root / 'last-status.json').write_text('{"status":"failed"}')
            states = iter([{'status': 'fresh', 'within_rpo': True, 'age_hours': 22.99}])
            with patch('sys.argv', ['daily.py', '--config-directory', str(root), '--approved-gcp-backup']), self.invoke(root, states), patch.object(daily.subprocess, 'check_output') as capture, patch('sys.stdout', new_callable=io.StringIO):
                self.assertEqual(daily.main(), 0); capture.assert_not_called()
            state = json.loads((root / 'last-status.json').read_text())
            self.assertEqual(state['status'], 'fresh'); self.assertIn('checked_at', state)
            self.assertEqual((root / 'last-status.json').stat().st_mode & 0o777, 0o600)
            self.assertFalse((root / 'last-status.json.new').exists())

    def test_23_hour_threshold_and_missing_copy_then_verify(self):
        for first in [{'status': 'fresh', 'within_rpo': True, 'age_hours': 23}, {'status': 'missing', 'within_rpo': False}]:
            with self.subTest(first=first), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                states = iter([first, {'status': 'fresh', 'within_rpo': True, 'age_hours': 0}])
                with patch('sys.argv', ['daily.py', '--config-directory', str(root), '--approved-gcp-backup']), self.invoke(root, states), patch.object(daily.subprocess, 'check_output', return_value=b'{"backup":"backup-20260909T000000Z-00000000"}') as capture, patch.object(daily.gcs.backup, 'configurations', return_value={'destination': str(root)}), patch.object(daily.gcs, 'upload', return_value={'bytes': 100}) as upload, patch('sys.stdout', new_callable=io.StringIO):
                    self.assertEqual(daily.main(), 0); capture.assert_called_once(); upload.assert_called_once()
                self.assertEqual(json.loads((root / 'last-status.json').read_text())['age_hours'], 0)

    def test_remote_failure_is_recorded_without_capture(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            with patch('sys.argv', ['daily.py', '--config-directory', str(root), '--approved-gcp-backup']), patch.object(daily.gcs, 'config', return_value={}), patch.object(daily.gcs, 'remote_status', side_effect=ValueError('private detail')), patch.object(daily.subprocess, 'check_output') as capture, patch('sys.stderr', new_callable=io.StringIO):
                self.assertEqual(daily.main(), 1); capture.assert_not_called()
            state = json.loads((root / 'last-status.json').read_text())
            self.assertEqual(state['status'], 'failed'); self.assertNotIn('private detail', str(state))


if __name__ == '__main__': unittest.main()
