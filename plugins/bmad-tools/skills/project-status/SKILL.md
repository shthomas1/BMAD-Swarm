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
- ADR files: !`dir /b artifacts\design\decisions 2>nul || ls artifacts/design/decisions 2>/dev/null`
- Recent decisions (tail): !`powershell -Command "Get-Content artifacts/context/decision-log.md -Tail 60" 2>nul || tail -n 60 artifacts/context/decision-log.md 2>/dev/null`

## What you do (Claude)

1. From `project.yaml` and `swarm.yaml`, read the project name, current phase (if declared), autonomy mode, and team mode. If a field is absent, write `unknown`.
2. For each story file in `artifacts/implementation/stories/`, use the Grep tool to extract the `## Status:` value. Bucket counts:
   - `draft`, `ready` → **planned**
   - `in-progress` → **in-progress**
   - `review` → **review**
   - `complete` → **done**
   - any line containing `blocked` → **blocked**
   - **missing status** → run the fallback chain below before bucketing as `unknown`:
     - **(a) Filename heuristic**: if the filename contains `complete` or `done` (case-insensitive), bucket as **done**.
     - **(b) Git history**: run `git log --follow -- <file>` and inspect commit subjects. If any commit subject matches `/\b(complete|completed|merged|done|implemented)\b/i`, bucket as **done**.
     - **(c) Fall through**: if neither (a) nor (b) matches, bucket as **unknown**.
   - When a fallback was applied, annotate the row in the dashboard (e.g. `done (inferred from git history)`).
3. Scan `artifacts/context/decision-log.md` for the 5 most recent decision records. Tolerate both `### D-NNN:` and `## D-NNN —` heading styles. Capture summary, status. Use the regex `^##+\s+(D-[A-Z0-9]+(?:-\d+)?)\b` for declared IDs.
4. Scan `artifacts/planning/` and `artifacts/design/` for files that play the role of PRD or architecture. Recognize **all** of:
   - `prd*.md`
   - `architecture*.md`
   - `*plan*.md` (e.g. `implementation-plan.md`, `bmad-tools-v0.2-plan.md`) — counts as a PRD-equivalent planning artifact.
   - `artifacts/design/decisions/adr-*.md` — counts as an architecture-equivalent decision record.

   For each file, look for an explicit approval marker (`Status: approved`, `Approved by:`, `## Approval`, or front-matter `approved: true`). If none present, list it as **pending human approval**. Note the role (PRD-equivalent / architecture-equivalent / ADR) in the dashboard row.
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

(Annotate inferred statuses as `done (inferred from git)` etc.)

## Pending human approvals

- [ ] artifacts/planning/prd.md (PRD; no approval marker)
- [ ] artifacts/planning/implementation-plan.md (PRD-equivalent plan; no approval marker)
- [x] artifacts/design/architecture.md (Status: approved)
- [ ] artifacts/design/decisions/adr-003-foo.md (ADR; no approval marker)

## Recent decisions

| ID | Summary | Status |
|---|---|---|
| D-012 | ... | accepted |

## Suggested next action

<one sentence: e.g. "Approve PRD before downstream work; or unblock 2 in-progress stories.">
```

## Notes

- Be tolerant of missing files. If `artifacts/implementation/stories/` does not exist, report `0 stories` rather than failing.
- The `git log --follow` fallback requires the project to be a git repo. If `git` fails (not a repo, or git not installed), silently skip the (b) step and proceed to (c).
- Do not modify any file. Read-only skill.
- Use the Bash tool for the `git log` fallback and any pieces dynamic context did not capture, but prefer Grep/Glob for static lookups.
