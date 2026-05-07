// writer-stub.js — placeholder writer for phases not implemented in v0.3.

const STUB_COPY = {
  exploration: {
    name: 'Exploration',
    description:
      'A research workspace with side-by-side market, domain, and technical research notebooks. Each notebook autosaves to artifacts/exploration/<topic>.md, with a left-hand outline auto-generated from headings and an "ask a researcher" lane that streams agent output beside your notes.',
  },
  design: {
    name: 'Design',
    description:
      'An architecture canvas with a structured component tree on the left, a markdown editor for architecture.md in the centre, and a stack of ADR cards on the right. Each ADR is a small writer surface that drops a numbered file under artifacts/design/decisions/.',
  },
  implementation: {
    name: 'Implementation',
    description:
      'A story-by-story writing surface — title, acceptance criteria, dev notes, status — that writes to artifacts/implementation/stories/. Inline review pane shows the latest review-report alongside the story while you edit.',
  },
  delivery: {
    name: 'Delivery',
    description:
      'A handoff packet builder. Final review report, test report, and release notes laid out as a publication spread; produces artifacts/reviews/final-review.md and artifacts/reviews/test-report.md.',
  },
};

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderStub(parent, { phaseId }) {
  parent.innerHTML = '';
  const copy = STUB_COPY[phaseId] || {
    name: phaseId,
    description: 'A writer for this phase will land in v0.4.',
  };

  const card = document.createElement('div');
  card.className = 'writer-stub-card';
  card.innerHTML = `
    <div class="writer-stub-stamp">v0.4 COMING</div>
    <h2 class="writer-stub-title">${escapeHtml(copy.name)}</h2>
    <p class="writer-stub-body">${escapeHtml(copy.description)}</p>
    <div class="writer-stub-rule"></div>
    <p class="writer-stub-cli">
      Use the CLI for now: drop the relevant artifact under
      <code>artifacts/</code> and the dashboard will pick it up.
    </p>
  `;
  parent.appendChild(card);
}
