// writer-definition.js — structured PRD builder. Three-column responsive
// layout. Composes one coherent prd.md document on every debounced change.

import { createDebouncedTextarea, debounce } from '../components/debounced-textarea.js';

const PRD_PATH = 'artifacts/planning/prd.md';

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function uid() {
  return 'r' + Math.random().toString(36).slice(2, 9);
}

// Compose the in-memory PRD model into a markdown document. Headings match
// the prd.md schema's structure so the parser on next load will round-trip.
function composePrd(model) {
  const lines = [];
  lines.push(`# Product Requirements Document`);
  lines.push('');
  if (model.problem && model.problem.trim()) {
    lines.push('## Problem');
    lines.push('');
    lines.push(model.problem.trim());
    lines.push('');
  }
  if (model.users && model.users.length) {
    lines.push('## Users');
    lines.push('');
    for (const u of model.users) {
      const t = (u || '').trim();
      if (t) lines.push('- ' + t);
    }
    lines.push('');
  }
  if (model.functional && model.functional.length) {
    lines.push('## Functional Requirements');
    lines.push('');
    for (let i = 0; i < model.functional.length; i++) {
      const fr = model.functional[i];
      const id = `FR-${i + 1}`;
      const title = (fr.title || '').trim() || '(untitled)';
      lines.push(`### ${id}: ${title}`);
      lines.push('');
      if (fr.description && fr.description.trim()) {
        lines.push(fr.description.trim());
        lines.push('');
      }
      if (fr.acs && fr.acs.length) {
        lines.push('**Acceptance Criteria**');
        lines.push('');
        for (const ac of fr.acs) {
          const t = (ac || '').trim();
          if (t) lines.push('- ' + t);
        }
        lines.push('');
      }
    }
  }
  if (model.nonfunctional && model.nonfunctional.length) {
    lines.push('## Non-Functional Requirements');
    lines.push('');
    for (let i = 0; i < model.nonfunctional.length; i++) {
      const n = model.nonfunctional[i];
      const id = `NFR-${i + 1}`;
      const title = (n.title || '').trim() || '(untitled)';
      lines.push(`### ${id}: ${title}`);
      lines.push('');
      if (n.description && n.description.trim()) {
        lines.push(n.description.trim());
        lines.push('');
      }
      if (n.target && n.target.trim()) {
        lines.push(`**Target:** ${n.target.trim()}`);
        lines.push('');
      }
    }
  }
  if (model.success && model.success.length) {
    lines.push('## Success Criteria');
    lines.push('');
    for (const s of model.success) {
      const t = (s || '').trim();
      if (t) lines.push('- ' + t);
    }
    lines.push('');
  }
  return lines.join('\n').trim() + '\n';
}

// Best-effort parse of a previously-composed prd.md back into the model.
// Tolerates missing sections.
function parsePrd(raw) {
  const model = emptyModel();
  if (!raw) return model;
  const lines = raw.split(/\r?\n/);
  let section = null;
  let buf = [];
  let currentReq = null;
  function flushReq(target) {
    if (currentReq) {
      target.push(currentReq);
      currentReq = null;
    }
  }
  function flushBuf() {
    const s = buf.join('\n').trim();
    buf = [];
    return s;
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h2 = /^##\s+(.+?)\s*$/.exec(line);
    const h3 = /^###\s+(FR|NFR)-\d+:\s*(.+?)\s*$/.exec(line);
    if (h2) {
      // Close any open requirement.
      if (section === 'functional') flushReq(model.functional);
      else if (section === 'nonfunctional') flushReq(model.nonfunctional);
      // Capture buffered prose into the prior section if applicable.
      const prior = flushBuf();
      if (section === 'problem') model.problem = prior;
      const heading = h2[1].toLowerCase();
      if (heading.startsWith('problem')) section = 'problem';
      else if (heading.startsWith('user')) section = 'users';
      else if (heading.startsWith('functional')) section = 'functional';
      else if (heading.startsWith('non-functional') || heading.startsWith('nonfunctional')) section = 'nonfunctional';
      else if (heading.startsWith('success')) section = 'success';
      else section = '__other__';
      continue;
    }
    if (h3 && (section === 'functional' || section === 'nonfunctional')) {
      // close prior req
      const prior = flushBuf();
      if (currentReq) currentReq.description = prior;
      flushReq(section === 'functional' ? model.functional : model.nonfunctional);
      currentReq = { id: uid(), title: h3[2], description: '', acs: [] };
      continue;
    }
    // List item collection for users / success.
    if (section === 'users' || section === 'success') {
      const li = /^[-*]\s+(.+?)\s*$/.exec(line);
      if (li) {
        if (section === 'users') model.users.push(li[1]);
        else model.success.push(li[1]);
        continue;
      }
    }
    if (section === 'functional' && currentReq) {
      // AC list lines beneath bold marker
      const li = /^[-*]\s+(.+?)\s*$/.exec(line);
      if (li) {
        currentReq.acs.push(li[1]);
        continue;
      }
      if (/^\*\*Acceptance Criteria\*\*/i.test(line)) continue;
      buf.push(line);
      continue;
    }
    if (section === 'nonfunctional' && currentReq) {
      const tgt = /^\*\*Target:\*\*\s*(.+?)\s*$/i.exec(line);
      if (tgt) {
        currentReq.target = tgt[1];
        continue;
      }
      buf.push(line);
      continue;
    }
    buf.push(line);
  }
  // Flush trailing
  if (section === 'problem') model.problem = flushBuf();
  else flushBuf();
  if (section === 'functional') flushReq(model.functional);
  if (section === 'nonfunctional') flushReq(model.nonfunctional);
  return model;
}

function emptyModel() {
  return {
    problem: '',
    users: [],
    functional: [],
    nonfunctional: [],
    success: [],
  };
}

function makeFR(title = '') {
  return { id: uid(), title, description: '', acs: [] };
}
function makeNFR(title = '') {
  return { id: uid(), title, description: '', target: '' };
}

export async function renderDefinition(parent, { state, writeArtifact, transitionGate, readArtifact }) {
  parent.innerHTML = '';
  parent.classList.add('writer-definition');

  // Pre-populate from existing prd.md if any.
  let initial = emptyModel();
  try {
    const raw = await readArtifact(PRD_PATH);
    if (raw && raw.trim()) initial = parsePrd(raw);
  } catch {}

  const model = initial;

  parent.innerHTML = `
    <div class="writer-definition-head">
      <h1 class="writer-definition-title">PRD</h1>
      <span class="writer-save-status" id="saveStatus">—</span>
    </div>
    <div class="writer-definition-grid">
      <section class="prd-section" id="problemSection">
        <h2 class="prd-section-title">Problem</h2>
        <div class="prd-section-rule"></div>
        <div id="problemSlot"></div>
      </section>

      <section class="prd-section" id="usersSection">
        <h2 class="prd-section-title">Users</h2>
        <div class="prd-section-rule"></div>
        <div class="prd-list" id="usersList"></div>
        <button class="writer-add-btn" id="addUser" type="button">+ add user type</button>
      </section>

      <section class="prd-section prd-section-wide" id="frSection">
        <h2 class="prd-section-title">Functional Requirements</h2>
        <div class="prd-section-rule"></div>
        <div class="requirement-list" id="frList"></div>
        <button class="writer-add-btn" id="addFr" type="button">+ add requirement</button>
      </section>

      <section class="prd-section" id="nfrSection">
        <h2 class="prd-section-title">Non-Functional Requirements</h2>
        <div class="prd-section-rule"></div>
        <div class="requirement-list" id="nfrList"></div>
        <button class="writer-add-btn" id="addNfr" type="button">+ add NFR</button>
      </section>

      <section class="prd-section" id="successSection">
        <h2 class="prd-section-title">Success Criteria</h2>
        <div class="prd-section-rule"></div>
        <div class="prd-list" id="successList"></div>
        <button class="writer-add-btn" id="addSuccess" type="button">+ add criterion</button>
      </section>
    </div>

    <div class="writer-definition-actions">
      <button class="writer-cta" id="markReady" type="button">Mark PRD ready for human approval</button>
      <span class="writer-validate-msg" id="validateMsg"></span>
    </div>
  `;

  const saveStatus = parent.querySelector('#saveStatus');
  const validateMsg = parent.querySelector('#validateMsg');

  function setStatus(text, kind) {
    saveStatus.textContent = text;
    saveStatus.className = 'writer-save-status ' + (kind || '');
  }

  const save = debounce(async () => {
    setStatus('saving…');
    try {
      const md = composePrd(model);
      await writeArtifact(PRD_PATH, md);
      setStatus('saved', 'ok');
    } catch (e) {
      setStatus(String(e.message || e), 'err');
    }
  }, 500);

  // ---- Problem ----------------------------------------------------------
  const problemSlot = parent.querySelector('#problemSlot');
  const problemTa = createDebouncedTextarea({
    value: model.problem,
    placeholder: 'What problem does this product solve, and for whom?',
    rows: 5,
    onChange(v) {
      model.problem = v;
      save();
    },
  });
  problemSlot.appendChild(problemTa.el);

  // ---- Users ------------------------------------------------------------
  const usersList = parent.querySelector('#usersList');
  function renderUsers() {
    usersList.innerHTML = '';
    model.users.forEach((u, i) => {
      const row = document.createElement('div');
      row.className = 'prd-list-row';
      const ta = createDebouncedTextarea({
        value: u,
        placeholder: 'A specific user persona.',
        rows: 2,
        onChange(v) {
          model.users[i] = v;
          save();
        },
      });
      row.appendChild(ta.el);
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'prd-remove-btn';
      rm.textContent = '×';
      rm.title = 'remove';
      rm.addEventListener('click', () => {
        model.users.splice(i, 1);
        renderUsers();
        save();
      });
      row.appendChild(rm);
      usersList.appendChild(row);
    });
  }
  renderUsers();
  parent.querySelector('#addUser').addEventListener('click', () => {
    model.users.push('');
    renderUsers();
  });

  // ---- Functional Requirements with drag-reorder -----------------------
  const frList = parent.querySelector('#frList');
  let dragSrcIdx = null;
  function renderFr() {
    frList.innerHTML = '';
    model.functional.forEach((fr, i) => {
      const card = document.createElement('div');
      card.className = 'requirement-card';
      card.draggable = true;
      card.dataset.idx = String(i);
      card.innerHTML = `
        <div class="requirement-card-head">
          <span class="requirement-drag" title="drag to reorder">⋮⋮</span>
          <span class="requirement-id">FR-${i + 1}</span>
          <input class="requirement-title" type="text" value="${escapeHtml(fr.title || '')}" placeholder="Requirement title" />
          <button class="requirement-remove" type="button" title="remove">×</button>
        </div>
        <div class="requirement-card-body">
          <div class="requirement-desc-slot"></div>
          <div class="requirement-acs">
            <div class="requirement-acs-head">Acceptance Criteria</div>
            <div class="requirement-acs-list"></div>
            <button class="writer-add-btn-sm requirement-add-ac" type="button">+ add criterion</button>
          </div>
        </div>
      `;
      const titleInput = card.querySelector('.requirement-title');
      titleInput.addEventListener('input', () => {
        fr.title = titleInput.value;
        save();
      });
      const descSlot = card.querySelector('.requirement-desc-slot');
      const descTa = createDebouncedTextarea({
        value: fr.description,
        placeholder: 'A specific, testable capability description.',
        rows: 3,
        onChange(v) {
          fr.description = v;
          save();
        },
      });
      descSlot.appendChild(descTa.el);

      const acsList = card.querySelector('.requirement-acs-list');
      function renderAcs() {
        acsList.innerHTML = '';
        fr.acs.forEach((ac, ai) => {
          const acRow = document.createElement('div');
          acRow.className = 'requirement-ac-row';
          const ta = createDebouncedTextarea({
            value: ac,
            placeholder: 'Given … When … Then …',
            rows: 2,
            onChange(v) {
              fr.acs[ai] = v;
              save();
            },
          });
          acRow.appendChild(ta.el);
          const rm = document.createElement('button');
          rm.type = 'button';
          rm.className = 'prd-remove-btn';
          rm.textContent = '×';
          rm.addEventListener('click', () => {
            fr.acs.splice(ai, 1);
            renderAcs();
            save();
          });
          acRow.appendChild(rm);
          acsList.appendChild(acRow);
        });
      }
      renderAcs();
      card.querySelector('.requirement-add-ac').addEventListener('click', () => {
        fr.acs.push('');
        renderAcs();
      });

      card.querySelector('.requirement-remove').addEventListener('click', () => {
        model.functional.splice(i, 1);
        renderFr();
        save();
      });

      // HTML5 drag-and-drop. Native, no library.
      card.addEventListener('dragstart', (ev) => {
        dragSrcIdx = i;
        card.classList.add('dragging');
        try { ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', String(i)); } catch {}
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        for (const c of frList.children) c.classList.remove('drag-over');
        dragSrcIdx = null;
      });
      card.addEventListener('dragover', (ev) => {
        ev.preventDefault();
        try { ev.dataTransfer.dropEffect = 'move'; } catch {}
        card.classList.add('drag-over');
      });
      card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over');
      });
      card.addEventListener('drop', (ev) => {
        ev.preventDefault();
        card.classList.remove('drag-over');
        const src = dragSrcIdx;
        const dst = i;
        if (src == null || src === dst) return;
        const [moved] = model.functional.splice(src, 1);
        model.functional.splice(dst, 0, moved);
        renderFr();
        save();
      });

      frList.appendChild(card);
    });
  }
  renderFr();
  parent.querySelector('#addFr').addEventListener('click', () => {
    model.functional.push(makeFR());
    renderFr();
  });

  // ---- Non-Functional Requirements --------------------------------------
  const nfrList = parent.querySelector('#nfrList');
  function renderNfr() {
    nfrList.innerHTML = '';
    model.nonfunctional.forEach((n, i) => {
      const card = document.createElement('div');
      card.className = 'requirement-card requirement-card-nfr';
      card.innerHTML = `
        <div class="requirement-card-head">
          <span class="requirement-id">NFR-${i + 1}</span>
          <input class="requirement-title" type="text" value="${escapeHtml(n.title || '')}" placeholder="NFR title" />
          <button class="requirement-remove" type="button" title="remove">×</button>
        </div>
        <div class="requirement-card-body">
          <div class="requirement-desc-slot"></div>
          <input class="requirement-target" type="text" value="${escapeHtml(n.target || '')}" placeholder="Measurable target (e.g. p95 < 200ms)" />
        </div>
      `;
      const titleInput = card.querySelector('.requirement-title');
      titleInput.addEventListener('input', () => { n.title = titleInput.value; save(); });
      const targetInput = card.querySelector('.requirement-target');
      targetInput.addEventListener('input', () => { n.target = targetInput.value; save(); });
      const descSlot = card.querySelector('.requirement-desc-slot');
      const descTa = createDebouncedTextarea({
        value: n.description,
        placeholder: 'Description with measurable conditions.',
        rows: 3,
        onChange(v) { n.description = v; save(); },
      });
      descSlot.appendChild(descTa.el);
      card.querySelector('.requirement-remove').addEventListener('click', () => {
        model.nonfunctional.splice(i, 1);
        renderNfr();
        save();
      });
      nfrList.appendChild(card);
    });
  }
  renderNfr();
  parent.querySelector('#addNfr').addEventListener('click', () => {
    model.nonfunctional.push(makeNFR());
    renderNfr();
  });

  // ---- Success Criteria -------------------------------------------------
  const successList = parent.querySelector('#successList');
  function renderSuccess() {
    successList.innerHTML = '';
    model.success.forEach((s, i) => {
      const row = document.createElement('div');
      row.className = 'prd-list-row';
      const ta = createDebouncedTextarea({
        value: s,
        placeholder: 'Specific, measurable outcome.',
        rows: 2,
        onChange(v) { model.success[i] = v; save(); },
      });
      row.appendChild(ta.el);
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'prd-remove-btn';
      rm.textContent = '×';
      rm.addEventListener('click', () => {
        model.success.splice(i, 1);
        renderSuccess();
        save();
      });
      row.appendChild(rm);
      successList.appendChild(row);
    });
  }
  renderSuccess();
  parent.querySelector('#addSuccess').addEventListener('click', () => {
    model.success.push('');
    renderSuccess();
  });

  // ---- Mark ready --------------------------------------------------------
  const markReady = parent.querySelector('#markReady');
  markReady.addEventListener('click', async () => {
    // Validate: required sections must be non-empty.
    const errors = [];
    if (!model.problem.trim()) errors.push('Problem');
    if (!model.users.some((u) => u && u.trim())) errors.push('Users');
    if (!model.functional.some((f) => (f.title || '').trim())) errors.push('Functional Requirements');
    if (!model.success.some((s) => s && s.trim())) errors.push('Success Criteria');
    if (errors.length) {
      validateMsg.textContent = 'Missing: ' + errors.join(', ');
      validateMsg.className = 'writer-validate-msg err';
      return;
    }
    if (!confirm('Mark PRD ready and surface for human approval?')) return;
    markReady.disabled = true;
    save.flush();
    await new Promise((r) => setTimeout(r, 100));
    try {
      // Per the plan: "transitions gate to prd-pending-approval (which the
      // approval panel then surfaces)." We use the gate=pass action with
      // phase=prd-pending-approval to flip project.yaml. The approval panel
      // already surfaces any prd.md without an Approved-by line.
      await transitionGate('prd-pending-approval', 'pass');
      validateMsg.textContent = 'PRD marked ready. Approval pending.';
      validateMsg.className = 'writer-validate-msg ok';
    } catch (e) {
      validateMsg.textContent = String(e.message || e);
      validateMsg.className = 'writer-validate-msg err';
      markReady.disabled = false;
    }
  });

  // Initial save status.
  if (initial.problem || initial.functional.length) {
    setStatus('loaded', 'ok');
  } else {
    setStatus('—');
  }
}

// Exposed for tests.
export const _internals = { composePrd, parsePrd, emptyModel };
