// ══════════════════════════════════════
// SCHEDULE — render, parse button, save, handoff, warranty
// ══════════════════════════════════════

function jsArg(v) {
  return String(v ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, ' ');
}

function schedEsc(v) {
  if (typeof esc === 'function') return esc(v);
  return String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

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


const MATERIAL_READY_FALLBACK = 'Material';
const MAT_EVENT_ACTOR_SEP = '::';

function materialReadyLabelForRole(role) {
  const cfg = role && MAT_HANDLER_CONFIG && MAT_HANDLER_CONFIG[role];
  return cfg?.col || null;
}

function materialEventActorForRole(role) {
  const name = String(currentUser?.name || '').trim();
  return name && role ? `${name}${MAT_EVENT_ACTOR_SEP}${role}` : name;
}

function materialRoleFromEventActor(actor) {
  const raw = String(actor || '').trim();
  if (!raw) return null;
  const parts = raw.split(MAT_EVENT_ACTOR_SEP);
  const maybeRole = parts.length > 1 ? parts[parts.length - 1] : '';
  return materialReadyLabelForRole(maybeRole) ? maybeRole : null;
}

function materialActorDisplayName(actor) {
  return String(actor || '').split(MAT_EVENT_ACTOR_SEP)[0].trim();
}

function materialReadyLabelForActor(actor) {
  const roleFromActor = materialRoleFromEventActor(actor);
  if (roleFromActor) return materialReadyLabelForRole(roleFromActor);

  const actorName = materialActorDisplayName(actor);
  if (!actorName) return null;

  // Supports admin/supervisor testing through View As. The persisted actor for
  // new events includes the role, but this preserves correct labels before the
  // event round-trips through Supabase.
  if (currentUser && actorName === currentUser.name) {
    return materialReadyLabelForRole(activeViewAs || currentUser.role);
  }

  const emp = (allEmployees || []).find(e => String(e.name || '').trim() === actorName);
  return materialReadyLabelForRole(emp?.role);
}

async function ensureMaterialActorCache() {
  // Material-ready badges are persisted in sts_material_events by actor. Load the
  // employee role map so cell views can resolve actor -> material after refresh.
  if ((allEmployees || []).some(e => e && e.role && MAT_HANDLER_CONFIG[e.role])) return;
  try {
    const rows = await sb('sts_employees?active=eq.true&select=name,role');
    if (Array.isArray(rows) && rows.length) allEmployees = rows;
  } catch (e) {
    console.warn('Could not load employee role map for material badges:', e.message);
  }
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

// ── Completion tracking (order-level done state) ──
// orderDoneState[realIdx][orderNum] = true|false
let orderDoneState = {};

// Due-date urgency helpers used by schedule cards, group headers, and print logic.
function scheduleDaysDiff(dateStr) {
  if (!dateStr || dateStr === '—') return null;
  const raw = String(dateStr || '').trim();
  const lower = raw.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ');

  if (/\byesterday\b/.test(lower)) return -1;
  if (/\btoday\b/.test(lower)) return 0;
  if (/\btomorrow\b/.test(lower)) return 1;

  let m = lower.match(/(\d+)\s*(?:d|day|days)\s*(?:past due|overdue|late)/i);
  if (m) return -Math.abs(parseInt(m[1], 10));
  m = lower.match(/(?:due in|in)\s*(\d+)\s*(?:d|day|days)/i);
  if (m) return Math.abs(parseInt(m[1], 10));

  try {
    const due = new Date(cleanDate(raw));
    if (isNaN(due)) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    due.setHours(0,0,0,0);
    return Math.round((due - today) / 86400000);
  } catch { return null; }
}

function dueUrgencyLabel(dateStr, opts = {}) {
  const d = scheduleDaysDiff(dateStr);
  if (d === null) return opts.fallback || String(dateStr || '');
  if (d > 2) return String(dateStr || '');
  if (d === 2) return 'Due in 2 Days';
  if (d === 1) return 'Due Tomorrow';
  if (d === 0) return 'Due Today';
  if (d === -1) return 'Due Yesterday';
  if (d >= -3) return `${Math.abs(d)}d Past Due`;
  return `${Math.abs(d)}d Overdue`;
}

function dueBadge(dateStr, opts = {}) {
  const d = scheduleDaysDiff(dateStr); if (d === null) return '';
  const label = schedEsc(dueUrgencyLabel(dateStr));
  const extra = opts.order ? ' due-badge-order' : '';
  if (d >  2) return `<span class="due-badge db-future${extra}">📅 ${schedEsc(dateStr)}</span>`;
  if (d === 2) return `<span class="due-badge db-green${extra}">📅 ${label}</span>`;
  if (d === 1) return `<span class="due-badge db-yellow${extra}">📅 ${label}</span>`;
  if (d === 0) return `<span class="due-badge db-orange${extra}">⚠ ${label}</span>`;
  if (d === -1) return `<span class="due-badge db-red1${extra}">🔴 ${label}</span>`;
  if (d >= -3) return `<span class="due-badge db-red2${extra}">🔴 ${label}</span>`;
  return              `<span class="due-badge db-red3${extra}">🚨 ${label}</span>`;
}

function dueGroupHeaderLabel(dateStr) {
  const d = scheduleDaysDiff(dateStr);
  if (d === null) return `Due: ${schedEsc(dateStr || '—')}`;
  if (d > 2) return `Due: ${schedEsc(dateStr || '—')}`;
  return dueUrgencyLabel(dateStr);
}

function shortageLabelForBadge(impact) {
  if (!impact) return '';
  const material = String(impact.shortageSku || impact.materialSku || impact.componentSku || impact.component || impact.finishedSku || '').trim().toUpperCase();
  if (!material) return '';
  return material.length > 22 ? material.slice(0, 19) + '…' : material;
}


// Ensure Auto Sort exists even if an older HTML shell is cached/deployed.
function ensureAutoSortButton() {
  const actions = document.querySelector('#sched-meta .sched-actions');
  if (!actions || document.getElementById('btn-auto-sort')) return;
  const btn = document.createElement('button');
  btn.className = 'btn btn-primary btn-sm';
  btn.id = 'btn-auto-sort';
  btn.type = 'button';
  btn.textContent = 'Auto Sort';
  btn.onclick = openAutoSortModal;
  const loadWarranty = document.getElementById('btn-load-warranty-current');
  actions.insertBefore(btn, loadWarranty || actions.firstChild);
}

// ── Main render ──
function render() {
  ensureAutoSortButton();
  const list  = document.getElementById('schedule-list');
  const empty = document.getElementById('empty-state');
  const meta  = document.getElementById('sched-meta');

  if (!scheduleItems.length) {
    list.innerHTML = '';
    empty.style.display = 'block';
    meta.style.display = 'none';
    document.getElementById('print-tbody').innerHTML = '';
    updateTotals();
    return;
  }

  empty.style.display = 'none';
  meta.style.display = 'flex';

  const cellEl = document.getElementById('meta-cell');
  cellEl.innerHTML = `<span class="meta-cell-name">${schedEsc(cellName)}</span><span class="meta-campus">${schedEsc(currentUser.campus)}</span>`;
  document.getElementById('meta-count').textContent = scheduleItems.length + ' SKU' + (scheduleItems.length !== 1 ? 's' : '');

  const viewRole = activeViewAs || currentUser.role;
  if (MAT_ROLES.includes(viewRole)) {
    // Handlers get their own dedicated view — hide the supervisor toolbar entirely
    meta.style.display = 'none';
    list.style.display = 'none';
    showMatHandlerView(viewRole);
    return;
  }

  list.style.display = '';
  document.getElementById('mat-handler-view').style.display = 'none';

  const warrantyItems = scheduleItems.filter(it => it.sourceSystem === 'warranty' || it.orderType === 'warranty');
  const standardItems = scheduleItems.filter(it => it.sourceSystem !== 'warranty' && it.orderType !== 'warranty');
  const orderedItems  = [...warrantyItems, ...standardItems];

  const html = [];
  let lastDueDate = null;
  const isSup = SUP_ROLES.includes(currentUser.role);
  const blacklistedOrderSet = new Set([...blacklistedOrders].map(o => _normOrderNumber(o)).filter(Boolean));

  const daysDiff = scheduleDaysDiff;

  orderedItems.forEach((it, dispIdx) => {
    const realIdx = scheduleItems.indexOf(it);
    const directBlock = isSKUBlocked(it.sku);
    const directGrey  = !directBlock && isSKUGreyList(it.sku);
    const bomReason   = (!directBlock && !directGrey) ? getBOMBlockReason(it.sku) : null;
    const isBlocked   = directBlock || (bomReason?.status === 'out_of_stock');
    const isGreyList  = directGrey  || (bomReason?.status === 'low_quantity');

    // Changeover divider between different base SKUs; date header within same base SKU
    if (dispIdx > 0) {
      const prevBase = baseSku(orderedItems[dispIdx - 1].sku);
      const thisBase = baseSku(it.sku);
      if (thisBase !== prevBase) {
        html.push('<div class="changeover-divider"><span>↔ Changeover</span></div>');
        lastDueDate = null; // reset so date header re-appears after changeover
      }
    }
    const thisDate = it.dueDate || '—';
    if (thisDate !== lastDueDate) {
      lastDueDate = thisDate;
      const d = daysDiff(it.dueDate);
      const sectionLabel = dueGroupHeaderLabel(thisDate);
      const hdrCls = d !== null && d < 0 ? 'due-group-header due-group-overdue'
                   : d === 0 ? 'due-group-header due-group-today'
                   : d === 1 || d === 2 ? 'due-group-header due-group-soon'
                   : 'due-group-header';
      html.push(`<div class="${hdrCls}">${sectionLabel}</div>`);
    }

    const isWarrantyType    = it.orderType === 'warranty' || it.sourceSystem === 'warranty';
    const isReplacementType = it.orderType === 'replacement';
    const canDrag = !isWarrantyType;
    const doneOrders = orderDoneState[realIdx] || {};
    const hasBlacklistedOrder = (it.orderBreakdown || []).some(ob => blacklistedOrderSet.has(_normOrderNumber(ob.orderNum)));
    const allOrdersDone = it.orderNums.length > 0 && it.orderNums.every(o => doneOrders[o]);

    const cls = ['sku-card'];
    if (it.mustShip) cls.push('must-ship');
    if (isWarrantyType) cls.push('is-warranty');
    if (isReplacementType) cls.push('is-replacement');
    if (isBlocked) cls.push('is-supply-blocked');
    if (isGreyList) cls.push('is-grey-list');
    if (hasBlacklistedOrder) cls.push('has-blacklisted-order');
    if (allOrdersDone) cls.push('is-done');
    // Card border urgency
    const d0 = daysDiff(it.dueDate);
    if (d0 !== null) {
      if (d0 < 0)  cls.push('is-pastdue');
      else if (d0 === 0) cls.push('is-due-today');
      else if (d0 === 1) cls.push('is-due-tomorrow');
    }
    // Green border when all materials are accounted for
    if (!isBlocked && !isGreyList
      && ['boxes','hardware','lumber'].every(f => !it[f] || it[f] === 'have_all')
      && (!it.showSlings    || !it.slings    || it.slings    === 'have_all')
      && (!it.showBentParts || !it.bentParts || it.bentParts === 'have_all')) {
      cls.push('mat-complete');
    }

    const shortageImpact = bomReason
      ? { finishedSku: it.sku, materialSku: bomReason.shortageSku || bomReason.component || it.sku, componentSku: bomReason.component || '', status: bomReason.status, notes: bomReason.notes || '', source: 'bom' }
      : directBlock
        ? { finishedSku: it.sku, materialSku: it.sku, componentSku: '', status: 'out_of_stock', notes: 'Direct shortage', source: 'direct' }
        : directGrey
          ? { finishedSku: it.sku, materialSku: it.sku, componentSku: '', status: 'low_quantity', notes: 'Direct low quantity', source: 'direct' }
          : null;
    const shortageBadgeItem = shortageLabelForBadge(shortageImpact);

    const badges = [];
    if (it.mustShip) badges.push('<span class="badge b-ship">Must Ship</span>');
    if (isWarrantyType) badges.push('<span class="badge b-warranty">Warranty</span>');
    if (isReplacementType) badges.push('<span class="badge b-replacement">Full Repl.</span>');
    if (hasBlacklistedOrder) badges.push('<span class="badge b-blocked">Blocked Order</span>');
    if (it.merged) badges.push('<span class="badge b-merged">Merged</span>');
    if (isBlocked) badges.push(`<span class="badge b-blocked">Shortage: ${schedEsc(shortageBadgeItem || 'Material')}</span>`);
    else if (isGreyList) badges.push(`<span class="badge b-greylist">Low Qty: ${schedEsc(shortageBadgeItem || 'Material')}</span>`);
    else if ([it.boxes, it.hardware, it.lumber, it.showSlings ? it.slings : null, it.showBentParts ? it.bentParts : null].some(v => v && v !== 'have_all')) badges.push('<span class="badge b-shortage">Material Need</span>');
    if (allOrdersDone) badges.push('<span class="badge b-done">Done</span>');

    let srcTags = (it.sourceCells && it.sourceCells.length > 1)
      ? it.sourceCells.map(s => `<span class="source-tag">${schedEsc(s)}</span>`).join('')
      : (variantSources.length > 1 && it.sourceCell) ? `<span class="source-tag">${schedEsc(it.sourceCell)}</span>` : '';
    if (isWarrantyType) srcTags += ' <span class="warranty-source-tag">Warranty</span>';

    const qtyDisplay = `<div class="card-qty-block qty-clean"><span class="card-qty-label">QTY</span><span class="card-qty-value">${schedEsc(it.qty)}</span>${it.qty !== it.totalQty ? `<span class="card-qty-total-clean">of ${schedEsc(it.totalQty)}</span>` : ''}</div>`;

    let orderRows = '';
    if (it.orderBreakdown && it.orderBreakdown.length) {
      orderRows = it.orderBreakdown.map(ob => {
        if (!ob.orderNum) return '';
        const orderKey = _normOrderNumber(ob.orderNum);
        const isDone = doneOrders[ob.orderNum];
        const isBlacklisted = blacklistedOrderSet.has(orderKey);
        const needsInspect = isWarrantyType || isReplacementType;
        const doneOnclick = needsInspect
          ? `toggleOrderDoneWithInspect(${realIdx},'${jsArg(ob.orderNum)}','${jsArg(it.sku)}','${jsArg(it.orderType)}')`
          : `toggleOrderDone(${realIdx},'${jsArg(ob.orderNum)}')`;
        return `<div class="order-row${isDone ? ' order-done' : ''}${isBlacklisted ? ' order-blacklisted' : ''}"><span class="order-row-num">${schedEsc(ob.orderNum)}</span><span class="order-row-qty">×${schedEsc(ob.qty)}</span><div class="order-row-actions"><button class="order-act-btn${isDone ? ' done' : ''}" onclick="${doneOnclick}">${isDone ? 'Undo' : 'Done'}</button>${!it.lockedSource && Number(ob.qty || 0) > 1 ? `<button class="order-act-btn split" onclick="splitOrderChunk(${realIdx},'${jsArg(ob.orderNum)}')">Split</button>` : ''}${!it.lockedSource ? `<button class="order-act-btn remove" onclick="removeOrderByNum(${realIdx},'${jsArg(ob.orderNum)}')">Remove</button>` : ''}${isBlacklisted ? '<span class="order-status-chip blocked">Blocked</span>' : ''}</div></div>`;
      }).join('');
    }

    const hasOrders = it.orderBreakdown?.some(ob => ob.orderNum);
    const ordersToggle = hasOrders ? `<button class="orders-toggle-btn" onclick="toggleOrdersPanel(this)" aria-expanded="false">Orders <span class="orders-toggle-count">${it.orderBreakdown.filter(o => o.orderNum).length}</span></button>` : '';
    const ordersPanel  = hasOrders ? `<div class="orders-panel" style="display:none;">${orderRows}</div>` : '';
    const mustShipToggle = `<label class="must-ship-toggle" title="Toggle Must Ship"><input type="checkbox" ${it.mustShip ? 'checked' : ''} onchange="toggleMustShip(${realIdx},this.checked)"><span>Must Ship</span></label>`;

        const shortageMaterialLabel = shortageImpact ? `${shortageImpact.materialSku}${shortageImpact.componentSku && shortageImpact.componentSku !== shortageImpact.materialSku ? ` (BOM: ${shortageImpact.componentSku})` : ''}` : '';
    const shortageNotes = shortageImpact?.notes || '';
    const shortageStatusLabel = shortageImpact?.status === 'out_of_stock' ? 'Out of Stock' : shortageImpact?.status === 'low_quantity' ? 'Low Quantity' : 'Shortage';

    const normalMatsRow = `<div class="card-mats"><div class="${matGroupCls('boxes')}"><label>Boxes</label><select class="${matSelCls('boxes',it.boxes)}" onchange="setMat(${realIdx},'boxes',this)">${buildOpts(it.boxes, it.qty)}</select>${matPrint('Boxes', it.boxes)}</div><div class="${matGroupCls('hardware')}"><label>Hardware</label><select class="${matSelCls('hardware',it.hardware)}" onchange="setMat(${realIdx},'hardware',this)">${buildOpts(it.hardware, it.qty)}</select>${matPrint('Hardware', it.hardware)}</div><div class="${matGroupCls('lumber')}"><label>Lumber</label><select class="${matSelCls('lumber',it.lumber)}" onchange="setMat(${realIdx},'lumber',this)">${buildOpts(it.lumber, it.qty)}</select>${matPrint('Lumber', it.lumber)}</div><div class="mat-div"></div><button class="tog-btn ${it.showSlings ? 'on' : ''}" onclick="tog(${realIdx},'showSlings')">${it.showSlings ? 'x' : '+'} Slings</button>${it.showSlings ? `<div class="${matGroupCls('slings')}"><label>Slings</label><select class="${matSelCls('slings',it.slings)}" onchange="setMat(${realIdx},'slings',this)">${buildOpts(it.slings, it.qty)}</select>${matPrint('Slings', it.slings)}</div>` : ''}<button class="tog-btn ${it.showBentParts ? 'on' : ''}" onclick="tog(${realIdx},'showBentParts')">${it.showBentParts ? 'x' : '+'} Bent Parts</button>${it.showBentParts ? `<div class="${matGroupCls('bentParts')}"><label>Bent Parts</label><select class="${matSelCls('bentParts',it.bentParts)}" onchange="setMat(${realIdx},'bentParts',this)">${buildOpts(it.bentParts, it.qty)}</select>${matPrint('Bent Parts', it.bentParts)}</div>` : ''}</div>`;
    const matsRow = isBlocked
      ? `<div class="card-mats" style="background:var(--red-dim);border-top:1px solid var(--red);"><span style="color:var(--red);font-size:12px;font-weight:600;">Blocked — ${shortageStatusLabel}${shortageMaterialLabel ? `: ${schedEsc(shortageMaterialLabel)}` : ''}.${shortageNotes ? `<span style="color:var(--text-muted);margin-left:6px;">${schedEsc(shortageNotes)}</span>` : ''} Remove this item or mark the material/profile in stock before saving.</span></div>`
      : isGreyList
        ? `<div class="card-mats" style="background:var(--yellow-dim);border-top:1px solid var(--yellow);"><span style="color:var(--yellow);font-size:12px;font-weight:600;">Low Quantity${shortageMaterialLabel ? `: ${schedEsc(shortageMaterialLabel)}` : ''}.${shortageNotes ? `<span style="color:var(--text-muted);margin-left:6px;">${schedEsc(shortageNotes)}</span>` : ''} ${isSup ? `<button class="btn btn-ghost btn-xs" style="margin-left:8px;" onclick="openShortageApprove('${jsArg(it.sku)}','${jsArg(shortageNotes)}','${jsArg(shortageImpact?.materialSku || '')}','${jsArg(shortageImpact?.componentSku || '')}','${jsArg(shortageImpact?.status || 'low_quantity')}')">Approve Override</button>` : 'A supervisor, manager, or admin must approve scheduling this SKU.'}</span></div>${normalMatsRow}`
        : normalMatsRow;
    const dragAttrs = canDrag ? `draggable="true" ondragstart="onDS(event,${realIdx})" ondragover="onDO(event,${realIdx})" ondrop="onDP(event,${realIdx})" ondragleave="onDL(event)" ondragend="onDE(event)"` : `draggable="false" title="Warranty items cannot be reordered"`;
    // Material handler progress indicators — shown on cell's schedule card
    const orderKey0 = (it.orderNums && it.orderNums[0]) || `idx_${realIdx}`;
    const ev = (typeof matEventState !== 'undefined' && matEventState[orderKey0]) || {};
    const evBits = [];
    if (ev.done && ev.doneByRole && Object.keys(ev.doneByRole).length) {
      // One badge per unique material label — deduplicated so two handlers of the same type
      // do not produce duplicate badges. The cell view must always call out the material
      // specifically (Boxes, Lumber, Hardware, Bent Parts, Slings), never generic "Parts".
      const seenLabels = new Set();
      Object.entries(ev.doneByRole).forEach(([roleOrActor, lbl]) => {
        const resolved = materialReadyLabelForRole(roleOrActor)
          || materialReadyLabelForActor(roleOrActor)
          || (lbl && lbl !== 'true' && lbl !== 'Parts' && lbl !== MATERIAL_READY_FALLBACK ? lbl : null)
          || MATERIAL_READY_FALLBACK;
        if (!seenLabels.has(resolved)) {
          seenLabels.add(resolved);
          evBits.push(`<span class="mat-event-badge mat-event-done">✓ ${schedEsc(resolved)} Ready</span>`);
        }
      });
    } else if (ev.done) {
      // Never render "Parts Ready". If a legacy event has no resolvable actor/role,
      // keep the ready state visible with a neutral material label rather than dropping it.
      evBits.push(`<span class="mat-event-badge mat-event-done">✓ ${schedEsc(MATERIAL_READY_FALLBACK)} Ready</span>`);
    }
    // Pulled / Prepped / Delivered ("To Cell") are internal handler states — not shown on cell view
    const matEventsRow = evBits.length ? `<div class="card-mat-events">${evBits.join('')}</div>` : '';
    html.push(`<div class="${cls.join(' ')}" ${dragAttrs} data-idx="${realIdx}"><div class="card-row"><span class="card-drag" style="${canDrag ? '' : 'opacity:.2;cursor:not-allowed;'}">&#8942;</span><div class="card-sku"><div class="card-sku-top"><span class="card-sku-name">${schedEsc(it.sku)}</span><span class="takt-pill">${schedEsc(it.taktStr)}</span>${dueBadge(it.dueDate)}<div class="card-badges">${badges.join('')}</div>${srcTags}</div>${it.description ? `<div class="card-sku-desc">${schedEsc(it.description)}</div>` : ''}${qtyDisplay}${matEventsRow}<div class="card-orders-wrap">${ordersToggle}${ordersPanel}</div></div><div class="card-right">${mustShipToggle}<button class="card-remove-btn" onclick="removeCard(${realIdx})">Remove</button></div></div>${matsRow}</div>`);
  });
  list.innerHTML = html.join('');
  buildPrintTable();
  updateTotals();
}

function setMat(idx, field, sel) {
  scheduleItems[idx][field] = sel.value;
  sel.className = matSelCls(field, sel.value);
  markUnsaved();
  updateTotals();
  // Auto-persist material change if schedule is saved
  if (savedScheduleId) {
    const it = scheduleItems[idx];
    const patch = {};
    if (field === 'boxes')     patch.boxes_needed     = sel.value;
    if (field === 'hardware')  patch.hardware_needed  = sel.value;
    if (field === 'lumber')    patch.lumber_needed    = sel.value;
    if (field === 'slings')    patch.slings_needed    = sel.value;
    if (field === 'bentParts') patch.bent_parts_needed = sel.value;
    sb(`sts_schedule_items?schedule_id=eq.${savedScheduleId}&sku=eq.${encodeURIComponent(it.sku)}&sort_order=eq.${idx}`, 'PATCH', patch)
      .catch(() => {}); // silent — local state already updated
  }
}
function tog(idx, field) { scheduleItems[idx][field] = !scheduleItems[idx][field]; render(); }

// ── Inline must-ship toggle ──
function toggleMustShip(idx, checked) {
  scheduleItems[idx].mustShip = checked;
  // Auto-persist if saved
  if (savedScheduleId) {
    sb(`sts_schedule_items?schedule_id=eq.${savedScheduleId}&sort_order=eq.${idx}`, 'PATCH', { must_ship: checked }, { prefer:'return=minimal' }).catch(() => {});
  }
  render(); markUnsaved();
}

// ── Order done toggle (standard) ──
function toggleOrderDone(realIdx, orderNum) {
  if (!orderDoneState[realIdx]) orderDoneState[realIdx] = {};
  const nowDone = !orderDoneState[realIdx][orderNum];
  orderDoneState[realIdx][orderNum] = nowDone;
  const it = scheduleItems[realIdx];
  logAction(nowDone ? LOG.ORDER_DONE : LOG.ORDER_UNDONE, { sku: it?.sku, order_number: orderNum });
  // Auto-persist done state if schedule is already saved
  if (savedScheduleId) {
    sb('sts_schedules?id=eq.' + savedScheduleId, 'PATCH', { order_done_state: JSON.stringify(orderDoneState) }, { prefer: 'return=minimal' }).catch(() => {});
  }
  render();
}

// ── Order done for warranty/replacement — prompts supervisor inspection ──
function toggleOrderDoneWithInspect(realIdx, orderNum, sku, orderType) {
  if (!orderDoneState[realIdx]) orderDoneState[realIdx] = {};
  const nowDone = !orderDoneState[realIdx][orderNum];
  orderDoneState[realIdx][orderNum] = nowDone;
  if (nowDone) {
    const typeLabel = orderType === 'warranty' ? 'Warranty' : 'Full Replacement';
    pendingInspections.push({ orderNum, sku, typeLabel, cell: cellName, markedBy: currentUser.name, markedAt: new Date().toISOString() });
    sb('sts_inspection_queue?select=id', 'POST', {
      order_number: orderNum, sku, order_type: orderType, cell_name: cellName,
      marked_by: currentUser.name, campus: currentUser.campus, status: 'pending',
      created_at: new Date().toISOString()
    }).catch(() => {});
    logAction(LOG.INSPECT_REQUESTED, { sku, order_number: orderNum, note: typeLabel + ' marked done' });
    toast(`${typeLabel} marked done — supervisor notified to inspect`, 'info');
  } else {
    logAction(LOG.ORDER_UNDONE, { sku, order_number: orderNum });
  }
  // Auto-persist done state if schedule is already saved
  if (savedScheduleId) {
    sb('sts_schedules?id=eq.' + savedScheduleId, 'PATCH', { order_done_state: JSON.stringify(orderDoneState) }, { prefer: 'return=minimal' }).catch(() => {});
  }
  render();
}

// ── Toggle the orders panel open/closed ──
function toggleOrdersPanel(btn) {
  const panel = btn.nextElementSibling;
  const open  = panel.style.display === 'none';
  panel.style.display  = open ? 'flex' : 'none';
  btn.setAttribute('aria-expanded', open);
}


// ── Auto sort — group like SKUs together, ignoring color suffixes ──
function openAutoSortModal() {
  if (!scheduleItems.length) { toast('No schedule loaded to sort', 'info'); return; }
  document.getElementById('modal-auto-sort').classList.add('open');
}

// Called by each sort option button in the modal
function runAutoSort(mode) {
  closeModal('modal-auto-sort');
  if (!scheduleItems.length) return;
  const before = scheduleItems.map(it => it.sku + '|' + it.dueDate).join('~');

  switch (mode) {
    case 'like-sku':
      scheduleItems = scheduleItems
        .map((it, i) => ({ it, i }))
        .sort((a, b) => {
          const aBase = baseSku(a.it.sku), bBase = baseSku(b.it.sku);
          if (aBase !== bBase) return aBase.localeCompare(bBase, undefined, { numeric: true, sensitivity: 'base' });
          const skuCmp = String(a.it.sku).localeCompare(String(b.it.sku), undefined, { numeric: true, sensitivity: 'base' });
          if (skuCmp) return skuCmp;
          const dueCmp = String(a.it.dueDate || '').localeCompare(String(b.it.dueDate || ''));
          return dueCmp || a.i - b.i;
        })
        .map(r => r.it);
      break;

    case 'due-date':
      scheduleItems = scheduleItems
        .map((it, i) => ({ it, i }))
        .sort((a, b) => {
          const ad = a.it.dueDate, bd = b.it.dueDate;
          if (ad && bd) return ad.localeCompare(bd);
          if (ad && !bd) return -1;
          if (!ad && bd) return  1;
          return a.i - b.i;
        })
        .map(r => r.it);
      break;

    case 'takt-asc':
      scheduleItems = [...scheduleItems].sort((a, b) => (a.taktMins || 0) - (b.taktMins || 0));
      break;

    case 'takt-desc':
      scheduleItems = [...scheduleItems].sort((a, b) => (b.taktMins || 0) - (a.taktMins || 0));
      break;

    case 'must-ship':
      scheduleItems = scheduleItems
        .map((it, i) => ({ it, i }))
        .sort((a, b) => {
          if (a.it.mustShip !== b.it.mustShip) return a.it.mustShip ? -1 : 1;
          const ad = a.it.dueDate, bd = b.it.dueDate;
          if (ad && bd) return ad.localeCompare(bd);
          if (ad && !bd) return -1;
          if (!ad && bd) return  1;
          return a.i - b.i;
        })
        .map(r => r.it);
      break;

    default:
      return;
  }

  const after = scheduleItems.map(it => it.sku + '|' + it.dueDate).join('~');
  if (after === before) { toast('Already sorted that way', 'info'); return; }
  logAction(LOG.ITEM_REORDERED, { note: 'Auto sorted: ' + mode });
  render(); markUnsaved();
  toast('Schedule sorted', 'ok');
}

// Legacy alias — still called by ensureAutoSortButton in older cached HTML
function autoSortLikeSkus() { openAutoSortModal(); }


function _roundOneDecimal(n) { return Math.round(Number(n || 0) * 10) / 10; }
function _needVal(n) { return n > 0 ? `need_${n}` : 'have_all'; }
function _splitNeedValue(value, originalQty, splitQty) {
  if (!value || value === 'have_all') return { left: value || 'have_all', split: value || 'have_all' };
  const match = String(value).match(/^need_(\d+)$/);
  if (!match) return { left: value, split: value };
  const need = parseInt(match[1], 10) || 0;
  if (need <= 0 || originalQty <= 0) return { left: 'have_all', split: 'have_all' };
  let splitNeed = Math.round(need * (splitQty / originalQty));
  splitNeed = Math.max(0, Math.min(need, splitNeed));
  return { left: _needVal(Math.max(0, need - splitNeed)), split: _needVal(splitNeed) };
}
function _syncItemAfterOrderBreakdownChange(it) {
  const rows = it.orderBreakdown || [];
  const qty = rows.reduce((sum, ob) => sum + (Number(ob.qty) || 0), 0);
  const takt = rows.reduce((sum, ob) => sum + (Number(ob.taktMins) || 0), 0);
  it.qty = Math.max(0, qty); it.totalQty = it.qty; it.taktMins = _roundOneDecimal(takt); it.taktStr = fmtTakt(it.taktMins);
  it.orderNums = rows.map(ob => ob.orderNum).filter(Boolean); it.orderNum = it.orderNums[0] || null; it.merged = rows.length > 1;
}

let pendingSplitOrder = null;

function ensureSplitOrderModal() {
  if (document.getElementById('modal-split-order')) return;

  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-bd" id="modal-split-order" style="z-index:650;">
      <div class="modal" style="max-width:520px;width:100%;">
        <div class="modal-title">Split Order Run</div>
        <div class="modal-sub" id="split-order-sub">Move part of this order into a separate draggable card.</div>

        <div class="split-detail-card">
          <div><span class="split-detail-label">SKU</span><span class="split-detail-value" id="split-order-sku">—</span></div>
          <div><span class="split-detail-label">Order</span><span class="split-detail-value" id="split-order-num">—</span></div>
          <div><span class="split-detail-label">Current Qty</span><span class="split-detail-value" id="split-order-current">—</span></div>
        </div>

        <div class="field-group">
          <label class="field-label">Quantity to split into a new card</label>
          <input class="input" id="split-order-qty" type="number" min="1" step="1">
          <div id="split-order-help" style="font-size:12px;color:var(--text-muted);margin-top:6px;"></div>
          <div id="split-order-error" style="font-size:12px;color:var(--red);margin-top:6px;display:none;"></div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-ghost" onclick="closeSplitOrderModal()">Cancel</button>
          <button class="btn btn-primary" onclick="confirmSplitOrderChunk()">Split Order</button>
        </div>
      </div>
    </div>`);
}

function closeSplitOrderModal() {
  pendingSplitOrder = null;
  const modal = document.getElementById('modal-split-order');
  if (modal) modal.classList.remove('open');
}

function splitOrderChunk(cardIdx, orderNum) {
  const it = scheduleItems[cardIdx];
  if (!it || !it.orderBreakdown || !it.orderBreakdown.length) {
    toast('No order found to split', 'err');
    return;
  }

  const target = _normOrderNumber(orderNum);
  const obIdx = it.orderBreakdown.findIndex(ob => _normOrderNumber(ob.orderNum) === target);
  if (obIdx === -1) {
    toast('Order not found on this card', 'err');
    return;
  }

  const ob = it.orderBreakdown[obIdx];
  const currentQty = Number(ob.qty || 0);
  if (currentQty <= 1) {
    toast('Order quantity must be greater than 1 to split', 'info');
    return;
  }

  ensureSplitOrderModal();

  pendingSplitOrder = { cardIdx, orderNum: ob.orderNum, maxQty: currentQty - 1 };

  document.getElementById('split-order-sku').textContent = it.sku;
  document.getElementById('split-order-num').textContent = ob.orderNum || '—';
  document.getElementById('split-order-current').textContent = currentQty;

  const input = document.getElementById('split-order-qty');
  input.min = '1';
  input.max = String(currentQty - 1);
  input.value = String(Math.max(1, Math.floor(currentQty / 2)));

  document.getElementById('split-order-help').textContent = `Enter 1 to ${currentQty - 1}. The split quantity becomes a new card that can be dragged to another priority position.`;
  document.getElementById('split-order-error').style.display = 'none';
  document.getElementById('split-order-error').textContent = '';

  document.getElementById('modal-split-order').classList.add('open');
  setTimeout(() => { input.focus(); input.select(); }, 50);
}

function confirmSplitOrderChunk() {
  if (!pendingSplitOrder) return;

  const input = document.getElementById('split-order-qty');
  const err = document.getElementById('split-order-error');
  const splitQty = Math.floor(Number(input.value));
  const maxQty = Number(pendingSplitOrder.maxQty || 0);

  if (!Number.isFinite(splitQty) || splitQty < 1 || splitQty > maxQty) {
    err.textContent = `Enter a split quantity from 1 to ${maxQty}.`;
    err.style.display = 'block';
    return;
  }

  const { cardIdx, orderNum } = pendingSplitOrder;
  closeSplitOrderModal();
  _performSplitOrderChunk(cardIdx, orderNum, splitQty);
}

function _performSplitOrderChunk(cardIdx, orderNum, splitQty) {
  const it = scheduleItems[cardIdx];
  if (!it || !it.orderBreakdown || !it.orderBreakdown.length) {
    toast('No order found to split', 'err');
    return;
  }

  const target = _normOrderNumber(orderNum);
  const obIdx = it.orderBreakdown.findIndex(ob => _normOrderNumber(ob.orderNum) === target);
  if (obIdx === -1) {
    toast('Order not found on this card', 'err');
    return;
  }

  const ob = it.orderBreakdown[obIdx];
  const currentQty = Number(ob.qty || 0);
  if (splitQty < 1 || splitQty >= currentQty) {
    toast(`Enter a split quantity from 1 to ${currentQty - 1}`, 'err');
    return;
  }

  const originalItemQty = Number(it.qty || currentQty);
  const originalOrderTakt = Number(ob.taktMins || 0);
  const taktPerUnit = currentQty > 0 ? originalOrderTakt / currentQty : 0;
  const splitTakt = _roundOneDecimal(taktPerUnit * splitQty);
  const leftTakt = _roundOneDecimal(originalOrderTakt - splitTakt);
  const matBefore = { boxes: it.boxes, hardware: it.hardware, lumber: it.lumber, slings: it.slings, bentParts: it.bentParts };

  const splitOb = { ...ob, qty: splitQty, taktMins: splitTakt };
  ob.qty = currentQty - splitQty;
  ob.taktMins = leftTakt;

  const splitItem = {
    ...it,
    qty: splitQty,
    totalQty: splitQty,
    taktMins: splitTakt,
    taktStr: fmtTakt(splitTakt),
    orderNum: splitOb.orderNum,
    orderNums: splitOb.orderNum ? [splitOb.orderNum] : [],
    orderBreakdown: [splitOb],
    merged: false,
    sourceCells: Array.isArray(it.sourceCells) ? [...it.sourceCells] : [it.sourceCell || cellName],
  };

  ['boxes','hardware','lumber','slings','bentParts'].forEach(field => {
    const parts = _splitNeedValue(matBefore[field], originalItemQty, splitQty);
    it[field] = parts.left;
    splitItem[field] = parts.split;
  });

  _syncItemAfterOrderBreakdownChange(it);

  if (it.qty <= 0) scheduleItems.splice(cardIdx, 1, splitItem);
  else scheduleItems.splice(cardIdx + 1, 0, splitItem);

  logAction(LOG.ITEM_ADDED, { sku: splitItem.sku, order_number: splitItem.orderNum, quantity: splitQty, note: 'Split order chunk' });
  render();
  markUnsaved();
  toast(`Split ${splitQty} unit${splitQty !== 1 ? 's' : ''} from ${splitItem.orderNum}`, 'ok');
}

// ── Remove order by order number ──
function removeOrderByNum(cardIdx, orderNum) {
  const it = scheduleItems[cardIdx];
  if (!it.orderBreakdown) return;
  const oi = it.orderBreakdown.findIndex(ob => _normOrderNumber(ob.orderNum) === _normOrderNumber(orderNum));
  if (oi === -1) return;
  if (it.orderBreakdown.length <= 1) {
    if (!confirm('Remove this SKU entirely?')) return;
    logAction(LOG.ITEM_REMOVED, { sku: it.sku, order_number: orderNum });
    scheduleItems.splice(cardIdx, 1); render(); markUnsaved(); return;
  }
  const removed = it.orderBreakdown.splice(oi, 1)[0];
  it.qty      = Math.max(0, it.qty      - (removed.qty      || 0));
  it.totalQty = Math.max(0, it.totalQty - (removed.qty      || 0));
  it.taktMins = Math.max(0, it.taktMins - (removed.taktMins || 0));
  it.taktStr  = fmtTakt(it.taktMins);
  it.orderNums = it.orderBreakdown.map(o => o.orderNum).filter(Boolean);
  it.merged    = it.orderBreakdown.length > 1;
  logAction(LOG.ORDER_REMOVED, { sku: it.sku, order_number: orderNum, quantity: removed.qty });
  if (it.qty <= 0) scheduleItems.splice(cardIdx, 1);
  render(); markUnsaved();
}

// ── Remove whole card ──
function removeCard(cardIdx) {
  const it = scheduleItems[cardIdx];
  if (!confirm('Remove this SKU from the schedule?')) return;
  logAction(LOG.ITEM_REMOVED, { sku: it?.sku, quantity: it?.qty });
  scheduleItems.splice(cardIdx, 1); render(); markUnsaved();
}

// ── Blacklist ──
function blacklistOrder(orderNum) {
  if (!confirm(`Block order ${orderNum} from being scheduled?`)) return;
  blacklistedOrders.add(_normOrderNumber(orderNum));
  sb('sts_blacklisted_orders?select=id', 'POST', { order_number: orderNum, blocked_by: currentUser.name, campus: currentUser.campus, created_at: new Date().toISOString() })
    .catch(() => {});
  logAction(LOG.ORDER_BLACKLISTED, { order_number: orderNum });
  render(); toast('Order ' + orderNum + ' blocked', 'info');
}
function unblacklistOrder(orderNum) {
  blacklistedOrders.delete(_normOrderNumber(orderNum));
  sb(`sts_blacklisted_orders?order_number=eq.${orderNum}`, 'DELETE').catch(() => {});
  logAction(LOG.ORDER_UNBLACKLISTED, { order_number: orderNum });
  render(); toast('Order ' + orderNum + ' unblocked', 'info');
}

// ── Edit card modal — users: mustShip toggle only; supervisors: also materials ──
function openEditCard(idx) {
  const it    = scheduleItems[idx];
  const isSup = SUP_ROLES.includes(currentUser.role);
  document.getElementById('edit-card-idx').value        = idx;
  document.getElementById('edit-card-sku-display').textContent  = it.sku;
  document.getElementById('edit-card-qty-display').textContent  = it.qty;
  document.getElementById('edit-card-due-display').textContent  = it.dueDate || '—';
  document.getElementById('edit-card-mustship').checked = !!it.mustShip;
  // Supervisor-only materials section
  const matSection = document.getElementById('edit-card-mat-section');
  if (isSup && matSection) {
    matSection.style.display = 'block';
    document.getElementById('edit-mat-boxes').value    = it.boxes    || 'have_all';
    document.getElementById('edit-mat-hardware').value = it.hardware || 'have_all';
    document.getElementById('edit-mat-lumber').value   = it.lumber   || 'have_all';
  } else if (matSection) {
    matSection.style.display = 'none';
  }
  document.getElementById('modal-edit-card').classList.add('open');
}
function saveEditCard() {
  const idx   = parseInt(document.getElementById('edit-card-idx').value);
  const it    = scheduleItems[idx];
  if (!it) return;
  const isSup = SUP_ROLES.includes(currentUser.role);
  it.mustShip = document.getElementById('edit-card-mustship').checked;
  if (isSup) {
    const boxes = document.getElementById('edit-mat-boxes')?.value;
    const hw    = document.getElementById('edit-mat-hardware')?.value;
    const lmbr  = document.getElementById('edit-mat-lumber')?.value;
    if (boxes) it.boxes    = boxes;
    if (hw)    it.hardware = hw;
    if (lmbr)  it.lumber   = lmbr;
  }
  closeModal('modal-edit-card'); render(); markUnsaved();
}

// ── Add item modal ──
function openAddItemModal() {
  document.getElementById('add-item-sku').value   = '';
  document.getElementById('add-item-qty').value   = '1';
  document.getElementById('add-item-takt').value  = '0';
  document.getElementById('add-item-due').value   = '';
  document.getElementById('add-item-order').value = '';
  document.getElementById('add-item-mustship').checked = false;
  document.getElementById('modal-add-item').classList.add('open');
}
function confirmAddItem() {
  const sku   = document.getElementById('add-item-sku').value.trim().toUpperCase();
  const qty   = Math.max(1, parseInt(document.getElementById('add-item-qty').value)  || 1);
  const takt  = Math.max(0, parseInt(document.getElementById('add-item-takt').value) || 0);
  const due   = document.getElementById('add-item-due').value || null;
  const order = document.getElementById('add-item-order').value.trim() || null;
  const ms    = document.getElementById('add-item-mustship').checked;
  if (!sku) { toast('SKU is required', 'err'); return; }
  const newItem = {
    sku, qty, totalQty: qty, taktMins: takt, taktStr: fmtTakt(takt),
    dueDate: due, mustShip: ms, orderNum: order, orderNums: order ? [order] : [],
    orderBreakdown: order ? [{ orderNum: order, qty, taktMins: takt, dueDate: due }] : [],
    orderType: 'standard', sourceCell: cellName, sourceCells: [cellName],
    boxes: 'have_all', hardware: 'have_all', lumber: 'have_all',
    slings: 'have_all', bentParts: 'have_all',
    showSlings: false, showBentParts: false, merged: false, description: '',
  };
  scheduleItems.push(newItem);
  closeModal('modal-add-item'); render(); markUnsaved();
  toast('Added ' + sku, 'ok');
}

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
  renderHandlerDoneView(role, cfg);
}

// Simplified "Done" view — one button per SKU/order, no pulled/prepped/delivered complexity
function renderHandlerDoneView(role, cfg, bldgFilter) {
  const wrap = document.getElementById('mat-handler-view');
  const campusBuildings = getBuildingsForCampus(currentUser.campus);

  // Building filter — remember last selection
  if (bldgFilter !== undefined) wrap._bldgFilter = bldgFilter;
  const activeBldg = wrap._bldgFilter || 'all';

  // Building filter pills
  const bldgPills = `<div class="mh-bldg-filter">
    <button class="mh-bldg-pill${activeBldg === 'all' ? ' active' : ''}" onclick="renderHandlerDoneView('${jsArg(role)}',MAT_HANDLER_CONFIG['${jsArg(role)}'],'all')">All</button>
    ${Object.keys(campusBuildings).map(b =>
      `<button class="mh-bldg-pill${activeBldg === b ? ' active' : ''}" onclick="renderHandlerDoneView('${jsArg(role)}',MAT_HANDLER_CONFIG['${jsArg(role)}'],'${jsArg(b)}')">${schedEsc(b)}</button>`
    ).join('')}
  </div>`;

  // Cell list filtered by building
  const allCells = Object.entries(campusBuildings).flatMap(([bldg, v]) =>
    activeBldg !== 'all' && bldg !== activeBldg ? [] :
    (v.cellNames || []).filter(cn => !/secondary/i.test(cn)).map(cn => ({ cn, bldg }))
  );
  const cellBtns = allCells.map(({ cn }) => {
    const active = cn === cellName ? ' mh-cell-active' : '';
    return `<button class="mh-cell-pick${active}" onclick="handlerLoadCell('${jsArg(cn)}','${jsArg(role)}')">${schedEsc(cn)}</button>`;
  }).join('');

  if (!scheduleItems.length) {
    wrap.innerHTML = `
      <div class="mh-cell-browser">
        <div class="mh-cell-browser-label">${schedEsc(cfg.label)} — pick a cell to view its schedule</div>
        ${bldgPills}
        <div class="mh-cell-browser-list">${cellBtns}</div>
      </div>
      <div class="mh-empty">No schedule loaded for this cell.</div>`;
    return;
  }

  const doneCt = scheduleItems.filter((it, idx) => {
    const key = (it.orderNums && it.orderNums[0]) || `idx_${idx}`;
    return !!(matEventState[key]?.doneByRole?.[role]);
  }).length;

  let rows = '';
  scheduleItems.forEach((it, idx) => {
    const orderKey = (it.orderNums && it.orderNums[0]) || `idx_${idx}`;
    // Check done state specific to THIS handler role
    const isDone = !!(matEventState[orderKey]?.doneByRole?.[role]);
    const typeLabel = it.orderType === 'warranty'    ? '<span class="badge b-warranty" style="font-size:10px;padding:2px 4px;">Warranty</span>'
                    : it.orderType === 'replacement' ? '<span class="badge b-replacement" style="font-size:10px;padding:2px 4px;">Repl.</span>'
                    : '';
    const ordersStr = (it.orderNums && it.orderNums.length) ? it.orderNums.map(o => schedEsc(o)).join(', ') : '—';
    rows += `<tr class="mh-done-row${isDone ? ' mh-row-done' : ''}">
      <td class="mhd-sku">${schedEsc(it.sku)} ${typeLabel}</td>
      <td class="mhd-qty">×${schedEsc(String(it.qty))}</td>
      <td class="mhd-orders">${ordersStr}</td>
      <td class="mhd-action">
        <button class="mhd-done-btn${isDone ? ' is-done' : ''}" onclick="toggleHandlerDone('${jsArg(orderKey)}','${jsArg(it.sku)}','${jsArg(role)}',${idx})">
          ${isDone ? '✓ Done' : 'Mark Done'}
        </button>
      </td>
    </tr>`;
  });

  wrap.innerHTML = `
    <div class="mh-cell-browser">
      <div class="mh-cell-browser-label">${schedEsc(cfg.label)}</div>
      ${bldgPills}
      <div class="mh-cell-browser-list">${cellBtns}</div>
    </div>
    <div class="mhd-header">
      <span class="mhd-cell-name">${schedEsc(cellName)}</span>
      <span class="mhd-progress">${doneCt} / ${scheduleItems.length} done</span>
    </div>
    <div class="mh-table-wrap"><table class="mh-table mhd-table">
      <thead><tr><th>SKU</th><th>Qty</th><th>Order(s)</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

async function handlerLoadCell(cn, role) {
  try {
    const scheds = await sb(`sts_schedules?cell_name=eq.${encodeURIComponent(cn)}&campus=eq.${currentUser.campus}&order=created_at.desc&limit=1&select=id`);
    if (!scheds || !scheds.length) { toast('No schedule for ' + cn, 'info'); cellName = cn; scheduleItems = []; showMatHandlerView(role); return; }
    await loadSchedule(scheds[0].id);
    // After load, schedule-list is shown; switch back to handler view
    document.getElementById('schedule-list').style.display = 'none';
    document.getElementById('mat-handler-view').style.display = 'flex';
    showMatHandlerView(role);
  } catch(e) { toast('Load failed: ' + e.message, 'err'); }
}

async function toggleHandlerDone(orderKey, sku, role, idx) {
  if (!matEventState[orderKey]) matEventState[orderKey] = {};
  const cfg = MAT_HANDLER_CONFIG[role];
  const doneLabel = cfg ? cfg.col : role.replace(/_/g, ' ');
  const eventActor = materialEventActorForRole(role);

  // Track done per-handler-role so multiple handlers on the same order don't collide
  if (!matEventState[orderKey].doneByRole) matEventState[orderKey].doneByRole = {};
  const wasRoleDone = !!matEventState[orderKey].doneByRole[role];
  const nowDone = !wasRoleDone;

  if (nowDone) {
    matEventState[orderKey].doneByRole[role] = doneLabel;
    matEventState[orderKey].done = true;
  } else {
    delete matEventState[orderKey].doneByRole[role];
    matEventState[orderKey].done = Object.keys(matEventState[orderKey].doneByRole).length > 0;
  }

  try {
    // DB constraint only allows: pulled, prepped, delivered — use 'delivered' for handler Done.
    // IMPORTANT: the DB has a unique constraint on (schedule_id, order_number, event_type).
    // Handler-specific ready signals must allow Boxes + Lumber + Hardware on the same order,
    // so these role-specific delivered rows are intentionally stored with schedule_id:null and
    // reloaded by cell_name. PostgreSQL unique indexes allow multiple NULL schedule_id values.
    if (nowDone) {
      // Remove this handler's previous signal first so repeated clicks/reloads do not stack duplicates.
      await sb(`sts_material_events?order_number=eq.${encodeURIComponent(orderKey)}&event_type=eq.delivered&cell_name=eq.${encodeURIComponent(cellName)}&actor=eq.${encodeURIComponent(eventActor)}`, 'DELETE').catch(() => {});
      await sb('sts_material_events', 'POST', {
        schedule_id: null,
        order_number: orderKey,
        sku,
        event_type: 'delivered',
        actor: eventActor,
        campus: currentUser.campus,
        cell_name: cellName,
        created_at: new Date().toISOString()
      }, { prefer: 'return=minimal' });
    } else {
      // Delete this handler's delivered event (filtered by actor so other handlers' records stay)
      await sb(`sts_material_events?order_number=eq.${encodeURIComponent(orderKey)}&event_type=eq.delivered&cell_name=eq.${encodeURIComponent(cellName)}&actor=eq.${encodeURIComponent(eventActor)}`, 'DELETE');
      // Cleanup compatibility: older builds stored only the actor name, with no role suffix.
      await sb(`sts_material_events?order_number=eq.${encodeURIComponent(orderKey)}&event_type=eq.delivered&cell_name=eq.${encodeURIComponent(cellName)}&actor=eq.${encodeURIComponent(currentUser.name)}`, 'DELETE').catch(() => {});
    }
  } catch(e) {
    console.warn('toggleHandlerDone DB error:', e.message);
  }

  if (cfg) renderHandlerDoneView(role, cfg, document.getElementById('mat-handler-view')?._bldgFilter);
}

// Legacy compat — keep old function names referenced elsewhere
function renderBoxHandlerView(cfg) {
  const role = activeViewAs || currentUser.role;
  const wrap = document.getElementById('mat-handler-view');
  renderHandlerDoneView(role, cfg, wrap?._bldgFilter);
}
function renderMatHandlerTable(role, cfg) {
  const wrap = document.getElementById('mat-handler-view');
  renderHandlerDoneView(role, cfg, wrap?._bldgFilter);
}

// ── Material event workflow ──
// matEventState[orderNum] = { pulled: bool, prepped: bool, delivered: bool }
// Loaded from sts_material_events when schedule loads, written on each action.
let matEventState = {};

async function loadMatEvents() {
  if (!savedScheduleId && !cellName) return;
  try {
    matEventState = {};

    // Load all events tied to this schedule_id (supervisor workflow: pulled/prepped/delivered)
    if (savedScheduleId) {
      const rows = await sb(`sts_material_events?schedule_id=eq.${savedScheduleId}&select=order_number,event_type,actor`);
      (rows || []).forEach(r => {
        if (!matEventState[r.order_number]) matEventState[r.order_number] = {};
        // Mark pulled/prepped for internal tracking — NOT shown as badges on the cell view
        matEventState[r.order_number][r.event_type] = true;
      });
    }

    // Load ALL delivered events for this cell_name — these are handler "Done" signals.
    // We identify them by cell_name so they persist even when schedule_id differs between sessions.
    if (cellName) {
      await ensureMaterialActorCache();
      const doneRows = await sb(`sts_material_events?cell_name=eq.${encodeURIComponent(cellName)}&event_type=eq.delivered&select=order_number,event_type,actor`);
      const actorLabelCache = {};
      (doneRows || []).forEach(r => {
        if (!matEventState[r.order_number]) matEventState[r.order_number] = {};
        matEventState[r.order_number].done = true;
        if (!matEventState[r.order_number].doneByRole) matEventState[r.order_number].doneByRole = {};

        if (!(r.actor in actorLabelCache)) {
          actorLabelCache[r.actor] = materialReadyLabelForActor(r.actor);
        }
        const resolvedLabel = actorLabelCache[r.actor] || MATERIAL_READY_FALLBACK;
        const actorName = materialActorDisplayName(r.actor);
        const roleKey = materialRoleFromEventActor(r.actor)
          || (allEmployees || []).find(e => String(e.name || '').trim() === actorName)?.role
          || r.actor;
        matEventState[r.order_number].doneByRole[roleKey] = resolvedLabel;
      });
    }
  } catch(e) { /* table may not exist yet */ }
}

async function setMatEvent(orderNum, sku, eventType, checked) {
  if (checked) {
    if (!matEventState[orderNum]) matEventState[orderNum] = {};
    matEventState[orderNum][eventType] = true;
    sb('sts_material_events', 'POST', [{
      schedule_id: savedScheduleId || null, order_number: orderNum, sku,
      event_type: eventType, actor: currentUser.name, campus: currentUser.campus,
      cell_name: cellName, created_at: new Date().toISOString()
    }]).catch(() => {});
    logAction(eventType === 'pulled' ? LOG.MAT_PULLED : eventType === 'prepped' ? LOG.MAT_PREPPED : LOG.MAT_DELIVERED,
      { order_number: orderNum, sku, note: cellName });
  } else {
    if (matEventState[orderNum]) delete matEventState[orderNum][eventType];
    sb(`sts_material_events?schedule_id=eq.${savedScheduleId||'null'}&order_number=eq.${orderNum}&event_type=eq.${eventType}`, 'DELETE').catch(() => {});
  }
  // Re-render the mat handler view
  const role = activeViewAs || currentUser.role, cfg = MAT_HANDLER_CONFIG[role];
  if (cfg) { if (cfg.showBoxGroups) renderBoxHandlerView(cfg); else renderMatHandlerTable(role, cfg); }
}

function mhToggle(idx, checked) {
  if (!mhCheckState[idx]) mhCheckState[idx] = { done: false, comment: '' };
  mhCheckState[idx].done = checked;
  // Log the mat status change
  const it = scheduleItems[idx];
  if (it) logAction(LOG.MAT_STATUS_CHANGED, { sku: it.sku, order_number: it.orderNums?.[0], note: checked ? 'done' : 'undone' });
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
function markUnsaved() { const el = document.getElementById('meta-saved'); if (scheduleItems.length) { el.style.display = 'inline'; el.textContent = 'Unsaved'; } }
function markSaved()   { lastSavedState = scheduleStateStr(); document.getElementById('meta-saved').textContent = 'Saved'; }
function hasUnsavedChanges() { return lastSavedState === null || scheduleStateStr() !== lastSavedState; }
function openSaveModal() { document.getElementById('save-as-name').textContent = currentUser.name; document.getElementById('save-as-cell').textContent = cellName; document.getElementById('modal-save').classList.add('open'); }

function _normOrderNumber(value) { return String(value || '').trim().toUpperCase(); }
async function refreshBlacklistedOrdersBeforeSave() {
  try {
    const rows = await sb(`sts_blacklisted_orders?campus=eq.${currentUser.campus}&select=order_number`);
    blacklistedOrders = new Set((rows || []).map(r => _normOrderNumber(r.order_number)).filter(Boolean));
  } catch (e) { console.warn('Could not refresh blacklisted orders before save:', e.message); }
}
function _dedupeByKey(rows, keyFn) {
  const seen = new Set();
  return rows.filter(r => { const key = keyFn(r); if (seen.has(key)) return false; seen.add(key); return true; });
}
async function validateScheduleBeforeSave() {
  await refreshBlacklistedOrdersBeforeSave();
  const blockedOrderSet = new Set([...blacklistedOrders].map(_normOrderNumber).filter(Boolean));
  const blockedOrders = [];
  const supplyBlocks = [];
  scheduleItems.forEach(it => {
    (it.orderBreakdown || []).forEach(ob => { const orderNum = _normOrderNumber(ob.orderNum); if (orderNum && blockedOrderSet.has(orderNum)) blockedOrders.push({ orderNum, sku: it.sku, qty: ob.qty }); });
    const direct = (typeof getDirectHardShortageReason === 'function') ? getDirectHardShortageReason(it.sku) : null;
    if (direct) supplyBlocks.push({ sku: it.sku, component: direct.sku, shortageSku: direct.sku, notes: direct.notes || 'Out of stock', source: 'direct' });
    const bom = (typeof getBOMHardBlockReason === 'function') ? getBOMHardBlockReason(it.sku) : null;
    if (bom) supplyBlocks.push({ sku: it.sku, component: bom.component, shortageSku: bom.shortageSku || bom.component, notes: bom.notes || 'Out of stock', source: 'bom' });
  });
  return { ok: blockedOrders.length === 0 && supplyBlocks.length === 0, blockedOrders: _dedupeByKey(blockedOrders, r => `${r.orderNum}|${r.sku}`), supplyBlocks: _dedupeByKey(supplyBlocks, r => `${r.sku}|${r.component}|${r.shortageSku}`) };
}
function showScheduleSaveBlockers(v) {
  const lines = ['Cannot save this schedule yet. Remove or resolve these blocked items first.'];
  if (v.blockedOrders.length) { lines.push('', 'Blocked order numbers:'); v.blockedOrders.slice(0, 30).forEach(r => lines.push(`- ${r.orderNum} on ${r.sku}${r.qty ? ` (qty ${r.qty})` : ''}`)); if (v.blockedOrders.length > 30) lines.push(`- ...and ${v.blockedOrders.length - 30} more`); }
  if (v.supplyBlocks.length) { lines.push('', 'Out-of-stock material/BOM blocks:'); v.supplyBlocks.slice(0, 30).forEach(r => { if (r.source === 'bom') { const shortage = r.shortageSku && r.shortageSku !== r.component ? `; shortage profile ${r.shortageSku}` : ''; lines.push(`- ${r.sku} uses ${r.component}${shortage}${r.notes ? ` — ${r.notes}` : ''}`); } else lines.push(`- ${r.sku} is listed as out of stock${r.notes ? ` — ${r.notes}` : ''}`); }); if (v.supplyBlocks.length > 30) lines.push(`- ...and ${v.supplyBlocks.length - 30} more`); }
  alert(lines.join('\n')); toast('Schedule has blocked orders or out-of-stock materials', 'err');
}





async function doSave() {
  const validation = await validateScheduleBeforeSave();
  if (!validation.ok) {
    showScheduleSaveBlockers(validation);
    return;
  }

  const btn = document.getElementById('btn-save-confirm'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving…';
  try {
    let schedId = savedScheduleId;
    if (schedId) {
      // Update existing — delete old items and rewrite
      await sb('sts_schedule_items?schedule_id=eq.' + schedId, 'DELETE');
      await sb('sts_schedules?id=eq.' + schedId, 'PATCH', { created_by: currentUser.name, order_done_state: JSON.stringify(orderDoneState) }, { prefer: 'return=minimal' });
    } else {
      const payload = { cell_name: cellName, campus: currentUser.campus, created_by: currentUser.name, created_at: new Date().toISOString(), order_done_state: JSON.stringify(orderDoneState) };
      if (currentUser.id && !currentUser.isTemporaryUser) payload.employee_id = currentUser.id;
      const [row] = await sb('sts_schedules?select=id', 'POST', payload);
      schedId = row.id;
      savedScheduleId = schedId;
    }
    const items = scheduleItems.map((it, idx) => ({
      schedule_id: schedId, sku: it.sku, inventory_id: it.inventoryId || null, line_description: it.description || null,
      quantity: it.qty, takt_minutes: it.taktMins, due_date: it.dueDate, must_ship: it.mustShip,
      order_number: it.orderNums[0] || null, order_type: it.orderType, sort_order: idx,
      boxes_needed: it.boxes, hardware_needed: it.hardware, lumber_needed: it.lumber,
      slings_needed: it.showSlings ? it.slings : null, bent_parts_needed: it.showBentParts ? it.bentParts : null,
    }));
    await sb('sts_schedule_items', 'POST', items);
    const hist = scheduleItems.filter(it => it.orderNums.length).flatMap(it => it.orderNums.map(on => ({
      schedule_id: schedId, order_number: on, sku: it.sku, boxes_needed: it.boxes, hardware_needed: it.hardware, lumber_needed: it.lumber, created_at: new Date().toISOString()
    })));
    if (hist.length) await sb('sts_schedule_history', 'POST', hist).catch(() => {});
    logAction(LOG.SCHEDULE_SAVED, { schedule_id: schedId, quantity: scheduleItems.length, note: cellName });
    closeModal('modal-save'); markSaved(); toast('Schedule saved!', 'ok');
    if (pendingPrintAfterSave) { pendingPrintAfterSave = false; setTimeout(() => window.print(), 300); }
  } catch (e) { toast('Save failed: ' + e.message, 'err'); }
  finally { btn.disabled = false; btn.innerHTML = 'Save &amp; Continue'; }
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
    // Guard: reject schedules that don't belong to the current campus
    if (sched.campus && sched.campus !== currentUser.campus) {
      toast(`That schedule is from campus ${sched.campus}, but you are on ${currentUser.campus}.`, 'err');
      return;
    }
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
    // Restore order-done state from saved JSON (persists across page loads)
    try { orderDoneState = sched.order_done_state ? JSON.parse(sched.order_done_state) : {}; }
    catch { orderDoneState = {}; }
    lastSavedState = scheduleStateStr();
    document.getElementById('paste-panel').style.display   = 'none';
    document.getElementById('saved-panel').style.display   = 'none';
    document.getElementById('meta-saved').textContent      = 'Loaded: ' + sched.created_by;
    document.getElementById('meta-saved').style.display    = 'inline';
    logAction(LOG.SCHEDULE_LOADED, { schedule_id: id, note: cellName });
    await loadMatEvents();
    render(); toast('Loaded ' + cellName, 'ok');
  } catch (e) { toast('Load failed: ' + e.message, 'err'); }
}

async function deleteSchedule(id, btn) {
  if (!confirm('Delete this schedule?')) return; btn.disabled = true;
  try {
    await sb('sts_schedule_items?schedule_id=eq.' + id, 'DELETE');
    await sb('sts_schedules?id=eq.' + id, 'DELETE');
    toast('Deleted', 'info');
    // Refresh the saved panel directly (btn-load-saved no longer exists)
    if (typeof loadMyCellsSavedPanel === 'function') loadMyCellsSavedPanel();
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
      const takt = Number(w.takt_minutes || 0), qty = Number(w.quantity || 1), ref = w.warranty_order || w.id, partNumber = w.inventory_id || w.sku || w.line_description || ref || 'WARRANTY';
      return { sku: partNumber, inventoryId: w.inventory_id || null, description: w.line_description || '', qty, totalQty: qty, taktMins: takt, taktStr: fmtTakt(takt), dueDate: w.due_date || null, mustShip: !!w.must_ship, orderNum: ref, orderNums: [ref].filter(Boolean), orderBreakdown: [{ orderNum: ref, qty, taktMins: takt, dueDate: w.due_date || null }], orderType: w.order_type === 'replacement' ? 'replacement' : 'warranty', sourceCell: w.assigned_cell || targetCellName, sourceSystem: 'warranty', sourceRef: w.id, lockedSource: true, boxes: 'have_all', hardware: 'have_all', lumber: 'have_all', slings: 'have_all', bentParts: 'have_all', showSlings: false, showBentParts: false, merged: false };
    });
  } catch (e) { console.warn('Warranty queue unavailable:', e); toast('Warranty queue unavailable: ' + e.message, 'err'); return []; }
}

function mergeWarrantyItems(existingItems, warrantyItems) {
  if (!warrantyItems.length) return existingItems;
  const existingKeys = new Set(existingItems.flatMap(it => (it.orderNums && it.orderNums.length ? it.orderNums : [it.orderNum]).filter(Boolean).map(o => String(o).toUpperCase())));
  return [...existingItems, ...warrantyItems.filter(w => { const key = String(w.orderNum || '').toUpperCase(); return key && !existingKeys.has(key); })];
}