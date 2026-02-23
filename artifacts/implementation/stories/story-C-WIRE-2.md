# Story C-WIRE-2: Wire plugins.js into CLI

## Goal
Add CLI commands that expose the plugin discovery functionality from `utils/plugins.js`, which is implemented and tested but has no CLI integration.

## Acceptance Criteria
- [ ] AC1: A new `bmad-swarm plugin` command is registered in `bin/bmad-swarm.js`
- [ ] AC2: `bmad-swarm plugin list` discovers and displays plugin agents from the configured plugins directory
- [ ] AC3: The command shows each plugin agent's name, path, and whether it conflicts with a built-in agent name
- [ ] AC4: The command gracefully handles missing plugins directory (displays "no plugins found")
- [ ] AC5: Test passes: `npm test -- --grep "plugin.*cli|plugin.*command"`

## Dev Notes
- Files to create:
  - `cli/plugin.js` -- new CLI command module implementing `registerPluginCommand()`
- Files to modify:
  - `bin/bmad-swarm.js` -- import and register the new plugin command
- Functions to expose from `utils/plugins.js`:
  - `discoverPluginAgents(config, projectRoot)` -- finds .md files in plugins/agents/ dir
  - `mergeAgentNames(builtInNames, pluginAgents)` -- merges plugin names with built-in names
- Pattern to follow: Same as C-WIRE-1, look at `cli/status.js` for a simple read-only command.
- Recommended command structure:
  ```
  bmad-swarm plugin list    # Discover and list plugin agents
  ```
- The plugin command should:
  1. Load swarm.yaml config
  2. Call `discoverPluginAgents(config, projectRoot)`
  3. Call `mergeAgentNames(getAgentNames(), pluginAgents)` to show conflicts
  4. Display results
- Test file: `test/cli.test.js` -- add plugin command tests. Use `test/plugins.test.js` as reference.

## D-IDs Referenced
- I-1 from project review (plugins.js not yet wired into CLI)
