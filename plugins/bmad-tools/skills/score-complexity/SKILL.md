---
name: score-complexity
description: Score a request on the BMAD 5-dimension complexity table (5–15) and recommend an entry workflow (/bug, /feature, full-lifecycle) and autonomy level. Use when the user invokes /bmad-tools:score-complexity or asks "how complex is this".
allowed-tools: Read Grep Glob Bash
---

# BMAD Complexity Score

Assess a request on the BMAD 5-dimension complexity scale and recommend the right entry point and autonomy.

## Inputs

`$ARGUMENTS` — free-text description of the request being scored. Required.

If empty, ask the user for the request, then stop.

## Dynamic context (for grounding)

- Project CLAUDE.md: !`type CLAUDE.md 2>nul || cat CLAUDE.md 2>/dev/null`
- Recent commits: !`git log --oneline -n 20 2>nul || git log --oneline -n 20`
- Tracked top-level layout: !`dir /b 2>nul || ls`

## What you do (Claude)

1. Re-read the request in `$ARGUMENTS`.
2. Score each of the 5 dimensions on a 1–3 scale, with a one-line rationale per dimension grounded in the dynamic context above. Use the rubric:

| Dim | 1 (low) | 2 (medium) | 3 (high) |
|---|---|---|---|
| Scope | one file/function, well-bounded | a feature spanning ~3–6 files | epic-level, multi-component |
| Clarity | clear ask + acceptance criteria implied | some ambiguity | conflicting goals or unknown success |
| Risk | reversible, no users affected | local data/UX risk | security, money, data loss, prod outage |
| Codebase size | tiny / new repo | medium codebase | large or unfamiliar codebase |
| Dependencies | self-contained | depends on 1–2 modules | crosses many subsystems / external services |

3. Sum to a total score in [5, 15].
4. Recommend an entry workflow and autonomy:

| Total | Recommended workflow | Autonomy suggestion |
|---|---|---|
| 5–7 | `/bug` (single-shot fix) | auto |
| 8–11 | `/feature` (mini-lifecycle) | auto with review checkpoints |
| 12–15 | full-lifecycle (`/plan` → exploration → PRD → architecture → stories) | guided (require human approvals on PRD + architecture) |

5. Render the report:

```
# Complexity Score: <one-line restatement of request>

| Dim | Score | Rationale |
|---|---|---|
| Scope | 1–3 | ... |
| Clarity | 1–3 | ... |
| Risk | 1–3 | ... |
| Codebase size | 1–3 | ... |
| Dependencies | 1–3 | ... |

**Total**: N / 15
**Recommended entry**: /bug | /feature | full-lifecycle
**Recommended autonomy**: auto | auto-with-review | guided

## Notes

- Risk drivers: <named risk factors observed>
- Open questions: <ambiguities the user should resolve before kickoff>
```

## Notes

- Be conservative on risk: if you see auth, money, prod, data migration, or schema changes, score risk ≥ 2 and explain why.
- Read-only skill. No file writes.
