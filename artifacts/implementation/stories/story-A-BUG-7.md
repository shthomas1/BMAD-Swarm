# Story A-BUG-7: Add warning message when --dangerous flag is used

## Goal
Display a clear warning to stderr when the user launches `bmad-swarm start --dangerous` to ensure they are aware that all permission prompts will be skipped.

## Acceptance Criteria
- [ ] AC1: When `--dangerous` is passed to `bmad-swarm start`, a warning message is printed to stderr before launching Claude Code
- [ ] AC2: The warning message clearly states that all permission prompts will be skipped (e.g., "WARNING: Launching in dangerous mode. All Claude Code permission prompts will be skipped.")
- [ ] AC3: The warning does NOT appear when `--dangerous` is not used
- [ ] AC4: When `--print` and `--dangerous` are both used, the warning still appears (before the printed command)
- [ ] AC5: Test passes: `npm test -- --grep "dangerous|warning"`

## Dev Notes
- Files to modify:
  - `cli/start.js:27-29` -- add `console.warn()` call before pushing `--dangerously-skip-permissions` to args
- Pattern to follow: Simple `console.warn()` call. No complex logic needed.
- The warning should use `console.warn()` (writes to stderr) so it does not interfere with `--print` output (which goes to stdout).
- Test file: `test/cli.test.js` -- add a test that runs `bmad-swarm start --dangerous --print` and checks stderr for the warning message. Use the `--print` flag to avoid actually launching Claude Code.

## D-IDs Referenced
- A-6 from project review (--dangerous flag has no warning)
