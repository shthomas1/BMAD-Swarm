# Story A-BUG-8: Update the update command completion message to be accurate about settings.json

## Goal
After A-BUG-1 adds modification protection to `settings.json`, update the `update` command's completion message to accurately reflect the new behavior.

## Acceptance Criteria
- [ ] AC1: The settings.json generation step in `cli/update.js` reports whether the file was regenerated or skipped (same pattern as other generators)
- [ ] AC2: If settings.json was manually modified and not overwritten, the message says it was skipped
- [ ] AC3: The final completion message remains accurate (no false claims about file safety)
- [ ] AC4: Test passes: `npm test -- --grep "update.*settings|update.*complete"`

## Dev Notes
- Files to modify:
  - `cli/update.js:127-135` -- update the settings generation block to handle the new return value from `generateSettings()` (which will return `{ modified: boolean }` after A-BUG-1)
- Pattern to follow: Look at lines 84-91 (CLAUDE.md reporting) and lines 117-124 (system-prompt.txt reporting) for the skip/overwrite message pattern.
- This story DEPENDS ON A-BUG-1 being completed first, since it changes the `generateSettings()` signature and return value.
- Test file: `test/cli.test.js` -- add or update test for `bmad-swarm update` output messages

## D-IDs Referenced
- A-7 from project review (update command message implies settings.json is safe)
- Depends on A-BUG-1
