---
name: session-report
description: Auto-mode "what happened while I was away" — editorial-style Markdown report covering decisions logged, stories shipped, reviews filed, and pending human attention since a given time. Use after long auto-mode runs or first thing in the morning.
allowed-tools: Read Grep Glob Bash Write
---

# Session Report

Editorial-style "since you left" report for BMAD-Swarm projects running in auto mode. The report tells the human, at a glance, what was decided, what shipped, what's blocked, and what needs their attention — written so it can be archived under `artifacts/reviews/` and shared async.

## Inputs

`$ARGUMENTS` — optional `[<since>] [--apply] [--out <path>]`.

- `<since>` resolution:
  - Default (`last-commit`): the timestamp of the last commit on `HEAD` (`git log -1 --format=%cI`). Window = `<that-time> .. now`.
  - Duration like `30m`, `4h`, `2d` → subtract from now.
  - Calendar date `YYYY-MM-DD` → start of that date (00:00 local) to now.
  - If git history is unavailable or the resolution fails: fall back to "last 4 hours" and prepend a warning to the report.
- `--apply` writes the report to `artifacts/reviews/session-report-<YYYY-MM-DD>.md`. Without `--apply`, print only.
- `--out <path>` overrides the apply path. Implies `--apply`.

Examples:

- `/bmad-tools:session-report`
- `/bmad-tools:session-report 6h`
- `/bmad-tools:session-report 2d --apply`
- `/bmad-tools:session-report 2026-05-06 --apply --out artifacts/reviews/morning-recap.md`

## Dynamic context

- Project config: !`type project.yaml 2>nul || cat project.yaml 2>/dev/null`
- Swarm config: !`type swarm.yaml 2>nul || cat swarm.yaml 2>/dev/null`
- Last commit ISO timestamp: !`git log -1 --format=%cI 2>nul`
- Last commit SHA: !`git log -1 --format=%H 2>nul`

## What you do (Claude)

### 1. Resolve the time window

Parse `$ARGUMENTS` left-to-right. Strip out `--apply` and `--out <path>` flags first; the remaining positional token (if any) is `<since>`.

- No positional token → use `last-commit`.
- `last-commit` → run `git log -1 --format=%cI`. The output is `<window-start>`.
- Matches `^\d+(m|h|d)$` → subtract that duration from "now" (UTC ISO-8601). Examples: `30m`, `4h`, `2d`.
- Matches `^\d{4}-\d{2}-\d{2}$` → use `<date>T00:00:00` local time as the start.
- Anything else → emit a warning, fall back to "last 4 hours."

If git history is missing (no commits, or `git` not available), emit a top-of-report warning and use "last 4 hours" as the window. Do not fail.

### 2. Gather changes within the window

Use the Bash tool. Tolerate every command failing — collect what you can and continue.

- **New / modified artifacts under `artifacts/`**:
  ```
  git log --since="<window-start>" --name-only --pretty=format: -- artifacts/ | sort -u
  ```
  Filter blank lines; dedupe.
- **Decisions added** in `artifacts/context/decision-log.md`:
  - Current declared D-IDs: `Grep` the file with pattern `^##+\s+(D-[A-Z0-9]+(?:-\d+)?)\b`.
  - Window-start version: find the commit immediately before window-start and run `git show <sha>:artifacts/context/decision-log.md` and grep the same pattern. If the file did not exist at window-start, treat the prior set as empty.
  - Diff = current minus window-start = new D-IDs.
  - For each new D-ID, read its body from the current file and capture: classification, title, date, author (if present), 1–2 sentence summary, "Affects" list.
- **Stories changed**:
  ```
  git log --since="<window-start>" --name-only --pretty=format: -- artifacts/implementation/stories/ | sort -u
  ```
  For each touched file, read the current `## Status:` value (if any). Classify per `project-status` skill rules: `complete` → done, `in-progress` → started, `review` → in review, `draft`/`ready` → planned, contains "blocked" → blocked.
- **Reviews filed**:
  ```
  git log --since="<window-start>" --name-only --pretty=format: --diff-filter=A -- artifacts/reviews/ | sort -u
  ```
  (Added files only.) For each, grep the body for `APPROVED` / `REJECTED` and count `blocker` / `advisory` mentions for the one-liner.
- **Phase transitions** in `project.yaml`:
  ```
  git log --since="<window-start>" -p -- project.yaml
  ```
  Look for `+phase:` and `-phase:` line pairs. Each pair is one transition (`old → new`).
- **Activity events** (fallback, if git is missing): list files under `artifacts/` with mtime newer than window-start using `Glob` + `Read` headers, and synthesize a best-effort summary.

### 3. Produce the report

Render in this exact editorial structure. Headings must appear verbatim.

```markdown
# Session Report — <project-name>

**Window**: <human-readable since> · **Generated**: <ISO datetime> · **Autonomy**: <auto|guided|collaborative>

---

## Headline

<One-sentence summary of the most important thing that happened. Lean editorial. e.g.
"Definition phase advanced; PRD complete and pending human approval; 3 strategic decisions logged.">

## What was decided

### D-NNN · <Classification> · <Title>

<Date · Author>

<Two-sentence summary pulled from the decision body.>

**Affects**: <list>

(Repeat per new decision, chronological order. If none: write `No new decisions in this window.`)

## What shipped

- **Stories completed**: <story-N.M.md, ...> (or `none`)
- **Stories started**: <list> (or `none`)
- **Stories in review**: <list> (or `none`)
- **Other artifact updates**: <PRDs, architecture, ADRs touched> (or `none`)

## Reviews filed

- `<review-file.md>` — **APPROVED** / **REJECTED** · N blockers · N advisories — <one-line summary>

(Omit the entire section if there were no new reviews.)

## Pending your attention

- <Pending PRD/architecture human approval — link to file>
- <Stories with REJECTED reviews awaiting retry>
- <Stories with status `blocked` or "blocked" in body>
- <Quality-gate failures: orphan D-IDs, schema-doctor flags if visible>

(If nothing pending: write `Nothing pending.` and skip to Suggested next action.)

## Suggested next action

<One sentence. Be specific and actionable. Examples:>
- "Review PRD at artifacts/planning/prd.md and approve to unblock design phase."
- "Three stories complete; consider running /bmad-tools:extract-lessons to capture patterns."
- "Auto mode is healthy; no human input required."

---

*Generated by /bmad-tools:session-report — view the timeline live at http://127.0.0.1:5173 or browse the full decision-log at `artifacts/context/decision-log.md`.*
```

Read `project.yaml` for the project name, current phase, and autonomy. Use `unknown` for any missing field.

### 4. Output handling

- **Without `--apply`**: print the entire report inside a fenced markdown block (```markdown ... ```). Emit no other commentary.
- **With `--apply`** (or `--out <path>` which implies `--apply`):
  1. Resolve the path: `--out <path>` if given, else `artifacts/reviews/session-report-<YYYY-MM-DD>.md` using today's local date.
  2. Use the `Write` tool to create the file. Do not overwrite without warning — if the path exists, append a numeric suffix (`...-2.md`).
  3. Print exactly one confirmation line: `Wrote session report to <path> (<N> lines).`

### 5. Edge cases

- **Empty window** (no commits, no decisions, no reviews, no story changes): produce the report anyway with a `Headline` of "No activity in this window." and a `Suggested next action` of "Auto mode is idle; consider giving it a task."
- **No git history**: emit `> **Warning**: no git history available; falling back to mtime-based scanning.` as the first body line of the report. Continue with mtime scans.
- **Read errors on individual files**: skip the file and continue. The report should never abort mid-render.
- **Decision-log missing entirely**: skip the "What was decided" gather step; the section will read `No new decisions in this window.`

## Hard rules

- Do not run `git commit`, `git push`, or any mutating git command. Read-only git only (`git log`, `git show`).
- Do not write to `artifacts/` unless `--apply` (or `--out`) was passed.
- Do not introduce npm dependencies or hook scripts. Pure skill.
- Do not modify any file outside `plugins/bmad-tools/` from this skill.
