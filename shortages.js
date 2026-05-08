// ══════════════════════════════════════
// SHORTAGES
// All shortage constants AND functions live here.
// config.js must NOT declare SHORTAGE_TABS or SHORTAGE_DATA_EMBEDDED.
// ══════════════════════════════════════

const SHORTAGE_TABS = {
  bent:      { label:'🔩 Bent Parts (SY)', campus:'SY', key:'bent'      },
  lumber_sy: { label:'🪵 Lumber (SY)',     campus:'SY', key:'lumber_sy' },
  lumber_rx: { label:'🪵 Lumber (RX)',     campus:'RX', key:'lumber_rx' },
};

const SHORTAGE_SEED = [
  // ── Bent Parts ──
  { sku:'PRIVW22801WH',  category:'bent', status:'out_of_stock', notes:'Out of stock', campus:'SY' },
  { sku:'PRIVW22801GY',  category:'bent', status:'out_of_stock', notes:'Out of stock', campus:'SY' },
  { sku:'PRIVW22802BL',  category:'bent', status:'out_of_stock', notes:'Out of stock', campus:'SY' },
  { sku:'PRIVW22802GY',  category:'bent', status:'out_of_stock', notes:'Out of stock', campus:'SY' },
  { sku:'PRIVW22802MA',  category:'bent', status:'out_of_stock', notes:'Out of stock', campus:'SY' },
  { sku:'PR19101BL',     category:'bent', status:'out_of_stock', notes:'Out of stock', campus:'SY' },
  { sku:'PR19102BL',     category:'bent', status:'out_of_stock', notes:'Out of stock', campus:'SY' },
  { sku:'PRTD1104MA',    category:'bent', status:'out_of_stock', notes:'Out of stock', campus:'SY' },
  { sku:'PRCDCW22781WH', category:'bent', status:'out_of_stock', notes:'Out of stock', campus:'SY' },
  { sku:'PRCDCW22781BL', category:'bent', status:'low_quantity', notes:'Low quantity', campus:'SY' },
  { sku:'PRWCW22781BL',  category:'bent', status:'low_quantity', notes:'Low quantity', campus:'SY' },
  // ── Lumber SY ──
  { sku:'.75X24B',       category:'lumber_sy', status:'out_of_stock', notes:'Out of stock', campus:'SY' },
  { sku:'2X2B',          category:'lumber_sy', status:'out_of_stock', notes:'Out of stock', campus:'SY' },
  { sku:'.75X4.5LE',     category:'lumber_sy', status:'out_of_stock', notes:'Out of stock', campus:'SY' },
  { sku:'.75X4.5S',      category:'lumber_sy', status:'out_of_stock', notes:'Out of stock', campus:'SY' },
  { sku:'.75X24S',       category:'lumber_sy', status:'out_of_stock', notes:'Out of stock', campus:'SY' },
  { sku:'.75X4.5T',      category:'lumber_sy', status:'out_of_stock', notes:'Out of stock', campus:'SY' },
  { sku:'.75X4.5TA',     category:'lumber_sy', status:'out_of_stock', notes:'Out of stock', campus:'SY' },
  { sku:'1X3-NTL',       category:'lumber_sy', status:'out_of_stock', notes:'Out of stock', campus:'SY' },
  { sku:'.5X1.5A',       category:'lumber_sy', status:'low_quantity', notes:'2 skids in Lumber WIP', campus:'SY' },
  { sku:'.75X1.5A',      category:'lumber_sy', status:'low_quantity', notes:'2 skids in Lumber WIP — ≤4 skids', campus:'SY' },
  { sku:'.75X2.63A',     category:'lumber_sy', status:'low_quantity', notes:'3 skids in inventory', campus:'SY' },
  { sku:'.75X4.5A',      category:'lumber_sy', status:'low_quantity', notes:'1 skid in Lumber WIP', campus:'SY' },
  { sku:'.75X5.5A',      category:'lumber_sy', status:'low_quantity', notes:'2 skids in inventory — ≤2 skids', campus:'SY' },
  { sku:'.75X11.5A',     category:'lumber_sy', status:'low_quantity', notes:'Low quantity', campus:'SY' },
  { sku:'.75X24A',       category:'lumber_sy', status:'low_quantity', notes:'1 skid in Lumber WIP', campus:'SY' },
  { sku:'1X1.5A',        category:'lumber_sy', status:'low_quantity', notes:'3 skids in inventory', campus:'SY' },
  { sku:'1X2.25A',       category:'lumber_sy', status:'low_quantity', notes:'2 skids in Lumber WIP', campus:'SY' },
  { sku:'1.5X5.5A',      category:'lumber_sy', status:'low_quantity', notes:'1 skid in Lumber WIP', campus:'SY' },
  { sku:'.75X4.5B',      category:'lumber_sy', status:'low_quantity', notes:'Low quantity', campus:'SY' },
  { sku:'2X4B',          category:'lumber_sy', status:'low_quantity', notes:'3 skids in Lumber WIP', campus:'SY' },
  { sku:'.75X1.5G',      category:'lumber_sy', status:'low_quantity', notes:'2 skids in Lumber WIP', campus:'SY' },
  { sku:'1X1.5G',        category:'lumber_sy', status:'low_quantity', notes:'3 skids in Lumber WIP + 1 in storage', campus:'SY' },
  { sku:'.75X24GY',      category:'lumber_sy', status:'low_quantity', notes:'Low quantity', campus:'SY' },
  { sku:'.75X4.5LNV',    category:'lumber_sy', status:'low_quantity', notes:'2 skids in Lumber WIP', campus:'SY' },
  { sku:'1.5X5.5LNV',    category:'lumber_sy', status:'low_quantity', notes:'1 skid in Lumber WIP', campus:'SY' },
  { sku:'.75X4.5M',      category:'lumber_sy', status:'low_quantity', notes:'Running on line 29', campus:'SY' },
  { sku:'.75X24M',       category:'lumber_sy', status:'low_quantity', notes:'Low quantity', campus:'SY' },
  { sku:'1X3-NDW',       category:'lumber_sy', status:'low_quantity', notes:'Low quantity', campus:'SY' },
  { sku:'1X3-NKA',       category:'lumber_sy', status:'low_quantity', notes:'Low quantity', campus:'SY' },
  { sku:'.75X7.5-NTL',   category:'lumber_sy', status:'low_quantity', notes:'Low quantity', campus:'SY' },
  { sku:'1.5X1.75-NTL',  category:'lumber_sy', status:'low_quantity', notes:'Low quantity', campus:'SY' },
  { sku:'.5X1.5PB',      category:'lumber_sy', status:'low_quantity', notes:'Low quantity', campus:'SY' },
  { sku:'.75X4.5SR',     category:'lumber_sy', status:'low_quantity', notes:'2 skids in Lumber WIP', campus:'SY' },
  { sku:'1X5.5T',        category:'lumber_sy', status:'low_quantity', notes:'Low quantity', campus:'SY' },
  { sku:'1.5X5.5T',      category:'lumber_sy', status:'low_quantity', notes:'Low quantity', campus:'SY' },
  { sku:'.75X4.5W',      category:'lumber_sy', status:'low_quantity', notes:'Low quantity', campus:'SY' },
  { sku:'1X5.5W',        category:'lumber_sy', status:'low_quantity', notes:'Extrusion saving — on 1st skid', campus:'SY' },
  { sku:'1.5X2.5W',      category:'lumber_sy', status:'low_quantity', notes:'Low quantity', campus:'SY' },
];

// ── Runtime state ──
let shortageCache      = { bent:[], lumber_sy:[], lumber_rx:[] };
let editingShortageId  = null;

// ══════════════════════════════════════
// LOAD
// ══════════════════════════════════════
async function loadShortages(silent = false) {
  try {
    const rows = await sb('sts_shortages?order=sku.asc&select=*');
    if (!rows || !rows.length) {
      await _seedShortages();
      return loadShortages(silent);
    }
    shortageCache = { bent:[], lumber_sy:[], lumber_rx:[] };
    rows.forEach(r => { if (shortageCache[r.category]) shortageCache[r.category].push(r); });
  } catch(e) {
    // Table doesn't exist yet — use seed data in memory so app still works
    console.warn('sts_shortages not found, using seed data:', e.message);
    shortageCache = { bent:[], lumber_sy:[], lumber_rx:[] };
    SHORTAGE_SEED.forEach(r => {
      if (shortageCache[r.category])
        shortageCache[r.category].push({ ...r, id: r.sku + '_' + r.category });
    });
  }
  if (!silent) renderShortageTab();
  _renderAddBtn();
}

async function _seedShortages() {
  try {
    await sb('sts_shortages', 'POST', SHORTAGE_SEED.map(r => ({
      ...r,
      created_by: currentUser?.name || 'System',
      updated_at: new Date().toISOString(),
    })));
  } catch(e) { console.warn('Seed failed:', e.message); }
}

// ══════════════════════════════════════
// HELPERS (used by schedule.js / bom.js)
// ══════════════════════════════════════
function _allRows() { return Object.values(shortageCache).flat(); }

function getOutOfStockSkus() {
  const campus = currentUser?.campus || 'SY';
  const s = new Set();
  _allRows().forEach(r => {
    if (r.campus === campus && r.status === 'out_of_stock' && !approvedOverrides[r.sku])
      s.add(r.sku.toUpperCase());
  });
  return s;
}

function getLowQtySkus() {
  const campus = currentUser?.campus || 'SY';
  const s = new Set();
  _allRows().forEach(r => {
    if (r.campus === campus && r.status === 'low_quantity' && !approvedOverrides[r.sku])
      s.add(r.sku.toUpperCase());
  });
  return s;
}

function isSKUBlocked(sku)  { return getOutOfStockSkus().has(String(sku || '').toUpperCase()); }
function isSKUGreyList(sku) { return getLowQtySkus().has(String(sku || '').toUpperCase()); }

// ══════════════════════════════════════
// RENDER
// ══════════════════════════════════════
function _renderAddBtn() {
  const wrap = document.getElementById('sh-add-btn-wrap');
  if (!wrap) return;
  wrap.innerHTML = SUP_ROLES.includes(currentUser?.role)
    ? `<button class="btn btn-primary btn-sm" onclick="openShortageAdd()">＋ Add Entry</button>`
    : '';
}

function switchShortageTab(tab) {
  activeShortageTab = tab;
  document.querySelectorAll('.sh-tab').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('stab-' + tab);
  if (btn) btn.classList.add('active');
  renderShortageTab();
}

function renderShortageTab() {
  const content = document.getElementById('shortage-content');
  if (!content) return;

  const tabCfg  = SHORTAGE_TABS[activeShortageTab];
  if (!tabCfg) { content.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-dim);">Unknown tab.</div>'; return; }

  const rows    = shortageCache[tabCfg.key] || [];
  const canEdit = SUP_ROLES.includes(currentUser?.role);
  const outRows = rows.filter(r => r.status === 'out_of_stock');
  const lowRows = rows.filter(r => r.status === 'low_quantity');

  if (!rows.length) {
    content.innerHTML = `<div style="color:var(--green);padding:40px;text-align:center;font-size:15px;">
      ✓ No shortages for ${tabCfg.label}.
      ${canEdit ? `<br><br><button class="btn btn-primary btn-sm" onclick="openShortageAdd()">＋ Add first entry</button>` : ''}
    </div>`;
    return;
  }

  function makeRow(r) {
    const isOut      = r.status === 'out_of_stock';
    const isApproved = !!approvedOverrides[r.sku];
    const bc  = isApproved ? 'badge b-merged' : isOut ? 'badge b-ship' : 'badge b-shortage';
    const bt  = isApproved ? 'APPROVED' : isOut ? 'OUT OF STOCK' : 'LOW QUANTITY';
    const acts = [];
    if (canEdit && !isApproved) acts.push(`<button class="btn btn-success btn-xs" onclick="openShortageApprove('${r.sku}','${(r.notes||'').replace(/'/g,"&#39;")}')">✓ Approve</button>`);
    if (isApproved)              acts.push(`<span style="font-size:11px;color:var(--green);">✓ ${approvedOverrides[r.sku]}</span>`);
    if (canEdit)                 acts.push(`<button class="btn btn-ghost btn-xs" onclick="openShortageEdit('${r.id}')">✏ Edit</button>`);
    return `<tr>
      <td style="font-family:var(--mono);font-size:13px;font-weight:700;">${r.sku}</td>
      <td><span class="${bc}">${bt}</span></td>
      <td style="font-size:12px;color:var(--text-muted);">${r.notes||'—'}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap;">${acts.join('')}</td>
    </tr>`;
  }

  let html = '';
  if (outRows.length)
    html += `<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--red);padding:10px 0 6px;">🚫 Out of Stock — Blocked (${outRows.length})</div>
    <table class="sh-table"><thead><tr><th>SKU / Profile</th><th>Status</th><th>Notes</th><th>Actions</th></tr></thead>
    <tbody>${outRows.map(makeRow).join('')}</tbody></table>`;
  if (lowRows.length)
    html += `<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--yellow);padding:14px 0 6px;">⚠ Low Quantity — Supervisor Approval Required (${lowRows.length})</div>
    <table class="sh-table"><thead><tr><th>SKU / Profile</th><th>Status</th><th>Notes</th><th>Actions</th></tr></thead>
    <tbody>${lowRows.map(makeRow).join('')}</tbody></table>`;

  content.innerHTML = html;
}

// ══════════════════════════════════════
// ADD / EDIT MODAL
// ══════════════════════════════════════
function openShortageAdd() {
  editingShortageId = null;
  document.getElementById('modal-shortage-edit-title').textContent    = 'Add Shortage Entry';
  document.getElementById('modal-shortage-edit-sku').value            = '';
  document.getElementById('modal-shortage-edit-tab').value            = activeShortageTab;
  document.getElementById('modal-shortage-edit-status').value         = 'out_of_stock';
  document.getElementById('modal-shortage-edit-notes').value          = '';
  document.getElementById('modal-shortage-edit-campus').value         = currentUser?.campus || 'SY';
  document.getElementById('modal-shortage-edit-delete').style.display = 'none';
  document.getElementById('modal-shortage-edit-sku').disabled         = false;
  document.getElementById('modal-shortage-edit').classList.add('open');
  setTimeout(() => document.getElementById('modal-shortage-edit-sku').focus(), 100);
}

function openShortageEdit(id) {
  const row = _allRows().find(r => String(r.id) === String(id));
  if (!row) return;
  editingShortageId = id;
  document.getElementById('modal-shortage-edit-title').textContent    = 'Edit Shortage Entry';
  document.getElementById('modal-shortage-edit-sku').value            = row.sku;
  document.getElementById('modal-shortage-edit-tab').value            = row.category;
  document.getElementById('modal-shortage-edit-status').value         = row.status;
  document.getElementById('modal-shortage-edit-notes').value          = row.notes || '';
  document.getElementById('modal-shortage-edit-campus').value         = row.campus;
  document.getElementById('modal-shortage-edit-delete').style.display = '';
  document.getElementById('modal-shortage-edit-sku').disabled         = false;
  document.getElementById('modal-shortage-edit').classList.add('open');
}

async function saveShortageEntry() {
  const sku      = document.getElementById('modal-shortage-edit-sku').value.trim().toUpperCase();
  const category = document.getElementById('modal-shortage-edit-tab').value;
  const status   = document.getElementById('modal-shortage-edit-status').value;
  const notes    = document.getElementById('modal-shortage-edit-notes').value.trim();
  const campus   = document.getElementById('modal-shortage-edit-campus').value;
  if (!sku) { toast('SKU / Profile is required', 'err'); return; }
  const payload  = { sku, category, status, notes, campus, created_by: currentUser.name, updated_at: new Date().toISOString() };
  try {
    if (editingShortageId) await sb('sts_shortages?id=eq.' + editingShortageId, 'PATCH', payload, { prefer:'return=minimal' });
    else                   await sb('sts_shortages', 'POST', [payload]);
    toast(editingShortageId ? 'Entry updated' : 'Entry added', 'ok');
    closeModal('modal-shortage-edit');
    await loadShortages(true);
    renderShortageTab();
    if (scheduleItems.length) render();
  } catch(e) { toast('Save failed: ' + e.message, 'err'); }
}

async function deleteShortageEntry() {
  if (!editingShortageId) return;
  const row = _allRows().find(r => String(r.id) === String(editingShortageId));
  if (!confirm(`Remove shortage entry for ${row?.sku || editingShortageId}?`)) return;
  try {
    await sb('sts_shortages?id=eq.' + editingShortageId, 'DELETE');
    toast('Entry removed', 'ok');
    closeModal('modal-shortage-edit');
    await loadShortages(true);
    renderShortageTab();
    if (scheduleItems.length) render();
  } catch(e) { toast('Delete failed: ' + e.message, 'err'); }
}

// ══════════════════════════════════════
// APPROVE OVERRIDE
// ══════════════════════════════════════
function openShortageApprove(sku, notes) {
  pendingShortageApproval = sku;
  const isOut = isSKUBlocked(sku);
  document.getElementById('sh-approve-sub').textContent =
    `${sku} is ${isOut ? 'OUT OF STOCK' : 'LOW QUANTITY'}${notes ? ' — ' + notes : ''}.`;
  document.getElementById('sh-approve-reason').value = '';
  document.getElementById('modal-sh-approve').classList.add('open');
}

function confirmShortageApprove() {
  const reason = document.getElementById('sh-approve-reason').value.trim();
  if (!reason) { toast('Please enter a reason', 'err'); return; }
  approvedOverrides[pendingShortageApproval] = reason;
  toast('✓ Override approved for ' + pendingShortageApproval, 'ok');
  closeModal('modal-sh-approve');
  renderShortageTab();
  if (scheduleItems.length) render();
}