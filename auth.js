// ══════════════════════════════════════
// AUTH — login, PIN, logout
// ══════════════════════════════════════

let loginEmployee = null, pinBuffer = '', newPinFirst = '';

async function initLogin() {
  const listEl = document.getElementById('name-list');
  listEl.innerHTML = '<span style="color:var(--text-muted);font-size:12px;">Loading…</span>';
  try {
    const emps = await sb('sts_employees?active=eq.true&order=name.asc&select=id,name,role,campus,pin_hash');
    allEmployees = Array.isArray(emps) ? emps : [];
    renderNameList(allEmployees);
  } catch (e) {
    listEl.innerHTML = `<span style="color:var(--red);font-size:12px;">Error: ${e.message}</span>`;
  }
}

function renderNameList(list) {
  const el = document.getElementById('name-list');
  if (!list.length) { el.innerHTML = '<span style="color:var(--text-dim);font-size:12px;">No employees match.</span>'; return; }
  const frag = document.createDocumentFragment();
  list.forEach(e => {
    const btn = document.createElement('button');
    btn.className = 'name-btn';
    btn.innerHTML = `${e.name}<span class="nb-role">${e.role.replace(/_/g, ' ')}</span>`;
    btn.addEventListener('click', () => selectEmployee(e.id));
    frag.appendChild(btn);
  });
  el.innerHTML = ''; el.appendChild(frag);
}

function filterNames(q) {
  renderNameList(allEmployees.filter(e => e.name.toLowerCase().includes(q.toLowerCase())));
}

function selectEmployee(id) {
  loginEmployee = allEmployees.find(e => e.id === id); if (!loginEmployee) return;
  pinBuffer = '';
  if (!loginEmployee.pin_hash) {
    newPinFirst = '';
    document.getElementById('setpin-step-hint').textContent = 'Step 1 of 2: Enter your new PIN';
    clearPinDots('npd'); document.getElementById('setpin-error').textContent = '';
    showLoginStep('ls-setpin'); buildPinPad('new-pin-pad', newPinKeypress);
  } else {
    document.getElementById('pin-title').textContent = 'Welcome back, ' + loginEmployee.name.split(' ')[0] + '!';
    document.getElementById('pin-hint').textContent = 'Enter your 4-digit PIN.';
    document.getElementById('pin-error').textContent = '';
    clearPinDots('pd'); showLoginStep('ls-pin'); buildPinPad('pin-pad', pinKeypress);
  }
}

function showLoginStep(id) {
  document.querySelectorAll('.login-step').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function backToNames() { pinBuffer = ''; newPinFirst = ''; loginEmployee = null; showLoginStep('ls-name'); }

function buildPinPad(cid, handler) {
  const el = document.getElementById(cid);
  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
  el.innerHTML = keys.map(k => k === '' ? '<div></div>'
    : `<button class="pin-key${k === '⌫' ? ' del' : ''}" onclick="${handler.name}('${k}')">${k}</button>`
  ).join('');
}
function clearPinDots(p) { for (let i = 0; i < 4; i++) document.getElementById(p + i).className = 'pin-dot'; }
function updatePinDots(p, l) { for (let i = 0; i < 4; i++) document.getElementById(p + i).className = 'pin-dot' + (i < l ? ' filled' : ''); }

function pinKeypress(k) {
  if (k === '⌫') pinBuffer = pinBuffer.slice(0, -1); else if (pinBuffer.length < 4) pinBuffer += k;
  updatePinDots('pd', pinBuffer.length);
  document.getElementById('pin-error').textContent = '';
  if (pinBuffer.length === 4) setTimeout(submitPin, 120);
}
async function submitPin() {
  const h = await hashPin(pinBuffer);
  if (h === loginEmployee.pin_hash) completeLogin(loginEmployee);
  else { document.getElementById('pin-error').textContent = 'Incorrect PIN. Try again.'; pinBuffer = ''; clearPinDots('pd'); }
}

function newPinKeypress(k) {
  if (k === '⌫') pinBuffer = pinBuffer.slice(0, -1); else if (pinBuffer.length < 4) pinBuffer += k;
  updatePinDots('npd', pinBuffer.length);
  document.getElementById('setpin-error').textContent = '';
  if (pinBuffer.length === 4) {
    if (!newPinFirst) { newPinFirst = pinBuffer; pinBuffer = ''; document.getElementById('setpin-step-hint').textContent = 'Step 2 of 2: Confirm your PIN'; clearPinDots('npd'); }
    else setTimeout(confirmNewPin, 120);
  }
}
async function confirmNewPin() {
  if (pinBuffer !== newPinFirst) {
    document.getElementById('setpin-error').textContent = 'PINs do not match. Starting over.';
    newPinFirst = ''; pinBuffer = ''; clearPinDots('npd');
    document.getElementById('setpin-step-hint').textContent = 'Step 1 of 2: Enter your new PIN'; return;
  }
  const h = await hashPin(pinBuffer);
  try {
    await sb('sts_employees?id=eq.' + loginEmployee.id, 'PATCH', { pin_hash: h }, { prefer: 'return=minimal' });
    loginEmployee.pin_hash = h; completeLogin(loginEmployee); toast('PIN set successfully!', 'ok');
  } catch (e) {
    document.getElementById('setpin-error').textContent = 'Error: ' + e.message;
    newPinFirst = ''; pinBuffer = ''; clearPinDots('npd');
  }
}

function completeLogin(emp) {
  currentUser = { id: emp.id, name: emp.name, role: emp.role, campus: emp.campus };
  sessionStorage.setItem('sts_user', JSON.stringify(currentUser));
  bootApp();
}

function logout() {
  sessionStorage.removeItem('sts_user');
  currentUser = null; scheduleItems = []; cellName = ''; savedScheduleId = null;
  document.getElementById('main-header').style.display = 'none';
  document.getElementById('totals-bar').style.display = 'none';
  document.querySelectorAll('.page').forEach(p => { p.style.display = 'none'; p.classList.remove('active'); });
  document.getElementById('page-login').style.display = 'flex';
  document.getElementById('page-login').classList.add('active');
  document.getElementById('name-search').value = '';
  initLogin(); showLoginStep('ls-name');
}

async function doChangePin() {
  const cur = document.getElementById('pin-current').value;
  const nw  = document.getElementById('pin-new').value;
  const conf = document.getElementById('pin-confirm').value;
  const errEl = document.getElementById('change-pin-error');
  errEl.textContent = '';
  if (cur.length !== 4 || nw.length !== 4 || conf.length !== 4) { errEl.textContent = 'All PINs must be 4 digits.'; return; }
  if (nw !== conf) { errEl.textContent = 'New PINs do not match.'; return; }
  try {
    const [emp] = await sb('sts_employees?id=eq.' + currentUser.id + '&select=pin_hash');
    if (emp.pin_hash !== await hashPin(cur)) { errEl.textContent = 'Current PIN is incorrect.'; return; }
    await sb('sts_employees?id=eq.' + currentUser.id, 'PATCH', { pin_hash: await hashPin(nw) }, { prefer: 'return=minimal' });
    closeModal('modal-pin'); toast('PIN updated successfully', 'ok');
  } catch (e) { errEl.textContent = 'Error: ' + e.message; }
}
