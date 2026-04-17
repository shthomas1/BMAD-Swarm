import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadSwarmConfig, getAgentNames } from '../utils/config.js';

describe('Config System', () => {
  const tmpDir = join(tmpdir(), 'bmad-test-config-' + Date.now());

  before(() => {
    mkdirSync(tmpDir, { recursive: true });
  });

  describe('loadSwarmConfig', () => {
    it('loads and applies defaults to minimal config', () => {
      const configPath = join(tmpDir, 'minimal.yaml');
      writeFileSync(configPath, 'project:\n  name: test\n');

      const config = loadSwarmConfig(configPath);
      assert.equal(config.project.name, 'test');
      assert.equal(config.project.type, 'other');
      assert.equal(config.methodology.autonomy, 'guided');
      assert.equal(config.methodology.phases.exploration.enabled, true);
      assert.equal(config.methodology.phases.implementation.parallel_devs, 2);
      assert.equal(config.methodology.quality.require_tests, true);
      assert.equal(config.methodology.quality.require_review, true);
      assert.deepEqual(config.methodology.quality.require_human_approval, ['prd', 'architecture']);
      assert.equal(config.output.artifacts_dir, './artifacts');
      assert.equal(config.output.code_dir, './src');
    });

    it('applies ideation defaults', () => {
      const configPath = join(tmpDir, 'ideation-defaults.yaml');
      writeFileSync(configPath, 'project:\n  name: test\n');

      const config = loadSwarmConfig(configPath);
      assert.equal(config.methodology.phases.ideation.enabled, true);
      assert.equal(config.methodology.ideation.enabled, true);
      assert.deepEqual(config.methodology.ideation.default_perspectives, [
        'product-strategist',
        'technical-feasibility',
        'devils-advocate',
        'innovation',
      ]);
    });

    it('preserves user-specified values', () => {
      const configPath = join(tmpDir, 'custom.yaml');
      writeFileSync(configPath, `
project:
  name: custom-project
  type: api
methodology:
  autonomy: auto
  phases:
    exploration:
      enabled: false
  quality:
    require_tests: false
output:
  artifacts_dir: ./docs
`);

      const config = loadSwarmConfig(configPath);
      assert.equal(config.project.name, 'custom-project');
      assert.equal(config.project.type, 'api');
      assert.equal(config.methodology.autonomy, 'auto');
      assert.equal(config.methodology.phases.exploration.enabled, false);
      assert.equal(config.methodology.phases.definition.enabled, true);
      assert.equal(config.methodology.quality.require_tests, false);
      assert.equal(config.output.artifacts_dir, './docs');
    });

    it('throws when file not found', () => {
      assert.throws(() => {
        loadSwarmConfig(join(tmpDir, 'nonexistent.yaml'));
      }, /not found/);
    });
  });

  describe('getAgentNames', () => {
    it('contains all agents discovered from agents/ directory', () => {
      const names = getAgentNames();
      const coreAgents = ['orchestrator', 'ideator', 'researcher', 'strategist', 'architect', 'developer', 'reviewer'];
      const optionalAgents = ['devops', 'security'];
      for (const name of [...coreAgents, ...optionalAgents]) {
        assert.ok(names.includes(name), `Missing agent: ${name}`);
      }
      assert.equal(names.length, 9);
    });

    it('is sorted alphabetically', () => {
      const names = getAgentNames();
      const sorted = [...names].sort();
      assert.deepEqual(names, sorted);
    });
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });
});
