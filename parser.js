// ══════════════════════════════════════
// PARSER — Sabertooth raw text → schedule items
// ══════════════════════════════════════

function parseRaw(text) {
  const lines = text.replace(/\u00A0/g, ' ').replace(/[–—]/g, '-').split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  function extractCellName(candidate) {
    const m = String(candidate || '').match(/^(Production|Euro)\s+(\d+[ab]?(?:\s*-\s*(?:Secondary|AD\d+|RST\d+|SBT\/ECT|UNN\w+|UNPL\w+|CKR\w+|R\d+|THM|TO\s+Hold))?)\s*$/i);
    if (!m) return null;
    const type = m[1].toLowerCase(), rest = m[2].trim();
    if (type === 'euro') return 'Euro ' + rest.replace(/\s*-\s*Secondary.*/i, '').trim();
    const isSecondary = /secondary/i.test(rest);
    const base = rest.replace(/\s*-?\s*secondary.*/i, '').trim();
    return 'Cell ' + base + (isSecondary ? ' - Secondary' : '');
  }

  let parsedCellName = 'Unknown Cell';
  for (const line of lines) { const c = extractCellName(line); if (c) { parsedCellName = c; break; } }

  const dueRe     = /^Due:\s*(.+)/i;
  const mustShipRe = /^Must\s+Ship$/i;
  const taktRe    = /^\s*\d+\s*:\s*\d{2}(?::\d{2})?\s*$/;
  const skuLineRe = /^\s*(\d+)\s*(?:x|X|×)\s+([A-Z0-9][A-Z0-9_-]*)\b(.*)$/i;

  function parseOrdersFromLine(line) {
    const orders = [];
    const op = /(?:Inventory\s+)?Order\s*#[:\s]*(?:__)?([A-Z0-9]+)(?:__)?\s*\((\d+)\/(\d+)\)/gi;
    let m;
    while ((m = op.exec(line)) !== null) {
      const r = parseInt(m[3]) - parseInt(m[2]);
      if (r > 0) orders.push({ orderNum: m[1], built: parseInt(m[2]), total: parseInt(m[3]), remaining: r });
    }
    return orders;
  }

  let currentDue = null, currentMustShip = false, pendingTakt = null;
  const items = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dueMatch = line.match(dueRe);
    if (dueMatch) { currentDue = dueMatch[1].trim(); currentMustShip = false; continue; }
    if (mustShipRe.test(line)) { currentMustShip = true; continue; }
    if (taktRe.test(line)) { pendingTakt = parseTakt(line); continue; }

    const sm = line.match(skuLineRe); if (!sm) continue;
    const listedQty = parseInt(sm[1]), sku = sm[2];
    const orders = parseOrdersFromLine(line);

    let qty = listedQty, totalQty = listedQty;
    if (orders.length) { qty = orders.reduce((s, o) => s + o.remaining, 0); totalQty = orders.reduce((s, o) => s + o.total, 0); }
    if (qty <= 0) continue;

    let taktForLine = 0;
    if (pendingTakt !== null) { taktForLine = pendingTakt; pendingTakt = null; }
    else {
      for (let back = i - 1; back >= Math.max(0, i - 6); back--) { if (taktRe.test(lines[back])) { taktForLine = parseTakt(lines[back]); break; } }
      if (!taktForLine) for (let fwd = i + 1; fwd < Math.min(lines.length, i + 6); fwd++) { if (taktRe.test(lines[fwd])) { taktForLine = parseTakt(lines[fwd]); break; } }
    }

    const tpu = qty > 0 ? taktForLine / qty : 0;
    const breakdown = orders.length
      ? orders.map(o => ({ orderNum: o.orderNum, qty: o.remaining, taktMins: Math.round(tpu * o.remaining * 10) / 10, dueDate: currentDue }))
      : [{ orderNum: null, qty, taktMins: taktForLine, dueDate: currentDue }];

    const orderNums = breakdown.map(o => o.orderNum).filter(Boolean);
    items.push({
      sku, qty, totalQty,
      taktMins: Math.round(taktForLine * 10) / 10,
      taktStr: fmtTakt(taktForLine),
      dueDate: currentDue, mustShip: currentMustShip,
      orderNum: orderNums[0] || null,
      orderType: detectType(orderNums[0]),
      orderBreakdown: breakdown, orderNums,
      sourceCell: parsedCellName,
      boxes: 'have_all', hardware: 'have_all', lumber: 'have_all',
      slings: 'have_all', bentParts: 'have_all',
      showSlings: false, showBentParts: false, merged: false
    });
  }

  // Merge duplicate SKU+due+source rows
  const merged = [];
  items.forEach(it => {
    const ex = merged.find(m => m.sku === it.sku && m.dueDate === it.dueDate && m.sourceCell === it.sourceCell);
    if (ex) {
      ex.qty += it.qty; ex.totalQty += it.totalQty; ex.taktMins += it.taktMins; ex.taktStr = fmtTakt(ex.taktMins);
      ex.orderNums = [...new Set([...ex.orderNums, ...it.orderNums])];
      ex.mustShip = ex.mustShip || it.mustShip; ex.merged = true; ex.orderBreakdown.push(...it.orderBreakdown);
    } else {
      merged.push({ ...it, orderNums: [...it.orderNums], orderBreakdown: [...it.orderBreakdown] });
    }
  });

  return { items: merged, cellName: parsedCellName };
}

// ── Helpers ──
function parseTakt(s) { const p = s.split(':'); return parseInt(p[0]) * 60 + parseInt(p[1]); }
function fmtTakt(m)   { const h = Math.floor(m / 60), mm = Math.round(m % 60); return h > 0 ? h + ':' + String(mm).padStart(2, '0') : '0:' + String(mm).padStart(2, '0'); }
function fmtTaktH(m)  { const h = Math.floor(m / 60), mm = Math.round(m % 60); if (h && mm) return h + 'h ' + mm + 'm'; if (h) return h + 'h'; return mm + 'm'; }
function detectType(o) { if (!o) return 'standard'; if (o.startsWith('WR')) return 'warranty'; if (o.startsWith('FR')) return 'replacement'; return 'standard'; }

function baseSku(s) {
  if (!s) return '';
  let t = String(s).toUpperCase().replace(/\u00A0/g, ' ').replace(/–/g, '-').trim();
  if (!t) return '';
  let left = t.split('-')[0];
  if (/\d/.test(left)) { const c = left.replace(/[A-Z]+$/, ''); return c || left; }
  const colorSfx = /(BL|GY|SA|MA|WH|TE|VCF|VSH)$/;
  if (colorSfx.test(left)) { const w = left.replace(colorSfx, ''); return w || left; }
  return left;
}

function cleanDate(s)    { return s.replace(/(\d+)(st|nd|rd|th)/, '$1').replace(/^[A-Za-z]+,\s*/, ''); }
function isDueSoon(s)    { if (!s) return false; try { const d = new Date(cleanDate(s)); return (d - Date.now()) / 86400000 <= 2 && (d - Date.now()) / 86400000 >= 0; } catch { return false; } }
function isDueOverdue(s) { if (!s) return false; try { return new Date(cleanDate(s)) < new Date(); } catch { return false; } }
