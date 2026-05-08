// ══════════════════════════════════════
// CONFIG
// ══════════════════════════════════════

const SB_URL = 'https://shvpwfddsfmrxiywurcm.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNodnB3ZmRkc2ZtcnhpeXd1cmNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDM3MjMsImV4cCI6MjA4ODIxOTcyM30.yZeg5ErBd42iMBchtDrfxE6TsUZRLoqAHpedqLWi06w';

// Replace with your Teams/Slack webhook URL when ready
const MACHINE_DOWN_WEBHOOK = 'https://YOUR_WEBHOOK_URL_HERE';

// Live board polling interval (ms)
const LIVE_POLL_MS = 30000;

// Buildings
const BUILDINGS = {
  'B2-1': { label:'B2-1', cells:range(1,  14) },
  'B2-2': { label:'B2-2', cells:range(15, 28) },
  'B4':   { label:'B4',   cells:range(29, 38) },
  'B1-1': { label:'B1-1', cells:range(39, 48) },
  'B1-2': { label:'B1-2', cells:range(49, 58) },
};

// Role groups
const DASH_ROLES = ['supervisor','manager','admin'];
const USER_ROLES = ['manager','admin'];
const MAT_ROLES  = ['box_handler','lumber_handler','hardware_handler','bending_handler','slings_handler'];
const SUP_ROLES  = ['supervisor','manager','admin'];

// ── Helpers ──
function range(a, b) {
  const r = [];
  for (let i = a; i <= b; i++) r.push(i);
  return r;
}

function cellBaseNum(s) {
  const m = String(s || '').match(/Cell\s+(\d+)/i);
  return m ? parseInt(m[1]) : null;
}

function cellBuilding(n) {
  for (const [k, v] of Object.entries(BUILDINGS)) {
    if (v.cells.includes(n)) return k;
  }
  return 'Other';
}