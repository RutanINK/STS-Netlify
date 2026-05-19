// ══════════════════════════════════════
// WARRANTY REALTIME  v3
// ══════════════════════════════════════
// Each row in sts_warranty_queue is ONE PART of a warranty order.
// The extension writes one row per part, all sharing the same warranty_order
// but with different inventory_id values.
//
// Dedup key = warranty_order + inventory_id  (NOT just warranty_order).
//
// On INSERT  → add that part as its own schedule card, banner, scroll to top.
// On UPDATE where status = received_in_warranty → remove it.
// On DELETE  → remove it.
//
// startWarrantyRealtime(cellName) is called after every parse/loadSchedule.
// stopWarrantyRealtime()          is called when the schedule is cleared.
// ══════════════════════════════════════

(function () {

  let _ws             = null;
  let _heartbeat      = null;
  let _reconnTimer    = null;
  let _activeCellName = null;
  let _activeCampus   = null;
  let _ref            = 1;
  let _reconnDelay    = 2000;
  const MAX_DELAY     = 30000;

  // Unique key for a warranty row — order + part, so multi-part orders
  // each get their own card.
  function _rowKey(row) {
    const order = String(row.warranty_order || row.id || '').toUpperCase();
    const part  = String(row.inventory_id  || row.sku || '').toUpperCase();
    return order + '|' + part;
  }

  // Same key computed from a scheduleItem that came from the warranty queue.
  function _itemKey(it) {
    const order = String(it.orderNum || '').toUpperCase();
    const part  = String(it.inventoryId || it.sku || '').toUpperCase();
    return order + '|' + part;
  }

  // Convert a sts_warranty_queue row to a scheduleItem.
  // Mirrors loadWarrantyItemsForCell() in schedule.js exactly.
  function _rowToItem(row, cell) {
    const takt = Number(row.takt_minutes || 0);
    const qty  = Number(row.quantity || 1);
    const ref  = row.warranty_order || String(row.id);
    const sku  = row.inventory_id || row.sku || row.line_description || ref || 'WARRANTY';
    return {
      sku,
      inventoryId:    row.inventory_id   || null,
      description:    row.line_description || '',
      qty,            totalQty: qty,
      taktMins:       takt,
      taktStr:        (typeof fmtTakt === 'function') ? fmtTakt(takt) : '—',
      dueDate:        row.due_date       || null,
      mustShip:       !!row.must_ship,
      orderNum:       ref,
      orderNums:      ref ? [ref] : [],
      orderBreakdown: [{ orderNum: ref, qty, taktMins: takt, dueDate: row.due_date || null }],
      orderType:      row.order_type === 'replacement' ? 'replacement' : 'warranty',
      sourceCell:     row.assigned_cell  || cell,
      sourceSystem:   'warranty',
      sourceRef:      row.id,
      lockedSource:   true,
      boxes: 'have_all', hardware: 'have_all', lumber: 'have_all',
      slings: 'have_all', bentParts: 'have_all',
      showSlings: false, showBentParts: false, merged: false,
    };
  }

  // Does this row belong to the cell currently loaded?
  function _rowBelongsToCell(row, cell) {
    if (!cell) return false;
    const n = (typeof cellBaseNum === 'function') ? cellBaseNum(cell) : null;
    const variantMatch = cell.match(/Cell\s+\d+([ab])/i);
    const variant = variantMatch ? variantMatch[1].toLowerCase() : null;

    if (n && Number(row.assigned_cell_num) === n) {
      if (variant) {
        const ac = String(row.assigned_cell || '').toLowerCase();
        const rv = ac.match(/\d+([ab])/);
        if (rv) return rv[1] === variant;
      }
      return true;
    }
    return !!(row.assigned_cell &&
      row.assigned_cell.trim().toLowerCase() === cell.trim().toLowerCase());
  }

  // Scrolling green banner at top of page
  function _showBanner(sku, orderNum, cell) {
    const el = document.getElementById('warranty-import-banner');
    if (!el) return;
    const msg = `📦 WARRANTY IMPORTED — ${sku} · Order: ${orderNum} · Cell: ${cell}`;
    const triple = `${msg} &nbsp;&nbsp;&nbsp; ${msg} &nbsp;&nbsp;&nbsp; ${msg}`;
    el.innerHTML = `<span class="warranty-banner-inner">${triple}</span>`;
    el.style.display = 'flex';
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => { el.style.display = 'none'; }, 20000);
  }

  // Core: handle one postgres_changes event
  function _handle(eventType, row) {
    if (!row || !_activeCellName) return;

    // Ignore other campuses
    if (row.campus && typeof currentUser !== 'undefined' &&
        row.campus !== currentUser.campus) return;

    const rk = _rowKey(row);
    const orderNum = String(row.warranty_order || row.id || '').toUpperCase();
    if (!orderNum) return;

    // ── REMOVE: received or deleted ──────────────────────────────────────
    if (eventType === 'DELETE' ||
        (eventType === 'UPDATE' && row.status === 'received_in_warranty')) {
      const before = scheduleItems.length;
      // Remove the specific part (by composite key), not the whole order
      scheduleItems = scheduleItems.filter(it => _itemKey(it) !== rk);
      if (scheduleItems.length < before) {
        render();
        markUnsaved();
        toast(`Warranty part received — removed from schedule`, 'ok');
      }
      return;
    }

    // ── ADD / UPDATE ──────────────────────────────────────────────────────
    if (eventType !== 'INSERT' && eventType !== 'UPDATE') return;
    if (row.status === 'received_in_warranty' || row.status === 'cancelled') return;
    if (!_rowBelongsToCell(row, _activeCellName)) return;

    const newItem = _rowToItem(row, _activeCellName);

    // Already have this exact part? Refresh it in place.
    const existingIdx = scheduleItems.findIndex(it => _itemKey(it) === rk);
    if (existingIdx !== -1) {
      scheduleItems[existingIdx] = { ...scheduleItems[existingIdx], ...newItem };
      render();
      return;
    }

    // New part — insert after existing warranty cards, before standard items
    const warrantyItems = scheduleItems.filter(
      it => it.sourceSystem === 'warranty' || it.orderType === 'warranty');
    const standardItems = scheduleItems.filter(
      it => it.sourceSystem !== 'warranty' && it.orderType !== 'warranty');
    scheduleItems = [...warrantyItems, newItem, ...standardItems];

    render();
    markUnsaved();
    _showBanner(newItem.sku, orderNum, _activeCellName);
    toast(`📦 Warranty: ${newItem.sku} (${orderNum})`, 'ok');

    requestAnimationFrame(() => {
      const list = document.getElementById('schedule-list');
      if (list) list.scrollTo({ top: 0, behavior: 'smooth' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    if (typeof logAction === 'function' && typeof LOG !== 'undefined') {
      logAction(LOG.WARRANTY_LOADED,
        { order_number: orderNum, sku: newItem.sku, note: 'realtime insert' });
    }
  }

  // ── WebSocket ─────────────────────────────────────────────────────────────
  function _nextRef() { return String(_ref++); }

  function _joinMsg(campus) {
    const r = _nextRef();
    return {
      // Topic must be "realtime:<any-unique-name>" — NOT the table path.
      // The table/filter go in payload.config only.
      topic:    'realtime:warranty-watcher',
      event:    'phx_join',
      payload: {
        config: {
          broadcast:        { self: false },
          presence:         { key: '' },
          postgres_changes: [{
            event:  '*',
            schema: 'public',
            table:  'sts_warranty_queue',
            filter: 'campus=eq.' + campus,
          }],
        },
      },
      ref:      r,
      join_ref: r,   // required by Supabase Realtime v2
    };
  }

  function _send(obj) {
    if (_ws && _ws.readyState === WebSocket.OPEN) _ws.send(JSON.stringify(obj));
  }

  function _stopTimers() {
    if (_heartbeat)   { clearInterval(_heartbeat);  _heartbeat   = null; }
    if (_reconnTimer) { clearTimeout(_reconnTimer);  _reconnTimer = null; }
  }

  function _connect(campus) {
    _stopTimers();
    const url = SB_URL.replace(/^https/, 'wss').replace(/^http/, 'ws')
              + '/realtime/v1/websocket?apikey=' + encodeURIComponent(SB_KEY)
              + '&vsn=1.0.0';
    let ws;
    try { ws = new WebSocket(url); }
    catch (e) {
      console.warn('[WarrantyRT] WebSocket failed:', e.message);
      _scheduleReconnect(campus);
      return;
    }
    _ws = ws;

    ws.onopen = () => {
      console.log('[WarrantyRT] connected — campus=' + campus + ' cell=' + _activeCellName);
      _reconnDelay = 2000;
      _send(_joinMsg(campus));
      _heartbeat = setInterval(() => {
        _send({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: _nextRef() });
      }, 25000);
    };

    ws.onmessage = ({ data }) => {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }

      if (msg.event === 'phx_reply') {
        if (msg.payload?.status === 'error') {
          console.error('[WarrantyRT] channel join failed:', JSON.stringify(msg.payload));
        }
        return;
      }

      if (msg.event === 'postgres_changes') {
        const d = msg.payload?.data;
        if (!d) return;
        // DELETE: changed row is in old_record; INSERT/UPDATE: in record
        const row = (d.type === 'DELETE') ? (d.old_record || {}) : (d.record || {});
        console.log('[WarrantyRT]', d.type, row);
        _handle(d.type, row);
        return;
      }

      // Self-hosted Supabase fallback
      if (msg.event === 'INSERT' || msg.event === 'UPDATE' || msg.event === 'DELETE') {
        const row = msg.payload?.record || msg.payload?.old_record || msg.payload || {};
        _handle(msg.event, row);
      }
    };

    ws.onclose = ({ code }) => {
      _stopTimers();
      if (code !== 1000 && _activeCellName) {
        console.warn('[WarrantyRT] closed, reconnecting in', _reconnDelay, 'ms');
        _scheduleReconnect(campus);
      }
    };

    ws.onerror = (e) => {
      console.warn('[WarrantyRT] error', e.message || e);
      _stopTimers();
    };
  }

  function _scheduleReconnect(campus) {
    _reconnTimer = setTimeout(() => {
      if (_activeCellName) _connect(campus);
    }, _reconnDelay);
    _reconnDelay = Math.min(_reconnDelay * 2, MAX_DELAY);
  }

  function _close() {
    _stopTimers();
    _activeCellName = null;
    _activeCampus   = null;
    if (_ws) { try { _ws.close(1000); } catch (e) {} _ws = null; }
  }

  // ── Public API ────────────────────────────────────────────────────────────
  window.startWarrantyRealtime = function (newCell) {
    if (!newCell) { _close(); return; }
    if (newCell === _activeCellName && _ws && _ws.readyState === WebSocket.OPEN) return;
    _close();
    _activeCellName = newCell;
    _activeCampus   = (typeof currentUser !== 'undefined' && currentUser?.campus) || 'SY';
    _reconnDelay    = 2000;
    _connect(_activeCampus);
  };

  window.stopWarrantyRealtime = function () { _close(); };

})();