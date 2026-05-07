// writer-ideation.js — paper writing surface for the Ideation phase.
// Writes the composed brief to artifacts/planning/product-brief.md on every
// debounced change.

import { createDebouncedTextarea, debounce } from '../components/debounced-textarea.js';

const BRIEF_PATH = 'artifacts/planning/product-brief.md';

const SIDEBAR_PROMPTS = [
  { key: 'audience', heading: "Who's it for?", placeholder: 'A specific persona — name them, name their constraints.' },
  { key: 'problem', heading: 'What problem does it solve?', placeholder: 'The thing that makes someone reach for this instead of the status quo.' },
  { key: 'why-now', heading: 'Why now?', placeholder: "What's true today that wasn't true two years ago." },
  { key: 'v1', heading: 'What does v1 look like?', placeholder: 'The smallest version that actually solves the problem for one user.' },
];

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Compose the four sidebar fields + main body into a coherent markdown file
// that matches the ## headings used by the parser on next read.
function composeBrief({ body, sidebar }) {
  const parts = [];
  parts.push('# Product Brief');
  parts.push('');
  if (body && body.trim()) {
    parts.push(body.trim());
    parts.push('');
  }
  for (const p of SIDEBAR_PROMPTS) {
    const v = (sidebar[p.key] || '').trim();
    if (!v) continue;
    parts.push(`## ${p.heading}`);
    parts.push('');
    parts.push(v);
    parts.push('');
  }
  return parts.join('\n').trim() + '\n';
}

// Crude inverse parser: pull each `## Heading` block back into its sidebar
// field, leaving everything before the first H2 (after the title) as `body`.
function parseBrief(raw) {
  const out = { body: '', sidebar: {} };
  if (!raw) return out;
  const lines = raw.split(/\r?\n/);
  // Skip leading H1 if present.
  let i = 0;
  if (lines[i] && /^#\s+/.test(lines[i])) i++;
  // Skip blank lines.
  while (i < lines.length && lines[i].trim() === '') i++;
  const bodyLines = [];
  let currentKey = null;
  let currentBuf = [];
  function commit() {
    if (currentKey != null) {
      out.sidebar[currentKey] = currentBuf.join('\n').trim();
      currentBuf = [];
    }
  }
  for (; i < lines.length; i++) {
    const line = lines[i];
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) {
      // Find which prompt this matches by heading text.
      const heading = m[1].trim();
      const match = SIDEBAR_PROMPTS.find((p) => p.heading.toLowerCase() === heading.toLowerCase());
      commit();
      currentKey = match ? match.key : '__other__:' + heading;
      continue;
    }
    if (currentKey == null) {
      bodyLines.push(line);
    } else {
      currentBuf.push(line);
    }
  }
  commit();
  out.body = bodyLines.join('\n').trim();
  return out;
}

export async function renderIdeation(parent, { state, writeArtifact, transitionGate, readArtifact }) {
  parent.innerHTML = '';
  parent.classList.add('writer-ideation');

  // Layout: paper canvas + right sidebar.
  parent.innerHTML = `
    <div class="writer-ideation-grid">
      <article class="writer-paper">
        <h1 class="writer-paper-title">What's the idea?</h1>
        <div class="writer-paper-rule"></div>
        <div class="writer-paper-body" id="briefBodySlot"></div>
        <div class="writer-paper-actions">
          <button class="writer-cta" id="markReady" type="button">Mark ready for exploration</button>
          <span class="writer-save-status" id="saveStatus">unsaved</span>
        </div>
      </article>
      <aside class="writer-sidebar" id="sidebar">
        <div class="writer-sidebar-head">PROMPTS</div>
        <div class="writer-sidebar-list" id="sidebarList"></div>
      </aside>
    </div>
  `;

  const bodySlot = parent.querySelector('#briefBodySlot');
  const sidebarList = parent.querySelector('#sidebarList');
  const saveStatus = parent.querySelector('#saveStatus');
  const markReady = parent.querySelector('#markReady');

  // Pre-populate from existing file if any.
  let initial = { body: '', sidebar: {} };
  try {
    const raw = await readArtifact(BRIEF_PATH);
    initial = parseBrief(raw || '');
  } catch {}

  // Save state aggregator.
  const current = { body: initial.body || '', sidebar: { ...initial.sidebar } };

  function setStatus(text, kind) {
    saveStatus.textContent = text;
    saveStatus.className = 'writer-save-status ' + (kind || '');
  }

  const save = debounce(async () => {
    setStatus('saving…');
    try {
      const composed = composeBrief(current);
      await writeArtifact(BRIEF_PATH, composed);
      setStatus('saved', 'ok');
    } catch (e) {
      setStatus(String(e.message || e), 'err');
    }
  }, 600);

  // Main body textarea.
  const body = createDebouncedTextarea({
    value: current.body,
    placeholder: 'Start anywhere. The brief grows from whatever you write here.',
    debounceMs: 500,
    className: 'writer-textarea-body',
    rows: 10,
    onChange(v) {
      current.body = v;
      save();
    },
  });
  bodySlot.appendChild(body.el);

  // Sidebar prompt cards.
  for (const prompt of SIDEBAR_PROMPTS) {
    const card = document.createElement('div');
    card.className = 'writer-prompt-card';
    card.innerHTML = `
      <div class="writer-prompt-card-head">
        <span class="writer-prompt-heading">${escapeHtml(prompt.heading)}</span>
        <button class="writer-prompt-toggle" type="button" title="collapse / expand">−</button>
      </div>
      <div class="writer-prompt-card-body"></div>
    `;
    const cardBody = card.querySelector('.writer-prompt-card-body');
    const toggle = card.querySelector('.writer-prompt-toggle');
    const ta = createDebouncedTextarea({
      value: current.sidebar[prompt.key] || '',
      placeholder: prompt.placeholder,
      className: 'writer-textarea-sidebar',
      rows: 3,
      onChange(v) {
        current.sidebar[prompt.key] = v;
        save();
      },
    });
    cardBody.appendChild(ta.el);
    let collapsed = false;
    toggle.addEventListener('click', () => {
      collapsed = !collapsed;
      cardBody.style.display = collapsed ? 'none' : '';
      toggle.textContent = collapsed ? '+' : '−';
    });
    sidebarList.appendChild(card);
  }

  // Mark-ready button — modal confirmation, then gate transition.
  markReady.addEventListener('click', async () => {
    if (!confirm('Move project to exploration phase? This will update project.yaml.')) return;
    markReady.disabled = true;
    setStatus('flushing…');
    save.flush();
    // Give the network a moment to finish.
    await new Promise((r) => setTimeout(r, 100));
    try {
      await transitionGate('exploration', 'pass');
      setStatus('phase: exploration', 'ok');
    } catch (e) {
      setStatus(String(e.message || e), 'err');
      markReady.disabled = false;
    }
  });

  if (initial.body || Object.keys(initial.sidebar).length) {
    setStatus('loaded', 'ok');
  } else {
    setStatus('—');
  }
}

// Exposed for tests.
export const _internals = { composeBrief, parseBrief };
