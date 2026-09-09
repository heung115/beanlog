"""Contact minimization for published origin fixtures (never logs field values)."""
from __future__ import annotations
import re

# Reject address markers, explicit contact labels and seven-digit phone spans.
CONTACT = re.compile(r"@|\b(?:contact|phone|telephone|tel|mobile|e-?mail|fax)\b|연락처|전화|이메일|[0-9](?:[0-9\s().+\-]*[0-9]){6}", re.I)
NAME_COLUMNS = (3, 4, 6, 7, 8, 9, 10, 11, 12, 13)


def clean_name(value: str | None) -> str | None:
    if value is None:
        return None
    for part in value.split('|'):
        part = part.strip()
        if part and not CONTACT.search(part):
            return part
    return None


def minimize_entity(row: tuple) -> tuple | None:
    result = list(row)
    for index in NAME_COLUMNS:
        result[index] = clean_name(result[index])
    if result[3] is None:
        result[3] = next((result[i] for i in (6, 8, 12) if result[i]), None)
        result[4] = None
    if result[3] is None:
        return None
    # Identifiers, geography, type and provenance must never hide contact data.
    if any(CONTACT.search(str(value)) for value in result if value is not None):
        return None
    return tuple(result)


def seed_rows(source: str):
    """Parse generated entity tuples, supporting SQL doubled-quote escaping."""
    for line_number, line in enumerate(source.splitlines(), 1):
        if not re.match(r"\s*\('ENT-", line):
            continue
        tokens = re.findall(r"'(?:[^']|'')*'|\bNULL\b", line)
        values = tuple(None if t == 'NULL' else t[1:-1].replace("''", "'") for t in tokens)
        if len(values) != 15:
            raise ValueError(f"Unexpected origin fixture shape at line {line_number}")
        yield line_number, values
