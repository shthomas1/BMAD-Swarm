---
name: schema-doctor
description: Whole-tree schema drift audit for BMAD artifacts. Reads every story, decision, PRD, and architecture artifact, compares against methodology/artifact-schemas/, and produces a single drift heatmap so the user can see at a glance where the on-disk format diverges from the documented schema. Read-only. Use when the user invokes /bmad-tools:schema-doctor or asks "how out of date is our artifact format".
allowed-tools: Read Grep Glob Bash
---

# Schema Doctor

Single-pass conformance audit for the whole `artifacts/` tree. Tells the user at a glance how badly the on-disk artifacts have drifted from the documented schemas in `methodology/artifact-schemas/`. Read-only — never edits anything.

## Inputs

`$ARGUMENTS` — optional. One of:

- empty → audit **all** artifact types (default)
- `--type story` → audit only stories
- `--type prd` → audit only PRDs
- `--type architecture` → audit only architecture docs
- `--type decision` → audit only the decision log
- `--type all` → same as empty

If `$ARGUMENTS` contains anything else, ask the user to clarify, then stop.

## Dynamic context

- Story files: !`dir /b artifacts\implementation\stories 2>nul || ls artifacts/implementation/stories 2>/dev/null`
- Planning artifacts: !`dir /b artifacts\planning 2>nul || ls artifacts/planning 2>/dev/null`
- Design artifacts: !`dir /b artifacts\design 2>nul || ls artifacts/design 2>/dev/null`
- ADR files: !`dir /b artifacts\design\decisions 2>nul || ls artifacts/design/decisions 2>/dev/null`
- Schema files: !`dir /b methodology\artifact-schemas 2>nul || ls methodology/artifact-schemas 2>/dev/null`

## What you do (Claude)

1. Parse `$ARGUMENTS` to a `selected` set of types. Default = `{story, prd, architecture, decision}`.
2. For each selected type, load the schema file from `methodology/artifact-schemas/<type>.md` if present (used for the human-readable footer; the structural checks below are hard-coded and tolerant).
3. **Stories** — for each `artifacts/implementation/stories/*.md`:
   - Conforms to schema = has all of: `## Status:` (or `## Status` heading), `## User Story`, `## Acceptance Criteria`, `## Tasks`, `## Dev Notes`.
   - Has `## Goal` (legacy) — true if `^##\s+Goal\b` matches.
   - Missing `## Status:` — true if neither `^##\s+Status:` nor `^##\s+Status\b` matches.
   - Missing `## Tasks` — true if `^##\s+Tasks\b` does not match.
   - Missing `## Dev Notes` — true if `^##\s+Dev Notes\b` does not match.
   - Missing `## Acceptance Criteria` — true if `^##\s+Acceptance Criteria\b` does not match.
4. **Decisions** — read `artifacts/context/decision-log.md`:
   - Count headings matching `^##\s+(D-[A-Z0-9]+(?:-\d+)?)\b` (current in-the-wild form).
   - Count headings matching `^###\s+(D-\d{3,})\s*:` (schema-spec form).
   - Compute the dominant pattern (whichever is non-zero) and flag if both are present (mixed-style log).
5. **PRDs** — for every `artifacts/planning/prd*.md` and `artifacts/planning/*plan*.md`:
   - Has numbered `FR-NNN` requirements — bool.
   - Has `## Functional Requirements` heading — bool.
   - Has Success Criteria section — bool.
   - Distinguish files named `*plan*.md` (PRD-equivalent) from canonical `prd*.md` in the report.
6. **Architecture** — for every `artifacts/design/architecture*.md` and every ADR `artifacts/design/decisions/adr-*.md`:
   - Has `Technology Stack` — bool (architecture only).
   - Has `Data Models` — bool (architecture only).
   - Has `ADR-NNN` identifiers or "Architectural Decisions" section — bool (architecture only).
   - For ADRs: has a Status field — bool.
7. Produce a single Markdown report. Output format (omit sections for types not selected):

```
# Schema Doctor

Audit date: <YYYY-MM-DD>
Selected types: <story, prd, architecture, decision>

## Stories (<N> files)

| Conformance | Count | % |
|---|---|---|
| Conforms to schema | A | A/N% |
| Has `## Goal` (legacy) | B | B/N% |
| Missing `## Status:` | C | C/N% |
| Missing `## Tasks` | D | D/N% |
| Missing `## Dev Notes` | E | E/N% |
| Missing `## Acceptance Criteria` | F | F/N% |

(Optionally list up to 10 worst offenders by issue count.)

## Decisions

| Pattern | Count |
|---|---|
| `## D-NNN —` (current in-the-wild) | X |
| `### D-NNN:` (schema-spec) | Y |

(If both X > 0 and Y > 0, flag "mixed-style decision log".)

## PRDs (<N> files)

| File | Role | FR-NNN | `## Functional Requirements` | Success Criteria |
|---|---|---|---|---|
| artifacts/planning/prd.md | canonical | yes | yes | no |
| artifacts/planning/implementation-plan.md | PRD-equivalent | no | no | yes |

## Architecture (<N> files)

| File | Role | Tech Stack | Data Models | ADRs |
|---|---|---|---|---|
| artifacts/design/architecture.md | canonical | yes | no | yes |
| artifacts/design/decisions/adr-003-foo.md | ADR | n/a | n/a | n/a (Status: yes) |

## Summary

- Overall conformance: <stories-conforming>/<stories-total> stories, <decisions-conforming>/<decisions-total> decision records.
- Dominant story format: schema-conforming | legacy-Goal | mixed.
- Dominant decision format: schema-spec | in-the-wild | mixed.

## Recommendation

<one of:>
- Run `/bmad-tools:migrate-stories --apply` to bring stories into conformance with the documented schema, then rerun this audit.
- Or update `methodology/artifact-schemas/story.md` to match current usage if the in-the-wild format is intentional.
- (Decisions / PRDs / architecture do not yet have an automated migrator — fix manually if needed.)
```

8. Print the report. Do not write any file. Stop.

## Notes

- **Read-only**. No file is modified.
- If a directory does not exist, treat the count as `0` and continue rather than failing.
- If `methodology/artifact-schemas/` is missing, still produce the report using the hard-coded structural checks above; note "schema files not present in repo" in the summary footer.
- Use Grep with anchored regexes (`^##\s+...`) — accidentally matching inside fenced code blocks is acceptable noise for v0.2.0.
