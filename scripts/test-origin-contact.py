#!/usr/bin/env python3
"""Release gate: reports only row numbers/counts, never source values."""
from pathlib import Path
from origin_contact import CONTACT, clean_name, minimize_entity, seed_rows

root = Path(__file__).resolve().parent.parent
for value in ('fixture@example.test', '+1 (202) 555-0100', 'PHONE', '연락처', '123 4567'):
    assert clean_name(value) is None, 'Contact sanitizer failed a synthetic fixture'
assert clean_name('Valid Farm | fixture@example.test') == 'Valid Farm'
assert clean_name('Lot 42') == 'Lot 42'
row = ('ENT-99999', 'Fixture', None, 'fixture@example.test', None, 'farm', None, None,
       'Valid Producer', None, None, None, None, None, 'Synthetic source (2018)')
assert minimize_entity(row)[3] == 'Valid Producer'
assert minimize_entity(row[:8] + (None,) + row[9:]) is None
assert minimize_entity(row[:-1] + ('fixture@example.test',)) is None
count = 0
for path in sorted((root / 'supabase/migrations').glob('*.sql')):
    for line, values in seed_rows(path.read_text()):
        assert not any(CONTACT.search(v) for v in values if v), f'Contact in {path.name}:{line}'
        count += 1
assert count > 900, 'Expected origin seed coverage missing'
print(f'Origin contact fixture gate passed: {count} rows, no contact patterns')
