#!/usr/bin/env python3
"""Reject forward_auth on an unverified Caddy release; never reload a service."""
import argparse
from pathlib import Path
import re

ADVISORY = 'https://github.com/caddyserver/caddy/security/advisories/GHSA-6365-7ppr-5r92'


def assert_safe(version, sources):
    # Inspect all loaded source files, including imports. Caddy environment
    # placeholders must not be used to inject directives into these files.
    uses_forward_auth = any(
        re.search(r'(?<![\w-])forward_auth\s', line.split('#', 1)[0])
        for source in sources for line in source.splitlines()
    )
    if not uses_forward_auth:
        return
    release = re.match(r'^v?(\d+)\.(\d+)\.(\d+)(?:\s|$)', version.strip())
    if release is None or tuple(map(int, release.groups())) < (2, 11, 5):
        raise ValueError('forward_auth requires a verified Caddy release >= 2.11.5')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--version', required=True)
    parser.add_argument('sources', type=Path, nargs='+')
    args = parser.parse_args()
    try:
        assert_safe(args.version, [source.read_text() for source in args.sources])
    except ValueError as error:
        parser.exit(1, str(error) + '\n')
    print('Caddy authentication version boundary passed.')


if __name__ == '__main__':
    main()
