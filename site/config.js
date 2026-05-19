// ══════════════════════════════════════
// CONFIG
// ══════════════════════════════════════

const SB_URL = 'https://shvpwfddsfmrxiywurcm.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNodnB3ZmRkc2ZtcnhpeXd1cmNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDM3MjMsImV4cCI6MjA4ODIxOTcyM30.yZeg5ErBd42iMBchtDrfxE6TsUZRLoqAHpedqLWi06w';

// Google Chat webhook for Machine Down alerts
const MACHINE_DOWN_WEBHOOK = 'YOUR_WEBHOOK_URL_HERE';
const CHAT_ALERT_ENDPOINT = '/.netlify/functions/chat-alert';



function canSendChatAlert() {
  return Boolean(CHAT_ALERT_ENDPOINT) || !MACHINE_DOWN_WEBHOOK.includes('YOUR_WEBHOOK_URL_HERE');
}

async function sendChatAlert(payload) {
  const safePayload = { text: String(payload?.text || '').slice(0, 4000) };
  if (!safePayload.text.trim()) throw new Error('Alert payload is empty');

  if (CHAT_ALERT_ENDPOINT) {
    const res = await fetch(CHAT_ALERT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(safePayload),
    });
    if (!res.ok) throw new Error(`Alert endpoint failed (${res.status})`);
    return true;
  }

  if (!MACHINE_DOWN_WEBHOOK.includes('YOUR_WEBHOOK_URL_HERE')) {
    const res = await fetch(MACHINE_DOWN_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      body: JSON.stringify(safePayload),
    });
    if (!res.ok) throw new Error(`Webhook failed (${res.status})`);
    return true;
  }

  console.log('Alert payload (no endpoint configured):', safePayload);
  return false;
}

// Live board polling interval (ms)
const LIVE_POLL_MS = 30000;

// ── Campus pin ──
// Set window.CAMPUS_OVERRIDE before this file loads (in index-sy.html / index-rx.html)
// to lock the app to a specific campus regardless of the logged-in user's campus field.
// Falls back to sessionStorage for redirect-based campus selection.
// Leave undefined/null to use the user's campus from the database (default).
const CAMPUS_OVERRIDE = (typeof window !== 'undefined' && window.CAMPUS_OVERRIDE)
  || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('sts_campus_override'))
  || null;

// ── Helpers (defined before BUILDINGS so they can be used below) ──
function range(a, b) {
  const r = [];
  for (let i = a; i <= b; i++) r.push(i);
  return r;
}

// Expands a building cell spec into a flat list of canonical cell name strings.
// Each entry is either a plain number (→ "Cell 01"), "Na"/"Nb" (→ "Cell Na"),
// or a number with variants (→ "Cell 41", "Cell 41 - AD400", etc.)
function _expandCells(specs) {
  const names = [];
  specs.forEach(spec => {
    if (typeof spec === 'number') {
      names.push('Cell ' + String(spec).padStart(2, '0'));
    } else if (typeof spec === 'string') {
      // e.g. "39a", "39b" → "Cell 39a"
      names.push('Cell ' + spec);
    } else if (spec && typeof spec === 'object') {
      // { n: 41, variants: ['AD400','AD410',...] }
      const base = 'Cell ' + String(spec.n).padStart(2, '0');
      names.push(base);
      if (spec.variants) spec.variants.forEach(v => names.push(base + ' - ' + v));
    }
  });
  return names;
}

// SY cell specs — plain numbers are standard cells,
// objects carry named variants (from the Sabertooth list), strings are a/b cells.
const CELLS_SY = {
  'B2-1': range(1, 14),
  'B2-2': range(15, 28),
  'B4':   range(29, 38),
  'B1-1': [
    '39a','39b',
    '40a','40b',
    41,  // Cell 41 — variants defined below via VARIANTS_SY
    42,
    43,
    44,
    { n: 45, variants: ['CKR155','R100','R140','R199'] },
    '46a','46b',
    47,
    '48a','48b',
  ],
  'B1-2': [
    49, 50,
    { n: 51, variants: ['UNPL81T1 / T2','UNPL84T1','UNPL84T2','scheduled table warranties'] },
    { n: 52, variants: ['UNF37 / 3772','UNN3772','UNPL83T1 / T2','UNPL85T1 / T2'] },
    53,
    54, 55, 56, 57, 58,
  ],
};

// Variant suffixes for cells 41 and 42 (from the screenshots)
const VARIANTS_41 = ['AD400','AD410','AD420','AD440','TO Hold'];
const VARIANTS_42 = ['AD600','AD610','AD620','AD630','TO Hold'];

// Build final SY building map
const BUILDINGS_SY = (() => {
  const result = {};
  for (const [bldg, specs] of Object.entries(CELLS_SY)) {
    // Expand plain numbers and strings first
    const expanded = [];
    specs.forEach(spec => {
      if (typeof spec === 'number') {
        expanded.push('Cell ' + String(spec).padStart(2, '0'));
        // Special variant cells
        if (spec === 41) VARIANTS_41.forEach(v => expanded.push('Cell 41 - ' + v));
        if (spec === 42) VARIANTS_42.forEach(v => expanded.push('Cell 42 - ' + v));
      } else if (typeof spec === 'string') {
        expanded.push('Cell ' + spec);
      } else if (spec && typeof spec === 'object') {
        expanded.push('Cell ' + String(spec.n).padStart(2, '0'));
        if (spec.variants) spec.variants.forEach(v => expanded.push('Cell ' + String(spec.n).padStart(2, '0') + ' - ' + v));
      }
    });
    // For each base cell, also add " - Secondary" variant
    const withSecondary = [];
    expanded.forEach(cn => {
      withSecondary.push(cn);
      withSecondary.push(cn + ' - Secondary');
    });
    result[bldg] = { label: bldg, cellNames: withSecondary };
  }
  // Euro cells belong to SY only
  result['Euro'] = { label: 'Euro', cellNames: ['Euro 01','Euro 01 - Secondary','Euro 02','Euro 02 - Secondary','Euro 03','Euro 03 - Secondary'] };
  return result;
})();

// RX cells — 35–40 have a/b variants, rest are standard
const CELLS_RX = {
  'B1-1': range(1, 12),
  'B1-2': range(13, 22),
  'B1-3': range(23, 34),
  'B1-4': [
    '35a','35b',
    '36a','36b',
    '37a','37b',
    '38a','38b',
    '39a','39b',
    '40a','40b',
    41, 42, 43, 44,
  ],
};

const BUILDINGS_RX = (() => {
  const result = {};
  for (const [bldg, specs] of Object.entries(CELLS_RX)) {
    const expanded = [];
    specs.forEach(spec => {
      if (typeof spec === 'number') expanded.push('Cell ' + String(spec).padStart(2, '0'));
      else if (typeof spec === 'string') expanded.push('Cell ' + spec);
    });
    const withSecondary = [];
    expanded.forEach(cn => { withSecondary.push(cn); withSecondary.push(cn + ' - Secondary'); });
    result[bldg] = { label: bldg, cellNames: withSecondary };
  }
  return result;
})();

// Active BUILDINGS — updated at runtime in bootApp() based on campus
let BUILDINGS = BUILDINGS_SY;

function getBuildingsForCampus(campus) {
  return campus === 'RX' ? BUILDINGS_RX : BUILDINGS_SY;
}

// Role groups
const DASH_ROLES = ['supervisor','manager','admin'];
const USER_ROLES = ['manager','admin'];
const MAT_ROLES  = ['box_handler','lumber_handler','hardware_handler','bending_handler','slings_handler','material_handling_lead'];
const SUP_ROLES  = ['supervisor','manager','admin'];
const AREA_VIEW_ROLES = ['area_view'];

// Returns the building key for a given cell name string
function cellBuilding(cellNameStr) {
  const s = String(cellNameStr || '');
  for (const [k, v] of Object.entries(BUILDINGS)) {
    if ((v.cellNames || []).some(cn => s === cn || s.startsWith(cn))) return k;
  }
  return 'Other';
}

// Legacy numeric helper — still used in a few places
function cellBaseNum(s) {
  const m = String(s || '').match(/Cell\s+(\d+)/i);
  return m ? parseInt(m[1]) : null;
}