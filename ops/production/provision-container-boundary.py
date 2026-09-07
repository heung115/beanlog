#!/usr/bin/env python3
"""Review/apply the private management bridge and Docker forwarding guard.

Default: print the non-secret plan only. --apply creates the owned network and
installs idempotent rules; it never connects, restarts or removes containers.
Requires Docker's iptables backend (including iptables-nft), not native nftables.
"""
import argparse
import fcntl
import json
import os
import subprocess

NETWORK = 'beanmap-management'
BRIDGE = 'bm-management'
CHAIN = 'BEANMAP-BOUNDARY'
LABEL = 'site.beanmap.owner'
OWNER = 'container-boundary'
RULES = [
    # OCI provides DNS and IMDS on the same IP. Return only DNS to Docker's
    # remaining policy; HTTP/HTTPS and every other port remain blocked below.
    ['-d', '169.254.169.254/32', '-p', 'udp', '-m', 'udp', '--dport', '53', '-j', 'RETURN'],
    ['-d', '169.254.169.254/32', '-p', 'tcp', '-m', 'tcp', '--dport', '53', '-j', 'RETURN'],
    ['-d', '169.254.169.254/32', '-j', 'DROP'],
    ['!', '-i', BRIDGE, '-o', BRIDGE, '-j', 'DROP'],
]


def command(args, check=True):
    result = subprocess.run(args, capture_output=True, text=True, timeout=30)
    if check and result.returncode:
        # Do not echo Docker errors/configurations, which may contain secrets.
        raise RuntimeError(f'{args[0]} operation failed (exit {result.returncode})')
    return result


def inspect_network():
    names = command(['docker', 'network', 'ls', '--format', '{{.Name}}']).stdout.splitlines()
    if NETWORK not in names:
        return None
    data = json.loads(command(['docker', 'network', 'inspect', NETWORK]).stdout)[0]
    if (data.get('Driver') != 'bridge' or data.get('Internal') is not True
            or data.get('EnableIPv6') is not False
            or (data.get('Labels') or {}).get(LABEL) != OWNER
            or (data.get('Options') or {}).get('com.docker.network.bridge.name') != BRIDGE):
        raise RuntimeError('Existing management network differs from the reviewed boundary')
    allowed = {'supabase-db', 'supabase-kong', 'beanmap-private-meta', 'beanmap-private-studio'}
    if any(item['Name'] not in allowed for item in data.get('Containers', {}).values()):
        raise RuntimeError('Unexpected container attached to the management network')
    return data


def iptables(*args, check=True):
    return command(['iptables', '--wait', '10', *args], check=check)


def ensure_rule(chain, rule):
    result = iptables('-C', chain, *rule, check=False)
    if result.returncode == 1:
        iptables('-I', chain, '1', *rule)
    elif result.returncode:
        raise RuntimeError('Could not verify firewall rule; refusing partial assumptions')


def apply():
    if os.geteuid() != 0:
        raise RuntimeError('--apply requires root on the reviewed Docker host')
    # DOCKER-USER absence can mean native nftables or a stopped Docker daemon.
    # Refuse instead of claiming a detached chain enforces policy.
    iptables('-S', 'DOCKER-USER')
    network = inspect_network()
    result = iptables('-S', CHAIN, check=False)
    if result.returncode == 1:
        iptables('-N', CHAIN)
    elif result.returncode:
        raise RuntimeError('Could not inspect owned firewall chain')
    for rule in reversed(RULES):
        ensure_rule(CHAIN, rule)
    owned = [line for line in iptables('-S', CHAIN).stdout.splitlines() if line.startswith('-A ')]
    expected = ['-A ' + CHAIN + ' ' + ' '.join(rule) for rule in RULES]
    if owned != expected:
        raise RuntimeError('Owned firewall chain has unexpected rules/order; review policy drift')
    # The guard must precede pre-existing accepts/returns, even after policy drift.
    forwarding = iptables('-S', 'DOCKER-USER').stdout.splitlines()
    rules = [line for line in forwarding if line.startswith('-A ')]
    if not rules or rules[0] != f'-A DOCKER-USER -j {CHAIN}':
        iptables('-I', 'DOCKER-USER', '1', '-j', CHAIN)
    if network is None:
        command(['docker', 'network', 'create', '--driver', 'bridge', '--internal',
                 '--label', f'{LABEL}={OWNER}', '--opt',
                 f'com.docker.network.bridge.name={BRIDGE}', NETWORK])
    print('Container boundary installed; no containers were moved or restarted.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    if args.apply:
        # Serialize rule creation/rechecks across Docker restart and manual runs.
        with open('/run/beanmap-container-boundary.lock', 'a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            apply()
    else:
        print(json.dumps({'network': NETWORK, 'internal': True, 'bridge': BRIDGE,
                          'chain': CHAIN, 'rules': RULES,
                          'connections_changed': False}, indent=2))


if __name__ == '__main__':
    main()
