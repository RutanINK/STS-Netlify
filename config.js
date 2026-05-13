// ══════════════════════════════════════
// CONFIG
// ══════════════════════════════════════

const SB_URL = 'https://shvpwfddsfmrxiywurcm.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNodnB3ZmRkc2ZtcnhpeXd1cmNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDM3MjMsImV4cCI6MjA4ODIxOTcyM30.yZeg5ErBd42iMBchtDrfxE6TsUZRLoqAHpedqLWi06w';

// Google Chat webhook for Machine Down alerts
const MACHINE_DOWN_WEBHOOK = 'https://chat.googleapis.com/v1/spaces/AAQA3xEvkXw/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=E4CkZj1cqxw9qZOgL4CzNekRBq9DYPsjuCYeDjKsbqc';

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

// Buildings — SY campus
const BUILDINGS_SY = {
  'B2-1': { label:'B2-1', cells:range(1,  14) },
  'B2-2': { label:'B2-2', cells:range(15, 28) },
  'B4':   { label:'B4',   cells:range(29, 38) },
  'B1-1': { label:'B1-1', cells:range(39, 48) },
  'B1-2': { label:'B1-2', cells:range(49, 58) },
};

// Buildings — RX campus
const BUILDINGS_RX = {
  'B1-1': { label:'B1-1', cells:range(1,  12) },
  'B1-2': { label:'B1-2', cells:range(13, 22) },
  'B1-3': { label:'B1-3', cells:range(23, 34) },
  'B1-4': { label:'B1-4', cells:range(35, 44) },
};

// Active BUILDINGS — updated at runtime in bootApp() based on campus
let BUILDINGS = BUILDINGS_SY;

function getBuildingsForCampus(campus) {
  return campus === 'RX' ? BUILDINGS_RX : BUILDINGS_SY;
}

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