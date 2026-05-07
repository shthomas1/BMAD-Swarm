#!/usr/bin/env node
// bmad-tools: validate-artifact PreToolUse hook
// Schema-checks BMAD artifacts on Write events into artifacts/planning/ or
// artifacts/implementation/. v0.2.0 adds an "advisory" mode (default) which
// emits a warning to stderr but allows the write; "strict" mode preserves the
// v0.1.0 deny behavior. Mode is read from
// ${CLAUDE_PLUGIN_DIR}/.claude-plugin/plugin.json under "config.validatorMode".
// Fails open on any unexpected error so the user is never blocked
// by a broken hook.

'use strict';

const fs = require('fs');
const path = require('path');

function readMode() {
  // Read the plugin's own plugin.json to determine validator mode.
  // CLAUDE_PLUGIN_DIR is set by Claude Code when invoking the hook;
  // when missing (e.g. CLI testing) we fall back to the path relative
  // to this script.
  const dir = process.env.CLAUDE_PLUGIN_DIR || path.resolve(__dirname, '..');
  const cfgPath = path.join(dir, '.claude-plugin', 'plugin.json');
  try {
    const txt = fs.readFileSync(cfgPath, 'utf-8');
    const obj = JSON.parse(txt);
    const m = obj && obj.config && obj.config.validatorMode;
    if (m === 'strict' || m === 'advisory') return m;
  } catch (_) { /* fall through */ }
  return 'advisory';
}

function denyStrict(reason) {
  try {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }));
  } catch (_) { /* swallow */ }
  process.exit(2);
}

function warnAdvisory(reason) {
  try {
    process.stderr.write('bmad-tools validate-artifact (advisory):\n' + reason + '\n');
  } catch (_) { /* swallow */ }
  try {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        permissionDecisionReason: 'bmad-tools validate-artifact: advisory warnings emitted to stderr; write allowed.',
      },
    }));
  } catch (_) { /* swallow */ }
  process.exit(1);
}

function ok() { process.exit(0); }

function classify(filePath) {
  const norm = filePath.replace(/\\/g, '/').toLowerCase();
  if (!norm.endsWith('.md')) return null;
  // Only validate paths under artifacts/planning/ or artifacts/implementation/
  if (!/(?:^|\/)artifacts\/(planning|implementation)\//.test(norm)) return null;
  const base = path.basename(norm);
  if (/(?:^|\/)artifacts\/implementation\/stories\//.test(norm) || /^story[-.]/.test(base) || /^story-\d/.test(base)) return 'story';
  if (base.includes('prd')) return 'prd';
  if (base.includes('architecture')) return 'architecture';
  if (base.includes('epic')) return 'epic';
  if (base.includes('brainstorm')) return 'brainstorm';
  // Default: light check (must have at least one heading)
  return 'generic';
}

function checkStory(content) {
  const issues = [];
  if (!/^##\s+Acceptance Criteria\b/m.test(content)) {
    issues.push('Story is missing required `## Acceptance Criteria` section.');
  }
  if (!/^##\s+Dev Notes\b/m.test(content)) {
    issues.push('Story is missing required `## Dev Notes` section.');
  }
  // Accept `## Goal` as a legacy alias for `## User Story`.
  if (!/^##\s+User Story\b/m.test(content) && !/^##\s+Goal\b/m.test(content)) {
    issues.push('Story is missing required `## User Story` section (legacy `## Goal` also accepted).');
  }
  if (!/^##\s+Status:/m.test(content) && !/^##\s+Status\b/m.test(content)) {
    issues.push('Story is missing `## Status:` line.');
  }
  return issues;
}

function checkPrd(content) {
  const issues = [];
  // Must have numbered functional requirements (FR-NNN) and non-functional (NFR-...)
  if (!/\bFR-\d{2,}\b/.test(content)) {
    issues.push('PRD is missing numbered functional requirements (expected `FR-NNN` identifiers).');
  }
  if (!/\bNFR-[A-Z]*\d{2,}\b/.test(content) && !/Non-Functional Requirements/i.test(content)) {
    issues.push('PRD is missing Non-Functional Requirements section or `NFR-...` identifiers.');
  }
  if (!/^##\s+\d+\.\s+Functional Requirements\b/m.test(content) && !/^##\s+Functional Requirements\b/m.test(content)) {
    issues.push('PRD is missing `## Functional Requirements` section.');
  }
  if (!/Success Criteria/i.test(content)) {
    issues.push('PRD is missing a Success Criteria section.');
  }
  return issues;
}

function checkArchitecture(content) {
  const issues = [];
  if (!/\bADR-\d{2,}\b/.test(content) && !/Architectural Decisions/i.test(content) && !/Key Architectural Decisions/i.test(content)) {
    issues.push('Architecture is missing ADRs / Key Architectural Decisions section (no `ADR-NNN` identifiers found).');
  }
  if (!/Technology Stack/i.test(content)) {
    issues.push('Architecture is missing `Technology Stack` section.');
  }
  if (!/Data Models/i.test(content) && !/Data Model/i.test(content)) {
    issues.push('Architecture is missing `Data Models` section.');
  }
  return issues;
}

function checkEpic(content) {
  const issues = [];
  if (!/Epic\s+\d/i.test(content)) {
    issues.push('Epic file does not declare an `Epic <N>` heading.');
  }
  if (!/Acceptance Criteria/i.test(content) && !/Given\b.*When\b.*Then\b/is.test(content)) {
    issues.push('Epic file has no acceptance criteria or BDD (Given/When/Then) blocks.');
  }
  return issues;
}

function checkGeneric(content) {
  const issues = [];
  if (!/^#\s+\S/m.test(content)) {
    issues.push('Markdown file has no top-level `#` heading.');
  }
  return issues;
}

function main() {
  let raw = '';
  try {
    raw = require('fs').readFileSync(0, 'utf-8');
  } catch (_) { return ok(); }

  let event;
  try { event = JSON.parse(raw); } catch (_) { return ok(); }

  const toolName = event.tool_name || event.tool || '';
  const toolInput = event.tool_input || {};
  const filePath = toolInput.file_path || toolInput.path || '';
  if (!filePath) return ok();

  // Only validate Write events. For Edit, applying the diff to verify the
  // post-edit content is fragile — fail open per the build spec.
  const isWrite = /write/i.test(toolName) || (typeof toolInput.content === 'string' && !toolInput.old_string && !toolInput.new_string);
  if (!isWrite) return ok();

  const kind = classify(filePath);
  if (!kind) return ok();

  const content = typeof toolInput.content === 'string' ? toolInput.content : '';
  if (!content) return ok();

  let issues = [];
  try {
    if (kind === 'story') issues = checkStory(content);
    else if (kind === 'prd') issues = checkPrd(content);
    else if (kind === 'architecture') issues = checkArchitecture(content);
    else if (kind === 'epic') issues = checkEpic(content);
    else issues = checkGeneric(content);
  } catch (_) { return ok(); }

  if (issues.length === 0) return ok();

  const reason = [
    `bmad-tools validate-artifact: ${kind} schema check failed for ${filePath}.`,
    ...issues.map((i) => `  - ${i}`),
    'Fix the artifact to satisfy the schema in methodology/artifact-schemas/, or run /bmad-tools:validate-artifact for guidance.',
  ].join('\n');

  const mode = readMode();
  if (mode === 'strict') return denyStrict(reason);
  return warnAdvisory(reason);
}

try { main(); } catch (_) { ok(); }
