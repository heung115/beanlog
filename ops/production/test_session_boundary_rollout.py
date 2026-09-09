#!/usr/bin/env python3
"""Pure preparation checks: no Docker, network, locks, or database mutation."""
import copy
import importlib.util
from pathlib import Path
import tempfile
from types import SimpleNamespace
from unittest.mock import patch
import unittest

spec = importlib.util.spec_from_file_location('rollout', Path(__file__).with_name('session-boundary-rollout.py'))
rollout = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rollout)


class RolloutTests(unittest.TestCase):
    def source(self, directory):
        source = Path(directory)
        (source / 'supabase/migrations').mkdir(parents=True)
        (source / 'scripts').mkdir()
        for prefix in rollout.MIGRATIONS:
            (source / 'supabase/migrations' / (prefix + 'test.sql')).write_text('-- explanation\nbegin;\nselect 1;\ncommit;\n')
        (source / 'scripts/verify-function-acls.sql').write_text('select 2;')
        return source

    def test_single_atomic_transaction_and_ledger(self):
        with tempfile.TemporaryDirectory() as directory:
            source = self.source(directory)
            sql = rollout.transaction_sql(source, {}, "a" * 64)
            self.assertEqual(sql.splitlines().count('begin;'), 1)
            self.assertEqual(sql.splitlines().count('commit;'), 1)
            self.assertEqual(sql.count('insert into beanmap_security.release_migrations'), len(rollout.MIGRATIONS))
            self.assertLess(sql.index('select 2;'), sql.index('commit;'))

    def test_signup_key_is_private_formatted_and_never_implicitly_rotated(self):
        for key in ('', 'a' * 63, 'A' * 64, 'a' * 65, "'; select 1; --"):
            with self.subTest(key_length=len(key)), self.assertRaises(ValueError):
                rollout.signup_key_sql(key)
        sql = rollout.signup_key_sql('a' * 64)
        self.assertIn('explicit rotation required', sql)
        self.assertIn('on conflict (id) do nothing', sql)
        self.assertNotIn('do update', sql.lower())

    def test_resume_requires_complete_matching_checksums(self):
        with tempfile.TemporaryDirectory() as directory:
            source = self.source(directory)
            applied = {name: checksum for name, checksum, _ in rollout.migration_sources(source)}
            sql = rollout.transaction_sql(source, applied, "a" * 64)
            self.assertNotIn('select 1;', sql)
            self.assertIn('select 2;', sql)
            applied.pop(next(iter(applied)))
            with self.assertRaises(ValueError):
                rollout.transaction_sql(source, applied, "a" * 64)

    def test_modified_migration_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            source = self.source(directory)
            applied = {name: checksum for name, checksum, _ in rollout.migration_sources(source)}
            name = next(iter(applied))
            (source / 'supabase/migrations' / name).write_text('begin;\nselect 3;\ncommit;\n')
            with self.assertRaises(ValueError):
                rollout.transaction_sql(source, applied, "a" * 64)

    def test_multiple_or_external_transactions_are_rejected(self):
        for sql in ('begin;\ncommit;\nbegin;\ncommit;', 'select 4;\nbegin;\ncommit;', 'begin;\ncommit;\nselect 4;'):
            with self.subTest(sql=sql), tempfile.TemporaryDirectory() as directory:
                source = self.source(directory)
                (source / 'supabase/migrations/00029_test.sql').write_text(sql)
                with self.assertRaises(ValueError):
                    rollout.migration_sources(source)

    def configs(self):
        before = {'name': 'beanlogapp', 'services': {'web': {'networks': {'auth-client-ip': {'ipv4_address': '172.31.240.2'}}, 'read_only': True}, 'api': {'environment': {'PORT': '8080'}, 'secrets': [{'source': 'database', 'target': 'database'}], 'read_only': True}}, 'secrets': {'database': {'file': '/root/private'}}}
        after = copy.deepcopy(before)
        after['services']['api']['environment'].update(AUTH_URL='http://supabase-auth:9999', AUTH_RATE_ID_SECRET_FILE='/run/secrets/auth_rate_id')
        after['services']['api']['secrets'].append({'source': 'auth_rate_id', 'target': '/run/secrets/auth_rate_id'})
        after['secrets']['auth_rate_id'] = {'name': 'beanlogapp_auth_rate_id', 'file': str(rollout.SECRET)}
        after['services']['web']['environment'] = {'SIGNUP_CONSENT_SECRET_FILE': '/run/secrets/signup_consent'}
        after['services']['web']['secrets'] = [{'source': 'signup_consent', 'target': '/run/secrets/signup_consent'}]
        after['secrets']['signup_consent'] = {'name': 'beanlogapp_signup_consent', 'file': str(rollout.SIGNUP_SECRET)}
        return before, after

    def test_only_expected_config_additions_and_resume_pass(self):
        before, after = self.configs()
        rollout.verify_overlay(before, after)
        rollout.verify_overlay(after, copy.deepcopy(after))


    def test_ci_identity_success_and_stale_or_unverified_releases_fail(self):
        sha = 'a' * 40
        good_run = {'head_sha': sha, 'head_branch': 'main', 'event': 'push',
                    'path': '.github/workflows/ci-cd.yml',
                    'repository': {'full_name': 'heung115/beanlog'}}
        good_jobs = {'jobs': [{'name': 'Verify', 'status': 'completed', 'conclusion': 'success'}]}
        for bad in (None, 'branch', 'sha', 'workflow', 'repository', 'job', 'main'):
            with self.subTest(case=bad), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                (root / 'release.json').write_text('{"sha":"' + sha + '","run_id":123}')
                (root / 'deployed-sha').write_text('b' * 40)
                run, jobs = copy.deepcopy(good_run), copy.deepcopy(good_jobs)
                if bad == 'branch': run['head_branch'] = 'feature'
                if bad == 'sha': run['head_sha'] = 'c' * 40
                if bad == 'workflow': run['path'] = '.github/workflows/other.yml'
                if bad == 'repository': run['repository']['full_name'] = 'other/beanlog'
                if bad == 'job': jobs['jobs'][0]['conclusion'] = 'failure'
                operator = object.__new__(rollout.Rollout)
                operator.directory = root
                operator.github = lambda path: jobs if '/jobs?' in path else run
                commands = []
                def execute(args, **kwargs):
                    commands.append(args)
                    if 'rev-parse' in args:
                        return 'c' * 40 if bad == 'main' else sha
                    return ''
                operator.run = execute
                with patch.object(rollout, 'STATE', root), patch.object(Path, 'lstat', return_value=SimpleNamespace(st_uid=0, st_mode=0o100600)):
                    if bad:
                        with self.assertRaises(ValueError): operator.verified_release()
                    else:
                        self.assertEqual(operator.verified_release(), sha)
                        self.assertTrue(any('merge-base' in command for command in commands))
                self.assertFalse(any('docker' in command for command in commands))

    def test_network_secret_and_security_changes_fail(self):
        for kind in ('network', 'secret', 'read_only'):
            with self.subTest(kind=kind):
                before, after = self.configs()
                if kind == 'network':
                    after['services']['web']['networks']['auth-client-ip']['ipv4_address'] = '172.31.240.3'
                elif kind == 'secret':
                    after['services']['web']['secrets'] = [{'source': 'auth_rate_id', 'target': '/run/secrets/auth_rate_id'}]
                else:
                    after['services']['api']['read_only'] = False
                with self.assertRaises(ValueError):
                    rollout.verify_overlay(before, after)


if __name__ == '__main__':
    unittest.main()
