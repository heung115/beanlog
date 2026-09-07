"""Exercise actual Compose merge semantics against non-secret runtime fixtures."""
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent


@unittest.skipUnless(shutil.which('docker'), 'Docker Compose CLI is required')
class ComposeTests(unittest.TestCase):
    def merged(self, fixture, overlay, runtime_env_services=()):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary) / 'compose.json'
            base.write_text(json.dumps({'name': 'boundary-test', **fixture}))
            command = ['docker', 'compose', '-f', str(base), '-f', str(overlay)]
            if runtime_env_services:
                # Do not depend on how a Compose version validates raw env_file
                # paths with --no-env-resolution. Remove only host-owned inputs in a
                # final test override; keep the real service/network definitions.
                env_override = Path(temporary) / 'without-runtime-env.yml'
                env_override.write_text('services:\n' + ''.join(
                    f'  {service}:\n    env_file: !reset []\n'
                    for service in runtime_env_services))
                command.extend(['-f', str(env_override)])
            command.extend(['config', '--format', 'json', '--no-env-resolution'])
            result = subprocess.run(command,
                                    capture_output=True, text=True,
                                    env={**__import__('os').environ, 'BEANMAP_WEB_AUTH_IP': '172.31.240.2'})
            self.assertEqual(result.returncode, 0,
                             f'Compose configuration failed for {overlay.name}:\n{result.stderr}')
            return json.loads(result.stdout)

    def test_web_loses_database_network_but_retains_exact_trusted_ip(self):
        fixture = {
            'services': {
                'web': {'image': 'test', 'networks': {'supabase_net': {}, 'auth-client-ip': {'ipv4_address': '172.31.240.2'}}},
                'api': {'image': 'test', 'networks': {'supabase_net': {}}}},
            'networks': {'supabase_net': {}, 'auth-client-ip': {}}
        }
        result = self.merged(fixture, ROOT / 'compose.security-app.yml')
        self.assertEqual(set(result['services']['web']['networks']), {'app-runtime', 'auth-client-ip'})
        self.assertEqual(result['services']['web']['networks']['auth-client-ip']['ipv4_address'], '172.31.240.2')
        self.assertEqual(set(result['services']['api']['networks']), {'app-runtime', 'supabase_net'})
        self.assertTrue(result['networks']['app-runtime']['internal'])

    def test_core_limits_preserve_runtime_and_gateway_trust(self):
        fixture = {'services': {service: {'image': 'test'} for service in ['db', 'kong', 'auth', 'rest']},
                   'networks': {'auth-client-ip': {}}}
        fixture['services']['kong'].update({
            'environment': {'KONG_TRUSTED_IPS': '172.31.240.2/32'},
            'networks': {'default': {}, 'auth-client-ip': {'ipv4_address': '172.31.240.3'}}})
        result = self.merged(fixture, ROOT / 'compose.security-supabase.yml')
        for service in ['db', 'kong', 'auth', 'rest']:
            config = result['services'][service]
            self.assertTrue(config['read_only'])
            self.assertIn('ALL', config['cap_drop'])
            self.assertIn('no-new-privileges:true', config['security_opt'])
            self.assertGreater(config['pids_limit'], 0)
            self.assertGreater(int(config['mem_limit']), 0)
        self.assertEqual(set(result['services']['db']['networks']), {'default', 'management'})
        self.assertEqual(set(result['services']['kong']['networks']), {'default', 'management', 'auth-client-ip'})
        self.assertEqual(result['services']['kong']['environment']['KONG_TRUSTED_IPS'], '172.31.240.2/32')
        self.assertEqual(result['services']['kong']['environment']['KONG_PREFIX'], '/var/run/kong')
        self.assertEqual(result['services']['kong']['environment']['KONG_DECLARATIVE_CONFIG'], '/var/run/kong/kong.yml')
        self.assertFalse(any(path.startswith('/usr/local/kong:') for path in result['services']['kong']['tmpfs']))
        self.assertEqual(result['services']['auth']['environment']['GOTRUE_EXTERNAL_PHONE_ENABLED'], 'false')
        self.assertEqual(result['services']['rest']['environment']['PGRST_DB_SCHEMAS'], 'public')

    def test_private_console_has_no_app_runtime_network(self):
        result = self.merged({'services': {}}, ROOT.parent / 'private-console/deploy/compose.yml',
                             runtime_env_services=('private-meta', 'private-studio'))
        for service in ['private-meta', 'private-studio']:
            self.assertFalse(result['services'][service].get('env_file'))
            self.assertEqual(set(result['services'][service]['networks']), {'management'})
        self.assertEqual(result['networks']['management']['name'], 'beanmap-management')


if __name__ == '__main__':
    unittest.main()
