'use strict';
/* eslint-disable @typescript-eslint/no-require-imports -- The image build validates and replaces existing CommonJS bundles. */
const fs = require('node:fs');
const path = require('node:path');
const root = '/app/node_modules/.pnpm';
const patched = '/opt/beanmap-security-tar/node_modules/tar';
const patchedVersion = require(path.join(patched, 'package.json')).version;
const nextRoots = fs.readdirSync(root).filter(name => name.startsWith('next@'));
let replaced = 0;
for (const name of nextRoots) {
  const target = path.join(root, name, 'node_modules/next/dist/compiled/tar');
  if (!fs.existsSync(target)) continue;
  const old = require(target);
  const replacement = require(patched);
  for (const method of ['c', 'x', 't']) {
    if (typeof old[method] !== 'function' || typeof replacement[method] !== 'function') {
      throw new Error(`Incompatible tar interface: ${method}`);
    }
  }
  fs.rmSync(target, { recursive: true });
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, 'index.js'), `module.exports = require(${JSON.stringify(patched)});\n`);
  fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({ name: 'tar', version: patchedVersion, main: 'index.js' }) + '\n');
  replaced++;
}
if (replaced !== 1) throw new Error(`Expected exactly one Next tar bundle, found ${replaced}`);
console.log(`Replaced Next archive dependency with locked tar ${patchedVersion}`);
