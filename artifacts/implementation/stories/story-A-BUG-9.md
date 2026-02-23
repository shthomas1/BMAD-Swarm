# Story A-BUG-9: Document --force flag for update command in README

## Goal
Add `--force` flag documentation to the README's CLI reference section for the `update` command.

## Acceptance Criteria
- [ ] AC1: README `bmad-swarm update` section includes `--force` flag with description: "Overwrite files even if they have been manually modified"
- [ ] AC2: The `--force` flag is listed in the same table format as `--dry-run`
- [ ] AC3: Test passes: `npm test` (all existing tests still pass)

## Dev Notes
- Files to modify:
  - `README.md:171-177` -- add `--force` row to the update command section. Currently only shows `--dry-run`.
- The update command help text already documents `--force` (see `cli/update.js:22-31`). This is just making the README match.
- Change the update section from a single-line code block to a table or add the flag to the existing documentation.
- Currently line 176 shows: `bmad-swarm update [--dry-run]`
- Change to: `bmad-swarm update [--dry-run] [--force]`
- Add a flag table like the `init` and `start` commands have.
- Test file: No new test needed. This is documentation only.

## D-IDs Referenced
- A-8 from project review (--force not documented in README)
