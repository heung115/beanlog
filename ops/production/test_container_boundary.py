import importlib.util
import json
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

ROOT = Path(__file__).parent
spec = importlib.util.spec_from_file_location('boundary', ROOT / 'provision-container-boundary.py')
boundary = importlib.util.module_from_spec(spec)
spec.loader.exec_module(boundary)


class Firewall:
    def __init__(self):
        self.chains = {'DOCKER-USER': [['-j', 'RETURN']]}
        self.mutations = 0

    def run(self, args, check=True):
        assert args[:3] == ['iptables', '--wait', '10']
        op, chain, *rule = args[3:]
        code, output = 0, ''
        if op == '-S':
            code = int(chain not in self.chains)
            output = '\n'.join('-A ' + chain + ' ' + ' '.join(r) for r in self.chains.get(chain, []))
        elif op == '-N':
            self.chains[chain] = []
            self.mutations += 1
        elif op == '-C':
            code = int(rule not in self.chains[chain])
        elif op == '-I':
            assert rule.pop(0) == '1'
            self.chains[chain].insert(0, rule)
            self.mutations += 1
        else:
            raise AssertionError(op)
        if check and code:
            raise RuntimeError('missing chain')
        return subprocess.CompletedProcess(args, code, output, '')


class BoundaryTests(unittest.TestCase):
    def test_existing_imds_guard_upgrade_preserves_drop_and_adds_only_dns(self):
        firewall = Firewall()
        firewall.chains[boundary.CHAIN] = [
            ['-d', '169.254.169.254/32', '-j', 'DROP'],
            ['!', '-i', boundary.BRIDGE, '-o', boundary.BRIDGE, '-j', 'DROP'],
        ]
        firewall.chains['DOCKER-USER'] = [['-j', boundary.CHAIN]]
        with patch.object(boundary, 'command', side_effect=firewall.run), patch.object(
                boundary, 'inspect_network', return_value={}), patch.object(boundary.os, 'geteuid', return_value=0):
            boundary.apply()
            after_upgrade = firewall.mutations
            boundary.apply()
        self.assertEqual(firewall.mutations, after_upgrade)
        self.assertEqual(after_upgrade, 2)
        self.assertEqual(firewall.chains[boundary.CHAIN], boundary.RULES)

    def test_oci_dns_exception_does_not_permit_metadata_or_other_ports(self):
        def verdict(protocol, port):
            for rule in boundary.RULES:
                if '-d' not in rule or rule[rule.index('-d') + 1] != '169.254.169.254/32':
                    continue
                if '-p' in rule and rule[rule.index('-p') + 1] != protocol:
                    continue
                if '--dport' in rule and rule[rule.index('--dport') + 1] != str(port):
                    continue
                return rule[rule.index('-j') + 1]
        for protocol in ['udp', 'tcp']:
            self.assertEqual(verdict(protocol, 53), 'RETURN')
            for port in [22, 80, 443, 853, 8080]:
                self.assertEqual(verdict(protocol, port), 'DROP')
        self.assertEqual(verdict('icmp', None), 'DROP')

    def test_repeat_application_preserves_other_rules_without_duplicates(self):
        firewall = Firewall()
        with patch.object(boundary, 'command', side_effect=firewall.run), patch.object(
                boundary, 'inspect_network', return_value={}), patch.object(boundary.os, 'geteuid', return_value=0):
            boundary.apply()
            mutations = firewall.mutations
            boundary.apply()
        self.assertEqual(firewall.mutations, mutations)
        self.assertEqual(firewall.chains[boundary.CHAIN], boundary.RULES)
        self.assertEqual(firewall.chains['DOCKER-USER'], [['-j', boundary.CHAIN], ['-j', 'RETURN']])

    def test_missing_docker_user_fails_without_mutation(self):
        firewall = Firewall()
        firewall.chains = {}
        with patch.object(boundary, 'command', side_effect=firewall.run), patch.object(
                boundary.os, 'geteuid', return_value=0), self.assertRaises(RuntimeError):
            boundary.apply()
        self.assertEqual(firewall.mutations, 0)

    def test_existing_bypass_rule_cannot_precede_boundary(self):
        firewall = Firewall()
        firewall.chains[boundary.CHAIN] = [*boundary.RULES]
        firewall.chains['DOCKER-USER'] = [['-j', 'ACCEPT'], ['-j', boundary.CHAIN]]
        with patch.object(boundary, 'command', side_effect=firewall.run), patch.object(
                boundary, 'inspect_network', return_value={}), patch.object(boundary.os, 'geteuid', return_value=0):
            boundary.apply()
        self.assertEqual(firewall.chains['DOCKER-USER'][0], ['-j', boundary.CHAIN])

    def test_rejects_bypass_in_owned_chain(self):
        firewall = Firewall()
        firewall.chains[boundary.CHAIN] = [['-j', 'ACCEPT'], *boundary.RULES]
        with patch.object(boundary, 'command', side_effect=firewall.run), patch.object(
                boundary, 'inspect_network', return_value={}), patch.object(
                boundary.os, 'geteuid', return_value=0), self.assertRaises(RuntimeError):
            boundary.apply()

    def test_rejects_public_or_unowned_management_network(self):
        expected = {'Driver': 'bridge', 'Internal': True, 'EnableIPv6': False,
                    'Labels': {boundary.LABEL: boundary.OWNER},
                    'Options': {'com.docker.network.bridge.name': boundary.BRIDGE}}
        for replacement in [{'Internal': False}, {'Labels': {}}, {'EnableIPv6': True},
                            {'Containers': {'id': {'Name': 'beanlogapp-web-1'}}}]:
            with self.subTest(replacement=replacement), patch.object(boundary, 'command', side_effect=[
                    subprocess.CompletedProcess([], 0, boundary.NETWORK + '\n', ''),
                    subprocess.CompletedProcess([], 0, json.dumps([{**expected, **replacement}]), '')
            ]), self.assertRaises(RuntimeError):
                boundary.inspect_network()


if __name__ == '__main__':
    unittest.main()
