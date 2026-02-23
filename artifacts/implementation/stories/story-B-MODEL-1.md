# Story B-MODEL-1: Set Sonnet 4.6 as default model and document Opus availability

## Goal
Set Sonnet 4.6 (`claude-sonnet-4-6`) as the default model for all agents in the generators, remove Opus as a default anywhere, and add documentation in the orchestrator's methodology section explaining when Opus is appropriate.

## Acceptance Criteria
- [ ] AC1: The default model in all generators and configuration is Sonnet 4.6 (`claude-sonnet-4-6`)
- [ ] AC2: No generated file references Opus as a default model
- [ ] AC3: The orchestrator agent file (`agents/orchestrator.md`) includes a "Model Selection" section that:
  - States Sonnet 4.6 is the default for all agents
  - Explains Opus (`claude-opus-4-6`) exists and is appropriate ONLY for graduate-level reasoning tasks (complex final documentation, deep scientific analysis)
  - Explicitly states Opus should NOT be used for standard software engineering work
- [ ] AC4: The `cost-estimator.js` uses Sonnet 4.6 pricing as the baseline
- [ ] AC5: Test passes: `npm test -- --grep "model|sonnet|opus"`

## Dev Notes
- Files to modify:
  - `agents/orchestrator.md` -- add a "## Model Selection" section near the methodology tables (after B-TOKEN-1/3 merge). Content should include:
    - Default: Sonnet 4.6 for all agents
    - Opus 4.6 is available for graduate-level reasoning only
    - Do NOT default to Opus for any standard engineering task
    - Model can be overridden per-agent in swarm.yaml `agents.{name}.model`
  - `utils/cost-estimator.js` -- verify pricing uses Sonnet rates ($3/$15 per 1M tokens). If it uses Opus rates anywhere, change to Sonnet.
  - `README.md` -- if any documentation suggests Opus as default, update it
  - `swarm.yaml` -- if any agent has `model: opus`, change to `model: sonnet` or remove the override
- Pattern: This is primarily a documentation and configuration change. The generators do not currently set a model by default (the `model` field is optional in swarm.yaml). The key deliverable is the orchestrator methodology documentation.
- Test file: `test/generators.test.js` or new test -- verify the orchestrator agent content includes model selection guidance

## D-IDs Referenced
- Part 3 from token-optimization.md (Opus vs Sonnet 4.6 analysis)
- Section 3.5 recommendation: "Sonnet 4.6 for everything"
