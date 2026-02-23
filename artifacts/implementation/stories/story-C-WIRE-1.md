# Story C-WIRE-1: Wire workspace.js into CLI

## Goal
Add CLI commands that expose the workspace discovery functionality from `utils/workspace.js`, which is implemented and tested but has no CLI integration.

## Acceptance Criteria
- [ ] AC1: A new `bmad-swarm workspace` command (or subcommand of `status`) is registered in `bin/bmad-swarm.js`
- [ ] AC2: `bmad-swarm workspace list` (or equivalent) discovers workspaces from the root `swarm.yaml` and displays them
- [ ] AC3: `bmad-swarm workspace detect` (or equivalent) checks if the current directory is a workspace within a monorepo
- [ ] AC4: The command gracefully handles non-monorepo projects (no workspaces key in swarm.yaml)
- [ ] AC5: Test passes: `npm test -- --grep "workspace.*cli|workspace.*command"`

## Dev Notes
- Files to create:
  - `cli/workspace.js` -- new CLI command module implementing `registerWorkspaceCommand()`
- Files to modify:
  - `bin/bmad-swarm.js` -- import and register the new workspace command
- Functions to expose from `utils/workspace.js`:
  - `discoverWorkspaces(rootDir, rootConfig)` -- lists workspaces from swarm.yaml workspaces key
  - `detectWorkspaceContext(dir)` -- checks if current dir is a workspace in a monorepo
  - `mergeWorkspaceConfig(rootConfig, workspaceConfig)` -- merges root + workspace configs
- Pattern to follow: Look at `cli/status.js` for a simple read-only command pattern. Look at `cli/phase.js` for a subcommand pattern (show, advance, set).
- Recommended command structure:
  ```
  bmad-swarm workspace list     # Discover and list workspaces
  bmad-swarm workspace detect   # Check if current dir is a workspace
  ```
- The workspace command should:
  1. Load swarm.yaml from the current directory (or walk up to find root)
  2. Call `discoverWorkspaces()` or `detectWorkspaceContext()` as appropriate
  3. Display results in a human-readable format
- Test file: `test/cli.test.js` -- add workspace command tests. Also verify against `test/workspace.test.js` patterns.

## D-IDs Referenced
- I-1 from project review (workspace.js not yet wired into CLI)
