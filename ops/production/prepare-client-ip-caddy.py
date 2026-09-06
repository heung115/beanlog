#!/usr/bin/env python3
"""Prepare Caddy client-IP provenance without changing any authentication route."""
import argparse
import os
import re
from pathlib import Path

FORWARD = '''
\t\t\theader_up X-Beanmap-Client-IP {remote_host}
\t\t\theader_up X-Beanmap-Client-Proof {$BEANMAP_AUTH_CLIENT_IP_SECRET}
\t\t\theader_up -X-Beanmap-Auth-Client-IP'''
STRIP = '''
\t\t\theader_up -X-Beanmap-Client-IP
\t\t\theader_up -X-Beanmap-Client-Proof
\t\t\theader_up -X-Beanmap-Auth-Client-IP'''


def patch_proxy(source, port, directives):
    pattern = re.compile(r'(?m)^([ \t]*)reverse_proxy 127\.0\.0\.1:' + str(port) + r'([ \t]*)(\{)?[ \t]*$')
    matches = list(pattern.finditer(source))
    if len(matches) != 1:
        raise ValueError(f'Expected exactly one loopback upstream on port {port}')
    match = matches[0]
    if match.group(3):
        depth = 1
        end = None
        # Count configuration braces, ignoring quoted strings and comments.
        token_pattern = r'"(?:\\.|[^"\\])*"|`[^`]*`|\#[^\n]*|[{}]'
        for token in re.finditer(token_pattern, source[match.end():]):
            if token.group() == '{':
                depth += 1
            elif token.group() == '}':
                depth -= 1
                if depth == 0:
                    end = match.end() + token.end()
                    break
        if end is None:
            raise ValueError('Unclosed upstream block')
        body = source[match.end():end]
        header_pattern = r'(?im)^[ \t]*(header_up[ \t]+[-+]?X-Beanmap-(?:Client-IP|Client-Proof|Auth-Client-IP)\b[^\n]*)$'
        existing = [line.strip() for line in re.findall(header_pattern, body)]
        expected = [line.strip() for line in directives.strip().splitlines()]
        if existing == expected:
            return source
        if existing:
            raise ValueError('Conflicting provenance header rules require explicit review')
        return source[:match.end()] + directives + source[match.end():]
    replacement = match.group(0).rstrip() + ' {' + directives + '\n' + match.group(1) + '}'
    return source[:match.start()] + replacement + source[match.end():]


def prepare(source, private=False):
    candidate = patch_proxy(source, 3100, FORWARD)
    if not private:
        candidate = patch_proxy(candidate, 8000, STRIP)
    return candidate


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--private', action='store_true')
    args = parser.parse_args()
    if args.source.resolve() == args.output.resolve():
        parser.error('A separate candidate path is required')
    result = prepare(args.source.read_text(), args.private)
    fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as stream:
        stream.write(result)
    print(f'Candidate written: {args.output}; live configuration unchanged.')


if __name__ == '__main__':
    main()
