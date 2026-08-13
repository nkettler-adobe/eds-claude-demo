import DA_SDK from 'https://da.live/nx/utils/sdk.js';

// Shared demo runtime (acsmarketing Target instance) — same endpoint the Target tool uses.
const RUNTIME_URL = 'https://332794-868ceruleanwhale.adobeioruntime.net/api/v1/web/default/target-activities';

// Default mbox for this demo — matches target-mbox-hero in head.html so new activities line up with the hero swap.
const DEFAULT_MBOX = 'eds-hero-mbox';

async function runtimeFetch(params) {
  const url = `${RUNTIME_URL}?${new URLSearchParams(params)}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Runtime error: ${resp.status}`);
  return resp.json();
}

const fetchActivities = async () => (await runtimeFetch({})).activities ?? [];
const fetchOffers = async () => (await runtimeFetch({ resource: 'offers' })).offers ?? [];
const fetchAudiences = async () => (await runtimeFetch({ resource: 'audiences' })).audiences ?? [];

function createXtActivity({ name, mbox, offerId, audienceId }) {
  return runtimeFetch({
    resource: 'create-xt',
    name,
    mbox: mbox || DEFAULT_MBOX,
    offerId,
    ...(audienceId ? { audienceId } : {}),
  });
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Create XT activity modal ────────────────────────────────────────────────

function field(label, input) {
  const wrap = document.createElement('div');
  wrap.className = 'form-field';
  const lbl = document.createElement('label');
  lbl.textContent = label;
  wrap.append(lbl, input);
  return wrap;
}

async function showCreateModal(onCreated) {
  document.querySelector('.dt-modal')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'dt-modal';
  const panel = document.createElement('div');
  panel.className = 'dt-panel';

  const header = document.createElement('div');
  header.className = 'dt-modal-header';
  header.innerHTML = '<h3>Create Experience Targeting Activity</h3>';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'dt-close';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', () => overlay.remove());
  header.append(closeBtn);

  const form = document.createElement('div');
  form.className = 'dt-form';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'e.g. homepage-hero-promo';
  form.append(field('Activity Name', nameInput));

  const mboxInput = document.createElement('input');
  mboxInput.type = 'text';
  mboxInput.value = DEFAULT_MBOX;
  form.append(field('Mbox / Location', mboxInput));

  const loadingNote = document.createElement('p');
  loadingNote.className = 'dt-loading';
  loadingNote.textContent = 'Loading offers and audiences…';
  form.append(loadingNote);

  const footer = document.createElement('div');
  footer.className = 'dt-modal-footer';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'dt-btn-secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => overlay.remove());
  const saveBtn = document.createElement('button');
  saveBtn.className = 'dt-btn-primary';
  saveBtn.textContent = 'Create';
  saveBtn.disabled = true;
  footer.append(cancelBtn, saveBtn);

  panel.append(header, form, footer);
  overlay.append(panel);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.append(overlay);

  try {
    const [offers, audiences] = await Promise.all([fetchOffers(), fetchAudiences()]);
    loadingNote.remove();

    const offerSel = document.createElement('select');
    offerSel.append(new Option('— select an offer —', ''));
    offers.forEach((o) => offerSel.append(new Option(o.name, o.id)));
    form.append(field('Offer', offerSel));

    const audSel = document.createElement('select');
    audSel.append(new Option('All Visitors (no audience)', ''));
    audiences.forEach((a) => audSel.append(new Option(a.name, a.id)));
    form.append(field('Audience', audSel));

    saveBtn.disabled = false;

    saveBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      const mbox = mboxInput.value.trim() || DEFAULT_MBOX;
      const offerId = offerSel.value;
      const audienceId = audSel.value || null;

      if (!name) { nameInput.focus(); return; }
      if (!offerId) { offerSel.focus(); return; }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Creating…';

      const errEl = footer.querySelector('.dt-error') || (() => {
        const el = document.createElement('p');
        el.className = 'dt-error';
        footer.prepend(el);
        return el;
      })();
      errEl.textContent = '';

      try {
        const result = await createXtActivity({ name, mbox, offerId, audienceId });
        if (result.httpStatus >= 400 || result.error) {
          throw new Error(result.errors?.[0]?.message || result.error || 'Create failed');
        }
        overlay.remove();
        onCreated(result);
      } catch (err) {
        errEl.textContent = `Error: ${err.message}`;
        saveBtn.disabled = false;
        saveBtn.textContent = 'Create';
      }
    });
  } catch (err) {
    loadingNote.textContent = `Failed to load data: ${err.message}`;
  }
}

// ── Activities list ──────────────────────────────────────────────────────────

function renderToolbar(onRefresh, onCreate) {
  const bar = document.createElement('div');
  bar.className = 'dt-toolbar';

  const title = document.createElement('h2');
  title.textContent = 'Target Activities';

  const actions = document.createElement('div');
  actions.className = 'dt-toolbar-actions';

  const refreshBtn = document.createElement('button');
  refreshBtn.className = 'dt-btn-secondary';
  refreshBtn.textContent = 'Refresh';
  refreshBtn.addEventListener('click', onRefresh);

  const createBtn = document.createElement('button');
  createBtn.className = 'dt-btn-primary';
  createBtn.textContent = 'Create Activity';
  createBtn.addEventListener('click', onCreate);

  actions.append(refreshBtn, createBtn);
  bar.append(title, actions);
  return bar;
}

function renderTable(activities) {
  const table = document.createElement('table');
  table.className = 'dt-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>ID</th>
        <th>Name</th>
        <th>Type</th>
        <th>State</th>
        <th>Modified</th>
      </tr>
    </thead>
  `;
  const tbody = document.createElement('tbody');

  if (!activities.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="5" class="dt-empty">No activities yet. Click “Create Activity” to add one.</td>';
    tbody.append(tr);
  } else {
    activities.forEach((a) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${a.id}</td>
        <td>${a.name}</td>
        <td>${(a.type ?? '').toUpperCase()}</td>
        <td><span class="dt-state dt-state--${a.state}">${a.state ?? '—'}</span></td>
        <td>${formatDate(a.modifiedAt)}</td>
      `;
      tbody.append(tr);
    });
  }

  table.append(tbody);
  return table;
}

// ── Init ─────────────────────────────────────────────────────────────────────

(async function init() {
  // DA context is available but not required for the shared demo runtime.
  await Promise.race([DA_SDK, new Promise((r) => setTimeout(() => r(null), 1500))]);

  const root = document.createElement('div');
  root.className = 'dt-app';
  document.body.append(root);

  async function load() {
    root.innerHTML = '<p class="dt-loading">Loading Target activities…</p>';
    try {
      const activities = await fetchActivities();
      root.innerHTML = '';
      const toolbar = renderToolbar(load, () => showCreateModal(load));
      root.append(toolbar, renderTable(activities));
    } catch (err) {
      root.innerHTML = `<p class="dt-error">${err.message}</p>`;
    }
  }

  load();
}());
