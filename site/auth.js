// ══════════════════════════════════════
// AUTH — temporary admin login
// PIN-based auth has been removed.
// Full user authentication is pending a new authenticator setup.
// ══════════════════════════════════════

function loginAsAdmin() {
  completeLogin({
    id:     '00000000-0000-4000-8000-000000000000',
    name:   'Admin',
    role:   'admin',
    campus: (typeof CAMPUS_OVERRIDE !== 'undefined' && CAMPUS_OVERRIDE) || 'SY',
  });
}

function completeLogin(emp) {
  currentUser = { id: emp.id, name: emp.name, role: emp.role, campus: emp.campus };
  sessionStorage.setItem('sts_user', JSON.stringify(currentUser));
  bootApp();
}

function logout() {
  sessionStorage.removeItem('sts_user');
  currentUser = null; scheduleItems = []; cellName = ''; savedScheduleId = null;
  document.getElementById('main-header').style.display    = 'none';
  document.getElementById('totals-bar').style.display     = 'none';
  document.querySelectorAll('.page').forEach(p => { p.style.display = 'none'; p.classList.remove('active'); });
  document.getElementById('page-login').style.display = 'flex';
  document.getElementById('page-login').classList.add('active');
  showLoginStep('ls-name');
}

function showLoginStep(id) {
  document.querySelectorAll('.login-step').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}