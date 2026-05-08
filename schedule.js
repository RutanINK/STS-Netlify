// ══════════════════════════════════════
// SCHEDULE — render, parse button, save, handoff, warranty
// ══════════════════════════════════════

// ── Materials helpers ──
function buildOpts(cur, max) {
  let h = `<option value="have_all" ${cur === 'have_all' ? 'selected' : ''}>Have All</option>`;
  for (let n = 1; n <= Math.min(max, 100); n++) h += `<option value="need_${n}" ${cur === `need_${n}` ? 'selected' : ''}>Need ${n}</option>`;
  return h;
}

// Color-coded selectors per material type
const MAT_SEL_CLASS = {
  boxes:    'mat-sel-boxes',
  hardware: 'mat-sel-hw',
  lumber:   'mat-sel-lumber',
  slings:   'mat-sel-slings',
  bentParts:'mat-sel-bent',
};
const MAT_GROUP_CLASS = {
  boxes:    'mat-boxes',
  hardware: 'mat-hw',
  lumber:   'mat-lumber',
  slings:   'mat-slings',
  bentParts:'mat-bent',
};

function matSelCls(field, v) {
  const base = MAT_SEL_CLASS[field] || 'mat-sel';
  return base + (v && v !== 'have_all' ? ' has-need' : '');
}
function matGroupCls(field) { return 'mat-group ' + (MAT_GROUP_CLASS[field] || ''); }

// Legacy compat
function matCls(v) { return 'mat-sel' + (v && v !== 'have_all' ? ' has-need' : ''); }
function matPrint(lbl, v) {
  if (!v || v === 'have_all') return `<span class="print-mat">${lbl}:✓</span>`;
  return `<span class="print-mat">${lbl}:Need ${v.replace('need_', '')}</span>`;
}

// ── Totals bar ──
function updateTotals() {
  const bar = document.getElementById('totals-bar');
  if (!scheduleItems.length) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  const totalMins  = scheduleItems.reduce((s, it) => s + it.taktMins, 0);
  const totalUnits = scheduleItems.reduce((s, it) => s + it.qty, 0);
  let co = 0; for (let i = 1; i < scheduleItems.length; i++) if (baseSku(scheduleItems[i].sku) !== baseSku(scheduleItems[i - 1].sku)) co++;
  const tEl = document.getElementById('tc-takt');
  tEl.textContent = fmtTaktH(totalMins);
  tEl.className = 'tc-val ' + (totalMins < 240 ? 'tc-green' : totalMins < 480 ? 'tc-yellow' : 'tc-red');
  document.getElementById('tc-co').textContent    = co;
  document.getElementById('tc-skus').textContent  = scheduleItems.length;
  document.getElementById('tc-units').textContent = totalUnits;
}

// ── Print table ──
function buildPrintTable() {
  const tbody = document.getElementById('print-tbody'); if (!tbody) return;
  const hasSlings    = scheduleItems.some(it => it.showSlings);
  const hasBentParts = scheduleItems.some(it => it.showBentParts);
  const thead = document.querySelector('#print-table thead tr');
  if (thead) thead.innerHTML = `<th>SKU</th><th>Qty</th><th>TAKT</th><th>Due</th><th>Flags</th><th>Boxes</th><th>Hardware</th><th>Lumber</th>${hasSlings ? '<th>Slings</th>' : ''}${hasBentParts ? '<th>Bent Parts</th>' : ''}`;
  function matCell(val) { if (!val || val === 'have_all') return '<span class="pt-mat-ok">✓</span>'; return `<span class="pt-mat-need">Need ${val.replace('need_', '')}</span>`; }
  tbody.innerHTML = scheduleItems.map((it, idx) => {
    const isNewCO = idx > 0 && baseSku(scheduleItems[idx].sku) !== baseSku(scheduleItems[idx - 1].sku);
    const dueCls  = isDueOverdue(it.dueDate) ? 'pt-due overdue' : isDueSoon(it.dueDate) ? 'pt-due soon' : 'pt-due';
    const flags   = [it.mustShip ? '<span class="pt-badge pt-ship">Must Ship</span>' : '', it.orderType === 'warranty' ? '<span class="pt-badge pt-warranty">Warranty</span>' : '', it.orderType === 'replacement' ? '<span class="pt-badge pt-repl">Repl.</span>' : ''].filter(Boolean).join(' ');
    return `<tr class="${isNewCO ? 'co-row' : ''}"><td class="pt-sku">${it.sku}</td><td class="pt-qty">×${it.qty}</td><td class="pt-takt">${it.taktStr}</td><td class="${dueCls}">${it.dueDate || '—'}</td><td>${flags || '—'}</td><td>${matCell(it.boxes)}</td><td>${matCell(it.hardware)}</td><td>${matCell(it.lumber)}</td>${hasSlings ? `<td>${it.showSlings ? matCell(it.slings) : '—'}</td>` : ''}${hasBentParts ? `<td>${it.showBentParts ? matCell(it.bentParts) : '—'}</td>` : ''}</tr>`;
  }).join('');
}

// ── Main render ──
function render() {
  const list  = document.getElementById('schedule-list');
  const empty = document.getElementById('empty-state');
  const meta  = document.getElementById('sched-meta');

  if (!scheduleItems.length) {
    list.innerHTML = ''; empty.style.display = 'block'; meta.style.display = 'none';
    document.getElementById('print-tbody').innerHTML = '';
    updateTotals(); return;
  }
  empty.style.display = 'none'; meta.style.display = 'flex';
  document.getElementById('meta-cell').textContent  = '📍 ' + cellName + ' — ' + currentUser.campus;
  document.getElementById('meta-count').textContent = scheduleItems.length + ' SKU' + (scheduleItems.length !== 1 ? 's' : '');

  const viewRole = activeViewAs || currentUser.role;
  if (MAT_ROLES.includes(viewRole)) { list.style.display = 'none'; showMatHandlerView(viewRole); }
  else {
    list.style.display = ''; document.getElementById('mat-handler-view').style.display = 'none';

    // Warranties/replacements first, then standard items
    const warrantyItems = scheduleItems.filter(it => it.sourceSystem === 'warranty' || it.orderType === 'warranty' || it.orderType === 'replacement');
    const standardItems = scheduleItems.filter(it => it.sourceSystem !== 'warranty' && it.orderType !== 'warranty' && it.orderType !== 'replacement');
    const orderedItems  = [...warrantyItems, ...standardItems];

    const html = [];
    orderedItems.forEach((it, dispIdx) => {
      const realIdx   = scheduleItems.indexOf(it);
      const directBlock  = isSKUBlocked(it.sku);
      const directGrey   = !directBlock && isSKUGreyList(it.sku);
      const bomReason    = (!directBlock && !directGrey) ? getBOMBlockReason(it.sku) : null;
      const isBlocked    = directBlock  || (bomReason?.status === 'out_of_stock');
      const isGreyList   = directGrey   || (bomReason?.status === 'low_quantity');
      const blockReason  = directBlock
        ? 'Out of stock'
        : bomReason
          ? `Requires <strong>${bomReason.component}</strong> — ${bomReason.notes}`
          : '';
      if (dispIdx > 0 && baseSku(orderedItems[dispIdx].sku) !== baseSku(orderedItems[dispIdx - 1].sku))
        html.push('<div class="changeover-divider"></div>');

      const cls = ['sku-card'];
      if (it.mustShip)  cls.push('must-ship');
      if (it.orderType === 'warranty')    cls.push('is-warranty');
      if (it.orderType === 'replacement') cls.push('is-replacement');
      if (isBlocked)    cls.push('is-supply-blocked');
      if (isGreyList)   cls.push('is-grey-list');

      const badges = [];
      if (it.mustShip)  badges.push('<span class="badge b-ship">🚨 Must Ship</span>');
      if (it.orderType === 'warranty')    badges.push('<span class="badge b-warranty">⚙ Warranty</span>');
      if (it.orderType === 'replacement') badges.push('<span class="badge b-replacement">↺ Full Repl.</span>');
      if (it.merged)    badges.push('<span class="badge b-merged">⊕ Merged</span>');
      if (isBlocked)    badges.push('<span class="badge b-blocked">⛔ Supply Shortage</span>');
      else if (isGreyList) badges.push('<span class="badge b-greylist">⚠ Low Quantity</span>');
      else if ([it.boxes, it.hardware, it.lumber, it.showSlings ? it.slings : null, it.showBentParts ? it.bentParts : null].some(v => v && v !== 'have_all'))
        badges.push('<span class="badge b-shortage">⚠ Shortage</span>');

      const dueCls   = 'due-pill' + (isDueOverdue(it.dueDate) ? ' overdue' : isDueSoon(it.dueDate) ? ' soon' : '');
      const qtyLabel = it.qty + (it.qty !== it.totalQty ? ` <span style="font-size:9px;color:var(--text-dim);">(${it.totalQty} tot)</span>` : '');
      let srcTags    = (it.sourceCells && it.sourceCells.length > 1) ? it.sourceCells.map(s => `<span class="source-tag">${s}</span>`).join('') : (variantSources.length > 1 && it.sourceCell) ? `<span class="source-tag">${it.sourceCell}</span>` : '';
      if (it.sourceSystem === 'warranty') srcTags += ' <span class="warranty-source-tag">Warranty System</span>';

      let orderDisplay;
      if (it.merged && it.orderBreakdown && it.orderBreakdown.length > 1) {
        orderDisplay = it.orderBreakdown.map((ob, oi) => ob.orderNum
          ? `<span class="order-chip"><a href="#">${ob.orderNum}</a> ×${ob.qty} ${it.lockedSource ? '' : `<button class="order-remove-btn" onclick="removeOrder(${realIdx},${oi})">✕</button>`}</span>`
          : '<span class="order-chip">—</span>').join('');
      } else {
        orderDisplay = it.orderNums.length ? it.orderNums.map(o => `<a href="#">${o}</a>`).join(', ') : '—';
      }

      const isSup = SUP_ROLES.includes(currentUser.role);
      const matsRow = isBlocked
        ? `<div class="card-mats" style="background:var(--yellow-dim);border-top:1px solid var(--yellow);">
            <span style="color:var(--yellow);font-size:12px;font-weight:500;">⛔ Blocked — supply shortage.
            ${isSup ? `<button class="btn btn-ghost btn-xs" style="margin-left:8px;" onclick="openShortageApprove('${it.sku}','')">Approve Override</button>` : 'A supervisor must approve scheduling this SKU.'}
            </span></div>`
        : `<div class="card-mats">
            <div class="${matGroupCls('boxes')}"><label>📦 Boxes</label><select class="${matSelCls('boxes',it.boxes)}" onchange="setMat(${realIdx},'boxes',this)">${buildOpts(it.boxes, it.qty)}</select>${matPrint('Boxes', it.boxes)}</div>
            <div class="${matGroupCls('hardware')}"><label>🔩 Hardware</label><select class="${matSelCls('hardware',it.hardware)}" onchange="setMat(${realIdx},'hardware',this)">${buildOpts(it.hardware, it.qty)}</select>${matPrint('Hardware', it.hardware)}</div>
            <div class="${matGroupCls('lumber')}"><label>🪵 Lumber</label><select class="${matSelCls('lumber',it.lumber)}" onchange="setMat(${realIdx},'lumber',this)">${buildOpts(it.lumber, it.qty)}</select>${matPrint('Lumber', it.lumber)}</div>
            <div class="mat-div"></div>
            <button class="tog-btn ${it.showSlings ? 'on' : ''}" onclick="tog(${realIdx},'showSlings')">${it.showSlings ? '✓' : '+'} Slings</button>
            ${it.showSlings ? `<div class="${matGroupCls('slings')}"><label>🪢 Slings</label><select class="${matSelCls('slings',it.slings)}" onchange="setMat(${realIdx},'slings',this)">${buildOpts(it.slings, it.qty)}</select>${matPrint('Slings', it.slings)}</div>` : ''}
            <button class="tog-btn ${it.showBentParts ? 'on' : ''}" onclick="tog(${realIdx},'showBentParts')">${it.showBentParts ? '✓' : '+'} Bent Parts</button>
            ${it.showBentParts ? `<div class="${matGroupCls('bentParts')}"><label>🔧 Bent Parts</label><select class="${matSelCls('bentParts',it.bentParts)}" onchange="setMat(${realIdx},'bentParts',this)">${buildOpts(it.bentParts, it.qty)}</select>${matPrint('Bent Parts', it.bentParts)}</div>` : ''}
          </div>`;

      html.push(`<div class="${cls.join(' ')}" draggable="true" data-idx="${realIdx}"
        ondragstart="onDS(event,${realIdx})" ondragover="onDO(event,${realIdx})"
        ondrop="onDP(event,${realIdx})" ondragleave="onDL(event)" ondragend="onDE(event)">
        <div class="card-row">
          <span class="card-drag">⠿</span>
          <div class="card-sku">
            <div class="card-sku-name">${it.sku} ${srcTags}</div>
            ${it.description ? `<div class="card-sku-desc">${it.description}</div>` : ''}
            <div class="card-sku-order">${orderDisplay}</div>
          </div>
          <div class="card-badges">${badges.join('')}</div>
          <div class="card-right">
            ${it.dueDate ? `<span class="${dueCls}">📅 ${it.dueDate}</span>` : ''}
            <span class="qty-pill">${it.qty}${it.qty !== it.totalQty ? `<span style="font-size:13px;opacity:.6;margin-left:4px;">/ ${it.totalQty}</span>` : ''}</span>
            <span class="takt-pill">${it.taktStr}</span>
          </div>
        </div>
        ${matsRow}
      </div>`);
    });
    list.innerHTML = html.join('');
  }
  buildPrintTable(); updateTotals();
}

function setMat(idx, field, sel) { scheduleItems[idx][field] = sel.value; sel.className = matCls(sel.value); markUnsaved(); updateTotals(); }
function tog(idx, field)         { scheduleItems[idx][field] = !scheduleItems[idx][field]; render(); }

function removeOrder(cardIdx, orderIdx) {
  const it = scheduleItems[cardIdx];
  if (!it.orderBreakdown || it.orderBreakdown.length <= 1) { if (!confirm('Remove this SKU?')) return; scheduleItems.splice(cardIdx, 1); render(); markUnsaved(); return; }
  const removed = it.orderBreakdown[orderIdx]; it.orderBreakdown.splice(orderIdx, 1);
  it.qty = Math.max(0, it.qty - removed.qty); it.totalQty = Math.max(0, it.totalQty - removed.qty);
  it.taktMins = Math.max(0, it.taktMins - removed.taktMins); it.taktStr = fmtTakt(it.taktMins);
  it.orderNums = it.orderBreakdown.map(o => o.orderNum).filter(Boolean); it.merged = it.orderBreakdown.length > 1;
  if (it.qty <= 0) scheduleItems.splice(cardIdx, 1);
  render(); markUnsaved();
}

// ── Mat handler view ──
function showMatHandlerView(role) {
  const cfg = MAT_HANDLER_CONFIG[role]; if (!cfg) return;
  document.getElementById('schedule-list').style.display = 'none';
  document.getElementById('empty-state').style.display  = 'none';
  const wrap = document.getElementById('mat-handler-view'); wrap.style.display = 'flex';
  if (!scheduleItems.length) { wrap.innerHTML = '<div class="mh-cell-selector"><span>No schedule loaded.</span></div>'; return; }
  scheduleItems.forEach((_, idx) => { if (!mhCheckState[idx]) mhCheckState[idx] = { done: false, comment: '' }; });
  if (cfg.showBoxGroups) renderBoxHandlerView(cfg); else renderMatHandlerTable(role, cfg);
}

function renderBoxHandlerView(cfg) {
  const wrap = document.getElementById('mat-handler-view');
  const groups = []; let curGroup = { baseSkus: [], totalBoxes: 0, totalQty: 0, items: [] };
  scheduleItems.forEach((it, idx) => {
    const isNewCO = idx > 0 && baseSku(scheduleItems[idx].sku) !== baseSku(scheduleItems[idx - 1].sku);
    if (isNewCO && curGroup.items.length) { groups.push({ ...curGroup }); curGroup = { baseSkus: [], totalBoxes: 0, totalQty: 0, items: [] }; }
    const bs = baseSku(it.sku); if (!curGroup.baseSkus.includes(bs)) curGroup.baseSkus.push(bs);
    const boxNeed = it.boxes === 'have_all' ? 0 : parseInt(it.boxes.replace('need_', '')) || 0;
    curGroup.totalBoxes += boxNeed; curGroup.totalQty += it.qty; curGroup.items.push({ ...it, idx, boxNeed });
  });
  if (curGroup.items.length) groups.push(curGroup);
  const totalBoxes = groups.reduce((s, g) => s + g.totalBoxes, 0);
  let html = `<div class="mh-cell-selector"><span style="font-size:13px;font-weight:600;">📦 Box Handler — ${cellName}</span><span class="meta-chip">${groups.length} changeover groups</span><span class="meta-chip" style="color:var(--yellow);">Total boxes needed: ${totalBoxes}</span></div>
<div class="mh-table-wrap"><table class="mh-table"><thead><tr><th>SKU Family</th><th>Total Qty</th><th>Boxes Needed</th><th>Done</th><th>Note</th></tr></thead><tbody>`;
  groups.forEach((g, gi) => {
    const gKey = 'g' + gi; if (!mhCheckState[gKey]) mhCheckState[gKey] = { done: false, comment: '' };
    const isDone = mhCheckState[gKey].done;
    html += `<tr class="mh-co-row${isDone ? ' mh-done' : ''}">
      <td><span class="mh-box-group">${g.baseSkus.join(' · ')}</span> <span style="font-size:10px;color:var(--text-dim);">${g.items.length} color${g.items.length !== 1 ? 's' : ''}</span></td>
      <td class="mh-qty">×${g.totalQty}</td>
      <td>${g.totalBoxes > 0 ? `<span class="${isDone ? '' : 'mh-need'}">Need ${g.totalBoxes}</span>` : '<span class="mh-have">✓ Have All</span>'}</td>
      <td><input type="checkbox" class="mh-check" ${isDone ? 'checked' : ''} onchange="mhToggle('${gKey}',this.checked)"></td>
      <td><input type="text" class="mh-comment" placeholder="Note…" value="${mhCheckState[gKey].comment || ''}" oninput="mhComment('${gKey}',this.value)"></td>
    </tr>`;
  });
  html += '</tbody></table></div>'; wrap.innerHTML = html;
}

function renderMatHandlerTable(role, cfg) {
  const wrap = document.getElementById('mat-handler-view');
  const totalNeed = scheduleItems.filter(it => it[cfg.field] && it[cfg.field] !== 'have_all').length;
  let html = `<div class="mh-cell-selector"><span style="font-size:13px;font-weight:600;">${cfg.col} Handler — ${cellName}</span><span class="meta-chip">${totalNeed} shortages</span></div>
<div class="mh-table-wrap"><table class="mh-table"><thead><tr><th>#</th><th>SKU</th><th>Qty</th><th>${cfg.col}</th><th>Due</th><th>Done</th><th>Note</th></tr></thead><tbody>`;
  scheduleItems.forEach((it, idx) => {
    const isNewCO = idx > 0 && baseSku(scheduleItems[idx].sku) !== baseSku(scheduleItems[idx - 1].sku);
    const val = it[cfg.field], isDone = mhCheckState[idx]?.done;
    const matHtml = isDone ? '<span class="mh-have">✓ Done</span>' : val && val !== 'have_all' ? `<span class="mh-need">Need ${val.replace('need_', '')}</span>` : '<span class="mh-have">✓ Have All</span>';
    const dueCls = isDueOverdue(it.dueDate) ? 'overdue' : isDueSoon(it.dueDate) ? 'soon' : '';
    html += `<tr class="${isNewCO ? 'mh-co-row' : ''}${isDone ? ' mh-done' : ''}">
      <td style="color:var(--text-dim);font-size:11px;">${idx + 1}</td>
      <td class="mh-sku">${it.sku}</td><td class="mh-qty">×${it.qty}</td><td>${matHtml}</td>
      <td style="font-size:11px;color:var(--text-muted);" class="${dueCls}">${it.dueDate || '—'}</td>
      <td><input type="checkbox" class="mh-check" ${isDone ? 'checked' : ''} onchange="mhToggle(${idx},this.checked)"></td>
      <td><input type="text" class="mh-comment" placeholder="Note…" value="${mhCheckState[idx]?.comment || ''}" oninput="mhComment(${idx},this.value)"></td>
    </tr>`;
  });
  html += '</tbody></table></div>'; wrap.innerHTML = html;
}

function mhToggle(idx, checked) {
  if (!mhCheckState[idx]) mhCheckState[idx] = { done: false, comment: '' };
  mhCheckState[idx].done = checked;
  const role = activeViewAs || currentUser.role, cfg = MAT_HANDLER_CONFIG[role];
  if (cfg) { if (cfg.showBoxGroups) renderBoxHandlerView(cfg); else renderMatHandlerTable(role, cfg); }
}
function mhComment(idx, val) { if (!mhCheckState[idx]) mhCheckState[idx] = { done: false, comment: '' }; mhCheckState[idx].comment = val; }

// ── Drag & Drop ──
function onDS(e, i) { dragSrcIndex = i; e.currentTarget.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; }
function onDO(e, i) { e.preventDefault(); document.querySelectorAll('.sku-card').forEach(c => c.classList.remove('drag-over')); if (i !== dragSrcIndex) e.currentTarget.classList.add('drag-over'); }
function onDL(e)    { e.currentTarget.classList.remove('drag-over'); }
function onDP(e, i) { e.preventDefault(); if (dragSrcIndex === null || dragSrcIndex === i) return; const m = scheduleItems.splice(dragSrcIndex, 1)[0]; scheduleItems.splice(i, 0, m); dragSrcIndex = null; render(); markUnsaved(); }
function onDE()     { document.querySelectorAll('.sku-card').forEach(c => c.classList.remove('dragging', 'drag-over')); dragSrcIndex = null; }

// ── Save / Print ──
function scheduleStateStr()  { return JSON.stringify(scheduleItems.map(it => ({ ...it }))); }
function markUnsaved() { const el = document.getElementById('meta-saved'); if (scheduleItems.length) { el.style.display = 'inline'; el.textContent = '💾 Unsaved'; } }
function markSaved()   { lastSavedState = scheduleStateStr(); document.getElementById('meta-saved').textContent = '✓ Saved'; }
function hasUnsavedChanges() { return lastSavedState === null || scheduleStateStr() !== lastSavedState; }
function openSaveModal() { document.getElementById('save-as-name').textContent = currentUser.name; document.getElementById('save-as-cell').textContent = cellName; document.getElementById('modal-save').classList.add('open'); }

async function doSave() {
  const btn = document.getElementById('btn-save-confirm'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving…';
  try {
    const payload = { cell_name: cellName, campus: currentUser.campus, created_by: currentUser.name, created_at: new Date().toISOString() };
    if (currentUser.id && !currentUser.isTemporaryUser) payload.employee_id = currentUser.id;
    const [row] = await sb('sts_schedules?select=id', 'POST', payload);
    savedScheduleId = row.id;
    const items = scheduleItems.map((it, idx) => ({
      schedule_id: row.id, sku: it.sku, inventory_id: it.inventoryId || null, line_description: it.description || null,
      quantity: it.qty, takt_minutes: it.taktMins, due_date: it.dueDate, must_ship: it.mustShip,
      order_number: it.orderNums[0] || null, order_type: it.orderType, sort_order: idx,
      boxes_needed: it.boxes, hardware_needed: it.hardware, lumber_needed: it.lumber,
      slings_needed: it.showSlings ? it.slings : null, bent_parts_needed: it.showBentParts ? it.bentParts : null,
    }));
    await sb('sts_schedule_items', 'POST', items);
    const hist = scheduleItems.filter(it => it.orderNums.length).flatMap(it => it.orderNums.map(on => ({
      schedule_id: row.id, order_number: on, sku: it.sku, boxes_needed: it.boxes, hardware_needed: it.hardware, lumber_needed: it.lumber, created_at: new Date().toISOString()
    })));
    if (hist.length) await sb('sts_schedule_history', 'POST', hist);
    closeModal('modal-save'); markSaved(); toast('Schedule saved!', 'ok');
    if (pendingPrintAfterSave) { pendingPrintAfterSave = false; setTimeout(() => window.print(), 300); }
  } catch (e) { toast('Save failed: ' + e.message, 'err'); }
  finally { btn.disabled = false; btn.innerHTML = '💾 Save & Continue'; }
}

// ── Parse button ──
function baseCellNum(cn) { const m = cn.match(/Cell\s+(\d+)/i) || cn.match(/Euro\s+(\d+)/i); return m ? parseInt(m[1]) : null; }
function areCellVariants(a, b) { if (a === b) return false; const na = baseCellNum(a), nb = baseCellNum(b); return na !== null && nb !== null && na === nb; }

async function loadWarrantiesManual() {
  if (!cellName) { toast('Parse a schedule first', 'info'); return; }
  try {
    const wItems = await loadWarrantyItemsForCell(cellName);
    if (!wItems.length) { toast('No warranty items assigned to ' + cellName, 'info'); return; }
    const before = scheduleItems.length; scheduleItems = mergeWarrantyItems(scheduleItems, wItems);
    const added = scheduleItems.length - before;
    if (!added) { toast('Warranty items already loaded', 'info'); return; }
    render(); markUnsaved(); toast(`Added ${added} warranty item${added !== 1 ? 's' : ''} for ${cellName}`, 'ok');
  } catch (e) { toast('Failed: ' + e.message, 'err'); }
}

// ── Saved schedules ──
async function loadSchedule(id) {
  try {
    const [sched] = await sb('sts_schedules?id=eq.' + id + '&select=*');
    const items   = await sb('sts_schedule_items?schedule_id=eq.' + id + '&order=sort_order.asc');
    cellName = sched.cell_name; savedScheduleId = id; variantSources = [];
    scheduleItems = items.map(it => ({
      sku: it.sku, description: it.line_description || '', inventoryId: it.inventory_id || null,
      qty: it.quantity, totalQty: it.quantity, taktMins: it.takt_minutes, taktStr: fmtTakt(it.takt_minutes),
      dueDate: it.due_date, mustShip: it.must_ship,
      orderNum: it.order_number, orderNums: [it.order_number].filter(Boolean),
      orderBreakdown: [{ orderNum: it.order_number, qty: it.quantity, taktMins: it.takt_minutes, dueDate: it.due_date }],
      orderType: it.order_type, sourceCell: sched.cell_name, sourceCells: [sched.cell_name],
      boxes: it.boxes_needed || 'have_all', hardware: it.hardware_needed || 'have_all',
      lumber: it.lumber_needed || 'have_all', slings: it.slings_needed || 'have_all',
      bentParts: it.bent_parts_needed || 'have_all',
      showSlings: !!it.slings_needed, showBentParts: !!it.bent_parts_needed, merged: false,
      sourceSystem: it.source_system || 'sabertooth', sourceRef: it.source_ref || null, lockedSource: !!it.locked_source,
    }));
    lastSavedState = scheduleStateStr();
    document.getElementById('paste-panel').style.display   = 'none';
    document.getElementById('saved-panel').style.display   = 'none';
    document.getElementById('meta-saved').textContent      = '✓ Loaded: ' + sched.created_by;
    document.getElementById('meta-saved').style.display    = 'inline';
    render(); toast('Loaded ' + cellName, 'ok');
  } catch (e) { toast('Load failed: ' + e.message, 'err'); }
}

async function deleteSchedule(id, btn) {
  if (!confirm('Delete this schedule?')) return; btn.disabled = true;
  try {
    await sb('sts_schedule_items?schedule_id=eq.' + id, 'DELETE');
    await sb('sts_schedules?id=eq.' + id, 'DELETE');
    toast('Deleted', 'info');
    document.getElementById('btn-load-saved').click();
    document.getElementById('btn-load-saved').click();
  } catch (e) { toast('Delete failed: ' + e.message, 'err'); btn.disabled = false; }
}

// ── Handoff ──
async function openHandoff() {
  if (!scheduleItems.length && !savedScheduleId) { toast('No schedule loaded', 'info'); return; }
  document.getElementById('modal-handoff').classList.add('open');
  document.getElementById('handoff-sub').textContent = 'Cell: ' + cellName + ' — remove completed orders and adjust quantities.';
  await loadHandoffItems();
}

async function loadHandoffItems() {
  const listEl = document.getElementById('handoff-list'), emptyEl = document.getElementById('handoff-empty');
  listEl.innerHTML = '<span style="color:var(--text-muted);font-size:12px;padding:8px;">Loading…</span>'; emptyEl.style.display = 'none';
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const rows = await sb(`sts_schedules?cell_name=eq.${encodeURIComponent(cellName)}&employee_id=eq.${currentUser.id}&created_at=gte.${today.toISOString()}&order=created_at.desc&select=id,created_at&limit=10`);
    if (!rows || !rows.length) {
      if (scheduleItems.length) { handoffItems = scheduleItems.map(it => ({ sku: it.sku, orderNum: it.orderNums[0] || null, qty: it.qty, origQty: it.qty, dueDate: it.dueDate, mustShip: it.mustShip, orderType: it.orderType, removed: false })); renderHandoff(); return; }
      listEl.innerHTML = ''; emptyEl.style.display = 'block'; return;
    }
    const [latest] = rows;
    const items = await sb('sts_schedule_items?schedule_id=eq.' + latest.id + '&order=sort_order.asc');
    handoffItems = items.map(it => ({ sku: it.sku, orderNum: it.order_number, qty: it.quantity, origQty: it.quantity, dueDate: it.due_date, mustShip: it.must_ship, orderType: it.order_type, boxes: it.boxes_needed || 'have_all', hardware: it.hardware_needed || 'have_all', lumber: it.lumber_needed || 'have_all', removed: false }));
    renderHandoff();
  } catch (e) {
    if (scheduleItems.length) { handoffItems = scheduleItems.map(it => ({ sku: it.sku, orderNum: it.orderNums[0] || null, qty: it.qty, origQty: it.qty, dueDate: it.dueDate, mustShip: it.mustShip, orderType: it.orderType, removed: false })); renderHandoff(); }
    else listEl.innerHTML = `<span style="color:var(--red);font-size:12px;">${e.message}</span>`;
  }
}

function renderHandoff() {
  const listEl = document.getElementById('handoff-list'), totalEl = document.getElementById('handoff-total');
  if (!handoffItems.length) { listEl.innerHTML = ''; document.getElementById('handoff-empty').style.display = 'block'; totalEl.textContent = '0'; return; }
  document.getElementById('handoff-empty').style.display = 'none';
  const active = handoffItems.filter(it => !it.removed);
  totalEl.textContent = active.length + ' SKU' + (active.length !== 1 ? 's' : '') + '  ·  ' + active.reduce((s, it) => s + it.qty, 0) + ' units';
  listEl.innerHTML = handoffItems.map((it, idx) => {
    const dueCls   = 'due-pill' + (isDueOverdue(it.dueDate) ? ' overdue' : isDueSoon(it.dueDate) ? ' soon' : '');
    const typeBadge = it.mustShip ? '<span class="badge b-ship" style="font-size:8px;">Must Ship</span>' : it.orderType === 'warranty' ? '<span class="badge b-warranty" style="font-size:8px;">Warranty</span>' : it.orderType === 'replacement' ? '<span class="badge b-replacement" style="font-size:8px;">Repl.</span>' : '';
    return `<div class="handoff-row${it.removed ? ' removed' : ''}">
      <div style="flex:1;min-width:0;"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><span class="handoff-sku">${it.sku}</span>${typeBadge}${it.dueDate ? `<span class="${dueCls}">📅 ${it.dueDate}</span>` : ''}</div><div style="font-family:var(--mono);font-size:10px;color:var(--text-muted);margin-top:2px;">${it.orderNum || '—'}</div></div>
      <div class="handoff-qty-wrap"><span class="handoff-qty-label">Qty left:</span><input class="handoff-qty-input" type="number" min="0" max="${it.origQty}" value="${it.qty}" ${it.removed ? 'disabled' : ''} onchange="setHandoffQty(${idx},this.value)"></div>
      ${it.removed ? `<button class="handoff-restore" onclick="restoreHandoff(${idx})">↩ Restore</button>` : `<button class="handoff-remove" onclick="removeHandoff(${idx})">✓ Done</button>`}
    </div>`;
  }).join('');
}
function setHandoffQty(idx, val) { handoffItems[idx].qty = Math.max(0, Math.min(parseInt(val) || 0, handoffItems[idx].origQty)); const a = handoffItems.filter(it => !it.removed); document.getElementById('handoff-total').textContent = a.length + ' SKUs  ·  ' + a.reduce((s, it) => s + it.qty, 0) + ' units'; }
function removeHandoff(idx)  { handoffItems[idx].removed = true;  renderHandoff(); }
function restoreHandoff(idx) { handoffItems[idx].removed = false; renderHandoff(); }

function printHandoff() {
  const active = handoffItems.filter(it => !it.removed); if (!active.length) { toast('No items to print', 'info'); return; }
  function esc(v) { return String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  const rows = active.map(it => `<tr><td style="font-family:monospace;font-weight:700;">${esc(it.sku)}</td><td style="font-family:monospace;font-size:9pt;">${esc(it.orderNum||'—')}</td><td style="text-align:center;font-weight:700;">${esc(it.qty)}</td><td>${esc(it.dueDate||'—')}</td><td>${esc(it.mustShip?'Must Ship':it.orderType==='warranty'?'Warranty':it.orderType==='replacement'?'Full Repl.':'—')}</td></tr>`).join('');
  const html = `<!DOCTYPE html><html><head><title>Handoff — ${esc(cellName)}</title><style>body{font-family:Arial,sans-serif;font-size:10pt;padding:16px;}table{width:100%;border-collapse:collapse;}th{font-size:8pt;text-transform:uppercase;padding:5px 8px;text-align:left;border-bottom:2px solid #333;}td{padding:5px 8px;border-bottom:1px solid #ddd;}@media print{@page{margin:8mm;size:landscape;}}</style></head><body><h2>Shift Handoff — ${esc(cellName)}</h2><p style="color:#555;font-size:9pt;">Prepared by ${esc(currentUser.name)} · ${esc(new Date().toLocaleString())} · ${active.length} items · ${active.reduce((s,it)=>s+it.qty,0)} units</p><table><thead><tr><th>SKU</th><th>Order #</th><th>Qty Left</th><th>Due</th><th>Type</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
  const win = window.open('', '_blank', 'width=900,height=600'); win.document.open(); win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 400);
}

// ── Warranty queue ──
async function loadWarrantyItemsForCell(targetCellName) {
  try {
    const n = cellBaseNum(targetCellName);
    const variantMatch = targetCellName.match(/Cell\s+\d+([ab])/i);
    const variant = variantMatch ? variantMatch[1].toLowerCase() : null;
    let rows = [];
    if (n) {
      rows = await sb(`sts_warranty_queue?assigned_cell_num=eq.${n}&status=in.(assigned,scheduled)&select=*`);
      if (variant && rows && rows.length) rows = rows.filter(w => { const ac = String(w.assigned_cell || '').toLowerCase(); const rv = ac.match(/\d+([ab])/); if (rv) return rv[1] === variant; return true; });
    }
    if (!rows || !rows.length) rows = await sb(`sts_warranty_queue?assigned_cell=eq.${encodeURIComponent(targetCellName)}&status=in.(assigned,scheduled)&select=*`);
    return (rows || []).map(w => {
      const takt = Number(w.takt_minutes || 0), qty = Number(w.quantity || 1), ref = w.warranty_order || w.id, partNumber = w.inventory_id || w.sku || 'UNKNOWN-PART';
      return { sku: partNumber, inventoryId: w.inventory_id || null, description: w.line_description || '', qty, totalQty: qty, taktMins: takt, taktStr: fmtTakt(takt), dueDate: w.due_date || null, mustShip: !!w.must_ship, orderNum: ref, orderNums: [ref].filter(Boolean), orderBreakdown: [{ orderNum: ref, qty, taktMins: takt, dueDate: w.due_date || null }], orderType: w.order_type === 'replacement' ? 'replacement' : 'warranty', sourceCell: w.assigned_cell || targetCellName, sourceSystem: 'warranty', sourceRef: w.id, lockedSource: true, boxes: 'have_all', hardware: 'have_all', lumber: 'have_all', slings: 'have_all', bentParts: 'have_all', showSlings: false, showBentParts: false, merged: false };
    });
  } catch (e) { console.warn('Warranty queue unavailable:', e); toast('Warranty queue unavailable: ' + e.message, 'err'); return []; }
}

function mergeWarrantyItems(existingItems, warrantyItems) {
  if (!warrantyItems.length) return existingItems;
  const existingKeys = new Set(existingItems.flatMap(it => (it.orderNums && it.orderNums.length ? it.orderNums : [it.orderNum]).filter(Boolean).map(o => String(o).toUpperCase())));
  return [...existingItems, ...warrantyItems.filter(w => { const key = String(w.orderNum || '').toUpperCase(); return key && !existingKeys.has(key); })];
}