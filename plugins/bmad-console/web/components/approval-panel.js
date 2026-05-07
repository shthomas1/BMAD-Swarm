// approval-panel.js — renders pending-approvals as stamp-style cards with
// approve / send-back actions.

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// renderApprovalPanel(parent, { state, transitionGate })
// `parent` is the container element. The component clears it and rebuilds.
export function renderApprovalPanel(parent, { state, transitionGate }) {
  parent.innerHTML = '';
  parent.classList.add('approval-panel');

  const head = document.createElement('div');
  head.className = 'approval-panel-head';
  head.innerHTML = `<h3 class="approval-panel-title">Pending Approvals</h3>`;
  parent.appendChild(head);

  const list = document.createElement('div');
  list.className = 'approval-panel-list';
  parent.appendChild(list);

  const pending = (state && state.pendingApprovals) || [];
  if (pending.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'approval-empty';
    empty.textContent = 'No pending approvals.';
    list.appendChild(empty);
    return;
  }

  for (const pa of pending) {
    const card = document.createElement('div');
    card.className = 'approval-card';
    card.innerHTML = `
      <div class="approval-card-head">
        <span class="approval-stamp">PENDING</span>
        <span class="approval-type">${escapeHtml((pa.type || '').toUpperCase())}</span>
      </div>
      <div class="approval-path" title="${escapeHtml(pa.artifact)}">${escapeHtml(pa.artifact)}</div>
      <div class="approval-reason">${escapeHtml(pa.reason || '')}</div>
      <div class="approval-actions">
        <button class="approval-approve" type="button">Approve</button>
        <button class="approval-revise" type="button">Send back</button>
      </div>
      <div class="approval-revise-form" hidden>
        <textarea class="approval-revise-note" placeholder="reason for revision (optional)"></textarea>
        <div class="approval-revise-actions">
          <button class="approval-revise-confirm" type="button">Send back for revision</button>
          <button class="approval-revise-cancel" type="button">Cancel</button>
        </div>
      </div>
      <div class="approval-status" hidden></div>
    `;
    const phase = pa.phase || '';
    const approveBtn = card.querySelector('.approval-approve');
    const reviseBtn = card.querySelector('.approval-revise');
    const reviseForm = card.querySelector('.approval-revise-form');
    const reviseNote = card.querySelector('.approval-revise-note');
    const reviseConfirm = card.querySelector('.approval-revise-confirm');
    const reviseCancel = card.querySelector('.approval-revise-cancel');
    const status = card.querySelector('.approval-status');

    function showStatus(msg, kind) {
      status.hidden = false;
      status.textContent = msg;
      status.className = 'approval-status ' + (kind || '');
    }

    approveBtn.addEventListener('click', async () => {
      approveBtn.disabled = true;
      reviseBtn.disabled = true;
      try {
        await transitionGate(phase, 'approve');
        showStatus('Approved.', 'ok');
      } catch (e) {
        showStatus(String(e.message || e), 'err');
        approveBtn.disabled = false;
        reviseBtn.disabled = false;
      }
    });

    reviseBtn.addEventListener('click', () => {
      reviseForm.hidden = false;
      reviseNote.focus();
    });

    reviseCancel.addEventListener('click', () => {
      reviseForm.hidden = true;
      reviseNote.value = '';
    });

    reviseConfirm.addEventListener('click', async () => {
      const note = (reviseNote.value || '').trim();
      reviseConfirm.disabled = true;
      reviseCancel.disabled = true;
      approveBtn.disabled = true;
      reviseBtn.disabled = true;
      try {
        await transitionGate(phase, 'needs-revision', note);
        showStatus('Sent back for revision.', 'ok');
        reviseForm.hidden = true;
      } catch (e) {
        showStatus(String(e.message || e), 'err');
        reviseConfirm.disabled = false;
        reviseCancel.disabled = false;
        approveBtn.disabled = false;
        reviseBtn.disabled = false;
      }
    });

    list.appendChild(card);
  }
}
