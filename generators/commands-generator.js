import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { writeGeneratedFile, isFileManuallyModified, ensureDir } from '../utils/fs-helpers.js';
import { getAgentNames } from '../utils/config.js';

/**
 * Generate .claude/commands/ files.
 *
 * Two categories:
 *   - identity-{role}.md: body is the full contents of agents/{role}.md
 *   - workflow commands (bug, feature, research, ...): body is the
 *     pre-wired assembly block + routing instruction
 *
 * @param {object} config - Parsed swarm.yaml config
 * @param {object} projectPaths - Project paths
 * @param {object} [options] - Options
 * @param {boolean} [options.force] - Overwrite manually-modified files
 * @returns {{ generated: string[], modified: string[] }}
 */
export function generateCommands(config, projectPaths, options = {}) {
  const commandsDir = join(projectPaths.claudeDir, 'commands');
  ensureDir(commandsDir);
  const generated = [];
  const modified = [];

  // 1. Identity commands — one per enabled agent
  for (const name of getAgentNames()) {
    const agentConfig = config.agents?.[name];
    if (agentConfig?.enabled === false) continue;
    const agentPath = join(projectPaths.agentsDir, `${name}.md`);
    if (!existsSync(agentPath)) continue;
    const agentContent = readFileSync(agentPath, 'utf8');
    const stripped = agentContent.replace(/^<!-- bmad-generated:[a-f0-9]+ -->\n/, '');
    const commandPath = join(commandsDir, `identity-${name}.md`);
    if (!options.force && isFileManuallyModified(commandPath)) {
      modified.push(`identity-${name}.md`);
      continue;
    }
    const body = `---\ndescription: Load ${name} role identity\n---\n\nYou are the ${name}. Your full role instructions follow — read and internalize them, then respond to the user's next message in character.\n\n${stripped}`;
    writeGeneratedFile(commandPath, body);
    generated.push(`identity-${name}.md`);
  }

  // 2. Workflow commands — hardcoded list
  const WORKFLOWS = [
    { name: 'bug', description: 'Start a bug fix with developer + reviewer', body: buildBugBody() },
    { name: 'feature', description: 'Start a feature with architect + developer + reviewer', body: buildFeatureBody() },
    { name: 'research', description: 'Research-only task with researcher', body: buildResearchBody() },
    { name: 'audit', description: 'Audit with researcher + reviewer + security', body: buildAuditBody() },
    { name: 'brainstorm', description: 'Brainstorm with ideator (Mode A)', body: buildBrainstormBody() },
    { name: 'migrate', description: 'Migration with architect + developer + reviewer', body: buildMigrateBody() },
    { name: 'review', description: 'Review an artifact with lens selection', body: buildReviewBody() },
    { name: 'plan', description: 'Plan mode: produce assembly block only, do not spawn', body: buildPlanBody() },
  ];

  for (const wf of WORKFLOWS) {
    const commandPath = join(commandsDir, `${wf.name}.md`);
    if (!options.force && isFileManuallyModified(commandPath)) {
      modified.push(`${wf.name}.md`);
      continue;
    }
    writeGeneratedFile(commandPath, `---\ndescription: ${wf.description}\n---\n\n${wf.body}`);
    generated.push(`${wf.name}.md`);
  }

  return { generated, modified };
}

function buildBugBody() {
  return `Acknowledge the user's bug report. Then emit this assembly block and call TeamCreate:

\`\`\`bmad-assembly
entry_point: bug-fix
complexity: 6
autonomy: auto
team:
  - role: developer
    model: opus
  - role: reviewer
    lenses: [code-quality]
    model: opus
rationale: Bug fix — developer implements, reviewer verifies.
\`\`\`

Spawn both teammates with a curated brief including the bug description and affected files. Relay developer completion + reviewer approval back to the user.`;
}

function buildFeatureBody() {
  return `Score complexity (5-15). If 5-7 use small-feature; if ≥8 use full-lifecycle. Emit the assembly block and call TeamCreate. Default team for small-feature:

\`\`\`bmad-assembly
entry_point: small-feature
complexity: 7
autonomy: auto
team:
  - role: architect
    model: opus
  - role: developer
    model: opus
  - role: reviewer
    lenses: [code-quality]
    model: opus
rationale: Small feature — architect designs, developer implements, reviewer verifies.
\`\`\``;
}

function buildResearchBody() {
  return `Emit:

\`\`\`bmad-assembly
entry_point: audit
complexity: 6
autonomy: auto
team:
  - role: researcher
    model: opus
rationale: Research-only exploration, no build.
\`\`\`

Spawn researcher with the user's question. Relay findings.`;
}

function buildAuditBody() {
  return `Emit:

\`\`\`bmad-assembly
entry_point: audit
complexity: 9
autonomy: auto
team:
  - role: researcher
    model: opus
  - role: reviewer
    lenses: [code-quality, security, test-coverage]
    model: opus
  - role: security
    model: opus
rationale: Multi-lens audit — researcher collects evidence, reviewer + security produce findings.
\`\`\``;
}

function buildBrainstormBody() {
  return `Emit:

\`\`\`bmad-assembly
entry_point: brainstorm
complexity: 5
autonomy: collaborative
team:
  - role: ideator
    model: opus
rationale: Mode A interactive brainstorming — ideator only.
\`\`\``;
}

function buildMigrateBody() {
  return `Emit:

\`\`\`bmad-assembly
entry_point: migrate
complexity: 9
autonomy: guided
team:
  - role: architect
    model: opus
  - role: developer
    model: opus
  - role: reviewer
    lenses: [code-quality, test-coverage]
    model: opus
rationale: Migration — architect plans, developer executes, reviewer validates coverage.
\`\`\``;
}

function buildReviewBody() {
  return `Inspect the artifact the user referenced. Select lenses from the signal table in /identity-orchestrator (api, data, ui, perf, auth, test, docs). Emit the assembly block with those lenses:

\`\`\`bmad-assembly
entry_point: audit
complexity: 6
autonomy: auto
team:
  - role: reviewer
    lenses: [<selected>]
    model: opus
rationale: Lens-based review of <artifact>.
\`\`\``;
}

function buildPlanBody() {
  return `Plan mode: assess the request, emit a bmad-assembly block, then STOP and wait for the user to approve. Do NOT call TeamCreate yet. After user says "go" or equivalent, execute the block.`;
}
