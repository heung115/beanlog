#!/usr/bin/env python3
"""Create a separate Caddy candidate restricting public Auth password updates.

Preserves existing provenance headers, private routes, and error handling.
Never writes the live source configuration; --output must be a new path.
"""
import argparse
import os
import re
from pathlib import Path

IMPORT = 'import /etc/caddy/beanmap-public-auth-updates.Caddyfile'
GUARD = 'import beanmap_public_auth_updates'


def prepare(source):
    if source.count('api.beanmap.site {') != 1:
        raise ValueError('Expected one explicit public API site; review alternate routing')
    proxies = list(re.finditer(r'(?m)^([ \t]*)reverse_proxy 127\.0\.0\.1:8000(?:[ \t]*\{)?[ \t]*$', source))
    if len(proxies) != 1:
        raise ValueError('Expected exactly one public gateway upstream')
    proxy = proxies[0]
    # Deliberately require the reviewed application API handle. Refuse alternate
    # gateway routes rather than silently leaving another public path unguarded.
    handle = source.rfind('handle @application_api {', 0, proxy.start())
    site = source.index('api.beanmap.site {')
    if handle < site or re.search(r'[{}]', source[handle + len('handle @application_api {'):proxy.start()]):
        raise ValueError('Public gateway is outside the reviewed application API handle')
    if re.search(r'(?m)^\s*(rewrite|uri|handle_path)\b', source[site:proxy.start()]):
        raise ValueError('Public gateway rewrites require separate normalization review')
    prefix = source[handle:proxy.start()]
    if GUARD not in prefix:
        source = source[:proxy.start()] + proxy.group(1) + GUARD + '\n' + source[proxy.start():]
    elif prefix.count(GUARD) != 1:
        raise ValueError('Duplicate public Auth update guard')
    if IMPORT not in source:
        # Insert after the global options but before the first site/snippet.
        marker = re.search(r'(?m)^\([^\n]+\)\s*\{|^www\.beanmap\.site\s*\{', source)
        if not marker:
            raise ValueError('Cannot safely locate the global import position')
        source = source[:marker.start()] + IMPORT + '\n\n' + source[marker.start():]
    if source.count(IMPORT) != 1:
        raise ValueError('Unexpected duplicate snippet import')
    return source


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    if args.source.resolve() == args.output.resolve():
        parser.error('A separate candidate path is required')
    result = prepare(args.source.read_text())
    fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as stream:
        stream.write(result)
    print(f'Candidate written: {args.output}; live configuration unchanged.')


if __name__ == '__main__':
    main()
