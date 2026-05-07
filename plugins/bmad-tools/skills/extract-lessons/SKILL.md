---
name: extract-lessons
description: Walk the review files for a given epic, cluster findings by theme (correctness, security, test coverage, architecture), and propose an append to artifacts/context/lessons-learned.md. Use when the user invokes /bmad-tools:extract-lessons.
allowed-tools: Read Grep Glob Bash Write
---

# Extract Lessons

Cluster review findings for a named epic into a structured lessons-learned append.

## Inputs

`$ARGUMENTS` — an epic identifier or glob pattern.

- If `$ARGUMENTS` is empty, ask the user.
- If it ends with `--apply`, treat the rest as the epic id and write directly to `artifacts/context/lessons-learned.md` without further confirmation (auto-mode).
- Otherwise, generate the proposed append and ask for confirmation before writing.

Examples:
- `/bmad-tools:extract-lessons epic-1`
- `/bmad-tools:extract-lessons epic-1 --apply`
- `/bmad-tools:extract-lessons review-*epic-2*.md`

## What you do (Claude)

1. Determine the glob to scan:
   - If the input looks like an epic id (e.g. `epic-1`, `e1`), search `artifacts/reviews/` for files matching `*review*epic-1*.md` (case-insensitive) and `*review*e1*.md` and `*epic-1*review*.md`.
   - If the input contains a glob, use it directly under `artifacts/reviews/`.
2. Use the Glob/Grep tools to enumerate matching review files. If zero files match, report and stop.
3. Read each review file. Extract every finding. Categorize each into one of:
   - **Coding Conventions**
   - **Test Patterns**
   - **Architecture Gotchas**
   - **Build & CI**
   - **Common Mistakes**
   - **What Works Well** (positive findings)
4. Within each category, deduplicate near-identical findings and merge them into one entry. Each entry must include a Source line back to the originating review file(s).
5. Format the append exactly per the lessons-learned schema (`methodology/artifact-schemas/lessons-learned.md`):

```
## Coding Conventions

- **<directive name>**: <directive text>
  - Source: artifacts/reviews/<file>.md (and any others)

## Test Patterns
...
```

Only include sections that have at least one entry — do not emit empty headings.

6. Print the proposed append in a fenced code block with the heading `## Proposed append for artifacts/context/lessons-learned.md:`.

7. Decide whether to apply:
   - If `--apply` was passed, or the project is in auto autonomy mode (the orchestrator's CLAUDE.md says `Autonomy: auto`), use the Write tool to:
     - If `artifacts/context/lessons-learned.md` does not exist, create it from the schema header (`# Lessons Learned`) and then the proposed sections.
     - Otherwise, read the existing file and append the proposed content **after** the existing content (preserve everything; never truncate).
   - Otherwise, ask: "Apply this append now? Reply yes to write."
   - On confirmation or `--apply`, write the file and report the path + line count delta.

## Notes

- Never delete or rewrite existing entries in `lessons-learned.md`. Append-only.
- If a category already has a near-duplicate entry in the existing file, prefer noting it under "Source" rather than adding a duplicate.
- Treat a finding as "blocking" or "advisory" based on the language in the review (`blocker`, `must-fix`, `nit`, etc.) — but the lessons file does not record severity, only the directive.
