import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PACKAGE_TEMPLATES_DIR } from '../utils/paths.js';
import { writeFileSafe, isFileManuallyModified, contentHash } from '../utils/fs-helpers.js';
import { getHooksConfig } from './hooks-generator.js';

/**
 * Generate .claude/settings.json from the package template,
 * merging in the hooks configuration from the hooks generator.
 *
 * @param {object} config - Parsed swarm.yaml config
 * @param {object} projectPaths - Project paths from getProjectPaths()
 * @param {object} [options] - Options
 * @param {boolean} [options.force] - Overwrite even if manually modified
 * @returns {{ path: string, modified: boolean }}
 */
export function generateSettings(config, projectPaths, options = {}) {
  // Check for manual modifications (unless --force)
  if (!options.force && isFileManuallyModified(projectPaths.settingsJson)) {
    return { path: projectPaths.settingsJson, modified: true };
  }

  const templatePath = join(PACKAGE_TEMPLATES_DIR, 'settings.json.template');
  const template = JSON.parse(readFileSync(templatePath, 'utf8'));

  // Hooks come exclusively from the hooks generator (single source of truth)
  template.hooks = getHooksConfig();

  // Generate the JSON content without the hash first
  const contentWithoutHash = JSON.stringify(template, null, 2) + '\n';
  const hash = contentHash(contentWithoutHash);

  // Embed the hash as a top-level key
  const output = { _bmadGenerated: hash, ...template };
  const finalContent = JSON.stringify(output, null, 2) + '\n';

  writeFileSafe(projectPaths.settingsJson, finalContent);
  return { path: projectPaths.settingsJson, modified: false };
}
