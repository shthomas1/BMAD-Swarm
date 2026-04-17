import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { estimateCost } from '../utils/cost-estimator.js';

describe('Cost Estimator', () => {
  const baseConfig = {
    project: { name: 'test' },
    methodology: { phases: { implementation: { parallel_devs: 1 } } },
    agents: {},
  };

  describe('estimateCost', () => {
    it('returns all 9 agents for full-lifecycle', () => {
      const result = estimateCost(baseConfig, 'full-lifecycle');
      assert.equal(result.agents.length, 9);
      const expected = [
        'orchestrator', 'ideator', 'researcher', 'strategist', 'architect',
        'developer', 'reviewer', 'security', 'devops',
      ];
      for (const agent of expected) {
        assert.ok(result.agents.includes(agent), `Missing agent: ${agent}`);
      }
    });

    it('returns correct agents for bug-fix entry point', () => {
      const result = estimateCost(baseConfig, 'bug-fix');
      assert.deepEqual(result.agents, ['developer', 'reviewer']);
    });

    it('returns correct agents for brainstorm entry point', () => {
      const result = estimateCost(baseConfig, 'brainstorm');
      assert.deepEqual(result.agents, ['ideator']);
    });

    it('returns correct agents for explore-idea entry point', () => {
      const result = estimateCost(baseConfig, 'explore-idea');
      assert.deepEqual(result.agents, ['ideator', 'researcher']);
    });

    it('returns correct agents for small-feature entry point', () => {
      const result = estimateCost(baseConfig, 'small-feature');
      assert.deepEqual(result.agents, ['architect', 'developer', 'reviewer']);
    });

    it('filters disabled agents', () => {
      const config = {
        ...baseConfig,
        agents: { security: { enabled: false }, devops: { enabled: false } },
      };
      const result = estimateCost(config, 'full-lifecycle');
      assert.ok(!result.agents.includes('security'), 'Security should be filtered');
      assert.ok(!result.agents.includes('devops'), 'DevOps should be filtered');
      assert.equal(result.agents.length, 7);
    });

    it('returns correct agents for audit entry point', () => {
      const result = estimateCost(baseConfig, 'audit');
      assert.deepEqual(result.agents, ['researcher', 'reviewer', 'security']);
    });

    it('multiplies developer tokens for parallel devs', () => {
      const singleDev = estimateCost(baseConfig, 'bug-fix');

      const parallelConfig = {
        ...baseConfig,
        methodology: { phases: { implementation: { parallel_devs: 3 } } },
      };
      const multiDev = estimateCost(parallelConfig, 'bug-fix');

      // With 3 parallel devs, developer tokens should be tripled
      // bug-fix agents: developer + reviewer
      // developer min=30000 -> 3 * 30000 = 90000 for developer portion
      assert.ok(multiDev.estimatedTokensMin > singleDev.estimatedTokensMin,
        'Parallel devs should increase min tokens');
      assert.ok(multiDev.estimatedTokensMax > singleDev.estimatedTokensMax,
        'Parallel devs should increase max tokens');
    });

    it('returns cost as dollar strings', () => {
      const result = estimateCost(baseConfig, 'brainstorm');
      assert.ok(result.estimatedCostMin.startsWith('$'), 'Min cost should start with $');
      assert.ok(result.estimatedCostMax.startsWith('$'), 'Max cost should start with $');
      // Parse the dollar amounts to verify they are valid numbers
      const minCost = parseFloat(result.estimatedCostMin.slice(1));
      const maxCost = parseFloat(result.estimatedCostMax.slice(1));
      assert.ok(!isNaN(minCost), 'Min cost should be a valid number');
      assert.ok(!isNaN(maxCost), 'Max cost should be a valid number');
      assert.ok(maxCost >= minCost, 'Max cost should be >= min cost');
    });

    it('falls back to full-lifecycle for unknown entry point', () => {
      const result = estimateCost(baseConfig, 'nonexistent-entry');
      assert.equal(result.agents.length, 9, 'Should use all 9 agents for unknown entry point');
    });

    it('uses Opus pricing as baseline', () => {
      // Opus pricing: $15/1M input, $75/1M output
      // A single ideator (min 10000 tokens) at 60/40 input/output split:
      // input: 6000 tokens = $0.09, output: 4000 tokens = $0.30 => total ~$0.39
      const result = estimateCost(baseConfig, 'brainstorm');
      const minCost = parseFloat(result.estimatedCostMin.slice(1));
      assert.ok(minCost >= 0.05, 'Min cost for brainstorm should reflect Opus pricing');
    });
  });
});
