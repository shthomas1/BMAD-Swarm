#!/usr/bin/env node
// bmad-tools: audit-decisions PreToolUse hook (advisory, off-by-default)
// Triggered on Bash tool calls that look like `git commit`. Walks the
// decision log, greps the artifact tree for D-IDs, and prints a warning to
// stderr if there are orphan or dangling references. Exits 0 in all cases —
// this hook never blocks a commit; it is purely advisory until matured.
// Failures are silent: never break the user's commit because of a broken hook.

'use strict';

const fs = require('fs');
const path = require('path');

function ok() { process.exit(0); }

function readAll(dir, exts) {
  const out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return out; }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...readAll(full, exts));
    else if (ent.isFile() && exts.some((e) => full.toLowerCase().endsWith(e))) out.push(full);
  }
  return out;
}

function main() {
  let raw = '';
  try { raw = fs.readFileSync(0, 'utf-8'); } catch (_) { return ok(); }

  let event;
  try { event = JSON.parse(raw); } catch (_) { return ok(); }

  const cmd = (event.tool_input && event.tool_input.command) || '';
  if (!/\bgit\s+commit\b/.test(cmd)) return ok();

  const cwd = process.cwd();
  const logPath = path.join(cwd, 'artifacts', 'context', 'decision-log.md');
  if (!fs.existsSync(logPath)) return ok();

  let log;
  try { log = fs.readFileSync(logPath, 'utf-8'); } catch (_) { return ok(); }

  const declared = new Set();
  const declRe = /^###\s+(D-\d{3,})\s*:/gm;
  let m;
  while ((m = declRe.exec(log)) !== null) declared.add(m[1]);

  const scanRoots = [
    path.join(cwd, 'artifacts', 'planning'),
    path.join(cwd, 'artifacts', 'design'),
    path.join(cwd, 'artifacts', 'implementation'),
  ];
  const referenced = new Set();
  const refRe = /\bD-\d{3,}\b/g;
  for (const root of scanRoots) {
    const files = readAll(root, ['.md']);
    for (const f of files) {
      let text;
      try { text = fs.readFileSync(f, 'utf-8'); } catch (_) { continue; }
      let r;
      while ((r = refRe.exec(text)) !== null) referenced.add(r[0]);
    }
  }

  const orphans = [...declared].filter((d) => !referenced.has(d)).sort();
  const dangling = [...referenced].filter((d) => !declared.has(d)).sort();

  if (orphans.length === 0 && dangling.length === 0) return ok();

  const lines = ['bmad-tools audit-decisions (advisory):'];
  if (orphans.length) lines.push(`  Orphan D-IDs (declared, never referenced): ${orphans.join(', ')}`);
  if (dangling.length) lines.push(`  Dangling D-IDs (referenced, not in log): ${dangling.join(', ')}`);
  lines.push('  Run /bmad-tools:audit-decisions for the full report. (Advisory only — commit not blocked.)');
  try { process.stderr.write(lines.join('\n') + '\n'); } catch (_) { /* swallow */ }

  return ok();
}

try { main(); } catch (_) { ok(); }
