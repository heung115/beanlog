#!/usr/bin/env python3
"""Prepare a reviewed Caddy candidate; never install or reload live configuration."""
import argparse
import os
import re
from pathlib import Path


def prepare(source: str) -> str:
    site = re.compile(r"(?m)^beanmap\.site\s*\{")
    matches = list(site.finditer(source))
    if len(matches) != 1:
        raise ValueError("Expected exactly one standalone beanmap.site block")
    import_file = "import /etc/caddy/beanmap-upstream-errors.Caddyfile"
    import_snippet = "import beanmap_upstream_errors /opt/beanmap-errors"
    def define_before_use(candidate):
        definitions = list(re.finditer(r"(?m)^" + re.escape(import_file) + r"[ \t]*$", candidate))
        if len(definitions) > 1:
            raise ValueError("Duplicate snippet definition imports require review")
        use_position = site.search(candidate).start()
        if definitions and definitions[0].start() < use_position:
            return candidate
        if definitions:
            definition = definitions[0]
            candidate = candidate[:definition.start()] + candidate[definition.end():]
        position = site.search(candidate).start()
        return candidate[:position] + import_file + "\n\n" + candidate[position:]

    if import_snippet in source:
        if import_file not in source:
            raise ValueError("Existing snippet import has no expected top-level file import")
        return define_before_use(source)
    # Existing 413/private restrictions stay untouched. Do not silently add a
    # competing handler if an operator already manages these failure statuses.
    if re.search(r"handle_errors[^\n{]*(?:502|503|504|5xx)", source):
        raise ValueError("An upstream error handler already exists; merge it manually")
    position = matches[0].end()
    candidate = source[:position] + "\n\t" + import_snippet + source[position:]
    return define_before_use(candidate)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.source.resolve() == args.output.resolve():
        parser.error("Output must differ from the live/source Caddyfile")
    candidate = prepare(args.source.read_text())
    # Caddy configurations may contain private settings. Do not print content or
    # overwrite another candidate unexpectedly.
    fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as output:
        output.write(candidate)
    print(f"Candidate written to {args.output}; no live configuration was changed.")


if __name__ == "__main__":
    main()
