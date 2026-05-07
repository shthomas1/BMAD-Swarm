// demo-state.cjs — synthetic dataset for `--demo` mode.
//
// Used when the user runs `bmad-console --demo` and there is no real project
// to read from. The shape matches what state.cjs::buildState produces. All
// timestamps are computed at call time so the "since I last looked" digest and
// the replay scrubber both have something interesting to do.
//
// Tuned for visual coverage:
//   - 6 phases (4 done, 1 active, 1 pending) so the ribbon shows every state
//   - 12 decisions (5 strategic, 5 tactical, 2 operational) with cross-refs
//     forming THREE distinct clusters in the network view
//   - 14 stories across 3 tracks with dependencies + a blocked story
//   - 3 reviews (1 approved, 1 mixed, 1 rejected)
//   - 5 agents in mixed work/idle/off states
//   - 30 activity events spread across the last 14 days for the scrubber
//   - 1 pending PRD approval

'use strict';

const DAY = 24 * 60 * 60 * 1000;

function isoDaysAgo(days, hourUtc = 14, minute = 30) {
  const d = new Date(Date.now() - days * DAY);
  d.setUTCHours(hourUtc, minute, 0, 0);
  return d.toISOString();
}

function isoDateDaysAgo(days) {
  return isoDaysAgo(days).slice(0, 10);
}

function buildDemoState() {
  const today = new Date();
  const todayIso = today.toISOString();

  // --- Project meta -------------------------------------------------------
  const project = {
    name: 'Demo Project',
    phase: 'implementation',
    status: 'in-progress',
    autonomy: 'auto',
  };

  // --- Phases (4 done, 1 active, 1 pending) -------------------------------
  const phaseDefs = [
    { id: 'ideation', name: 'Ideation', order: 1, status: 'done' },
    { id: 'exploration', name: 'Exploration', order: 2, status: 'done' },
    { id: 'definition', name: 'Definition', order: 3, status: 'done' },
    { id: 'design', name: 'Design', order: 4, status: 'done' },
    { id: 'implementation', name: 'Implementation', order: 5, status: 'active' },
    { id: 'delivery', name: 'Delivery', order: 6, status: 'pending' },
  ];
  const phases = phaseDefs.map((p) => ({
    id: p.id,
    name: p.name,
    order: p.order,
    status: p.status,
    gate: {
      name: `${p.id}-quality`,
      type: p.id === 'definition' || p.id === 'design' ? 'human-approval' : 'automated',
      criteria_met: null,
    },
    required_artifacts: demoArtifactsFor(p.id),
    agents: demoAgentsFor(p.id),
  }));

  // --- Decisions (12, three clusters) -------------------------------------
  // Cluster A (architecture): D-001, D-002, D-003, D-004
  // Cluster B (data/model):    D-005, D-006, D-007
  // Cluster C (tooling/CI):    D-008, D-009, D-010
  // Orphans:                   D-011, D-012
  const decisions = [
    {
      id: 'D-001',
      title: 'Adopt Postgres + Prisma over hand-rolled SQL',
      classification: 'Strategic',
      date: isoDateDaysAgo(13),
      author: 'architect',
      summary:
        'Use Postgres 16 with Prisma 5 for type-safe data access. Prisma migrations are checked into the repo; no shadow DB in CI.',
      affects: ['D-002', 'D-003', 'architecture.md'],
      supersededBy: null,
      phase: 'design',
      filename: 'artifacts/context/decision-log.md#D-001',
    },
    {
      id: 'D-002',
      title: 'REST API only for v1; defer GraphQL',
      classification: 'Strategic',
      date: isoDateDaysAgo(12),
      author: 'architect',
      summary:
        'A single REST surface with OpenAPI is enough for v1. GraphQL is interesting but adds learning + tooling cost without solving any current pain.',
      affects: ['D-001', 'D-003', 'D-004'],
      supersededBy: null,
      phase: 'design',
      filename: 'artifacts/context/decision-log.md#D-002',
    },
    {
      id: 'D-003',
      title: 'Auth via short-lived JWTs + refresh tokens in HTTP-only cookies',
      classification: 'Strategic',
      date: isoDateDaysAgo(11),
      author: 'security',
      summary:
        '15-minute access tokens, 30-day refresh tokens stored in HTTP-only secure cookies. CSRF mitigated by SameSite=Lax + double-submit on state-changing routes.',
      affects: ['D-001', 'D-002'],
      supersededBy: null,
      phase: 'design',
      filename: 'artifacts/context/decision-log.md#D-003',
    },
    {
      id: 'D-004',
      title: 'Background work via in-process queue, not Redis (for v1)',
      classification: 'Tactical',
      date: isoDateDaysAgo(10),
      author: 'architect',
      summary:
        'A single Postgres-backed queue keeps the deploy footprint to one stateful service. Move to Redis only if we exceed 50 jobs/sec sustained.',
      affects: ['D-002'],
      supersededBy: null,
      phase: 'design',
      filename: 'artifacts/context/decision-log.md#D-004',
    },
    {
      id: 'D-005',
      title: 'Adopt SARIMAX over Prophet for monthly forecasts',
      classification: 'Tactical',
      date: isoDateDaysAgo(9),
      author: 'developer',
      summary:
        'SARIMAX explainability and lower runtime won out. Prophet was strong on holiday handling but our seasonality is quarterly, not weekly.',
      affects: ['D-006', 'D-007'],
      supersededBy: null,
      phase: 'implementation',
      filename: 'artifacts/context/decision-log.md#D-005',
    },
    {
      id: 'D-006',
      title: 'Train models per-tenant, not globally',
      classification: 'Strategic',
      date: isoDateDaysAgo(8),
      author: 'architect',
      summary:
        'Per-tenant models trade some sample-efficiency for explainability. Tenants want to point at their own number when something looks off.',
      affects: ['D-005', 'D-007'],
      supersededBy: null,
      phase: 'implementation',
      filename: 'artifacts/context/decision-log.md#D-006',
    },
    {
      id: 'D-007',
      title: 'Cache forecasts for 24h; recompute nightly at 02:00 UTC',
      classification: 'Tactical',
      date: isoDateDaysAgo(7),
      author: 'developer',
      summary:
        'Forecasts are read-heavy; recomputing on every read is wasteful. Nightly recompute + cache hit on the hot path keeps p99 under 80ms.',
      affects: ['D-005', 'D-006'],
      supersededBy: null,
      phase: 'implementation',
      filename: 'artifacts/context/decision-log.md#D-007',
    },
    {
      id: 'D-008',
      title: 'GitHub Actions over CircleCI for CI',
      classification: 'Tactical',
      date: isoDateDaysAgo(6),
      author: 'devops',
      summary:
        'Lower friction for a small team; matrix builds and reusable workflows cover what we need. We can move later if minute counts bite.',
      affects: ['D-009', 'D-010'],
      supersededBy: null,
      phase: 'implementation',
      filename: 'artifacts/context/decision-log.md#D-008',
    },
    {
      id: 'D-009',
      title: 'Lint, type-check, and test in three parallel jobs',
      classification: 'Operational',
      date: isoDateDaysAgo(5),
      author: 'devops',
      summary:
        'Three jobs running in parallel keeps CI under three minutes wall-clock. Failing fast on lint stops noisy retries on type/test errors.',
      affects: ['D-008', 'D-010'],
      supersededBy: null,
      phase: 'implementation',
      filename: 'artifacts/context/decision-log.md#D-009',
    },
    {
      id: 'D-010',
      title: 'Block merge on red CI; no override',
      classification: 'Operational',
      date: isoDateDaysAgo(4),
      author: 'devops',
      summary:
        'Branch protection requires green CI. The escape hatch (admin override) is intentionally not configured; emergencies go through revert-and-fix.',
      affects: ['D-008', 'D-009'],
      supersededBy: null,
      phase: 'implementation',
      filename: 'artifacts/context/decision-log.md#D-010',
    },
    {
      id: 'D-011',
      title: 'Use Tailwind, not CSS-in-JS',
      classification: 'Tactical',
      date: isoDateDaysAgo(3),
      author: 'frontend',
      summary:
        'Atomic utility classes scale better with our designer-developer handoff than runtime-tagged CSS-in-JS. Smaller bundle, simpler debug.',
      affects: [],
      supersededBy: null,
      phase: 'implementation',
      filename: 'artifacts/context/decision-log.md#D-011',
    },
    {
      id: 'D-012',
      title: 'Stripe for payments; do not build a wallet',
      classification: 'Strategic',
      date: isoDateDaysAgo(2),
      author: 'product',
      summary:
        'Stripe Checkout covers v1 needs. A custom wallet is months of compliance work for no near-term revenue benefit.',
      affects: [],
      supersededBy: null,
      phase: 'implementation',
      filename: 'artifacts/context/decision-log.md#D-012',
    },
  ];

  // --- Stories (14, 3 tracks, deps, 1 blocked) ----------------------------
  // Track A (5): API
  // Track B (5): Models
  // Track C (4): UI
  const stories = [
    // Track A — API
    { id: 'A-API-1', title: 'Scaffold Express + TypeScript app', status: 'complete', track: 'A', filename: 'story-A-API-1.md', acceptanceCriteriaCount: 6, dependencies: [], domain: 'api' },
    { id: 'A-API-2', title: 'Wire Prisma schema + initial migration', status: 'complete', track: 'A', filename: 'story-A-API-2.md', acceptanceCriteriaCount: 5, dependencies: ['A-API-1'], domain: 'api' },
    { id: 'A-API-3', title: 'Auth endpoints: /login /refresh /logout', status: 'in-progress', track: 'A', filename: 'story-A-API-3.md', acceptanceCriteriaCount: 8, dependencies: ['A-API-2'], domain: 'api' },
    { id: 'A-API-4', title: 'Forecasts read API + caching layer', status: 'ready', track: 'A', filename: 'story-A-API-4.md', acceptanceCriteriaCount: 7, dependencies: ['A-API-2', 'B-MODEL-2'], domain: 'api' },
    { id: 'A-API-5', title: 'OpenAPI doc + Swagger UI', status: 'draft', track: 'A', filename: 'story-A-API-5.md', acceptanceCriteriaCount: 4, dependencies: ['A-API-3', 'A-API-4'], domain: 'api' },

    // Track B — Models
    { id: 'B-MODEL-1', title: 'Tenant-scoped data extractor', status: 'complete', track: 'B', filename: 'story-B-MODEL-1.md', acceptanceCriteriaCount: 5, dependencies: [], domain: 'models' },
    { id: 'B-MODEL-2', title: 'SARIMAX trainer + nightly recompute job', status: 'in-progress', track: 'B', filename: 'story-B-MODEL-2.md', acceptanceCriteriaCount: 9, dependencies: ['B-MODEL-1'], domain: 'models' },
    { id: 'B-MODEL-3', title: 'Forecast confidence intervals', status: 'blocked', track: 'B', filename: 'story-B-MODEL-3.md', acceptanceCriteriaCount: 6, dependencies: ['B-MODEL-2'], domain: 'models' },
    { id: 'B-MODEL-4', title: 'Drift detection + retrain trigger', status: 'ready', track: 'B', filename: 'story-B-MODEL-4.md', acceptanceCriteriaCount: 7, dependencies: ['B-MODEL-2'], domain: 'models' },
    { id: 'B-MODEL-5', title: 'Backtest harness for monthly accuracy', status: 'draft', track: 'B', filename: 'story-B-MODEL-5.md', acceptanceCriteriaCount: 5, dependencies: ['B-MODEL-1'], domain: 'models' },

    // Track C — UI
    { id: 'C-UI-1', title: 'App shell + auth-aware routing', status: 'complete', track: 'C', filename: 'story-C-UI-1.md', acceptanceCriteriaCount: 6, dependencies: [], domain: 'ui' },
    { id: 'C-UI-2', title: 'Forecast dashboard page', status: 'in-progress', track: 'C', filename: 'story-C-UI-2.md', acceptanceCriteriaCount: 8, dependencies: ['C-UI-1', 'A-API-4'], domain: 'ui' },
    { id: 'C-UI-3', title: 'Settings + tenant switcher', status: 'ready', track: 'C', filename: 'story-C-UI-3.md', acceptanceCriteriaCount: 5, dependencies: ['C-UI-1'], domain: 'ui' },
    { id: 'C-UI-4', title: 'Onboarding tour', status: 'draft', track: 'C', filename: 'story-C-UI-4.md', acceptanceCriteriaCount: 4, dependencies: ['C-UI-2'], domain: 'ui' },
  ];

  const dependencies = {};
  for (const s of stories) {
    if (s.dependencies && s.dependencies.length) dependencies[s.id] = s.dependencies.slice();
  }

  const sprintPlan = {
    tracks: [
      { letter: 'A', name: 'API', storyCount: 5, stories: stories.filter((s) => s.track === 'A') },
      { letter: 'B', name: 'Models', storyCount: 5, stories: stories.filter((s) => s.track === 'B') },
      { letter: 'C', name: 'UI', storyCount: 4, stories: stories.filter((s) => s.track === 'C') },
    ],
  };

  // --- Reviews (1 approved, 1 mixed, 1 rejected) --------------------------
  const reviews = [
    {
      id: 'review-A-API-1',
      filename: 'review-A-API-1.md',
      date: isoDateDaysAgo(12),
      status: 'approved',
      blockers: 0,
      advisories: 0,
    },
    {
      id: 'review-A-API-2',
      filename: 'review-A-API-2.md',
      date: isoDateDaysAgo(10),
      status: 'mixed',
      blockers: 0,
      advisories: 3,
    },
    {
      id: 'review-B-MODEL-2',
      filename: 'review-B-MODEL-2.md',
      date: isoDateDaysAgo(2),
      status: 'rejected',
      blockers: 2,
      advisories: 1,
    },
  ];

  // --- Agents (5, mixed states) -------------------------------------------
  const agents = [
    {
      name: 'orchestrator',
      role: 'orchestrator',
      state: 'idle',
      lastActivity: { timestamp: isoDaysAgo(0, 11, 12), summary: 'assigned A-API-3' },
    },
    {
      name: 'architect',
      role: 'architect',
      state: 'idle',
      lastActivity: { timestamp: isoDaysAgo(1, 16, 4), summary: 'architecture.md updated' },
    },
    {
      name: 'developer',
      role: 'developer',
      state: 'work',
      lastActivity: { timestamp: isoDaysAgo(0, 13, 41), summary: 'A-API-3 commit' },
    },
    {
      name: 'reviewer',
      role: 'reviewer',
      state: 'work',
      lastActivity: { timestamp: isoDaysAgo(0, 13, 5), summary: 'review-B-MODEL-2 filed' },
    },
    {
      name: 'security',
      role: 'security',
      state: '-',
      lastActivity: null,
    },
  ];

  // --- Activity (30 events spanning ~14 days) -----------------------------
  const activity = [];

  // Decisions logged
  for (const d of decisions) {
    activity.push({
      timestamp: d.date + 'T14:30:00.000Z',
      type: 'decision',
      summary: `${d.id} logged`,
      path: d.filename,
    });
  }
  // Story updates
  const storyEvents = [
    { story: 'A-API-1', daysAgo: 13, summary: 'A-API-1 marked complete' },
    { story: 'A-API-2', daysAgo: 11, summary: 'A-API-2 marked complete' },
    { story: 'A-API-3', daysAgo: 4, summary: 'A-API-3 set in-progress' },
    { story: 'B-MODEL-1', daysAgo: 9, summary: 'B-MODEL-1 marked complete' },
    { story: 'B-MODEL-2', daysAgo: 6, summary: 'B-MODEL-2 set in-progress' },
    { story: 'B-MODEL-3', daysAgo: 2, summary: 'B-MODEL-3 marked blocked' },
    { story: 'C-UI-1', daysAgo: 8, summary: 'C-UI-1 marked complete' },
    { story: 'C-UI-2', daysAgo: 1, summary: 'C-UI-2 set in-progress' },
  ];
  for (const e of storyEvents) {
    activity.push({
      timestamp: isoDaysAgo(e.daysAgo, 11 + (e.daysAgo % 6), 15),
      type: 'story',
      summary: e.summary,
      path: `artifacts/implementation/stories/story-${e.story}.md`,
    });
  }

  // Reviews
  for (const r of reviews) {
    activity.push({
      timestamp: r.date + 'T16:42:00.000Z',
      type: 'review',
      summary: `${r.id} ${(r.status || '').toUpperCase()}`,
      path: `artifacts/reviews/${r.filename}`,
    });
  }

  // Generic file activity
  const fileEvents = [
    { daysAgo: 13, path: 'artifacts/exploration/research-1.md', summary: 'research-1 updated' },
    { daysAgo: 12, path: 'artifacts/planning/prd.md', summary: 'prd updated' },
    { daysAgo: 11, path: 'artifacts/design/architecture.md', summary: 'architecture updated' },
    { daysAgo: 10, path: 'artifacts/design/decisions/adr-001.md', summary: 'adr-001 added' },
    { daysAgo: 9, path: 'artifacts/design/decisions/adr-002.md', summary: 'adr-002 added' },
    { daysAgo: 5, path: 'artifacts/implementation/sprint-plan.md', summary: 'sprint-plan updated' },
    { daysAgo: 0, path: 'artifacts/implementation/stories/story-A-API-3.md', summary: 'A-API-3 commit' },
  ];
  for (const e of fileEvents) {
    activity.push({
      timestamp: isoDaysAgo(e.daysAgo, 9 + (e.daysAgo % 8), (e.daysAgo * 11) % 60),
      type: 'file',
      summary: e.summary,
      path: e.path,
    });
  }

  // Sort newest first, cap at 30
  activity.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const recentActivity = activity.slice(0, 30);

  // --- Pending approvals (1 PRD) ------------------------------------------
  const pendingApprovals = [
    {
      artifact: 'artifacts/planning/prd.md',
      type: 'prd',
      phase: 'definition',
      reason: 'no Approved-by line',
    },
  ];

  return {
    project,
    phases,
    decisions,
    stories,
    reviews,
    agents,
    activity: recentActivity,
    pendingApprovals,
    dependencies,
    sprintPlan,
    demo: true,
    generatedAt: todayIso,
  };
}

function demoArtifactsFor(phaseId) {
  const map = {
    ideation: [{ type: 'brief', path: 'artifacts/exploration/product-brief.md', exists: true }],
    exploration: [{ type: 'research', path: 'artifacts/exploration/research-1.md', exists: true }],
    definition: [{ type: 'prd', path: 'artifacts/planning/prd.md', exists: true }],
    design: [
      { type: 'architecture', path: 'artifacts/design/architecture.md', exists: true },
      { type: 'adr', path: 'artifacts/design/decisions/adr-001.md', exists: true },
    ],
    implementation: [
      { type: 'sprint-plan', path: 'artifacts/implementation/sprint-plan.md', exists: true },
      { type: 'stories', path: 'artifacts/implementation/stories/', exists: true },
    ],
    delivery: [{ type: 'release', path: 'artifacts/delivery/release-notes.md', exists: false }],
  };
  return map[phaseId] || [];
}

function demoAgentsFor(phaseId) {
  const map = {
    ideation: ['ideator'],
    exploration: ['researcher'],
    definition: ['strategist'],
    design: ['architect'],
    implementation: ['developer', 'reviewer'],
    delivery: ['devops'],
  };
  return map[phaseId] || [];
}

module.exports = { buildDemoState };
