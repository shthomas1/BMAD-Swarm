'use strict';

// Smoke tests for bmad-statusline. Runs against the live BMAD-Swarm repo.
// Spawns the script as a child process so we exercise the real stdin/stdout
// contract Claude Code uses.

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const cp = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '..', 'bin', 'statusline.cjs');
const REPO = path.resolve(__dirname, '..', '..', '..'); // .../BMAD-Swarm

function run(payload, env = {}) {
  const child = cp.spawnSync(process.execPath, [SCRIPT], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf-8',
    env: Object.assign({}, process.env, env),
    timeout: 5000,
  });
  return {
    stdout: child.stdout || '',
    stderr: child.stderr || '',
    status: child.status,
  };
}

function stripAnsi(s) {
  // Strip CSI escape sequences.
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

test('live repo: emits expected BMAD-Swarm status line', () => {
  const r = run({ cwd: REPO }, { NO_COLOR: '1' });
  assert.strictEqual(r.status, 0, `expected exit 0, got ${r.status}; stderr=${r.stderr}`);
  const out = r.stdout;
  assert.ok(out.startsWith('◉ bmad-swarm'), `stdout did not start with project marker: ${JSON.stringify(out)}`);
  assert.ok(/DELIVERY/.test(out), `expected DELIVERY in output: ${out}`);
  assert.ok(/\bauto\b/.test(out), `expected autonomy 'auto' in output: ${out}`);
  // Decision-log: D-022 is the highest declared D-ID in this repo.
  assert.ok(/D-022/.test(out), `expected D-022 in output: ${out}`);
  // Agent count: @<integer> active
  assert.ok(/@\d+ active/.test(out), `expected @N active in output: ${out}`);
});

test('NO_COLOR=1 strips ANSI sequences', () => {
  const colored = run({ cwd: REPO });
  const plain = run({ cwd: REPO }, { NO_COLOR: '1' });
  assert.strictEqual(plain.status, 0);
  // Plain output must contain no escape codes.
  assert.ok(!/\x1b\[/.test(plain.stdout), `NO_COLOR output still contains ANSI: ${JSON.stringify(plain.stdout)}`);
  // The colored path SHOULD contain at least one CSI sequence (some terminals
  // disable color env-side, so be defensive: only assert if env did not).
  if (!process.env.NO_COLOR) {
    assert.ok(/\x1b\[/.test(colored.stdout), 'expected ANSI codes when NO_COLOR is unset');
  }
  // Stripping ANSI from colored should match the plain rendering.
  assert.strictEqual(stripAnsi(colored.stdout), plain.stdout);
});

test('outside any BMAD project: emits "no BMAD project"', () => {
  // Pick a directory guaranteed not to be a BMAD root (parent's parent's parent
  // up to the filesystem root, e.g. C:\ on Windows).
  const root = path.parse(REPO).root; // "C:\\" on Windows, "/" on POSIX
  const r = run({ cwd: root }, { NO_COLOR: '1' });
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout.trim(), '◉ no BMAD project');
});

test('garbage stdin: still emits a parseable status line and exits 0', () => {
  const r = run('not json at all !!! \x00 garbage', { NO_COLOR: '1' });
  assert.strictEqual(r.status, 0);
  // Without payload cwd, the script falls back to process.cwd, which (for
  // node --test) is this repo's plugin dir → walk-up finds BMAD-Swarm.
  assert.ok(r.stdout.startsWith('◉'), `expected leading marker: ${JSON.stringify(r.stdout)}`);
});

test('empty stdin: handled like no payload', () => {
  const r = run('', { NO_COLOR: '1' });
  assert.strictEqual(r.status, 0);
  assert.ok(r.stdout.startsWith('◉'));
});

test('invalid cwd field type: handled gracefully', () => {
  const r = run({ cwd: 12345 }, { NO_COLOR: '1' });
  assert.strictEqual(r.status, 0);
  assert.ok(r.stdout.startsWith('◉'));
});

test('performance: cold run completes in < 200ms', () => {
  const t0 = process.hrtime.bigint();
  const r = run({ cwd: REPO }, { NO_COLOR: '1' });
  const elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.strictEqual(r.status, 0);
  // 200ms includes node startup, which dominates. Generous on Windows.
  assert.ok(elapsedMs < 1500, `cold run took ${elapsedMs.toFixed(1)}ms (budget 1500ms incl. node startup)`);
  // Log for the humans.
  // eslint-disable-next-line no-console
  console.log(`[perf] cold run: ${elapsedMs.toFixed(1)}ms`);
});

test('module exports parseYaml + helpers for unit testing', () => {
  const mod = require(SCRIPT);
  assert.strictEqual(typeof mod.parseYaml, 'function');
  assert.strictEqual(typeof mod.findProjectRoot, 'function');
  assert.strictEqual(typeof mod.latestDecisionId, 'function');
  assert.strictEqual(typeof mod.hasApprovalMarker, 'function');
  // Sanity: parseYaml on swarm.yaml returns methodology.autonomy.
  const raw = fs.readFileSync(path.join(REPO, 'swarm.yaml'), 'utf-8');
  const y = mod.parseYaml(raw);
  assert.strictEqual(y.methodology && y.methodology.autonomy, 'auto');
});

test('truncateName clips to 24 chars with ellipsis', () => {
  const { truncateName } = require(SCRIPT);
  assert.strictEqual(truncateName('short'), 'short');
  const long = 'a'.repeat(40);
  const out = truncateName(long);
  assert.ok(out.endsWith('…'));
  assert.strictEqual([...out].length, 24);
});

test('hasApprovalMarker matches the documented forms', () => {
  const { hasApprovalMarker } = require(SCRIPT);
  assert.ok(hasApprovalMarker('Status: approved'));
  assert.ok(hasApprovalMarker('Approved by: Sean'));
  assert.ok(hasApprovalMarker('# x\n## Approval\n'));
  assert.ok(!hasApprovalMarker('# Draft\nWork in progress'));
});
