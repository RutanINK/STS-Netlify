// ══════════════════════════════════════
// BOM — Bill of Materials lookup
// Reads the uploaded CSV (Finished Good Component Part*.csv) and builds
// a component → finished base SKU map in memory.
//
// The CSV columns we care about:
//   TARGET_Base_Sku  — finished good base SKU (no color suffix)
//   CONSUM_PART      — component part number (lumber profile, bent part, etc.)
//
// Color suffixes (BL, WH, GY, etc.) are NOT in this file.
// We match on base SKU and treat all color variants as affected.
// ══════════════════════════════════════

// component → Set of affected base SKUs
// e.g. { '.75X4.5A': Set{'PRTD1001','PRTD2001',...}, ... }
let bomMap = {};
let bomLoaded = false;
let bomRowCount = 0;

// ── Load BOM from a user-supplied CSV file (File object) ──
function loadBOMFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        _parseBOMCSV(e.target.result);
        resolve({ components: Object.keys(bomMap).length, rows: bomRowCount });
      } catch(err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// ── Load BOM from Supabase storage (if bucket exists and file was previously uploaded) ──
async function loadBOMFromSupabase() {
  try {
    // First check if the bucket exists by listing objects — avoids a 400 on missing bucket
    const checkRes = await fetch(
      `${SB_URL}/storage/v1/object/list/sts-bom`,
      {
        method: 'POST',
        headers: {
          'apikey': SB_KEY,
          'Authorization': 'Bearer ' + SB_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prefix: '', limit: 1 }),
      }
    );
    if (!checkRes.ok) return false; // bucket doesn't exist yet — skip silently

    const files = await checkRes.json();
    if (!Array.isArray(files) || !files.find(f => f.name === 'bom_latest.csv')) return false;

    // Bucket exists and file is there — fetch it
    const r = await fetch(
      `${SB_URL}/storage/v1/object/public/sts-bom/bom_latest.csv`,
      { headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY } }
    );
    if (!r.ok) return false;
    const text = await r.text();
    _parseBOMCSV(text);
    return true;
  } catch(e) {
    console.warn('BOM storage check failed:', e.message);
    return false;
  }
}

// ── Core CSV parser ──
function _parseBOMCSV(text) {
  bomMap = {};
  bomRowCount = 0;
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) throw new Error('Empty CSV');

  // Detect delimiter
  const delim = lines[0].includes('\t') ? '\t' : ',';

  // Parse header — find column indices
  const headers = lines[0].split(delim).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  const targetIdx = headers.findIndex(h => h === 'target_base_sku');
  const consumIdx = headers.findIndex(h => h === 'consum_part');

  if (targetIdx === -1 || consumIdx === -1) {
    throw new Error(
      `CSV missing required columns. Found: [${headers.join(', ')}]. ` +
      `Need: TARGET_Base_Sku and CONSUM_PART`
    );
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = _splitCSVLine(lines[i], delim);
    const target = (cols[targetIdx] || '').trim().toUpperCase();
    const comp   = (cols[consumIdx] || '').trim().toUpperCase();
    if (!target || !comp) continue;

    if (!bomMap[comp]) bomMap[comp] = new Set();
    bomMap[comp].add(target);
    bomRowCount++;
  }

  bomLoaded = Object.keys(bomMap).length > 0;
}

// Handles quoted CSV fields correctly
function _splitCSVLine(line, delim) {
  const result = [];
  let cur = '', inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuote = !inQuote; }
    else if (ch === delim && !inQuote) { result.push(cur); cur = ''; }
    else cur += ch;
  }
  result.push(cur);
  return result;
}

// ── Query: given a component, return all affected base SKUs ──
function getAffectedBaseSkus(componentSku) {
  if (!bomLoaded) return new Set();
  const key = String(componentSku || '').trim().toUpperCase();
  return bomMap[key] || new Set();
}

// ── Query: given a finished base SKU, return all components it uses ──
function getComponentsForBaseSku(baseSku) {
  if (!bomLoaded) return [];
  const key = String(baseSku || '').trim().toUpperCase();
  return Object.entries(bomMap)
    .filter(([comp, skus]) => skus.has(key))
    .map(([comp]) => comp);
}

// ── Core check: is a finished SKU (with or without color) blocked via BOM? ──
// Returns null if not blocked, or { component, status, notes } if blocked.
function getBOMBlockReason(finishedSku) {
  if (!bomLoaded) return null;

  // Strip color suffix to get base SKU
  // Color suffixes: BL WH GY GR TE MA SA PB SR AR TA LE LI NV VWH VCF VSH CR
  const base = finishedSku.trim().toUpperCase()
    .replace(/[-_]?(VWH|VCF|VSH|BL|WH|GY|GR|TE|MA|SA|PB|SR|AR|TA|LE|LI|NV|CR)$/i, '');

  const campus = currentUser?.campus || 'SY';
  const blocked = getOutOfStockSkus();  // from shortages.js
  const lowQty  = getLowQtySkus();      // from shortages.js

  // Check each shortage component — if this finished SKU's base is in its BOM, it's affected
  for (const [comp, affectedBases] of Object.entries(bomMap)) {
    if (!affectedBases.has(base)) continue;
    const compUpper = comp.toUpperCase();
    if (blocked.has(compUpper)) {
      const info = _getShortageInfo(compUpper);
      return { component: comp, status: 'out_of_stock', notes: info?.notes || 'Out of stock' };
    }
    if (lowQty.has(compUpper)) {
      const info = _getShortageInfo(compUpper);
      return { component: comp, status: 'low_quantity', notes: info?.notes || 'Low quantity' };
    }
  }
  return null;
}

function _getShortageInfo(compUpper) {
  return Object.values(shortageCache).flat().find(r => r.sku.toUpperCase() === compUpper) || null;
}

// ── BOM Stats (for the UI) ──
function getBOMStats() {
  if (!bomLoaded) return null;
  const components   = Object.keys(bomMap).length;
  const finishedSkus = new Set(Object.values(bomMap).flatMap(s => [...s])).size;
  return { components, finishedSkus, rows: bomRowCount };
}

// ── Component lookup (used by BOM page search box) ──
function runBOMLookup(query) {
  const resultsEl = document.getElementById('bom-lookup-results');
  if (!resultsEl) return;
  const q = (query || '').trim().toUpperCase();
  if (!q) { resultsEl.innerHTML = ''; return; }
  if (!bomLoaded) {
    resultsEl.innerHTML = '<div style="color:var(--text-dim);font-size:13px;">No BOM loaded — upload a CSV first.</div>';
    return;
  }
  const affected = getAffectedBaseSkus(q);
  if (!affected.size) {
    resultsEl.innerHTML = `<div style="color:var(--text-dim);font-size:13px;">No finished SKUs found for <strong>${q}</strong>.</div>`;
    return;
  }
  const sorted = [...affected].sort();
  resultsEl.innerHTML = `
    <div style="font-size:13px;color:var(--text-muted);margin-bottom:8px;">
      <strong style="color:var(--text);">${sorted.length}</strong> base SKU${sorted.length !== 1 ? 's' : ''} use <strong style="color:var(--accent);">${q}</strong> — all color variants blocked:
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;">
      ${sorted.map(s => `<span style="font-family:var(--mono);font-size:12px;background:var(--surface2);border:1px solid var(--border2);padding:3px 9px;border-radius:var(--radius-sm);color:var(--text);">${s}</span>`).join('')}
    </div>`;
}

// ── Upload BOM file to Supabase Storage (so all users share it) ──
async function uploadBOMToSupabase(file) {
  try {
    const r = await fetch(`${SB_URL}/storage/v1/object/sts-bom/bom_latest.csv`, {
      method: 'POST',
      headers: {
        'apikey': SB_KEY,
        'Authorization': 'Bearer ' + SB_KEY,
        'Content-Type': 'text/csv',
        'x-upsert': 'true',
      },
      body: file,
    });
    return r.ok;
  } catch(e) {
    console.warn('BOM upload failed:', e.message);
    return false;
  }
}