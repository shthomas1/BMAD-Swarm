---
name: migrate-stories
description: Rewrite old-format story files into the documented schema (methodology/artifact-schemas/story.md). Renames `## Goal` to `## User Story`, inserts a `## Status:` line inferred from git history, and stubs a `## Tasks` block when missing. Default is dry-run (prints unified diffs). Pass `--apply` to write changes in place. Use when the user invokes /bmad-tools:migrate-stories or asks to bring stories into conformance.
allowed-tools: Read Write Grep Glob Bash
---

# Migrate Stories

One-shot migrator: bring legacy story files into the documented schema in `methodology/artifact-schemas/story.md`.

## Inputs

`$ARGUMENTS` — optional flags:

- `--apply` — write changes in place. Without this flag, run in dry-run mode and only print unified diffs.
- `--glob "<pattern>"` — restrict to files matching the glob (relative to repo root). Default `artifacts/implementation/stories/*.md`.

Examples:

- `/bmad-tools:migrate-stories` → dry-run on every story
- `/bmad-tools:migrate-stories --apply` → migrate every story in place
- `/bmad-tools:migrate-stories --glob "artifacts/implementation/stories/story-A-*.md"` → dry-run for the matching subset
- `/bmad-tools:migrate-stories --apply --glob "artifacts/implementation/stories/story-1.*.md"` → migrate the matching subset in place

If autonomy mode is `auto` in the project's `CLAUDE.md`, treat `--apply` as the default. Otherwise, default is dry-run.

## Dynamic context

- Story files: !`dir /b artifacts\implementation\stories 2>nul || ls artifacts/implementation/stories 2>/dev/null`
- Story schema: !`type methodology\artifact-schemas\story.md 2>nul || cat methodology/artifact-schemas/story.md 2>/dev/null`

## What you do (Claude)

1. Parse `$ARGUMENTS`. Determine `apply` (bool) and `glob` (string). Resolve the file list with the Glob tool.
2. For each file, read the original content. Compute the migrated content using the rules below. If migrated == original, skip the file (already conforms).
3. **Migration rules** (apply in this order):
   - **Rename `## Goal` → `## User Story`**: if the file has a `^##\s+Goal\b` heading and **no** `^##\s+User Story\b` heading, rewrite the line `## Goal` (and only that line) to `## User Story`. Preserve the body verbatim.
   - **Insert `## Status:` line**: if the file has neither `^##\s+Status:` nor `^##\s+Status\b`, infer a status:
     - Run `git log --follow --pretty=format:%s -- <file>`. If any commit subject matches `/\b(complete|completed|merged|done|implemented)\b/i`, infer **`complete`**.
     - Else infer **`draft`**.
     - Insert `## Status: <inferred>` as the **second non-empty line** after the leading `# Story ...` heading (separated by one blank line above and below). If there is no leading `# ` heading, insert at the very top.
   - **Stub `## Tasks` block**: if the file has no `^##\s+Tasks\b` heading, insert this block immediately **after** the `## Acceptance Criteria` section (i.e. immediately before the next `## ` heading at level 2, typically `## Dev Notes`):
     ```
     ## Tasks

     - [ ] Task 1: (stub — fill in concrete implementation steps)
     ```
     If there is no `## Acceptance Criteria` section, insert the `## Tasks` block immediately before `## Dev Notes`. If there is no `## Dev Notes` section either, append at the end of the file.
   - **Preserve everything else verbatim**, including trailing whitespace, code fences, and unrelated headings.
4. Build a unified diff (`diff -u` style) between original and migrated content for each file. Use the Bash tool with a temp-file approach if convenient, or compute the diff inline.
5. Report:

```
# Migrate Stories

Mode: dry-run | apply
Glob: artifacts/implementation/stories/*.md
Files matched: N
Files needing migration: M
Files already conforming: K (skipped)

## Per-file diffs

### artifacts/implementation/stories/story-A-BUG-1.md

Inferred status: draft (no completion markers in git history)
Migrations applied: rename Goal -> User Story; insert Status; insert Tasks stub

```diff
@@ -1,3 +1,5 @@
 # Story A-BUG-1: ...
+
+## Status: draft

-## Goal
+## User Story
 Protect settings.json ...
@@ ...
+## Tasks
+
+- [ ] Task 1: (stub — fill in concrete implementation steps)
+
 ## Dev Notes
```
```

(Repeat per file.)

6. **If `apply` is true**: for each file with a non-empty diff, use the Write tool to overwrite the file with the migrated content. After all writes, print a summary line: `Migrated M files. Run /bmad-tools:validate-artifact <path> to confirm conformance.`
7. **If `apply` is false** (dry-run): end with the line `Dry-run complete. Re-run with --apply to write these changes.` Do not write any file.
8. If a file is locked, missing, or the diff cannot be computed, log the per-file error and continue to the next file. Never abort the whole batch on one bad file.

## Notes

- **Default is dry-run** unless `--apply` is passed (or the project is in `Autonomy: auto` mode and the orchestrator has approved the migration).
- The migrator only touches files that match the glob and need changes. Files already conforming are reported but not rewritten.
- The `## Tasks` stub is intentionally minimal — it is a marker for the developer/story-engineer to fill in real tasks, not a guess at content. Migrated files may still fail strict validation on task-content quality.
- The git-history fallback for `## Status:` requires the project to be a git repo. If `git` fails, default to `draft`.
- This skill is **not idempotent across reruns when `--apply`-ing** in the sense that it only acts on files that still drift; once migrated, a rerun should report 0 files needing migration.
- See `methodology/artifact-schemas/story.md` for the canonical target schema.
