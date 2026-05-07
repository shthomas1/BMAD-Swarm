// parsers.js — pure functions for turning BMAD artifacts into structured data.
// stdlib only. No deps.

'use strict';

const fs = require('fs');
const path = require('path');

// --- Regex patterns (kept aligned with bmad-tools) -------------------------

// D-IDs as section headings: ## D-001, ## D-022, ## D-BRN-1
const D_ID_DECLARED_RE = /^##\s+(D-(?:[A-Z]{2,}-\d+|\d{3,}))\b/;

// D-IDs referenced inline. Matches D-001, D-022, D-BRN-2 but not D-ID, D-N, D-NNN.
// Implementation: same shape as declared, applied via global match without anchors.
const D_ID_REF_RE = /\bD-(?:\d{3,}|[A-Z]{2,}-\d+)\b/g;

// Story track from filename: story-A-BUG-1.md → "A"; story-7.2.md → null
function trackFromStoryFilename(filename) {
  const base = path.basename(filename).replace(/\.md$/, '');
  // standard numeric pattern story-1.2 → null
  if (/^story-\d+\.\d+$/.test(base)) return null;
  // story-A-... or story-B-... → letter
  const m = /^story-([A-Z])-/.exec(base);
  return m ? m[1] : null;
}

function storyIdFromFilename(filename) {
  const base = path.basename(filename).replace(/\.md$/, '');
  return base.replace(/^story-/, '');
}

// --- Minimal YAML parser ----------------------------------------------------
// Subset: scalars, nested objects (2-space indent), `- item` lists, quoted
// strings, multi-line strings via `>` and `|`. Comments via `#`. Inline
// `[a, b]` and `{a: 1}` flow forms NOT supported (BMAD configs don't use them).

function parseYaml(input) {
  if (typeof input !== 'string') return {};
  const rawLines = input.split(/\r?\n/);

  // Strip BOM
  if (rawLines.length && rawLines[0].charCodeAt(0) === 0xfeff) {
    rawLines[0] = rawLines[0].slice(1);
  }

  // Pre-process into [{indent, raw, content}] dropping comment-only / blank lines
  // BUT we keep blank lines for block-scalar handling — handled inline.
  const lines = rawLines.map((raw) => {
    const indentMatch = /^(\s*)(.*)$/.exec(raw);
    const indent = indentMatch[1].replace(/\t/g, '  ').length;
    const content = indentMatch[2];
    return { indent, raw, content };
  });

  let i = 0;

  function skipIgnorable() {
    while (i < lines.length) {
      const c = lines[i].content;
      if (c === '' || /^\s*#/.test(c)) {
        i++;
        continue;
      }
      break;
    }
  }

  function parseScalar(value) {
    if (value === null || value === undefined) return null;
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === '~' || trimmed === 'null') return null;
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    // quoted string
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed.slice(1, -1);
    }
    // number
    if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
    if (/^-?\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed);
    // strip trailing comment
    const hash = trimmed.indexOf(' #');
    if (hash !== -1) return trimmed.slice(0, hash).trim();
    return trimmed;
  }

  // Parse a block scalar (after `>` or `|`). Returns string and advances i.
  function parseBlockScalar(folded, parentIndent) {
    const collected = [];
    let blockIndent = -1;
    while (i < lines.length) {
      const ln = lines[i];
      // blank lines belong to the block
      if (ln.content === '') {
        collected.push('');
        i++;
        continue;
      }
      if (ln.indent <= parentIndent) break;
      if (blockIndent === -1) blockIndent = ln.indent;
      // text after stripping blockIndent worth of leading spaces
      const stripped = ln.raw.slice(blockIndent).replace(/\t/g, '  ');
      collected.push(stripped);
      i++;
    }
    if (folded) {
      // join non-blank lines with space; preserve paragraph breaks at blank lines
      const out = [];
      let buf = [];
      for (const line of collected) {
        if (line === '') {
          if (buf.length) {
            out.push(buf.join(' '));
            buf = [];
          }
          out.push('');
        } else {
          buf.push(line.trim());
        }
      }
      if (buf.length) out.push(buf.join(' '));
      return out.join('\n').replace(/\n+$/, '');
    }
    return collected.join('\n').replace(/\n+$/, '');
  }

  function parseValue(parentIndent) {
    // Used after we've consumed `key:`. Determines if value follows a block,
    // mapping, list, or inline scalar.
    skipIgnorable();
    if (i >= lines.length) return null;
    const next = lines[i];
    if (next.indent <= parentIndent) return null; // empty value

    if (next.content.startsWith('- ') || next.content === '-') {
      return parseList(next.indent);
    }
    return parseMap(next.indent);
  }

  function parseMap(currentIndent) {
    const obj = {};
    while (i < lines.length) {
      skipIgnorable();
      if (i >= lines.length) break;
      const ln = lines[i];
      if (ln.indent < currentIndent) break;
      if (ln.indent > currentIndent) {
        // skip stray over-indented lines (shouldn't happen with well-formed yaml)
        i++;
        continue;
      }
      const m = /^([^:#]+?):(\s*(.*))?$/.exec(ln.content);
      if (!m) {
        i++;
        continue;
      }
      const key = m[1].trim();
      const rest = (m[3] || '').trim();
      i++;

      if (rest === '|' || rest === '|-' || rest === '|+') {
        obj[key] = parseBlockScalar(false, currentIndent);
      } else if (rest === '>' || rest === '>-' || rest === '>+') {
        obj[key] = parseBlockScalar(true, currentIndent);
      } else if (rest === '') {
        // value continues on next line (nested map / list / empty)
        const value = parseValue(currentIndent);
        obj[key] = value;
      } else {
        obj[key] = parseScalar(rest);
      }
    }
    return obj;
  }

  function parseList(currentIndent) {
    const arr = [];
    while (i < lines.length) {
      skipIgnorable();
      if (i >= lines.length) break;
      const ln = lines[i];
      if (ln.indent < currentIndent) break;
      if (ln.indent > currentIndent) {
        i++;
        continue;
      }
      if (!(ln.content === '-' || ln.content.startsWith('- '))) break;
      const after = ln.content === '-' ? '' : ln.content.slice(2).trim();
      i++;

      if (after === '') {
        // nested map under this list item, or empty
        skipIgnorable();
        if (i < lines.length && lines[i].indent > currentIndent) {
          arr.push(parseMap(lines[i].indent));
        } else {
          arr.push(null);
        }
      } else if (/^[^:#]+?:(\s|$)/.test(after)) {
        // inline mapping start: "- key: value" — treat as a one-line map and
        // continue map parse at currentIndent + 2
        const sub = {};
        const m = /^([^:#]+?):(\s*(.*))?$/.exec(after);
        if (m) {
          const k = m[1].trim();
          const v = (m[3] || '').trim();
          if (v === '|' || v === '|-' || v === '|+') {
            sub[k] = parseBlockScalar(false, currentIndent);
          } else if (v === '>' || v === '>-' || v === '>+') {
            sub[k] = parseBlockScalar(true, currentIndent);
          } else if (v === '') {
            const val = parseValue(currentIndent + 2);
            sub[k] = val;
          } else {
            sub[k] = parseScalar(v);
          }
        }
        // additional keys at deeper indent (typical "- key: v\n  key2: v" form)
        skipIgnorable();
        while (i < lines.length && lines[i].indent === currentIndent + 2) {
          const sub2 = parseMap(currentIndent + 2);
          Object.assign(sub, sub2);
          break;
        }
        arr.push(sub);
      } else {
        arr.push(parseScalar(after));
      }
    }
    return arr;
  }

  // top-level
  skipIgnorable();
  if (i >= lines.length) return {};
  // detect first non-blank indent — usually 0
  const firstIndent = lines[i].indent;
  if (lines[i].content.startsWith('- ') || lines[i].content === '-') {
    return parseList(firstIndent);
  }
  return parseMap(firstIndent);
}

// --- Decision log parser ----------------------------------------------------

function parseDecisionLog(content, relPath) {
  if (!content) return [];
  const lines = content.split(/\r?\n/);
  const decisions = [];
  let current = null;
  let bodyLines = [];

  function flush() {
    if (!current) return;
    // join body
    const body = bodyLines.join('\n');
    // Extract field lines like "- **Date:** 2026-04-16"
    function field(name) {
      const re = new RegExp(`^[\\s\\-]*\\*\\*${name}:\\*\\*\\s*(.*)$`, 'm');
      const m = re.exec(body);
      return m ? m[1].trim() : null;
    }
    const date = field('Date');
    let classification = field('Classification');
    if (classification) {
      // "Strategic (affects ...)" → just first word
      const first = /^([A-Za-z]+)/.exec(classification);
      classification = first ? first[1] : classification;
    }
    const summaryRaw = field('Decision') || field('Context') || '';
    const summary = summaryRaw
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 240);
    const author =
      field('Author') ||
      field('Source') ||
      null;
    const referencedBy = field('Referenced by');
    let affects = [];
    if (referencedBy) {
      affects = referencedBy
        .split(',')
        .map((s) => s.replace(/^`|`$/g, '').trim())
        .filter(Boolean);
    }
    const supersededByRaw = field('Superseded by') || field('Superseded By');
    const supersededBy = supersededByRaw
      ? supersededByRaw.replace(/[`*]/g, '').trim()
      : null;

    current.date = date;
    current.classification = classification;
    current.summary = summary;
    current.author = author;
    current.affects = affects;
    current.supersededBy = supersededBy;
    current.filename = `${relPath}#${current.id}`;
    decisions.push(current);
  }

  for (const raw of lines) {
    const m = D_ID_DECLARED_RE.exec(raw);
    if (m) {
      flush();
      // Title is the rest of the heading after "## D-XXX —"
      const titlePart = raw.replace(/^##\s+\S+\s*[—–-]?\s*/, '').trim();
      current = {
        id: m[1],
        title: titlePart || m[1],
      };
      bodyLines = [];
    } else if (current) {
      bodyLines.push(raw);
    }
  }
  flush();

  // assign phase heuristically based on D-ID classification + content
  for (const d of decisions) {
    d.phase = guessDecisionPhase(d);
  }
  return decisions;
}

function guessDecisionPhase(d) {
  // crude heuristic — strategic decisions skew design; tactical skew implementation
  const id = d.id || '';
  if (id.includes('BRN')) return 'ideation';
  if (/architecture|adr|design/i.test((d.affects || []).join(' '))) return 'design';
  if (/story-|developer|reviewer/i.test((d.affects || []).join(' '))) return 'implementation';
  if (d.classification === 'Strategic') return 'design';
  return 'implementation';
}

// --- Story parser -----------------------------------------------------------

function parseStory(content, filename) {
  const id = storyIdFromFilename(filename);
  const track = trackFromStoryFilename(filename);
  const titleMatch = /^#\s+(?:Story\s+[\w.\-]+:?\s*)?(.+)$/m.exec(content || '');
  const title = titleMatch ? titleMatch[1].trim() : id;

  // status from "## Status: <value>" line
  let status = 'unknown';
  const statusMatch = /^##\s+Status:\s*(.+)$/m.exec(content || '');
  if (statusMatch) {
    status = normalizeStatus(statusMatch[1].trim());
  } else if (/^##\s+Goal/m.test(content || '')) {
    status = 'unknown';
  }

  // domain from "## Domain: <slug>"
  let domain = null;
  const domainMatch = /^##\s+Domain:\s*(.+)$/m.exec(content || '');
  if (domainMatch) domain = domainMatch[1].trim();

  // dependencies — D-IDs referenced in body
  const deps = [];
  const seen = new Set();
  const refMatches = (content || '').matchAll(D_ID_REF_RE);
  for (const m of refMatches) {
    const id = m[0];
    if (id === 'D-ID' || id === 'D-N' || id === 'D-NNN') continue;
    if (!seen.has(id)) {
      seen.add(id);
      deps.push(id);
    }
  }

  // acceptance criteria count — lines starting with "- [" under Acceptance Criteria
  let acceptanceCriteriaCount = 0;
  const acSection = /##\s+Acceptance Criteria([\s\S]*?)(?:^##\s|\Z)/m.exec(content || '');
  if (acSection) {
    const matches = acSection[1].match(/^\s*-\s*\[/gm);
    if (matches) acceptanceCriteriaCount = matches.length;
  }

  return {
    id,
    title,
    status,
    domain,
    track,
    dependencies: deps,
    filename: path.basename(filename),
    acceptanceCriteriaCount,
  };
}

function normalizeStatus(s) {
  const lower = s.toLowerCase();
  if (lower.includes('complete')) return 'complete';
  if (lower.includes('review')) return 'review';
  if (lower.includes('progress')) return 'in-progress';
  if (lower.includes('ready')) return 'ready';
  if (lower.includes('draft')) return 'draft';
  return 'unknown';
}

// --- Review parser ----------------------------------------------------------

function parseReview(content, filename) {
  const id = path.basename(filename).replace(/\.md$/, '');
  const dateMatch = /\*\*Date\*\*:\s*([\d-]{8,10})/m.exec(content || '');
  const date = dateMatch ? dateMatch[1] : null;

  // Count BLOCKING and ADVISORY occurrences as findings markers
  // Look for patterns like "## BLOCKING" or "Severity: BLOCKING"
  const blockers = countMatches(content, /(?:^|\b)BLOCKING\b/gm);
  const advisories = countMatches(content, /(?:^|\b)ADVISORY\b/gm);

  let status;
  if (blockers > 0) status = 'rejected';
  else if (advisories > 0) status = 'mixed';
  else status = 'approved';

  // refine: an explicit "approved" in the summary trumps mixed
  if (status === 'mixed' && /\bapproved\b/i.test(content || '')) {
    // keep mixed — advisories still present; design rule requires approval to be the literal disposition
    // but "approved" wording present → call it approved
    if (/Status:\s*approved/i.test(content) || /reviewer-approved/i.test(content)) {
      status = 'approved';
    }
  }

  return {
    id,
    filename: path.basename(filename),
    date,
    status,
    blockers,
    advisories,
  };
}

function countMatches(text, re) {
  if (!text) return 0;
  const m = text.match(re);
  return m ? m.length : 0;
}

// --- Sprint plan parser -----------------------------------------------------

function parseSprintPlan(content) {
  if (!content) return { tracks: [] };
  const tracks = [];
  // Sections like "## Track A: Bug Fixes (9 stories)"
  const trackHeaders = [...content.matchAll(/^##\s+Track\s+([A-Z]):\s*([^(]+?)(?:\((\d+)\s+stories\))?\s*$/gm)];
  for (const h of trackHeaders) {
    tracks.push({
      letter: h[1],
      name: h[2].trim(),
      storyCount: h[3] ? parseInt(h[3], 10) : null,
    });
  }
  return { tracks };
}

// --- Sniff approval markers -------------------------------------------------

function hasApprovalMarker(content) {
  if (!content) return false;
  if (/Status:\s*approved/i.test(content)) return true;
  if (/Approved\s+by:/i.test(content)) return true;
  if (/^##\s+Approval\s*$/m.test(content)) return true;
  return false;
}

module.exports = {
  D_ID_DECLARED_RE,
  D_ID_REF_RE,
  trackFromStoryFilename,
  storyIdFromFilename,
  parseYaml,
  parseDecisionLog,
  parseStory,
  parseReview,
  parseSprintPlan,
  hasApprovalMarker,
};
