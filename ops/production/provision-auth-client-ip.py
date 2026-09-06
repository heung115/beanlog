#!/usr/bin/env python3
"""Plan/apply an isolated web→Kong IP trust network; never restart services."""
import argparse
import ipaddress
import json
import os
from pathlib import Path
import secrets
import subprocess

NETWORK = 'beanmap-auth-client-ip'
OWNER = {'site.beanmap.owner': 'auth-client-ip'}
AUTH_DIR = Path('/etc/beanmap-auth-client-ip')


def command(args):
    return subprocess.check_output(args, text=True).strip()


def inspect_state():
    ids = command(['docker', 'network', 'ls', '-q']).split()
    networks = json.loads(command(['docker', 'network', 'inspect', *ids])) if ids else []
    routes = json.loads(command(['ip', '-json', '-4', 'route', 'show', 'table', 'all']))
    return networks, routes


def plan(networks, routes):
    existing = next((network for network in networks if network['Name'] == NETWORK), None)
    if existing:
        if (existing.get('Labels') or {}).get('site.beanmap.owner') != 'auth-client-ip':
            raise ValueError('Existing network is not owned by this feature')
        configs = existing['IPAM']['Config']
        if len(configs) != 1:
            raise ValueError('Expected one IPv4 IPAM configuration')
        subnet = ipaddress.ip_network(configs[0]['Subnet'])
        expected_range = f'{subnet.network_address + 6}/32'
        if (subnet.version != 4 or subnet.prefixlen != 29 or configs[0].get('IPRange') != expected_range
                or configs[0].get('Gateway') != str(subnet.network_address + 1)
                or existing.get('Driver') != 'bridge'):
            raise ValueError('Existing network does not reserve the static address range')
        expected = {'beanlogapp-web-1': str(subnet.network_address + 2), 'supabase-kong': str(subnet.network_address + 3)}
        for container in existing.get('Containers', {}).values():
            if container['Name'] not in ['beanlogapp-web-1', 'supabase-kong']:
                raise ValueError('Unexpected container is attached to the trusted network')
            if container.get('IPv4Address', '').split('/')[0] != expected[container['Name']]:
                raise ValueError('Trusted container address does not match the reserved plan')
    else:
        used = []
        for network in networks:
            for item in (network.get('IPAM', {}).get('Config') or []):
                if item.get('Subnet'):
                    used.append(ipaddress.ip_network(item['Subnet'], strict=False))
        for route in routes:
            destination = route.get('dst', '')
            if destination and destination != 'default':
                used.append(ipaddress.ip_network(destination, strict=False))
        candidates = [ipaddress.ip_network(f'172.31.{part}.0/29') for part in range(240, 255)]
        candidates += [ipaddress.ip_network(f'192.168.{part}.0/29') for part in range(240, 255)]
        subnet = next((candidate for candidate in candidates if not any(
            other.version == 4 and candidate.overlaps(other) for other in used
        )), None)
        if subnet is None:
            raise ValueError('No non-conflicting candidate subnet; choose a reviewed network plan')
    return {
        'network': NETWORK, 'subnet': str(subnet),
        'gateway': str(subnet.network_address + 1),
        'web_ip': str(subnet.network_address + 2),
        'kong_ip': str(subnet.network_address + 3),
        'dynamic_range': f'{subnet.network_address + 6}/32',
    }


def overrides(selected):
    app = {
        'services': {'web': {
            'user': '1001:1001',
            'environment': {
                'SUPABASE_SERVER_URL': 'http://beanmap-auth-gateway:8000',
                'AUTH_CLIENT_IP_SECRET_FILE': '/run/secrets/auth_client_ip_proof',
            },
            'secrets': ['auth_client_ip_proof'],
            'networks': {
                'supabase_net': {},
                'auth-client-ip': {'ipv4_address': selected['web_ip']},
            },
        }},
        'networks': {'auth-client-ip': {'external': True, 'name': NETWORK}},
        'secrets': {'auth_client_ip_proof': {'file': str(AUTH_DIR / 'proxy-proof')}},
    }
    kong = {
        'services': {'kong': {
            'environment': {
                'KONG_TRUSTED_IPS': f"{selected['web_ip']}/32",
                'KONG_REAL_IP_HEADER': 'X-Beanmap-Auth-Client-IP',
                'KONG_REAL_IP_RECURSIVE': 'off',
            },
            'networks': {
                'default': {},
                'auth-client-ip': {'ipv4_address': selected['kong_ip'], 'aliases': ['beanmap-auth-gateway']},
            },
        }},
        'networks': {'auth-client-ip': {'external': True, 'name': NETWORK}},
    }
    return app, kong


def private_write(path, content, mode=0o600):
    if path.is_symlink():
        raise ValueError(f'Refusing symlink: {path}')
    temporary = path.with_name(path.name + '.candidate')
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode)
    with os.fdopen(fd, 'w') as stream:
        stream.write(content)
    os.replace(temporary, path)
    os.chmod(path, mode)


def apply(selected):
    if os.geteuid() != 0:
        raise ValueError('Application requires root on the reviewed Oracle host')
    networks, routes = inspect_state()
    current = plan(networks, routes)
    if current != selected:
        raise ValueError('Network state changed since review; regenerate the plan')
    if not any(network['Name'] == NETWORK for network in networks):
        command(['docker', 'network', 'create', '--driver', 'bridge', '--subnet', selected['subnet'],
                 '--ip-range', selected['dynamic_range'], '--gateway', selected['gateway'],
                 '--label', 'site.beanmap.owner=auth-client-ip', NETWORK])
    if AUTH_DIR.is_symlink():
        raise ValueError('Refusing symlink configuration directory')
    AUTH_DIR.mkdir(mode=0o700, exist_ok=True)
    os.chown(AUTH_DIR, 0, 0)
    os.chmod(AUTH_DIR, 0o700)
    proof_file = AUTH_DIR / 'proxy-proof'
    if proof_file.is_symlink():
        raise ValueError('Refusing symlink ingress proof')
    if proof_file.exists():
        proof = proof_file.read_text().strip()
        if len(proof) != 64 or any(c not in '0123456789abcdef' for c in proof):
            raise ValueError('Existing ingress proof is invalid; it was not replaced')
    else:
        proof = secrets.token_hex(32)
        private_write(proof_file, proof + '\n', 0o440)
    os.chown(proof_file, 0, 1001)
    os.chmod(proof_file, 0o440)
    private_write(AUTH_DIR / 'caddy.env', 'BEANMAP_AUTH_CLIENT_IP_SECRET=' + proof + '\n')
    app, kong = overrides(selected)
    private_write(Path('/srv/beanlog/app/docker-compose.client-ip.yml'), json.dumps(app, indent=2) + '\n')
    private_write(Path('/srv/beanlog/supabase/docker/docker-compose.client-ip.yml'), json.dumps(kong, indent=2) + '\n')
    dropin = Path('/etc/systemd/system/caddy.service.d')
    dropin.mkdir(mode=0o755, exist_ok=True)
    private_write(dropin / 'auth-client-ip.conf', '[Service]\nEnvironmentFile=/etc/beanmap-auth-client-ip/caddy.env\n', 0o644)
    print('Network and reviewed overrides prepared; services and Caddy remain unchanged.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='operation', required=True)
    review = commands.add_parser('plan')
    review.add_argument('--output', type=Path, required=True)
    activate = commands.add_parser('apply')
    activate.add_argument('--plan', type=Path, required=True)
    args = parser.parse_args()
    if args.operation == 'plan':
        selected = plan(*inspect_state())
        if args.output.exists():
            raise ValueError('Plan already exists; choose another output file')
        private_write(args.output, json.dumps(selected, indent=2) + '\n')
        print(f'Plan written to {args.output}; no service state changed.')
    else:
        apply(json.loads(args.plan.read_text()))


if __name__ == '__main__':
    main()
