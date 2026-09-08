#!/usr/bin/env python3
"""Generate auth gateway candidates from existing configuration; no service changes."""
import argparse
import json
import re
from pathlib import Path

PLUGIN = '''      - name: beanmap-auth-budgets
        config:
          scale: 1
'''


def kong_policy(source):
    if 'name: beanmap-auth-budgets' in source:
        raise ValueError('Budget plugin already installed; review existing configuration')
    parts = re.split(r'(?m)(?=^  - name: )', source)
    count = 0
    for index, part in enumerate(parts):
        if not re.match(r'  - name: auth-v1(?:\s|[-\w])', part):
            continue
        if '    plugins:\n' not in part:
            raise ValueError('Auth service has no plugin list')
        # Remove the former shared gateway-source bucket only from Auth services.
        part = re.sub(r'(?m)^      - name: rate-limiting\n(?:(?:        |          ).*\n)*', '', part)
        parts[index] = part.replace('    plugins:\n', '    plugins:\n' + PLUGIN, 1)
        count += 1
    if count < 2:
        raise ValueError('Expected at least generic and GET-user Auth services')
    return ''.join(parts)


def caddy_policy(source):
    old = 'header_up -X-Beanmap-Auth-Client-IP'
    # Change only the API proxy, leaving web proof generation unchanged.
    pattern = r'(reverse_proxy 127\.0\.0\.1:8000 \{\s*header_up -X-Beanmap-Client-IP\s*header_up -X-Beanmap-Client-Proof\s*)' + re.escape(old)
    result, count = re.subn(pattern, r'\1header_up X-Beanmap-Auth-Client-IP {remote_host}\n\t\t\theader_up -X-Beanmap-Auth-Rate-Identity', source)
    if count != 1:
        raise ValueError('Expected exactly one existing API provenance strip block')
    marker = '\t\timport beanmap_public_auth_updates'
    if result.count(marker) != 1:
        raise ValueError('Expected one public Auth update guard')
    return result.replace(marker, '\t\t@private_auth_admin path /auth/v1/admin /auth/v1/admin/*\n\t\trespond @private_auth_admin 404\n' + marker)


def overlay(source, web_ip, host_ip):
    import ipaddress
    for value in [web_ip, host_ip]:
        if str(ipaddress.ip_address(value)) != value:
            raise ValueError('A canonical exact address is required')
    result = json.loads(source)
    kong = result['services']['kong']
    env = kong['environment']
    if env['KONG_TRUSTED_IPS'] != web_ip + '/32':
        raise ValueError('Existing web-only trust changed; review before extending')
    env['KONG_TRUSTED_IPS'] = web_ip + '/32,' + host_ip + '/32'
    env['KONG_PLUGINS'] = 'bundled,beanmap-auth-budgets'
    env['KONG_NGINX_HTTP_LUA_SHARED_DICT'] = 'beanmap_auth_budgets 10m'
    kong.setdefault('volumes', []).append('/etc/beanmap-auth-budgets/plugin:/usr/local/share/lua/5.1/kong/plugins/beanmap-auth-budgets:ro')
    result['services']['auth'] = {'environment': {
        'GOTRUE_JWT_EXP': '300',
        'GOTRUE_RATE_LIMIT_HEADER': 'X-Beanmap-Auth-Rate-Identity',
        'GOTRUE_MAILER_TEMPLATES_MAGIC_LINK': 'https://beanmap.site/auth-templates/magic-link.html',
    }}
    return json.dumps(result, indent=2) + '\n'


def expiry(source):
    result, count = re.subn(r'(?m)^JWT_EXPIRY=.*$', 'JWT_EXPIRY=300', source)
    if count != 1:
        raise ValueError('Expected exactly one JWT_EXPIRY setting')
    return result


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('kind', choices=['kong', 'caddy', 'overlay', 'expiry'])
    p.add_argument('source', type=Path)
    p.add_argument('--output', required=True, type=Path)
    p.add_argument('--web-ip')
    p.add_argument('--host-ip')
    a = p.parse_args()
    src = a.source.read_text()
    value = overlay(src, a.web_ip, a.host_ip) if a.kind == 'overlay' else {'kong': kong_policy, 'caddy': caddy_policy, 'expiry': expiry}[a.kind](src)
    with a.output.open('x') as out:
        a.output.chmod(0o600)
        out.write(value)
    print('Candidate prepared; running services unchanged.')

if __name__ == '__main__':
    main()
