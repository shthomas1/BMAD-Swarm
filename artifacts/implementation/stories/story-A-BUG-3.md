# Story A-BUG-3: Register TaskCompleted and TeammateIdle hooks in settings.json

## Goal
Add `TaskCompleted` and `TeammateIdle` hook entries to the `getHooksConfig()` function so they are registered in `settings.json` and activated by Claude Code.

## Acceptance Criteria
- [ ] AC1: `getHooksConfig()` returns a `TaskCompleted` event entry that runs `node .claude/hooks/TaskCompleted.cjs`
- [ ] AC2: `getHooksConfig()` returns a `TeammateIdle` event entry that runs `node .claude/hooks/TeammateIdle.cjs`
- [ ] AC3: Generated `settings.json` includes `TaskCompleted` and `TeammateIdle` in the `hooks` section
- [ ] AC4: Test passes: `npm test -- --grep "TaskCompleted|TeammateIdle|hooks.*config"`

## Dev Notes
- Files to modify:
  - `generators/hooks-generator.js:65-92` -- add `TaskCompleted` and `TeammateIdle` entries to the `getHooksConfig()` return object
- Pattern to follow: Look at the existing entries in `getHooksConfig()` (lines 66-91). Each event type is a key with an array of matcher objects. `TaskCompleted` and `TeammateIdle` do not need matchers (they fire on any task/teammate), so use the same shape as the `Stop` entry (no `matcher` property).
- The hook file names are `TaskCompleted.cjs` and `TeammateIdle.cjs` (matching the event names exactly).
- Test file: `test/settings-generator.test.js` -- add assertions that the generated settings.json includes `TaskCompleted` and `TeammateIdle` hook entries. Also check `test/generators.test.js` if it validates hooks config.

## D-IDs Referenced
- A-2 from project review (hooks generated but not registered)
