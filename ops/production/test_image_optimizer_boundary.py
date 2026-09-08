import http.client
import importlib.util
import os
from pathlib import Path
import unittest
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location('image_candidate', HERE / 'prepare-image-optimizer-caddy.py')
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class CandidateTests(unittest.TestCase):
    def test_only_inserts_expected_guards_and_is_idempotent(self):
        source = (HERE.parent / 'caddy/Caddyfile').read_text()
        candidate = MODULE.prepare(source)
        self.assertEqual(MODULE.prepare(candidate), candidate)
        restored = candidate.replace(MODULE.DEFINITION + '\n\n', '').replace('\n\t' + MODULE.USE, '')
        self.assertEqual(restored, source)

    def test_rejects_ambiguous_or_rewritten_public_site(self):
        source = 'beanmap.site {\n reverse_proxy 127.0.0.1:3100\n}\n'
        for broken in [source + source, source.replace('3100', '9999'),
                       source.replace('reverse_proxy', 'rewrite * /_next/image\n reverse_proxy'),
                       source + MODULE.USE]:
            with self.assertRaises(ValueError):
                MODULE.prepare(broken)


@unittest.skipUnless(os.getenv('BEANMAP_IMAGE_CADDY_QA_URL'), 'Set disposable Caddy fixture URL')
class GatewayTests(unittest.TestCase):
    def request(self, path, method='GET'):
        url = urlsplit(os.environ['BEANMAP_IMAGE_CADDY_QA_URL'])
        conn = http.client.HTTPConnection(url.hostname, url.port, timeout=5)
        try:
            conn.request(method, path)
            response = conn.getresponse()
            response.read()
            return response.status, dict(response.getheaders())
        finally:
            conn.close()

    def test_optimizer_and_normalized_variants_never_reach_upstream(self):
        paths = ['/_next/image', '/_next/image?url=%2Ficon-192.png&w=64&q=75',
                 '/_next/image/extra', '/_next/image/', '/_next/%69mage',
                 '/_next%2fimage', '/_next//image', '//_next/image',
                 '/before/../_next/image', '/before/%2e%2e/_next/image']
        for method in ['GET', 'HEAD', 'POST']:
            for path in paths:
                with self.subTest(method=method, path=path):
                    status, headers = self.request(path, method)
                    self.assertEqual(status, 404)
                    self.assertNotIn('X-Fixture-Upstream', headers)

    def test_other_routes_still_reach_upstream(self):
        for path in ['/ko/login', '/api/auth/callback?code=fixture',
                     '/_next/static/chunks/example.js', '/icon-192.png', '/_next/image-other']:
            with self.subTest(path=path):
                status, headers = self.request(path)
                self.assertEqual(status, 200)
                self.assertEqual(headers.get('X-Fixture-Upstream'), 'reached')


if __name__ == '__main__':
    unittest.main()
