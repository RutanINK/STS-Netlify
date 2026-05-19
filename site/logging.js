// ══════════════════════════════════════
// LOGGING — universal action log
// Every meaningful user action writes a row to sts_action_log.
// Fire-and-forget: never blocks the UI, never throws.
// ══════════════════════════════════════

// Action type constants — use these everywhere for consistency
const LOG = {
  // Schedule lifecycle
  SCHEDULE_PARSED:    'schedule_parsed',
  SCHEDULE_SAVED:     'schedule_saved',
  SCHEDULE_LOADED:    'schedule_loaded',
  SCHEDULE_DELETED:   'schedule_deleted',
  SCHEDULE_CLEARED:   'schedule_cleared',
  ITEM_ADDED:         'item_added',
  ITEM_REMOVED:       'item_removed',
  ORDER_REMOVED:      'order_removed',
  MUST_SHIP_CHANGED:  'must_ship_changed',
  ITEM_REORDERED:     'item_reordered',
  WARRANTY_LOADED:    'warranty_loaded',

  // Order completion
  ORDER_DONE:         'order_done',
  ORDER_UNDONE:       'order_undone',
  INSPECT_REQUESTED:  'inspect_requested',
  INSPECT_CLEARED:    'inspect_cleared',

  // Material workflow
  MAT_PULLED:         'material_pulled',
  MAT_PREPPED:        'material_prepped',
  MAT_DELIVERED:      'material_delivered',
  MAT_STATUS_CHANGED: 'material_status_changed',
  MAT_NEED_CHANGED:   'mat_need_changed',

  // Shortages
  SHORTAGE_ADDED:     'shortage_added',
  SHORTAGE_EDITED:    'shortage_edited',
  SHORTAGE_RESTOCKED: 'shortage_restocked',
  SHORTAGE_DELETED:   'shortage_deleted',
  SHORTAGE_APPROVED:  'shortage_approved',
  COMPONENT_STATUS:   'component_status_changed',

  // System
  MACHINE_DOWN:       'machine_down',
  ORDER_BLACKLISTED:  'order_blacklisted',
  ORDER_UNBLACKLISTED:'order_unblacklisted',
};

/**
 * logAction(action, details)
 * action  — one of the LOG.* constants
 * details — plain object with any relevant context fields
 *
 * Standard fields auto-added: actor, campus, cell, timestamp
 * Optional fields you can pass in details:
 *   sku, order_number, cell_name, quantity, note, old_value, new_value, schedule_id
 */
function logAction(action, details = {}) {
  if (!currentUser) return;
  const row = {
    action,
    actor:       currentUser.name,
    role:        currentUser.role,
    campus:      currentUser.campus,
    cell_name:   details.cell_name   || cellName || null,
    sku:         details.sku         || null,
    order_number:details.order_number|| null,
    quantity:    details.quantity    || null,
    schedule_id: details.schedule_id || savedScheduleId || null,
    note:        details.note        || null,
    old_value:   details.old_value   || null,
    new_value:   details.new_value   || null,
    extra:       Object.keys(details).length ? JSON.stringify(details) : null,
    created_at:  new Date().toISOString(),
  };
  // Fire and forget — never await, never throw
  sb('sts_action_log', 'POST', [row]).catch(() => {});
}
