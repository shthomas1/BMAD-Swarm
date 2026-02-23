# Story B-TOKEN-3: Deduplicate orchestrator agent content after rule merge

## Goal
After B-TOKEN-1 merges rule content into the orchestrator agent file, remove any duplicated sections so each piece of content appears exactly once.

## Acceptance Criteria
- [ ] AC1: The orchestrator agent file (`agents/orchestrator.md`) contains NO duplicated sections (e.g., Complexity Scoring table appears once, not twice)
- [ ] AC2: The following sections appear exactly once each: Complexity Scoring, Team Composition by Complexity, Phase Skip Rules, Autonomy Override Rules, Entry Point Routing, Handling Rejections
- [ ] AC3: The orchestrator agent file is well-organized with a logical section flow
- [ ] AC4: Test passes: `npm test -- --grep "orchestrator"`

## Dev Notes
- Files to modify:
  - `agents/orchestrator.md` -- the PACKAGE template. After B-TOKEN-1 merges in content from the two rule files, review for duplicated sections and remove them.
- The project review (A-1 section "MAJOR: Orchestrator agent duplicates rule content") identified these duplicated sections:
  - Complexity Scoring table
  - Team Composition by Complexity table
  - Phase Skip Rules table
  - Autonomy Override Rules table
  - Handling Rejections section
- When deduplicating, prefer keeping the version from the methodology rules (which is the more complete/structured version) and removing the abbreviated version that was in the original orchestrator.md.
- This story DEPENDS ON B-TOKEN-1 being completed first.
- Test file: `test/generators.test.js` -- verify the generated orchestrator agent content does not contain duplicate section headers

## D-IDs Referenced
- Strategy 2 from token-optimization.md (deduplicate orchestrator agent and rules)
- Depends on B-TOKEN-1
