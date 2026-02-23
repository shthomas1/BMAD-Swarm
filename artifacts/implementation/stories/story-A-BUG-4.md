# Story A-BUG-4: Update project.yaml phase to reflect v1.2.0 complete state

## Goal
Update the project's `project.yaml` to reflect that the project is at v1.2.0 with all implementation plan items complete, rather than showing `phase: not-started`.

## Acceptance Criteria
- [ ] AC1: `project.yaml` `phase` field is set to `delivery` (or `complete` if supported by the phase machine)
- [ ] AC2: `project.yaml` `status` field is updated to `complete`
- [ ] AC3: The file is valid YAML and can be parsed by `loadYaml()`
- [ ] AC4: Test passes: `npm test -- --grep "project.yaml|phase"`

## Dev Notes
- Files to modify:
  - `project.yaml` -- update `phase: not-started` to `phase: delivery` and `status: initialized` to `status: complete`
- This is a data-only change, not a code change. The file is at the project root.
- Check `utils/phase-machine.js` to see what valid phase values are (likely: `not-started`, `ideation`, `exploration`, `definition`, `design`, `implementation`, `delivery`).
- Test file: No new test needed unless there are tests that assert specific project.yaml content. Verify existing tests still pass.

## D-IDs Referenced
- A-3 from project review (project.yaml phase stuck at not-started)
