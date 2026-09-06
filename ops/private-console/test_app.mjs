import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

class Element {
  constructor(tag = 'div') { this.tag = tag; this.children = []; this.dataset = {}; this.style = {}; this.hidden = false; this.textContent = ''; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener() {}
}

function setup() {
  const elements = new Map();
  const document = {
    body: new Element('body'),
    getElementById(id) { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); },
    createElement: (tag) => new Element(tag),
    createTextNode: (text) => ({ textContent: text }),
  };
  const context = vm.createContext({ document, Intl, URL, AbortController, Date,
    setInterval() {}, setTimeout() {}, clearTimeout() {}, fetch: () => new Promise(() => {}) });
  vm.runInContext(readFileSync(new URL('./public/app.js', import.meta.url), 'utf8'), context);
  return { context, document, elements, evaluate: (source) => vm.runInContext(source, context) };
}

function snapshot() {
  return { schemaVersion: 1, generatedAt: new Date().toISOString(),
    host: { cpuPercent: null, memory: null, disk: null, uptimeSeconds: null },
    containers: [{ label: 'API', status: 'running', health: 'healthy', restartCount: 0 }],
    checks: [{ label: '웹 응답', status: 'healthy' }],
    database: { status: 'unavailable', connections: null, totalConnections: null, sizeBytes: null },
    backup: { status: 'unavailable' }, logs: { services: [] }, collection: { errors: [] } };
}

test('tool links accept only credential-free private HTTPS URLs', () => {
  const { evaluate } = setup();
  for (const value of ['javascript:alert(1)', 'https://user:secret@host.tail.ts.net/', 'https://host.tail.ts.net.evil.example/', 'http://host.tail.ts.net/', 'https://public.example/']) {
    assert.equal(evaluate(`privateLink(${JSON.stringify(value)})`), null);
  }
  assert.equal(evaluate('privateLink("https://host.tail.ts.net:8443/project/default")'), 'https://host.tail.ts.net:8443/project/default');
});

test('unavailable resources and DB stats are not displayed as zero', () => {
  const { evaluate, elements, context } = setup();
  context.fixture = snapshot();
  evaluate('latestSnapshot = fixture; render(fixture)');
  assert.equal(elements.get('cpu-value').children[0].textContent, '—');
  assert.equal(elements.get('memory-value').children[0].textContent, '—');
  assert.equal(elements.get('db-connections').textContent, '—');
  assert.equal(elements.get('db-active').textContent, '—');
  assert.equal(elements.get('snapshot-status').dataset.state, 'warning');
});

test('stale snapshots are explicitly marked, keeping the last result', () => {
  const { evaluate, elements, context, document } = setup();
  const fixture = snapshot();
  fixture.generatedAt = new Date(Date.now() - 65000).toISOString();
  fixture.host.cpuPercent = 23;
  context.fixture = fixture;
  evaluate('latestSnapshot = fixture; render(fixture)');
  assert.equal(elements.get('snapshot-status').dataset.state, 'stale');
  assert.equal(document.body.dataset.stale, 'true');
  assert.match(elements.get('status-message').textContent, /마지막 확인 결과/);
  assert.equal(elements.get('cpu-value').children[0].textContent, '23');
  evaluate('lastFetchFailed = true; updateFreshness()');
  assert.equal(elements.get('snapshot-status').dataset.state, 'offline');
  assert.equal(elements.get('cpu-value').children[0].textContent, '23');
});

test('invalid payloads are rejected before rendering', () => {
  const { evaluate, context } = setup();
  context.fixture = snapshot();
  assert.equal(evaluate('validSnapshot(fixture)'), true);
  for (const broken of [null, {}, { ...snapshot(), schemaVersion: 99 }, { ...snapshot(), generatedAt: 'bad' }, { ...snapshot(), containers: [null] }, { ...snapshot(), collection: null }]) {
    context.fixture = broken;
    assert.equal(Boolean(evaluate('validSnapshot(fixture)')), false);
  }
});
