# Sprint Plan

**Date**: 2026-02-23
**Architect**: architect agent
**Scope**: All stories for Tracks A, B, C

---

## Track A: Bug Fixes (9 stories)

| Story | Title | Parallel? | Dependencies |
|-------|-------|-----------|-------------|
| A-BUG-1 | Add hash-based modification detection to settings.json | Yes | None |
| A-BUG-2 | Replace all AGENT_NAMES callers with getAgentNames() | Yes | None |
| A-BUG-3 | Register TaskCompleted and TeammateIdle hooks in settings.json | Yes | None |
| A-BUG-4 | Update project.yaml phase to reflect v1.2.0 | Yes | None |
| A-BUG-5 | Add ideation phase to swarm.yaml phases block | Yes | None |
| A-BUG-6 | Fix code_dir to point to actual source directories | Yes | None |
| A-BUG-7 | Add warning message when --dangerous flag is used | Yes | None |
| A-BUG-8 | Update update command completion message for settings.json | No | A-BUG-1 |
| A-BUG-9 | Document --force flag for update command in README | Yes | None |

**Parallelism**: A-BUG-1 through A-BUG-7 and A-BUG-9 can all run in parallel. A-BUG-8 must wait for A-BUG-1 (it depends on the new `generateSettings()` return value).

**Recommended execution order**:
1. A-BUG-1 (highest priority -- BLOCKING finding)
2. A-BUG-2, A-BUG-3, A-BUG-4, A-BUG-5, A-BUG-6, A-BUG-7, A-BUG-9 (all parallel)
3. A-BUG-8 (after A-BUG-1 completes)

---

## Track B: Token Optimization + Model Changes (5 stories)

| Story | Title | Parallel? | Dependencies |
|-------|-------|-----------|-------------|
| B-TOKEN-1 | Move orchestrator rule content into orchestrator agent file | Yes | None |
| B-TOKEN-2 | Remove redundant Project Info sections from agent templates | Yes | None |
| B-TOKEN-3 | Deduplicate orchestrator agent content after rule merge | No | B-TOKEN-1 |
| B-MODEL-1 | Set Sonnet 4.6 as default model and document Opus availability | No | B-TOKEN-1, B-TOKEN-3 |
| B-MODEL-2 | Wire model field from swarm.yaml into agent file frontmatter | Yes | None |

**Parallelism**: B-TOKEN-1, B-TOKEN-2, and B-MODEL-2 can run in parallel. B-TOKEN-3 depends on B-TOKEN-1. B-MODEL-1 depends on B-TOKEN-1 and B-TOKEN-3 (it adds a Model Selection section to the orchestrator agent file that should be deduplicated).

**Recommended execution order**:
1. B-TOKEN-1 and B-TOKEN-2 and B-MODEL-2 (parallel)
2. B-TOKEN-3 (after B-TOKEN-1)
3. B-MODEL-1 (after B-TOKEN-3)

---

## Track C: --disallowedTools Feature + Feature Wiring (4 stories)

| Story | Title | Parallel? | Dependencies |
|-------|-------|-----------|-------------|
| C-TOOLS-1 | Add --disallowedTools to bmad-swarm start | Yes | None |
| C-WIRE-1 | Wire workspace.js into CLI | Yes | None |
| C-WIRE-2 | Wire plugins.js into CLI | Yes | None |
| C-WIRE-3 | Wire GitHub Actions generator into CLI | Yes | None |

**Parallelism**: All 4 stories can run fully in parallel. They touch different files and have no interdependencies.

---

## Cross-Track Dependencies

```
A-BUG-1 ──> A-BUG-8  (A-BUG-8 depends on A-BUG-1's new generateSettings signature)

B-TOKEN-1 ──> B-TOKEN-3 ──> B-MODEL-1  (sequential chain for orchestrator.md content)

No cross-track dependencies between A, B, and C.
```

---

## Developer Assignment Recommendation

Given 3 parallel developers (Tracks A, B, C):

### Developer A (Track A: Bug Fixes)
- Start with A-BUG-1 (BLOCKING priority)
- Then A-BUG-2 through A-BUG-7 and A-BUG-9 (any order)
- Finish with A-BUG-8 (depends on A-BUG-1)
- Estimated scope: 9 stories, mostly small changes. Several are data-only (A-BUG-4, A-BUG-5, A-BUG-9).

### Developer B (Track B: Token Optimization + Model)
- Start with B-TOKEN-1 (largest story, merge rules into agent file)
- In parallel: B-TOKEN-2 and B-MODEL-2
- Then B-TOKEN-3 (dedup after merge)
- Finish with B-MODEL-1 (add model docs after dedup)
- Estimated scope: 5 stories, includes significant content editing of orchestrator.md.

### Developer C (Track C: Feature Wiring)
- All 4 stories are independent, any order
- C-TOOLS-1 is the most impactful (new CLI flag)
- C-WIRE-1, C-WIRE-2, C-WIRE-3 are new CLI command files
- Estimated scope: 4 stories, includes creating 3 new CLI files.

---

## Files Created

| File | Description |
|------|-------------|
| `artifacts/implementation/stories/story-A-BUG-1.md` | Hash protection for settings.json |
| `artifacts/implementation/stories/story-A-BUG-2.md` | Migrate AGENT_NAMES to getAgentNames() |
| `artifacts/implementation/stories/story-A-BUG-3.md` | Register TaskCompleted/TeammateIdle hooks |
| `artifacts/implementation/stories/story-A-BUG-4.md` | Update project.yaml phase |
| `artifacts/implementation/stories/story-A-BUG-5.md` | Add ideation to swarm.yaml phases |
| `artifacts/implementation/stories/story-A-BUG-6.md` | Fix code_dir path |
| `artifacts/implementation/stories/story-A-BUG-7.md` | Add --dangerous warning |
| `artifacts/implementation/stories/story-A-BUG-8.md` | Update command message accuracy |
| `artifacts/implementation/stories/story-A-BUG-9.md` | Document --force in README |
| `artifacts/implementation/stories/story-B-TOKEN-1.md` | Move orchestrator rules to agent file |
| `artifacts/implementation/stories/story-B-TOKEN-2.md` | Remove Project Info from agents |
| `artifacts/implementation/stories/story-B-TOKEN-3.md` | Deduplicate orchestrator content |
| `artifacts/implementation/stories/story-B-MODEL-1.md` | Sonnet default + Opus docs |
| `artifacts/implementation/stories/story-B-MODEL-2.md` | Wire model frontmatter |
| `artifacts/implementation/stories/story-C-TOOLS-1.md` | --disallowedTools for start |
| `artifacts/implementation/stories/story-C-WIRE-1.md` | Wire workspace.js into CLI |
| `artifacts/implementation/stories/story-C-WIRE-2.md` | Wire plugins.js into CLI |
| `artifacts/implementation/stories/story-C-WIRE-3.md` | Wire GitHub Actions into CLI |
