// writer.js — top-level Writer router. Renders a phase sub-tab strip and an
// approval rail; loads the appropriate sub-writer module on demand.

import { renderApprovalPanel } from '../components/approval-panel.js';

const PHASES = [
  { id: 'ideation', name: 'Ideation' },
  { id: 'exploration', name: 'Exploration' },
  { id: 'definition', name: 'Definition' },
  { id: 'design', name: 'Design' },
  { id: 'implementation', name: 'Implementation' },
  { id: 'delivery', name: 'Delivery' },
];

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Track active sub-writer across re-renders so SSE state refreshes don't
// jolt the user back to the project's current phase.
let activeSubPhase = null;

export function renderWriter(parent, ctx) {
  const { state } = ctx;
  parent.innerHTML = '';
  parent.classList.add('writer');

  // Default sub-phase = currently active project phase, else first phase.
  const projectPhase = (state && state.project && state.project.phase) || 'ideation';
  if (activeSubPhase == null) {
    activeSubPhase = projectPhase;
  }

  parent.innerHTML = `
    <div class="writer-shell">
      <nav class="writer-subtabs" id="writerSubtabs" aria-label="Phase writers"></nav>
      <div class="writer-canvas" id="writerCanvas"></div>
      <aside class="writer-rail" id="writerRail"></aside>
    </div>
  `;

  const subtabs = parent.querySelector('#writerSubtabs');
  const canvas = parent.querySelector('#writerCanvas');
  const rail = parent.querySelector('#writerRail');

  // Sub-tab strip mirroring phase ribbon.
  for (const ph of PHASES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'writer-subtab';
    if (ph.id === activeSubPhase) btn.classList.add('active');
    if (ph.id === projectPhase) btn.classList.add('current');
    btn.dataset.phase = ph.id;
    btn.innerHTML = `<span class="writer-subtab-name">${escapeHtml(ph.name)}</span>`;
    btn.addEventListener('click', () => {
      activeSubPhase = ph.id;
      renderWriter(parent, ctx);
    });
    subtabs.appendChild(btn);
  }

  // Approval rail.
  renderApprovalPanel(rail, ctx);

  // Canvas — load the appropriate sub-writer module.
  loadSubWriter(canvas, activeSubPhase, ctx).catch((e) => {
    canvas.innerHTML = `<pre class="writer-error">${escapeHtml(String(e))}</pre>`;
  });
}

async function loadSubWriter(canvas, phaseId, ctx) {
  if (phaseId === 'ideation') {
    const mod = await import('./writer-ideation.js');
    return mod.renderIdeation(canvas, ctx);
  }
  if (phaseId === 'definition') {
    const mod = await import('./writer-definition.js');
    return mod.renderDefinition(canvas, ctx);
  }
  const mod = await import('./writer-stub.js');
  return mod.renderStub(canvas, { phaseId });
}
