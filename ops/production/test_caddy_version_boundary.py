import importlib.util
from pathlib import Path
import unittest

SPEC = importlib.util.spec_from_file_location('caddy_boundary', Path(__file__).with_name('caddy-version-boundary.py'))
boundary = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(boundary)


class CaddyVersionBoundaryTests(unittest.TestCase):
    def test_existing_reverse_proxy_does_not_require_forward_auth_patch(self):
        boundary.assert_safe('v2.11.4', ['route {\n reverse_proxy localhost:3000\n}'])
        boundary.assert_safe('unknown', ['# forward_auth is not enabled\nrespond 404'])

    def test_imported_or_inline_forward_auth_rejects_old_and_unknown_releases(self):
        for version in ('v2.11.4', 'v2.9.9', 'unknown', 'v2.11.5-rc1', 'v2.11.5-custom', ''):
            for source in ('forward_auth localhost:9000 {\n uri /verify\n}', 'route { forward_auth localhost:9000 }'):
                with self.subTest(version=version, source=source), self.assertRaises(ValueError):
                    boundary.assert_safe(version, ['import private.Caddyfile', source])

    def test_known_patched_releases_allow_forward_auth(self):
        for version in ('v2.11.5', 'v2.11.5 h1:checksum', 'v2.12.0'):
            boundary.assert_safe(version, ['forward_auth localhost:9000'])


if __name__ == '__main__':
    unittest.main()
