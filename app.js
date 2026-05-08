// ══════════════════════════════════════
// APP — boot, page routing, event wiring
// ══════════════════════════════════════

// ── Boot ──
function bootApp() {
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
  document.getElementById('tab-users').style.display      = USER_ROLES.includes(currentUser.role) ? '' : 'none';
  document.getElementById('view-as-select').style.display = currentUser.role === 'admin' ? '' : 'none';

  loadShortages(true); // silent background load

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

function showPage(p) {
  document.querySelectorAll('.page').forEach(el => { el.style.display = 'none'; el.classList.remove('active'); });
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + p).classList.add('active');
  const pg = document.getElementById('page-' + p);
  pg.style.display = 'flex'; pg.classList.add('active');

  if (p === 'dashboard') loadDashboard();
  if (p === 'board')     { loadBoard(); startLivePoll(); }
  if (p === 'users')     loadUsers();
  if (p === 'shortages') { activeShortageTab = 'bent'; renderShortageTab(); }
  if (p === 'bom')       { _updateBOMStatus(); }
  document.getElementById('totals-bar').style.display = (p === 'schedule' && scheduleItems.length) ? 'flex' : 'none';
  if (p !== 'board') stopLivePoll();
}

// ── BOM upload handler ──
async function handleBOMUpload(input) {
  const file = input.files[0];
  if (!file) return;

  const progressEl = document.getElementById('bom-upload-progress');
  const statusEl   = document.getElementById('bom-status');

  if (progressEl) { progressEl.style.display = 'block'; progressEl.textContent = '⏳ Parsing CSV…'; }
  if (statusEl)   statusEl.textContent = 'Parsing…';

  try {
    const result = await loadBOMFromFile(file);
    _updateBOMStatus();

    if (progressEl) progressEl.textContent = '⬆ Uploading to server…';
    const uploaded = await uploadBOMToSupabase(file);

    if (progressEl) {
      progressEl.textContent = uploaded
        ? `✓ Saved to server — all users will load this BOM automatically`
        : `✓ Loaded locally (Supabase storage bucket not set up yet)`;
      setTimeout(() => { if (progressEl) progressEl.style.display = 'none'; }, 5000);
    }

    toast(`✓ BOM loaded — ${result.components.toLocaleString()} components → ${result.finishedSkus?.toLocaleString() || '?'} base SKUs`, 'ok');
    if (scheduleItems.length) render();
  } catch(e) {
    if (statusEl)   statusEl.textContent = '⚠ Failed: ' + e.message;
    if (progressEl) { progressEl.textContent = '⚠ ' + e.message; }
    toast('BOM parse failed: ' + e.message, 'err');
  }
  input.value = '';
}

function _updateBOMStatus() {
  const el = document.getElementById('bom-status');
  if (!el) return;
  const stats = getBOMStats();
  if (!stats) {
    el.textContent = 'No BOM loaded. Upload the CSV exported from Databricks to enable automatic finished-good blocking.';
    el.style.color  = 'var(--text-muted)';
  } else {
    el.innerHTML = `<span style="color:var(--green);font-weight:700;">✓ BOM active</span> &nbsp;—&nbsp; 
      <strong style="color:var(--text);">${stats.components.toLocaleString()}</strong> components mapped to 
      <strong style="color:var(--text);">${stats.finishedSkus.toLocaleString()}</strong> base SKUs 
      <span style="color:var(--text-dim);">(${stats.rows.toLocaleString()} rows total)</span>`;
    el.style.color = '';
  }
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
        showLiveBanner('📋 Schedules updated — refreshing board…');
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

// ── Event wiring ──
document.getElementById('btn-parse').addEventListener('click', async () => {
  const raw = document.getElementById('raw-input').value.trim();
  const errEl = document.getElementById('parse-error'); errEl.style.display = 'none';
  if (!raw) { errEl.textContent = '⚠ Paste data first.'; errEl.style.display = 'block'; return; }
  try {
    const result = parseRaw(raw);
    if (!result.items.length) { errEl.textContent = '⚠ No SKUs found.'; errEl.style.display = 'block'; return; }
    const parsedCell = result.cellName;
    const isVariant  = scheduleItems.length > 0 && (cellName === parsedCell || areCellVariants(cellName, parsedCell));
    if (scheduleItems.length > 0 && !isVariant) {
      if (!confirm(`You have a schedule for ${cellName} loaded. Replace with ${parsedCell}?`)) return;
      scheduleItems = []; variantSources = [];
    }
    variantSources.push({ cellName: parsedCell, items: result.items });

    // Warn about blocked/grey-list SKUs (direct shortage OR via BOM lookup)
    const blockedItems  = result.items.filter(it => isSKUBlocked(it.sku) || getBOMBlockReason(it.sku)?.status === 'out_of_stock');
    const greyItems     = result.items.filter(it => !isSKUBlocked(it.sku) && (isSKUGreyList(it.sku) || getBOMBlockReason(it.sku)?.status === 'low_quantity'));
    if (blockedItems.length && !SUP_ROLES.includes(currentUser.role))
      toast(`⛔ ${blockedItems.length} SKU${blockedItems.length !== 1 ? 's' : ''} blocked due to component shortage.`, 'err');
    if (greyItems.length && !SUP_ROLES.includes(currentUser.role))
      toast(`⚠ ${greyItems.length} SKU${greyItems.length !== 1 ? 's' : ''} have low-quantity components — supervisor approval required.`, 'info');

    if (scheduleItems.length === 0) { cellName = parsedCell; scheduleItems = result.items; }
    else {
      scheduleItems = [...scheduleItems, ...result.items];
      const baseNum = baseCellNum(cellName); if (baseNum) cellName = 'Cell ' + String(baseNum).padStart(2, '0') + ' (combined)';
    }

    savedScheduleId = null; lastSavedState = null; mhCheckState = {};
    document.getElementById('raw-input').value = '';
    document.getElementById('paste-panel').style.display = 'none';
    updateVariantButtons(); render(); markUnsaved();
    toast(`Parsed ${result.items.length} SKU${result.items.length !== 1 ? 's' : ''} — ${parsedCell}`, 'ok');
  } catch (e) { errEl.textContent = '⚠ ' + e.message; errEl.style.display = 'block'; }
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
  scheduleItems = []; cellName = ''; savedScheduleId = null; lastSavedState = null; variantSources = [];
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
        <span class="saved-time">${new Date(r.created_at).toLocaleString()}</span>
        <span class="saved-by">by ${r.created_by}</span>
      </div>
      <div class="saved-row-right">
        <button class="btn btn-ghost btn-xs" onclick="loadSchedule('${r.id}')">📂 Load</button>
        ${canSeeAll || r.created_by === currentUser.name ? `<button class="btn btn-danger btn-xs" onclick="deleteSchedule('${r.id}',this)">🗑</button>` : ''}
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
  const addBtn  = document.getElementById('btn-add-variant');
  const combBtn = document.getElementById('btn-combine-variants');
  if (addBtn)  addBtn.style.display  = scheduleItems.length        ? 'inline-flex' : 'none';
  if (combBtn) combBtn.style.display = variantSources.length > 1   ? 'inline-flex' : 'none';
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