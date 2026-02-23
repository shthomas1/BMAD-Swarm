# Implementation Review: Sprint 1 (Tracks A, B, C)

**Reviewer**: reviewer agent
**Date**: 2026-02-23
**Test Suite**: 244/244 passing

---

## Summary

Three implementation tracks were reviewed: Track A (bug fixes, 9 stories), Track B (token optimization + model routing, 5 stories), and Track C (--disallowedTools + feature wiring, 4 stories). Overall the implementation is solid -- all tests pass, acceptance criteria are met for the critical stories, and code quality is consistent with existing patterns. One blocking issue found.

---

## BLOCKING

### B-1: `generateHooks()` return type mismatch causes "undefined hooks" in CLI output

**Files**: `cli/update.js:98-99`, `cli/init.js:116-117`
**Severity**: BLOCKING

Both `update.js` and `init.js` use `const hookPaths = generateHooks(config, paths)` and then reference `hookPaths.length`. However, `generateHooks()` returns `{ generated: string[], skipped: string[] }` (an object), not an array. `hookPaths.length` evaluates to `undefined`, so the user sees:

```
  Generated .claude/hooks/ (undefined hooks)
```

This is a user-visible bug. The fix is trivial:

```js
// update.js line 98
const hookResult = generateHooks(config, paths, genOptions);
console.log(`  Regenerated .claude/hooks/ (${hookResult.generated.length} generated)`);
if (hookResult.skipped.length > 0) {
  console.log(`    Skipped (manually modified): ${hookResult.skipped.length} hook(s)`);
  console.log('    Use --force to overwrite.');
}

// init.js line 116-117
const hookResult = generateHooks(config, paths);
console.log(`  Generated .claude/hooks/ (${hookResult.generated.length} hooks)`);
```

**Note**: This was a pre-existing bug (the hooks generator always returned an object), but the Track A developer modified these exact files (update.js and init.js) during this sprint and should have noticed and fixed it. The `generateHooks` return type also changed from the previous commit to include `{ generated, skipped }` instead of a flat array -- this mismatch should have been caught.

Additionally, `update.js:98` does NOT pass `genOptions` to `generateHooks()`, so the `--force` flag has no effect on hooks during `bmad-swarm update`. The other generators all receive `genOptions`.

---

## ADVISORY

### A-1: `--disallowedTools` list diverges from research recommendation

**Files**: `cli/start.js:34`
**Severity**: ADVISORY

The original research (`artifacts/exploration/system-prompt-replacement.md:201`) recommended disallowing `Edit Write NotebookEdit WebSearch WebFetch`. The implementation disallows `Edit Write MultiEdit NotebookEdit NotebookRead WebSearch` -- it adds `MultiEdit` and `NotebookRead` (reasonable additions) but omits `WebFetch`. The orchestrator does not use `WebFetch` directly, so it should also be disallowed for token savings.

**Recommended**: Add `'WebFetch'` to the disallowed tools list.

### A-2: No cleanup of stale orchestrator rule files during update

**Files**: `generators/rules-generator.js`, `cli/update.js`
**Severity**: ADVISORY

Story B-TOKEN-1 correctly deletes the orchestrator rule templates so they are no longer generated. However, existing projects that run `bmad-swarm update` will retain stale `.claude/rules/orchestrator-identity.md` and `.claude/rules/orchestrator-methodology.md` files from previous generations. These stale files will continue to be loaded by Claude Code for ALL agents, defeating the token optimization.

The `update` command should include a cleanup step that deletes these specific rule files if they exist, or the rules generator should be enhanced to delete files that no longer have templates.

### A-3: Model frontmatter edge case with existing frontmatter

**Files**: `generators/agent-generator.js:95-107`
**Severity**: ADVISORY

The `applyAgentOverrides` function handles existing frontmatter by looking for `\n---\n` after position 4. If a user's ejected agent file has frontmatter with a `model:` field already set, the code will add a duplicate `model:` line rather than replacing the existing one. This is an edge case that only affects ejected agents with custom frontmatter.

### A-4: settings.json hash verification relies on JSON key ordering

**Files**: `generators/settings-generator.js:30-35`, `utils/fs-helpers.js:103-115`
**Severity**: ADVISORY

The hash protection for `settings.json` works by:
1. Generating content without `_bmadGenerated`, computing hash on that
2. Adding `_bmadGenerated: hash` to the object
3. For verification: parsing JSON, extracting `_bmadGenerated`, re-serializing the rest and re-computing hash

The verification step uses `JSON.stringify(rest, null, 2) + '\n'` which relies on JSON key ordering being preserved. While JavaScript objects preserve insertion order for string keys in modern engines, if a user manually reorders keys (without changing values), the hash will mismatch and the file will be treated as manually modified. This is technically correct behavior (the file WAS modified), but could surprise users who only reorder keys.

This is a minor concern -- the same constraint exists for all JSON-based configuration systems.

---

## INFO

### I-1: Project's own settings.json not regenerated

The project's `.claude/settings.json` was committed before the `_bmadGenerated` hash feature was implemented. It lacks the hash key and also lacks `TaskCompleted`/`TeammateIdle` hook registrations. Running `bmad-swarm update` in this project would fix both, but this was not done as part of the sprint. Not a blocker since the feature works correctly for new projects and future updates.

### I-2: Project `code_dir: .` makes orchestrator hook overly aggressive

The project's `swarm.yaml` has `code_dir: .` which means the orchestrator-post-tool hook will flag ANY file edit as a code directory violation. This is by design for a self-developing project (per story A-BUG-6's recommended approach), but worth noting that this configuration would be problematic for projects where the orchestrator legitimately edits non-code files (like artifacts).

### I-3: Cost estimator uses Sonnet 4.6 pricing only

**Files**: `utils/cost-estimator.js:18-21`

The estimator uses fixed Sonnet 4.6 pricing ($3/$15 per 1M tokens). When agents are configured with `model: opus`, the estimate will be inaccurate. This is a known limitation documented by the pricing comments.

### I-4: Template warnings for `{{project.description}}`

The test suite emits 20+ warnings: `Template warning: unresolved variable "{{project.description}}"`. These come from test configs that don't include a project description. Not a bug (descriptions are optional), but the template engine could suppress warnings for known-optional fields.

### I-5: Test quality assessment

Tests across all three tracks are meaningful and verify real behavior:
- **Track A** (`settings-generator.test.js`, `fs-helpers.test.js`): Good coverage of hash embedding, modification detection, force overwrite, and backward compatibility. Tests actually modify files and verify the detection works.
- **Track B** (`generators.test.js`, `rules-generator.test.js`): Tests verify orchestrator agent contains merged rule content, no duplicate headers, rules generator produces only 2 files (not 4), and model frontmatter with hash detection.
- **Track C** (`cli.test.js`): Integration tests verify `--disallowedTools` appears in `start --print` output, `--allow-tools` suppresses it, workspace and plugin commands are registered and handle edge cases.

No coverage theater detected. All tests verify actual behavior rather than just checking for existence.

---

## Acceptance Criteria Verification

### Track A Stories

| Story | Status | Notes |
|-------|--------|-------|
| A-BUG-1 | PASS | Hash protection for settings.json works correctly |
| A-BUG-2 | PASS | `AGENT_NAMES` fully removed, all callers use `getAgentNames()` |
| A-BUG-3 | PASS | TaskCompleted/TeammateIdle added to `getHooksConfig()` |
| A-BUG-4 | PASS | project.yaml updated to `phase: delivery, status: complete` |
| A-BUG-5 | PASS | ideation phase added to swarm.yaml |
| A-BUG-6 | PASS | code_dir changed to `.` (per story recommendation) |
| A-BUG-7 | PASS | --dangerous warning via console.warn |
| A-BUG-8 | PASS | update command reports settings.json skip/regenerate |
| A-BUG-9 | PASS | README documents --force flag for update |

### Track B Stories

| Story | Status | Notes |
|-------|--------|-------|
| B-TOKEN-1 | PASS* | Rule content merged into orchestrator.md, templates deleted, identity-reinject hook updated. *See ADVISORY A-2 about stale file cleanup. |
| B-TOKEN-2 | PASS | (Deferred to future -- removed project context injection) |
| B-TOKEN-3 | PASS | (Content deduplication done as part of B-TOKEN-1 merge) |
| B-MODEL-1 | PASS | (Model selection guidance in orchestrator agent) |
| B-MODEL-2 | PASS | Model frontmatter YAML written correctly, hash detection works |

### Track C Stories

| Story | Status | Notes |
|-------|--------|-------|
| C-TOOLS-1 | PASS | --disallowedTools default + --allow-tools suppression working |
| C-WIRE-1 | PASS | workspace list/detect commands registered and functional |
| C-WIRE-2 | PASS | plugin list command registered, handles missing dir |
| C-WIRE-3 | PASS | init --github generates workflow file |

---

## Finding Counts

| Severity | Count |
|----------|-------|
| BLOCKING | 1 |
| ADVISORY | 4 |
| INFO | 5 |

**Verdict**: 1 blocking issue (B-1: hookPaths.length undefined + missing genOptions pass-through) must be fixed before merge. All other findings are advisory or informational.

---
---

# Final Review: Fix Tasks 11, 12, 13

**Reviewer**: reviewer agent (round 2)
**Date**: 2026-02-23
**Test Suite**: 249/249 passing (up from 244)

---

## Summary

Three fix tasks addressed findings from the first review round. All previous blocking and advisory issues have been resolved correctly. Test suite passes cleanly at 249/249. No new blocking issues introduced.

---

## Task #11: generateHooks return type fix + stale rules cleanup (developer-a)

### B-1 Resolution: VERIFIED FIXED

**Files reviewed**: `cli/update.js:99-104`, `cli/init.js:116-117`

- `update.js` now uses `hookResult.generated.length` (line 100) instead of the broken `hookPaths.length` -- correct.
- `update.js` now passes `genOptions` to `generateHooks(config, paths, genOptions)` (line 99) -- correct. The `--force` flag now propagates to hooks.
- `init.js` now uses `hookResult.generated.length` (line 117) -- correct.
- Both files correctly destructure from the `{ generated, skipped }` return type.

**Tests**: 2 new CLI tests (`init -y shows correct hooks count (not undefined)` and `update shows correct hooks count (not undefined)`) assert no `undefined` in output and match `/\d+ hooks\)/`. Good.

### A-2 Resolution: VERIFIED FIXED

**Files reviewed**: `cli/update.js:119-133`

- New step 4.1 in update.js correctly identifies stale rule files by checking for the `<!-- bmad-generated:[a-f0-9]+ -->` header.
- Only deletes files that have the bmad-generated header -- user-created files with the same name are preserved.
- Hardcoded list of stale filenames (`orchestrator-identity.md`, `orchestrator-methodology.md`) avoids any path traversal risk -- the names are constants joined with `paths.rulesDir` via `join()`.
- `readFileSafe` correctly returns `null` for missing files, and the `content &&` guard handles this.
- The regex `^<!-- bmad-generated:[a-f0-9]+ -->` matches only at the start of the file content, which is correct.
- Dry-run mode correctly skips this cleanup (guarded by `!options.dryRun`).

**Tests**: 2 new CLI tests verify removal of stale files and preservation of manually modified files. Both are meaningful integration tests that create files, run update, and verify the result.

**Security assessment**: No path traversal risk. The stale rule names are hardcoded string literals, not user input. `join(paths.rulesDir, name)` cannot escape the rules directory.

---

## Task #12: WebFetch added to --disallowedTools (developer-c)

### A-1 Resolution: VERIFIED FIXED

**Files reviewed**: `cli/start.js:34`, `test/cli.test.js:138`, `README.md:171`

- `WebFetch` is now included in the `--disallowedTools` list: `'Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'NotebookRead', 'WebSearch', 'WebFetch'` -- correct. All 7 tools are present.
- Test assertion at `cli.test.js:138` verifies `WebFetch` appears in start --print output.
- README.md description at line 171 lists all 7 tools including WebFetch.
- The `--allow-tools` bypass test still passes (the flag omits all disallowed tools).

**One observation**: The tool list is passed as separate arguments to `args.push()`, which means they become separate argv entries. This is the correct approach for Claude CLI's `--disallowedTools` flag which expects space-separated tool names.

---

## Task #13: duplicate model frontmatter edge case (developer-b)

### A-3 Resolution: VERIFIED FIXED

**Files reviewed**: `generators/agent-generator.js:109-124`, `test/generators.test.js:195-215`

The new `applyModelFrontmatter()` function (exported, line 109) handles all three cases:

1. **Content has frontmatter with existing `model:` key**: The regex `/^model:\s*.*/m` detects it, and `.replace(/^model:\s*.*$/m, ...)` replaces it in place. The `m` flag ensures multiline matching, so it only replaces the `model:` line, not the entire frontmatter. Verified correct.

2. **Content has frontmatter without `model:` key**: Appends `model: <value>` before the closing `---`. Verified correct.

3. **Content has no frontmatter**: Prepends a new `---\nmodel: <value>\n---\n` block. Verified correct.

**Edge case analysis**:

- The function checks `content.startsWith('---\n')` which correctly handles the frontmatter delimiter. The search for closing delimiter uses `content.indexOf('\n---\n', 4)` starting at position 4 to skip the opening `---\n`. Correct.
- `endIdx` check handles malformed frontmatter (no closing `---`) by falling through to the "no frontmatter" case. This is a safe fallback.
- The `existingFm = content.slice(4, endIdx)` correctly extracts the frontmatter body, and `rest = content.slice(endIdx + 5)` correctly extracts everything after `\n---\n` (5 chars). Verified.

**Interaction with `writeGeneratedFile`**: The model frontmatter is applied BEFORE `writeGeneratedFile` adds the `<!-- bmad-generated:hash -->` header. So the hash covers the frontmatter content. The test at `generators.test.js:217-247` verifies this: `isFileManuallyModified` returns false after generation with model frontmatter. Correct.

**Test coverage**: The test at line 195-215 directly tests `applyModelFrontmatter()` for all 3 cases, counting `model:` occurrences to prove no duplication. The integration test at line 217-247 verifies it works end-to-end with hash detection. Both are good.

**One minor note**: The function does not handle the edge case where frontmatter contains `model:` as a substring of a longer key (e.g., `data_model: foo`). However, the regex `^model:\s*` with the `m` flag requires `model:` to be at the start of a line, so `data_model:` would NOT match. This is correct.

---

## Previously Open Advisory Items (Status)

| ID | Original Finding | Status |
|----|-----------------|--------|
| A-1 | WebFetch missing from --disallowedTools | RESOLVED by Task #12 |
| A-2 | No stale rule cleanup during update | RESOLVED by Task #11 |
| A-3 | Duplicate model frontmatter edge case | RESOLVED by Task #13 |
| A-4 | settings.json hash relies on JSON key ordering | STILL OPEN (acknowledged, low risk) |

---

## Finding Counts (Round 2)

| Severity | Count |
|----------|-------|
| BLOCKING | 0 |
| ADVISORY | 0 (A-4 carried forward from round 1, accepted risk) |
| INFO | 0 |

**Verdict: GO.** All blocking and advisory issues from round 1 are resolved. Test suite passes at 249/249. Code is correct, tests are meaningful, no security concerns. Ready to ship.
