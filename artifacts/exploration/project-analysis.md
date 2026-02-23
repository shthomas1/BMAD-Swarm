# bmad-swarm Project Analysis

**Date**: 2026-02-23
**Researcher**: researcher agent
**Scope**: Full project audit -- structure, codebase, architecture, completeness, gaps

---

## 1. Project Overview

**bmad-swarm** (v1.2.0) is a CLI tool that generates configuration files for Claude Code Agent Teams, implementing a structured multi-agent software development methodology based on the BMAD Method.

**What it does**: `bmad-swarm init` generates agent definitions, hooks, rules, settings, and a system prompt. `bmad-swarm start` launches Claude Code with the orchestrator identity injected at the system prompt level. The user then talks to Claude, which acts as an orchestrator that spawns specialist agent teammates as needed.

**What it is NOT**: It is not a runtime system. It generates static configuration files that Claude Code reads. After generation, bmad-swarm has no runtime presence.

**Language**: JavaScript (ESM), Node.js >= 18
**Dependencies**: commander (CLI framework), js-yaml (YAML parsing)
**Test framework**: node:test (built-in)

---

## 2. Directory Structure

```
bmad-swarm/
  bin/bmad-swarm.js           CLI entry point (commander setup, command registration)
  cli/                        CLI command implementations
    init.js                   Initialize new project (prompts, template, scan, file generation)
    update.js                 Regenerate managed files from swarm.yaml
    start.js                  Launch claude with --append-system-prompt
    eject.js                  Copy agent/methodology to overrides/ for customization
    uneject.js                Remove ejected overrides, restore package defaults
    scan.js                   Detect language, framework, test runner from codebase
    status.js                 Display project config, phase, agent status, artifact counts
    validate.js               Validate artifact quality against quality gate criteria
    doctor.js                 Check project configuration health
    phase.js                  Manage project phase transitions (show, advance, set)
  agents/                     13 agent template definitions (markdown)
    orchestrator.md           Team lead -- delegates, never implements
    ideator.md                Brainstorming partner with 17 techniques and 4 lenses
    researcher.md             Discovery, analysis, codebase scanning
    strategist.md             Product strategy, PRD creation
    architect.md              System architecture, technical design
    story-engineer.md         Creates implementation-ready stories with BDD criteria
    developer.md              TDD story implementation
    reviewer.md               Adversarial code review
    qa.md                     Test strategy, coverage analysis
    retrospective.md          Post-epic pattern analysis
    devops.md                 CI/CD, deployment, infrastructure
    security.md               Security review, threat modeling
    tech-writer.md            Documentation, user guides, API docs
  methodology/                The "brain" of the system
    phases.yaml               Phase definitions, gates, transitions, entry points
    brainstorming-techniques.md  17 curated techniques for the ideator
    elicitation-methods.md    16 methods for deepening artifact sections
    decision-classification.md  Tactical vs strategic decision framework
    decision-traceability.md  D-ID system for tracking decisions
    orchestration-modes.md    Interactive vs parallel vs hybrid mode selection
    adaptive-interaction.md   How agents adapt to user's conversation style
    quality-gates/            Quality criteria for PRDs, architecture, code, reviews, stories, ADRs
    artifact-schemas/         Expected structure for product briefs, PRDs, architecture, etc.
    task-templates/           Pre-built task graphs for common workflows
    testing-knowledge/        Stack-aware testing guides for the QA agent
  generators/                 File generation logic
    agent-generator.js        3-layer merge: package template + swarm.yaml + ejected overrides
    claude-md-generator.js    Generates CLAUDE.md with project context
    system-prompt-generator.js  Generates .claude/system-prompt.txt
    hooks-generator.js        Generates .claude/hooks/ (Node.js scripts)
    rules-generator.js        Generates .claude/rules/ (orchestrator identity, methodology, etc.)
    settings-generator.js     Generates .claude/settings.json
    github-actions-generator.js  Generates .github/workflows/ for CI
  utils/                      Shared utilities
    config.js                 YAML loading, default application, agent name discovery
    paths.js                  Path resolution for package and project files
    template.js               Lightweight template engine ({{var}}, {{#if}}, {{#each}})
    fs-helpers.js             File I/O with hash-based modification detection
    validator.js              swarm.yaml schema validation
    phase-machine.js          Phase state machine (advance, set, history tracking)
    cost-estimator.js         Token/cost estimation per agent role
    artifact-validator.js     Artifact quality checking (section presence, BDD format)
    workspace.js              Monorepo workspace discovery (NOT yet wired into CLI)
    plugins.js                Plugin discovery (custom agents from plugins/ directory)
    run-reporter.js           Run report generation (post-session summary)
  templates/                  Template files for generators
    CLAUDE.md.template        Template for project's CLAUDE.md
    system-prompt.txt.template  Template for orchestrator system prompt
    settings.json.template    Template for .claude/settings.json
    rules/                    Templates for .claude/rules/*.md
  integrations/
    github.js                 GitHub API integration helpers
  test/                       Test suite (218 tests, all passing)
  artifacts/                  Project artifacts (this is bmad-swarm developing itself)
    exploration/              Research reports (this file, plus prior brainstorming research)
    planning/                 Implementation plan
  overrides/                  User overrides directory
  .claude/                    Generated Claude Code configuration
    agents/                   13 agent definitions (generated from agents/)
    hooks/                    6 hooks (.cjs files)
    rules/                    4 rule files (coding standards, identity, methodology, quality)
    settings.json             Permissions and hook configuration
    settings.local.json       Local overrides (WebFetch permission for buildermethods.com)
    system-prompt.txt         Orchestrator identity injected via --append-system-prompt
```

---

## 3. CLI Commands

| Command | Status | Description |
|---------|--------|-------------|
| `bmad-swarm init` | Complete | Initialize project with prompts, templates, scan, file generation |
| `bmad-swarm update` | Complete | Regenerate managed files, respects ejected overrides and manual modifications |
| `bmad-swarm start` | Complete | Launch claude with `--append-system-prompt` for orchestrator identity |
| `bmad-swarm eject` | Complete | Copy agent or methodology file to overrides/ for customization |
| `bmad-swarm uneject` | Complete | Remove overrides, restore package defaults |
| `bmad-swarm scan` | Complete | Auto-detect stack from package.json/requirements.txt/etc. |
| `bmad-swarm status` | Complete | Display project configuration and artifact counts |
| `bmad-swarm validate` | Complete | Validate artifact quality against quality gate criteria |
| `bmad-swarm doctor` | Complete | Check configuration health with suggested fixes |
| `bmad-swarm phase` | Complete | Phase management (show, advance, set) with history tracking |

All 10 CLI commands are implemented and registered. The CLI is mature and well-tested.

---

## 4. Agent System

### 13 Agents

The project ships with 13 agent definitions. Each is a structured markdown file covering Role, Expertise, Inputs, Outputs, Quality Criteria, and Behavioral Rules.

| Agent | Role Summary | Key Output |
|-------|-------------|------------|
| orchestrator | Team lead, delegates everything, never implements | Task graphs, team coordination |
| ideator | Brainstorming with 4 lenses, 17 techniques | Product brief |
| researcher | Discovery, market/domain/technical analysis | Research documents |
| strategist | Product strategy, requirements | PRD |
| architect | System design, technology selection | Architecture doc, ADRs |
| story-engineer | Creates implementation-ready stories | Epics, stories with BDD criteria |
| developer | TDD story implementation | Source code, tests |
| reviewer | Adversarial code review | Review reports (approve/reject) |
| qa | Test strategy, coverage analysis | Test reports |
| retrospective | Post-epic pattern analysis | Lessons learned |
| devops | CI/CD, deployment, infrastructure | Pipeline config |
| security | Security review, threat modeling | Security reports |
| tech-writer | Documentation, user guides | Docs, API references |

### 3-Layer Override System

1. **Package templates** (`agents/*.md`) -- ship with bmad-swarm, regenerated on update
2. **swarm.yaml overrides** -- `extra_context`, `extra_rules`, `model` per agent
3. **Ejected overrides** (`overrides/agents/*.md`) -- full control, not overwritten

Resolution: ejected > package template + swarm.yaml overrides.

### Agent Discovery

Agent names are derived dynamically by scanning the `agents/` directory for `.md` files. The `getAgentNames()` function in `utils/config.js` handles this with caching. There is also a deprecated `AGENT_NAMES` constant for backward compatibility.

---

## 5. Methodology

### Phases (6 + Phase 0)

| Phase | Order | Default Mode | Primary Agents |
|-------|-------|-------------|----------------|
| Ideation | 0 | Interactive | ideator (+researcher for Mode B) |
| Exploration | 1 | Interactive | researcher |
| Definition | 2 | Interactive | strategist |
| Design | 3 | Interactive | architect |
| Implementation | 4 | Parallel | story-engineer, developer, reviewer, qa |
| Delivery | 5 | Parallel | reviewer, qa |

### Entry Points (12)

The orchestrator selects entry points based on request type, skipping unnecessary phases:

- `brainstorm` -- Ideation only (1 agent)
- `explore-idea` -- Ideation + Exploration (2 agents)
- `vague-idea` -- Full lifecycle starting at Exploration
- `clear-requirements` -- Definition onward
- `add-feature` -- Design or Implementation onward
- `bug-fix` -- Implementation only (1-2 agents)
- `refactor` -- Design onward
- `debug` -- Implementation only
- `migrate` -- Design onward
- `audit` -- Exploration only
- `maintain` -- Implementation only
- `exploration-only` -- Exploration only

### Complexity Scoring

5 factors (scope, clarity, technical risk, codebase, dependencies), each scored 1-3. Total range 5-15.

- Score 5-7: Minimal team (developer + reviewer)
- Score 8-10: Standard team (strategist + architect + developer + reviewer)
- Score 11-15: Full team

### Three Orchestration Modes

1. **Interactive** -- Single agent, human-in-the-loop (brainstorming, planning, design decisions)
2. **Parallel** -- Multiple agents, artifact-driven (implementation, delivery)
3. **Hybrid** -- Interactive for planning, parallel for building (complex multi-phase projects)

### Decision Traceability (D-ID System)

Every significant decision gets a D-ID that flows through the artifact chain:
- Ideator assigns D-IDs during brainstorming -> product brief
- Strategist references D-IDs in PRD requirements
- Architect references D-IDs in design decisions
- Story engineer includes D-IDs in acceptance criteria
- Reviewer verifies D-ID compliance

### Quality Gates

Each phase has quality gate criteria defined in `methodology/quality-gates/`. The `validate` command checks artifacts programmatically.

---

## 6. Hooks System

6 hooks in `.claude/hooks/`:

| Hook | File | Trigger | Purpose |
|------|------|---------|---------|
| Identity reinject | identity-reinject.cjs | SessionStart, compact | Re-inject orchestrator identity after context compression |
| Post-tool code guard | orchestrator-post-tool.cjs | PostToolUse (Edit/Write/Bash) | Warn if orchestrator modifies src/ directly |
| Task tool warning | task-tool-warning.cjs | PostToolUse (Task) | Warn orchestrator to use TeamCreate instead of Task |
| Stop code guard | orchestrator-stop.cjs | Stop | Block turn if orchestrator modified code directly |
| Task completed | TaskCompleted.cjs | TaskCompleted | Log task completion, run npm test for implementation tasks |
| Teammate idle | TeammateIdle.cjs | TeammateIdle | Log idle events, warn if orchestrator is idle |

The hooks are Node.js (`.cjs`) files that read JSON from stdin and write JSON to stdout. The identity reinject, code guard, and task tool warning hooks are robust enforcement mechanisms. TaskCompleted runs `npm test` as an advisory check.

---

## 7. Test Suite

**218 tests, all passing** across 19 test files:

| Test File | Tests | Coverage Area |
|-----------|-------|---------------|
| cli.test.js | CLI integration (init, update, status, eject, uneject, start) |
| config.test.js | Config loading, default application, agent name discovery |
| cost-estimator.test.js | Cost estimation per agent role and entry point |
| doctor.test.js | Doctor command health checks |
| error-paths.test.js | Error scenarios (malformed YAML, invalid config, missing files) |
| fs-helpers.test.js | File I/O, hash protection, modification detection |
| generators.test.js | Agent, CLAUDE.md, hooks, rules, system prompt generation |
| ideation.test.js | Ideation phase config, ideator agent, brainstorming techniques |
| idempotent.test.js | Repeated update produces identical output |
| phase-machine.test.js | Phase transitions, history, validation |
| plugins.test.js | Plugin agent discovery and loading |
| rules-generator.test.js | Rules generation with paths frontmatter |
| run-reporter.test.js | Run report generation |
| scan.test.js | Stack detection from package.json/requirements.txt |
| settings-generator.test.js | Settings.json generation |
| template.test.js | Template engine (variables, conditionals, each, else) |
| validate.test.js | Artifact validation (PRD, architecture, stories, product brief) |
| validator.test.js | Schema validation for swarm.yaml |
| workspace.test.js | Monorepo workspace discovery and config merging |

Test quality is high -- covers both happy paths and error conditions.

---

## 8. What "Adding Brainstorming Features" Means in Context

The `swarm.yaml` for this project says:

```yaml
project:
  description: adding the brainstorming features to the existing bmad-swarm
```

### What Already Exists

The brainstorming/ideation system is **substantially complete**:

1. **Ideator agent** (`agents/ideator.md`) -- 145 lines, fully defined with:
   - 4 lenses (product strategist, technical feasibility, devil's advocate, innovation)
   - References to 17 brainstorming techniques library
   - References to 16 elicitation methods
   - Adaptive interaction rules for 5 user types
   - Decision tracking with D-ID system
   - Mode A (interactive) and Mode B (parallel exploration) distinctions
   - Quality criteria for when to produce product brief
   - Behavioral rules for conversation flow

2. **Brainstorming techniques library** (`methodology/brainstorming-techniques.md`) -- 214 lines with:
   - 17 techniques across 4 categories (divergent, perspective shift, convergence, deepening)
   - Anti-bias protocol (domain rotation every 10 ideas, CoT novelty check)
   - Quantity discipline (push past 20 to find ideas 50-100)
   - Creative temperature calibration

3. **Elicitation methods** (`methodology/elicitation-methods.md`) -- 182 lines with:
   - 16 methods across 7 weakness categories
   - Each method has when-to-apply, how-it-works, what-it-produces, and examples

4. **Phase 0 (Ideation)** in `methodology/phases.yaml` -- fully defined with:
   - Mode A (interactive brainstorming) and Mode B (parallel exploration)
   - Gate criteria for ideation-complete
   - Skip conditions
   - Artifact outputs (product brief)

5. **Orchestrator routing** -- fully documented in `agents/orchestrator.md`:
   - Trigger phrase detection for brainstorm vs explore-idea entry points
   - Mode A vs Mode B selection logic
   - Transition from ideation to downstream phases
   - D-ID inheritance from brainstorming

6. **Tests** (`test/ideation.test.js`) -- ideation configuration verified

7. **Cost estimation** supports brainstorm and explore-idea entry points

8. **Prior research** -- extensive research artifacts already exist:
   - `artifacts/exploration/bmad-brainstorming-research.md` -- 840 lines documenting the original BMAD Method's brainstorming system (61 techniques, anti-bias protocol, elicitation system, party mode, product brief workflow, storytelling techniques)
   - `artifacts/exploration/devils-advocate-analysis.md` -- critical analysis
   - `artifacts/exploration/research-response.md` -- response to criticism
   - `artifacts/planning/implementation-plan.md` -- 28-item phased plan

### What Was Planned but May Already Be Done

The `implementation-plan.md` from 2026-02-09 listed 28 items across 4 phases. Checking the current codebase against those items:

**Phase 1 (Critical Fixes) -- ALL DONE:**
- P1.1 Fix CLAUDE.md require_human_approval_list -- Fixed (system-prompt-generator.js has the flag)
- P1.2 Fix autonomy boolean flags -- Fixed (same)
- P1.3 Fix idempotency test -- Fixed (test passes)
- P1.4 Remove dead code from fs-helpers.js -- Done (no copyFileSafe/fileExists)
- P1.5 Extract shared settings generator -- Done (generators/settings-generator.js exists)
- P1.6 CLAUDE.md content validation tests -- Done (generators.test.js)

**Phase 2 (Core Quality) -- ALL DONE:**
- P2.1 Cross-platform hooks -- Done (hooks are .cjs Node.js, not bash)
- P2.2 Schema validation -- Done (utils/validator.js exists)
- P2.3 Template engine improvements -- Done (template supports #each, #else)
- P2.4 Scan command tests -- Done (test/scan.test.js exists)
- P2.5 CLI integration tests -- Done (test/cli.test.js exists)
- P2.6 Error path tests -- Done (test/error-paths.test.js exists)
- P2.7 Orchestrator decision matrix -- Done (orchestrator.md has Decision Matrix section)

**Phase 3 (New Capabilities) -- ALL DONE:**
- P3.1 Validate command -- Done (cli/validate.js, utils/artifact-validator.js)
- P3.2 Doctor command -- Done (cli/doctor.js)
- P3.3 Quality gate enforcement in hooks -- Done (TaskCompleted runs npm test)
- P3.4 Feedback loops -- Done (orchestrator.md has Handling Rejections section)
- P3.5 Additional workflow entry points -- Done (debug, migrate, audit, maintain in phases.yaml)
- P3.6 README improvements -- Done (README restructured with prerequisites, escape hatches, troubleshooting)
- P3.7 Cost estimation -- Done (utils/cost-estimator.js)

**Phase 4 (Strategic) -- ALL DONE:**
- P4.1 Runtime phase state machine -- Done (utils/phase-machine.js, cli/phase.js)
- P4.2 Dynamic agent discovery -- Done (getAgentNames() in config.js)
- P4.3 Plugin system -- Done (utils/plugins.js)
- P4.4 GitHub integration -- Done (integrations/github.js, generators/github-actions-generator.js)
- P4.5 Optional agents (DevOps, Tech Writer, Security) -- Done (agents/devops.md, tech-writer.md, security.md)
- P4.6 Monorepo support -- Done (utils/workspace.js)
- P4.7 Run reporting -- Done (utils/run-reporter.js)
- P4.8 Methodology overrides -- Done (eject supports methodology type)

### Assessment

**All 28 items from the implementation plan appear to be complete.** The project has advanced significantly since the initial brainstorming research. The codebase is now at v1.2.0 with 218 passing tests.

---

## 9. Current State Assessment

### What Works Well

1. **CLI is complete and polished** -- 10 commands, well-tested, clean UX
2. **Agent definitions are thorough** -- 13 agents with detailed behavioral rules
3. **Methodology is comprehensive** -- phases, entry points, quality gates, decision traceability
4. **Test coverage is strong** -- 218 tests covering generators, validation, CLI, error paths
5. **Override system is elegant** -- 3-layer resolution (package, config, ejected) with modification detection
6. **Hooks enforce orchestrator discipline** -- Code guard prevents orchestrator from implementing directly, identity reinject survives context compression
7. **Brainstorming/ideation is fully integrated** -- Phase 0 with 17 techniques, 4 lenses, 2 modes, D-ID tracking

### Notable Design Decisions

1. **Static generation, not runtime** -- bmad-swarm generates config and exits. All runtime behavior is delegated to Claude Code. This is simple and reliable but limits enforcement.
2. **System prompt injection** -- `bmad-swarm start` uses `--append-system-prompt` to inject orchestrator identity at the highest priority level, reinforced by `.claude/rules/` files.
3. **Three-tier instruction system** -- System prompt (highest priority) + rules (reinforcement) + CLAUDE.md (project context).
4. **Hash-based modification detection** -- Generated files include content hashes so `update` can detect manual edits and skip them (unless `--force`).
5. **Artifact-driven coordination** -- Agents coordinate through files on disk, not message passing.

### Gaps and Areas of Concern

1. **`src/` directory does not exist** -- The CLAUDE.md and swarm.yaml specify `./src/` as the code directory, but there is no `src/` directory. This is because the project IS the tool itself (source is in `cli/`, `generators/`, `utils/`). The `./src/` reference is the default output directory for projects that USE bmad-swarm, not bmad-swarm's own source. This is potentially confusing when bmad-swarm is developing itself.

2. **Self-referential project configuration** -- The project uses its own generated `.claude/` configuration to develop itself. The `swarm.yaml`, `project.yaml`, and CLAUDE.md describe a project called "bmad-swarm" of type "web-app" with JavaScript. The hooks in `.claude/hooks/` are active and enforce orchestrator discipline during development sessions. This is clever but creates a chicken-and-egg situation during bootstrap.

3. **`project.yaml` still shows `phase: not-started`** -- Despite all 28 implementation plan items being complete, the project phase was never advanced. This suggests the phase machine is not being used during actual development.

4. **`workspace.js` note says "not yet wired into CLI"** -- The comment at line 1 says this, but the test file `test/workspace.test.js` exists and passes. The workspace discovery functions are implemented and tested but may not be fully integrated into the CLI commands.

5. **No `src/` code for "brainstorming features"** -- Since the swarm.yaml describes the project as "adding the brainstorming features to the existing bmad-swarm," and all the brainstorming methodology and agent definitions are already complete, the question is: what additional source code is needed? The brainstorming features are primarily methodology content (agent prompts, technique libraries) rather than new CLI code. There may be nothing left to build in `src/`.

6. **Hooks reference environment variables** -- `TaskCompleted.cjs` uses `process.env.TASK_ID`, `TASK_SUBJECT`, `TASK_OWNER`. `TeammateIdle.cjs` uses `TEAMMATE_NAME`, `TEAMMATE_ID`. These are presumably set by Claude Code's hook system, but the exact contract is undocumented in the project.

---

## 10. Summary

bmad-swarm is a mature, well-tested CLI tool at v1.2.0 that generates structured multi-agent development configurations for Claude Code. The brainstorming/ideation features that were the stated goal of the project appear to be fully implemented:

- Ideator agent with 4 lenses, 17 brainstorming techniques, 16 elicitation methods
- Phase 0 (Ideation) with Mode A (interactive) and Mode B (parallel exploration)
- Decision traceability (D-ID system) integrated from brainstorming through delivery
- Orchestrator routing for brainstorm and explore-idea entry points
- All 28 items from the implementation plan are complete
- 218 tests passing with no failures

The project is in a healthy state. The primary open question is whether there is additional work to be done, or whether the "adding brainstorming features" goal has been achieved and the project is ready for delivery validation.
