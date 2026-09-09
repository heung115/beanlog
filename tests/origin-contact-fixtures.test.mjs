import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('published origin fixtures and ingestion reject contact data', () => {
  const result = spawnSync('python3', ['scripts/test-origin-contact.py'], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
