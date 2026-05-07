#!/usr/bin/env node
// bmad-statusline — Claude Code statusLine command.
// Reads the JSON payload from stdin, walks the cwd up looking for a BMAD
// project root, summarizes BMAD-specific state (phase, autonomy, pending
// approvals, agent count, latest D-ID) into one line on stdout.
//
// Hard rules:
//   * Must NEVER throw, NEVER exit non-zero. On any error we degrade
//     gracefully and emit a minimal `◉ <project>` (or `◉ no BMAD project`).
//   * Pure Node stdlib. No deps. Cross-platform paths.
//   * Tight perf budget: read at most ~5 small files (decision-log capped to
//     first 64KB; latest D-IDs live near the top so the cap is harmless).
//
// Output format (single line):
//   ◉ <PROJECT> · <PHASE> · <AUTONOMY> · ⚑<N> · @<count> active · D-<id>
// The ⚑<N> segment is omitted when no pending approvals; the D-<id> segment
// is omitted when no decision log exists.

'use strict';

const fs = require('fs');
const path = require('path');

const MAX_WALK = 12;
const DECISION_LOG_HEAD_BYTES = 64 * 1024;
const PROJECT_NAME_MAX = 24;

// ANSI helpers ---------------------------------------------------------------

function colors() {
  // NO_COLOR (https://no-color.org/) — any non-empty value disables color.
  if (process.env.NO_COLOR) {
    const ident = (s) => s;
    return { phosphor: ident, amber: ident, dim: ident, reset: '' };
  }
  return {
    // Phosphor green ~ classic CRT terminal: 256-color 46 (bright green).
    phosphor: (s) => `\x1b[38;5;46m${s}\x1b[0m`,
    // Amber ~ 256-color 214 (orange-amber).
    amber: (s) => `\x1b[38;5;214m${s}\x1b[0m`,
    // Dim default for separators.
    dim: (s) => `\x1b[2m${s}\x1b[0m`,
    reset: '\x1b[0m',
  };
}

// stdin reader (sync, bounded) ----------------------------------------------

function readStdinSync() {
  // Claude Code feeds a small JSON payload. Read up to 64KB synchronously.
  // If stdin is a TTY (manual run) we don't want to block — use a try/catch.
  try {
    const buf = Buffer.alloc(64 * 1024);
    const fd = 0;
    const n = fs.readSync(fd, buf, 0, buf.length, null);
    return buf.slice(0, n).toString('utf-8');
  } catch (_) {
    return '';
  }
}

function parsePayload(raw) {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch (_) {
    return {};
  }
}

// Tiny indent-based YAML parser (covers what we need: top-level keys, nested
// objects, simple scalars, list items as map keys via `name:` entries).
// Inline flow-style (`{a: 1}`, `[a, b]`) is NOT supported — BMAD configs
// don't use it, mirroring the bmad-console parser.

function parseYaml(input) {
  if (typeof input !== 'string') return {};
  const rawLines = input.split(/\r?\n/);
  if (rawLines.length && rawLines[0].charCodeAt(0) === 0xfeff) {
    rawLines[0] = rawLines[0].slice(1);
  }
  const lines = rawLines.map((raw) => {
    const m = /^(\s*)(.*)$/.exec(raw);
    const indent = m[1].replace(/\t/g, '  ').length;
    return { indent, content: m[2] };
  });

  let i = 0;

  function skip() {
    while (i < lines.length) {
      const c = lines[i].content;
      if (c === '' || /^\s*#/.test(c)) { i++; continue; }
      break;
    }
  }

  function scalar(v) {
    if (v == null) return null;
    let t = String(v).trim();
    if (t === '' || t === '~' || t === 'null') return null;
    if (t === 'true') return true;
    if (t === 'false') return false;
    if ((t.startsWith('"') && t.endsWith('"')) ||
        (t.startsWith("'") && t.endsWith("'"))) {
      return t.slice(1, -1);
    }
    if (/^-?\d+$/.test(t)) return parseInt(t, 10);
    if (/^-?\d+\.\d+$/.test(t)) return parseFloat(t);
    const hash = t.indexOf(' #');
    if (hash !== -1) t = t.slice(0, hash).trim();
    return t;
  }

  function parseValue(parentIndent) {
    skip();
    if (i >= lines.length) return null;
    const next = lines[i];
    if (next.indent <= parentIndent) return null;
    if (next.content.startsWith('- ') || next.content === '-') {
      return parseList(next.indent);
    }
    return parseMap(next.indent);
  }

  function parseMap(currentIndent) {
    const obj = {};
    while (i < lines.length) {
      skip();
      if (i >= lines.length) break;
      const ln = lines[i];
      if (ln.indent < currentIndent) break;
      if (ln.indent > currentIndent) { i++; continue; }
      const m = /^([^:#]+?):(\s*(.*))?$/.exec(ln.content);
      if (!m) { i++; continue; }
      const key = m[1].trim();
      const rest = (m[3] || '').trim();
      i++;
      if (rest === '') {
        obj[key] = parseValue(currentIndent);
      } else if (rest === '|' || rest === '>' || rest === '|-' || rest === '>-' ||
                 rest === '|+' || rest === '>+') {
        // skip block-scalar bodies — not needed by statusline
        while (i < lines.length && (lines[i].content === '' || lines[i].indent > currentIndent)) i++;
        obj[key] = '';
      } else {
        obj[key] = scalar(rest);
      }
    }
    return obj;
  }

  function parseList(currentIndent) {
    const arr = [];
    while (i < lines.length) {
      skip();
      if (i >= lines.length) break;
      const ln = lines[i];
      if (ln.indent < currentIndent) break;
      if (ln.indent > currentIndent) { i++; continue; }
      if (!(ln.content === '-' || ln.content.startsWith('- '))) break;
      const after = ln.content === '-' ? '' : ln.content.slice(2).trim();
      i++;
      if (after === '') {
        skip();
        if (i < lines.length && lines[i].indent > currentIndent) {
          arr.push(parseMap(lines[i].indent));
        } else {
          arr.push(null);
        }
      } else if (/^[^:#]+?:(\s|$)/.test(after)) {
        const sub = {};
        const m = /^([^:#]+?):(\s*(.*))?$/.exec(after);
        if (m) {
          const k = m[1].trim();
          const v = (m[3] || '').trim();
          sub[k] = v === '' ? parseValue(currentIndent + 2) : scalar(v);
        }
        skip();
        while (i < lines.length && lines[i].indent === currentIndent + 2) {
          Object.assign(sub, parseMap(currentIndent + 2));
          break;
        }
        arr.push(sub);
      } else {
        arr.push(scalar(after));
      }
    }
    return arr;
  }

  skip();
  if (i >= lines.length) return {};
  if (lines[i].content.startsWith('- ') || lines[i].content === '-') {
    return parseList(lines[i].indent);
  }
  return parseMap(lines[i].indent);
}

// Project root walk ----------------------------------------------------------

function findProjectRoot(start) {
  let dir = start;
  for (let depth = 0; depth < MAX_WALK; depth++) {
    try {
      const swarmYaml = path.join(dir, 'swarm.yaml');
      const projectYaml = path.join(dir, 'project.yaml');
      if (fs.existsSync(swarmYaml) || fs.existsSync(projectYaml)) {
        return dir;
      }
    } catch (_) { /* keep walking */ }
    const parent = path.dirname(dir);
    if (!parent || parent === dir) break;
    dir = parent;
  }
  return null;
}

// Decision log: read first 64KB and grab the *highest* D-ID. "Highest" here
// is by a structural comparator: pure-numeric `D-NNN` form is preferred over
// the domain-tagged `D-XXX-N` form (the former is the canonical sequence;
// the latter is a side-tracked feature stream like `D-BRN-4`). Within each
// form we pick the largest trailing integer.
//
// Same regex shape as bmad-tools/audit-decisions.cjs DECLARED_RE.
const D_ID_DECLARED_LINE_RE = /^##\s+(D-[A-Z0-9]+(?:-\d+)?)\b/;

function decisionIdRank(id) {
  // Returns [familyRank, numericValue]. Higher is "more recent / more
  // canonical". Pure D-NNN family ranks above any tagged D-XXX-N family.
  const numericOnly = /^D-(\d+)$/.exec(id);
  if (numericOnly) return [2, parseInt(numericOnly[1], 10)];
  const tagged = /^D-[A-Z]{2,}-(\d+)$/.exec(id);
  if (tagged) return [1, parseInt(tagged[1], 10)];
  return [0, 0];
}

function rankCmp(a, b) {
  if (a[0] !== b[0]) return a[0] - b[0];
  return a[1] - b[1];
}

function latestDecisionId(rootDir) {
  const p = path.join(rootDir, 'artifacts', 'context', 'decision-log.md');
  let fd;
  try {
    fd = fs.openSync(p, 'r');
  } catch (_) { return null; }
  try {
    const buf = Buffer.alloc(DECISION_LOG_HEAD_BYTES);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    const head = buf.slice(0, n).toString('utf-8');
    const lines = head.split(/\r?\n/);
    let best = null;
    let bestRank = null;
    for (const line of lines) {
      const m = D_ID_DECLARED_LINE_RE.exec(line);
      if (!m) continue;
      const id = m[1];
      const r = decisionIdRank(id);
      if (best === null || rankCmp(r, bestRank) > 0) {
        best = id;
        bestRank = r;
      }
    }
    return best;
  } catch (_) {
    return null;
  } finally {
    try { fs.closeSync(fd); } catch (_) { /* ignore */ }
  }
}

// Approval scan: check prd*.md and architecture*.md for an approval marker.

function hasApprovalMarker(content) {
  if (!content) return false;
  if (/Status:\s*approved/i.test(content)) return true;
  if (/Approved\s+by:/i.test(content)) return true;
  if (/^##\s+Approval\s*$/m.test(content)) return true;
  return false;
}

function pendingApprovals(rootDir) {
  let pending = 0;
  const targets = [
    { dir: path.join(rootDir, 'artifacts', 'planning'), prefix: 'prd' },
    { dir: path.join(rootDir, 'artifacts', 'design'), prefix: 'architecture' },
  ];
  for (const t of targets) {
    let entries;
    try { entries = fs.readdirSync(t.dir); }
    catch (_) { continue; }
    for (const name of entries) {
      const lower = name.toLowerCase();
      if (!lower.startsWith(t.prefix)) continue;
      if (!lower.endsWith('.md')) continue;
      const full = path.join(t.dir, name);
      let head = '';
      try {
        const fd = fs.openSync(full, 'r');
        const buf = Buffer.alloc(16 * 1024);
        const n = fs.readSync(fd, buf, 0, buf.length, 0);
        head = buf.slice(0, n).toString('utf-8');
        fs.closeSync(fd);
      } catch (_) { /* treat as unparseable → not pending, skip */ continue; }
      if (!hasApprovalMarker(head)) pending++;
    }
  }
  return pending;
}

// Phase definitions for fallback agent counts. Mirrors the orchestrator's
// rough understanding of phase ownership; only used when no `team:` block
// exists in swarm.yaml.
const PHASE_AGENT_COUNT = {
  ideation: 1,
  exploration: 2,
  definition: 2,
  design: 2,
  implementation: 3,
  delivery: 4,
};

function countAgents(swarm, phaseName) {
  if (swarm && Array.isArray(swarm.team) && swarm.team.length) return swarm.team.length;
  if (swarm && swarm.team && typeof swarm.team === 'object') {
    if (Array.isArray(swarm.team.members)) return swarm.team.members.length;
    const keys = Object.keys(swarm.team).filter((k) => k !== 'mode' && k !== 'fallback');
    if (keys.length) return keys.length;
  }
  if (phaseName) {
    const c = PHASE_AGENT_COUNT[String(phaseName).toLowerCase()];
    if (c) return c;
  }
  return null; // unknown
}

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf-8'); } catch (_) { return null; }
}

function truncateName(name) {
  if (!name) return 'project';
  if (name.length <= PROJECT_NAME_MAX) return name;
  return name.slice(0, PROJECT_NAME_MAX - 1) + '…';
}

function build(rootDir) {
  const c = colors();

  const projectYaml = parseYaml(readFileSafe(path.join(rootDir, 'project.yaml')) || '');
  const swarmYaml = parseYaml(readFileSafe(path.join(rootDir, 'swarm.yaml')) || '');

  const projectName = truncateName(
    (projectYaml && projectYaml.project && projectYaml.project.name) ||
    (swarmYaml && swarmYaml.project && swarmYaml.project.name) ||
    path.basename(rootDir)
  );

  const phaseRaw = (projectYaml && projectYaml.phase) ||
                   (swarmYaml && swarmYaml.phase) ||
                   'unknown';
  const phase = String(phaseRaw).toUpperCase();

  const autonomy = (swarmYaml && swarmYaml.methodology && swarmYaml.methodology.autonomy) || 'unknown';

  const lastId = latestDecisionId(rootDir);
  const pending = pendingApprovals(rootDir);
  const agents = countAgents(swarmYaml, phaseRaw);

  const sep = c.dim(' · ');
  const parts = [
    c.phosphor('◉') + ' ' + c.phosphor(projectName),
    phase,
    String(autonomy),
  ];
  if (pending > 0) parts.push(c.amber('⚑' + pending));
  parts.push('@' + (agents == null ? '?' : agents) + ' active');
  if (lastId) parts.push(lastId);

  return parts.join(sep);
}

function minimal(name) {
  const c = colors();
  const safeName = truncateName(name || 'project');
  return c.phosphor('◉') + ' ' + c.phosphor(safeName);
}

function main() {
  const c = colors();
  let payload = {};
  try {
    const raw = readStdinSync();
    payload = parsePayload(raw);
  } catch (_) { payload = {}; }

  let cwd;
  try { cwd = (payload && typeof payload.cwd === 'string' && payload.cwd) || process.cwd(); }
  catch (_) { cwd = '.'; }

  let root = null;
  try { root = findProjectRoot(cwd); } catch (_) { root = null; }

  let line;
  if (!root) {
    line = c.phosphor('◉') + ' no BMAD project';
  } else {
    try {
      line = build(root);
    } catch (_) {
      // Last-ditch fallback: project name only.
      let name;
      try { name = path.basename(root); } catch (_) { name = 'project'; }
      line = minimal(name);
    }
  }

  // Strip leading/trailing whitespace; Claude Code prints stdout verbatim.
  try { process.stdout.write(String(line).replace(/^\s+|\s+$/g, '')); }
  catch (_) { /* swallow */ }
}

if (require.main === module) {
  try { main(); } catch (_) { /* never throw */ }
  // Always exit 0.
  process.exit(0);
}

module.exports = {
  parseYaml,
  findProjectRoot,
  latestDecisionId,
  pendingApprovals,
  countAgents,
  hasApprovalMarker,
  truncateName,
  build,
  D_ID_DECLARED_LINE_RE,
};
