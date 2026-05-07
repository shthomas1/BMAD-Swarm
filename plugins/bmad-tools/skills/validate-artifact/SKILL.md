---
name: validate-artifact
description: Schema-check a BMAD artifact (story, PRD, architecture, epic, brainstorm) on demand. Use when the user invokes /bmad-tools:validate-artifact or asks to validate an artifact file against its BMAD schema.
allowed-tools: Read Grep Glob Bash
---

# Validate Artifact

Validate a BMAD artifact against the schema in `methodology/artifact-schemas/`. Report issues with severity and suggested fix.

## Inputs

`$ARGUMENTS` — path to the artifact file (relative to repo root or absolute). Required.

If `$ARGUMENTS` is empty, ask the user which file to validate, then stop.

## What you do (Claude)

1. Resolve the path. If it does not exist, report and stop.
2. Read the file with the Read tool.
3. Classify the artifact by path and filename:
   - `artifacts/implementation/stories/*.md` or filename starting with `story` → **story**
   - filename containing `prd` → **prd**
   - filename containing `architecture` → **architecture**
   - filename containing `epic` → **epic**
   - filename containing `brainstorm` → **brainstorm**
   - otherwise → **generic markdown**
4. Read the matching schema file in `methodology/artifact-schemas/` (e.g. `story.md`, `prd.md`, `architecture.md`, `epic.md`). If the schema directory is missing, fall back to the minimal expected sections below.
5. Compare the artifact to the schema. For each missing required section or malformed field, produce one row in the report.
6. Print a Markdown report:

```
# Validate Artifact Report

**File**: <path>
**Type**: <story|prd|architecture|epic|brainstorm|generic>
**Schema**: methodology/artifact-schemas/<file>.md (or "fallback minimal" if schema missing)

## Issues

| Severity | Section / Field | Issue | Suggested Fix |
|---|---|---|---|
| blocking | ## Acceptance Criteria | Missing | Add a `## Acceptance Criteria` section with at least 2 BDD blocks. |
| advisory | Domain | Missing in fixed-mode project | Add `## Domain: <slug>` if you want fixed-mode routing. |

## Summary

- Blocking issues: N
- Advisory issues: N
- Verdict: PASS | FAIL
```

## Minimal expected sections (fallback when schema files missing)

- **story**: `# Story`, `## Status`, `## User Story`, `## Acceptance Criteria`, `## Tasks`, `## Dev Notes`
- **prd**: numbered `FR-NNN` requirements, `## Functional Requirements`, `## Non-Functional Requirements`, `Success Criteria`
- **architecture**: `Technology Stack`, `Data Models`, `Key Architectural Decisions` with `ADR-NNN` records
- **epic**: `Epic <N>` heading, story breakdown with BDD acceptance criteria
- **brainstorm**: `Decisions`, `Open Questions`, summary

## Severity rules

- **blocking**: missing required section or malformed identifier (e.g. PRD with no `FR-NNN`)
- **advisory**: optional section missing, weak content, or BMAD-specific suggestion (e.g. domain slug)

## Notes

- Do not modify the artifact. This skill is read-only and report-only.
- The same checks are run automatically on `Write` events by the `validate-artifact` hook (see `plugins/bmad-tools/hooks/validate-artifact.cjs`).
