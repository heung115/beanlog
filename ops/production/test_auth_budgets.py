#!/usr/bin/env python3
import importlib.util
from pathlib import Path
import json
import unittest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('budgets', HERE / 'prepare-auth-budgets.py')
budgets = importlib.util.module_from_spec(spec)
spec.loader.exec_module(budgets)

class AuthBudgetCandidates(unittest.TestCase):
    def test_only_auth_services_change(self):
        source = '''services:
  - name: auth-v1-user-read
    routes:
      - name: user
    plugins:
      - name: key-auth
      - name: rate-limiting
        config:
          minute: 600
          limit_by: ip
      - name: acl
        config:
          allow: [admin, anon]
  - name: auth-v1
    plugins:
      - name: rate-limiting
        config:
          minute: 60
          limit_by: ip
  - name: rest-v1
    plugins:
      - name: rate-limiting
        config:
          minute: 5
'''
        patched = budgets.kong_policy(source)
        self.assertEqual(patched.count('name: beanmap-auth-budgets'), 2)
        self.assertEqual(patched.count('name: rate-limiting'), 1)
        self.assertIn('allow: [admin, anon]', patched)
        self.assertEqual(source.split('  - name: rest-v1')[1], patched.split('  - name: rest-v1')[1])
        with self.assertRaises(ValueError): budgets.kong_policy(patched)

    def test_only_verified_proxy_trust_and_auth_settings(self):
        source = {'services': {'kong': {'environment': {'KONG_TRUSTED_IPS': '192.0.2.2/32'}, 'networks': {'default': {}, 'auth-client-ip': {}}}}, 'networks': {'existing': {}}}
        patched = json.loads(budgets.overlay(json.dumps(source), '192.0.2.2', '192.0.2.1'))
        self.assertEqual(patched['services']['kong']['environment']['KONG_TRUSTED_IPS'], '192.0.2.2/32,192.0.2.1/32')
        self.assertEqual(source['networks'], patched['networks'])
        self.assertEqual(source['services']['kong']['networks'], patched['services']['kong']['networks'])
        self.assertEqual(patched['services']['auth']['environment']['GOTRUE_JWT_EXP'], '300')
        self.assertEqual(patched['services']['auth']['environment']['GOTRUE_RATE_LIMIT_HEADER'], 'X-Beanmap-Auth-Rate-Identity')
        with self.assertRaises(ValueError): budgets.overlay(json.dumps(source), '192.0.2.3', '192.0.2.1')

    def test_caddy_preserves_existing_routes_and_overwrites_caller(self):
        source = '''beanmap.site {
 reverse_proxy 127.0.0.1:3100 {
  header_up -X-Beanmap-Auth-Client-IP
 }
}
api.beanmap.site {
 handle {
\t\timport beanmap_public_auth_updates
  reverse_proxy 127.0.0.1:8000 {
   header_up -X-Beanmap-Client-IP
   header_up -X-Beanmap-Client-Proof
   header_up -X-Beanmap-Auth-Client-IP
  }
 }
}
'''
        patched = budgets.caddy_policy(source)
        self.assertIn('header_up X-Beanmap-Auth-Client-IP {remote_host}', patched)
        self.assertIn('header_up -X-Beanmap-Auth-Rate-Identity', patched)
        self.assertIn('respond @private_auth_admin 404', patched)
        self.assertEqual(source.split('api.beanmap.site')[0], patched.split('api.beanmap.site')[0])
        with self.assertRaises(ValueError): budgets.caddy_policy(patched)

    def test_monitor_thresholds_do_not_retain_credentials(self):
        spec = importlib.util.spec_from_file_location('monitor', HERE / 'beanmap-auth-budget-monitor.py')
        monitor = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(monitor)
        burst = '\n'.join(['beanmap_auth_budget denied operation=otp scope=operation-otp'] * 6)
        first = monitor.evaluate(burst, {})
        self.assertFalse(first['alert'])
        self.assertTrue(monitor.evaluate(burst, first)['alert'])
        self.assertFalse(monitor.evaluate('', first)['alert'])
        self.assertTrue(monitor.evaluate('beanmap_auth_budget denied scope=public-total', {})['alert'])
        self.assertTrue(monitor.evaluate('beanmap_auth_budget unavailable scope=client-total', {})['alert'])
        self.assertNotIn('fixture-secret', json.dumps(monitor.evaluate('Authorization fixture-secret', {})))

    def test_expiry_is_only_env_change(self):
        source = 'OTHER=fixture-secret\nJWT_EXPIRY=3600\nANOTHER=unchanged\n'
        self.assertEqual(budgets.expiry(source), source.replace('3600', '300'))
        with self.assertRaises(ValueError): budgets.expiry('JWT_EXPIRY=3600\nJWT_EXPIRY=600\n')

if __name__ == '__main__': unittest.main()
