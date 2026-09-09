#!/usr/bin/env python3
"""Prepare signup-boundary candidates on an already hardened deployment."""
import argparse
import ipaddress
import json
import re
from pathlib import Path


def kong_policy(source, web_ip):
    if str(ipaddress.ip_address(web_ip)) != web_ip or ':' in web_ip:
        raise ValueError('Expected the exact reserved IPv4 web address')
    pattern = r'(      - name: beanmap-auth-budgets\n        config:\n          scale: 1\n)'
    if 'signup_source_ip:' in source:
        # A fresh deployment installs the current budget policy first. It
        # already pins signup to the same web source; preserve that exact gate.
        existing = re.findall(pattern + r'          signup_source_ip: "' + re.escape(web_ip) + r'"\n', source)
        if len(existing) < 2 or len(existing) != len(re.findall(pattern, source)) or len(existing) != source.count('signup_source_ip:'):
            raise ValueError('Existing signup source differs or is incomplete; review the installed policy')
        return source
    result, count = re.subn(pattern, lambda match: match.group(1) + f'          signup_source_ip: "{web_ip}"\n', source)
    if count < 2:
        raise ValueError('Expected existing Auth budget services')
    return result


def caddy_policy(source):
    if 'beanmap_controlled_signup' in source:
        raise ValueError('Signup boundary already configured; review the installed policy')
    marker = '\t\timport beanmap_public_auth_updates'
    if source.count(marker) != 1:
        raise ValueError('Expected exactly one existing Auth update guard')
    result = source.replace(marker, '\t\timport beanmap_controlled_signup\n' + marker)
    matcher = r'(?m)^\t@application_api path .*\n'
    result, count = re.subn(matcher, '\t@application_api path /auth/v1 /auth/v1/* /rest/v1 /rest/v1/*\n', result)
    if count != 1:
        raise ValueError('Expected exactly one existing application API allowlist')
    anchor = 'import /etc/caddy/beanmap-public-auth-updates.Caddyfile'
    if result.count(anchor) != 1:
        raise ValueError('Expected the existing public Auth guard import')
    return result.replace(anchor, anchor + '\nimport /etc/caddy/beanmap-controlled-signup.Caddyfile')


def overlay(source):
    result = json.loads(source)
    auth = result['services'].setdefault('auth', {}).setdefault('environment', {})
    auth['GOTRUE_PASSWORD_MIN_LENGTH'] = '15'
    return json.dumps(result, indent=2) + '\n'


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('kind', choices=['caddy', 'kong', 'overlay'])
    p.add_argument('source', type=Path)
    p.add_argument('--output', required=True, type=Path)
    p.add_argument('--web-ip')
    a = p.parse_args()
    result = kong_policy(a.source.read_text(), a.web_ip) if a.kind == 'kong' else (overlay(a.source.read_text()) if a.kind == 'overlay' else caddy_policy(a.source.read_text()))
    with a.output.open('x') as stream:
        a.output.chmod(0o600)
        stream.write(result)
    print('Signup boundary candidate created; services unchanged.')

if __name__ == '__main__': main()
