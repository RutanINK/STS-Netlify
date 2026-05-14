// ══════════════════════════════════════
// DASHBOARD — charts, building heat map, cell detail table
// ══════════════════════════════════════

async function loadDashboard() {
  try {
    const scheds = await sb(`sts_schedules?campus=eq.${currentUser.campus}&order=created_at.desc&select=id,cell_name,created_by,created_at`);
    const latestByCell = {};
    scheds.forEach(s => { if (!latestByCell[s.cell_name]) latestByCell[s.cell_name] = s; });
    const latestIds = Object.values(latestByCell).map(s => s.id);

    let allItems = [];
    if (latestIds.length) {
      for (let b = 0; b < latestIds.length; b += 50) {
        const batch = latestIds.slice(b, b + 50);
        const items = await sb('sts_schedule_items?schedule_id=in.(' + batch.join(',') + ')&select=schedule_id,takt_minutes');
        allItems = allItems.concat(items || []);
      }
    }

    const taktBySchedule = {};
    allItems.forEach(it => { taktBySchedule[it.schedule_id] = (taktBySchedule[it.schedule_id] || 0) + parseFloat(it.takt_minutes || 0); });

    dashData = {};
    const campusCellNums = (typeof BUILDINGS !== 'undefined' && BUILDINGS)
      ? Object.values(BUILDINGS).flatMap(b => b.cells || [])
      : Array.from({ length: 58 }, (_, i) => i + 1);
    campusCellNums.forEach(n => {
      const cn = 'Cell ' + String(n).padStart(2, '0'), cns = cn + ' - Secondary', bldg = cellBuilding(n);
      dashData[cn]  = { cell: cn,  mins: 0, submitted: null, by: null, building: bldg, isSecondary: false };
      dashData[cns] = { cell: cns, mins: 0, submitted: null, by: null, building: bldg, isSecondary: true  };
    });

    Object.values(latestByCell).forEach(s => {
      const mins = taktBySchedule[s.id] || 0;
      const isSecondary = /secondary/i.test(s.cell_name);
      const baseNum = cellBaseNum(s.cell_name), bldg = baseNum ? cellBuilding(baseNum) : 'Other';
      if (dashData[s.cell_name]) { dashData[s.cell_name].mins = mins; dashData[s.cell_name].submitted = s.created_at; dashData[s.cell_name].by = s.created_by; }
      else dashData[s.cell_name] = { cell: s.cell_name, mins, submitted: s.created_at, by: s.created_by, building: bldg, isSecondary };
    });

    renderDashboard();
  } catch (e) { toast('Dashboard error: ' + e.message, 'err'); }
}

function renderDashboard() {
  if (!dashData) return;
  const bldgFilter = document.getElementById('dash-bldg-filter').value;
  const secFilter  = document.getElementById('dash-sec-filter').value;
  let cells = Object.values(dashData);
  if (bldgFilter !== 'all') cells = cells.filter(c => c.building === bldgFilter);
  if (secFilter === 'primary')   cells = cells.filter(c => !c.isSecondary);
  if (secFilter === 'secondary') cells = cells.filter(c =>  c.isSecondary);

  const totalMins   = cells.reduce((s, c) => s + c.mins, 0);
  const activeCells = cells.filter(c => c.mins > 0).length;
  const maxMins     = Math.max(...cells.map(c => c.mins), 1);
  const avgMins     = activeCells ? totalMins / activeCells : 0;

  document.getElementById('dash-stats').innerHTML = `
    <div class="stat-card"><div class="stat-label">Total Hours Scheduled</div><div class="stat-val stat-accent">${(totalMins/60).toFixed(1)}h</div><div class="stat-sub">${bldgFilter==='all'?'All buildings':bldgFilter}</div></div>
    <div class="stat-card"><div class="stat-label">Active Cells</div><div class="stat-val stat-green">${activeCells}</div><div class="stat-sub">of ${cells.length} total</div></div>
    <div class="stat-card"><div class="stat-label">Avg Hours / Cell</div><div class="stat-val ${avgMins<240?'stat-green':avgMins<480?'stat-yellow':'stat-red'}">${(avgMins/60).toFixed(1)}h</div><div class="stat-sub">active cells only</div></div>
    <div class="stat-card"><div class="stat-label">No Schedule Yet</div><div class="stat-val stat-yellow">${cells.length-activeCells}</div><div class="stat-sub">cells at 0h</div></div>`;

  if (cellChart) cellChart.destroy();
  const ctx    = document.getElementById('chart-cells').getContext('2d');
  const sorted = [...cells].sort((a, b) => {
    const br = (typeof _buildingRank === 'function' ? _buildingRank(a.building) : 999) - (typeof _buildingRank === 'function' ? _buildingRank(b.building) : 999);
    if (br) return br;
    if (typeof _cellSortRank === 'function') return _cellSortRank(a) - _cellSortRank(b);
    return a.cell.localeCompare(b.cell);
  });
  cellChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(c => c.cell.replace(' - Secondary', ' (S)')),
      datasets: [{ label: 'Hours', data: sorted.map(c => +(c.mins/60).toFixed(2)),
        backgroundColor: sorted.map(c => { const h=c.mins/60; return h===0?'rgba(42,50,72,0.6)':h<4?'rgba(34,197,94,0.7)':h<8?'rgba(234,179,8,0.7)':'rgba(239,68,68,0.7)'; }),
        borderColor:     sorted.map(c => { const h=c.mins/60; return h===0?'rgba(42,50,72,1)':h<4?'rgba(34,197,94,1)':h<8?'rgba(234,179,8,1)':'rgba(239,68,68,1)'; }),
        borderWidth: 1, borderRadius: 3 }]
    },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.parsed.y.toFixed(1)}h` } } },
      scales: { x: { ticks: { color: '#6b7599', font: { size: 9 }, maxRotation: 90 }, grid: { color: '#1f2638' } },
                y: { ticks: { color: '#6b7599', font: { size: 10 }, callback: v => v+'h' }, grid: { color: '#1f2638' }, beginAtZero: true } } }
  });

  // Building heat map
  const bldgTotals = {};
  Object.entries(BUILDINGS).forEach(([k, v]) => {
    const bCells = cells.filter(c => c.building === k);
    bldgTotals[k] = { mins: bCells.reduce((s, c) => s + c.mins, 0), active: bCells.filter(c => c.mins > 0).length, total: bCells.length || v.cells.length };
  });
  const maxBldg = Math.max(...Object.values(bldgTotals).map(b => b.mins), 1);
  document.getElementById('bldg-heat').innerHTML = Object.entries(bldgTotals).map(([k, v]) => {
    const hrs = (v.mins/60).toFixed(1), pct = Math.round(v.mins/maxBldg*100);
    const hCls = v.mins===0?'cell-none':v.mins/60<4*v.total?'hours-green':v.mins/60<8*v.total?'hours-yellow':'hours-red';
    const bCls = v.mins===0?'bar-none':v.mins/60<4*v.total?'bar-green':v.mins/60<8*v.total?'bar-yellow':'bar-red';
    return `<div class="bldg-card"><div class="bldg-name">${k}</div><div class="bldg-hours ${hCls}">${hrs}h</div><div class="bldg-cells">${v.active}/${v.total} active</div><div class="bldg-bar"><div class="bldg-bar-fill ${bCls}" style="width:${pct}%"></div></div></div>`;
  }).join('');

  // Cell detail table
  document.getElementById('cell-tbody').innerHTML = sorted.map(c => {
    const hrs = (c.mins/60).toFixed(1), pct = Math.round(c.mins/maxMins*100);
    const hCls = c.mins===0?'cell-none':c.mins/60<4?'hours-green':c.mins/60<8?'hours-yellow':'hours-red';
    const bCls = c.mins===0?'bar-none':c.mins/60<4?'bar-green':c.mins/60<8?'bar-yellow':'bar-red';
    return `<tr>
      <td class="cell-name">${c.cell}${c.isSecondary ? '<span style="font-size:9px;color:var(--text-dim);margin-left:5px;">secondary</span>' : ''}</td>
      <td class="cell-submitted" style="color:var(--text-muted)">${c.building}</td>
      <td class="cell-hours ${hCls}">${c.mins > 0 ? hrs+'h' : '—'}</td>
      <td><div class="cell-bar"><div class="cell-bar-fill ${bCls}" style="width:${pct}%"></div></div></td>
      <td class="cell-submitted">${c.submitted ? new Date(c.submitted).toLocaleString() : '—'}</td>
      <td class="cell-submitted">${c.by || '—'}</td>
    </tr>`;
  }).join('');
}
