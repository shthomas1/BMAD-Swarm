import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { getProjectPaths } from '../utils/paths.js';

/**
 * Register the start command with the CLI program.
 * @param {import('commander').Command} program
 */
export function registerStartCommand(program) {
  program
    .command('start')
    .description('Launch Claude Code in this project')
    .option('--print', 'Print the claude command instead of running it')
    .action(async (options) => {
      const projectRoot = process.cwd();
      const paths = getProjectPaths(projectRoot);

      if (!existsSync(paths.settingsJson)) {
        console.error('No .claude/settings.json found. Run `bmad-swarm init` first.');
        process.exit(1);
      }

      // Identity loads via /identity-orchestrator slash command; no --append-system-prompt.
      const args = [];

      if (options.print) {
        console.log(`claude${args.length ? ' ' + args.join(' ') : ''}`.trim());
        return;
      }

      const child = spawn('claude', args, { stdio: 'inherit', shell: process.platform === 'win32' });
      child.on('exit', (code) => process.exit(code ?? 0));
    });
}
