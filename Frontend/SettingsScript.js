/******************** АВТО КОНФИГ ********************/
// По желание в HTML преди този файл:
// <script>window.__API_BASE__='https://sportstatsapi.azurewebsites.net'</script>
const AUTO_BASE_URL = (() => {
  if (typeof window !== 'undefined' && window.__API_BASE__) return window.__API_BASE__;

  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (isLocal) {
    const proto = location.protocol === 'https:' ? 'https' : 'http';
    return `${proto}://localhost:7198`;
  }
  return 'https://sportstatsapi.azurewebsites.net';
})();

/******************** Помощници ********************/
const LS_KEYS = { USER_UI: 'user', USER_SERVER: 'userServer', USER_HASH: 'userHash' };

function buildUrl(base, path) {
  return `${String(base).replace(/\/+$/,'')}/${String(path).replace(/^\/+/, '')}`;
}

function fetchWithTimeout(url, options = {}, ms = 10000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(t));
}

// Добавих продакшън като трети fallback за localhost
async function apiFetchSmart(path, options = {}) {
  const basesToTry = [AUTO_BASE_URL];

  try {
    const url = new URL(AUTO_BASE_URL);
    const isLocal = (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
    if (isLocal) {
      const otherProto = url.protocol === 'https:' ? 'http:' : 'https:';
      const alt = `${otherProto}//${url.hostname}${url.port ? ':'+url.port : ''}`;
      if (!basesToTry.includes(alt)) basesToTry.push(alt);

      // трети fallback – продакшън
      const PROD = 'https://sportstatsapi.azurewebsites.net';
      if (!basesToTry.includes(PROD)) basesToTry.push(PROD);
    }
  } catch { /* ignore */ }

  let lastErr;
  for (const base of basesToTry) {
    try {
      const res = await fetchWithTimeout(buildUrl(base, path), options, 10000);
      if (!res.ok) {
        const txt = await res.text().catch(()=> '');
        throw new Error(`${res.status} ${res.statusText} ${txt || ''}`.trim());
      }
      return res;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Network error');
}

/******************** Канон + хеш ********************/
function toCanonicalUser(u) {
  if (!u || typeof u !== 'object') return null;
  const c = {
    id: u.id ?? u.Id ?? u.userId ?? u.UserId,
    firstName: u.firstName ?? u.FirstName,
    lastName: u.lastName ?? u.LastName,
    email: u.email ?? u.Email,
    gender: u.gender ?? u.Gender,
    roleID: u.roleID ?? u.RoleID,
    clubID: u.clubID ?? u.ClubID,
    profileImage_url: u.profileImage_url,
    yearOfBirth: u.yearOfBirth ?? u.YearOfBirth,
    statusID: u.statusID ?? u.StatusID,
  };
  c.id = Number(c.id);
  c.roleID = Number(c.roleID);
  c.clubID = Number(c.clubID);
  c.yearOfBirth = Number(c.yearOfBirth);
  c.statusID = Number(c.statusID);
  return c;
}

async function computeUserHash(c) {
  const data = `${c.firstName}${c.lastName}${c.email}${c.gender}${c.roleID}${c.clubID}${c.profileImage_url}${c.id}${c.yearOfBirth}${c.statusID}`;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

async function syncLocalUsersAndHash(c) {
  const uiUser = {
    id: c.id, firstName: c.firstName, lastName: c.lastName, email: c.email,
    gender: c.gender, roleID: c.roleID, clubID: c.clubID,
    profileImage_url: c.profileImage_url, yearOfBirth: c.yearOfBirth, statusID: c.statusID
  };
  const serverUser = {
    Id: c.id, FirstName: c.firstName, LastName: c.lastName, Email: c.email,
    Gender: c.gender, RoleID: c.roleID, ClubID: c.clubID,
    profileImage_url: c.profileImage_url, YearOfBirth: c.yearOfBirth, StatusID: c.statusID
  };
  localStorage.setItem(LS_KEYS.USER_UI, JSON.stringify(uiUser));
  localStorage.setItem(LS_KEYS.USER_SERVER, JSON.stringify(serverUser));
  localStorage.setItem(LS_KEYS.USER_HASH, await computeUserHash(c));
}

/******************** UI helpers ********************/
function showMessageBox(message) {
  const box = document.getElementById('message-box');
  const text = document.getElementById('message-box-text');
  const bar = document.getElementById('message-box-progress-bar');
  if (!box || !text || !bar) { alert(message); return; }
  text.textContent = message;
  box.style.display = 'flex';
  bar.style.width = '0%';
  setTimeout(() => { bar.style.width = '100%'; }, 50);
  setTimeout(() => { box.style.opacity = '0'; box.style.transform = 'translateY(-20px)'; }, 3000);
  setTimeout(() => { box.style.display = 'none'; box.style.opacity = ''; box.style.transform = ''; }, 3200);
}

function setFieldState(inputEl, ok, msgEl, msg) {
  const row = inputEl?.closest('.form-row') || inputEl?.parentElement || inputEl;
  if (row) {
    row.classList.toggle('is-valid', !!ok);
    row.classList.toggle('is-invalid', !ok);
  }
  if (msgEl) {
    msgEl.textContent = ok ? '' : (msg || '');
    msgEl.style.display = ok ? 'none' : 'block';
  }
  if (inputEl) {
    inputEl.setAttribute('aria-invalid', ok ? 'false' : 'true');
    if (msgEl?.id) inputEl.setAttribute('aria-describedby', msgEl.id);
  }
}

/******************** Показ/скриване на полетата ********************/
function toggleEditFields(editing) {
  ['first-name','last-name','year-of-birth','email'].forEach(id=>{
    const v = document.getElementById(id);
    const e = document.getElementById(`edit-${id}`);
    if (v) v.style.display = editing ? 'none' : 'inline';
    if (e) e.style.display = editing ? 'block' : 'none';
  });

  const pwd = document.getElementById('edit-password');
  const cpwd = document.getElementById('edit-confirm-password');
  if (pwd) pwd.style.display = editing ? 'block' : 'none';
  if (cpwd) cpwd.style.display = editing ? 'block' : 'none';

  document.querySelectorAll('.toggle-password')
    .forEach(el => el.style.display = editing ? 'inline-block' : 'none');
  const cpwdLabel = document.querySelector('.confirm-password-label');
  if (cpwdLabel) cpwdLabel.style.display = editing ? 'inline-block' : 'none';

  const save = document.getElementById('save-profile');
  const cancel = document.getElementById('cancel-profile');
  const edit = document.getElementById('edit-profile');
  if (save) save.style.display = editing ? 'block' : 'none';
  if (cancel) cancel.style.display = editing ? 'block' : 'none';
  if (edit) edit.style.display = editing ? 'none' : 'block';
}

/******************** Рендер ********************/
function displayUserInfo(user) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v ?? 'Няма данни'; };
  set('first-name', user.firstName || 'Няма данни');
  set('last-name',  user.lastName  || 'Няма данни');
  set('year-of-birth', user.yearOfBirth || 'Няма данни');
  set('email', user.email || 'Няма данни');
  loadYearOptions(user.yearOfBirth);
}

function loadYearOptions(selectedYear) {
  const sel = document.getElementById('edit-year-of-birth');
  if (!sel) return;
  sel.innerHTML = '';
  const now = new Date().getFullYear();
  for (let y = now - 100; y <= now; y++) {
    const o = document.createElement('option');
    o.value = y; o.textContent = y;
    if (Number(y) === Number(selectedYear)) o.selected = true;
    sel.appendChild(o);
  }
}

/******************** Снимка ********************/
const DEFAULT_PROFILE_IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

async function loadProfilePicture(userId) {
  const main = document.getElementById('profile-image');
  if (main) main.onerror = () => { main.src = DEFAULT_PROFILE_IMG; };
  try {
    const res = await apiFetchSmart(`/api/Users/profilePicture/${userId}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    if (main) { main.src = url; main.alt = 'Профилна снимка'; }
    document.querySelectorAll('.profile-image').forEach(e => {
      e.onerror = () => { e.src = DEFAULT_PROFILE_IMG; };
      e.src = url;
    });
  } catch (err) {
    console.error('profilePicture error:', err);
    if (main) { main.src = DEFAULT_PROFILE_IMG; main.alt = 'Профилната снимка не е налична'; }
  }
}

function setupProfileImageUpdate(userId) {
  const btn = document.getElementById('edit-image-button');
  const input = document.getElementById('edit-profile-image');
  if (!btn || !input) return;
  btn.addEventListener('click', () => input.click());
  input.addEventListener('change', async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const form = new FormData(); form.append('file', file);
    try {
      const up = await apiFetchSmart(`/api/Users/uploadProfilePicture/${userId}`, { method: 'POST', body: form });
      const data = await up.json().catch(()=>({}));
      const bust = await apiFetchSmart(`/api/Users/profilePicture/${userId}?t=${Date.now()}`);
      const blob = await bust.blob(); const url = URL.createObjectURL(blob);
      const img = document.getElementById('profile-image'); if (img) img.src = url;
      document.querySelectorAll('.profile-image').forEach(e=> e.src = url);

      const ui = JSON.parse(localStorage.getItem(LS_KEYS.USER_UI) || 'null');
      const canon = toCanonicalUser(ui);
      canon.profileImage_url = data.profileImage_url ?? canon.profileImage_url;
      await syncLocalUsersAndHash(canon);

      showMessageBox('Профилната снимка е успешно обновена!');
    } catch (err) {
      console.error('upload photo error:', err);
      showMessageBox('Грешка при качване на снимката.');
    }
  });
}

/******************** Валидация ********************/
const rules = {
  name: v => /^[A-Za-zА-Яа-я]+$/.test(v) || 'Само букви.',
  email: v => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|bg|org|net|info|edu|gov|biz|co\.uk)$/i.test(v) || 'Невалиден имейл.',
  yob: v => /^(?:19\d{2}|20\d{2})$/.test(String(v)) && Number(v) <= new Date().getFullYear() || 'Невалидна година.',
  password: v => !v || /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/.test(v) || 'Мин. 8 символа, главна буква и цифра.',
};

function scorePassword(pwd) {
  if (!pwd) return 0;
  let s = 0;
  if (pwd.length >= 8) s++;
  if (/[A-Z]/.test(pwd)) s++;
  if (/\d/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  if (pwd.length >= 12) s++;
  return Math.min(s, 5);
}
function renderPwdStrength(pwd) {
  const el = document.getElementById('pwd-strength'); if (!el) return;
  const s = scorePassword(pwd);
  const pct = (s/5)*100;
  const labels = ['', 'много слаба', 'слаба', 'ок', 'добра', 'много добра'];
  el.innerHTML = `
    <div class="pwd-meter">
      <div class="pwd-bar" style="width:${pct}%"></div>
    </div>
    <small class="pwd-label">${labels[s] || ''}</small>
  `;
  const bar = el.querySelector('.pwd-bar');
  if (bar) bar.style.background = s <= 2 ? '#ef4444' : s === 3 ? '#f59e0b' : '#10b981';
}

/******************** Оченца (data-target) ********************/
function setupPasswordVisibility() {
  const toggles = document.querySelectorAll('.toggle-password');

  toggles.forEach(btn => {
    const targetId = btn.getAttribute('data-target');
    const input = document.getElementById(targetId);
    if (!input) return;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.classList.toggle('fa-eye', !show);
      btn.classList.toggle('fa-eye-slash', show);
    });

    const showNow = () => { input.type = 'text'; btn.classList.add('fa-eye-slash'); btn.classList.remove('fa-eye'); };
    const hideNow = () => { input.type = 'password'; btn.classList.add('fa-eye'); btn.classList.remove('fa-eye-slash'); };
    btn.addEventListener('mousedown', showNow);
    btn.addEventListener('mouseup', hideNow);
    btn.addEventListener('mouseleave', hideNow);
    btn.addEventListener('touchstart', (e)=>{ e.preventDefault(); showNow(); }, {passive:false});
    btn.addEventListener('touchend', hideNow);
  });

  const pwd = document.getElementById('edit-password');
  if (pwd) pwd.addEventListener('input', () => renderPwdStrength(pwd.value));
}

/******************** Live validation – САМО за редактираните ********************/
const dirty = new Set();
function markDirty(id) { if (id) dirty.add(id); }

function setupLiveValidation() {
  const map = [
    { id: 'edit-first-name',  rule: rules.name,     err: 'err-first-name' },
    { id: 'edit-last-name',   rule: rules.name,     err: 'err-last-name' },
    { id: 'edit-year-of-birth', rule: rules.yob,    err: 'err-year-of-birth' },
    { id: 'edit-email',       rule: rules.email,    err: 'err-email' },
    { id: 'edit-password',    rule: rules.password, err: 'err-password' },
  ];
  map.forEach(({id, rule, err})=>{
    const input = document.getElementById(id);
    const msg = document.getElementById(err);
    if (!input) return;

    const setDirty = () => markDirty(id);
    input.addEventListener('input', setDirty, { once: true });
    input.addEventListener('focus', setDirty, { once: true });

    const validate = () => {
      if (!dirty.has(id)) return;
      const v = input.value.trim();
      const res = rule(v);
      const ok = res === true;
      setFieldState(input, ok, msg, ok ? '' : res);
    };
    input.addEventListener('input', validate);
    input.addEventListener('blur', validate);
  });

  const pwd = document.getElementById('edit-password');
  const cp = document.getElementById('edit-confirm-password');
  const cpErr = document.getElementById('err-confirm-password');
  if (cp) {
    const vConfirm = () => {
      if (!dirty.has('edit-password') && !dirty.has('edit-confirm-password')) return;
      const ok = cp.value.trim() === (pwd?.value.trim() || '');
      setFieldState(cp, ok, cpErr, ok ? '' : 'Паролите не съвпадат.');
    };
    cp.addEventListener('input', () => { markDirty('edit-confirm-password'); vConfirm(); });
    cp.addEventListener('blur', vConfirm);
    pwd?.addEventListener('input', () => { markDirty('edit-password'); vConfirm(); });
  }

  if (pwd) renderPwdStrength(pwd.value);
}

function clearValidationUI() {
  dirty.clear();
  document.querySelectorAll('.form-row').forEach(r => {
    r.classList.remove('is-valid','is-invalid');
  });
  document.querySelectorAll('.error-msg').forEach(e => {
    e.textContent = '';
    e.style.display = 'none';
  });
  const s = document.getElementById('pwd-strength'); if (s) s.innerHTML = '';
}

/******************** Редакция ********************/
const UPDATE_ENDPOINTS = {
  firstName: 'update-firstname',
  lastName: 'update-lastname',
  yearOfBirth: 'update-yearofbirth',
  email: 'update-email',
  password: 'update-password',
};

async function updateField(userId, key, value) {
  const ep = UPDATE_ENDPOINTS[key];
  if (!ep) return;
  await apiFetchSmart(`/api/Users/${userId}/${ep}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  });
}

function setupProfileEditing(user) {
  document.getElementById('edit-profile')?.addEventListener('click', () => {
    clearValidationUI();
    toggleEditFields(true);
  });

  document.getElementById('cancel-profile')?.addEventListener('click', () => {
    clearValidationUI();
    toggleEditFields(false);
  });

  const saveBtn = document.getElementById('save-profile');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      try { await saveProfileChanges(user); toggleEditFields(false); }
      catch { showMessageBox('Възникна грешка при обновяване на профила.'); }
    });
  }

  setupPasswordVisibility();
  setupLiveValidation();
}

async function saveProfileChanges(currentUser) {
  const get = id => document.getElementById(id);
  const fn = get('edit-first-name'), ln = get('edit-last-name'),
        yob = get('edit-year-of-birth'), em = get('edit-email'),
        pw = get('edit-password'), cpw = get('edit-confirm-password');

  const proposed = {
    firstName: fn?.value.trim(),
    lastName:  ln?.value.trim(),
    yearOfBirth: yob?.value.trim(),
    email: em?.value.trim(),
  };
  const changed = {};
  if (proposed.firstName && proposed.firstName !== currentUser.firstName) changed.firstName = proposed.firstName;
  if (proposed.lastName  && proposed.lastName  !== currentUser.lastName)  changed.lastName  = proposed.lastName;
  if (proposed.yearOfBirth && String(proposed.yearOfBirth) !== String(currentUser.yearOfBirth)) changed.yearOfBirth = proposed.yearOfBirth;
  if (proposed.email && proposed.email !== currentUser.email) changed.email = proposed.email;
  const newPwd = pw?.value.trim();
  const newPwd2 = cpw?.value.trim();
  if (newPwd) changed.password = newPwd;

  let valid = true;
  const checkOne = (el, rule, errId) => {
    if (!el) return true;
    const res = rule(el.value.trim());
    const ok = res === true;
    setFieldState(el, ok, document.getElementById(errId), ok ? '' : res);
    return ok;
  };

  if ('firstName' in changed) valid = checkOne(fn, rules.name, 'err-first-name') && valid;
  if ('lastName'  in changed) valid = checkOne(ln, rules.name, 'err-last-name') && valid;
  if ('yearOfBirth' in changed) valid = checkOne(yob, rules.yob, 'err-year-of-birth') && valid;
  if ('email' in changed) valid = checkOne(em, rules.email, 'err-email') && valid;
  if ('password' in changed) {
    valid = checkOne(pw, rules.password, 'err-password') && valid;
    const same = newPwd === newPwd2;
    setFieldState(cpw, same, document.getElementById('err-confirm-password'), same ? '' : 'Паролите не съвпадат.');
    valid = valid && same;
  }
  if (!valid) { showMessageBox('Поправи грешките в редактираните полета.'); return; }

  for (const [k, v] of Object.entries(changed)) await updateField(currentUser.id, k, v);

  const canonOld = toCanonicalUser(currentUser);
  const canonNew = { ...canonOld,
    firstName: changed.firstName ?? canonOld.firstName,
    lastName: changed.lastName ?? canonOld.lastName,
    yearOfBirth: changed.yearOfBirth ? Number(changed.yearOfBirth) : canonOld.yearOfBirth,
    email: changed.email ?? canonOld.email
  };
  await syncLocalUsersAndHash(canonNew);

  const ui = JSON.parse(localStorage.getItem(LS_KEYS.USER_UI) || 'null');
  if (ui) displayUserInfo(ui);

  clearValidationUI();
  showMessageBox('Профилът е успешно обновен!');
}

/******************** Logout ********************/
function showLogoutConfirmation() {
  const old = document.querySelector('.confirmation-overlay'); if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.className = 'confirmation-overlay';
  overlay.innerHTML = `
    <div class="confirmation-box" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <h3 id="confirm-title" class="confirm-title">Сигурни ли сте, че искате да излезете от профила си?</h3>
      <button id="confirm-logout" class="confirm-button">Да</button>
    </div>
  `;

  const prev = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  const close = () => {
    overlay.classList.add('closing');
    setTimeout(()=>{ overlay.remove(); document.body.style.overflow = prev || ''; document.removeEventListener('keydown', onKey); },150);
  };
  const onKey = e => { if (e.key==='Escape') close(); };
  overlay.addEventListener('click', e => { if (!e.target.closest('.confirmation-box')) close(); });
  overlay.querySelector('.confirmation-box').addEventListener('click', e => e.stopPropagation());
  document.addEventListener('keydown', onKey);

  overlay.querySelector('#confirm-logout').addEventListener('click', () => {
    localStorage.removeItem(LS_KEYS.USER_UI);
    localStorage.removeItem(LS_KEYS.USER_SERVER);
    localStorage.removeItem(LS_KEYS.USER_HASH);
    sessionStorage.removeItem(LS_KEYS.USER_UI);
    showMessageBox('Успешно излязохте!');
    setTimeout(()=>{ window.location.href = 'Index.html'; }, 800);
  });

  document.body.appendChild(overlay);
  overlay.querySelector('#confirm-logout').focus();
}

/******************** Startup ********************/
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const uiJson = localStorage.getItem(LS_KEYS.USER_UI);
    const savedHash = localStorage.getItem(LS_KEYS.USER_HASH);
    if (!uiJson || !savedHash) {
      showMessageBox('Невалидни данни. Пренасочване...');
      setTimeout(()=>location.href='Index.html', 1200); return;
    }
    const uiUser = JSON.parse(uiJson);
    const canon = toCanonicalUser(uiUser);
    const hashNow = await computeUserHash(canon);
    if (hashNow !== savedHash) {
      showMessageBox('Профилът беше променен. Влез отново.');
      localStorage.clear();
      setTimeout(()=>location.href='Index.html',1200); return;
    }

    displayUserInfo(uiUser);
    await loadProfilePicture(canon.id);
    setupProfileImageUpdate(canon.id);
    setupProfileEditing(uiUser);

    // Зареждане на клуб – нормализирано име + fallback-и са в apiFetchSmart
    try {
      const res = await apiFetchSmart(`/api/Clubs/${canon.clubID}`);
      const club = await res.json();
      const clubName = club.name ?? club.Name ?? 'Няма данни';
      const el = document.getElementById('club'); if (el) el.textContent = clubName;
    } catch (err) {
      console.error('club error:', err);
      const el = document.getElementById('club'); if (el) el.textContent = 'Грешка при зареждане на клуба';
    }

    const logoutBtn = document.getElementById('logout-button');
    if (logoutBtn) logoutBtn.addEventListener('click', showLogoutConfirmation);
  } catch (err) {
    console.error(err);
    showMessageBox('Фатална грешка при инициализация.');
  }
});
