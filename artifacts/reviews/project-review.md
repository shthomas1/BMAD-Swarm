# BMAD Swarm Project Review

**Date**: 2026-02-23
**Reviewer**: reviewer agent (adversarial review)
**Scope**: Full project quality, consistency, completeness, security, and documentation accuracy
**Version**: 1.2.0
**Tests**: 218 passing, 0 failing

---

## Summary

bmad-swarm is a well-engineered CLI tool that generates Claude Code agent team configurations. The codebase is clean, consistent, well-tested, and follows good JavaScript/ESM patterns. No critical security vulnerabilities were found. The stated project goal ("adding brainstorming features to the existing bmad-swarm") appears fully achieved. Below are findings organized by severity.

**Finding counts**: 1 BLOCKING, 8 ADVISORY, 7 INFO

---

## BLOCKING Findings

### B-1: `settings.json` silently overwritten on every update (no modification protection)

**Location**: `generators/settings-generator.js:13-23`, `cli/update.js:131-132`

Every other generated file (agents, CLAUDE.md, system-prompt.txt, rules, hooks) uses `writeGeneratedFile()` or `writeGeneratedJsFile()` with hash-based modification detection. The `settings-generator.js` uses plain `writeFileSafe()` instead, meaning:

1. No content hash is written to `settings.json`
2. No `isFileManuallyModified()` check is performed before writing
3. Every `bmad-swarm update` call silently destroys any custom permissions the user added to `.claude/settings.json`

This is the only generated file that lacks modification protection. Given that `settings.json` controls Claude Code permissions (which users will reasonably customize), this is a data loss risk.

**Impact**: Users who add custom permissions to `settings.json` (e.g., additional `Bash()` allow rules, WebFetch permissions) will lose them on the next `bmad-swarm update` with no warning. The README says update "never touches user-owned files" but `settings.json` is treated as fully managed.

**Recommendation**: Apply the same `writeGeneratedFile()`/`isFileManuallyModified()` pattern used for all other generated files. Alternatively, document `settings.local.json` as the official escape hatch for user permissions (Claude Code merges both files).

---

## ADVISORY Findings

### A-1: `getAgentNames()` defined but never used; deprecated `AGENT_NAMES` used everywhere

**Location**: `utils/config.js:112-125` (defined), `utils/config.js:130-141` (deprecated constant)

`getAgentNames()` was created as the preferred replacement for `AGENT_NAMES` (the constant is marked `@deprecated`), but zero callers use the function. All 8 import sites (`agent-generator.js`, `claude-md-generator.js`, `doctor.js`, `status.js`, `validator.js`, and test files) import and use the deprecated `AGENT_NAMES` constant.

This is dead code that creates confusion about which API to use. The `getAgentNames()` function includes caching logic that `AGENT_NAMES` duplicates via IIFE.

**Recommendation**: Either migrate all callers to `getAgentNames()` and remove `AGENT_NAMES`, or remove `getAgentNames()` and un-deprecate `AGENT_NAMES`.

### A-2: `TaskCompleted` and `TeammateIdle` hooks generated but not registered in settings.json

**Location**: `generators/hooks-generator.js:38-39` (file generation), `generators/hooks-generator.js:66-92` (getHooksConfig -- omits these two)

The `generateHooks()` function creates 6 hook files, but `getHooksConfig()` only registers 4 of them in `settings.json`. The `TaskCompleted.cjs` and `TeammateIdle.cjs` files are generated to disk but have no corresponding entries in the hooks configuration.

If Claude Code discovers hooks by filename convention (matching event name), these work. If it requires explicit registration in `settings.json`, they are dead files. The behavior should be verified and made explicit.

**Recommendation**: Either add `TaskCompleted` and `TeammateIdle` entries to `getHooksConfig()`, or document why they are excluded (e.g., Claude Code auto-discovers them by event-name matching).

### A-3: `project.yaml` phase stuck at `not-started` despite mature codebase

**Location**: `project.yaml:4`

The project has been through multiple development cycles (v1.2.0, 218 tests, all 28 implementation plan items complete), but `project.yaml` still shows `phase: not-started`. This means:

1. The phase machine (`utils/phase-machine.js`) is implemented and tested but never used during actual development
2. The `status` command will display misleading phase information
3. The `doctor` command does not check for phase staleness

**Recommendation**: Either advance the phase to reflect reality (e.g., `complete` or `delivery`), or acknowledge that the phase machine is primarily for consumer projects and this project's own `project.yaml` is not actively managed.

### A-4: `swarm.yaml` phases block omits `ideation` despite it being a core feature

**Location**: `swarm.yaml:9-20`

The `methodology.phases` section lists `exploration`, `definition`, `design`, `implementation`, and `delivery` -- but not `ideation` (Phase 0). The ideation phase is added by `applyDefaults()` in `config.js`, so it works correctly at runtime. However, the `swarm.yaml` is the reference configuration file, and its omission of ideation is inconsistent with the README and methodology documentation, which prominently feature Phase 0.

**Recommendation**: Add `ideation: { enabled: true }` to the `methodology.phases` block in `swarm.yaml` for explicitness and consistency.

### A-5: `code_dir` set to `./src` but no `src/` directory exists

**Location**: `swarm.yaml:29`, `project.yaml` (implicit)

The `output.code_dir` is `./src` which is the default for consumer projects. Since bmad-swarm is developing itself, and its source lives in `cli/`, `generators/`, `utils/`, etc. (not `src/`), the code guard hooks (`orchestrator-post-tool.cjs`, `orchestrator-stop.cjs`) protect a non-existent directory. This means:

1. The orchestrator code guard hooks are effectively no-ops for this project
2. Writing to `cli/`, `generators/`, or `utils/` would not trigger the delegation warning

This is harmless for the project itself but could be confusing for contributors.

**Recommendation**: Either change `code_dir` to match the actual source layout (e.g., multiple dirs), or add a comment in `swarm.yaml` explaining that `./src` is the default for consumer projects and the code guard scope does not apply to bmad-swarm's own development.

### A-6: `--dangerous` flag lacks confirmation or warning

**Location**: `cli/start.js:15-16, 27-29`

The `--dangerous` flag passes `--dangerously-skip-permissions` to Claude Code, which bypasses all permission prompts. This is documented in the README but has no confirmation prompt or warning output when used. Given the severity (full autonomous file/command execution), a confirmation or at least a stderr warning would be appropriate.

**Recommendation**: Add a `console.warn()` message when `--dangerous` is used, such as: "WARNING: Launching in dangerous mode. All permission prompts will be skipped."

### A-7: `update` command claims to not touch user-owned files, but `settings.json` is overwritten

**Location**: `cli/update.js:135`

The `update` command prints: "User-owned files (swarm.yaml, overrides/, artifacts/) were not touched." This message does not mention `settings.json`, but `settings.json` is silently overwritten (see B-1). The message is technically true (it lists what WAS NOT touched), but it creates a false sense of safety.

**Recommendation**: Either protect `settings.json` with modification detection (B-1), or update the message to clarify: "Note: .claude/settings.json is always regenerated. Use settings.local.json for custom permissions."

### A-8: `--force` option not documented for `update` command in README

**Location**: `README.md:171-177`, `cli/update.js:21`

The `update` command supports `--force` (overwrite even manually modified files), but the README only shows `--dry-run`. The `--force` flag is important for users who need to reset after manual edits.

**Recommendation**: Add `--force` to the README CLI reference for the `update` command.

---

## INFO Findings

### I-1: `workspace.js` and `plugins.js` both documented as "not yet wired into CLI"

**Location**: `utils/workspace.js:1`, `utils/plugins.js:1`

Both modules have leading comments stating they are not wired into the CLI. They are implemented, tested (test files pass), and functional as libraries -- they just have no CLI integration point. The `workspace.test.js` has 6 passing tests, and `plugins.test.js` has tests as well.

This is not a bug -- it is intentional future work. The modules are ready for integration when needed.

### I-2: Consistent coding style throughout the codebase

The entire codebase follows consistent patterns:

- **Naming**: camelCase for functions/variables, UPPER_CASE for constants, kebab-case for file names
- **Module pattern**: ESM with named exports, one primary export per file
- **Error handling**: Thrown errors at validation boundaries, process.exit(1) at CLI boundaries, empty catch blocks only for intentional "ignore" cases
- **JSDoc**: All public functions have JSDoc with `@param` and `@returns`
- **Imports**: Node.js built-ins use `node:` prefix consistently
- **File organization**: Clear separation between CLI (presentation), generators (logic), and utils (shared)

Code quality is high throughout.

### I-3: Test suite is comprehensive and well-structured

218 tests across 19 test files covering:

- Happy paths for all CLI commands
- Error paths (malformed YAML, invalid config, missing files)
- Idempotency (repeated update produces identical output)
- Edge cases (empty configs, disabled agents, missing templates)
- Generator output validation (correct content in generated files)
- Phase machine state transitions and history tracking

The test suite uses `node:test` (no external test dependencies) and runs in ~2.5 seconds. Tests are deterministic and use temporary directories for isolation.

### I-4: Hash-based modification detection is well-implemented

The `fs-helpers.js` modification detection system supports:

- HTML comment headers for Markdown files (`<!-- bmad-generated:hash -->`)
- JS comment headers for JavaScript/CJS files (`// bmad-generated:hash`)
- Shebang-aware hash placement (hash on line 2 after `#!` shebang)
- Backward compatibility (files without hash headers are treated as overwritable)
- 8-character SHA-256 truncation (sufficient for collision avoidance in this context)

This is a clean and effective approach to detecting user modifications.

### I-5: Template engine is minimal but sufficient

The custom template engine in `utils/template.js` supports:

- Variable substitution: `{{key}}` and `{{nested.key}}`
- Conditionals: `{{#if key}}...{{#else}}...{{/if}}` with nesting support
- Iteration: `{{#each array}}...{{/each}}` with `{{this}}` for primitives
- Negation: `{{#unless key}}...{{/unless}}`

The engine handles nesting correctly via `findMatchingClose()`. It warns on unresolved variables rather than silently swallowing them. This is appropriate for the project's needs without pulling in a heavy dependency like Handlebars.

### I-6: Hooks system provides effective orchestrator discipline enforcement

The hooks implement a multi-layered enforcement strategy:

- **Identity reinject** (SessionStart, compact): Survives context compression
- **Post-tool code guard** (PostToolUse): Real-time detection of code directory modifications
- **Stop code guard** (Stop): Blocks turn completion if violations detected
- **Task tool warning** (PostToolUse): Discourages standalone Task subagent usage
- **Marker file handoff**: Post-tool hook writes `.code-modified-marker`, Stop hook reads and acts on it

The 10-minute staleness check on the marker file prevents false positives from previous sessions.

### I-7: GitHub Actions generator is not wired into any CLI command

**Location**: `generators/github-actions-generator.js`

The `generateGitHubWorkflow()` function exists but is not called from `init`, `update`, or any other CLI command. The README and help text mention no `--github` flag. This appears to be ready code awaiting a CLI integration trigger (likely `bmad-swarm init --github` or similar).

---

## Architecture Compliance

The codebase correctly implements the documented architecture:

1. **Static generation model**: bmad-swarm generates files and exits. No runtime presence. Confirmed.
2. **Three-tier instruction system**: System prompt (highest) + rules (reinforcement) + CLAUDE.md (context). Confirmed.
3. **Three-layer override system**: Package templates + swarm.yaml overrides + ejected overrides. Confirmed, with correct resolution order.
4. **Artifact-driven coordination**: Agents coordinate through files on disk. Confirmed.
5. **Agent discovery**: Dynamic via directory scan with caching. Confirmed (though `getAgentNames()` is not used -- A-1).
6. **Phase machine**: Implemented with history tracking and transition validation. Confirmed.

## Security Assessment

No significant security issues found:

1. **No command injection**: `execSync('npm test')` uses a fixed command string. `spawn('claude', args)` uses a controlled args array.
2. **No path traversal**: All paths are resolved relative to known roots via `getProjectPaths()`. User input from CLI is limited to agent names validated against `AGENT_NAMES`.
3. **No prototype pollution**: YAML parsing uses `js-yaml` (safe by default, no `!!js/function` support).
4. **No sensitive data exposure**: No secrets, tokens, or credentials in generated files.
5. **`--dangerous` flag**: Passes `--dangerously-skip-permissions` to Claude Code. This is a pass-through to Claude's own flag, not a bmad-swarm vulnerability, but warrants a usage warning (A-6).

## Documentation Accuracy

README accurately describes:

- All 10 CLI commands and their behavior
- All 13 agents and their roles
- All 6 phases and their modes
- The three-layer override system
- The artifact directory structure
- Autonomy levels and their behavior

Minor documentation gaps:

- `--force` flag not in README (A-8)
- `settings.local.json` not documented as user permissions escape hatch
- `github-actions-generator.js` exists but no CLI command references it

---

## Conclusion

bmad-swarm is a mature, well-tested project at v1.2.0. The single BLOCKING finding (B-1: settings.json modification protection) is a real data loss risk but straightforward to fix. The ADVISORY findings are consistency improvements and documentation gaps. The codebase quality is high, the architecture is sound, and the test coverage is thorough.
