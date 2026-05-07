// app.js — vanilla ES module. Renders BMAD Console state.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const STORAGE = {
  lastVisit: 'bmad_last_visit',
  mode: 'bmad_mode',
};

let state = null;
let view = 'dashboard';
let prevDecisionIds = new Set();
let prevActivityKeys = new Set();
let focusedPhase = null;

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

  renderMasthead();
  renderPhaseRibbon();
  renderView();
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
        prevDecisionIds = new Set(state.decisions.map((d) => d.id));
        prevActivityKeys = new Set(state.activity.map((a) => a.path + a.timestamp));
        renderAll(oldDecIds, oldActKeys);
      })
      .catch(() => {});
  });
  es.addEventListener('heartbeat', () => {});
}

// --- Masthead -----------------------------------------------------------

function renderMasthead() {
  const proj = state.project || {};
  $('#projectName').textContent = (proj.name || 'BMAD-SWARM').toUpperCase();
  const today = new Date(state.generatedAt || Date.now());
  const ds = today.toISOString().slice(0, 10);
  const issue = (state.decisions || []).length;
  const dateline = `PORTFOLIO 2026 · ISSUE Nº ${issue} · ${ds} · AUTONOMY: ${(proj.autonomy || 'auto').toUpperCase()}`;
  $('#dateline').textContent = dateline;
  $('#digestDateline').textContent = dateline;
}

// --- Phase ribbon -------------------------------------------------------

function renderPhaseRibbon() {
  const root = $('#phaseRibbon');
  root.innerHTML = '';
  for (const p of state.phases || []) {
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
}

function renderView(oldDecIds, oldActKeys) {
  const canvas = $('#canvas');
  canvas.innerHTML = '';
  if (view === 'dashboard') {
    canvas.appendChild(renderDashboard(oldActKeys));
  } else if (view === 'decisions') {
    canvas.appendChild(renderDecisionsView(oldDecIds));
  }
}

function bindTabs() {
  for (const btn of $$('.tab')) {
    btn.addEventListener('click', () => {
      view = btn.dataset.view;
      $$('.tab').forEach((b) => b.classList.toggle('active', b === btn));
      renderView();
    });
  }
  $('#modeToggle').addEventListener('click', toggleMode);
}

function bindKeys() {
  document.addEventListener('keydown', (e) => {
    if (e.target && /input|textarea|select/i.test(e.target.tagName || '')) return;
    if (e.key === 'd') { setView('decisions'); }
    else if (e.key === 's') { /* TODO(v0.2): stories view */ }
    else if (e.key === 'r') { fetch('/api/state', { cache: 'no-store' }).then(r => r.json()).then(s => { state = s; renderAll(); }); }
    else if (e.key === 't') { toggleMode(); }
    else if (e.key === '?') { alert('BMAD Console v0.1\n\nKeys:\n  d  decisions view\n  s  stories (v0.2)\n  r  refresh\n  t  paper/inverse\n  ?  this help'); }
    else if (e.key === 'Escape') {
      $('#digest').classList.add('hidden');
      localStorage.setItem(STORAGE.lastVisit, String(Date.now()));
    }
  });
}

function setView(v) {
  view = v;
  $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
  renderView();
}

// --- Dashboard ----------------------------------------------------------

function renderDashboard(oldActKeys) {
  const wrap = document.createElement('div');
  wrap.className = 'dash-grid';

  // Pane 1: Current Focus + Pending
  const p1 = document.createElement('section');
  p1.className = 'panel';
  const activePhase = (state.phases || []).find((p) => p.status === 'active');
  const focusPhase = activePhase || (state.phases || []).slice().reverse().find((p) => p.status === 'done') || (state.phases || [])[0];
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
    <div class="focus-line"><span class="label">Status</span><span class="value">${escapeHtml(state.project ? (state.project.status || '—') : '—')}</span></div>

    <div class="panel-sub">Pending</div>
    <div id="pendingList"></div>
  `;
  const pendingList = p1.querySelector('#pendingList');
  if ((state.pendingApprovals || []).length === 0) {
    const note = document.createElement('div');
    note.className = 'note';
    note.textContent = '— no approvals pending —';
    pendingList.appendChild(note);
  } else {
    for (const pa of state.pendingApprovals) {
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
  const recent = (state.decisions || []).slice(-5).reverse();
  const recentRoot = p2.querySelector('#recentDecisions');
  for (const d of recent) {
    recentRoot.appendChild(renderCartoucheCompact(d));
  }
  const actList = p2.querySelector('#activityList');
  for (const a of (state.activity || []).slice(0, 20)) {
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
  for (const ag of state.agents || []) {
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
  const stCounts = countStoryStatuses(state.stories || []);
  const sm = p3.querySelector('#storiesMini');
  sm.innerHTML = `
    <div><span class="label">Total</span><span class="value">${stCounts.total}</span></div>
    <div><span class="label">Complete</span><span class="value" style="color:var(--phosphor)">${stCounts.complete}</span></div>
    <div><span class="label">In Progress</span><span class="value">${stCounts['in-progress']}</span></div>
    <div><span class="label">Unknown</span><span class="value">${stCounts.unknown}</span></div>
  `;

  wrap.appendChild(p1);
  wrap.appendChild(p2);
  wrap.appendChild(p3);
  return wrap;
}

function countStoryStatuses(stories) {
  const c = { total: stories.length, complete: 0, 'in-progress': 0, ready: 0, draft: 0, review: 0, unknown: 0 };
  for (const s of stories) {
    if (c[s.status] === undefined) c[s.status] = 0;
    c[s.status]++;
  }
  return c;
}

// --- Decisions view -----------------------------------------------------

function renderDecisionsView(oldDecIds) {
  const wrap = document.createElement('div');

  const decisions = state.decisions || [];
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
      ${(state.phases || []).map((p) => `<option value="${p.id}">${escapeHtml(p.id)}</option>`).join('')}
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
