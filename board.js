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

    // Pre-fill all standard cells for the current campus
    boardData = {};
    const bldgs = getBuildingsForCampus(currentUser.campus);
    const allCellNums = Object.values(bldgs).flatMap(b => b.cells);
    allCellNums.forEach(n => {
      const cn  = 'Cell ' + String(n).padStart(2, '0');
      const cns = cn + ' - Secondary';
      const bldg = cellBuilding(n);
      boardData[cn]  = { cell: cn,  mins: 0, submitted: null, by: null, building: bldg, isSecondary: false, items: [] };
      boardData[cns] = { cell: cns, mins: 0, submitted: null, by: null, building: bldg, isSecondary: true,  items: [] };
    });

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

// Rebuild the building filter dropdown for the current campus
function _updateBoardBuildingFilter() {
  const sel = document.getElementById('board-bldg');
  if (!sel) return;
  const campusKey = 'campus-' + currentUser.campus;
  if (sel.dataset.builtFor === campusKey) return;
  sel.dataset.builtFor = campusKey;
  const bldgs = getBuildingsForCampus(currentUser.campus);
  sel.innerHTML = '<option value="all">All Buildings</option>';
  Object.entries(bldgs).forEach(([key, cfg]) => {
    const lo = cfg.cells[0], hi = cfg.cells[cfg.cells.length - 1];
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = `${key} (Cells ${lo}\u2013${hi})`;
    sel.appendChild(opt);
  });
}

function renderBoard() {
  if (!boardData) return;
  _updateBoardBuildingFilter();

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
    const downInfo = isDown && window._machineDownReasons?.[c.cell];
    const cCls = isDown ? 'bcc-down' : c.mins > 0 ? 'bcc-active' : '';
    const totalUnits = c.items.reduce((s, it) => s + (it.quantity || 0), 0);
    return `<div class="board-cell-card ${cCls}" onclick="openCellDetail('${esc(c.cell)}')">
      ${isDown ? `<div class="bcc-down-badge">🔴 MACHINE DOWN${downInfo ? '<br><span style="font-size:9px;font-weight:400;opacity:.85;">' + esc(downInfo.reason.split(':')[0]) + '</span>' : ''}</div>` : ''}
      <div class="bcc-name">${esc(c.cell)}${c.isSecondary ? ' <span style="font-size:10px;color:var(--text-dim);">(2\xb0)</span>' : ''}</div>
      <div class="bcc-hours ${hCls}">${c.mins > 0 ? hrs + 'h' : '\u2014'}</div>
      <div class="bcc-sub">${c.items.length} SKU${c.items.length !== 1 ? 's' : ''} \xb7 ${totalUnits} units</div>
      <div class="bcc-by">${c.by ? '\uD83D\uDCCB ' + esc(c.by) : 'No schedule today'}</div>
    </div>`;
  }).join('');
}

function openCellDetail(cn) {
  activeOverlayCell = cn;
  const c = boardData && boardData[cn];
  document.getElementById('ovl-title').textContent = cn;
  document.getElementById('mdown-cell-label').textContent = cn;

  // Swap Machine Down / Clear Machine Down button based on state
  const isDown = machineDownCells.has(cn);
  const ovlActions = document.querySelector('#overlay-cell .ovl-actions');
  if (ovlActions) {
    let toggleBtn = ovlActions.querySelector('.btn-down-toggle');
    if (!toggleBtn) {
      toggleBtn = ovlActions.querySelector('.btn-down');
      if (toggleBtn) toggleBtn.classList.add('btn-down-toggle');
    }
    if (toggleBtn) {
      toggleBtn.className = isDown
        ? 'btn btn-success btn-sm btn-down-toggle'
        : 'btn btn-down btn-sm btn-down-toggle';
      toggleBtn.textContent = isDown ? '\u2705 Clear Machine Down' : '\uD83D\uDD34 Machine Down!';
      toggleBtn.onclick = isDown ? openClearMachineDownOverlay : openMachineDown;
    }
  }

  if (!c || !c.items.length) {
    document.getElementById('ovl-meta').textContent = 'No schedule saved for this cell today.';
    document.getElementById('ovl-body').innerHTML = '<div class="ovl-empty">No schedule saved for this cell today.</div>';
  } else {
    const hrs = (c.mins / 60).toFixed(1);
    const timeEST = new Date(c.submitted).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true });
    document.getElementById('ovl-meta').textContent = `${hrs}h \xb7 ${c.items.length} SKUs \xb7 saved by ${c.by} at ${timeEST} EST`;

    let html = '';
    c.items.forEach((it, idx) => {
      const isNewCO = idx > 0 && baseSku(c.items[idx].sku) !== baseSku(c.items[idx - 1].sku);
      if (isNewCO) html += '<div class="ovl-divider"></div>';
      const dueCls = isDueOverdue(it.due_date) ? 'due-pill overdue' : isDueSoon(it.due_date) ? 'due-pill soon' : 'due-pill';
      const badges = [];
      if (it.must_ship) badges.push('<span class="badge b-ship">\uD83D\uDEA8 Must Ship</span>');
      if (it.order_type === 'warranty')    badges.push('<span class="badge b-warranty">\u2699 Warranty</span>');
      if (it.order_type === 'replacement') badges.push('<span class="badge b-replacement">\u21BA Repl.</span>');
      const matWarn = [];
      if (it.boxes_needed    && it.boxes_needed    !== 'have_all') matWarn.push('Boxes: Need '  + it.boxes_needed.replace('need_', ''));
      if (it.hardware_needed && it.hardware_needed !== 'have_all') matWarn.push('HW: Need '     + it.hardware_needed.replace('need_', ''));
      if (it.lumber_needed   && it.lumber_needed   !== 'have_all') matWarn.push('Lumber: Need ' + it.lumber_needed.replace('need_', ''));
      html += `<div class="ovl-item">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <span class="ovl-sku">${esc(it.sku)}</span>${badges.join('')}
          <span class="qty-pill" style="font-size:11px;">\xd7${esc(it.quantity)}</span>
          <span class="takt-pill" style="font-size:11px;">\u23f1 ${fmtTakt(it.takt_minutes)}</span>
          <span style="margin-left:auto;">${it.due_date ? `<span class="${dueCls}">\uD83D\uDCC5 ${esc(it.due_date)}</span>` : ''}</span>
        </div>
        ${matWarn.length ? `<div class="ovl-sub">\u26a0 ${matWarn.map(esc).join(' | ')}</div>` : ''}
      </div>`;
    });
    document.getElementById('ovl-body').innerHTML = html;
  }
  document.getElementById('overlay-cell').classList.add('open');
}

// ── Machine Down ──

function _getMachineDownWebhook() {
  try {
    if (typeof MACHINE_DOWN_WEBHOOK === 'undefined') return null;
    if (String(MACHINE_DOWN_WEBHOOK).includes('YOUR_WEBHOOK_URL_HERE')) return null;
    return MACHINE_DOWN_WEBHOOK;
  } catch { return null; }
}

function openMachineDown() {
  const reasonSel = document.getElementById('mdown-reason');
  if (reasonSel) reasonSel.value = '';
  const noteEl = document.getElementById('mdown-note');
  if (noteEl) noteEl.value = '';
  const noteGroup = document.getElementById('mdown-note-group');
  if (noteGroup) noteGroup.style.display = 'none';
  const sendBtn = document.getElementById('btn-mdown-send');
  if (sendBtn) sendBtn.disabled = true;
  document.getElementById('mdown-reporter').value = currentUser.name;
  document.getElementById('mdown-cell-label').textContent = activeOverlayCell;
  document.getElementById('modal-mdown').classList.add('open');
}

function onMdownReasonChange(val) {
  const noteGroup = document.getElementById('mdown-note-group');
  const sendBtn   = document.getElementById('btn-mdown-send');
  if (noteGroup) noteGroup.style.display = val === 'Other' ? '' : 'none';
  if (sendBtn)   sendBtn.disabled = !val;
}

async function sendMachineDown() {
  const cn     = activeOverlayCell;
  const reason = document.getElementById('mdown-reason')?.value || '';
  const note   = document.getElementById('mdown-note')?.value.trim() || '';
  const btn    = document.getElementById('btn-mdown-send');
  if (!reason) { toast('Choose a reason first', 'err'); return; }

  btn.disabled = true; btn.textContent = 'Sending\u2026';

  const nowEST    = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  const issueText = reason + (note ? ': ' + note : '');
  const payload   = { text: `\uD83D\uDD34 MACHINE DOWN \u2014 ${cn} | Campus: ${currentUser.campus} | Reported by: ${currentUser.name} | Time (EST): ${nowEST} | Issue: ${issueText}` };

  const _afterSuccess = () => {
    if (!window._machineDownReasons) window._machineDownReasons = {};
    window._machineDownReasons[cn] = { reason: issueText, time: nowEST, by: currentUser.name };
    machineDownCells.add(cn);
    closeModal('modal-mdown');
    document.getElementById('overlay-cell').classList.remove('open');
    renderBoard();
    if (typeof renderMyCellsCards === 'function') renderMyCellsCards();
    const clearBtn = document.getElementById('btn-mycell-cleardown');
    if (clearBtn && window._activeMyCellName === cn) clearBtn.style.display = '';
  };

  const webhookUrl = _getMachineDownWebhook();
  try {
    if (!webhookUrl) {
      console.log('Machine Down payload (no webhook configured):', payload);
      _afterSuccess();
      toast('\u26a0 Alert logged for ' + cn + ' \u2014 add webhook in config.js to send to Google Chat', 'info');
    } else {
      await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      _afterSuccess();
      toast('\uD83D\uDD34 Machine down alert sent \u2014 ' + cn + ': ' + reason, 'ok');
    }
  } catch (e) {
    toast('Webhook error: ' + e.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = '\uD83D\uDD34 Send Alert';
  }
}

function openClearMachineDownOverlay() {
  document.getElementById('mdown-clear-cell-label').textContent = activeOverlayCell;
  document.getElementById('mdown-clear-reporter').value = currentUser.name;
  document.getElementById('mdown-clear-reason').value  = '';
  document.getElementById('btn-mdown-clear-send').disabled = true;
  document.getElementById('modal-mdown-clear').classList.add('open');
}

async function clearMachineDown() {
  const cn         = activeOverlayCell;
  const resolution = document.getElementById('mdown-clear-reason')?.value || '';
  const btn        = document.getElementById('btn-mdown-clear-send');
  if (!resolution) { toast('Choose a resolution first', 'err'); return; }

  btn.disabled = true; btn.textContent = 'Clearing\u2026';
  const nowEST = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  const payload = { text: `\u2705 MACHINE DOWN CLEARED \u2014 ${cn} | Campus: ${currentUser.campus} | Cleared by: ${currentUser.name} | Time (EST): ${nowEST} | Resolution: ${resolution}` };

  const _afterClear = () => {
    machineDownCells.delete(cn);
    if (window._machineDownReasons) delete window._machineDownReasons[cn];
    closeModal('modal-mdown-clear');
    document.getElementById('overlay-cell').classList.remove('open');
    renderBoard();
    if (typeof renderMyCellsCards === 'function') renderMyCellsCards();
    const clearBtn = document.getElementById('btn-mycell-cleardown');
    if (clearBtn && window._activeMyCellName === cn) clearBtn.style.display = 'none';
  };

  const webhookUrl = _getMachineDownWebhook();
  try {
    if (!webhookUrl) {
      console.log('Machine Down CLEAR payload:', payload);
      _afterClear();
      toast('\u2705 Machine down cleared for ' + cn, 'ok');
    } else {
      await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      _afterClear();
      toast('\u2705 Machine down cleared for ' + cn, 'ok');
    }
  } catch(e) {
    toast('Webhook error: ' + e.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = '\u2705 Clear Machine Down';
  }
}