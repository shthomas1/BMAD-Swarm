// app.js — vanilla ES module. Renders BMAD Console state.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const STORAGE = {
  lastVisit: 'bmad_last_visit',
  mode: 'bmad_mode',
};

// `state` is the live (or demo) source of truth.
// `viewState` is what gets rendered — equals `state` unless the replay
// scrubber has rewound, in which case it's a filtered projection.
let state = null;
let viewState = null;
let view = 'dashboard';
let prevDecisionIds = new Set();
let prevActivityKeys = new Set();
let focusedPhase = null;

// Replay scrubber state. `playheadMs` of null means "live".
let playheadMs = null;
let timelineMin = 0;
let timelineMax = 0;
let playInterval = null;

// --- Boot ---------------------------------------------------------------

initMode();

fetch('/api/state', { cache: 'no-store' })
  .then((r) => r.json())
  .then((s) => {
    state = s;
    afterInitialState();
  })
  .catch((e) => {
    document.body.innerHTML = `<pre style="padding:32px;font-family:JetBrains Mono">Failed to load /api/state: ${e}</pre>`;
  });

function afterInitialState() {
  const lastVisitTs = parseInt(localStorage.getItem(STORAGE.lastVisit) || '0', 10);
  const now = Date.now();
  const showDigest = !lastVisitTs || now - lastVisitTs > 5 * 60 * 1000;

  prevDecisionIds = new Set(state.decisions.map((d) => d.id));
  prevActivityKeys = new Set(state.activity.map((a) => a.path + a.timestamp));

  recomputeTimelineBounds();
  decorateForDemo();
  viewState = state;
  renderMasthead();
  renderPhaseRibbon();
  renderView();
  renderScrubber();
  bindKeys();
  bindTabs();

  if (showDigest) {
    renderDigest(lastVisitTs, now);
    $('#digest').classList.remove('hidden');
  } else {
    localStorage.setItem(STORAGE.lastVisit, String(now));
  }

  $('#enterConsole').addEventListener('click', () => {
    localStorage.setItem(STORAGE.lastVisit, String(Date.now()));
    $('#digest').classList.add('hidden');
  });

  // Subscribe to SSE
  openEventStream();
}

// --- Mode (paper / inverse) --------------------------------------------

function initMode() {
  const saved = localStorage.getItem(STORAGE.mode);
  if (saved === 'inverse') {
    document.body.classList.remove('paper');
    document.body.classList.add('inverse');
  }
}

function toggleMode() {
  const isInverse = document.body.classList.toggle('inverse');
  document.body.classList.toggle('paper', !isInverse);
  localStorage.setItem(STORAGE.mode, isInverse ? 'inverse' : 'paper');
}

// --- SSE ----------------------------------------------------------------

function openEventStream() {
  let es;
  try {
    es = new EventSource('/api/events');
  } catch (e) {
    return;
  }
  es.addEventListener('state', (ev) => {
    try {
      state = JSON.parse(ev.data);
      decorateForDemo();
      recomputeTimelineBounds();
      viewState = isLive() ? state : projectStateAt(playheadMs);
      renderAll();
    } catch {}
  });
  es.addEventListener('change', () => {
    fetch('/api/state', { cache: 'no-store' })
      .then((r) => r.json())
      .then((s) => {
        const oldDecIds = prevDecisionIds;
        const oldActKeys = prevActivityKeys;
        state = s;
        decorateForDemo();
        recomputeTimelineBounds();
        prevDecisionIds = new Set(state.decisions.map((d) => d.id));
        prevActivityKeys = new Set(state.activity.map((a) => a.path + a.timestamp));
        viewState = isLive() ? state : projectStateAt(playheadMs);
        renderAll(oldDecIds, oldActKeys);
      })
      .catch(() => {});
  });
  es.addEventListener('heartbeat', () => {});
}

// --- Demo decoration ----------------------------------------------------

function decorateForDemo() {
  const isDemo = !!(state && state.demo);
  document.body.classList.toggle('demo', isDemo);
  const t = isDemo ? 'BMAD Console [DEMO]' : 'BMAD Console';
  if (document.title !== t) document.title = t;
}

// --- Masthead -----------------------------------------------------------

function renderMasthead() {
  const proj = (viewState && viewState.project) || {};
  const isDemo = !!(state && state.demo);
  const baseName = (proj.name || 'BMAD-SWARM').toUpperCase();
  $('#projectName').textContent = isDemo ? `${baseName}` : baseName;
  const today = new Date(viewState.generatedAt || Date.now());
  const ds = today.toISOString().slice(0, 10);
  const issue = (viewState.decisions || []).length;
  const datelinePieces = [];
  if (isDemo) datelinePieces.push('DEMO PROJECT');
  else datelinePieces.push('PORTFOLIO 2026');
  datelinePieces.push(`ISSUE Nº ${issue}`);
  datelinePieces.push(ds);
  datelinePieces.push(`AUTONOMY: ${(proj.autonomy || 'auto').toUpperCase()}`);
  if (!isLive()) datelinePieces.push('VIEWING HISTORY');
  const dateline = datelinePieces.join(' · ');
  $('#dateline').textContent = dateline;
  $('#digestDateline').textContent = dateline;
}

// --- Phase ribbon -------------------------------------------------------

function renderPhaseRibbon() {
  const root = $('#phaseRibbon');
  root.innerHTML = '';
  for (const p of viewState.phases || []) {
    const block = document.createElement('div');
    block.className = `phase-block ${p.status}`;
    if (focusedPhase === p.id) block.classList.add('focused');
    block.dataset.phase = p.id;
    const artifactCount = (p.required_artifacts || []).length;
    const present = (p.required_artifacts || []).filter((a) => a.exists).length;
    block.innerHTML = `
      <div class="ph-name">${escapeHtml(p.name)}</div>
      <div class="ph-meta">
        <span>${escapeHtml(p.status)}</span>
        <span>${present}/${artifactCount}</span>
      </div>
    `;
    block.addEventListener('click', () => {
      focusedPhase = focusedPhase === p.id ? null : p.id;
      renderPhaseRibbon();
    });
    root.appendChild(block);
  }
}

// --- Views --------------------------------------------------------------

function renderAll(oldDecIds, oldActKeys) {
  renderMasthead();
  renderPhaseRibbon();
  renderView(oldDecIds, oldActKeys);
  renderScrubber();
}

function renderView(oldDecIds, oldActKeys) {
  const canvas = $('#canvas');
  canvas.innerHTML = '';

  // History banner — only on dashboard, only when scrubber is rewound
  if (view === 'dashboard' && !isLive()) {
    const banner = document.createElement('div');
    banner.className = 'history-banner';
    const at = new Date(playheadMs);
    const ds = at.toISOString().slice(0, 10);
    const hh = String(at.getHours()).padStart(2, '0');
    const mm = String(at.getMinutes()).padStart(2, '0');
    banner.innerHTML = `
      VIEWING HISTORY — <span class="hb-time">${escapeHtml(ds)} ${hh}:${mm}</span>
      · <button class="hb-live" id="hbLive">click "Live" to return</button>
    `;
    canvas.appendChild(banner);
    banner.querySelector('#hbLive').addEventListener('click', goLive);
  }

  if (view === 'dashboard') {
    canvas.appendChild(renderDashboard(oldActKeys));
  } else if (view === 'decisions') {
    canvas.appendChild(renderDecisionsView(oldDecIds));
  } else if (view === 'sprint') {
    canvas.appendChild(renderSprintView());
  } else if (view === 'network') {
    canvas.appendChild(renderNetworkView());
  }

  // Scrubber visibility — only on the dashboard
  $('#scrubberWrap').classList.toggle('hidden', view !== 'dashboard');
}

function bindTabs() {
  for (const btn of $$('.tab')) {
    btn.addEventListener('click', () => {
      setView(btn.dataset.tab);
    });
  }
  $('#modeToggle').addEventListener('click', toggleMode);
}

function bindKeys() {
  document.addEventListener('keydown', (e) => {
    if (e.target && /input|textarea|select/i.test(e.target.tagName || '')) return;
    if (e.key === 'd') { setView('decisions'); }
    else if (e.key === 's') { setView('sprint'); }
    else if (e.key === 'n') { setView('network'); }
    else if (e.key === 'h') { setView('dashboard'); }
    else if (e.key === 'l') { goLive(); }
    else if (e.key === 'r') { fetch('/api/state', { cache: 'no-store' }).then(r => r.json()).then(s => { state = s; decorateForDemo(); recomputeTimelineBounds(); viewState = isLive() ? state : projectStateAt(playheadMs); renderAll(); }); }
    else if (e.key === 't') { toggleMode(); }
    else if (e.key === '?') {
      alert(
        'BMAD Console v0.2\n\nKeys:\n  d  decisions view\n  s  sprint view\n  n  network view\n  h  dashboard\n  r  refresh\n  l  return to live (scrubber)\n  t  paper/inverse\n  ?  this help'
      );
    }
    else if (e.key === 'Escape') {
      $('#digest').classList.add('hidden');
      localStorage.setItem(STORAGE.lastVisit, String(Date.now()));
    }
  });
}

function setView(v) {
  view = v;
  $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === v));
  renderView();
}

// --- Dashboard ----------------------------------------------------------

function renderDashboard(oldActKeys) {
  const wrap = document.createElement('div');
  wrap.className = 'dash-grid';

  // Pane 1: Current Focus + Pending
  const p1 = document.createElement('section');
  p1.className = 'panel';
  const activePhase = (viewState.phases || []).find((p) => p.status === 'active');
  const focusPhase = activePhase || (viewState.phases || []).slice().reverse().find((p) => p.status === 'done') || (viewState.phases || [])[0];
  const producing = focusPhase && focusPhase.required_artifacts && focusPhase.required_artifacts.length
    ? focusPhase.required_artifacts.map((a) => a.path.split('/').pop()).join(', ')
    : '—';
  const gateName = focusPhase && focusPhase.gate ? focusPhase.gate.name : '—';
  const gateType = focusPhase && focusPhase.gate ? focusPhase.gate.type : '—';

  p1.innerHTML = `
    <h2 class="panel-title">Current Focus</h2>
    <div class="panel-rule"></div>
    <div class="focus-line"><span class="label">Phase</span><span class="value">${escapeHtml(focusPhase ? focusPhase.name : '—')}</span></div>
    <div class="focus-line"><span class="label">Producing</span><span class="value">${escapeHtml(producing)}</span></div>
    <div class="focus-line"><span class="label">Gate</span><span class="value">${escapeHtml(gateName)} <em>(${escapeHtml(gateType)})</em></span></div>
    <div class="focus-line"><span class="label">Status</span><span class="value">${escapeHtml(viewState.project ? (viewState.project.status || '—') : '—')}</span></div>

    <div class="panel-sub">Pending</div>
    <div id="pendingList"></div>
  `;
  const pendingList = p1.querySelector('#pendingList');
  if ((viewState.pendingApprovals || []).length === 0) {
    const note = document.createElement('div');
    note.className = 'note';
    note.textContent = '— no approvals pending —';
    pendingList.appendChild(note);
  } else {
    for (const pa of viewState.pendingApprovals) {
      const row = document.createElement('div');
      row.className = 'pending-item';
      row.innerHTML = `<span>${escapeHtml(pa.artifact)}</span><span class="stamp">PENDING APPROVAL</span>`;
      pendingList.appendChild(row);
    }
  }

  // Pane 2: Recent Decisions + Activity
  const p2 = document.createElement('section');
  p2.className = 'panel';
  p2.innerHTML = `
    <h2 class="panel-title">Recent Decisions</h2>
    <div class="panel-rule"></div>
    <div id="recentDecisions"></div>
    <div class="panel-sub">Activity</div>
    <ul class="activity-list" id="activityList"></ul>
  `;
  const recent = (viewState.decisions || []).slice(-5).reverse();
  const recentRoot = p2.querySelector('#recentDecisions');
  for (const d of recent) {
    recentRoot.appendChild(renderCartoucheCompact(d));
  }
  const actList = p2.querySelector('#activityList');
  for (const a of (viewState.activity || []).slice(0, 20)) {
    const li = document.createElement('li');
    const key = a.path + a.timestamp;
    if (oldActKeys && !oldActKeys.has(key)) li.classList.add('fresh');
    li.innerHTML = `
      <span class="a-time">${escapeHtml(formatTime(a.timestamp))}</span>
      <span class="a-type">${escapeHtml(a.type)}</span>
      <span class="a-summary" title="${escapeHtml(a.path)}">${escapeHtml(a.summary)}</span>
    `;
    actList.appendChild(li);
  }

  // Pane 3: Roster
  const p3 = document.createElement('section');
  p3.className = 'panel';
  p3.innerHTML = `
    <h2 class="panel-title">Roster</h2>
    <div class="panel-rule"></div>
    <ul class="roster" id="roster"></ul>
    <div class="panel-sub">Stories</div>
    <div id="storiesMini" class="focus-line"></div>
  `;
  const rosterRoot = p3.querySelector('#roster');
  for (const ag of viewState.agents || []) {
    const li = document.createElement('li');
    const dotClass = ag.state === 'work' ? 'work' : ag.state === 'idle' ? 'idle' : 'off';
    const last = ag.lastActivity ? `last: ${ag.lastActivity.summary}` : '';
    const nameClass = ag.state === '-' ? 'name dim' : 'name';
    li.innerHTML = `
      <span class="dot ${dotClass}"></span>
      <span class="${nameClass}">${escapeHtml(ag.name)}</span>
      <span class="last">${escapeHtml(last)}</span>
    `;
    rosterRoot.appendChild(li);
  }
  // stories mini-summary
  const stCounts = countStoryStatuses(viewState.stories || []);
  const sm = p3.querySelector('#storiesMini');
  sm.innerHTML = `
    <div><span class="label">Total</span><span class="value">${stCounts.total}</span></div>
    <div><span class="label">Complete</span><span class="value" style="color:var(--phosphor)">${stCounts.complete}</span></div>
    <div><span class="label">In Progress</span><span class="value">${stCounts['in-progress']}</span></div>
    <div><span class="label">Blocked</span><span class="value" style="color:var(--vermillion)">${stCounts.blocked || 0}</span></div>
  `;

  wrap.appendChild(p1);
  wrap.appendChild(p2);
  wrap.appendChild(p3);
  return wrap;
}

function countStoryStatuses(stories) {
  const c = { total: stories.length, complete: 0, 'in-progress': 0, ready: 0, draft: 0, review: 0, blocked: 0, unknown: 0 };
  for (const s of stories) {
    if (c[s.status] === undefined) c[s.status] = 0;
    c[s.status]++;
  }
  return c;
}

// --- Decisions view -----------------------------------------------------

function renderDecisionsView(oldDecIds) {
  const wrap = document.createElement('div');

  const decisions = viewState.decisions || [];
  const declared = decisions.length;
  const referenced = decisions.filter((d) => (d.affects || []).length > 0).length;
  const orphan = 0; // v0.2
  const dangling = 0; // v0.2

  const header = document.createElement('div');
  header.className = 'dec-header';
  header.textContent = `DECISIONS · ${declared} DECLARED · ${referenced} REFERENCED · ${orphan} ORPHAN · ${dangling} DANGLING`;
  wrap.appendChild(header);

  const filters = document.createElement('div');
  filters.className = 'dec-filters';
  filters.innerHTML = `
    <select id="filterClassification">
      <option value="">all classifications</option>
      <option value="Strategic">strategic</option>
      <option value="Tactical">tactical</option>
      <option value="Operational">operational</option>
    </select>
    <select id="filterPhase">
      <option value="">all phases</option>
      ${(viewState.phases || []).map((p) => `<option value="${p.id}">${escapeHtml(p.id)}</option>`).join('')}
    </select>
    <input id="filterText" type="text" placeholder="search..." />
  `;
  wrap.appendChild(filters);

  const grid = document.createElement('div');
  grid.className = 'dec-grid';
  wrap.appendChild(grid);

  function applyFilters() {
    const cls = $('#filterClassification', wrap).value;
    const ph = $('#filterPhase', wrap).value;
    const tx = ($('#filterText', wrap).value || '').toLowerCase();
    grid.innerHTML = '';
    const sorted = decisions.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    for (const d of sorted) {
      if (cls && d.classification !== cls) continue;
      if (ph && d.phase !== ph) continue;
      if (tx) {
        const hay = (d.id + ' ' + (d.title || '') + ' ' + (d.summary || '')).toLowerCase();
        if (!hay.includes(tx)) continue;
      }
      const card = renderCartoucheFull(d);
      if (oldDecIds && !oldDecIds.has(d.id)) card.classList.add('fresh');
      grid.appendChild(card);
    }
  }
  applyFilters();
  for (const id of ['#filterClassification', '#filterPhase', '#filterText']) {
    const el = $(id, wrap);
    el.addEventListener('input', applyFilters);
    el.addEventListener('change', applyFilters);
  }

  return wrap;
}

// --- Sprint view --------------------------------------------------------

// Card geometry — kept in JS so the SVG arrows can compute attachment points
// without doing CSS math at runtime.
const SPRINT = {
  cardW: 180,
  cardH: 64,
  laneH: 96,
  laneLabelW: 130,
  cardGapX: 28,
  laneGapY: 18,
  paddingTop: 56, // space for header summary
  paddingLeft: 16,
};

function renderSprintView() {
  const wrap = document.createElement('div');
  wrap.className = 'sprint-view';

  const stories = (viewState.stories || []).slice();
  const dependencies = viewState.dependencies || {};

  if (stories.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'sprint-empty';
    empty.textContent = 'No sprint data — run /bmad-tools:scaffold-ui-story or check artifacts/implementation/stories/';
    wrap.appendChild(empty);
    return wrap;
  }

  // Build summary from current viewState
  const counts = countStoryStatuses(stories);
  const sprintNum = inferSprintNumber();
  const blocked = (counts.blocked || 0) + (stories.filter((s) => isBlocked(s, dependencies, stories)).length);
  // Avoid double-count: re-derive from a single source.
  const blockedSet = new Set();
  for (const s of stories) {
    if (s.status === 'blocked') blockedSet.add(s.id);
    else if (isBlocked(s, dependencies, stories)) blockedSet.add(s.id);
  }
  const blockedCount = blockedSet.size;
  const inProgress = counts['in-progress'] || 0;
  const complete = counts.complete || 0;
  const total = counts.total || stories.length;

  const summary = document.createElement('div');
  summary.className = 'sprint-summary';
  summary.textContent = `SPRINT ${sprintNum} · ${complete}/${total} stories complete · ${inProgress} in progress · ${blockedCount} blocked`;
  wrap.appendChild(summary);

  // Group by track
  const tracks = bucketStoriesByTrack(stories);
  const trackOrder = ['A', 'B', 'C'];
  const presentTracks = trackOrder.filter((t) => tracks[t] && tracks[t].length);
  const hasCross = (tracks['_'] || []).length > 0;
  const lanes = presentTracks.map((t) => ({ key: t, label: `TRACK ${t}`, stories: tracks[t] }));
  if (hasCross) lanes.push({ key: '_', label: 'CROSS-CUTTING', stories: tracks['_'] });

  // Compute layout: each story gets an x, y anchored on the lane.
  // Sort within a lane by id ordering preserved from the input.
  const positions = {};
  let maxX = 0;
  for (let li = 0; li < lanes.length; li++) {
    const lane = lanes[li];
    for (let i = 0; i < lane.stories.length; i++) {
      const s = lane.stories[i];
      const x = SPRINT.paddingLeft + SPRINT.laneLabelW + i * (SPRINT.cardW + SPRINT.cardGapX);
      const y = SPRINT.paddingTop + li * SPRINT.laneH;
      positions[s.id] = { x, y, w: SPRINT.cardW, h: SPRINT.cardH };
      if (x + SPRINT.cardW > maxX) maxX = x + SPRINT.cardW;
    }
  }
  const totalW = maxX + 32;
  const totalH = SPRINT.paddingTop + lanes.length * SPRINT.laneH + 16;

  const stage = document.createElement('div');
  stage.className = 'sprint-stage';
  stage.style.width = totalW + 'px';
  stage.style.height = totalH + 'px';
  wrap.appendChild(stage);

  // SVG underneath the cards for dependency arrows
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'sprint-arrows');
  svg.setAttribute('width', String(totalW));
  svg.setAttribute('height', String(totalH));
  svg.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`);
  stage.appendChild(svg);

  // Arrowhead defs — three colors keyed off resolved status
  const defs = document.createElementNS(svgNS, 'defs');
  for (const [id, color] of [
    ['arrow-rule', 'var(--rule)'],
    ['arrow-amber', 'var(--amber)'],
    ['arrow-vermillion', 'var(--vermillion)'],
  ]) {
    const marker = document.createElementNS(svgNS, 'marker');
    marker.setAttribute('id', id);
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '7');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('orient', 'auto-start-reverse');
    marker.setAttribute('markerUnits', 'userSpaceOnUse');
    const tri = document.createElementNS(svgNS, 'path');
    tri.setAttribute('d', 'M0 0 L10 5 L0 10 z');
    tri.setAttribute('fill', color);
    marker.appendChild(tri);
    defs.appendChild(marker);
  }
  svg.appendChild(defs);

  // Lane rules + labels (drawn on the SVG so they share the canvas)
  for (let li = 0; li < lanes.length; li++) {
    const lane = lanes[li];
    const yBase = SPRINT.paddingTop + li * SPRINT.laneH;
    const labelY = yBase + SPRINT.cardH / 2 + 5;
    const label = document.createElementNS(svgNS, 'text');
    label.setAttribute('class', 'lane-label');
    label.setAttribute('x', String(SPRINT.paddingLeft));
    label.setAttribute('y', String(labelY));
    label.textContent = lane.label;
    svg.appendChild(label);

    const baseline = document.createElementNS(svgNS, 'line');
    baseline.setAttribute('class', 'lane-rule');
    baseline.setAttribute('x1', String(SPRINT.paddingLeft + SPRINT.laneLabelW - 8));
    baseline.setAttribute('x2', String(totalW - 16));
    baseline.setAttribute('y1', String(yBase + SPRINT.cardH + 12));
    baseline.setAttribute('y2', String(yBase + SPRINT.cardH + 12));
    svg.appendChild(baseline);
  }

  // Dependency curves — drawn before cards so cards overlap their endings
  const storyById = new Map(stories.map((s) => [s.id, s]));
  for (const [dst, srcs] of Object.entries(dependencies)) {
    if (!positions[dst]) continue;
    for (const src of srcs) {
      if (!positions[src]) continue;
      const a = positions[src];
      const b = positions[dst];
      const x1 = a.x + a.w;
      const y1 = a.y + a.h / 2;
      const x2 = b.x;
      const y2 = b.y + b.h / 2;
      const dx = Math.max(40, (x2 - x1) / 2);
      const path = document.createElementNS(svgNS, 'path');
      const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      path.setAttribute('d', d);
      // Color edge by predecessor status
      const predStory = storyById.get(src);
      let color = 'rule';
      if (predStory) {
        if (predStory.status === 'blocked') color = 'vermillion';
        else if (predStory.status !== 'complete') color = 'amber';
      }
      path.setAttribute('class', `dep-arrow dep-${color}`);
      path.setAttribute('marker-end', `url(#arrow-${color})`);
      svg.appendChild(path);
    }
  }

  // Cards (HTML overlay)
  for (const s of stories) {
    const pos = positions[s.id];
    if (!pos) continue;
    const card = document.createElement('div');
    card.className = `story-card status-${s.status || 'unknown'}`;
    card.style.left = pos.x + 'px';
    card.style.top = pos.y + 'px';
    card.style.width = pos.w + 'px';
    card.style.height = pos.h + 'px';
    card.dataset.story = s.id;
    if (isBlocked(s, dependencies, stories)) card.classList.add('blocked-by-dep');
    const dot = statusGlyph(s);
    card.innerHTML = `
      <div class="story-card-head">
        <span class="story-id">${escapeHtml(s.id)}</span>
        <span class="story-status">${dot}</span>
      </div>
      <div class="story-title" title="${escapeHtml(s.title || '')}">${escapeHtml(s.title || '')}</div>
    `;
    stage.appendChild(card);
  }

  return wrap;
}

function bucketStoriesByTrack(stories) {
  const out = { A: [], B: [], C: [], _: [] };
  for (const s of stories) {
    const t = s.track && /^[A-Z]$/.test(s.track) ? s.track : '_';
    if (!out[t]) out[t] = [];
    out[t].push(s);
  }
  return out;
}

function isBlocked(story, dependencies, allStories) {
  if (story.status === 'blocked') return true;
  const deps = (dependencies && dependencies[story.id]) || [];
  if (!deps.length) return false;
  const byId = new Map(allStories.map((s) => [s.id, s]));
  for (const d of deps) {
    const pred = byId.get(d);
    if (!pred) continue;
    if (pred.status === 'blocked') return true;
  }
  return false;
}

function inferSprintNumber() {
  // Plain heuristic: number of distinct tracks present, plus 1 if all complete.
  const stories = viewState.stories || [];
  const tracks = new Set();
  for (const s of stories) if (s.track) tracks.add(s.track);
  return Math.max(1, tracks.size);
}

function statusGlyph(s) {
  switch (s.status) {
    case 'complete': return '<span class="glyph done">✓</span>';
    case 'in-progress': return '<span class="glyph live"></span>';
    case 'blocked': return '<span class="glyph blocked">⚠</span>';
    case 'review': return '<span class="glyph review">◑</span>';
    default: return '<span class="glyph pending">◯</span>';
  }
}

// --- Network view -------------------------------------------------------

const NET = {
  size: 600,
  nodeW: 28,
  nodeH: 28,
  iterations: 100,
  k: 0.04, // attractive spring
  rep: 1500, // repulsion strength
  damping: 0.62,
  centerPull: 0.012,
};

function renderNetworkView() {
  const wrap = document.createElement('div');
  wrap.className = 'network-view';

  const decisions = (viewState.decisions || []).slice();
  if (decisions.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'sprint-empty';
    empty.textContent = 'No decisions logged yet — write the first D-ID record in artifacts/context/decision-log.md.';
    wrap.appendChild(empty);
    return wrap;
  }

  // Build adjacency: edges are pairs of D-IDs that reference each other.
  const idSet = new Set(decisions.map((d) => d.id));
  const edgeSet = new Set();
  for (const d of decisions) {
    for (const ref of d.affects || []) {
      if (idSet.has(ref) && ref !== d.id) {
        const key = d.id < ref ? `${d.id}|${ref}` : `${ref}|${d.id}`;
        edgeSet.add(key);
      }
    }
  }
  const edges = [...edgeSet].map((k) => k.split('|'));

  // Run the deterministic layout
  const layout = forceLayout(decisions, edges);

  // SVG container
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'network-svg');
  svg.setAttribute('viewBox', `0 0 ${NET.size} ${NET.size}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  wrap.appendChild(svg);

  // Edges (drawn first so nodes sit on top)
  const edgeGroup = document.createElementNS(svgNS, 'g');
  edgeGroup.setAttribute('class', 'network-edges');
  svg.appendChild(edgeGroup);
  const edgeEls = new Map();
  for (const [a, b] of edges) {
    const pa = layout[a];
    const pb = layout[b];
    if (!pa || !pb) continue;
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', String(pa.x));
    line.setAttribute('y1', String(pa.y));
    line.setAttribute('x2', String(pb.x));
    line.setAttribute('y2', String(pb.y));
    line.setAttribute('class', 'network-edge');
    line.dataset.a = a;
    line.dataset.b = b;
    edgeGroup.appendChild(line);
    edgeEls.set(`${a}|${b}`, line);
    edgeEls.set(`${b}|${a}`, line);
  }

  // Nodes
  const nodeGroup = document.createElementNS(svgNS, 'g');
  nodeGroup.setAttribute('class', 'network-nodes');
  svg.appendChild(nodeGroup);
  const decisionById = new Map(decisions.map((d) => [d.id, d]));
  const nodeEls = new Map();
  const adjacency = new Map();
  for (const id of idSet) adjacency.set(id, new Set());
  for (const [a, b] of edges) {
    adjacency.get(a).add(b);
    adjacency.get(b).add(a);
  }

  for (const d of decisions) {
    const p = layout[d.id];
    if (!p) continue;
    const cls = (d.classification || 'tactical').toLowerCase();
    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('class', `network-node node-${cls}`);
    g.setAttribute('transform', `translate(${p.x - NET.nodeW / 2}, ${p.y - NET.nodeH / 2})`);
    g.dataset.decision = d.id;
    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('width', String(NET.nodeW));
    rect.setAttribute('height', String(NET.nodeH));
    rect.setAttribute('class', 'network-node-rect');
    g.appendChild(rect);
    const label = document.createElementNS(svgNS, 'text');
    label.setAttribute('x', String(NET.nodeW / 2));
    label.setAttribute('y', String(NET.nodeH / 2 + 4));
    label.setAttribute('class', 'network-node-label');
    label.textContent = d.id.replace(/^D-/, '');
    g.appendChild(label);
    nodeGroup.appendChild(g);
    nodeEls.set(d.id, g);
  }

  // Cartouche slot underneath
  const slot = document.createElement('div');
  slot.className = 'network-detail';
  slot.id = 'networkDetail';
  wrap.appendChild(slot);

  // Legend (paper card, bottom-right)
  const legend = document.createElement('div');
  legend.className = 'network-legend';
  legend.innerHTML = `
    <div class="lg-row"><span class="lg-square strategic"></span> Strategic</div>
    <div class="lg-row"><span class="lg-square tactical"></span> Tactical</div>
    <div class="lg-row"><span class="lg-square operational"></span> Operational</div>
    <div class="lg-row lg-edge"><span class="lg-line"></span> reference</div>
  `;
  wrap.appendChild(legend);

  // Interaction
  let active = null;
  function setHover(id, on) {
    if (!id) return;
    const el = nodeEls.get(id);
    if (el) el.classList.toggle('hover', on);
    for (const other of adjacency.get(id) || []) {
      const otherEl = nodeEls.get(other);
      if (otherEl) otherEl.classList.toggle('hover-neighbor', on);
      const eline = edgeEls.get(`${id}|${other}`);
      if (eline) eline.classList.toggle('hover', on);
    }
  }
  function setActive(id) {
    if (active && active !== id) {
      const prev = nodeEls.get(active);
      if (prev) prev.classList.remove('active');
    }
    if (active === id) {
      const cur = nodeEls.get(id);
      if (cur) cur.classList.remove('active');
      active = null;
      slot.innerHTML = '';
      return;
    }
    active = id;
    const cur = nodeEls.get(id);
    if (cur) cur.classList.add('active');
    const d = decisionById.get(id);
    slot.innerHTML = '';
    if (d) {
      const card = renderCartoucheFull(d);
      slot.appendChild(card);
    }
  }
  for (const [id, el] of nodeEls) {
    el.addEventListener('mouseenter', () => setHover(id, true));
    el.addEventListener('mouseleave', () => setHover(id, false));
    el.addEventListener('click', (e) => { e.stopPropagation(); setActive(id); });
  }
  // Escape collapses
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && active) setActive(active);
  });

  return wrap;
}

// Deterministic, dep-free Verlet-style force layout.
// Determinism: each node's seed is its index in the input; that drives the
// initial radial position. A fixed iteration cap (`NET.iterations`) means the
// final positions are reproducible from the input alone.
function forceLayout(nodes, edges) {
  const N = nodes.length;
  const cx = NET.size / 2;
  const cy = NET.size / 2;
  const radius = Math.min(NET.size, NET.size) * 0.32;

  // Seed positions on a circle — index drives the angle so nothing is random.
  const pos = {};
  const vel = {};
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = radius * (0.6 + 0.4 * (((i * 7) % 11) / 11)); // mild jitter, deterministic
    pos[nodes[i].id] = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
    vel[nodes[i].id] = { x: 0, y: 0 };
  }

  // Build adjacency for the spring step
  const adj = new Map();
  for (const n of nodes) adj.set(n.id, []);
  for (const [a, b] of edges) {
    if (adj.has(a)) adj.get(a).push(b);
    if (adj.has(b)) adj.get(b).push(a);
  }

  const minDist = NET.nodeW * 1.6;
  const targetEdgeLen = 110;

  for (let step = 0; step < NET.iterations; step++) {
    // 1) repulsion (every pair)
    for (let i = 0; i < N; i++) {
      const a = nodes[i].id;
      const pa = pos[a];
      let fx = 0;
      let fy = 0;
      for (let j = 0; j < N; j++) {
        if (i === j) continue;
        const pb = pos[nodes[j].id];
        const dx = pa.x - pb.x;
        const dy = pa.y - pb.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) d2 = 1;
        const f = NET.rep / d2;
        const d = Math.sqrt(d2);
        fx += (dx / d) * f;
        fy += (dy / d) * f;
      }
      // 2) attractive springs along edges
      for (const other of adj.get(a)) {
        const pb = pos[other];
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const stretch = d - targetEdgeLen;
        fx += dx * NET.k * (stretch / d);
        fy += dy * NET.k * (stretch / d);
      }
      // 3) gentle pull to centre (keeps disconnected nodes from drifting off canvas)
      fx += (cx - pa.x) * NET.centerPull;
      fy += (cy - pa.y) * NET.centerPull;

      const v = vel[a];
      v.x = (v.x + fx) * NET.damping;
      v.y = (v.y + fy) * NET.damping;
    }
    // 4) integrate, with hard collision against canvas + minDist
    for (let i = 0; i < N; i++) {
      const id = nodes[i].id;
      const p = pos[id];
      const v = vel[id];
      p.x += v.x;
      p.y += v.y;
      // Clamp to canvas with margin so labels don't clip
      const margin = NET.nodeW;
      if (p.x < margin) p.x = margin;
      if (p.x > NET.size - margin) p.x = NET.size - margin;
      if (p.y < margin) p.y = margin;
      if (p.y > NET.size - margin) p.y = NET.size - margin;
    }
    // 5) min-distance separation
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const pa = pos[nodes[i].id];
        const pb = pos[nodes[j].id];
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (d < minDist) {
          const push = (minDist - d) / 2;
          const ux = dx / d;
          const uy = dy / d;
          pa.x -= ux * push;
          pa.y -= uy * push;
          pb.x += ux * push;
          pb.y += uy * push;
        }
      }
    }
  }

  return pos;
}

// --- Cartouche components ----------------------------------------------

function renderCartoucheCompact(d) {
  const el = document.createElement('div');
  el.className = 'cartouche';
  const cls = (d.classification || 'tactical').toLowerCase();
  el.innerHTML = `
    <div class="cartouche-head">
      <span class="stamp-id">${escapeHtml(d.id)}</span>
      <span class="badge ${cls}">${escapeHtml((d.classification || '').toUpperCase())}</span>
    </div>
    <h3 class="cartouche-title">${escapeHtml(d.title || d.id)}</h3>
    <div class="cartouche-meta">${escapeHtml(d.date || '')} · ${escapeHtml(d.author || '—')}</div>
  `;
  return el;
}

function renderCartoucheFull(d) {
  const el = document.createElement('div');
  el.className = 'cartouche';
  const cls = (d.classification || 'tactical').toLowerCase();
  const affects = (d.affects || []).slice(0, 3).map(escapeHtml).join(', ') || '—';
  el.innerHTML = `
    <div class="cartouche-head">
      <span class="stamp-id">${escapeHtml(d.id)}</span>
      <span class="badge ${cls}">${escapeHtml((d.classification || '').toUpperCase())}</span>
    </div>
    <h3 class="cartouche-title">${escapeHtml(d.title || d.id)}</h3>
    <div class="cartouche-meta">${escapeHtml(d.date || '')} · ${escapeHtml(d.author || '—')}</div>
    <div class="cartouche-body">${escapeHtml(truncate(d.summary || '', 240))}</div>
    <div class="cartouche-foot">Affects: ${affects}${(d.affects || []).length > 3 ? ' ⋯' : ''}</div>
  `;
  return el;
}

// --- Replay scrubber ----------------------------------------------------

function recomputeTimelineBounds() {
  const events = collectTimedEvents(state);
  if (events.length === 0) {
    timelineMin = Date.now() - 14 * 24 * 60 * 60 * 1000;
    timelineMax = Date.now();
    return;
  }
  let min = Infinity;
  let max = -Infinity;
  for (const e of events) {
    if (e.t < min) min = e.t;
    if (e.t > max) max = e.t;
  }
  // Pad both ends slightly so end-stops aren't cramped
  const pad = Math.max(60 * 60 * 1000, (max - min) * 0.04);
  timelineMin = min - pad;
  timelineMax = Math.max(max + pad, Date.now());
}

function collectTimedEvents(s) {
  if (!s) return [];
  const events = [];
  for (const d of s.decisions || []) {
    const t = d.date ? Date.parse(d.date + 'T12:00:00Z') : NaN;
    if (!isNaN(t)) events.push({ t, type: 'decision' });
  }
  for (const a of s.activity || []) {
    const t = Date.parse(a.timestamp);
    if (!isNaN(t)) events.push({ t, type: a.type });
  }
  for (const r of s.reviews || []) {
    const t = r.date ? Date.parse(r.date + 'T12:00:00Z') : NaN;
    if (!isNaN(t)) events.push({ t, type: 'review' });
  }
  return events;
}

function isLive() {
  return playheadMs === null;
}

function goLive() {
  playheadMs = null;
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
  }
  viewState = state;
  renderAll();
}

function setPlayhead(t, opts = {}) {
  if (timelineMax > 0 && t >= timelineMax - 1000) {
    if (opts.fromPlay) {
      // Snap to live when play reaches the end
      goLive();
      return;
    }
    playheadMs = null;
  } else {
    playheadMs = t;
  }
  viewState = isLive() ? state : projectStateAt(playheadMs);
  renderAll();
}

// Reconstruct what the dashboard looked like at time `t` by filtering the
// canonical state. Items lacking a parseable timestamp are kept (they're
// considered "always present", e.g. phase definitions).
function projectStateAt(t) {
  if (!state) return state;
  const decisions = (state.decisions || []).filter((d) => {
    const dt = d.date ? Date.parse(d.date + 'T12:00:00Z') : NaN;
    return isNaN(dt) || dt <= t;
  });
  const stories = (state.stories || []).map((s) => {
    // No per-status timestamps on stories — treat them as static drafts in
    // history, then carry status forward unchanged. Best-effort heuristic:
    // map stories to their first activity timestamp; if that is in the
    // future, drop them entirely.
    const firstActivity = (state.activity || [])
      .filter((a) => a.path && a.path.endsWith(`story-${s.id}.md`))
      .map((a) => Date.parse(a.timestamp))
      .filter((x) => !isNaN(x))
      .sort((a, b) => a - b)[0];
    if (firstActivity != null && firstActivity > t) return null;
    return s;
  }).filter(Boolean);
  const reviews = (state.reviews || []).filter((r) => {
    const dt = r.date ? Date.parse(r.date + 'T12:00:00Z') : NaN;
    return isNaN(dt) || dt <= t;
  });
  const activity = (state.activity || []).filter((a) => {
    const dt = Date.parse(a.timestamp);
    return isNaN(dt) || dt <= t;
  });
  return Object.assign({}, state, {
    decisions,
    stories,
    reviews,
    activity,
  });
}

function renderScrubber() {
  const root = $('#scrubberWrap');
  if (!root) return;
  if (!state) return;

  // Build content
  const events = collectTimedEvents(state);
  const range = Math.max(1, timelineMax - timelineMin);
  const now = Date.now();
  const phHead = playheadMs == null ? Math.min(timelineMax, now) : playheadMs;
  const headPct = clamp01((phHead - timelineMin) / range) * 100;

  root.innerHTML = `
    <div class="scrubber" id="scrubber">
      <button class="sc-btn sc-play" id="scPlay" title="play / pause replay">▶</button>
      <div class="sc-track" id="scTrack">
        <div class="sc-stripe" id="scStripe"></div>
        <div class="sc-playhead" id="scPlayhead" style="left:${headPct}%"></div>
      </div>
      <button class="sc-btn sc-live ${isLive() ? 'on' : ''}" id="scLive" title="snap to present">LIVE</button>
    </div>
  `;

  const stripe = root.querySelector('#scStripe');
  // Render each event as a 2px tick. Newer events have higher opacity.
  for (const e of events) {
    const tick = document.createElement('span');
    tick.className = `sc-tick sc-tick-${e.type}`;
    const pct = clamp01((e.t - timelineMin) / range) * 100;
    tick.style.left = `calc(${pct}% - 1px)`;
    const ageDays = Math.max(0, (now - e.t) / (24 * 60 * 60 * 1000));
    const op = Math.max(0.35, 1 - ageDays / 18);
    tick.style.opacity = String(op);
    stripe.appendChild(tick);
  }

  // Drag handling
  const track = root.querySelector('#scTrack');
  const playhead = root.querySelector('#scPlayhead');
  let dragging = false;
  function onMove(ev) {
    if (!dragging) return;
    const rect = track.getBoundingClientRect();
    const x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left;
    const frac = clamp01(x / rect.width);
    const t = timelineMin + frac * range;
    playhead.style.left = (frac * 100) + '%';
    setPlayhead(t);
  }
  function onUp() {
    dragging = false;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onUp);
  }
  function onDown(ev) {
    dragging = true;
    onMove(ev);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onUp);
  }
  track.addEventListener('mousedown', onDown);
  track.addEventListener('touchstart', onDown, { passive: true });

  // Live button
  root.querySelector('#scLive').addEventListener('click', goLive);

  // Play / pause
  const playBtn = root.querySelector('#scPlay');
  playBtn.textContent = playInterval ? '❚❚' : '▶';
  playBtn.addEventListener('click', () => {
    if (playInterval) {
      clearInterval(playInterval);
      playInterval = null;
      playBtn.textContent = '▶';
      return;
    }
    // 5s sweep from current to present
    const startT = playheadMs == null ? timelineMin : playheadMs;
    const endT = timelineMax;
    const startedAt = performance.now();
    const durMs = 5000;
    playBtn.textContent = '❚❚';
    playInterval = setInterval(() => {
      const elapsed = performance.now() - startedAt;
      const frac = clamp01(elapsed / durMs);
      const t = startT + (endT - startT) * frac;
      setPlayhead(t, { fromPlay: true });
      if (frac >= 1) {
        clearInterval(playInterval);
        playInterval = null;
        playBtn.textContent = '▶';
      }
    }, 80);
  });
}

function clamp01(x) {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

// --- Digest -------------------------------------------------------------

function renderDigest(lastVisitTs, now) {
  const sinceMs = lastVisitTs ? now - lastVisitTs : 0;
  $('#digestGap').textContent = lastVisitTs ? formatGap(sinceMs) : 'first visit';

  const cutoff = lastVisitTs || 0;
  const newDecisions = (state.decisions || []).filter((d) => {
    const t = d.date ? Date.parse(d.date) : 0;
    return t && t >= cutoff;
  });
  const newReviews = (state.reviews || []).filter((r) => {
    const t = r.date ? Date.parse(r.date) : 0;
    return t && t >= cutoff;
  });
  const newStories = (state.stories || []).filter((s) => s.status === 'complete');
  const recentActivity = (state.activity || []).filter((a) => Date.parse(a.timestamp) >= cutoff);

  const list = $('#digestList');
  list.innerHTML = '';

  function row(count, label, ids) {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="count">${count}</span>
      <div>
        <span class="label">${escapeHtml(label)}</span>
        ${ids ? `<span class="ids">${escapeHtml(ids)}</span>` : ''}
      </div>
    `;
    list.appendChild(li);
  }

  row(newDecisions.length, newDecisions.length === 1 ? 'decision logged' : 'decisions logged', newDecisions.map((d) => d.id).join(' '));
  row(newStories.length, 'stories complete (cumulative)', newStories.slice(0, 6).map((s) => s.id).join(' '));
  row(newReviews.length, newReviews.length === 1 ? 'review filed' : 'reviews filed', newReviews.map((r) => `${r.id} (${(r.status || '').toUpperCase()})`).join(' '));
  row(recentActivity.length, 'artifact changes', '');

  const pendingRoot = $('#digestPending');
  pendingRoot.innerHTML = '';
  if ((state.pendingApprovals || []).length === 0) {
    const li = document.createElement('li');
    li.textContent = 'nothing waiting on you';
    li.style.color = 'var(--ink-muted)';
    pendingRoot.appendChild(li);
  } else {
    for (const pa of state.pendingApprovals) {
      const li = document.createElement('li');
      li.textContent = `${pa.artifact.split('/').pop()} awaits ${pa.type} approval`;
      pendingRoot.appendChild(li);
    }
  }
}

// --- Helpers ------------------------------------------------------------

function formatGap(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m - h * 60;
  if (h < 24) return `${h}h ${rem}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
  if (sameDay) {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  const ageDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  if (ageDays < 30) return `${ageDays}d`;
  return d.toISOString().slice(5, 10);
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(s, n) {
  if (!s) return '';
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}
