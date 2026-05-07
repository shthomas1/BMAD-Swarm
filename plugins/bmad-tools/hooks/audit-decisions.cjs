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

// v0.2.0 D-ID patterns (P2):
//
//   DECLARED_RE  matches a record heading in the decision log. Real logs in
//                this repo use level-2 headings (`## D-001 — ...`). The schema
//                spec uses level-3 (`### D-NNN: ...`). Tolerate either by
//                accepting any leading `##+` count.
//                Captures the D-ID itself.
//                Examples that match:
//                  "## D-001 — foo"        -> D-001
//                  "### D-022: bar"        -> D-022
//                  "## D-BRN-1 — baz"      -> D-BRN-1
//
//   REFERENCED_RE matches a D-ID anywhere in body text. Accepts:
//                   - D-NNN (3+ digits)
//                   - D-XXX-N (2+ uppercase letters, dash, 1+ digits)
//                 Trailing token must contain a digit, so bare literals like
//                 "D-ID", "D-N", "D-NNN" are rejected (NNN has no digits).
//                 The REJECT set covers literal placeholder tokens explicitly.
const DECLARED_RE = /^#{2,}\s+(D-[A-Z0-9]+(?:-\d+)?)\b/gm;
const REFERENCED_RE = /\bD-(?:\d{3,}|[A-Z]{2,}-\d+)\b/g;
const REJECT = new Set(['D-ID', 'D-N', 'D-NNN']);

function isAcceptedRef(token) {
  if (REJECT.has(token)) return false;
  // Defensive: reject any all-letter trailing segment after the leading "D-".
  const tail = token.slice(2); // strip "D-"
  // Accept if tail is purely digits OR has letters-dash-digits.
  if (/^\d{3,}$/.test(tail)) return true;
  if (/^[A-Z]{2,}-\d+$/.test(tail)) return true;
  return false;
}

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
  let m;
  // Reset lastIndex defensively (regex literals are shared across calls).
  DECLARED_RE.lastIndex = 0;
  while ((m = DECLARED_RE.exec(log)) !== null) declared.add(m[1]);

  const scanRoots = [
    path.join(cwd, 'artifacts', 'planning'),
    path.join(cwd, 'artifacts', 'design'),
    path.join(cwd, 'artifacts', 'implementation'),
  ];
  const referenced = new Set();
  for (const root of scanRoots) {
    const files = readAll(root, ['.md']);
    for (const f of files) {
      let text;
      try { text = fs.readFileSync(f, 'utf-8'); } catch (_) { continue; }
      REFERENCED_RE.lastIndex = 0;
      let r;
      while ((r = REFERENCED_RE.exec(text)) !== null) {
        const tok = r[0];
        if (isAcceptedRef(tok)) referenced.add(tok);
      }
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

// Export the patterns for unit testing.
module.exports = { DECLARED_RE, REFERENCED_RE, REJECT, isAcceptedRef };

if (require.main === module) {
  try { main(); } catch (_) { ok(); }
}
