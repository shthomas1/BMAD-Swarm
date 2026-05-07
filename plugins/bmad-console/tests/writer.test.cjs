// writer.test.cjs — node:test tests for writer endpoints.
// Spins up the real HTTP server against a temp project root, then drives
// it with fetch().

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const writer = require('../server/writer.cjs');

// --- Pure helpers (no server) -----------------------------------------------

test('isAllowedPath: accepts allowlisted paths', () => {
  assert.equal(writer.isAllowedPath('artifacts/planning/product-brief.md'), true);
  assert.equal(writer.isAllowedPath('artifacts/planning/prd.md'), true);
  assert.equal(writer.isAllowedPath('artifacts/exploration/research.md'), true);
  assert.equal(writer.isAllowedPath('artifacts/design/architecture.md'), true);
  assert.equal(writer.isAllowedPath('artifacts/design/decisions/adr-001.md'), true);
  assert.equal(writer.isAllowedPath('artifacts/implementation/stories/story-1.md'), true);
});

test('isAllowedPath: rejects traversal, absolute, and out-of-allowlist paths', () => {
  assert.equal(writer.isAllowedPath('../../etc/passwd'), false);
  assert.equal(writer.isAllowedPath('artifacts/../../etc/passwd'), false);
  assert.equal(writer.isAllowedPath('/etc/passwd'), false);
  assert.equal(writer.isAllowedPath('src/index.ts'), false);
  assert.equal(writer.isAllowedPath('artifacts/context/decision-log.md'), false);
  assert.equal(writer.isAllowedPath(''), false);
  assert.equal(writer.isAllowedPath('artifacts\\planning\\prd.md'), false);
});

// --- Live HTTP tests --------------------------------------------------------

function makeTempProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-writer-'));
  fs.mkdirSync(path.join(dir, 'artifacts', 'planning'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'artifacts', 'design'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'project.yaml'), 'project:\n  name: test\nphase: ideation\nstatus: in-progress\n');
  fs.writeFileSync(path.join(dir, 'swarm.yaml'), 'project:\n  name: test\n');
  return dir;
}

function rmrf(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

function closeServer(server) {
  return new Promise((resolve) => {
    if (!server.listening) return resolve();
    server.close(() => resolve());
  });
}

function startServer({ demo = false, root, agentsEnabled = false } = {}) {
  // Lazy-require so each test can create a fresh server. start() reads
  // process.argv, so we override via opts.
  delete require.cache[require.resolve('../server/start.cjs')];
  const { start } = require('../server/start.cjs');
  // Use port 0 to let the OS pick a free port.
  const server = start({ port: 0, host: '127.0.0.1', demo, root, agentsEnabled });
  return new Promise((resolve) => {
    server.on('listening', () => {
      const addr = server.address();
      resolve({ server, port: addr.port });
    });
    // start() calls listen synchronously but we still want the address.
    if (server.listening) {
      const addr = server.address();
      resolve({ server, port: addr.port });
    }
  });
}

function httpJson({ port, method, path: p, body }) {
  return new Promise((resolve, reject) => {
    const data = body == null ? null : Buffer.from(JSON.stringify(body));
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method,
        path: p,
        headers: data
          ? { 'content-type': 'application/json', 'content-length': data.length }
          : {},
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = text;
          }
          resolve({ status: res.statusCode, body: json });
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

test('PUT /api/artifact: valid path writes file and returns ok', async () => {
  const root = makeTempProject();
  const { server, port } = await startServer({ root });
  try {
    const content = '# Test\n\nThis is a test brief.\n';
    const r = await httpJson({
      port,
      method: 'PUT',
      path: '/api/artifact',
      body: { path: 'artifacts/planning/product-brief.md', content },
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.path, 'artifacts/planning/product-brief.md');
    assert.equal(r.body.bytes, Buffer.byteLength(content));
    const written = fs.readFileSync(
      path.join(root, 'artifacts', 'planning', 'product-brief.md'),
      'utf8'
    );
    assert.equal(written, content);
  } finally {
    await closeServer(server);
    rmrf(root);
  }
});

test('PUT /api/artifact: path-traversal attempt → 403, no write', async () => {
  const root = makeTempProject();
  const { server, port } = await startServer({ root });
  try {
    const r = await httpJson({
      port,
      method: 'PUT',
      path: '/api/artifact',
      body: { path: '../../../etc/passwd', content: 'hax' },
    });
    assert.equal(r.status, 403);
    assert.ok(!fs.existsSync(path.join(root, '..', '..', '..', 'etc', 'passwd')));
  } finally {
    await closeServer(server);
    rmrf(root);
  }
});

test('PUT /api/artifact: path outside allowlist → 403', async () => {
  const root = makeTempProject();
  const { server, port } = await startServer({ root });
  try {
    const r = await httpJson({
      port,
      method: 'PUT',
      path: '/api/artifact',
      body: { path: 'src/index.ts', content: 'console.log(1)' },
    });
    assert.equal(r.status, 403);
    assert.ok(!fs.existsSync(path.join(root, 'src', 'index.ts')));
  } finally {
    await closeServer(server);
    rmrf(root);
  }
});

test('PUT /api/artifact: demo mode → 403 with demo message', async () => {
  const { server, port } = await startServer({ demo: true });
  try {
    const r = await httpJson({
      port,
      method: 'PUT',
      path: '/api/artifact',
      body: { path: 'artifacts/planning/prd.md', content: 'x' },
    });
    assert.equal(r.status, 403);
    assert.equal(r.body.error, 'demo mode is read-only');
  } finally {
    await closeServer(server);
  }
});

test('POST /api/gate: action=pass updates project.yaml.phase', async () => {
  const root = makeTempProject();
  const { server, port } = await startServer({ root });
  try {
    const r = await httpJson({
      port,
      method: 'POST',
      path: '/api/gate',
      body: { phase: 'exploration', action: 'pass' },
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.phase, 'exploration');
    const yaml = fs.readFileSync(path.join(root, 'project.yaml'), 'utf8');
    assert.match(yaml, /^phase:\s*exploration\s*$/m);
    assert.match(yaml, /^status:\s*in-progress\s*$/m);
  } finally {
    await closeServer(server);
    rmrf(root);
  }
});

test('POST /api/gate: action=approve on missing artifact → 404', async () => {
  const root = makeTempProject();
  const { server, port } = await startServer({ root });
  try {
    const r = await httpJson({
      port,
      method: 'POST',
      path: '/api/gate',
      body: { phase: 'design', action: 'approve' },
    });
    // architecture.md does not exist → no approval target found.
    assert.equal(r.status, 404);
  } finally {
    await closeServer(server);
    rmrf(root);
  }
});

test('POST /api/gate: action=approve appends Approved-by line when artifact exists', async () => {
  const root = makeTempProject();
  fs.writeFileSync(
    path.join(root, 'artifacts', 'planning', 'prd.md'),
    '# PRD\n\nrequirements.\n'
  );
  const { server, port } = await startServer({ root });
  try {
    const r = await httpJson({
      port,
      method: 'POST',
      path: '/api/gate',
      body: { phase: 'definition', action: 'approve' },
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    const body = fs.readFileSync(path.join(root, 'artifacts', 'planning', 'prd.md'), 'utf8');
    assert.match(body, /Approved-by:/);
    assert.match(body, /Approved-on:/);
  } finally {
    await closeServer(server);
    rmrf(root);
  }
});

test('POST /api/gate: action=needs-revision appends needs-revision block', async () => {
  const root = makeTempProject();
  fs.writeFileSync(
    path.join(root, 'artifacts', 'planning', 'prd.md'),
    '# PRD\n\nrequirements.\n'
  );
  const { server, port } = await startServer({ root });
  try {
    const r = await httpJson({
      port,
      method: 'POST',
      path: '/api/gate',
      body: { phase: 'definition', action: 'needs-revision', note: 'add NFRs' },
    });
    assert.equal(r.status, 200);
    const body = fs.readFileSync(path.join(root, 'artifacts', 'planning', 'prd.md'), 'utf8');
    assert.match(body, /Status:\s*needs-revision/);
    assert.match(body, /Note:\s*add NFRs/);
  } finally {
    await closeServer(server);
    rmrf(root);
  }
});

test('POST /api/gate: demo mode → 403', async () => {
  const { server, port } = await startServer({ demo: true });
  try {
    const r = await httpJson({
      port,
      method: 'POST',
      path: '/api/gate',
      body: { phase: 'exploration', action: 'pass' },
    });
    assert.equal(r.status, 403);
  } finally {
    await closeServer(server);
  }
});
