---
name: audit-decisions
description: Audit D-ID propagation across the BMAD artifact tree. Walk the decision log for declared D-IDs, then grep planning/design/implementation for references. Report orphan IDs (declared but never referenced) and dangling refs (referenced but not in the log). Use when the user invokes /bmad-tools:audit-decisions.
allowed-tools: Read Grep Glob Bash
---

# Audit Decisions

Verify that decisions logged in `artifacts/context/decision-log.md` are actually propagated to downstream artifacts.

## Dynamic context

- Decision log: !`type artifacts\context\decision-log.md 2>nul || cat artifacts/context/decision-log.md 2>/dev/null`

## What you do (Claude)

1. Read `artifacts/context/decision-log.md`. If it does not exist, report and stop.
2. Extract the set **Declared** = every D-ID that appears as a record heading. Tolerate both the schema-spec form `### D-NNN: ...` and the in-the-wild form `## D-NNN — ...`. Use Grep with the pattern `^##+\s+(D-[A-Z0-9]+(?:-\d+)?)\b` (captures `D-001`, `D-022`, `D-BRN-1`, etc).
3. Extract the set **Referenced** = every D-ID matched by `\bD-(?:\d{3,}|[A-Z]{2,}-\d+)\b` in any `*.md` file under:
   - `artifacts/planning/`
   - `artifacts/design/`
   - `artifacts/implementation/`
   Reject the literal placeholders `D-ID`, `D-N`, `D-NNN` and any token whose trailing segment after `D-` is purely letters (no digits) — these are documentation placeholders, not real references. Use Grep with type filter and dedupe across files.
4. Compute:
   - **Orphans** = Declared \ Referenced
   - **Dangling** = Referenced \ Declared
5. For each orphan, identify the matching record in the log (date, summary, status) and the listed `Affects:` artifacts (these are the downstream stubs that should mention the D-ID but apparently don't).
6. For each dangling reference, list the file(s) and the surrounding line so the user can quickly see context.
7. Render the report:

```
# Audit Decisions

- Declared D-IDs: N
- Referenced D-IDs: M
- Orphan (declared, never referenced): K
- Dangling (referenced, not in log): J

## Orphans

| D-ID | Summary | Status | `Affects` per log | Suggested fix |
|---|---|---|---|---|
| D-007 | OAuth2 with PKCE | accepted | PRD:FR-12, Stories:3-* | Confirm story-3.1 / story-3.2 reference D-007 in Dev Notes. |

## Dangling

| D-ID | Found in file | Suggested fix |
|---|---|---|
| D-099 | artifacts/implementation/stories/story-2.3.md (line 14) | Add a record to decision-log.md or remove the reference. |

## Verdict

PASS | FAIL — N orphans, M dangling.
```

8. If both sets are empty, report "All decisions are propagated. No orphans or dangling references." and exit.

## Notes

- Read-only skill. Do not edit the decision log or any artifact.
- The companion hook (`hooks/audit-decisions.cjs`) runs the same audit on `git commit` if enabled, but only prints an advisory warning and never blocks the commit.
- See README "Enabling the audit-decisions hook" for opt-in instructions.
