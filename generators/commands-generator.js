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
    { name: 'brainstorm', description: 'Brainstorm with ideator overlay (Mode A — orchestrator process step)', body: buildBrainstormBody() },
    { name: 'explore-idea', description: 'Explore an idea (Mode B — ideator overlay + researcher parallel spawn)', body: buildExploreIdeaBody() },
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
\`\`\`

After all three agents report, update \`artifacts/context/findings-register.md\`: add a new entry for each novel finding, or append a \`YYYY-MM-DD — by <agent> — reconfirm — <why>\` line to the \`decision_trail\` of any finding already in the register (same claim + location = same ID, do not invent new IDs for carried-forward issues).`;
}

function buildExploreIdeaBody() {
  return `Enter explore-idea mode (Mode B — ideator overlay in your session + researcher spawned in parallel).

Step 1 (in your session): Read \`agents/ideator.md\` in full. Overlay the ideator persona onto your own session for the conversation with the user. Apply the Four Lenses, brainstorming techniques, elicitation methods invisibly. Check the exit condition at every turn.

Step 2 (parallel spawn): After your first exchange with the user — once the topic is clear enough to seed a research brief — emit the assembly block below and spawn a researcher via TeamCreate. The researcher gathers external evidence (market signals, technical feasibility, prior art, competitive landscape) while you continue the conversation with the user.

\`\`\`bmad-assembly
entry_point: explore-idea
complexity: 7
autonomy: auto
team:
  - role: researcher
    model: opus
rationale: Mode B — ideator overlay on orchestrator + parallel researcher for evidence gathering.
\`\`\`

Step 3 (on exit): When the user signals readiness to build, ask the researcher to finalize their report (SendMessage), then:
- Write \`artifacts/planning/brainstorm-<topic-slug>-<YYYY-MM-DD>.md\` — the brainstorm summary (same template as /brainstorm).
- Reference the researcher's evidence report in the summary's "open questions" / "supporting evidence" section.
- Emit a second assembly block for the next phase (typically strategist + architect).

DO NOT suppress the researcher spawn if the conversation hasn't started yet — the assembly block in Step 2 is mandatory and should go out in your first or second turn. The researcher will idle waiting for clarifying messages if needed.`;
}

function buildBrainstormBody() {
  return `Enter brainstorm mode (orchestrator-overlay pattern). Do NOT emit a bmad-assembly block. Do NOT call TeamCreate. Brainstorming is a conversational orchestrator process step — teammates cannot converse with the human directly, so the ideator persona overlays onto your own session instead.

1. Read \`agents/ideator.md\` in full. Internalize the Four Lenses, brainstorming techniques, elicitation methods, and adaptive interaction rules.
2. Greet the user as a thinking partner. Ask what they want to explore.
3. Run the conversation directly. Apply lenses and techniques invisibly — do not announce them.
4. Track decisions internally as they emerge. Append D-IDs to \`artifacts/context/decision-log.md\` (tactical = one-line, strategic = full record).
5. **Check the exit condition at every turn.** Before your turn ends, ask: has the user signaled readiness to build ("let's do this", "ok, build it", "hand it off")? If yes, exit now — do not take another brainstorming turn.
6. On exit:
   - Write \`artifacts/planning/brainstorm-<topic-slug>-<YYYY-MM-DD>.md\` containing: topic, key decisions with D-IDs, open questions, recommended next step.
   - Emit a \`bmad-assembly\` block for the recommended next phase (typically strategist for product brief + architect if architecture questions surfaced).
7. If the conversation reveals the idea needs substantial external research before it can be shaped further, suggest the user run \`/explore-idea\` (Mode B — ideator overlay + researcher in parallel). Do NOT silently spawn a researcher yourself mid-brainstorm.`;
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
