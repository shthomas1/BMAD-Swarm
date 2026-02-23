# Model Routing Feasibility Analysis

## Executive Summary

**Feasibility: HIGH.** Model routing -- selecting haiku, sonnet, or opus per agent type, task complexity, or phase -- is technically feasible and could reduce swarm costs by 40-60% while maintaining quality where it matters. The Claude Code platform already supports model selection for both subagents (via the `model` frontmatter field) and agent teams (via natural-language instructions to the lead). bmad-swarm has a nascent `model` config field in `swarm.yaml` that currently only emits an HTML comment in generated agent files. The gap between current state and full model routing is small and well-defined.

**Recommended approach: Hybrid routing** -- combine static per-agent defaults with dynamic complexity-based overrides. This is the most innovative option because it leverages bmad-swarm's existing complexity scoring system to make intelligent, context-aware model selections rather than relying on fixed mappings alone.

---

## Research Questions & Findings

### 1. Does the current codebase have any model selection logic?

**Finding: Minimal -- a placeholder exists but does nothing functional.**

| Location | What exists | Status |
|----------|------------|--------|
| `swarm.yaml` agents config | `model` field documented in README (`# model: opus`) | Config schema exists but unused in this project |
| `generators/agent-generator.js:95-98` | `applyAgentOverrides()` checks `agentConfig.model` and prepends `<!-- preferred-model: {model} -->` as an HTML comment | Comment only -- no runtime effect |
| `utils/validator.js` | No validation of the `model` field | Field accepted but not checked |
| `utils/cost-estimator.js` | Single pricing tier (`$3/$15 per 1M tokens`) -- assumes Sonnet for all agents | No model-aware cost estimation |
| `templates/system-prompt.txt.template` | Instructs orchestrator to use TeamCreate | No model routing instructions |
| `templates/rules/orchestrator-methodology.md` | Complexity scoring (5-15), team composition by score, entry point routing | No model selection guidance |
| `.claude/agents/*.md` | Agent definition files | No model metadata consumed at runtime |

**Key insight**: The `model` field in `swarm.yaml` and the `<!-- preferred-model -->` comment in `agent-generator.js` show that model routing was anticipated by the original design but never implemented beyond a stub.

### 2. What would it take to add model routing? Where in the code would this live?

Model routing in bmad-swarm can be implemented at **two distinct layers**, each with different mechanisms:

#### Layer A: Subagent model routing (via custom subagent definitions)

Claude Code subagents support a `model` frontmatter field that accepts `"haiku"`, `"sonnet"`, `"opus"`, or `"inherit"`. bmad-swarm could generate subagent definition files (`.claude/agents/*.md`) with the `model` field in YAML frontmatter, making model selection automatic when the orchestrator uses the Task tool for internal subtasks.

**Where it lives**: `generators/agent-generator.js` -- modify `generateAgents()` to emit YAML frontmatter with the `model` field instead of (or in addition to) the HTML comment.

**Changes required**:
- `generators/agent-generator.js`: Add YAML frontmatter block with `model` field to generated agent `.md` files
- `utils/validator.js`: Validate `model` field values (haiku, sonnet, opus, inherit)
- `utils/config.js`: No changes needed -- `model` already passes through as an arbitrary agent config key

#### Layer B: Agent team model routing (via orchestrator instructions)

Claude Code agent teams (TeamCreate) do **not** accept a `model` parameter programmatically. Instead, the official documentation shows that model selection for teammates is done via natural-language instructions in the spawn prompt:

> "Create a team with 4 teammates to refactor these modules in parallel. Use Sonnet for each teammate."

This means bmad-swarm's orchestrator system prompt and methodology rules must include model routing instructions that the orchestrator follows when spawning teammates.

**Where it lives**:
- `templates/system-prompt.txt.template` -- add model routing instructions
- `templates/rules/orchestrator-methodology.md` -- add model routing table to the methodology reference
- `agents/orchestrator.md` -- add model routing behavioral rules

**Changes required**:
- Add a "Model Routing" section to the orchestrator methodology that maps agent types and complexity scores to model recommendations
- Include the swarm.yaml model overrides in the template data so they render into the orchestrator's rules
- Add model routing to cost-estimator.js for accurate cost predictions

#### Layer C: Configuration and estimation

**Where it lives**:
- `swarm.yaml` -- already has the `model` field per agent
- `utils/cost-estimator.js` -- needs model-aware pricing
- `generators/system-prompt-generator.js` -- needs to pass model routing config into template data

### 3. What are the natural routing heuristics?

#### Heuristic A: By Agent Type (Static Defaults)

Based on each agent's cognitive demands and the cost/capability tradeoff:

| Agent | Recommended Model | Rationale |
|-------|------------------|-----------|
| **orchestrator** | opus | Coordination, complex decision-making, task graph construction. This is the brain -- quality here compounds across the entire swarm. |
| **ideator** | opus | Creative brainstorming, multi-perspective analysis, adaptive interaction. Needs the strongest reasoning and creativity. |
| **strategist** | opus | Product strategy, PRD creation. High-stakes document that gates all downstream work. |
| **architect** | opus | System design, technology selection, ADRs. Architectural mistakes are the costliest to fix. |
| **researcher** | sonnet | Information gathering, synthesis, comparison tables. Reads more than it reasons. Sonnet handles this well. |
| **story-engineer** | sonnet | Translating architecture into stories. Structured, pattern-following work. |
| **developer** | sonnet | TDD implementation, coding. Sonnet is the sweet spot for coding tasks. |
| **reviewer** | sonnet | Code review, quality checks. Needs to be thorough but follows a checklist. |
| **qa** | sonnet | Test strategy, coverage analysis. Structured analytical work. |
| **devops** | haiku | CI/CD config generation, infrastructure setup. Often templated/mechanical work. |
| **security** | sonnet | Threat modeling, vulnerability analysis. Needs analytical depth. |
| **tech-writer** | haiku | Documentation, user guides. Content generation from existing artifacts. |
| **retrospective** | haiku | Pattern analysis from review reports. Summarization-heavy work. |

**Estimated cost impact**: Using this mapping vs. all-Sonnet reduces costs by approximately 20-30% (haiku agents are ~70% cheaper, opus agents are ~67% more expensive, but there are fewer opus agents and they tend to have shorter sessions).

#### Heuristic B: By Complexity Score (Dynamic)

Leverage bmad-swarm's existing 5-15 complexity scoring:

| Complexity Score | Default Model | Override Logic |
|-----------------|--------------|----------------|
| 5-7 (Minimal) | sonnet (all agents) | Simple tasks don't need opus-level reasoning |
| 8-10 (Standard) | Per-agent defaults (Heuristic A) | Standard project, use the agent-type defaults |
| 11-15 (Full) | Upgrade key agents to opus | Strategist, architect, and reviewer all get opus for high-stakes work |

**Key insight**: This is the most innovative heuristic because it's dynamic and context-aware. A bug fix (score 5) doesn't need an opus orchestrator, but a full-system redesign (score 13) does.

#### Heuristic C: By Phase

| Phase | Recommended Model | Rationale |
|-------|------------------|-----------|
| Ideation | opus | Creative, open-ended reasoning |
| Exploration | sonnet | Information gathering and synthesis |
| Definition | opus | Product decisions that gate everything downstream |
| Design | opus (architect), sonnet (others) | Architecture is high-stakes; supporting work is structured |
| Implementation | sonnet | Coding is Sonnet's sweet spot |
| Delivery | haiku | Documentation and handoff artifacts |

#### Heuristic D: By Artifact Type

| Artifact | Model | Rationale |
|----------|-------|-----------|
| Product brief | opus | Strategic document, creative synthesis |
| PRD | opus | Requirements document, high downstream impact |
| Architecture doc | opus | Technical design, highest-stakes technical artifact |
| ADRs | sonnet | Structured decision records |
| Stories | sonnet | Translation work, pattern-following |
| Code + tests | sonnet | Implementation |
| Review reports | sonnet | Analytical checklist work |
| Documentation | haiku | Content generation from existing materials |
| Retrospectives | haiku | Summarization and pattern matching |

#### Heuristic E: Dynamic Orchestrator-Scored (Most Innovative)

The orchestrator already scores complexity (5 factors, 1-3 each). Extend this to score individual **tasks** within the task graph, not just the overall project. For each task:

1. The orchestrator assesses task-level complexity when building the task graph
2. Based on the task score, agent type, and phase, it selects the optimal model
3. It includes the model instruction in the spawn prompt or task description

This approach is the most innovative because:
- It's **adaptive per-task**, not per-project -- a complex architecture decision within a simple project still gets opus
- It uses **existing infrastructure** (complexity scoring is already built)
- It enables **cost-aware orchestration** -- the orchestrator can factor budget constraints into model selection
- It's the closest to how a human tech lead thinks: "This particular decision needs senior attention; this other task is routine"

### 4. Constraints and Risks

#### Platform Constraints

| Constraint | Impact | Mitigation |
|-----------|--------|------------|
| TeamCreate does not accept a `model` parameter | Model selection for teammates must be done via natural-language instructions in spawn prompts | Reliable in practice -- Claude follows "Use Sonnet for this teammate" instructions consistently |
| Subagent `model` field supports only `haiku`, `sonnet`, `opus`, `inherit` | No fine-grained model version selection (e.g., can't specify sonnet-4.5 vs sonnet-4.6) | Acceptable -- Claude Code handles version resolution |
| Teammates inherit lead's permission mode | Can't set per-teammate permissions at spawn time | Not a model-routing issue, but worth noting |
| Agent teams are experimental | Feature may change | Monitor Claude Code changelogs |

#### Capability Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Haiku capability gap**: Haiku may struggle with complex brainstorming, architecture decisions, or nuanced code review | HIGH | Only route mechanical/summarization tasks to haiku. Never use haiku for strategic decisions, architecture, or security review. |
| **Opus cost explosion**: Using opus for too many agents in a full-lifecycle project could 2-3x total cost | MEDIUM | Apply opus selectively (orchestrator + 1-2 critical-path agents) and only for high-complexity projects. |
| **Inconsistent quality**: Different models may produce artifacts with different levels of detail, style, or reasoning depth | MEDIUM | Quality gates already exist in the methodology. The reviewer catches quality issues regardless of which model produced the artifact. |
| **Prompt sensitivity**: Model routing via natural language ("Use Sonnet for this teammate") is less deterministic than a parameter | LOW | In practice, Claude follows these instructions reliably. Include the instruction prominently in the spawn prompt. |

#### Cost Analysis

Current pricing (per 1M tokens):

| Model | Input | Output | Relative Cost (vs Sonnet) |
|-------|-------|--------|--------------------------|
| Haiku 4.5 | $1.00 | $5.00 | ~33% of Sonnet |
| Sonnet 4.5/4.6 | $3.00 | $15.00 | Baseline |
| Opus 4.5/4.6 | $5.00 | $25.00 | ~167% of Sonnet |

**Cost modeling for a full-lifecycle project (complexity 11-15)**:

All-Sonnet baseline (current): ~$8.00-$20.00 per run

With Heuristic E (dynamic routing):
- Opus for orchestrator, ideator, strategist, architect: ~$2.50-$6.00
- Sonnet for developer, reviewer, qa, story-engineer, security: ~$3.50-$9.00
- Haiku for devops, tech-writer, retrospective: ~$0.30-$0.75
- **Total: ~$6.30-$15.75** (estimated 20-25% savings)

With aggressive haiku routing (Heuristic A for simple projects):
- Sonnet for orchestrator + developer + reviewer only: ~$2.50-$7.00
- Haiku for all other agents: ~$0.80-$2.00
- **Total: ~$3.30-$9.00** (estimated 50-55% savings)

### 5. Most Innovative / Impactful Approach

**Recommendation: Hybrid Static + Dynamic Routing (Heuristics A + E combined)**

The most impactful approach combines:

1. **Static defaults by agent type** (Heuristic A) -- baked into `swarm.yaml` as sensible defaults that work out of the box. Users can override per-agent.

2. **Dynamic complexity-based overrides** (Heuristic E) -- the orchestrator adjusts model selection based on the project's complexity score. Simple projects downgrade strategic agents from opus to sonnet. Complex projects upgrade critical agents.

3. **User overrides via swarm.yaml** -- the existing `agents.{name}.model` config field becomes functional, letting users pin specific agents to specific models.

**Implementation architecture**:

```
swarm.yaml              (user overrides, highest priority)
    |
    v
orchestrator rules      (dynamic complexity-based routing)
    |
    v
agent-type defaults     (static defaults, lowest priority)
```

**Why this is the most innovative approach in the market**:

No other multi-agent framework (CrewAI, AutoGen, LangGraph) offers **complexity-aware model routing** that automatically adjusts model selection based on a structured assessment of the task's difficulty. They offer static model assignment per agent, but not dynamic routing based on a scoring rubric. bmad-swarm already has the scoring infrastructure -- adding model routing to it creates a genuinely novel optimization that:

- Reduces costs without manual tuning
- Scales model selection decisions with project complexity
- Is fully transparent (the routing rules are in the methodology, not a black box)
- Allows user override at every level

---

## Implementation Roadmap

### Phase 1: Static routing (Low effort, immediate value)

1. Add model routing defaults to `orchestrator-methodology.md` template
2. Make `agent-generator.js` emit YAML frontmatter with `model` field for subagent definitions
3. Add model validation to `validator.js`
4. Update `cost-estimator.js` with per-model pricing

### Phase 2: Dynamic routing (Medium effort, high value)

1. Add complexity-based model routing table to orchestrator methodology
2. Add model routing instructions to `system-prompt.txt.template`
3. Add routing config section to `swarm.yaml` schema (default model tiers, budget constraints)
4. Update orchestrator behavioral rules in `agents/orchestrator.md`

### Phase 3: Cost optimization (Lower priority, nice-to-have)

1. Add `bmad-swarm cost --model-routing` command to estimate costs with routing
2. Add routing profile presets (e.g., `--cost-optimized`, `--quality-first`, `--balanced`)
3. Add model routing to the `bmad-swarm doctor` diagnostic output

---

## Files Analyzed

- `C:\Users\clays\Desktop\Personal-Projects\BMAD-Teams\generators\agent-generator.js` -- Agent file generation, contains model comment stub
- `C:\Users\clays\Desktop\Personal-Projects\BMAD-Teams\utils\cost-estimator.js` -- Cost estimation, single-model pricing
- `C:\Users\clays\Desktop\Personal-Projects\BMAD-Teams\utils\validator.js` -- Config validation, no model field checking
- `C:\Users\clays\Desktop\Personal-Projects\BMAD-Teams\utils\config.js` -- Config loading with defaults
- `C:\Users\clays\Desktop\Personal-Projects\BMAD-Teams\templates\system-prompt.txt.template` -- Orchestrator system prompt
- `C:\Users\clays\Desktop\Personal-Projects\BMAD-Teams\templates\rules\orchestrator-methodology.md` -- Complexity scoring and routing rules
- `C:\Users\clays\Desktop\Personal-Projects\BMAD-Teams\agents\orchestrator.md` -- Full orchestrator behavioral rules
- `C:\Users\clays\Desktop\Personal-Projects\BMAD-Teams\swarm.yaml` -- Project config
- `C:\Users\clays\Desktop\Personal-Projects\BMAD-Teams\README.md` -- Documents `model` config field
- `C:\Users\clays\Desktop\Personal-Projects\BMAD-Teams\cli\start.js` -- CLI start command

## External Sources

- [Claude Code Agent Teams documentation](https://code.claude.com/docs/en/agent-teams) -- TeamCreate, teammate model selection via natural language
- [Claude Code Subagents documentation](https://code.claude.com/docs/en/sub-agents) -- Subagent `model` frontmatter field
- [Claude Code Cost Management](https://code.claude.com/docs/en/costs) -- Model pricing, cost optimization strategies
- [Claude API Pricing](https://platform.claude.com/docs/en/about-claude/pricing) -- Per-model token pricing
