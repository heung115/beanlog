#!/usr/bin/env python3
import importlib.util
import json
from pathlib import Path
import unittest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('signup_boundary', HERE / 'prepare-signup-boundary.py')
boundary = importlib.util.module_from_spec(spec)
spec.loader.exec_module(boundary)

class SignupBoundary(unittest.TestCase):
    def test_exact_web_source_is_required_and_other_policy_is_preserved(self):
        service = '  - name: auth-v1\n    plugins:\n      - name: beanmap-auth-budgets\n        config:\n          scale: 1\n      - name: key-auth\n'
        result = boundary.kong_policy(service + service.replace('auth-v1','auth-v1-user-read'), '192.0.2.2')
        self.assertEqual(result.count('signup_source_ip: "192.0.2.2"'), 2)
        self.assertEqual(result.count('name: key-auth'), 2)
        self.assertEqual(boundary.kong_policy(result, '192.0.2.2'), result)
        with self.assertRaises(ValueError): boundary.kong_policy(result, '192.0.2.3')
        with self.assertRaises(ValueError): boundary.kong_policy(result.replace('          signup_source_ip: "192.0.2.2"\n', '', 1), '192.0.2.2')
        with self.assertRaises(ValueError): boundary.kong_policy(service + service, '192.0.2.0/24')

    def test_existing_caddy_guards_preserved_and_unused_services_removed(self):
        source = '{\n admin off\n}\nimport /etc/caddy/beanmap-public-auth-updates.Caddyfile\napi.beanmap.site {\n\t@application_api path /auth/v1/* /rest/v1/* /storage/v1/* /realtime/v1/* /functions/v1/* /graphql/v1/*\n\thandle @application_api {\n\t\timport beanmap_public_auth_updates\n\t\treverse_proxy 127.0.0.1:8000\n\t}\n}\n'
        result = boundary.caddy_policy(source)
        self.assertTrue(result.startswith('{\n admin off'))
        self.assertIn('import beanmap_controlled_signup',result)
        self.assertIn('import beanmap_public_auth_updates',result)
        self.assertNotIn('/storage/v1',result)
        self.assertNotIn('/graphql/v1',result)
        self.assertNotIn('/realtime/v1',result)
        self.assertNotIn('/functions/v1',result)
        with self.assertRaises(ValueError): boundary.caddy_policy(result)

    def test_native_minimum_update_preserves_other_auth_configuration(self):
        source={'services':{'auth':{'environment':{'GOTRUE_JWT_EXP':'300','GOTRUE_MAILER_TEMPLATES_MAGIC_LINK':'fixture'}}},'networks':{'private':{}}}
        result=json.loads(boundary.overlay(json.dumps(source)))
        self.assertEqual(result['services']['auth']['environment']['GOTRUE_PASSWORD_MIN_LENGTH'],'15')
        result['services']['auth']['environment'].pop('GOTRUE_PASSWORD_MIN_LENGTH')
        self.assertEqual(result,source)

if __name__ == '__main__': unittest.main()
