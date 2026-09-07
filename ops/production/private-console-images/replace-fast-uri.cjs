'use strict';
/* eslint-disable @typescript-eslint/no-require-imports -- Runs only while building locked security images. */
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2];
if (!['/usr/src/app/node_modules', '/app/node_modules'].includes(root)) throw new Error('Unexpected module root');
const targets = [];
function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!item.isDirectory()) continue;
    const full = path.join(dir, item.name);
    const pkg = path.join(full, 'package.json');
    if (item.name === 'fast-uri' && fs.existsSync(pkg)) {
      const metadata = JSON.parse(fs.readFileSync(pkg, 'utf8'));
      if (metadata.name !== 'fast-uri') throw new Error('Unexpected package');
      targets.push({ full, version: metadata.version });
    } else walk(full);
  }
}
walk(root);
if (!targets.length) throw new Error('No installed fast-uri packages found');
for (const { full, version } of targets) {
  const major = Number(version.split('.')[0]);
  if (![2, 3].includes(major)) throw new Error(`Unsupported fast-uri version: ${version}`);
  const source = `/opt/beanmap-security-tar/node_modules/fast-uri-v${major}`;
  const patchedVersion = JSON.parse(fs.readFileSync(path.join(source, 'package.json'))).version;
  const old = require(full), next = require(source);
  for (const name of ['parse', 'serialize', 'resolve', 'equal']) {
    if (typeof old[name] !== 'function' || typeof next[name] !== 'function') throw new Error(`Missing interface: ${name}`);
  }
  const cases = ['https://example.com/a?b=c', 'urn:uuid:01234567-89ab-cdef-0123-456789abcdef', '../relative/path'];
  for (const value of cases) {
    if (JSON.stringify(old.parse(value)) !== JSON.stringify(next.parse(value))) throw new Error('Unexpected ordinary URI parse change');
  }
  fs.rmSync(full, { recursive: true });
  fs.cpSync(source, full, { recursive: true });
  console.log(`Patched fast-uri ${version} -> ${patchedVersion}`);
}
