#!/usr/bin/env python3
"""OTP rollout rejects drift and never recreates unrelated service configuration."""
import importlib.util
import json
import os
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
             patch.object(rollout, 'atomic_install') as install:
            with self.assertRaisesRegex(ValueError, 'Live configuration'):
                rollout.apply(self.state)
            install.assert_not_called()

    def test_changed_candidate_rejected_before_mutation(self):
        (self.state / 'handler.candidate').write_text('unreviewed')
        with patch.object(rollout, 'atomic_install') as install:
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

    def test_install_failures_clean_own_temp_and_restore_both_files(self):
        for operation, fail_at, after_replace in [('copyfileobj', 2, False), ('fchmod', 2, False),
                ('fchown', 2, False), ('replace', 2, False), ('replace', 2, True),
                ('fsync', 3, False), ('fsync', 4, False)]:
            with self.subTest(operation=operation, fail_at=fail_at, after_replace=after_replace):
                module = rollout.shutil if operation == 'copyfileobj' else rollout.os
                original = getattr(module, operation)
                calls = 0
                def fail_second(*args, **kwargs):
                    nonlocal calls
                    calls += 1
                    if calls == fail_at:
                        if after_replace:
                            original(*args, **kwargs)
                        raise OSError('injected installation failure')
                    return original(*args, **kwargs)
                with patch.object(module, operation, side_effect=fail_second), \
                     patch.object(rollout.base, 'validate_caddy'), patch.object(rollout.base, 'run'), \
                     patch.object(rollout, 'reload_kong'):
                    with self.assertRaisesRegex(RuntimeError, 'previous ingress files restored'):
                        rollout.apply(self.state)
                for key, path in self.files.items():
                    self.assertEqual(path.read_text(), 'before-' + key)
                self.assertEqual(list(self.root.glob('*.otp-boundary-candidate')), [])
                self.assertFalse((self.state / 'applied').exists())

    def test_atomic_install_preserves_live_mode_and_owner(self):
        target = self.files['snippet']
        target.chmod(0o640)
        before = target.stat()
        rollout.atomic_install(self.state / 'snippet.candidate', target)
        after = target.stat()
        self.assertEqual((after.st_mode, after.st_uid, after.st_gid),
                         (before.st_mode, before.st_uid, before.st_gid))
        self.assertEqual(target.read_text(), 'after-snippet')

    def test_preexisting_temporary_is_never_deleted_and_prior_file_restores(self):
        temporary = self.files['handler'].with_name('handler.otp-boundary-candidate')
        temporary.write_text('unrelated work')
        with patch.object(rollout.base, 'validate_caddy'), patch.object(rollout.base, 'run'), \
             patch.object(rollout, 'reload_kong'):
            with self.assertRaisesRegex(RuntimeError, 'previous ingress files restored'):
                rollout.apply(self.state)
        self.assertEqual(temporary.read_text(), 'unrelated work')
        for key, path in self.files.items():
            self.assertEqual(path.read_text(), 'before-' + key)

    def test_cleanup_preserves_replacement_of_its_temporary(self):
        temporary = self.files['snippet'].with_name('snippet.otp-boundary-candidate')
        displaced = self.root / 'displaced-owned-temp'
        def replace_owner(*unused):
            temporary.rename(displaced)
            temporary.write_text('unrelated replacement')
            raise OSError('simulated competing replacement')
        with patch.object(rollout.os, 'fchmod', side_effect=replace_owner):
            with self.assertRaises(OSError):
                rollout.atomic_install(self.state / 'snippet.candidate', self.files['snippet'])
        self.assertEqual(temporary.read_text(), 'unrelated replacement')
        self.assertEqual(self.files['snippet'].read_text(), 'before-snippet')

    def test_rollback_service_failure_is_reported_as_incomplete(self):
        with patch.object(rollout.base, 'validate_caddy'), patch.object(rollout.base, 'run'), \
             patch.object(rollout, 'reload_kong', side_effect=RuntimeError('unhealthy')):
            with self.assertRaisesRegex(RuntimeError, 'rollback incomplete') as error:
                rollout.apply(self.state)
        self.assertNotIn('files restored', str(error.exception))

    def test_deploy_locks_are_nonblocking_and_partial_acquisition_releases(self):
        paths = (self.root / 'deploy.lock', self.root / 'deploy-execution.lock')
        with patch.object(rollout, 'LOCKS', paths):
            for occupied in paths:
                fd = os.open(occupied, os.O_WRONLY | os.O_CREAT, 0o600)
                try:
                    rollout.fcntl.flock(fd, rollout.fcntl.LOCK_EX | rollout.fcntl.LOCK_NB)
                    with self.assertRaises(BlockingIOError):
                        with rollout.deployment_locks():
                            self.fail('contending operation entered')
                finally:
                    os.close(fd)
                with rollout.deployment_locks():
                    pass

    def test_main_holds_both_deployment_locks_during_prepare_and_apply(self):
        paths = (self.root / 'deploy.lock', self.root / 'deploy-execution.lock')
        def check_locked(unused):
            for path in paths:
                fd = os.open(path, os.O_WRONLY)
                try:
                    with self.assertRaises(BlockingIOError):
                        rollout.fcntl.flock(fd, rollout.fcntl.LOCK_EX | rollout.fcntl.LOCK_NB)
                finally:
                    os.close(fd)
        for operation in ['prepare', 'apply']:
            with self.subTest(operation=operation), patch.object(rollout, 'LOCKS', paths), \
                 patch.object(rollout.os, 'geteuid', return_value=0), \
                 patch.object(rollout, operation, side_effect=check_locked) as action, \
                 patch('sys.argv', ['apply-otp-boundary.py', operation, '--state-dir', str(self.root / 'new')]):
                rollout.main()
            action.assert_called_once()


if __name__ == '__main__':
    unittest.main()
