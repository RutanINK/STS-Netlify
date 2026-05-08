// ══════════════════════════════════════
// USERS — employee management
// ══════════════════════════════════════

async function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = '<tr><td colspan="6" style="color:var(--text-muted);text-align:center;padding:20px;">Loading…</td></tr>';
  try {
    const users = await sb('sts_employees?order=name.asc&select=id,name,role,campus,pin_hash,active,created_at');
    allEmployees = users;
    tbody.innerHTML = users.map(u => `<tr>
      <td class="u-name">${u.name}</td>
      <td><span class="u-role role-${u.role}">${u.role.replace(/_/g, ' ')}</span></td>
      <td style="font-size:11px;color:var(--text-muted);">${u.campus}</td>
      <td><span style="font-size:11px;color:${u.pin_hash ? 'var(--green)' : 'var(--yellow)'};">${u.pin_hash ? '✓ Set' : 'Not set'}</span></td>
      <td style="font-size:11px;color:${u.active ? 'var(--green)' : 'var(--text-dim)'};">${u.active ? 'Active' : 'Inactive'}</td>
      <td class="u-actions">
        <button class="btn btn-ghost btn-xs" onclick="openEditUser('${u.id}')">Edit</button>
        ${u.pin_hash ? `<button class="btn btn-ghost btn-xs" onclick="resetPin('${u.id}','${u.name}')">Reset PIN</button>` : ''}
      </td>
    </tr>`).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:var(--red);text-align:center;">${e.message}</td></tr>`;
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
