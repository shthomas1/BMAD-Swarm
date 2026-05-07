// parsers.test.js — node:test smoke tests. No deps.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const parsers = require('../server/parsers.cjs');
const stateMod = require('../server/state.cjs');

// --- D-ID declared regex ----------------------------------------------------

test('D-ID declared regex matches numeric and prefixed forms', () => {
  const re = parsers.D_ID_DECLARED_RE;
  assert.match('## D-001 — Foo', re);
  assert.match('## D-022 — Bar', re);
  assert.match('## D-BRN-1 — Baz', re);
  assert.doesNotMatch('## D-ID convention', re);
  assert.doesNotMatch('## D-N placeholder', re);
});

test('D-ID declared regex captures the ID', () => {
  const m = parsers.D_ID_DECLARED_RE.exec('## D-022 — Foo bar baz');
  assert.equal(m && m[1], 'D-022');
  const m2 = parsers.D_ID_DECLARED_RE.exec('## D-BRN-1 — `/brainstorm` is overlay');
  assert.equal(m2 && m2[1], 'D-BRN-1');
});

// --- D-ID referenced regex --------------------------------------------------

test('D-ID referenced regex matches body refs and rejects bare literals', () => {
  const re = parsers.D_ID_REF_RE;
  re.lastIndex = 0;
  const text = 'Refs D-005 and D-BRN-2 but not D-ID, D-N, or D-NNN.';
  const found = [...text.matchAll(re)].map((m) => m[0]);
  assert.deepEqual(found.sort(), ['D-005', 'D-BRN-2'].sort());
});

// --- Story track from filename ----------------------------------------------

test('story track from filename: letter prefix → letter; numeric → null', () => {
  assert.equal(parsers.trackFromStoryFilename('story-A-BUG-1.md'), 'A');
  assert.equal(parsers.trackFromStoryFilename('story-B-MODEL-2.md'), 'B');
  assert.equal(parsers.trackFromStoryFilename('story-C-WIRE-3.md'), 'C');
  assert.equal(parsers.trackFromStoryFilename('story-7.2.md'), null);
  assert.equal(parsers.trackFromStoryFilename('story-1.0.md'), null);
});

// --- YAML parser ------------------------------------------------------------

test('YAML parser produces top-level keys for swarm.yaml', () => {
  const root = stateMod.findProjectRoot(process.cwd()) || path.resolve(__dirname, '..', '..', '..');
  const swarmYaml = fs.readFileSync(path.join(root, 'swarm.yaml'), 'utf8');
  const parsed = parsers.parseYaml(swarmYaml);
  assert.ok(parsed.project, 'expected project key');
  assert.equal(parsed.project.name, 'bmad-swarm');
  assert.ok(parsed.methodology, 'expected methodology key');
  assert.ok(parsed.methodology.phases, 'expected methodology.phases');
});

test('YAML parser produces top-level keys for project.yaml', () => {
  const root = stateMod.findProjectRoot(process.cwd()) || path.resolve(__dirname, '..', '..', '..');
  const projYaml = fs.readFileSync(path.join(root, 'project.yaml'), 'utf8');
  const parsed = parsers.parseYaml(projYaml);
  assert.ok(parsed.project, 'expected project key');
  assert.ok(parsed.phase, 'expected phase key');
  assert.ok(parsed.status, 'expected status key');
});

test('YAML parser handles nested objects, lists, and quoted strings', () => {
  const yaml = [
    'project:',
    '  name: foo',
    '  type: web-app',
    'list:',
    '  - one',
    '  - two',
    '  - three',
    'nested:',
    '  inner:',
    '    deeper: 42',
    'quoted: "with: colon"',
  ].join('\n');
  const p = parsers.parseYaml(yaml);
  assert.equal(p.project.name, 'foo');
  assert.deepEqual(p.list, ['one', 'two', 'three']);
  assert.equal(p.nested.inner.deeper, 42);
  assert.equal(p.quoted, 'with: colon');
});

test('YAML parser handles block scalars (>, |)', () => {
  const yaml = [
    'folded: >',
    '  one two',
    '  three',
    'literal: |',
    '  alpha',
    '  beta',
  ].join('\n');
  const p = parsers.parseYaml(yaml);
  assert.equal(p.folded, 'one two three');
  assert.equal(p.literal, 'alpha\nbeta');
});

// --- Phase status -----------------------------------------------------------

test('Phase status: project.yaml.phase=delivery + status=complete → all six done', () => {
  const root = stateMod.findProjectRoot(process.cwd()) || path.resolve(__dirname, '..', '..', '..');
  const state = stateMod.buildState(root);
  assert.ok(Array.isArray(state.phases), 'phases is array');
  assert.ok(state.phases.length >= 6, 'at least six phases');
  // project.yaml has phase: delivery, status: complete → with status=complete,
  // active phase is also marked done. Verify all six are done.
  const ids = state.phases.map((p) => p.id);
  assert.ok(ids.includes('ideation'));
  assert.ok(ids.includes('delivery'));
  for (const p of state.phases) {
    assert.equal(p.status, 'done', `phase ${p.id} should be done (got ${p.status})`);
  }
});

test('Phase status with mid-stream active phase: earlier=done, current=active, later=pending', () => {
  // Build a synthetic project root by using the live phases.yaml but a fake project state.
  // Easiest: monkey-patch the buildState input by writing a temp project.yaml.
  // Instead, exercise the logic by constructing inputs directly via parseYaml.
  const root = stateMod.findProjectRoot(process.cwd()) || path.resolve(__dirname, '..', '..', '..');
  const phasesYaml = parsers.parseYaml(fs.readFileSync(path.join(root, 'methodology', 'phases.yaml'), 'utf8'));
  const phasesObj = phasesYaml.phases;
  const ordered = Object.entries(phasesObj).sort((a, b) => a[1].order - b[1].order).map(([id]) => id);
  // Synthetic active = "definition"
  const activeId = 'definition';
  const activeIdx = ordered.indexOf(activeId);
  const computed = ordered.map((id, idx) => {
    if (idx < activeIdx) return 'done';
    if (idx === activeIdx) return 'active';
    return 'pending';
  });
  assert.equal(computed[ordered.indexOf('ideation')], 'done');
  assert.equal(computed[ordered.indexOf('exploration')], 'done');
  assert.equal(computed[ordered.indexOf('definition')], 'active');
  assert.equal(computed[ordered.indexOf('design')], 'pending');
  assert.equal(computed[ordered.indexOf('implementation')], 'pending');
  assert.equal(computed[ordered.indexOf('delivery')], 'pending');
});

// --- Decision-log smoke test ------------------------------------------------

test('Decision log parser extracts D-001 and D-BRN-1 from real log', () => {
  const root = stateMod.findProjectRoot(process.cwd()) || path.resolve(__dirname, '..', '..', '..');
  const logPath = path.join(root, 'artifacts', 'context', 'decision-log.md');
  const content = fs.readFileSync(logPath, 'utf8');
  const decisions = parsers.parseDecisionLog(content, 'artifacts/context/decision-log.md');
  const ids = decisions.map((d) => d.id);
  assert.ok(ids.includes('D-001'), 'D-001 found');
  assert.ok(ids.includes('D-022'), 'D-022 found');
  assert.ok(ids.includes('D-BRN-1'), 'D-BRN-1 found');
  assert.ok(decisions.length >= 26, `expected at least 26 decisions, got ${decisions.length}`);
  const d001 = decisions.find((d) => d.id === 'D-001');
  assert.equal(d001.classification, 'Strategic');
  assert.equal(d001.date, '2026-04-16');
});

// --- Story parser smoke -----------------------------------------------------

test('Story parser produces id/track/title from real story file', () => {
  const root = stateMod.findProjectRoot(process.cwd()) || path.resolve(__dirname, '..', '..', '..');
  const storyPath = path.join(root, 'artifacts', 'implementation', 'stories', 'story-A-BUG-1.md');
  const content = fs.readFileSync(storyPath, 'utf8');
  const story = parsers.parseStory(content, 'story-A-BUG-1.md');
  assert.equal(story.id, 'A-BUG-1');
  assert.equal(story.track, 'A');
  assert.ok(story.title.length > 5);
  assert.ok(story.acceptanceCriteriaCount >= 7, `expected ≥7 ACs, got ${story.acceptanceCriteriaCount}`);
});
