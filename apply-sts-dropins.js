// ══════════════════════════════════════
// USERS — employee management
// ══════════════════════════════════════

// ── XSS-safe helper: escapes text for use inside HTML ──
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = '<tr><td colspan="6" style="color:var(--text-muted);text-align:center;padding:20px;">Loading…</td></tr>';
  try {
    const users = await sb('sts_employees?order=name.asc&select=id,name,role,campus,pin_hash,active,created_at');
    allEmployees = users;

    // Build rows with safe DOM methods — no user data goes into innerHTML
    const frag = document.createDocumentFragment();
    users.forEach(u => {
      const tr = document.createElement('tr');

      // Name
      const tdName = document.createElement('td');
      tdName.className = 'u-name';
      tdName.textContent = u.name;

      // Role
      const tdRole = document.createElement('td');
      const roleSpan = document.createElement('span');
      // role values come from a fixed enum in DB — safe to use as class, but sanitise anyway
      roleSpan.className = 'u-role role-' + esc(u.role);
      roleSpan.textContent = u.role.replace(/_/g, ' ');
      tdRole.appendChild(roleSpan);

      // Campus
      const tdCampus = document.createElement('td');
      tdCampus.style.cssText = 'font-size:11px;color:var(--text-muted);';
      tdCampus.textContent = u.campus;

      // PIN status
      const tdPin = document.createElement('td');
      const pinSpan = document.createElement('span');
      pinSpan.style.cssText = 'font-size:11px;color:' + (u.pin_hash ? 'var(--green)' : 'var(--yellow)') + ';';
      pinSpan.textContent = u.pin_hash ? '✓ Set' : 'Not set';
      tdPin.appendChild(pinSpan);

      // Active status
      const tdActive = document.createElement('td');
      tdActive.style.cssText = 'font-size:11px;color:' + (u.active ? 'var(--green)' : 'var(--text-dim)') + ';';
      tdActive.textContent = u.active ? 'Active' : 'Inactive';

      // Actions — bind data via closure, never inline onclick with user data
      const tdAct = document.createElement('td');
      tdAct.className = 'u-actions';

      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-ghost btn-xs';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => openEditUser(u.id));
      tdAct.appendChild(editBtn);

      if (u.pin_hash) {
        const resetBtn = document.createElement('button');
        resetBtn.className = 'btn btn-ghost btn-xs';
        resetBtn.textContent = 'Reset PIN';
        resetBtn.addEventListener('click', () => resetPin(u.id, u.name));
        tdAct.appendChild(resetBtn);
      }

      tr.append(tdName, tdRole, tdCampus, tdPin, tdActive, tdAct);
      frag.appendChild(tr);
    });

    tbody.innerHTML = '';
    tbody.appendChild(frag);
  } catch (e) {
    // Show a generic message to the user; log the real error to console only
    console.error('loadUsers error:', e);
    tbody.innerHTML = '<tr><td colspan="6" style="color:var(--red);text-align:center;">Failed to load employees. Check console for details.</td></tr>';
  }
}

let editingUserId = null;

function openAddUser() {
  editingUserId = null;
  document.getElementById('modal-user-title').textContent = 'Add Employee';
  document.getElementById('modal-user-sub').textContent   = 'New employees set their own PIN on first login.';
  document.getElementById('u-name').value    = '';
  document.getElementById('u-role').value    = 'area_leader';
  document.getElementById('u-campus').value  = 'SY';
  document.getElementById('u-active-group').style.display = 'none';
  document.getElementById('btn-user-confirm').textContent = 'Add Employee';
  document.getElementById('modal-user').classList.add('open');
  setTimeout(() => document.getElementById('u-name').focus(), 100);
}

function openEditUser(id) {
  const u = allEmployees.find(e => e.id === id); if (!u) return;
  editingUserId = id;
  document.getElementById('modal-user-title').textContent = 'Edit Employee';
  document.getElementById('modal-user-sub').textContent   = 'Update role, campus, or status.';
  document.getElementById('u-name').value   = u.name;
  document.getElementById('u-role').value   = u.role;
  document.getElementById('u-campus').value = u.campus;
  document.getElementById('u-active').value = String(u.active);
  document.getElementById('u-active-group').style.display = 'block';
  document.getElementById('btn-user-confirm').textContent = 'Save Changes';
  document.getElementById('modal-user').classList.add('open');
}

document.getElementById('btn-user-confirm').addEventListener('click', async () => {
  const name   = document.getElementById('u-name').value.trim();
  const role   = document.getElementById('u-role').value;
  const campus = document.getElementById('u-campus').value;
  const active = document.getElementById('u-active').value === 'true';
  if (!name) { toast('Name is required', 'err'); return; }
  const btn = document.getElementById('btn-user-confirm'); btn.disabled = true;
  try {
    if (editingUserId) await sb('sts_employees?id=eq.' + editingUserId, 'PATCH', { name, role, campus, active }, { prefer: 'return=minimal' });
    else               await sb('sts_employees', 'POST', { name, role, campus, active: true });
    toast(editingUserId ? 'Employee updated' : 'Employee added', 'ok');
    closeModal('modal-user'); loadUsers();
  } catch (e) { toast('Error: ' + e.message, 'err'); }
  finally { btn.disabled = false; }
});

async function resetPin(id, name) {
  if (!confirm(`Reset PIN for ${name}? They will need to set a new PIN on next login.`)) return;
  try {
    await sb('sts_employees?id=eq.' + id, 'PATCH', { pin_hash: null }, { prefer: 'return=minimal' });
    toast('PIN reset for ' + name, 'ok'); loadUsers();
  } catch (e) { toast('Error: ' + e.message, 'err'); }
}