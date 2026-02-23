# Token Optimization & Model Selection Report

**Date**: 2026-02-23
**Author**: Researcher agent
**Scope**: Token audit of bmad-swarm prompt infrastructure + Opus vs Sonnet 4.6 analysis

---

## Part 1: Token Audit

### 1.1 What Gets Loaded Per Session

Every Claude Code session (including every teammate spawned via TeamCreate) automatically loads:

| Component | Words | Est. Tokens | Notes |
|-----------|-------|-------------|-------|
| **CLAUDE.md** | 184 | ~245 | Loaded for all sessions |
| **system-prompt.txt** | 279 | ~372 | Appended via `--append-system-prompt` for orchestrator only |
| **orchestrator-identity.md** (rule) | 535 | ~713 | `paths: "**/*"` -- loads for ALL agents |
| **orchestrator-methodology.md** (rule) | 1,014 | ~1,352 | NO path scope -- loads for ALL agents |
| **quality-standards.md** (rule) | 274 | ~365 | NO path scope -- loads for ALL agents |
| **coding-standards.md** (rule) | 235 | ~313 | `paths: "./src/**/*"` -- should scope to code files only |

**Total rules overhead for every agent**: ~2,058 words (~2,743 tokens) of rules load for EVERY teammate, regardless of role.

Additionally, each agent loads their specific `.claude/agents/{name}.md` file.

### 1.2 Agent Prompt Sizes

| Agent | Words | Est. Tokens | Size Rank |
|-------|-------|-------------|-----------|
| **orchestrator** | 3,473 | ~4,630 | 1st (largest) |
| **ideator** | 2,118 | ~2,824 | 2nd |
| **reviewer** | 1,595 | ~2,126 | 3rd |
| **developer** | 1,407 | ~1,876 | 4th |
| **qa** | 1,355 | ~1,806 | 5th |
| **researcher** | 1,321 | ~1,761 | 6th |
| **story-engineer** | 1,292 | ~1,722 | 7th |
| **security** | 1,252 | ~1,669 | 8th |
| **tech-writer** | 1,243 | ~1,657 | 9th |
| **strategist** | 1,221 | ~1,628 | 10th |
| **retrospective** | 1,210 | ~1,613 | 11th |
| **devops** | 1,128 | ~1,504 | 12th |
| **architect** | 1,062 | ~1,416 | 13th (smallest) |
| **ALL AGENTS** | **19,677** | **~26,236** | -- |

### 1.3 Total Context Per Teammate Type

When a teammate is spawned, it loads: CLAUDE.md + all rules + its agent file + spawn prompt from the lead.

| Teammate | Base Context (words) | Base Context (tokens) | With Spawn Prompt (~500 words) |
|----------|---------------------|-----------------------|-------------------------------|
| **Orchestrator** (main session) | 5,994 | ~7,992 | N/A (is the main session) |
| **Developer** | 3,649 | ~4,865 | ~5,532 tokens |
| **Reviewer** | 3,853 | ~5,137 | ~5,804 tokens |
| **Ideator** | 4,376 | ~5,834 | ~6,501 tokens |
| **Typical worker** (architect, etc.) | ~3,300 | ~4,400 | ~5,067 tokens |

### 1.4 Redundancy and Duplication Found

#### CRITICAL: orchestrator-methodology.md loads for every agent

`orchestrator-methodology.md` (1,014 words / ~1,352 tokens) contains the complexity scoring matrix, team composition table, phase skip rules, entry point routing, and autonomy override rules. This content is ONLY used by the orchestrator. However, because it has no `paths:` frontmatter, Claude Code loads it into EVERY agent's context.

**Waste per non-orchestrator agent**: ~1,352 tokens
**Waste across a 5-agent team**: ~5,408 tokens (4 workers x 1,352)

#### CRITICAL: orchestrator-identity.md loads for every agent

`orchestrator-identity.md` (535 words / ~713 tokens) has `paths: "**/*"`, which means it loads for ALL files in the project. This file contains the full agent routing table, orchestrator key rules, anti-patterns, and terminology. None of this is useful to a developer, reviewer, or any non-orchestrator agent.

**Waste per non-orchestrator agent**: ~713 tokens
**Waste across a 5-agent team**: ~2,852 tokens (4 workers x 713)

#### MAJOR: Orchestrator agent duplicates rule content

The orchestrator agent definition (`.claude/agents/orchestrator.md`, 3,473 words) contains a "Decision Matrix" section that duplicates content already in `orchestrator-methodology.md`:
- Complexity Scoring table (duplicated)
- Team Composition by Complexity table (duplicated)
- Phase Skip Rules table (duplicated)
- Autonomy Override Rules table (duplicated)
- Handling Rejections section (duplicated)

The orchestrator sees BOTH the rule AND the agent file, resulting in these tables appearing twice in its context.

**Estimated duplication**: ~600 words (~800 tokens) of redundant content in the orchestrator's context.

#### MODERATE: quality-standards.md lacks path scoping

`quality-standards.md` (274 words / ~365 tokens) loads for all agents. While quality standards have broad applicability, most of this content (phase quality gates, artifact quality criteria) is only relevant to the orchestrator and reviewer.

#### NOTE: Path scoping is buggy

Claude Code issue #16299 reports that path-scoped rules in `.claude/rules/` load into context globally regardless of `paths:` frontmatter. This means even properly scoped rules (like `coding-standards.md` scoped to `./src/**/*`) may load for all agents anyway.

### 1.5 Where Tokens Go in a Typical Session

For a "bug fix" workflow (orchestrator + developer + reviewer = 3 agents):

| Token Source | Orchestrator | Developer | Reviewer | Total |
|-------------|-------------|-----------|----------|-------|
| CLAUDE.md | 245 | 245 | 245 | 735 |
| Rules (all 4 files) | 2,743 | 2,743 | 2,743 | 8,229 |
| Agent definition | 4,630 | 1,876 | 2,126 | 8,632 |
| system-prompt.txt | 372 | 0 | 0 | 372 |
| Spawn prompt | 0 | ~667 | ~667 | 1,334 |
| **Subtotal (initial)** | **7,990** | **5,531** | **5,781** | **19,302** |
| Wasted (irrelevant rules) | 0 | 2,065 | 2,065 | 4,130 |

**~21% of initial context for worker agents is wasted on irrelevant orchestrator rules.**

For a full lifecycle project (orchestrator + 6 agents), the waste scales:
- 6 workers x ~2,065 wasted tokens = **~12,390 wasted tokens** just from irrelevant rules.

---

## Part 2: Top 5 Token Reduction Strategies

### Strategy 1: Scope orchestrator rules to orchestrator only
**Impact: HIGH (~2,065 tokens saved per worker agent)**
**Effort: LOW (2 file edits)**

Add `paths:` frontmatter to restrict `orchestrator-methodology.md` and `orchestrator-identity.md` to orchestrator-only contexts. However, given the Claude Code bug where path-scoped rules still load globally (issue #16299), the more reliable approach is:

**Option A (workaround for bug)**: Merge `orchestrator-methodology.md` and `orchestrator-identity.md` content INTO the orchestrator agent definition file (`.claude/agents/orchestrator.md`), then delete these rule files. Agent definition files only load for their specific agent.

**Option B (if/when bug is fixed)**: Add proper `paths:` frontmatter that scopes these to only the orchestrator's working context. But as of Feb 2026, this may not work reliably.

**Recommendation**: Option A. Move orchestrator-specific content from rules into the agent definition and delete the rule files.

### Strategy 2: Deduplicate orchestrator agent and rules
**Impact: MEDIUM (~800 tokens saved for orchestrator)**
**Effort: LOW (1 file edit)**

Remove the "Decision Matrix" section from `.claude/agents/orchestrator.md` since it duplicates `orchestrator-methodology.md`. If Strategy 1 merges rules into the agent file, then instead remove the rules files and keep only the agent file (no duplication either way).

### Strategy 3: Compress worker agent definitions
**Impact: MEDIUM (~300-500 tokens saved per agent, ~2,000-3,500 across full team)**
**Effort: MEDIUM (13 file edits)**

Current agent definitions average ~1,300 words. They contain significant prose that could be compressed:
- "You carry deep knowledge of..." paragraphs could be reduced to bullet lists
- Behavioral rules sections contain explanatory prose that could be tightened
- Project Info sections (identical 7-line block across all 13 agents) add ~90 tokens each

Specific reduction targets:
- Remove Project Info sections from agent files (total: ~1,170 tokens saved). This info is already in CLAUDE.md.
- Convert "Expertise" paragraphs from prose to bullet lists (~100 tokens saved per agent)
- Trim behavioral rules to essential directives, removing "this ensures that..." explanations

### Strategy 4: Tiered quality standards
**Impact: LOW-MEDIUM (~365 tokens saved for non-review agents)**
**Effort: LOW (1 file edit + 1 new file)**

Split `quality-standards.md` into:
- A minimal universal rule (~100 tokens): "All code requires tests. All code requires review before merge."
- A detailed standards file loaded only by orchestrator and reviewer (full phase gates, artifact criteria)

### Strategy 5: Lean CLAUDE.md with artifact-dir-only references
**Impact: LOW (~100 tokens saved)**
**Effort: LOW (1 file edit)**

The current CLAUDE.md is already lean (184 words). However, the artifact directory structure listing could be moved to the orchestrator agent definition since only the orchestrator needs to know all directories. Worker agents learn their relevant paths from their spawn prompt.

### Combined Impact Summary

| Strategy | Tokens Saved Per Worker | Tokens Saved Across 5-Agent Team |
|----------|------------------------|----------------------------------|
| 1. Scope orchestrator rules | ~2,065 | ~8,260 |
| 2. Deduplicate orchestrator | ~800 | ~800 |
| 3. Compress agent defs | ~400 avg | ~2,800 |
| 4. Tiered quality standards | ~265 | ~1,060 |
| 5. Lean CLAUDE.md | ~50 | ~250 |
| **TOTAL** | -- | **~13,170** |

This represents a **~25-30% reduction** in initial context token usage across a typical team.

---

## Part 3: Opus vs Sonnet 4.6 -- Model Selection Analysis

### 3.1 Capability Comparison (Feb 2026 Benchmarks)

| Benchmark | Opus 4.6 | Sonnet 4.6 | Gap |
|-----------|----------|------------|-----|
| SWE-bench Verified | 80.8% | 79.6% | 1.2 pp |
| OSWorld-Verified (computer use) | 72.7% | 72.5% | 0.2 pp |
| GDPval-AA (office/knowledge work) | 1606 Elo | 1633 Elo | Sonnet wins |
| GPQA (scientific reasoning) | 91.3% | 74.1% | **17.2 pp -- Opus wins decisively** |
| Math | -- | 89% | Sonnet major improvement |

### 3.2 Cost Comparison

| Metric | Opus 4.6 | Sonnet 4.6 | Ratio |
|--------|----------|------------|-------|
| Input tokens | $5/M | $3/M | 1.7x |
| Output tokens | $25/M | $15/M | 1.7x |
| Typical session cost | ~$3.00 | ~$0.60 | 5x |
| Pro plan usage | ~1 Opus = 10+ Sonnet conversations | Baseline | 10x+ |

On Claude Pro/Max subscriptions, **one Opus conversation consumes as much quota as 10+ Sonnet conversations**. The user reports burning through their 5-hour usage block in under an hour with Opus, which is consistent with these ratios.

### 3.3 Where Opus Genuinely Outperforms Sonnet 4.6

1. **Deep scientific/expert reasoning** (GPQA: 91.3% vs 74.1%) -- significant gap
2. **Multi-agent orchestration** -- Opus is documented to handle complex coordination of multiple agents better, where its deeper reasoning compounds across agent interactions
3. **Long-horizon planning** -- Opus shows stronger performance on tasks requiring coherent planning across many steps

### 3.4 Where Sonnet 4.6 Matches or Beats Opus

1. **Software engineering** (SWE-bench: 79.6% vs 80.8%) -- negligible gap
2. **Computer use / agentic tasks** (OSWorld: 72.5% vs 72.7%) -- essentially tied
3. **Office/knowledge work** (GDPval: Sonnet wins)
4. **Speed** -- Sonnet is significantly faster output
5. **Math** -- Sonnet 4.6 made huge leaps (89% vs Sonnet 4.5's 62%)

### 3.5 Recommendation for bmad-swarm

#### Default to Sonnet 4.6 for ALL agents

The data is clear: for software engineering tasks -- which is what every bmad-swarm agent does -- Sonnet 4.6 performs within 1.2 percentage points of Opus at 5x lower cost and 10x+ better usage efficiency on subscription plans.

#### Opus case: Orchestrator only, conditionally

The only plausible case for Opus in bmad-swarm is the orchestrator role, where:
- It coordinates multiple agents
- It performs complexity assessment and team composition decisions
- It routes work and manages the full lifecycle

However, even this case is weak because:
- The orchestrator's decisions are well-structured by the methodology rules (scoring matrix, entry point routing, team composition tables)
- Following a decision matrix is not "deep reasoning" -- it is pattern matching that Sonnet excels at
- The orchestrator does not do scientific reasoning (Opus's strongest advantage)

**Verdict**: Sonnet 4.6 for everything. The 10x+ usage efficiency completely dominates the <2% quality difference for coding tasks.

#### Proposed Model Routing Strategy

If bmad-swarm eventually supports per-agent model selection:

| Agent | Recommended Model | Rationale |
|-------|------------------|-----------|
| orchestrator | Sonnet 4.6 | Methodology tables make decisions structured; no deep reasoning needed |
| developer | Sonnet 4.6 | SWE-bench gap is negligible |
| reviewer | Sonnet 4.6 | Code review is pattern-matching, not deep reasoning |
| architect | Sonnet 4.6 | Design decisions are structured by PRD/constraints |
| ideator | Sonnet 4.6 | Creative brainstorming works well; Sonnet preferred by users 59% of time over Opus 4.5 |
| All others | Sonnet 4.6 | No task type justifies the 5x cost premium |

### 3.6 Practical Impact of Switching to Sonnet-Only

For a user on Claude Pro ($20/month) with a 5-hour usage window:

| Scenario | Opus | Sonnet 4.6 | Improvement |
|----------|------|------------|-------------|
| Conversations per 5-hour window | ~4-8 | ~40-80 | **10x more sessions** |
| Full lifecycle project (6 agents) | Exhausts quota in ~30-60 min | Could run 5-8 full projects | **5-8x more throughput** |
| Bug fix (3 agents) | ~15-20 min of quota | ~2-3 min of quota | **7-10x more efficient** |

---

## Part 4: Concrete Proposed Changes

### Immediate (High Impact, Low Effort)

1. **Delete `.claude/rules/orchestrator-methodology.md`** and merge its content into `.claude/agents/orchestrator.md` (or confirm it is already duplicated there and just delete the rule).

2. **Delete `.claude/rules/orchestrator-identity.md`** and merge its unique content (Agent Team table, Key Rules, Team Coordination, Anti-Patterns, Terminology) into `.claude/agents/orchestrator.md`.

3. **Remove the "Decision Matrix" section from `.claude/agents/orchestrator.md`** if it duplicates content already in the methodology rule (handle together with item 1 -- keep one copy).

4. **Remove "Project Info" sections from all 13 agent files** -- this information (project name, type, language, artifacts dir, code dir, autonomy) is already in CLAUDE.md and adds ~90 tokens per agent for no benefit.

### Short-Term (Medium Impact, Medium Effort)

5. **Add model routing support to `swarm.yaml`**: Allow per-agent model specification:
   ```yaml
   agents:
     orchestrator:
       model: sonnet-4-6
     developer:
       model: sonnet-4-6
   ```
   The agent-generator already supports a `model` field (it writes a `<!-- preferred-model -->` comment). This could be expanded to actually pass model selection to `TeamCreate`.

6. **Compress agent behavioral rules**: Convert prose paragraphs to terse directive bullets. Target: 20-30% reduction in agent definition sizes (~300-500 tokens per agent).

7. **Slim down `quality-standards.md`**: Keep only the 2-line universal mandate ("tests required, review required") in the rule file. Move phase gates and artifact criteria to the orchestrator agent definition.

### Future Considerations

8. **Lazy artifact loading in spawn prompts**: Instead of including full artifact content in spawn prompts, include only file paths and brief summaries. Agents can read full artifacts on demand. This reduces spawn prompt sizes from ~500-2000 words to ~100-200 words.

9. **Monitor Claude Code path-scoping bug**: If issue #16299 is fixed, rules can be properly scoped per-agent instead of merged into agent definitions.

10. **Context window monitoring**: Add a `bmad-swarm token-audit` command that calculates the total context loaded per agent type, helping users track token efficiency over time.

---

## Sources

- [Claude Sonnet 4.6 vs Opus 4.6 Comparison (NxCode)](https://www.nxcode.io/resources/news/claude-sonnet-4-6-vs-opus-4-6-which-model-to-choose-2026)
- [Sonnet 4.6 Does Better Than Opus 4.6 (Medium)](https://medium.com/ai-software-engineer/claude-sonnet-4-6-is-here-it-does-better-than-expensive-opus-4-6-heres-full-breakdown-b7650b226c3b)
- [Claude Code Agent Teams Documentation](https://code.claude.com/docs/en/agent-teams)
- [Claude Code Rate Limits (Northflank)](https://northflank.com/blog/claude-rate-limits-claude-code-pricing-cost)
- [Sonnet 4.6 Matches Flagship at 1/5 Cost (VentureBeat)](https://venturebeat.com/technology/anthropics-sonnet-4-6-matches-flagship-ai-performance-at-one-fifth-the-cost)
- [Path-scoped rules bug (GitHub issue #16299)](https://github.com/anthropics/claude-code/issues/16299)
- [Claude Code Rules Directory (ClaudeFast)](https://claudefa.st/blog/guide/mechanics/rules-directory)
- [5 Dimensions to Compare Opus 4.6 and Sonnet 4.6 (Apiyi)](https://help.apiyi.com/en/claude-opus-4-6-vs-sonnet-4-6-comparison-guide-en.html)
- [Extra Usage for Paid Plans (Claude Help Center)](https://support.claude.com/en/articles/12429409-extra-usage-for-paid-claude-plans)
- [Opus 4.5 Usage Limits Reduced (GitHub issue #17084)](https://github.com/anthropics/claude-code/issues/17084)
