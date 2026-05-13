// ══════════════════════════════════════
// BOARD — live production board + machine down
// ══════════════════════════════════════

async function loadBoard() {
  document.getElementById('board-grid').innerHTML = '<div style="color:var(--text-dim);padding:40px;text-align:center;">Loading…</div>';
  try {
    const scheds = await sb(`sts_schedules?campus=eq.${currentUser.campus}&order=created_at.desc&select=id,cell_name,created_by,created_at`);
    const latestByCell = {};
    scheds.forEach(s => { if (!latestByCell[s.cell_name]) latestByCell[s.cell_name] = s; });
    const latestIds = Object.values(latestByCell).map(s => s.id);

    let allItems = [];
    if (latestIds.length) {
      for (let b = 0; b < latestIds.length; b += 50) {
        const batch = latestIds.slice(b, b + 50);
        const items = await sb('sts_schedule_items?schedule_id=in.(' + batch.join(',') + ')&select=schedule_id,sku,quantity,takt_minutes,due_date,must_ship,order_type,sort_order,boxes_needed,hardware_needed,lumber_needed');
        allItems = allItems.concat(items || []);
      }
    }

    const itemsBySched = {};
    allItems.forEach(it => { if (!itemsBySched[it.schedule_id]) itemsBySched[it.schedule_id] = []; itemsBySched[it.schedule_id].push(it); });

    // Pre-fill all standard cells so empty ones still show on the board
    boardData = {};
    for (let n = 1; n <= 58; n++) {
      const cn = 'Cell ' + String(n).padStart(2, '0');
      const cns = cn + ' - Secondary';
      const bldg = cellBuilding(n);
      boardData[cn]  = { cell: cn,  mins: 0, submitted: null, by: null, building: bldg, isSecondary: false, items: [] };
      boardData[cns] = { cell: cns, mins: 0, submitted: null, by: null, building: bldg, isSecondary: true,  items: [] };
    }

    Object.values(latestByCell).forEach(s => {
      const items = (itemsBySched[s.id] || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      const mins = items.reduce((sum, it) => sum + parseFloat(it.takt_minutes || 0), 0);
      const isSecondary = /secondary/i.test(s.cell_name);
      const baseNum = cellBaseNum(s.cell_name);
      const bldg = baseNum ? cellBuilding(baseNum) : 'Other';
      if (boardData[s.cell_name]) {
        Object.assign(boardData[s.cell_name], { mins, submitted: s.created_at, by: s.created_by, items });
      } else {
        boardData[s.cell_name] = { cell: s.cell_name, mins, submitted: s.created_at, by: s.created_by, building: bldg, isSecondary, items };
      }
    });

    renderBoard();
  } catch (e) {
    document.getElementById('board-grid').innerHTML = `<div style="color:var(--red);padding:40px;text-align:center;">${e.message}</div>`;
  }
}

function renderBoard() {
  if (!boardData) return;
  const bldgF = document.getElementById('board-bldg').value;
  const secF  = document.getElementById('board-sec').value;
  let cells = Object.values(boardData);
  if (bldgF !== 'all') cells = cells.filter(c => c.building === bldgF);
  if (secF === 'primary')   cells = cells.filter(c => !c.isSecondary);
  if (secF === 'secondary') cells = cells.filter(c =>  c.isSecondary);
  cells.sort((a, b) => a.cell.localeCompare(b.cell));

  const grid = document.getElementById('board-grid');
  if (!cells.length) { grid.innerHTML = '<div style="color:var(--text-dim);padding:40px;text-align:center;">No cells match filter.</div>'; return; }

  grid.innerHTML = cells.map(c => {
    const hrs = (c.mins / 60).toFixed(1);
    const hCls = c.mins === 0 ? 'hours-none' : c.mins / 60 < 4 ? 'hours-green' : c.mins / 60 < 8 ? 'hours-yellow' : 'hours-red';
    const isDown = machineDownCells.has(c.cell);
    const cCls = isDown ? 'bcc-down' : c.mins > 0 ? 'bcc-active' : '';
    const totalUnits = c.items.reduce((s, it) => s + (it.quantity || 0), 0);
    // esc() all DB-derived strings to prevent XSS
    return `<div class="board-cell-card ${cCls}" onclick="openCellDetail('${esc(c.cell)}')">
      ${isDown ? '<div class="bcc-down-badge">MACHINE DOWN</div>' : ''}
      <div class="bcc-name">${esc(c.cell)}${c.isSecondary ? ' <span style="font-size:10px;color:var(--text-dim);">(2°)</span>' : ''}</div>
      <div class="bcc-hours ${hCls}">${c.mins > 0 ? hrs + 'h' : '—'}</div>
      <div class="bcc-sub">${c.items.length} SKU${c.items.length !== 1 ? 's' : ''} · ${totalUnits} units</div>
      <div class="bcc-by">${c.by ? '📋 ' + esc(c.by) : 'No schedule today'}</div>
    </div>`;
  }).join('');
}

function openCellDetail(cn) {
  activeOverlayCell = cn;
  document.getElementById('mdown-cell-label').textContent = cn;
  const c = boardData && boardData[cn];
  document.getElementById('ovl-title').textContent = cn;

  if (!c || !c.items.length) {
    document.getElementById('ovl-meta').textContent = 'No schedule saved for this cell today.';
    document.getElementById('ovl-body').innerHTML = '<div class="ovl-empty">No schedule saved for this cell today.</div>';
  } else {
    const hrs = (c.mins / 60).toFixed(1);
    document.getElementById('ovl-meta').textContent = `${hrs}h · ${c.items.length} SKUs · saved by ${c.by} at ${new Date(c.submitted).toLocaleTimeString()}`;

    let html = '';
    c.items.forEach((it, idx) => {
      const isNewCO = idx > 0 && baseSku(c.items[idx].sku) !== baseSku(c.items[idx - 1].sku);
      if (isNewCO) html += '<div class="ovl-divider"></div>';

      const dueCls = isDueOverdue(it.due_date) ? 'due-pill overdue' : isDueSoon(it.due_date) ? 'due-pill soon' : 'due-pill';
      const badges = [];
      if (it.must_ship) badges.push('<span class="badge b-ship">🚨 Must Ship</span>');
      if (it.order_type === 'warranty')    badges.push('<span class="badge b-warranty">⚙ Warranty</span>');
      if (it.order_type === 'replacement') badges.push('<span class="badge b-replacement">↺ Repl.</span>');

      const matWarn = [];
      if (it.boxes_needed    && it.boxes_needed    !== 'have_all') matWarn.push('Boxes: Need '   + it.boxes_needed.replace('need_', ''));
      if (it.hardware_needed && it.hardware_needed !== 'have_all') matWarn.push('HW: Need '      + it.hardware_needed.replace('need_', ''));
      if (it.lumber_needed   && it.lumber_needed   !== 'have_all') matWarn.push('Lumber: Need '  + it.lumber_needed.replace('need_', ''));

      html += `<div class="ovl-item">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <span class="ovl-sku">${esc(it.sku)}</span>${badges.join('')}
          <span class="qty-pill" style="font-size:11px;">×${esc(it.quantity)}</span>
          <span class="takt-pill" style="font-size:11px;">⏱ ${fmtTakt(it.takt_minutes)}</span>
          <span style="margin-left:auto;">${it.due_date ? `<span class="${dueCls}">📅 ${esc(it.due_date)}</span>` : ''}</span>
        </div>
        ${matWarn.length ? `<div class="ovl-sub">⚠ ${matWarn.map(esc).join(' | ')}</div>` : ''}
      </div>`;
    });
    document.getElementById('ovl-body').innerHTML = html;
  }
  document.getElementById('overlay-cell').classList.add('open');
}

// ── Machine Down ──
function openMachineDown() {
  document.getElementById('mdown-note').value = '';
  document.getElementById('mdown-reporter').value = currentUser.name;
  document.getElementById('modal-mdown').classList.add('open');
}

async function sendMachineDown() {
  const cn   = activeOverlayCell;
  // Sanitise note: strip tags, limit length
  const note = String(document.getElementById('mdown-note').value || '').replace(/[<>]/g, '').trim().slice(0, 500);
  const btn  = document.getElementById('btn-mdown-send');
  btn.disabled = true; btn.textContent = 'Sending…';

  const payload = {
    cell:     cn,
    reporter: currentUser.name,
    campus:   currentUser.campus,
    note:     note,
    time:     new Date().toISOString()
  };

  try {
    // ── Call Supabase Edge Function (webhook secret stays server-side) ──
    const resp = await fetch(MACHINE_DOWN_FN, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + SB_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const msg = await resp.text().catch(() => 'Unknown error');
      throw new Error(msg);
    }

    machineDownCells.add(cn);
    closeModal('modal-mdown');
    document.getElementById('overlay-cell').classList.remove('open');
    renderBoard();
    toast('🔴 Machine down alert sent for ' + cn, 'ok');
  } catch (e) {
    toast('Webhook error: ' + e.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = '🔴 Send Alert';
  }
}