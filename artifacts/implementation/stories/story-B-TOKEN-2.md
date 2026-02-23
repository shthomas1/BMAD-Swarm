# Story B-TOKEN-2: Remove redundant Project Info sections from agent templates

## Goal
Save ~90 tokens per agent (~1,170 tokens across all 13 agents) by removing the "Project Info" section that `injectProjectContext()` appends to every agent file, since this information is already available in CLAUDE.md.

## Acceptance Criteria
- [ ] AC1: The `injectProjectContext()` function in `generators/agent-generator.js` is removed or made a no-op
- [ ] AC2: Generated `.claude/agents/*.md` files no longer contain a "## Project Info" section
- [ ] AC3: All 13 generated agent files are shorter by the Project Info section
- [ ] AC4: Tests that assert `content.includes('Project Info')` are updated to reflect the removal
- [ ] AC5: Test passes: `npm test -- --grep "agent.*generator|project.*info"`

## Dev Notes
- Files to modify:
  - `generators/agent-generator.js:64` -- remove the `content = injectProjectContext(content, config);` call
  - `generators/agent-generator.js:110-139` -- remove the `injectProjectContext()` function entirely
  - `generators/agent-generator.js:113` -- also remove the regex that strips existing Project Info sections (line 113: `content.replace(/\n+## Project Info\n[\s\S]*$/, '')`) since it is no longer needed
- Tests to update:
  - `test/generators.test.js:51` -- remove `assert.ok(content.includes('Project Info'), ...)` assertion
  - `test/generators.test.js:80` -- remove `assert.ok(content.includes('Project Info'), ...)` assertion
  - Any other test that checks for 'Project Info' in generated agent content
- Pattern: This is a deletion-focused change. Remove the function and its call site. Update tests.
- The project info (project name, type, language, code_dir, etc.) is already in CLAUDE.md which loads for every agent session. Removing it from agent files eliminates redundancy.

## D-IDs Referenced
- Strategy 3 from token-optimization.md (remove Project Info sections from all 13 agent files)
