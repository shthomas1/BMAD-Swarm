import { existsSync, readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { getProjectPaths } from '../utils/paths.js';
import { discoverPluginAgents, mergeAgentNames } from '../utils/plugins.js';
import { getAgentNames } from '../utils/config.js';

/**
 * Register the plugin command with the CLI program.
 * @param {import('commander').Command} program
 */
export function registerPluginCommand(program) {
  const plugin = program
    .command('plugin')
    .description('Manage plugin agents');

  plugin
    .command('list')
    .description('Discover and list plugin agents')
    .action(() => {
      try {
        const projectRoot = process.cwd();
        const paths = getProjectPaths(projectRoot);

        if (!existsSync(paths.swarmYaml)) {
          console.log('Not a BMAD Swarm project. Run `bmad-swarm init` first.');
          return;
        }

        const config = yaml.load(readFileSync(paths.swarmYaml, 'utf8'));
        const pluginAgents = discoverPluginAgents(config, projectRoot);

        if (pluginAgents.length === 0) {
          console.log('No plugins found. Place agent .md files in plugins/agents/ to add custom agents.');
          return;
        }

        const builtInNames = getAgentNames();
        const { plugins } = mergeAgentNames(builtInNames, pluginAgents);
        const conflicting = pluginAgents.filter(p => !plugins.some(a => a.name === p.name));

        console.log(`\nPlugin agents (${pluginAgents.length}):\n`);
        for (const agent of pluginAgents) {
          const conflict = conflicting.some(c => c.name === agent.name);
          const suffix = conflict ? ' (conflicts with built-in)' : '';
          console.log(`  ${agent.name}${suffix}`);
          console.log(`    ${agent.path}`);
        }
        console.log('');
      } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}
