// ══════════════════════════════════════
// BOM — Bill of Materials lookup
// Supports both BOM CSV schemas:
//   Old: TARGET_Base_Sku, CONSUM_PART
//   New: ParentBOM_ItemCode, ConsumedPartCD
// ══════════════════════════════════════

// component → Set of affected SKU lookup keys
// e.g. { '.75X4.5A': Set{'PRTD1001','PRTD1001BL',...}, ... }
let bomMap = {};
let bomLoaded = false;
let bomRowCount = 0;
let bomFinishedSkuSet = new Set();
// true for the new ParentBOM_ItemCode/ConsumedPartCD export.
// When true, do NOT collapse colors to the base SKU because the new BOM is color-specific.
let bomExactParentKeys = false;
let bomSource = 'none'; // none | local | supabase
let bomStorageMeta = null; // { name, updated_at, created_at, size }
let bomSourceFiles = []; // [{ name, type, rows, exactParentKeys, updated_at, size }]

function _bomEsc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _bomKey(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, '');
}

// Finished-good color → lumber profile suffix.
// Bent parts generally keep the finished-good color code.
const SKU_COLOR_TO_LUMBER_SUFFIX = {
  AR: 'A',
  BL: 'B', CB: 'B',
  GR: 'G', RC: 'G',
  GY: 'GY', SS: 'GY',
  LE: 'LE', LI: 'LI',
  LNV: 'LNV', NV: 'LNV',
  MA: 'M', VL: 'M',
  NDW: 'NDW', NKA: 'NKA', NTL: 'NTL',
  PB: 'PB',
  SA: 'S', SC: 'S',
  SR: 'SR',
  TE: 'T', TH: 'T',
  TA: 'TA',
  VCF: 'VCF', VSH: 'VSH', VWH: 'VWH',
  WH: 'W', CW: 'W',
  CR: 'CR',
};

const SKU_COLOR_SUFFIXES = Object.keys(SKU_COLOR_TO_LUMBER_SUFFIX)
  .sort((a, b) => b.length - a.length);

function _finishedSkuColor(finishedSku) {
  const key = _bomKey(finishedSku);
  for (const color of SKU_COLOR_SUFFIXES) {
    if (key.endsWith(color)) return color;
  }
  return '';
}

function _skuBaseForBOM(finishedSku) {
  const raw = String(finishedSku || '').trim().toUpperCase();
  for (const color of SKU_COLOR_SUFFIXES) {
    const re = new RegExp(`[-_]?${color}$`, 'i');
    if (re.test(raw)) return raw.replace(re, '');
  }
  return raw;
}

function _skuLookupKeys(value) {
  const raw = String(value || '').trim().toUpperCase();
  const keys = new Set();

  if (!raw) return keys;

  // Lookup should be broad, while ingestion decides whether exact parent keys
  // or legacy color-collapsed keys are written to bomMap. This lets a full BOM
  // and a bent-only correlation file coexist without false color matches.
  const base = _skuBaseForBOM(raw);
  [raw, base, _bomKey(raw), _bomKey(base)].forEach(k => { if (k) keys.add(k); });
  return keys;
}

function _componentHasColorSuffix(component) {
  const key = _bomKey(component);
  for (const color of SKU_COLOR_SUFFIXES) {
    if (key.endsWith(color)) return true;
  }
  if (/[A-Z]$/.test(key) && /\d/.test(key)) return true;
  return false;
}

function _componentCandidatesForShortageRow(componentSku, finishedSku, shortageRow) {
  const candidates = new Set();
  const componentRaw = String(componentSku || '').trim().toUpperCase();
  const componentKey = _bomKey(componentRaw);
  const finishedColor = _finishedSkuColor(finishedSku);

  if (!componentKey) return candidates;

  candidates.add(componentKey);
  candidates.add(componentRaw);

  const category = String(shortageRow?.category || '').toLowerCase();
  if (!finishedColor) return candidates;

  if (category.startsWith('lumber')) {
    const lumberSuffix = SKU_COLOR_TO_LUMBER_SUFFIX[finishedColor] || finishedColor;

    // New reliable BOM usually already has lumber suffixes, but this still covers
    // any rows where ConsumedPartCD is colorless.
    if (!_componentHasColorSuffix(componentRaw)) {
      candidates.add(_bomKey(componentRaw + lumberSuffix));
    }

    // Normalize finished-good color suffix to lumber suffix, e.g. 2X2BL → 2X2B.
    for (const [skuColor, lumberColor] of Object.entries(SKU_COLOR_TO_LUMBER_SUFFIX)) {
      const cKey = _bomKey(componentRaw);
      if (cKey.endsWith(skuColor)) {
        const base = cKey.slice(0, -skuColor.length);
        if (base) candidates.add(_bomKey(base + lumberColor));
      }
    }
  } else if (category.startsWith('bent')) {
    if (!_componentHasColorSuffix(componentRaw)) {
      candidates.add(_bomKey(componentRaw + finishedColor));
    }
  }

  return candidates;
}

function _rowMatchesBOMComponent(shortageRow, componentSku, finishedSku) {
  const rowKey = _bomKey(shortageRow?.sku);
  if (!rowKey) return false;
  const candidates = _componentCandidatesForShortageRow(componentSku, finishedSku, shortageRow);
  return candidates.has(rowKey);
}

function loadBOMFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        _parseBOMCSV(e.target.result, { reset: true, type: 'bom', name: file?.name || 'local upload', size: file?.size || null });
        bomSource = 'local';
        bomStorageMeta = {
          name: file?.name || 'local upload',
          updated_at: new Date().toISOString(),
          created_at: null,
          size: file?.size || null,
        };
        resolve(getBOMStats() || { components: 0, finishedSkus: 0, rows: 0 });
      } catch(err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

function loadBentCorrelationFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        _parseBOMCSV(e.target.result, { reset: false, type: 'bent', name: file?.name || 'bent correlation upload', size: file?.size || null });
        bomSource = bomSource === 'supabase' ? 'supabase' : 'local';
        bomStorageMeta = {
          name: 'bom_latest.csv + bent_correlation_latest.csv',
          updated_at: new Date().toISOString(),
          created_at: null,
          size: null,
        };
        resolve(getBOMStats() || { components: 0, finishedSkus: 0, rows: 0 });
      } catch(err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Failed to read bent correlation file'));
    reader.readAsText(file);
  });
}

async function loadBOMFromSupabase() {
  let files = [];

  function _storageMetaFor(name) {
    return Array.isArray(files) ? files.find(f => f.name === name) : null;
  }

  async function _fetchStorageObject(name) {
    // Public bucket URL first.
    let r = await fetch(
      `${SB_URL}/storage/v1/object/public/sts-bom/${name}?apikey=${encodeURIComponent(SB_KEY)}`,
      { headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY } }
    );

    // Private bucket fallback if anon storage policies allow object reads.
    if (!r.ok) {
      console.warn(`${name} public fetch failed:`, await r.text().catch(() => r.statusText));
      r = await fetch(
        `${SB_URL}/storage/v1/object/sts-bom/${name}?apikey=${encodeURIComponent(SB_KEY)}`,
        { headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY } }
      );
    }

    if (!r.ok) {
      console.warn(`${name} authenticated fetch failed:`, await r.text().catch(() => r.statusText));
      return null;
    }

    return await r.text();
  }

  try {
    _resetBOMMaps();

    // Try bucket listing for metadata. If blocked by policy, still try known file paths.
    try {
      const checkRes = await fetch(
        `${SB_URL}/storage/v1/object/list/sts-bom?apikey=${encodeURIComponent(SB_KEY)}`,
        {
          method: 'POST',
          headers: {
            'apikey': SB_KEY,
            'Authorization': 'Bearer ' + SB_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prefix: '', limit: 50 }),
        }
      );

      if (checkRes.ok) files = await checkRes.json();
      else console.warn('BOM bucket list failed:', await checkRes.text().catch(() => checkRes.statusText));
    } catch (e) {
      console.warn('BOM bucket list unavailable:', e.message);
    }

    const coreText = await _fetchStorageObject('bom_latest.csv');
    if (coreText) _parseBOMCSV(coreText, { reset: false, type: 'bom', name: 'bom_latest.csv', meta: _storageMetaFor('bom_latest.csv') });

    const bentText = await _fetchStorageObject('bent_correlation_latest.csv');
    if (bentText) _parseBOMCSV(bentText, { reset: false, type: 'bent', name: 'bent_correlation_latest.csv', meta: _storageMetaFor('bent_correlation_latest.csv') });

    if (!bomLoaded) {
      bomSource = 'none';
      bomStorageMeta = null;
      return false;
    }

    bomSource = 'supabase';
    bomStorageMeta = { name: bomSourceFiles.map(f => f.name).join(' + '), updated_at: null, created_at: null, size: null };
    return true;
  } catch(e) {
    console.warn('BOM storage check failed:', e.message);
    bomSource = bomLoaded ? bomSource : 'none';
    return false;
  }
}

function _resetBOMMaps() {
  bomMap = {};
  bomRowCount = 0;
  bomFinishedSkuSet = new Set();
  bomExactParentKeys = false;
  bomLoaded = false;
  bomSourceFiles = [];
}

function _parseBOMCSV(text, options = {}) {
  const reset = options.reset !== false;
  if (reset) _resetBOMMaps();

  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) throw new Error('Empty CSV');

  const delim = lines[0].includes('	') ? '	' : ',';
  const headers = lines[0].split(delim).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());

  // Old Databricks export
  let targetIdx = headers.findIndex(h => h === 'target_base_sku');
  let consumIdx = headers.findIndex(h => h === 'consum_part');

  // New reliable export / bent correlation export
  const newTargetIdx = headers.findIndex(h => h === 'parentbom_itemcode');
  const newConsumIdx = headers.findIndex(h => h === 'consumedpartcd');
  let sourceExactParentKeys = false;

  if (targetIdx === -1 && newTargetIdx !== -1) {
    targetIdx = newTargetIdx;
    sourceExactParentKeys = true;
  }
  if (consumIdx === -1 && newConsumIdx !== -1) consumIdx = newConsumIdx;

  if (targetIdx === -1 || consumIdx === -1) {
    throw new Error(
      `CSV missing required columns. Found: [${headers.join(', ')}]. ` +
      `Need either TARGET_Base_Sku + CONSUM_PART, or ParentBOM_ItemCode + ConsumedPartCD.`
    );
  }

  let rowsAdded = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = _splitCSVLine(lines[i], delim);
    const target = (cols[targetIdx] || '').trim().toUpperCase();
    const comp = (cols[consumIdx] || '').trim().toUpperCase();

    if (!target || !comp) continue;
    bomFinishedSkuSet.add(target);

    if (!bomMap[comp]) bomMap[comp] = new Set();

    if (sourceExactParentKeys) {
      // New BOM / bent correlation is color-specific. Store exact parent keys only.
      bomMap[comp].add(target);
      bomMap[comp].add(_bomKey(target));
    } else {
      // Legacy BOM is base-SKU-oriented. Keep color-collapsed lookup keys.
      _skuLookupKeys(target).forEach(k => bomMap[comp].add(k));
    }

    bomRowCount++;
    rowsAdded++;
  }

  bomExactParentKeys = bomExactParentKeys || sourceExactParentKeys;
  bomLoaded = Object.keys(bomMap).length > 0;

  if (options.name || options.type) {
    const meta = options.meta || {};
    bomSourceFiles.push({
      name: options.name || meta.name || (options.type === 'bent' ? 'bent correlation upload' : 'bom upload'),
      type: options.type || 'bom',
      rows: rowsAdded,
      exactParentKeys: sourceExactParentKeys,
      updated_at: meta.updated_at || options.updated_at || new Date().toISOString(),
      created_at: meta.created_at || null,
      size: meta.metadata?.size || meta.size || options.size || null,
    });
  }
}

function _splitCSVLine(line, delim) {
  const result = [];
  let cur = '';
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuote = !inQuote;
    else if (ch === delim && !inQuote) { result.push(cur); cur = ''; }
    else cur += ch;
  }

  result.push(cur);
  return result;
}

function getAffectedBaseSkus(componentSku) {
  if (!bomLoaded) return new Set();
  const key = String(componentSku || '').trim().toUpperCase();
  return bomMap[key] || new Set();
}

function getComponentsForBaseSku(baseSku) {
  if (!bomLoaded) return [];
  const keys = _skuLookupKeys(baseSku);
  return Object.entries(bomMap)
    .filter(([comp, skus]) => [...keys].some(k => skus.has(k)))
    .map(([comp]) => comp);
}

function _shortageRowsByStatus(statuses, hardBlock = false, finishedSku = '') {
  const campus = currentUser?.campus || 'SY';
  const allowed = new Set(Array.isArray(statuses) ? statuses : [statuses]);

  return Object.values(shortageCache || {}).flat().filter(r => {
    if (!r) return false;
    if (r.campus !== campus) return false;
    if (!allowed.has(r.status)) return false;

    if (!hardBlock && (approvedOverrides?.[r.sku] || approvedOverrides?.[finishedSku])) return false;
    return true;
  });
}

function _findBOMShortageForFinishedSku(finishedSku, statuses, hardBlock = false) {
  if (!bomLoaded) return null;

  const lookupKeys = _skuLookupKeys(finishedSku);
  const rows = _shortageRowsByStatus(statuses, hardBlock, finishedSku);

  for (const [component, affectedKeys] of Object.entries(bomMap)) {
    if (![...lookupKeys].some(k => affectedKeys.has(k))) continue;

    for (const row of rows) {
      if (_rowMatchesBOMComponent(row, component, finishedSku)) {
        return {
          component,
          shortageSku: row.sku,
          status: row.status,
          notes: row.notes || (row.status === 'out_of_stock' ? 'Out of stock' : 'Low quantity'),
        };
      }
    }
  }

  return null;
}

function getDirectHardShortageReason(sku) {
  const key = _bomKey(sku);
  return _shortageRowsByStatus('out_of_stock', true, sku)
    .find(r => _bomKey(r.sku) === key) || null;
}

function getBOMHardBlockReason(finishedSku) {
  return _findBOMShortageForFinishedSku(finishedSku, 'out_of_stock', true);
}

function getBOMBlockReason(finishedSku) {
  const hardBlock = _findBOMShortageForFinishedSku(finishedSku, 'out_of_stock', false);
  if (hardBlock) return hardBlock;

  const lowQty = _findBOMShortageForFinishedSku(finishedSku, 'low_quantity', false);
  if (lowQty) return lowQty;

  return null;
}

function _getShortageInfo(compUpper) {
  const key = _bomKey(compUpper);
  return Object.values(shortageCache || {}).flat().find(r => _bomKey(r.sku) === key) || null;
}

function getBOMStats() {
  if (!bomLoaded) return null;
  const components = Object.keys(bomMap).length;
  const finishedSkus = bomFinishedSkuSet.size || new Set(Object.values(bomMap).flatMap(s => [...s])).size;
  return { components, finishedSkus, rows: bomRowCount, source: bomSource, storage: bomStorageMeta, exactParentKeys: bomExactParentKeys, files: bomSourceFiles };
}

function runBOMLookup(query) {
  const resultsEl = document.getElementById('bom-lookup-results');
  if (!resultsEl) return;

  const q = (query || '').trim().toUpperCase();
  if (!q) { resultsEl.innerHTML = ''; return; }

  if (!bomLoaded) {
    resultsEl.innerHTML = '<div style="color:var(--text-dim);font-size:13px;">No BOM loaded — upload a CSV first.</div>';
    return;
  }

  let affected = getAffectedBaseSkus(q);

  if (!affected.size) {
    const qKey = _bomKey(q);
    const matched = Object.entries(bomMap).filter(([comp]) => _bomKey(comp) === qKey);
    affected = new Set(matched.flatMap(([, skus]) => [...skus]));
  }

  if (!affected.size) {
    resultsEl.innerHTML = `<div style="color:var(--text-dim);font-size:13px;">No finished SKUs found for <strong>${_bomEsc(q)}</strong>.</div>`;
    return;
  }

  const sorted = [...affected].sort();
  resultsEl.innerHTML = `
    <div style="font-size:13px;color:var(--text-muted);margin-bottom:8px;">
      <strong style="color:var(--text);">${sorted.length}</strong> SKU key${sorted.length !== 1 ? 's' : ''} use
      <strong style="color:var(--accent);">${_bomEsc(q)}</strong>.
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;">
      ${sorted.slice(0, 300).map(s => `<span style="font-family:var(--mono);font-size:12px;background:var(--surface2);border:1px solid var(--border2);padding:3px 9px;border-radius:var(--radius-sm);color:var(--text);">${_bomEsc(s)}</span>`).join('')}
      ${sorted.length > 300 ? `<span style="font-size:12px;color:var(--text-muted);">...and ${sorted.length - 300} more</span>` : ''}
    </div>`;
}

async function uploadBOMToSupabase(file) {
  try {
    const r = await fetch(`${SB_URL}/storage/v1/object/sts-bom/bom_latest.csv?apikey=${encodeURIComponent(SB_KEY)}`, {
      method: 'POST',
      headers: {
        'apikey': SB_KEY,
        'Authorization': 'Bearer ' + SB_KEY,
        'Content-Type': 'text/csv',
        'x-upsert': 'true',
      },
      body: file,
    });

    if (r.ok) {
      bomSource = 'supabase';
      bomStorageMeta = { name: 'bom_latest.csv', updated_at: new Date().toISOString(), created_at: null, size: file?.size || null };
      return true;
    }

    console.warn('BOM upload failed:', await r.text().catch(() => r.statusText));
    bomSource = 'local';
    return false;
  } catch(e) {
    console.warn('BOM upload failed:', e.message);
    bomSource = 'local';
    return false;
  }
}


async function uploadBentCorrelationToSupabase(file) {
  try {
    const r = await fetch(`${SB_URL}/storage/v1/object/sts-bom/bent_correlation_latest.csv?apikey=${encodeURIComponent(SB_KEY)}`, {
      method: 'POST',
      headers: {
        'apikey': SB_KEY,
        'Authorization': 'Bearer ' + SB_KEY,
        'Content-Type': 'text/csv',
        'x-upsert': 'true',
      },
      body: file,
    });

    if (r.ok) {
      bomSource = 'supabase';
      const existing = bomSourceFiles.filter(f => f.name !== 'bent_correlation_latest.csv');
      existing.push({ name: 'bent_correlation_latest.csv', type: 'bent', rows: 0, exactParentKeys: true, updated_at: new Date().toISOString(), size: file?.size || null });
      bomSourceFiles = existing;
      bomStorageMeta = { name: bomSourceFiles.map(f => f.name).join(' + '), updated_at: new Date().toISOString(), created_at: null, size: null };
      return true;
    }

    console.warn('Bent correlation upload failed:', await r.text().catch(() => r.statusText));
    bomSource = bomSource === 'supabase' ? 'supabase' : 'local';
    return false;
  } catch(e) {
    console.warn('Bent correlation upload failed:', e.message);
    bomSource = bomSource === 'supabase' ? 'supabase' : 'local';
    return false;
  }
}
