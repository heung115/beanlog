#!/usr/bin/env python3
"""Prepare a separate Caddy candidate disabling the unused public image optimizer.

Preserve all existing authentication, provenance, private, and error rules.
Never print configuration contents, replace the source, or reload the service.
"""
import argparse
import os
import re
from pathlib import Path

DEFINITION = 'import /etc/caddy/beanmap-disable-image-optimizer.Caddyfile'
USE = 'import beanmap_disable_image_optimizer'
SITE = re.compile(r'(?m)^beanmap\.site\s*\{')


def prepare(source):
    matches = list(SITE.finditer(source))
    if len(matches) != 1:
        raise ValueError('Expected exactly one standalone public beanmap.site block')
    match = matches[0]
    # Parse the site boundary without treating environment placeholders, quoted
    # strings or comments as configuration nesting.
    depth = 1
    end = None
    tokens = r'"(?:\\.|[^"\\])*"|`[^`]*`|\#[^\n]*|\{[^{}\s]+\}|[{}]'
    for token in re.finditer(tokens, source[match.end():]):
        if token.group() == '{':
            depth += 1
        elif token.group() == '}':
            depth -= 1
            if depth == 0:
                end = match.end() + token.start()
                break
    if end is None:
        raise ValueError('Unclosed public site block')
    body = source[match.end():end]
    if not re.search(r'(?m)^\s*reverse_proxy 127\.0\.0\.1:3100(?:\s*\{|\s*$)', body):
        raise ValueError('Unexpected web upstream; review the public routing boundary')
    if re.search(r'(?m)^\s*(rewrite|uri)\b', body):
        raise ValueError('Public URL rewriting requires explicit optimizer boundary review')
    if USE in source:
        if source.count(USE) != 1 or USE not in body or source.count(DEFINITION) != 1:
            raise ValueError('Conflicting optimizer guard imports')
        if source.index(DEFINITION) > match.start():
            raise ValueError('Guard definition must precede its use')
        return source
    if DEFINITION in source:
        raise ValueError('Orphan optimizer definition requires review')
    candidate = source[:match.end()] + '\n\t' + USE + source[match.end():]
    # Put the definition immediately before the public site, after global options.
    candidate = candidate[:match.start()] + DEFINITION + '\n\n' + candidate[match.start():]
    return candidate


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    if args.source.resolve() == args.output.resolve():
        parser.error('A separate candidate path is required')
    candidate = prepare(args.source.read_text())
    fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as output:
        output.write(candidate)
    print('Separate optimizer-block candidate prepared; live configuration unchanged.')


if __name__ == '__main__':
    main()
