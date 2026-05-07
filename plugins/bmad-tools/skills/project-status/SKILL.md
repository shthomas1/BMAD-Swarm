---
name: project-status
description: BMAD-Swarm project dashboard. Surface current phase, story counts (planned/in-progress/done/blocked), recent decisions, and pending human approvals. Use when the user invokes /bmad-tools:project-status or asks "where are we" / "project status".
allowed-tools: Read Grep Glob Bash
---

# BMAD Status Dashboard

Read `artifacts/` and project config to build a one-page snapshot of the current BMAD-Swarm project state.

## Dynamic context

- Project config: !`type project.yaml 2>nul || cat project.yaml 2>/dev/null`
- Swarm config: !`type swarm.yaml 2>nul || cat swarm.yaml 2>/dev/null`
- Story files: !`dir /b artifacts\implementation\stories 2>nul || ls artifacts/implementation/stories 2>/dev/null`
- Planning artifacts: !`dir /b artifacts\planning 2>nul || ls artifacts/planning 2>/dev/null`
- Design artifacts: !`dir /b artifacts\design 2>nul || ls artifacts/design 2>/dev/null`
- Recent decisions (tail): !`powershell -Command "Get-Content artifacts/context/decision-log.md -Tail 60" 2>nul || tail -n 60 artifacts/context/decision-log.md 2>/dev/null`

## What you do (Claude)

1. From `project.yaml` and `swarm.yaml`, read the project name, current phase (if declared), autonomy mode, and team mode. If a field is absent, write `unknown`.
2. For each story file in `artifacts/implementation/stories/`, use the Grep tool to extract the `## Status:` value. Bucket counts:
   - `draft`, `ready` → **planned**
   - `in-progress` → **in-progress**
   - `review` → **review**
   - `complete` → **done**
   - any line containing `blocked` → **blocked**
   - missing status → **unknown**
3. Scan `artifacts/context/decision-log.md` for the 5 most recent `### D-NNN:` records (highest IDs). Capture summary, status.
4. Scan `artifacts/planning/` and `artifacts/design/` for files named like `prd*.md`, `architecture*.md`. For each, look for an explicit approval marker (`Status: approved`, `Approved by:`, or `## Approval`). If none present, list it as **pending human approval**.
5. Render the dashboard:

```
# BMAD-Swarm Status — <project-name>

## Phase

- Current phase: <value>
- Autonomy: <value>
- Team mode: <value>

## Stories

| Status | Count | Files |
|---|---|---|
| planned | N | story-1.1.md, story-1.2.md |
| in-progress | N | ... |
| review | N | ... |
| done | N | ... |
| blocked | N | ... |
| unknown | N | ... |

## Pending human approvals

- [ ] artifacts/planning/prd.md (no approval marker)
- [x] artifacts/design/architecture.md (Status: approved)

## Recent decisions

| ID | Summary | Status |
|---|---|---|
| D-012 | ... | accepted |

## Suggested next action

<one sentence: e.g. "Approve PRD before downstream work; or unblock 2 in-progress stories.">
```

## Notes

- Be tolerant of missing files. If `artifacts/implementation/stories/` does not exist, report `0 stories` rather than failing.
- Do not modify any file. Read-only skill.
- Use the Bash tool for any pieces dynamic context did not capture (e.g., specific grep patterns), but prefer Grep/Glob.
