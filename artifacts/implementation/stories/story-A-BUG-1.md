# Story A-BUG-1: Add hash-based modification detection to settings.json generation

## Goal
Protect `settings.json` from silent overwrites on `bmad-swarm update` by applying the same hash-based modification detection used for all other generated files.

## Acceptance Criteria
- [ ] AC1: `generateSettings()` uses `writeGeneratedFile()` (or a JSON-compatible equivalent) to embed a content hash in the generated `settings.json`
- [ ] AC2: `generateSettings()` checks `isFileManuallyModified()` before writing and skips the write if the file was manually modified (unless `force` option is set)
- [ ] AC3: `generateSettings()` accepts `config` and `options` parameters (same signature pattern as `generateAgents`, `generateRules`)
- [ ] AC4: `cli/update.js` passes `genOptions` (including `force`) to `generateSettings()` and reports skip/overwrite status like other generators
- [ ] AC5: The content hash is embedded as a JSON-compatible top-level key (e.g., `"_bmadGenerated": "<hash>"`) since JSON does not support comments
- [ ] AC6: `isFileManuallyModified()` is extended or a new `isJsonFileManuallyModified()` function is added to handle the JSON hash format
- [ ] AC7: Test passes: `npm test -- --grep "settings.*modification|settings.*hash"`

## Dev Notes
- Files to modify:
  - `generators/settings-generator.js` -- change from `writeFileSafe()` to hash-protected write; add `config` and `options` params
  - `utils/fs-helpers.js` -- add JSON hash detection support (new pattern for `_bmadGenerated` key)
  - `cli/update.js:127-133` -- pass `config` and `genOptions` to `generateSettings()`; handle skip reporting
  - `cli/init.js` -- update `generateSettings()` call if signature changes
- Pattern to follow: Look at `generateRules()` in `generators/rules-generator.js:16-51` for the `options.force` + `isFileManuallyModified()` pattern. Look at `generateAgents()` return shape for the `{ generated, modified }` pattern.
- JSON cannot have comment headers like `<!-- bmad-generated:hash -->`. Use a top-level `_bmadGenerated` key in the JSON object to store the hash. The hash should be computed on the JSON content WITHOUT the `_bmadGenerated` key.
- Test file: `test/settings-generator.test.js` -- add tests for modification detection, force overwrite, and hash embedding
- Also update existing tests that call `generateSettings(paths)` to pass the new required params: `generateSettings(config, paths)` or `generateSettings(config, paths, options)`

## D-IDs Referenced
- B-1 from project review (BLOCKING finding: settings.json silently overwritten)
- A-7 from project review (update command message misleading)
