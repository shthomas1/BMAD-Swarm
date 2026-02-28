import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { updateGitignore } from '../utils/fs-helpers.js';

describe('updateGitignore', () => {
  const tmpDir = join(tmpdir(), 'bmad-test-gitignore-' + Date.now());

  before(() => {
    mkdirSync(tmpDir, { recursive: true });
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates .gitignore with all entries when none exists', () => {
    const projectDir = join(tmpDir, 'no-gitignore');
    mkdirSync(projectDir, { recursive: true });

    updateGitignore(projectDir);

    const gitignorePath = join(projectDir, '.gitignore');
    assert.ok(existsSync(gitignorePath), '.gitignore should be created');

    const content = readFileSync(gitignorePath, 'utf8');
    assert.ok(content.includes('# bmad-swarm (generated files)'), 'Should have marker comment');
    assert.ok(content.includes('.claude/'), 'Should include .claude/');
    assert.ok(content.includes('artifacts/'), 'Should include artifacts/');
    assert.ok(content.includes('swarm.yaml'), 'Should include swarm.yaml');
    assert.ok(content.includes('project.yaml'), 'Should include project.yaml');
    assert.ok(content.includes('CLAUDE.md'), 'Should include CLAUDE.md');
    assert.ok(content.includes('overrides/'), 'Should include overrides/');
  });

  it('appends section to existing .gitignore without marker', () => {
    const projectDir = join(tmpDir, 'existing-no-marker');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, '.gitignore'), 'node_modules/\n*.log\n');

    updateGitignore(projectDir);

    const content = readFileSync(join(projectDir, '.gitignore'), 'utf8');
    assert.ok(content.includes('node_modules/'), 'Should preserve existing entries');
    assert.ok(content.includes('# bmad-swarm (generated files)'), 'Should add marker');
    assert.ok(content.includes('.claude/'), 'Should add .claude/');
    assert.ok(content.includes('overrides/'), 'Should add overrides/');
  });

  it('is idempotent - no duplicates on second call', () => {
    const projectDir = join(tmpDir, 'idempotent');
    mkdirSync(projectDir, { recursive: true });

    updateGitignore(projectDir);
    updateGitignore(projectDir);

    const content = readFileSync(join(projectDir, '.gitignore'), 'utf8');
    const matches = content.match(/\.claude\//g);
    assert.equal(matches.length, 1, 'Should have exactly one .claude/ entry');
    const markerMatches = content.match(/# bmad-swarm/g);
    assert.equal(markerMatches.length, 1, 'Should have exactly one marker');
  });

  it('appends missing entries when marker exists but entries are incomplete', () => {
    const projectDir = join(tmpDir, 'partial-entries');
    mkdirSync(projectDir, { recursive: true });
    // Simulate an old .gitignore that has the marker but is missing overrides/
    writeFileSync(join(projectDir, '.gitignore'),
      'node_modules/\n# bmad-swarm (generated files)\n.claude/\nartifacts/\nswarm.yaml\nproject.yaml\nCLAUDE.md\n'
    );

    updateGitignore(projectDir);

    const content = readFileSync(join(projectDir, '.gitignore'), 'utf8');
    assert.ok(content.includes('overrides/'), 'Should append missing overrides/ entry');
    // Existing entries should not be duplicated
    const claudeMatches = content.match(/\.claude\//g);
    assert.equal(claudeMatches.length, 1, 'Should not duplicate .claude/');
  });

  it('does not modify .gitignore if all entries are already present', () => {
    const projectDir = join(tmpDir, 'already-complete');
    mkdirSync(projectDir, { recursive: true });
    const original =
      'node_modules/\n# bmad-swarm (generated files)\n.claude/\nartifacts/\nswarm.yaml\nproject.yaml\nCLAUDE.md\noverrides/\n';
    writeFileSync(join(projectDir, '.gitignore'), original);

    updateGitignore(projectDir);

    const content = readFileSync(join(projectDir, '.gitignore'), 'utf8');
    assert.equal(content, original, 'Should not modify when all entries present');
  });

  it('handles .gitignore with Windows-style line endings', () => {
    const projectDir = join(tmpDir, 'crlf');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, '.gitignore'),
      'node_modules/\r\n# bmad-swarm (generated files)\r\n.claude/\r\nartifacts/\r\nswarm.yaml\r\nproject.yaml\r\nCLAUDE.md\r\n'
    );

    updateGitignore(projectDir);

    const content = readFileSync(join(projectDir, '.gitignore'), 'utf8');
    assert.ok(content.includes('overrides/'), 'Should append missing overrides/ even with CRLF');
  });

  it('handles .gitignore with trailing whitespace on lines', () => {
    const projectDir = join(tmpDir, 'trailing-ws');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, '.gitignore'),
      '# bmad-swarm (generated files)\n.claude/  \nartifacts/ \nswarm.yaml\nproject.yaml\nCLAUDE.md\noverrides/\n'
    );

    updateGitignore(projectDir);

    const content = readFileSync(join(projectDir, '.gitignore'), 'utf8');
    // Should recognize trimmed entries as already present
    const claudeMatches = content.match(/\.claude\//g);
    assert.equal(claudeMatches.length, 1, 'Should not duplicate .claude/ despite trailing whitespace');
  });
});
