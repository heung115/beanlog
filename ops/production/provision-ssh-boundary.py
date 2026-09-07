#!/usr/bin/env python3
"""Limit host SSH to loopback/Tailscale; preserve unrelated firewall rules.

Default prints a plan. Before --apply, save root-only backups of rules.v4/v6,
arm a timed rollback, and verify a fresh key-authenticated SSH connection before
cancelling it. This script requires existing iptables-persistent rule files.
"""
import argparse
import os
from pathlib import Path
import subprocess

CHAIN = 'BEANMAP-SSH'
RULES = [
    ['-i', 'lo', '-j', 'RETURN'],
    ['-i', 'tailscale0', '-j', 'RETURN'],
    ['-j', 'DROP'],
]
JUMP = ['-p', 'tcp', '-m', 'tcp', '--dport', '22', '-j', CHAIN]


def persisted(text):
    """Prepend an SSH-only hook to filter INPUT without persisting runtime state."""
    if CHAIN in text:
        raise RuntimeError('Saved SSH chain already exists; review before reapplying')
    lines = text.splitlines()
    start = lines.index('*filter') + 1
    end = lines.index('COMMIT', start)
    first_rule = next((i for i in range(start, end) if lines[i].startswith('-')), end)
    lines[first_rule:first_rule] = [f':{CHAIN} - [0:0]',
                                  '-A INPUT ' + ' '.join(JUMP),
                                  *['-A ' + CHAIN + ' ' + ' '.join(r) for r in RULES]]
    return '\n'.join(lines) + '\n'


def run(args, **kwargs):
    result = subprocess.run(args, capture_output=True, text=True, timeout=30, **kwargs)
    if result.returncode:
        raise RuntimeError(f'{args[0]} operation failed (exit {result.returncode})')
    return result.stdout


def apply():
    if os.geteuid() != 0:
        raise RuntimeError('Root required')
    prepared = []
    for family, binary in [('v4', 'iptables'), ('v6', 'ip6tables')]:
        target = Path('/etc/iptables/rules.' + family)
        candidate = target.with_name(target.name + '.beanmap-candidate')
        current = run([binary, '--wait', '10', '-S'])
        if CHAIN in current:
            raise RuntimeError('Runtime SSH chain already exists; review before reapplying')
        candidate.write_text(persisted(target.read_text()))
        candidate.chmod(0o600)
        run([binary + '-restore', '--test'], input=candidate.read_text())
        prepared.append((binary, target, candidate))
    for binary, target, candidate in prepared:
        prefix = [binary, '--wait', '10']
        run([*prefix, '-N', CHAIN])
        for rule in RULES:
            run([*prefix, '-A', CHAIN, *rule])
        run([*prefix, '-I', 'INPUT', '1', *JUMP])
        candidate.replace(target)
    print('IPv4/IPv6 SSH boundary installed; verify a fresh SSH connection now.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    if args.apply:
        apply()
    else:
        print('IPv4/IPv6 INPUT TCP 22: permit loopback and tailscale0; drop other interfaces.')
