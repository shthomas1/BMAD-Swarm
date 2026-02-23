# Story B-MODEL-2: Wire model field from swarm.yaml into agent file frontmatter

## Goal
Activate the existing model routing infrastructure so that the `model` field in `swarm.yaml` agents config actually gets written as a YAML frontmatter `model` field in generated agent files, which Claude Code subagents can consume.

## Acceptance Criteria
- [ ] AC1: When `swarm.yaml` specifies `agents.{name}.model: sonnet`, the generated `.claude/agents/{name}.md` file includes YAML frontmatter with `model: sonnet`
- [ ] AC2: The YAML frontmatter block is properly formatted with `---` delimiters at the top of the file
- [ ] AC3: When no `model` is specified in swarm.yaml for an agent, no `model` frontmatter is added (no default model in frontmatter)
- [ ] AC4: The `<!-- preferred-model: ... -->` HTML comment (current stub) is replaced by the frontmatter approach
- [ ] AC5: Hash-based modification detection still works correctly with frontmatter present
- [ ] AC6: Test passes: `npm test -- --grep "model.*frontmatter|model.*agent|preferred.model"`

## Dev Notes
- Files to modify:
  - `generators/agent-generator.js:95-98` -- replace the `<!-- preferred-model -->` comment with proper YAML frontmatter. Change `applyAgentOverrides()` to prepend a `---\nmodel: {model}\n---\n` block instead of the HTML comment.
  - `utils/fs-helpers.js` -- ensure `writeGeneratedFile()` and `isFileManuallyModified()` work correctly when the content starts with YAML frontmatter (the `---` block). The hash should be placed BEFORE the frontmatter (i.e., `<!-- bmad-generated:hash -->\n---\nmodel: sonnet\n---\n...`).
- Pattern to follow: Claude Code subagent definitions support a `model` field in YAML frontmatter. Valid values are `"haiku"`, `"sonnet"`, `"opus"`, `"inherit"`. The frontmatter format is:
  ```
  ---
  model: sonnet
  ---
  # Agent Name
  ...
  ```
- If the agent already has frontmatter (e.g., from an ejected override), the model field should be added/merged, not create a second frontmatter block.
- Test file: `test/generators.test.js` -- add tests for model frontmatter generation. Test both with and without model config.

## D-IDs Referenced
- Layer A from model-routing-feasibility.md (subagent model routing via frontmatter)
- The existing stub at `agent-generator.js:95-98` shows this was anticipated
