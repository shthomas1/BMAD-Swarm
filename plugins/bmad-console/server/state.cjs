// state.js — assembles canonical state from a project root.
'use strict';

const fs = require('fs');
const path = require('path');
const parsers = require('./parsers.cjs');

function safeRead(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

function safeStat(p) {
  try {
    return fs.statSync(p);
  } catch {
    return null;
  }
}

function listDirRecursive(root, base = root, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(root, e.name);
    if (e.isDirectory()) {
      listDirRecursive(full, base, out);
    } else if (e.isFile()) {
      out.push(path.relative(base, full).split(path.sep).join('/'));
    }
  }
  return out;
}

function buildState(projectRoot) {
  const artifactsDir = path.join(projectRoot, 'artifacts');
  const swarmYaml = parsers.parseYaml(safeRead(path.join(projectRoot, 'swarm.yaml')) || '');
  const projectYaml = parsers.parseYaml(safeRead(path.join(projectRoot, 'project.yaml')) || '');
  const phasesYaml = parsers.parseYaml(
    safeRead(path.join(projectRoot, 'methodology', 'phases.yaml')) || ''
  );

  // --- Project block --------------------------------------------------------
  const project = {
    name: (swarmYaml.project && swarmYaml.project.name) || (projectYaml.project && projectYaml.project.name) || path.basename(projectRoot),
    phase: projectYaml.phase || null,
    status: projectYaml.status || null,
    autonomy: (swarmYaml.methodology && swarmYaml.methodology.autonomy) || 'auto',
  };

  // --- Phases ---------------------------------------------------------------
  const phasesObj = (phasesYaml && phasesYaml.phases) || {};
  const phaseEntries = Object.entries(phasesObj).map(([id, def]) => {
    return {
      id,
      name: def.name || id,
      order: typeof def.order === 'number' ? def.order : 0,
      def,
    };
  });
  phaseEntries.sort((a, b) => a.order - b.order);

  const activeIdx = phaseEntries.findIndex((p) => p.id === project.phase);

  const phases = phaseEntries.map((entry, idx) => {
    const def = entry.def || {};
    const requiredArtifacts = Array.isArray(def.artifacts)
      ? def.artifacts
          .filter((a) => a && a.required)
          .map((a) => {
            const rel = (a.path || '').replace(/^\.\/?/, '');
            const abs = path.join(projectRoot, rel);
            const stat = safeStat(abs);
            const exists = !!stat;
            return {
              type: a.type || 'artifact',
              path: rel,
              exists: exists,
            };
          })
      : [];

    let status;
    if (project.phase && entry.id === project.phase) {
      status = project.status === 'complete' ? 'done' : 'active';
    } else if (activeIdx === -1) {
      // no project phase known — guess by artifacts
      status = requiredArtifacts.length > 0 && requiredArtifacts.every((a) => a.exists) ? 'done' : 'pending';
    } else if (idx < activeIdx) {
      status = 'done';
    } else if (idx > activeIdx) {
      status = 'pending';
      // skipped if we're past it but artifacts missing
      const someMissing = requiredArtifacts.some((a) => !a.exists);
      if (project.status === 'complete' && someMissing) status = 'skipped';
    } else {
      status = 'active';
    }

    // If project.status === 'complete' AND this is the active phase, mark done
    if (project.status === 'complete' && entry.id === project.phase) {
      status = 'done';
    }

    const agents = [];
    if (def.agents) {
      if (Array.isArray(def.agents.primary)) agents.push(...def.agents.primary);
      if (Array.isArray(def.agents.supporting)) agents.push(...def.agents.supporting);
    }

    return {
      id: entry.id,
      name: entry.name,
      order: entry.order,
      status,
      gate: def.gate
        ? {
            name: def.gate.name || null,
            type: def.gate.type || null,
            criteria_met: null,
          }
        : null,
      required_artifacts: requiredArtifacts,
      agents,
    };
  });

  // --- Decisions ------------------------------------------------------------
  const decisionLogPath = path.join(artifactsDir, 'context', 'decision-log.md');
  const decisions = parsers.parseDecisionLog(
    safeRead(decisionLogPath) || '',
    'artifacts/context/decision-log.md'
  );

  // --- Stories --------------------------------------------------------------
  const storiesDir = path.join(artifactsDir, 'implementation', 'stories');
  const stories = [];
  let storyFiles = [];
  try {
    storyFiles = fs.readdirSync(storiesDir).filter((f) => f.endsWith('.md'));
  } catch {
    storyFiles = [];
  }
  for (const f of storyFiles) {
    const content = safeRead(path.join(storiesDir, f)) || '';
    stories.push(parsers.parseStory(content, f));
  }

  // --- Reviews --------------------------------------------------------------
  const reviewsDir = path.join(artifactsDir, 'reviews');
  const reviews = [];
  let reviewFiles = [];
  try {
    reviewFiles = fs.readdirSync(reviewsDir).filter((f) => f.endsWith('.md'));
  } catch {
    reviewFiles = [];
  }
  for (const f of reviewFiles) {
    const content = safeRead(path.join(reviewsDir, f)) || '';
    reviews.push(parsers.parseReview(content, f));
  }

  // --- Activity (last 30 file changes under artifacts/) ---------------------
  const allArtifactFiles = listDirRecursive(artifactsDir);
  const activity = [];
  for (const rel of allArtifactFiles) {
    const abs = path.join(artifactsDir, rel);
    const st = safeStat(abs);
    if (!st) continue;
    activity.push({
      timestamp: st.mtime.toISOString(),
      mtimeMs: st.mtimeMs,
      type: classifyArtifactPath(rel),
      summary: summarizeArtifactPath(rel),
      path: 'artifacts/' + rel,
    });
  }
  activity.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const recentActivity = activity.slice(0, 30).map((a) => ({
    timestamp: a.timestamp,
    type: a.type,
    summary: a.summary,
    path: a.path,
  }));

  // --- Agents ---------------------------------------------------------------
  // Read swarm.yaml team if present, else use the active phase's agents.
  let agentNames = [];
  if (swarmYaml.team && Array.isArray(swarmYaml.team.specializations)) {
    agentNames = swarmYaml.team.specializations.map((s) => s.role || 'developer');
  }
  if (agentNames.length === 0) {
    const activePhase = phases.find((p) => p.status === 'active') || phases[phases.length - 1];
    if (activePhase) agentNames = [...new Set(['orchestrator', ...activePhase.agents])];
    else agentNames = ['orchestrator'];
  } else {
    agentNames.unshift('orchestrator');
  }

  const now = Date.now();
  const agents = agentNames.map((name) => {
    const last = guessAgentLastActivity(name, activity);
    let state = '-';
    if (last) {
      const ageMs = now - last.mtimeMs;
      if (ageMs < 5 * 60 * 1000) state = 'work';
      else if (ageMs < 30 * 60 * 1000) state = 'idle';
      else state = '-';
    }
    return {
      name,
      role: name,
      state,
      lastActivity: last
        ? { timestamp: last.timestamp, summary: last.summary }
        : null,
    };
  });

  // --- Pending approvals ---------------------------------------------------
  const pendingApprovals = [];
  const approvalCandidates = [
    { type: 'prd', glob: path.join(artifactsDir, 'planning'), pattern: /^prd.*\.md$/i, phase: 'definition' },
    { type: 'architecture', glob: path.join(artifactsDir, 'design'), pattern: /^architecture.*\.md$/i, phase: 'design' },
  ];
  for (const c of approvalCandidates) {
    let files = [];
    try {
      files = fs.readdirSync(c.glob).filter((f) => c.pattern.test(f));
    } catch {
      files = [];
    }
    for (const f of files) {
      const abs = path.join(c.glob, f);
      const content = safeRead(abs) || '';
      if (!parsers.hasApprovalMarker(content)) {
        pendingApprovals.push({
          artifact: 'artifacts/' + path.relative(artifactsDir, abs).split(path.sep).join('/'),
          type: c.type,
          phase: c.phase,
          reason: 'no Approved-by line',
        });
      }
    }
  }

  return {
    project,
    phases,
    decisions,
    stories,
    reviews,
    agents,
    activity: recentActivity,
    pendingApprovals,
    generatedAt: new Date().toISOString(),
  };
}

function classifyArtifactPath(rel) {
  if (rel.startsWith('context/decision')) return 'decision';
  if (rel.startsWith('planning/')) return 'planning';
  if (rel.startsWith('design/')) return 'design';
  if (rel.startsWith('implementation/stories/')) return 'story';
  if (rel.startsWith('implementation/')) return 'implementation';
  if (rel.startsWith('reviews/')) return 'review';
  if (rel.startsWith('exploration/')) return 'exploration';
  return 'file';
}

function summarizeArtifactPath(rel) {
  const base = path.basename(rel).replace(/\.md$/, '');
  if (rel.startsWith('implementation/stories/')) return `${base} updated`;
  if (rel.startsWith('reviews/')) return `${base} updated`;
  if (rel.startsWith('context/decision')) return 'decision-log updated';
  return `${base} updated`;
}

function guessAgentLastActivity(name, activityList) {
  const role = name.toLowerCase();
  // crude domain mapping
  const wantsPath = (() => {
    if (role.includes('reviewer')) return /^artifacts\/reviews\//;
    if (role.includes('architect')) return /^artifacts\/design\//;
    if (role.includes('strategist')) return /^artifacts\/planning\//;
    if (role.includes('researcher') || role.includes('ideator')) return /^artifacts\/(exploration|planning)\//;
    if (role.includes('story-engineer')) return /^artifacts\/implementation\//;
    if (role.includes('developer')) return /^artifacts\/implementation\/stories\//;
    if (role.includes('orchestrator')) return /^artifacts\/(context|planning)\//;
    return null;
  })();
  if (!wantsPath) return null;
  for (const a of activityList) {
    if (wantsPath.test(a.path)) return a;
  }
  return null;
}

function findProjectRoot(startDir) {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 12; i++) {
    if (
      fs.existsSync(path.join(dir, 'swarm.yaml')) ||
      fs.existsSync(path.join(dir, 'project.yaml'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

module.exports = {
  buildState,
  findProjectRoot,
  classifyArtifactPath,
};
