// writer.cjs — write endpoints + path allowlist + gate transitions.
// stdlib only. No deps.
'use strict';

const fs = require('fs');
const path = require('path');

// Path allowlist for PUT /api/artifact. Each entry is either a literal
// relative path or a regex applied to the relative path string.
const ALLOWLIST = [
  /^artifacts\/planning\/product-brief\.md$/,
  /^artifacts\/planning\/prd\.md$/,
  /^artifacts\/exploration\/[A-Za-z0-9_\-.]+\.md$/,
  /^artifacts\/design\/architecture\.md$/,
  /^artifacts\/design\/decisions\/adr-[A-Za-z0-9_\-.]+\.md$/,
  /^artifacts\/implementation\/stories\/story-[A-Za-z0-9_\-.]+\.md$/,
];

function isAllowedPath(rel) {
  if (typeof rel !== 'string') return false;
  if (rel === '') return false;
  // Reject any traversal or absolute paths early.
  if (rel.includes('..')) return false;
  if (path.isAbsolute(rel)) return false;
  if (rel.includes('\\')) return false; // require forward slashes
  if (rel.includes('\0')) return false;
  for (const rx of ALLOWLIST) {
    if (rx.test(rel)) return true;
  }
  return false;
}

// Phase ID → artifact path that approval markers should be written to.
const APPROVAL_TARGETS = {
  definition: 'artifacts/planning/prd.md',
  design: 'artifacts/design/architecture.md',
  // Other phases use generic stamping on whatever the project.yaml phase is.
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    const MAX = 5 * 1024 * 1024; // 5 MB sanity cap
    req.on('data', (c) => {
      total += c.length;
      if (total > MAX) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function jsonReply(res, code, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

// Update project.yaml phase + status. Preserves other top-level keys and
// indentation by doing a line-based rewrite (no full YAML re-emit).
function updateProjectYamlPhase(projectRoot, newPhase) {
  const yamlPath = path.join(projectRoot, 'project.yaml');
  let raw;
  try {
    raw = fs.readFileSync(yamlPath, 'utf8');
  } catch (e) {
    // File missing — create a minimal one.
    raw = '';
  }
  const lines = raw.split(/\r?\n/);
  let sawPhase = false;
  let sawStatus = false;
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)phase\s*:\s*(.*)$/.exec(lines[i]);
    if (m && m[1] === '') {
      lines[i] = `phase: ${newPhase}`;
      sawPhase = true;
      continue;
    }
    const ms = /^(\s*)status\s*:\s*(.*)$/.exec(lines[i]);
    if (ms && ms[1] === '') {
      lines[i] = 'status: in-progress';
      sawStatus = true;
    }
  }
  if (!sawPhase) {
    if (lines.length && lines[lines.length - 1] === '') lines.pop();
    lines.push(`phase: ${newPhase}`);
  }
  if (!sawStatus) {
    lines.push('status: in-progress');
  }
  // Trailing newline.
  let out = lines.join('\n');
  if (!out.endsWith('\n')) out += '\n';
  fs.writeFileSync(yamlPath, out, 'utf8');
}

function appendApprovalMarker(absPath, action, note) {
  const user =
    (process.env.USER || process.env.USERNAME || 'unknown').trim() || 'unknown';
  const iso = new Date().toISOString();
  let block = '';
  if (action === 'approve') {
    block = `\n\n---\nApproved-by: ${user}\nApproved-on: ${iso}\n`;
  } else if (action === 'needs-revision') {
    const safeNote = (note || '').toString().replace(/\r?\n/g, ' ').slice(0, 1000);
    block = `\n\n---\nStatus: needs-revision\nNote: ${safeNote}\nReviewed-by: ${user}\nReviewed-on: ${iso}\n`;
  }
  fs.appendFileSync(absPath, block, 'utf8');
}

function findApprovalTargetForPhase(projectRoot, phase) {
  const target = APPROVAL_TARGETS[phase];
  if (!target) return null;
  const abs = path.join(projectRoot, target);
  if (!fs.existsSync(abs)) return null;
  return { rel: target, abs };
}

// handleWriterRequest dispatches by URL. Returns true if it handled the
// request, false otherwise (so start.cjs can fall through to its own routes).
async function handleWriterRequest(req, res, ctx) {
  const { projectRoot, demo, broadcast } = ctx;
  const u = new URL(req.url, 'http://127.0.0.1');
  const pathname = u.pathname;

  if (pathname === '/api/artifact' && req.method === 'PUT') {
    if (demo) {
      return jsonReply(res, 403, { error: 'demo mode is read-only' });
    }
    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      return jsonReply(res, 400, { error: 'bad body: ' + e.message });
    }
    let parsed;
    try {
      parsed = JSON.parse(body || '{}');
    } catch {
      return jsonReply(res, 400, { error: 'invalid JSON' });
    }
    const rel = (parsed.path || '').toString().replace(/^\/+/, '').replace(/\\/g, '/');
    const content = parsed.content == null ? '' : String(parsed.content);
    if (!isAllowedPath(rel)) {
      return jsonReply(res, 403, { error: 'path not in allowlist', path: rel });
    }
    const abs = path.join(projectRoot, rel);
    const real = path.resolve(abs);
    if (!real.startsWith(path.resolve(projectRoot) + path.sep) && real !== path.resolve(projectRoot)) {
      return jsonReply(res, 403, { error: 'forbidden' });
    }
    try {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content, 'utf8');
    } catch (e) {
      return jsonReply(res, 500, { error: 'write failed: ' + e.message });
    }
    if (broadcast) broadcast({ type: 'write', path: rel, action: 'put' });
    return jsonReply(res, 200, {
      ok: true,
      path: rel,
      bytes: Buffer.byteLength(content),
    });
  }

  if (pathname === '/api/gate' && req.method === 'POST') {
    if (demo) {
      return jsonReply(res, 403, { error: 'demo mode is read-only' });
    }
    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      return jsonReply(res, 400, { error: 'bad body: ' + e.message });
    }
    let parsed;
    try {
      parsed = JSON.parse(body || '{}');
    } catch {
      return jsonReply(res, 400, { error: 'invalid JSON' });
    }
    const phase = (parsed.phase || '').toString();
    const action = (parsed.action || '').toString();
    const note = parsed.note;
    if (!phase) {
      return jsonReply(res, 400, { error: 'phase is required' });
    }
    if (!['pass', 'approve', 'needs-revision'].includes(action)) {
      return jsonReply(res, 400, { error: 'action must be pass | approve | needs-revision' });
    }

    if (action === 'pass') {
      try {
        updateProjectYamlPhase(projectRoot, phase);
      } catch (e) {
        return jsonReply(res, 500, { error: 'project.yaml update failed: ' + e.message });
      }
      if (broadcast) broadcast({ type: 'write', path: 'project.yaml', action: 'gate-pass' });
      return jsonReply(res, 200, { ok: true, phase, action });
    }

    if (action === 'approve' || action === 'needs-revision') {
      const target = findApprovalTargetForPhase(projectRoot, phase);
      if (!target) {
        return jsonReply(res, 404, {
          error: `no approval target found for phase=${phase}`,
        });
      }
      try {
        appendApprovalMarker(target.abs, action, note);
      } catch (e) {
        return jsonReply(res, 500, { error: 'append failed: ' + e.message });
      }
      if (broadcast) broadcast({ type: 'write', path: target.rel, action });
      return jsonReply(res, 200, { ok: true, phase, action, path: target.rel });
    }

    return jsonReply(res, 400, { error: 'unhandled action' });
  }

  return false;
}

module.exports = {
  handleWriterRequest,
  isAllowedPath, // exposed for tests
  ALLOWLIST,
  updateProjectYamlPhase,
  appendApprovalMarker,
};
