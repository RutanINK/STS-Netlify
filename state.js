// ══════════════════════════════════════
// STATE — all shared app state lives here
// ══════════════════════════════════════

let currentUser    = null;   // { id, name, role, campus, isTemporaryUser }
let scheduleItems  = [];     // parsed/loaded SKU cards
let cellName       = '';     // current cell being scheduled
let variantSources = [];     // [{cellName, items[]}] before combine
let savedScheduleId    = null;
let lastSavedState     = null;
let dragSrcIndex       = null;
let allEmployees       = [];
let dashData           = null;
let boardData          = null;
let cellChart          = null;
let pendingPrintAfterSave = false;
let activeViewAs       = '';  // admin "view as" override
let handoffItems       = [];
let machineDownCells   = new Set();
let activeOverlayCell  = '';

// Shortage state
let shortageData   = { 'lumber': [], 'lumber-rx': [], 'bent': [] };
let shortageLoaded = { 'lumber': false, 'lumber-rx': false, 'bent': false };
let activeShortageTab       = 'bent';  // matches a key in SHORTAGE_TABS (shortages.js)
let pendingShortageApproval = null;
let approvedOverrides       = {};  // { sku: reason }

// Material handler completion tracking
let mhCheckState = {};  // { idx: { done, comment } }

const MAT_HANDLER_CONFIG = {
  box_handler:      { field: null,        label: 'Box Handler',      col: 'Boxes',      showBoxGroups: true  },
  lumber_handler:   { field: 'lumber',    label: 'Lumber Handler',   col: 'Lumber',     showBoxGroups: false },
  hardware_handler: { field: 'hardware',  label: 'Hardware Handler', col: 'Hardware',   showBoxGroups: false },
  bending_handler:  { field: 'bentParts', label: 'Bending Handler',  col: 'Bent Parts', showBoxGroups: false },
  slings_handler:   { field: 'slings',    label: 'Slings Handler',   col: 'Slings',     showBoxGroups: false },
};