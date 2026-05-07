// start.js — HTTP + SSE server. stdlib only.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const { buildState, findProjectRoot } = require('./state.cjs');

function parseArgs(argv) {
  const out = { port: 5173, host: '127.0.0.1' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--port' && argv[i + 1]) {
      out.port = parseInt(argv[++i], 10);
    } else if (a.startsWith('--port=')) {
      out.port = parseInt(a.slice(7), 10);
    } else if (a === '--host' && argv[i + 1]) {
      out.host = argv[++i];
    } else if (a === '--root' && argv[i + 1]) {
      out.root = argv[++i];
    }
  }
  return out;
}

function start(opts = {}) {
  const args = parseArgs(process.argv);
  const port = opts.port || args.port;
  const host = opts.host || args.host;
  const startDir = opts.root || args.root || process.cwd();

  const projectRoot = findProjectRoot(startDir);
  if (!projectRoot) {
    console.error('bmad-console: could not find swarm.yaml or project.yaml in', startDir, 'or any ancestor.');
    console.error('  Run from inside a BMAD-Swarm project, or pass --root <path>.');
    process.exit(2);
  }

  const startupTs = Date.now();
  const webDir = path.join(__dirname, '..', 'web');

  // SSE clients
  const sseClients = new Set();

  function broadcastChange(payload) {
    const msg = `event: change\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const res of sseClients) {
      try {
        res.write(msg);
      } catch {
        // ignore
      }
    }
  }

  function snapshotState() {
    try {
      return buildState(projectRoot);
    } catch (e) {
      return { error: String(e && e.message || e) };
    }
  }

  // --- file watcher ---------------------------------------------------------
  // Recursive watching is platform-specific. On win32 + darwin recursive=true
  // works; on linux we walk and watch each subdir. Either way we coalesce.
  let coalesceTimer = null;
  function onFsChange(eventType, filename) {
    if (!filename) return;
    const rel = String(filename).split(path.sep).join('/');
    if (coalesceTimer) clearTimeout(coalesceTimer);
    coalesceTimer = setTimeout(() => {
      broadcastChange({ path: 'artifacts/' + rel, eventType });
    }, 80);
  }

  const artifactsDir = path.join(projectRoot, 'artifacts');
  try {
    if (process.platform === 'win32' || process.platform === 'darwin') {
      fs.watch(artifactsDir, { recursive: true }, onFsChange);
    } else {
      // best-effort flat watch on subdirs
      const watch = (dir) => {
        try {
          fs.watch(dir, (ev, fn) => onFsChange(ev, path.relative(artifactsDir, path.join(dir, fn || ''))));
        } catch {}
      };
      watch(artifactsDir);
      try {
        for (const e of fs.readdirSync(artifactsDir, { withFileTypes: true })) {
          if (e.isDirectory()) watch(path.join(artifactsDir, e.name));
        }
      } catch {}
    }
  } catch (e) {
    // not fatal — server still serves snapshot on poll
    console.warn('bmad-console: fs.watch failed —', e.message);
  }

  // heartbeats every 15s
  setInterval(() => {
    const msg = `event: heartbeat\ndata: ${Date.now()}\n\n`;
    for (const res of sseClients) {
      try {
        res.write(msg);
      } catch {}
    }
  }, 15000).unref();

  // --- HTTP -----------------------------------------------------------------

  const server = http.createServer((req, res) => {
    const u = url.parse(req.url, true);
    const pathname = u.pathname;

    if (req.method !== 'GET') {
      res.writeHead(405);
      res.end('method not allowed');
      return;
    }

    if (pathname === '/' || pathname === '/index.html') {
      serveStatic(res, path.join(webDir, 'index.html'), 'text/html; charset=utf-8', startupTs);
      return;
    }
    if (pathname === '/style.css') {
      serveStatic(res, path.join(webDir, 'style.css'), 'text/css; charset=utf-8', startupTs);
      return;
    }
    if (pathname === '/app.js') {
      serveStatic(res, path.join(webDir, 'app.js'), 'application/javascript; charset=utf-8', startupTs);
      return;
    }
    if (pathname === '/api/state') {
      const state = snapshotState();
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      });
      res.end(JSON.stringify(state));
      return;
    }
    if (pathname === '/api/events') {
      // SSE
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      const initial = snapshotState();
      res.write(`event: state\ndata: ${JSON.stringify(initial)}\n\n`);
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }
    if (pathname === '/api/file') {
      const requested = u.query.path || '';
      if (typeof requested !== 'string' || requested.includes('..') || path.isAbsolute(requested)) {
        res.writeHead(400);
        res.end('bad path');
        return;
      }
      // only serve under artifacts/
      const rel = requested.replace(/^\/+/, '');
      if (!rel.startsWith('artifacts/')) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      const abs = path.join(projectRoot, rel);
      const real = path.resolve(abs);
      if (!real.startsWith(path.resolve(projectRoot))) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      try {
        const body = fs.readFileSync(abs, 'utf8');
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end('not found');
      }
      return;
    }

    res.writeHead(404);
    res.end('not found');
  });

  function serveStatic(res, abs, contentType, ts) {
    fs.readFile(abs, (err, body) => {
      if (err) {
        res.writeHead(404);
        res.end('not found: ' + path.basename(abs));
        return;
      }
      res.writeHead(200, {
        'content-type': contentType,
        'x-bmad-startup': String(ts),
      });
      res.end(body);
    });
  }

  server.listen(port, host, () => {
    const initial = snapshotState();
    const phaseName =
      (initial.phases || []).find((p) => p.status === 'active') ||
      (initial.phases || [])[((initial.phases || []).length - 1) | 0];
    const artifactCount = (initial.activity || []).length;
    console.log('BMAD Console');
    console.log(`listening on http://${host}:${port}`);
    console.log(`project:    ${initial.project ? initial.project.name : 'unknown'}`);
    console.log(`phase:      ${phaseName ? phaseName.name : 'unknown'}`);
    console.log(`artifacts:  ${artifactCount}`);
    console.log('press ctrl+c to stop');
  });

  return server;
}

if (require.main === module) {
  start();
}

module.exports = { start };
