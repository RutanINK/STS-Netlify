// ══════════════════════════════════════
// APP — boot, page routing, event wiring
// ══════════════════════════════════════

// ── Boot ──
function bootApp() {
  // If this file was opened via index-sy.html or index-rx.html, force the campus
  if (CAMPUS_OVERRIDE) currentUser.campus = CAMPUS_OVERRIDE;

  document.getElementById('page-login').style.display = 'none';
  document.getElementById('page-login').classList.remove('active');
  document.getElementById('main-header').style.display = 'flex';

  const initials = currentUser.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  document.getElementById('hdr-avatar').textContent = initials;
  document.getElementById('hdr-name').textContent   = currentUser.name;
  document.getElementById('hdr-role').textContent   = currentUser.role.replace(/_/g, ' ');

  const pill = document.getElementById('campus-pill');
  pill.textContent  = currentUser.campus;
  pill.className    = 'campus-pill campus-' + currentUser.campus;

  document.getElementById('tab-dashboard').style.display  = DASH_ROLES.includes(currentUser.role) ? '' : 'none';
  document.getElementById('view-as-select').style.display = currentUser.role === 'admin' ? '' : 'none';
  _applyRoleVisibility();

  loadShortages(true);

  // Load blacklisted orders
  sb(`sts_blacklisted_orders?campus=eq.${currentUser.campus}&select=order_number`)
    .then(rows => { if (rows) rows.forEach(r => blacklistedOrders.add(r.order_number)); })
    .catch(e => {
      if (isMissingTableError(e, 'sts_blacklisted_orders')) blacklistedOrders = new Set();
      else console.warn('Blacklist load failed:', e.message);
    });

  // Load My Cells from localStorage
  _loadMyCellsFromStorage();

  // Populate edit-card material dropdowns
  _populateEditMatSelects(50);

  // Try loading BOM from Supabase storage — fire and forget, never blocks boot
  loadBOMFromSupabase()
    .then(found => { if (found) _updateBOMStatus(); })
    .catch(() => { /* bucket not created yet, skip silently */ });

  if (MAT_ROLES.includes(currentUser.role)) { showPage('schedule'); showMatHandlerView(currentUser.role); }
  else showPage('schedule');
}

function applyViewAs(role) {
  activeViewAs = role;
  if (!role) {
    document.getElementById('mat-handler-view').style.display  = 'none';
    document.getElementById('schedule-list').style.display     = '';
    document.getElementById('empty-state').style.display       = scheduleItems.length ? 'none' : 'block';
    render();
  } else {
    showMatHandlerView(role);
  }
}

// ── View Cell Schedule — loads a cell's latest schedule into the Schedule tab read-only ──
async function editCellSchedule(cellNameVal) {
  if (!cellNameVal) return;
  document.getElementById('overlay-cell').classList.remove('open');
  try {
    const scheds = await sb(`sts_schedules?cell_name=eq.${encodeURIComponent(cellNameVal)}&campus=eq.${currentUser.campus}&order=created_at.desc&limit=1&select=id`);
    if (!scheds || !scheds.length) { toast('No saved schedule found for ' + cellNameVal, 'info'); return; }
    showPage('schedule');
    await loadSchedule(scheds[0].id);
  } catch(e) { toast('Load failed: ' + e.message, 'err'); }
}


function showPage(p) {
  document.querySelectorAll('.page').forEach(el => { el.style.display = 'none'; el.classList.remove('active'); });
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

  const tab = document.getElementById('tab-' + p);
  const pg  = document.getElementById('page-' + p);

  if (tab) tab.classList.add('active');
  if (!pg) {
    console.warn('Missing page:', p);
    return;
  }

  pg.style.display = 'flex';
  pg.classList.add('active');

  if (p === 'dashboard')   loadDashboard();
  if (p === 'board')       { loadBoard(); startLivePoll(); }
  if (p === 'shortages') {
    const savedTab = sessionStorage.getItem('sts_active_shortage_tab');
    if (savedTab && typeof SHORTAGE_TABS !== 'undefined' && SHORTAGE_TABS[savedTab]) activeShortageTab = savedTab;
    renderShortageTab();
  }
  if (p === 'bom')         { _updateBOMStatus(); }
  if (p === 'mycells')     { loadMyCellsList(); }
  if (p === 'warrantymgr') { loadWarrantyMgr(); }
  if (p === 'blacklist')   { loadBlacklistManager(); }

  document.getElementById('totals-bar').style.display = (p === 'schedule' && scheduleItems.length) ? 'flex' : 'none';
  if (p !== 'board') stopLivePoll();
}

// ── BOM upload handler ──
async function handleBOMUpload(input) {
  const file = input.files[0];
  if (!file) return;

  const progressEl = document.getElementById('bom-upload-progress');
  const statusEl   = document.getElementById('bom-status');

  if (progressEl) { progressEl.style.display = 'block'; progressEl.textContent = 'Parsing CSV…'; }
  if (statusEl)   statusEl.textContent = 'Parsing…';

  try {
    const result = await loadBOMFromFile(file);
    _updateBOMStatus();

    if (progressEl) progressEl.textContent = 'Uploading to server…';
    const uploaded = await uploadBOMToSupabase(file);

    if (progressEl) {
      progressEl.textContent = uploaded
        ? `Saved to server — all users will load this BOM automatically`
        : `Loaded locally (Supabase storage bucket not set up yet)`;
      setTimeout(() => { if (progressEl) progressEl.style.display = 'none'; }, 5000);
    }

    toast(`BOM loaded — ${result.components.toLocaleString()} components → ${result.finishedSkus?.toLocaleString() || '?'} base SKUs`, 'ok');
    if (scheduleItems.length) render();
  } catch(e) {
    if (statusEl)   statusEl.textContent = 'Failed: ' + e.message;
    if (progressEl) { progressEl.textContent = '' + e.message; }
    toast('BOM parse failed: ' + e.message, 'err');
  }
  input.value = '';
}

function _updateBOMStatus() {
  const el = document.getElementById('bom-status');
  if (!el) return;

  const stats = getBOMStats();
  if (!stats) {
    el.innerHTML = `
      <span style="color:var(--yellow);font-weight:700;">BOM not loaded</span><br>
      <span style="color:var(--text-muted);font-size:13px;">
        Upload <code>bom_latest.csv</code> to the <code>sts-bom</code> Supabase Storage bucket or use the BOM upload control.
      </span>`;
    el.style.color = 'var(--text-muted)';
    return;
  }

  const source = stats.source || (typeof bomSource !== 'undefined' ? bomSource : 'unknown');
  const sourceLabel = source === 'supabase'
    ? '<span style="color:var(--green);font-weight:700;">Loaded from Supabase Storage</span>'
    : source === 'local'
      ? '<span style="color:var(--yellow);font-weight:700;">Loaded locally only</span>'
      : '<span style="color:var(--text-muted);font-weight:700;">Loaded</span>';

  const meta = stats.storage || (typeof bomStorageMeta !== 'undefined' ? bomStorageMeta : null) || {};
  const updated = meta.updated_at || meta.created_at ? new Date(meta.updated_at || meta.created_at).toLocaleString() : null;
  const size = meta.size ? `${Math.round(Number(meta.size) / 1024).toLocaleString()} KB` : null;

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:5px;">
      <div><span style="color:var(--green);font-weight:700;">✓ BOM active</span> &nbsp;—&nbsp; ${sourceLabel}</div>
      <div>
        <strong style="color:var(--text);">${stats.components.toLocaleString()}</strong> components mapped to
        <strong style="color:var(--text);">${stats.finishedSkus.toLocaleString()}</strong> finished SKU keys
        <span style="color:var(--text-dim);">(${stats.rows.toLocaleString()} rows total)</span>
      </div>
      ${updated || size ? `<div style="font-size:12px;color:var(--text-muted);">${updated ? `Storage timestamp: ${updated}` : ''}${updated && size ? ' · ' : ''}${size ? `File size: ${size}` : ''}</div>` : ''}
      ${source === 'local' ? `<div style="font-size:12px;color:var(--yellow);">This BOM is only loaded in this browser session. Upload-to-server did not complete, so other users may not have it.</div>` : ''}
    </div>`;
  el.style.color = '';
}

// ── Live Board Polling ──
let livePollTimer = null;
let lastBoardSnapshot = '';

function startLivePoll() {
  stopLivePoll();
  livePollTimer = setInterval(async () => {
    try {
      // Pull the latest schedule timestamps for this campus
      const scheds = await sb(`sts_schedules?campus=eq.${currentUser.campus}&order=created_at.desc&limit=60&select=id,cell_name,created_at`);
      const snapshot = JSON.stringify(scheds.map(s => s.id + s.created_at));
      if (lastBoardSnapshot && snapshot !== lastBoardSnapshot) {
        showLiveBanner('Schedules updated — refreshing board…');
        await loadBoard();
      }
      lastBoardSnapshot = snapshot;
    } catch(e) { /* silent — don't disrupt the user */ }
  }, LIVE_POLL_MS);
}

function stopLivePoll() {
  if (livePollTimer) { clearInterval(livePollTimer); livePollTimer = null; }
  hideLiveBanner();
}

let bannerTimer = null;
function showLiveBanner(msg) {
  const el = document.getElementById('live-banner');
  el.innerHTML = `<div class="live-banner-dot"></div><span>${msg}</span>`;
  el.style.display = 'flex';
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(hideLiveBanner, 6000);
}
function hideLiveBanner() {
  document.getElementById('live-banner').style.display = 'none';
}

// ── Utility ──
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

let toastTimer;
function toast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = 'show ' + type;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.className = '', 3200);
}


function isMissingTableError(e, tableName) {
  const msg = String(e?.message || e || '');
  return msg.includes(`Could not find the table 'public.${tableName}'`) || msg.includes(`Could not find the table "public.${tableName}"`);
}

function normOrderNumber(value) {
  return String(value || '').trim().toUpperCase();
}

function blacklistSetupHtml() {
  return `<div class="blacklist-setup">
    <div style="font-weight:700;color:var(--yellow);margin-bottom:8px;">Blacklist table is not set up yet.</div>
    <div style="font-size:var(--fs-sm);color:var(--text-muted);margin-bottom:10px;">Create <code>public.sts_blacklisted_orders</code> in Supabase, then refresh this page. Until then, STS will simply treat the blacklist as empty.</div>
    <pre class="sql-snippet">create table if not exists public.sts_blacklisted_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null,
  campus text not null,
  blocked_by text,
  created_at timestamptz not null default now(),
  unique (campus, order_number)
);</pre>
  </div>`;
}


function countBlacklistedOrdersInParsedItems(result) {
  if (!result || !Array.isArray(result.items) || !blacklistedOrders.size) return 0;
  const blockedSet = new Set([...blacklistedOrders].map(normOrderNumber).filter(Boolean));
  let count = 0;
  result.items.forEach(it => {
    (it.orderBreakdown || []).forEach(ob => {
      if (ob.orderNum && blockedSet.has(normOrderNumber(ob.orderNum))) count++;
    });
  });
  return count;
}

// ── Event wiring ──
document.getElementById('btn-parse').addEventListener('click', async () => {
  const raw = document.getElementById('raw-input').value.trim();
  const errEl = document.getElementById('parse-error');
  errEl.style.display = 'none';

  if (!raw) {
    errEl.textContent = 'Paste data first.';
    errEl.style.display = 'block';
    return;
  }

  try {
    // Refresh blacklist so blocked orders display immediately, but never remove them from the parsed schedule.
    if (typeof refreshBlacklistedOrdersBeforeSave === 'function') await refreshBlacklistedOrdersBeforeSave();

    const result = parseRaw(raw);
    const parsedBlockedOrders = countBlacklistedOrdersInParsedItems(result);

    if (!result.items.length) {
      errEl.textContent = 'No SKUs found.';
      errEl.style.display = 'block';
      return;
    }

    const parsedCell = result.cellName;
    const isVariant  = scheduleItems.length > 0 && (cellName === parsedCell || areCellVariants(cellName, parsedCell));

    if (scheduleItems.length > 0 && !isVariant) {
      if (!confirm(`You have a schedule for ${cellName} loaded. Replace with ${parsedCell}?`)) return;
      scheduleItems = [];
      variantSources = [];
    }

    variantSources.push({ cellName: parsedCell, items: result.items });

    // Warn about blocked/grey-list SKUs (direct shortage OR via BOM lookup). Do not remove them.
    const blockedItems  = result.items.filter(it => isSKUBlocked(it.sku) || getBOMBlockReason(it.sku)?.status === 'out_of_stock');
    const greyItems     = result.items.filter(it => !isSKUBlocked(it.sku) && (isSKUGreyList(it.sku) || getBOMBlockReason(it.sku)?.status === 'low_quantity'));

    if (parsedBlockedOrders) toast(`${parsedBlockedOrders} blocked order${parsedBlockedOrders !== 1 ? 's' : ''} found. They remain visible but must be removed before save.`, 'err');
    if (blockedItems.length && !SUP_ROLES.includes(currentUser.role)) toast(`${blockedItems.length} SKU${blockedItems.length !== 1 ? 's' : ''} blocked due to component shortage.`, 'err');
    if (greyItems.length && !SUP_ROLES.includes(currentUser.role)) toast(`${greyItems.length} SKU${greyItems.length !== 1 ? 's' : ''} have low-quantity components — supervisor approval required.`, 'info');

    if (scheduleItems.length === 0) {
      cellName = parsedCell;
      scheduleItems = result.items;
    } else {
      scheduleItems = [...scheduleItems, ...result.items];
      const baseNum = baseCellNum(cellName);
      if (baseNum) cellName = 'Cell ' + String(baseNum).padStart(2, '0') + ' (combined)';
    }

    savedScheduleId = null;
    lastSavedState = null;
    mhCheckState = {};
    orderDoneState = {};

    document.getElementById('raw-input').value = '';
    document.getElementById('paste-panel').style.display = 'none';
    updateVariantButtons();
    render();
    markUnsaved();

    toast(`Parsed ${result.items.length} SKU${result.items.length !== 1 ? 's' : ''} — ${parsedCell}${parsedBlockedOrders ? ` (${parsedBlockedOrders} blocked order${parsedBlockedOrders !== 1 ? 's' : ''} must be removed before save)` : ''}`, 'ok');
  } catch (e) {
    errEl.textContent = '' + e.message;
    errEl.style.display = 'block';
  }
});

document.getElementById('btn-save').addEventListener('click', openSaveModal);
document.getElementById('btn-save-cancel').addEventListener('click', () => { pendingPrintAfterSave = false; closeModal('modal-save'); });
document.getElementById('btn-save-confirm').addEventListener('click', doSave);

document.getElementById('btn-print').addEventListener('click', () => {
  if (hasUnsavedChanges()) { pendingPrintAfterSave = true; openSaveModal(); toast('Save first to print', 'info'); }
  else window.print();
});

document.getElementById('btn-clear').addEventListener('click', () => {
  if (!confirm('Clear current schedule?')) return;
  scheduleItems = []; cellName = ''; savedScheduleId = null; lastSavedState = null; variantSources = []; orderDoneState = {};
  document.getElementById('paste-panel').style.display   = 'block';
  document.getElementById('meta-saved').style.display    = 'none';
  document.getElementById('sched-meta').style.display    = 'none';
  updateVariantButtons(); render();
});

document.getElementById('btn-handoff').addEventListener('click', openHandoff);
document.getElementById('btn-load-warranty').addEventListener('click', loadWarrantiesManual);
document.getElementById('btn-load-warranty-current').addEventListener('click', loadWarrantiesManual);

document.getElementById('btn-load-saved').addEventListener('click', async () => {
  const p = document.getElementById('saved-panel');
  if (p.style.display === 'block') { p.style.display = 'none'; return; }
  p.style.display = 'block';
  const list = document.getElementById('saved-list');
  list.innerHTML = '<span style="color:var(--text-muted);font-size:12px;">Loading…</span>';
  try {
    const canSeeAll = DASH_ROLES.includes(currentUser.role);
    const filter = canSeeAll
      ? `sts_schedules?campus=eq.${currentUser.campus}&order=created_at.desc&limit=30&select=id,cell_name,created_by,created_at`
      : `sts_schedules?campus=eq.${currentUser.campus}&employee_id=eq.${currentUser.id}&order=created_at.desc&limit=20&select=id,cell_name,created_by,created_at`;
    const rows = await sb(filter);
    if (!rows || !rows.length) { list.innerHTML = '<span style="color:var(--text-dim);font-size:12px;">No saved schedules yet.</span>'; return; }
    list.innerHTML = rows.map(r => `<div class="saved-row">
      <div class="saved-row-left">
        <span class="saved-cell">${r.cell_name}</span>
        <div class="saved-meta">
          <span class="saved-time">${new Date(r.created_at).toLocaleString()}</span>
          <span class="saved-by">by ${r.created_by}</span>
        </div>
      </div>
      <div class="saved-row-right">
      <button class="btn btn-ghost btn-xs" onclick="loadSchedule('${r.id}')">Load</button>
        ${canSeeAll || r.created_by === currentUser.name ? `<button class="btn btn-danger btn-xs" onclick="deleteSchedule('${r.id}',this)">Delete</button>` : ''}
      </div>
    </div>`).join('');
  } catch (e) { list.innerHTML = '<span style="color:var(--red);font-size:12px;">' + e.message + '</span>'; }
});

function openAddVariant() {
  document.getElementById('paste-panel').style.display = 'block';
  document.getElementById('raw-input').value = '';
  document.getElementById('raw-input').focus();
  document.getElementById('parse-error').style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  toast("Paste the next variant's data and click Parse", 'info');
}

function combineVariants() {
  if (variantSources.length < 2) { toast('Need at least 2 variants to combine', 'info'); return; }
  const combined = [];
  scheduleItems.forEach(it => {
    const ex = combined.find(m => m.sku === it.sku && m.dueDate === it.dueDate);
    if (ex) {
      ex.qty += it.qty; ex.totalQty += it.totalQty; ex.taktMins += it.taktMins; ex.taktStr = fmtTakt(ex.taktMins);
      ex.orderNums = [...new Set([...ex.orderNums, ...it.orderNums])]; ex.mustShip = ex.mustShip || it.mustShip;
      ex.merged = true; ex.orderBreakdown.push(...it.orderBreakdown);
      if (!ex.sourceCells.includes(it.sourceCell)) ex.sourceCells.push(it.sourceCell);
    } else { combined.push({ ...it, sourceCells: [it.sourceCell] }); }
  });
  scheduleItems = combined;
  const baseNum = baseCellNum(variantSources[0].cellName);
  cellName = 'Cell ' + String(baseNum).padStart(2, '0') + ' (combined)';
  render(); markUnsaved(); toast(`Combined ${variantSources.length} variants — ${scheduleItems.length} unique SKU groups`, 'ok');
  document.getElementById('btn-combine-variants').style.display = 'none';
}

function updateVariantButtons() {
  // Schedules are locked after parse; variant/combine editing controls remain hidden.
  const addBtn  = document.getElementById('btn-add-variant');
  const combBtn = document.getElementById('btn-combine-variants');
  if (addBtn)  addBtn.style.display  = 'none';
  if (combBtn) combBtn.style.display = 'none';
}

// ── Supervisor tab visibility ──
function _applyRoleVisibility() {
  document.getElementById('tab-dashboard').style.display   = DASH_ROLES.includes(currentUser.role) ? '' : 'none';
  const blTab = document.getElementById('tab-blacklist');
  if (blTab) blTab.style.display = SUP_ROLES.includes(currentUser.role) ? '' : 'none';
  document.getElementById('tab-warrantymgr').style.display = SUP_ROLES.includes(currentUser.role)  ? '' : 'none';
}


// ── Supervisor Blacklist Manager ──
async function loadBlacklistManager() {
  const list = document.getElementById('blacklist-list');
  if (!list) return;
  if (!SUP_ROLES.includes(currentUser.role)) {
    list.innerHTML = '<div style="color:var(--text-dim);padding:24px;">This page is restricted to supervisors, managers, and admins.</div>';
    return;
  }
  list.innerHTML = '<div style="color:var(--text-muted);padding:24px;">Loading...</div>';
  try {
    const rows = await sb(`sts_blacklisted_orders?campus=eq.${currentUser.campus}&order=created_at.desc&select=id,order_number,blocked_by,created_at`);
    blacklistedOrders = new Set((rows || []).map(r => normOrderNumber(r.order_number)).filter(Boolean));
    renderBlacklistRows(rows || []);
  } catch(e) {
    if (isMissingTableError(e, 'sts_blacklisted_orders')) {
      blacklistedOrders = new Set();
      list.innerHTML = blacklistSetupHtml();
    } else {
      list.innerHTML = `<div style="color:var(--red);padding:24px;">Failed to load blacklist: ${esc(e.message)}</div>`;
    }
  }
}

function renderBlacklistRows(rows) {
  const list = document.getElementById('blacklist-list');
  if (!list) return;
  if (!rows.length) {
    list.innerHTML = '<div style="color:var(--text-dim);padding:28px;text-align:center;">No blocked orders for this campus.</div>';
    return;
  }
  list.innerHTML = rows.map(r => `<div class="blacklist-row">
    <div>
      <div class="blacklist-order">${esc(r.order_number)}</div>
      <div class="blacklist-meta">Blocked by ${esc(r.blocked_by || 'Unknown')} · ${r.created_at ? new Date(r.created_at).toLocaleString() : 'No date'}</div>
    </div>
    <button class="btn btn-danger btn-xs" onclick="removeBlacklistOrder('${esc(r.id)}','${esc(r.order_number)}',this)">Remove</button>
  </div>`).join('');
}

async function addBlacklistOrder() {
  if (!SUP_ROLES.includes(currentUser.role)) return;
  const input = document.getElementById('blacklist-order-input');
  const orderNum = (input?.value || '').trim().toUpperCase();
  if (!orderNum) { toast('Enter an order number', 'err'); return; }
  if (blacklistedOrders.has(normOrderNumber(orderNum))) { toast('Order is already blocked', 'info'); return; }
  try {
    const [created] = await sb('sts_blacklisted_orders?select=id,order_number,blocked_by,created_at', 'POST', [{
      order_number: orderNum,
      blocked_by: currentUser.name,
      campus: currentUser.campus,
      created_at: new Date().toISOString()
    }]);
    blacklistedOrders.add(normOrderNumber(orderNum));
    if (input) input.value = '';
    logAction(LOG.ORDER_BLACKLISTED, { order_number: orderNum });
    await loadBlacklistManager();
    if (scheduleItems.length) render();
    toast('Order ' + orderNum + ' blocked', 'ok');
  } catch(e) {
    if (isMissingTableError(e, 'sts_blacklisted_orders')) {
      const list = document.getElementById('blacklist-list');
      if (list) list.innerHTML = blacklistSetupHtml();
      toast('Blacklist table is not set up yet', 'err');
    } else {
      toast('Blacklist save failed: ' + e.message, 'err');
    }
  }
}

async function removeBlacklistOrder(id, orderNum, btn) {
  if (!SUP_ROLES.includes(currentUser.role)) return;
  if (btn) { btn.disabled = true; btn.textContent = 'Removing...'; }
  try {
    await sb('sts_blacklisted_orders?id=eq.' + encodeURIComponent(id), 'DELETE');
    blacklistedOrders.delete(normOrderNumber(orderNum));
    logAction(LOG.ORDER_UNBLACKLISTED, { order_number: orderNum });
    await loadBlacklistManager();
    if (scheduleItems.length) render();
    toast('Order ' + orderNum + ' unblocked', 'ok');
  } catch(e) {
    if (isMissingTableError(e, 'sts_blacklisted_orders')) {
      const list = document.getElementById('blacklist-list');
      if (list) list.innerHTML = blacklistSetupHtml();
      toast('Blacklist table is not set up yet', 'err');
    } else {
      toast('Remove failed: ' + e.message, 'err');
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Remove'; }
  }
}

// ── My Cells — user manages their own list ──
const MY_CELLS_KEY = 'sts_my_cells_' + (currentUser?.id || 'guest');

function _loadMyCellsFromStorage() {
  try {
    const raw = localStorage.getItem('sts_my_cells_' + currentUser.id);
    if (raw) myCellsList = JSON.parse(raw);
  } catch {}
}

function _saveMyCellsToStorage() {
  try { localStorage.setItem('sts_my_cells_' + currentUser.id, JSON.stringify(myCellsList)); } catch {}
}

function _allCampusCells() {
  const cells = [];
  Object.values(BUILDINGS).forEach(b => b.cells.forEach(n => cells.push('Cell ' + String(n).padStart(2,'0'))));
  return cells;
}

function openManageCells() {
  const all  = _allCampusCells();
  const grid = document.getElementById('manage-cells-grid');
  grid.innerHTML = all.map(c => {
    const sel = myCellsList.includes(c) ? 'selected' : '';
    return `<button class="cell-pick-btn ${sel}" onclick="this.classList.toggle('selected')" data-cell="${c}">${c}</button>`;
  }).join('');
  document.getElementById('modal-manage-cells').classList.add('open');
}

function saveMyCells() {
  const btns = document.querySelectorAll('#manage-cells-grid .cell-pick-btn.selected');
  myCellsList = Array.from(btns).map(b => b.dataset.cell);
  _saveMyCellsToStorage();
  closeModal('modal-manage-cells');
  renderMyCellsCards();
  toast('My Cells updated', 'ok');
}

function renderMyCellsCards() {
  const wrap = document.getElementById('mycells-cards');
  if (!wrap) return;
  if (!myCellsList.length) {
    wrap.innerHTML = '<div style="color:var(--text-dim);font-size:var(--fs-sm);">No cells selected. Click "Manage My Cells" to add cells.</div>';
    return;
  }
  wrap.innerHTML = myCellsList.map(c =>
    `<button class="mycell-card-btn" onclick="loadMyCellSchedule('${c}',this)">${c}</button>`
  ).join('');
}

async function loadMyCellsList() {
  _loadMyCellsFromStorage();
  renderMyCellsCards();
}

async function loadMyCellSchedule(cellNameVal, btn) {
  if (!cellNameVal) return;
  // Highlight active button
  document.querySelectorAll('.mycell-card-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const listEl = document.getElementById('mycells-list');
  const infoEl = document.getElementById('mycells-info');
  listEl.innerHTML = '<div style="color:var(--text-muted);padding:40px;text-align:center;">Loading…</div>';
  infoEl.style.display = 'none';
  try {
    const scheds = await sb(`sts_schedules?cell_name=eq.${encodeURIComponent(cellNameVal)}&campus=eq.${currentUser.campus}&order=created_at.desc&limit=1&select=id,cell_name,created_by,created_at`);
    if (!scheds || !scheds.length) {
      listEl.innerHTML = `<div style="color:var(--text-dim);padding:40px;text-align:center;">No schedule found for ${cellNameVal}.</div>`;
      return;
    }
    const sched = scheds[0];
    const items = await sb(`sts_schedule_items?schedule_id=eq.${sched.id}&order=sort_order.asc`);
    infoEl.textContent = 'Schedule saved by ' + sched.created_by + ' on ' + new Date(sched.created_at).toLocaleString();
    infoEl.style.display = 'block';

    if (!items || !items.length) {
      listEl.innerHTML = '<div style="color:var(--text-dim);padding:40px;text-align:center;">Schedule is empty.</div>';
      return;
    }
    let html = ''; let lastDue = null;
    items.forEach(it => {
      const due = it.due_date || '—';
      if (due !== lastDue) {
        const dateCls = 'due-group-header' + (isDueOverdue(it.due_date) ? ' overdue' : isDueSoon(it.due_date) ? ' soon' : '');
        html += `<div class="${dateCls}">Due: ${due}</div>`;
        lastDue = due;
      }
      const mustShipBadge  = it.must_ship ? '<span class="badge b-ship">Must Ship</span>' : '';
      const warrantyBadge  = it.order_type === 'warranty'    ? '<span class="badge b-warranty">Warranty</span>' : '';
      const replaceBadge   = it.order_type === 'replacement' ? '<span class="badge b-replacement">Full Repl.</span>' : '';
      html += `<div class="sku-card mycell-readonly">
        <div class="card-row">
          <div class="card-sku">
            <div class="card-sku-top">
              <span class="card-sku-name">${it.sku}</span>
              <span class="takt-pill">${fmtTakt(it.takt_minutes)}</span>
              <div class="card-badges">${mustShipBadge}${warrantyBadge}${replaceBadge}</div>
            </div>
            <div class="card-qty-block qty-clean">
              <span class="card-qty-label">QTY</span>
              <span class="card-qty-value">${it.quantity}</span>
            </div>
            ${it.order_number ? `<div class="card-orders-wrap"><span class="order-row-num" style="font-size:var(--fs-xs);">Order: ${it.order_number}</span></div>` : ''}
          </div>
        </div>
      </div>`;
    });
    listEl.innerHTML = html;
  } catch(e) {
    listEl.innerHTML = `<div style="color:var(--red);padding:20px;">Failed to load: ${e.message}</div>`;
  }
}

// ── Warranty Manager (supervisor) ──
let wmAllItems = [];

async function loadWarrantyMgr() {
  document.getElementById('wm-inspections').innerHTML = '<div style="color:var(--text-muted);padding:16px;">Loading…</div>';
  document.getElementById('wm-items').innerHTML       = '<div style="color:var(--text-muted);padding:16px;">Loading…</div>';

  try {
    // Pending inspections
    const inspections = await sb(`sts_inspection_queue?campus=eq.${currentUser.campus}&status=eq.pending&order=created_at.desc&limit=50`)
      .catch(() => []);
    _renderInspections(inspections || []);

    // Get today's schedules — only the latest per cell
    const today  = new Date(); today.setHours(0,0,0,0);
    const scheds = await sb(`sts_schedules?campus=eq.${currentUser.campus}&created_at=gte.${today.toISOString()}&order=created_at.desc&limit=60&select=id,cell_name,created_by,created_at`);
    if (!scheds || !scheds.length) {
      document.getElementById('wm-items').innerHTML = '<div style="color:var(--text-dim);padding:16px;">No schedules found today.</div>';
      return;
    }

    // Keep only the most recent schedule per cell
    const latestByCell = {};
    scheds.forEach(s => { if (!latestByCell[s.cell_name]) latestByCell[s.cell_name] = s; });
    const latestScheds = Object.values(latestByCell);

    // Pull warranty/replacement items from each latest schedule only
    wmAllItems = [];
    const seenOrders = new Set(); // deduplicate by order_number
    await Promise.all(latestScheds.map(async s => {
      const rows = await sb(`sts_schedule_items?schedule_id=eq.${s.id}&order_type=in.(warranty,replacement)&select=*`).catch(() => []);
      (rows || []).forEach(r => {
        const key = r.order_number ? String(r.order_number).toUpperCase() : `${s.id}_${r.sku}_${r.sort_order}`;
        if (!seenOrders.has(key)) {
          seenOrders.add(key);
          wmAllItems.push({ ...r, cell_name: s.cell_name, saved_by: s.created_by });
        }
      });
    }));

    // Populate cell filter
    const cells = [...new Set(wmAllItems.map(r => r.cell_name))].sort();
    const sel   = document.getElementById('wm-cell-filter');
    while (sel.options.length > 1) sel.remove(1);
    cells.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; sel.appendChild(o); });

    renderWarrantyMgrItems();
  } catch(e) {
    document.getElementById('wm-items').innerHTML = `<div style="color:var(--red);padding:16px;">${e.message}</div>`;
  }
}

function _renderInspections(rows) {
  const el = document.getElementById('wm-inspections');
  if (!rows.length) { el.innerHTML = '<div style="color:var(--text-dim);padding:16px;">No pending inspections.</div>'; return; }
  el.innerHTML = rows.map(r => `
    <div class="wm-row is-inspect">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <span class="wm-row-sku">${r.sku}</span>
          <span class="wm-inspect-badge">Needs Inspection</span>
          <span class="badge ${r.order_type === 'warranty' ? 'b-warranty' : 'b-replacement'}" style="font-size:10px;">${r.order_type === 'warranty' ? 'Warranty' : 'Full Repl.'}</span>
        </div>
        <div style="margin-top:4px;display:flex;gap:12px;flex-wrap:wrap;">
          <span class="wm-row-cell">${r.cell_name}</span>
          <span class="wm-row-order">${r.order_number || '—'}</span>
          <span class="wm-row-by">Marked done by ${r.marked_by} · ${new Date(r.created_at).toLocaleString()}</span>
        </div>
      </div>
      <button class="btn btn-success btn-xs" onclick="clearInspection('${r.id}',this)">Inspected</button>
    </div>`).join('');
}

async function clearInspection(id, btn) {
  btn.disabled = true; btn.textContent = 'Saving…';
  await sb(`sts_inspection_queue?id=eq.${id}`, 'PATCH', { status: 'inspected', inspected_by: currentUser.name, inspected_at: new Date().toISOString() }).catch(() => {});
  toast('Marked inspected', 'ok');
  loadWarrantyMgr();
}

function renderWarrantyMgrItems() {
  const filter = document.getElementById('wm-cell-filter')?.value || '';
  const items  = filter ? wmAllItems.filter(r => r.cell_name === filter) : wmAllItems;
  const el     = document.getElementById('wm-items');
  if (!items.length) { el.innerHTML = '<div style="color:var(--text-dim);padding:16px;">No warranty or replacement items on schedule today.</div>'; return; }
  el.innerHTML = items.map(r => `
    <div class="wm-row${r.order_type === 'replacement' ? ' is-replacement' : ''}">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <span class="wm-row-sku">${r.sku}</span>
          <span class="badge ${r.order_type === 'warranty' ? 'b-warranty' : 'b-replacement'}" style="font-size:10px;">${r.order_type === 'warranty' ? 'Warranty' : 'Full Repl.'}</span>
          ${r.must_ship ? '<span class="badge b-ship" style="font-size:10px;">Must Ship</span>' : ''}
        </div>
        <div style="margin-top:4px;display:flex;gap:12px;flex-wrap:wrap;">
          <span class="wm-row-cell">${r.cell_name}</span>
          <span class="wm-row-order">${r.order_number || '—'}</span>
          <span class="wm-row-by">×${r.quantity} · ${r.due_date || 'No due date'} · by ${r.saved_by}</span>
        </div>
      </div>
    </div>`).join('');
}

// ── Populate edit modal material selects ──
function _populateEditMatSelects(qty) {
  ['edit-mat-boxes','edit-mat-hardware','edit-mat-lumber'].forEach(id => {
    const sel = document.getElementById(id); if (!sel) return;
    sel.innerHTML = `<option value="have_all">Have All</option>`;
    for (let n = 1; n <= Math.min(qty || 50, 100); n++) sel.innerHTML += `<option value="need_${n}">Need ${n}</option>`;
  });
}

// ── Init ──
(async () => {
  // ⬇ Temporary bypass — remove this block and uncomment initLogin() for real auth
  currentUser = { id: '00000000-0000-4000-8000-000000000000', name: 'Scheduler', role: 'admin', campus: 'SY', isTemporaryUser: true };
  bootApp();

  // For real login, comment the two lines above and uncomment these:
  // document.getElementById('page-login').style.display = 'flex';
  // document.getElementById('page-login').classList.add('active');
  // initLogin();
})();