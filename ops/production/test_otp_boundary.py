#!/usr/bin/env python3
"""OTP rollout rejects drift and never recreates unrelated service configuration."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('otp_rollout', HERE / 'apply-otp-boundary.py')
rollout = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rollout)
assert_direct_internal_auth = rollout.assert_direct_internal_auth


class OtpRollout(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.state = self.root / 'state'
        self.state.mkdir()
        self.files = {}
        records = {'files': {}, 'guards': {'compose': 'current-image-pin'},
                   'kong': {'image': 'current-kong-image'},
                   'tools': {name: rollout.base.digest(HERE / name) for name in rollout.TOOLS}}
        for key in ['snippet', 'handler']:
            self.files[key] = self.root / key
            self.files[key].write_text('before-' + key)
            (self.state / (key + '.before')).write_text('before-' + key)
            (self.state / (key + '.candidate')).write_text('after-' + key)
            records['files'][key] = {'before': rollout.base.digest(self.files[key]),
                'candidate': rollout.base.digest(self.state / (key + '.candidate'))}
        (self.state / 'manifest.json').write_text(json.dumps(records))
        for name, value in [('FILES', self.files), ('guard_hashes', lambda: {'compose': 'current-image-pin'}),
                            ('service_identity', lambda: {'image': 'current-kong-image'}),
                            ('assert_direct_internal_auth', lambda: None)]:
            context = patch.object(rollout, name, value)
            context.start()
            self.addCleanup(context.stop)

    def test_drifted_live_compose_rejected_before_mutation(self):
        with patch.object(rollout, 'guard_hashes', return_value={'compose': 'new-image-pin'}), \
             patch.object(rollout.base, 'atomic_install') as install:
            with self.assertRaisesRegex(ValueError, 'Live configuration'):
                rollout.apply(self.state)
            install.assert_not_called()

    def test_changed_candidate_rejected_before_mutation(self):
        (self.state / 'handler.candidate').write_text('unreviewed')
        with patch.object(rollout.base, 'atomic_install') as install:
            with self.assertRaisesRegex(ValueError, 'candidate changed'):
                rollout.apply(self.state)
            install.assert_not_called()

    def test_apply_changes_only_ingress_and_restarts_existing_kong(self):
        with patch.object(rollout.base, 'validate_caddy'), patch.object(rollout.base, 'run') as run, \
             patch.object(rollout, 'reload_kong') as restart:
            rollout.apply(self.state)
        self.assertEqual(self.files['snippet'].read_text(), 'after-snippet')
        self.assertEqual(self.files['handler'].read_text(), 'after-handler')
        self.assertTrue((self.state / 'applied').exists())
        run.assert_called_once_with(['systemctl', 'reload', 'caddy'])
        restart.assert_called_once_with()

    def test_failed_restart_restores_both_previous_files(self):
        with patch.object(rollout.base, 'validate_caddy'), patch.object(rollout.base, 'run'), \
             patch.object(rollout, 'reload_kong', side_effect=[RuntimeError('fixture failure'), None]):
            with self.assertRaisesRegex(RuntimeError, 'previous ingress files restored'):
                rollout.apply(self.state)
        self.assertEqual(self.files['snippet'].read_text(), 'before-snippet')
        self.assertEqual(self.files['handler'].read_text(), 'before-handler')
        self.assertFalse((self.state / 'applied').exists())

    def test_gateway_url_cannot_replace_direct_internal_auth(self):
        with patch.object(rollout.base, 'inspect', return_value={'Config': {'Env': ['AUTH_URL=https://api.beanmap.site/auth/v1']}}):
            with self.assertRaisesRegex(ValueError, 'direct internal Auth'):
                assert_direct_internal_auth()


if __name__ == '__main__':
    unittest.main()
