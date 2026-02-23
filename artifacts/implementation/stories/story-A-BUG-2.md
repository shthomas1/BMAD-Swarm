# Story A-BUG-2: Replace all AGENT_NAMES callers with getAgentNames()

## Goal
Migrate all 8 call sites from the deprecated `AGENT_NAMES` constant to the preferred `getAgentNames()` function, then remove the deprecated constant.

## Acceptance Criteria
- [ ] AC1: All imports of `AGENT_NAMES` across the codebase are replaced with `getAgentNames`
- [ ] AC2: All usages of `AGENT_NAMES` (as a constant reference) are replaced with `getAgentNames()` (as a function call)
- [ ] AC3: The deprecated `AGENT_NAMES` export is removed from `utils/config.js`
- [ ] AC4: Tests in `test/config.test.js` that test `AGENT_NAMES` are updated to test `getAgentNames()` instead
- [ ] AC5: No file in the project imports or references `AGENT_NAMES` (except artifacts/docs)
- [ ] AC6: Test passes: `npm test -- --grep "getAgentNames|agent.names|AGENT_NAMES"`

## Dev Notes
- Files to modify (all 8 call sites plus the definition):
  - `utils/config.js:130-141` -- remove the `AGENT_NAMES` constant entirely
  - `generators/agent-generator.js:4,26,148,149,177,178` -- change `import { AGENT_NAMES }` to `import { getAgentNames }`, replace `AGENT_NAMES` with `getAgentNames()` at each usage
  - `generators/claude-md-generator.js:4,53` -- same pattern
  - `utils/validator.js:1,54,55` -- same pattern
  - `cli/doctor.js:4,39,127` -- same pattern
  - `cli/status.js:5` -- remove the import (status.js imports AGENT_NAMES but does not use it in the body -- it reads agent files from disk directly)
  - `test/config.test.js:6,82-94` -- update tests to use `getAgentNames()`
- Pattern to follow: `getAgentNames()` is already defined at `utils/config.js:112-125`. It returns `string[]` just like `AGENT_NAMES`. The only difference is it's a function call, not a constant.
- Verify: After the change, `grep -r "AGENT_NAMES" --include="*.js"` in cli/, generators/, utils/, test/ should return zero hits.
- Test file: `test/config.test.js` -- update the existing `AGENT_NAMES` describe block

## D-IDs Referenced
- A-1 from project review (getAgentNames defined but never used)
