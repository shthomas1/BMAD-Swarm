# Story A-BUG-5: Add ideation phase to swarm.yaml phases block

## Goal
Add the missing `ideation` phase entry to `swarm.yaml` so the reference configuration file is consistent with the README and methodology documentation.

## Acceptance Criteria
- [ ] AC1: `swarm.yaml` `methodology.phases` includes `ideation: { enabled: true }` as the first phase entry
- [ ] AC2: The file is valid YAML and can be parsed by `loadSwarmConfig()`
- [ ] AC3: `bmad-swarm update` runs without error after the change
- [ ] AC4: Test passes: `npm test -- --grep "ideation|phases"`

## Dev Notes
- Files to modify:
  - `swarm.yaml:9-20` -- add `ideation:` entry with `enabled: true` before the `exploration:` entry
- This is a data-only change to the project's own `swarm.yaml`.
- The `applyDefaults()` function in `utils/config.js:57-64` already adds ideation as a default phase, so runtime behavior is unchanged. This change is for explicitness and documentation consistency.
- Test file: No new test needed. Existing tests cover `applyDefaults()` adding ideation.

## D-IDs Referenced
- A-4 from project review (swarm.yaml phases block omits ideation)
