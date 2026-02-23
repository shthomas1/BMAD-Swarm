import { existsSync, readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { getProjectPaths } from '../utils/paths.js';
import { discoverWorkspaces, detectWorkspaceContext } from '../utils/workspace.js';

/**
 * Register the workspace command with the CLI program.
 * @param {import('commander').Command} program
 */
export function registerWorkspaceCommand(program) {
  const workspace = program
    .command('workspace')
    .description('Manage workspace/monorepo discovery');

  workspace
    .command('list')
    .description('Discover and list workspaces from swarm.yaml')
    .action(() => {
      try {
        const projectRoot = process.cwd();
        const paths = getProjectPaths(projectRoot);

        if (!existsSync(paths.swarmYaml)) {
          console.log('Not a BMAD Swarm project. Run `bmad-swarm init` first.');
          return;
        }

        const config = yaml.load(readFileSync(paths.swarmYaml, 'utf8'));
        const workspaces = discoverWorkspaces(projectRoot, config);

        if (workspaces.length === 0) {
          console.log('No workspaces found. Add a `workspaces` key to swarm.yaml for monorepo support.');
          return;
        }

        console.log(`\nWorkspaces (${workspaces.length}):\n`);
        for (const ws of workspaces) {
          console.log(`  ${ws.name} (${ws.relativePath})`);
        }
        console.log('');
      } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  workspace
    .command('detect')
    .description('Check if current directory is a workspace in a monorepo')
    .action(() => {
      try {
        const dir = process.cwd();
        const result = detectWorkspaceContext(dir);

        if (result.isWorkspace) {
          console.log(`This directory is a workspace: ${result.workspacePath}`);
          console.log(`Root directory: ${result.rootDir}`);
        } else {
          console.log('Not a workspace within a monorepo.');
        }
      } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}
