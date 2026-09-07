import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('ssh_boundary', Path(__file__).with_name('provision-ssh-boundary.py'))
boundary = importlib.util.module_from_spec(spec)
spec.loader.exec_module(boundary)


class SSHBoundaryTests(unittest.TestCase):
    def test_hook_precedes_existing_accept_and_preserves_other_tables(self):
        raw = '*raw\n:PREROUTING ACCEPT [0:0]\nCOMMIT\n'
        source = raw + '*filter\n:INPUT ACCEPT [0:0]\n-A INPUT -j ACCEPT\nCOMMIT\n'
        result = boundary.persisted(source)
        self.assertTrue(result.startswith(raw))
        self.assertLess(result.index('-A INPUT -p tcp'), result.index('-A INPUT -j ACCEPT'))
        self.assertIn('-A BEANMAP-SSH -i tailscale0 -j RETURN', result)
        self.assertIn('-A BEANMAP-SSH -j DROP', result)

    def test_empty_ipv6_filter_gets_rules_before_commit(self):
        result = boundary.persisted('*filter\n:INPUT ACCEPT [0:0]\nCOMMIT\n')
        self.assertTrue(result.endswith('-A BEANMAP-SSH -j DROP\nCOMMIT\n'))

    def test_drift_requires_review(self):
        with self.assertRaises(RuntimeError):
            boundary.persisted('*filter\n:BEANMAP-SSH - [0:0]\nCOMMIT\n')


if __name__ == '__main__':
    unittest.main()
