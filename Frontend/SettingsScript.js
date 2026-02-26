/******************** API (PROD ONLY) ********************/
// Всички заявки отиват само към този домейн.
const API_ORIGIN = 'https://sportstatsapi.azurewebsites.net';

/******************** LocalStorage keys ********************/
const LS_KEYS = {
  USER_UI: 'user',
  USER_SERVER: 'userServer',
  USER_HASH: 'userHash',
  SESSION: 'session'
};

/******************** Helpers ********************/
function safeJsonParse(v, fallback = null) {
  try { return JSON.parse(v); } catch { return fallback; }
}

function pick(obj, ...keys) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function getStoredUiUser() {
  return safeJsonParse(localStorage.getItem(LS_KEYS.USER_UI), null);
}

function getStoredSession() {
  return safeJsonParse(localStorage.getItem(LS_KEYS.SESSION), null);
}

/**
 * Нормализира път към API:
 * - ако е абсолютен URL (http/https) и е от друг домейн -> пренасочва към API_ORIGIN със същия path+query
 * - ако е относителен:
 *   - '/api/...' -> API_ORIGIN + '/api/...'
 *   - '/Users/...' -> API_ORIGIN + '/api/Users/...'
 *   - 'Users/...' -> API_ORIGIN + '/api/Users/...'
 */
function normalizeApiUrl(path) {
  let p = String(path ?? '').trim();
  if (!p) throw new Error('Missing API path.');

  // Absolute URL?
  if (p.startsWith('http://') || p.startsWith('https://')) {
    try {
      const u = new URL(p);

      // ако вече е към правилния домейн -> ползвай директно
      if (`${u.protocol}//${u.host}` === API_ORIGIN) return u.toString();

      // ако е към друг домейн -> вземи само path+search и го закачи към API_ORIGIN
      p = `${u.pathname}${u.search || ''}`;
    } catch {
      // ако е счупен absolute URL -> ще мине като относителен
    }
  }

  // Ensure starts with /
  p = p.startsWith('/') ? p : `/${p}`;

  // Avoid double /api
  if (p === '/api') return `${API_ORIGIN}/api`;
  if (p.startsWith('/api/')) return `${API_ORIGIN}${p}`;

  return `${API_ORIGIN}/api${p}`;
}

function fetchWithTimeout(url, options = {}, ms = 12000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);

  const mergedOptions = {
    credentials: 'include', // важно за ASP.NET Session
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.headers || {})
    },
    signal: controller.signal
  };

  return fetch(url, mergedOptions).finally(() => clearTimeout(t));
}

// PROD only: без fallback-и, без localhost, без __API_BASE__ override
async function apiFetchSmart(path, options = {}) {
  const url = normalizeApiUrl(path);

  // Auto headers: Content-Type ако има body и не е FormData
  const headers = new Headers(options.headers || {});
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  const isFormData = (typeof FormData !== 'undefined') && (options.body instanceof FormData);
  if (options.body != null && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Requester-Id (ако го ползваш в API-то)
  const u = getStoredUiUser();
  if (u?.id && !headers.has('Requester-Id')) headers.set('Requester-Id', String(u.id));

  const res = await fetchWithTimeout(url, { ...options, headers }, 12000);

  if (!res.ok) {
    let txt = '';
    try { txt = await res.text(); } catch { }
    throw new Error(`${res.status} ${res.statusText}${txt ? ` | ${txt}` : ''}`);
  }

  return res;
}

async function apiJsonSmart(path, options = {}) {
  const res = await apiFetchSmart(path, options);
  const ct = (res.headers.get('content-type') || '').toLowerCase();

  let data = null;
  if (ct.includes('application/json')) {
    data = await res.json().catch(() => null);
  } else {
    const txt = await res.text().catch(() => '');
    data = txt || null;
  }

  return { res, data };
}

/******************** Нормализация (UI / backend-like) ********************/
function normalizeUserForUI(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const id = toInt(pick(raw, 'id', 'Id', 'userId', 'UserId'));
  if (!id) return null;

  return {
    id,
    firstName: String(pick(raw, 'firstName', 'FirstName') ?? '').trim(),
    lastName: String(pick(raw, 'lastName', 'LastName') ?? '').trim(),
    email: pick(raw, 'email', 'Email') ?? '',
    gender: String(pick(raw, 'gender', 'Gender') ?? '').trim(),
    roleID: toInt(pick(raw, 'roleID', 'RoleID', 'roleId', 'RoleId')),
    clubID: toInt(pick(raw, 'clubID', 'ClubID', 'clubId', 'ClubId')),
    profileImage_url: String(
      pick(raw, 'profileImage_url', 'ProfileImage_url', 'profileImageUrl', 'ProfileImageUrl') ?? ''
    ).trim(),
    yearOfBirth: toInt(pick(raw, 'yearOfBirth', 'YearOfBirth')),
    statusID: toInt(pick(raw, 'statusID', 'StatusID', 'statusId', 'StatusId')),
    userTokenHash: String(pick(raw, 'userTokenHash', 'UserTokenHash') ?? '').trim()
  };
}

// 1:1 с IndexPageScript / backend UserSession canonical
function normalizeSessionLikeBackend(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const id = toInt(pick(raw, 'id', 'Id', 'userId', 'UserId'));
  if (!id) return null;

  return {
    Id: id,
    FirstName: String(pick(raw, 'firstName', 'FirstName') ?? '').trim(),
    LastName: String(pick(raw, 'lastName', 'LastName') ?? '').trim(),
    Email: pick(raw, 'email', 'Email') ?? '',
    Gender: String(pick(raw, 'gender', 'Gender') ?? '').trim(),
    RoleID: toInt(pick(raw, 'roleID', 'RoleID', 'roleId', 'RoleId')),
    ClubID: toInt(pick(raw, 'clubID', 'ClubID', 'clubId', 'ClubId')),
    profileImage_url: String(
      pick(raw, 'profileImage_url', 'ProfileImage_url', 'profileImageUrl', 'ProfileImageUrl') ?? ''
    ).trim(),
    YearOfBirth: toInt(pick(raw, 'yearOfBirth', 'YearOfBirth')),
    StatusID: toInt(pick(raw, 'statusID', 'StatusID', 'statusId', 'StatusId')),
    UserTokenHash: String(pick(raw, 'userTokenHash', 'UserTokenHash') ?? '').trim()
  };
}

function getCanonicalPayloadLikeBackend(s) {
  if (!s) return '';

  return [
    String(toInt(s.Id)),
    String(s.FirstName ?? '').trim(),
    String(s.LastName ?? '').trim(),
    String(s.Email ?? '').trim(),
    String(s.Gender ?? '').trim(),
    String(toInt(s.RoleID)),
    String(toInt(s.ClubID)),
    String(s.profileImage_url ?? '').trim(),
    String(toInt(s.YearOfBirth)),
    String(toInt(s.StatusID))
  ].join('|');
}

async function sha256Base64Utf8(text) {
  if (!(window.crypto && window.crypto.subtle)) {
    throw new Error('Web Crypto API is not available.');
  }

  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hashBuffer);

  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function computeUserTokenHashLikeBackend(raw) {
  const s = normalizeSessionLikeBackend(raw);
  if (!s) return '';
  const payload = getCanonicalPayloadLikeBackend(s);
  return await sha256Base64Utf8(payload);
}

function toServerUser(ui) {
  const u = normalizeUserForUI(ui);
  if (!u) return null;

  return {
    Id: u.id,
    FirstName: u.firstName,
    LastName: u.lastName,
    Email: u.email,
    Gender: u.gender,
    RoleID: u.roleID,
    ClubID: u.clubID,
    profileImage_url: u.profileImage_url,
    YearOfBirth: u.yearOfBirth,
    StatusID: u.statusID,
    UserTokenHash: u.userTokenHash || ''
  };
}

// Пази user + userServer + userHash + session (ако има)
async function syncLocalUsersAndHash(rawUserLike) {
  const uiUser = normalizeUserForUI(rawUserLike);
  if (!uiUser) throw new Error('Invalid user for sync.');

  const token = await computeUserTokenHashLikeBackend(uiUser);
  uiUser.userTokenHash = token;

  const serverUser = toServerUser(uiUser);

  localStorage.setItem(LS_KEYS.USER_UI, JSON.stringify(uiUser));
  localStorage.setItem(LS_KEYS.USER_SERVER, JSON.stringify(serverUser));
  localStorage.setItem(LS_KEYS.USER_HASH, token);

  const existingSession = getStoredSession() || {};
  const canonicalSession = normalizeSessionLikeBackend(uiUser);

  if (canonicalSession) {
    const sessionToStore = {
      ...existingSession,           // пазим extra полета (ако има)
      ...canonicalSession,          // canonical values
      UserTokenHash: token          // винаги синкнат hash
    };
    localStorage.setItem(LS_KEYS.SESSION, JSON.stringify(sessionToStore));
  }

  return uiUser;
}

/******************** UI helpers ********************/
function showMessageBox(message) {
  const box = document.getElementById('message-box');
  const text = document.getElementById('message-box-text');
  const bar = document.getElementById('message-box-progress-bar');

  if (!box || !text || !bar) {
    alert(message);
    return;
  }

  text.textContent = message;
  box.style.display = 'flex';
  bar.style.width = '0%';

  setTimeout(() => { bar.style.width = '100%'; }, 50);
  setTimeout(() => {
    box.style.opacity = '0';
    box.style.transform = 'translateY(-20px)';
  }, 3000);
  setTimeout(() => {
    box.style.display = 'none';
    box.style.opacity = '';
    box.style.transform = '';
  }, 3200);
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

function getOrCreateErrorElement(afterEl, id) {
  let el = document.getElementById(id);
  if (el) return el;

  el = document.createElement('div');
  el.id = id;
  el.className = 'error-msg';
  el.style.display = 'none';

  afterEl?.insertAdjacentElement('afterend', el);
  return el;
}

/******************** Club edit control (dynamic if missing) ********************/
function ensureEditClubControl() {
  let sel = document.getElementById('edit-club');
  if (sel) return sel;

  const clubView = document.getElementById('club');
  if (!clubView) return null;

  sel = document.createElement('select');
  sel.id = 'edit-club';
  sel.style.display = 'none';

  // Ако имаш CSS клас за input/select, добави го:
  sel.className = clubView.className ? `${clubView.className} edit-club-select` : 'edit-club-select';

  clubView.insertAdjacentElement('afterend', sel);
  getOrCreateErrorElement(sel, 'err-club');

  return sel;
}

async function loadClubOptions(selectedClubId) {
  const sel = ensureEditClubControl();
  if (!sel) return;

  try {
    const { data } = await apiJsonSmart('/api/Clubs');
    const clubs = Array.isArray(data) ? data : [];

    sel.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Избери клуб';
    sel.appendChild(placeholder);

    clubs.forEach(c => {
      const id = toInt(c.id ?? c.Id);
      const name = c.name ?? c.Name ?? `Клуб #${id}`;
      const o = document.createElement('option');
      o.value = String(id);
      o.textContent = name;
      if (id === toInt(selectedClubId)) o.selected = true;
      sel.appendChild(o);
    });

    if (!clubs.some(c => toInt(c.id ?? c.Id) === toInt(selectedClubId)) && selectedClubId) {
      const extra = document.createElement('option');
      extra.value = String(selectedClubId);
      extra.textContent = `Текущ клуб (#${selectedClubId})`;
      extra.selected = true;
      sel.appendChild(extra);
    }
  } catch (err) {
    console.error('loadClubOptions error:', err);
    showMessageBox('Не успях да заредя списъка с клубове.');
  }
}

async function loadAndRenderClubName(clubId) {
  const el = document.getElementById('club');
  if (!el) return;

  if (!clubId) {
    el.textContent = 'Няма данни';
    return;
  }

  try {
    const { data: club } = await apiJsonSmart(`/api/Clubs/${clubId}`);
    const clubName = club?.name ?? club?.Name ?? 'Няма данни';
    el.textContent = clubName;
  } catch (err) {
    console.error('club error:', err);
    el.textContent = 'Грешка при зареждане на клуба';
  }
}

/******************** Показ/скриване на полетата ********************/
function toggleEditFields(editing) {
  ['first-name', 'last-name', 'year-of-birth', 'email', 'club'].forEach(id => {
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

function fillEditFieldsFromUser(userRaw) {
  const user = normalizeUserForUI(userRaw);
  if (!user) return;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = val ?? '';
  };

  setVal('edit-first-name', user.firstName);
  setVal('edit-last-name', user.lastName);
  setVal('edit-email', user.email);
  setVal('edit-year-of-birth', user.yearOfBirth || '');

  const editClub = ensureEditClubControl();
  if (editClub) {
    editClub.value = user.clubID ? String(user.clubID) : '';
  }

  const pw = document.getElementById('edit-password');
  const cpw = document.getElementById('edit-confirm-password');
  if (pw) pw.value = '';
  if (cpw) cpw.value = '';
}

/******************** Рендер ********************/
function displayUserInfo(userRaw) {
  const user = normalizeUserForUI(userRaw);
  if (!user) return;

  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = (v ?? '') || 'Няма данни';
  };

  set('first-name', user.firstName);
  set('last-name', user.lastName);
  set('year-of-birth', user.yearOfBirth || 'Няма данни');
  set('email', user.email || 'Няма данни');

  loadYearOptions(user.yearOfBirth);
  fillEditFieldsFromUser(user);
}

function loadYearOptions(selectedYear) {
  const sel = document.getElementById('edit-year-of-birth');
  if (!sel) return;

  sel.innerHTML = '';
  const now = new Date().getFullYear();

  for (let y = now - 100; y <= now; y++) {
    const o = document.createElement('option');
    o.value = y;
    o.textContent = y;
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

    if (main) {
      main.src = url;
      main.alt = 'Профилна снимка';
    }

    document.querySelectorAll('.profile-image').forEach(e => {
      e.onerror = () => { e.src = DEFAULT_PROFILE_IMG; };
      e.src = url;
    });
  } catch (err) {
    console.error('profilePicture error:', err);
    if (main) {
      main.src = DEFAULT_PROFILE_IMG;
      main.alt = 'Профилната снимка не е налична';
    }
  }
}

function setupProfileImageUpdate(userId) {
  const btn = document.getElementById('edit-image-button');
  const input = document.getElementById('edit-profile-image');
  if (!btn || !input) return;

  btn.addEventListener('click', () => input.click());

  input.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const form = new FormData();
    form.append('file', file);

    try {
      const upRes = await apiFetchSmart(`/api/Users/uploadProfilePicture/${userId}`, {
        method: 'POST',
        body: form
      });

      const data = await upRes.json().catch(() => ({}));

      const bust = await apiFetchSmart(`/api/Users/profilePicture/${userId}?t=${Date.now()}`);
      const blob = await bust.blob();
      const url = URL.createObjectURL(blob);

      const img = document.getElementById('profile-image');
      if (img) img.src = url;
      document.querySelectorAll('.profile-image').forEach(ei => ei.src = url);

      const ui = getStoredUiUser();
      const user = normalizeUserForUI(ui);
      if (user) {
        user.profileImage_url = data.profileImage_url ?? user.profileImage_url;
        await syncLocalUsersAndHash(user);
      }

      showMessageBox('Профилната снимка е успешно обновена!');
    } catch (err) {
      console.error('upload photo error:', err);
      showMessageBox('Грешка при качване на снимката.');
    } finally {
      input.value = '';
    }
  });
}

/******************** Валидация ********************/
const rules = {
  name: v => /^[A-Za-zА-Яа-я]+$/.test(v) || 'Само букви.',
  email: v => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|bg|org|net|info|edu|gov|biz|co\.uk)$/i.test(v) || 'Невалиден имейл.',
  yob: v => (/^(?:19\d{2}|20\d{2})$/.test(String(v)) && Number(v) <= new Date().getFullYear()) || 'Невалидна година.',
  password: v => !v || /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/.test(v) || 'Мин. 8 символа, главна буква и цифра.',
  club: v => (String(v || '').trim() !== '' && Number(v) > 0) || 'Избери клуб.'
};

async function checkEmailExists(email) {
  try {
    const { data } = await apiJsonSmart(`/api/Users/check-email?email=${encodeURIComponent(email)}`);
    return !!(data && (data.exists === true || data.emailExists === true));
  } catch {
    return false;
  }
}

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
  const el = document.getElementById('pwd-strength');
  if (!el) return;

  const s = scorePassword(pwd);
  const pct = (s / 5) * 100;
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

    const showNow = () => {
      input.type = 'text';
      btn.classList.add('fa-eye-slash');
      btn.classList.remove('fa-eye');
    };
    const hideNow = () => {
      input.type = 'password';
      btn.classList.add('fa-eye');
      btn.classList.remove('fa-eye-slash');
    };

    btn.addEventListener('mousedown', showNow);
    btn.addEventListener('mouseup', hideNow);
    btn.addEventListener('mouseleave', hideNow);
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); showNow(); }, { passive: false });
    btn.addEventListener('touchend', hideNow);
  });

  const pwd = document.getElementById('edit-password');
  if (pwd) pwd.addEventListener('input', () => renderPwdStrength(pwd.value));
}

/******************** Live validation – само за редактираните ********************/
const dirty = new Set();
function markDirty(id) { if (id) dirty.add(id); }

function setupLiveValidation() {
  ensureEditClubControl();

  const map = [
    { id: 'edit-first-name', rule: rules.name, err: 'err-first-name' },
    { id: 'edit-last-name', rule: rules.name, err: 'err-last-name' },
    { id: 'edit-year-of-birth', rule: rules.yob, err: 'err-year-of-birth' },
    { id: 'edit-email', rule: rules.email, err: 'err-email' },
    { id: 'edit-password', rule: rules.password, err: 'err-password' },
    { id: 'edit-club', rule: rules.club, err: 'err-club' }
  ];

  map.forEach(({ id, rule, err }) => {
    const input = document.getElementById(id);
    const msg = document.getElementById(err) || (id === 'edit-club' ? getOrCreateErrorElement(input, err) : null);
    if (!input) return;

    const setDirty = () => markDirty(id);
    input.addEventListener('input', setDirty, { once: true });
    input.addEventListener('change', setDirty, { once: true });
    input.addEventListener('focus', setDirty, { once: true });

    const validate = () => {
      if (!dirty.has(id)) return;
      const v = String(input.value ?? '').trim();

      // edit-password е optional
      if (id === 'edit-password' && !v) {
        setFieldState(input, true, msg, '');
        return;
      }

      const res = rule(v);
      const ok = res === true;
      setFieldState(input, ok, msg, ok ? '' : res);
    };

    input.addEventListener('input', validate);
    input.addEventListener('change', validate);
    input.addEventListener('blur', validate);
  });

  const pwd = document.getElementById('edit-password');
  const cp = document.getElementById('edit-confirm-password');
  const cpErr = document.getElementById('err-confirm-password');

  if (cp) {
    const vConfirm = () => {
      if (!dirty.has('edit-password') && !dirty.has('edit-confirm-password')) return;

      const pwdVal = (pwd?.value ?? '').trim();
      const cpVal = (cp.value ?? '').trim();

      // Ако няма нова парола, confirm не валидираме като грешка
      if (!pwdVal && !cpVal) {
        setFieldState(cp, true, cpErr, '');
        return;
      }

      const ok = cpVal === pwdVal;
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
    r.classList.remove('is-valid', 'is-invalid');
  });

  document.querySelectorAll('.error-msg').forEach(e => {
    e.textContent = '';
    e.style.display = 'none';
  });

  const s = document.getElementById('pwd-strength');
  if (s) s.innerHTML = '';
}

/******************** API updates (new controller me/* endpoints) ********************/
async function updateMeField(key, value, ctx = {}) {
  let path = '';
  let body = null;

  switch (key) {
    case 'firstName':
      path = '/api/Users/me/first-name';
      body = { FirstName: String(value ?? '').trim() };
      break;

    case 'lastName':
      path = '/api/Users/me/last-name';
      body = { LastName: String(value ?? '').trim() };
      break;

    case 'yearOfBirth':
      path = '/api/Users/me/year-of-birth';
      body = { YearOfBirth: toInt(value) };
      break;

    case 'email':
      path = '/api/Users/me/change-email';
      body = {
        NewEmail: String(value ?? '').trim(),
        Password: String(ctx.currentPassword ?? '')
      };
      break;

    case 'password':
      path = '/api/Users/me/change-password';
      body = {
        OldPassword: String(ctx.currentPassword ?? ''),
        NewPassword: String(value ?? '')
      };
      break;

    default:
      throw new Error(`Unsupported update key: ${key}`);
  }

  return await apiJsonSmart(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function requestJoinClub(userId, clubId) {
  return await apiJsonSmart(`/api/Users/${userId}/requestJoin/${clubId}`, {
    method: 'POST'
  });
}

async function fetchFreshUserById(userId) {
  const { data } = await apiJsonSmart(`/api/Users/${userId}`);
  return normalizeUserForUI(data);
}

/******************** Редакция ********************/
function setupProfileEditing() {
  document.getElementById('edit-profile')?.addEventListener('click', async () => {
    clearValidationUI();

    const user = normalizeUserForUI(getStoredUiUser());
    if (user) {
      displayUserInfo(user);
      await loadClubOptions(user.clubID);
      fillEditFieldsFromUser(user);
    }

    toggleEditFields(true);
  });

  document.getElementById('cancel-profile')?.addEventListener('click', () => {
    clearValidationUI();
    const user = normalizeUserForUI(getStoredUiUser());
    if (user) fillEditFieldsFromUser(user);
    toggleEditFields(false);
  });

  const saveBtn = document.getElementById('save-profile');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      try {
        await saveProfileChanges();
        toggleEditFields(false);
      } catch (err) {
        console.error(err);
        showMessageBox(err?.message || 'Възникна грешка при обновяване на профила.');
      }
    });
  }

  setupPasswordVisibility();
  setupLiveValidation();
}

async function saveProfileChanges() {
  const currentUser = normalizeUserForUI(getStoredUiUser());
  if (!currentUser?.id) throw new Error('Няма валиден потребител в localStorage.');

  const get = id => document.getElementById(id);

  const fn = get('edit-first-name');
  const ln = get('edit-last-name');
  const yob = get('edit-year-of-birth');
  const em = get('edit-email');
  const pw = get('edit-password');
  const cpw = get('edit-confirm-password');
  const clubSel = get('edit-club');

  const proposed = {
    firstName: (fn?.value ?? '').trim(),
    lastName: (ln?.value ?? '').trim(),
    yearOfBirth: (yob?.value ?? '').trim(),
    email: (em?.value ?? '').trim(),
    clubID: (clubSel?.value ?? '').trim()
  };

  const changed = {};
  if (proposed.firstName && proposed.firstName !== currentUser.firstName) changed.firstName = proposed.firstName;
  if (proposed.lastName && proposed.lastName !== currentUser.lastName) changed.lastName = proposed.lastName;
  if (proposed.yearOfBirth && String(proposed.yearOfBirth) !== String(currentUser.yearOfBirth)) changed.yearOfBirth = proposed.yearOfBirth;
  if (proposed.email && proposed.email !== currentUser.email) changed.email = proposed.email.toLowerCase();
  if (proposed.clubID && String(proposed.clubID) !== String(currentUser.clubID)) changed.clubID = toInt(proposed.clubID);

  const newPwd = (pw?.value ?? '').trim();
  const newPwd2 = (cpw?.value ?? '').trim();
  if (newPwd) changed.password = newPwd;

  if (Object.keys(changed).length === 0) {
    showMessageBox('Няма промени за запис.');
    return;
  }

  let valid = true;

  const checkOne = (el, rule, errId, customVal = null) => {
    if (!el) return true;
    const val = customVal !== null ? String(customVal) : String(el.value ?? '').trim();
    const res = rule(val);
    const ok = res === true;
    setFieldState(el, ok, document.getElementById(errId), ok ? '' : res);
    return ok;
  };

  if ('firstName' in changed) valid = checkOne(fn, rules.name, 'err-first-name') && valid;
  if ('lastName' in changed) valid = checkOne(ln, rules.name, 'err-last-name') && valid;
  if ('yearOfBirth' in changed) valid = checkOne(yob, rules.yob, 'err-year-of-birth') && valid;
  if ('email' in changed) valid = checkOne(em, rules.email, 'err-email') && valid;
  if ('clubID' in changed && clubSel) {
    const errEl = document.getElementById('err-club') || getOrCreateErrorElement(clubSel, 'err-club');
    const res = rules.club(String(changed.clubID));
    const ok = res === true;
    setFieldState(clubSel, ok, errEl, ok ? '' : res);
    valid = ok && valid;
  }

  if ('password' in changed) {
    valid = checkOne(pw, rules.password, 'err-password') && valid;
    const same = newPwd === newPwd2;
    setFieldState(cpw, same, document.getElementById('err-confirm-password'), same ? '' : 'Паролите не съвпадат.');
    valid = valid && same;
  }

  // check email uniqueness (само ако е променен)
  if ('email' in changed && valid) {
    const exists = await checkEmailExists(changed.email);
    if (exists) {
      setFieldState(em, false, document.getElementById('err-email'), 'Този имейл вече е зает.');
      valid = false;
    }
  }

  if (!valid) {
    showMessageBox('Поправи грешките в редактираните полета.');
    return;
  }

  // Ако сменя email/парола -> искаме текуща парола (controller го изисква)
  let currentPasswordForSensitiveOps = '';
  if ('email' in changed || 'password' in changed) {
    currentPasswordForSensitiveOps = window.prompt('Въведи текущата си парола за потвърждение:') || '';
    if (!currentPasswordForSensitiveOps.trim()) {
      showMessageBox('Смяната на имейл/парола изисква текуща парола.');
      return;
    }
  }

  const opMessages = [];

  // Ред: basic -> email -> password -> club
  if ('firstName' in changed) {
    await updateMeField('firstName', changed.firstName);
  }

  if ('lastName' in changed) {
    await updateMeField('lastName', changed.lastName);
  }

  if ('yearOfBirth' in changed) {
    await updateMeField('yearOfBirth', changed.yearOfBirth);
  }

  if ('email' in changed) {
    const { data } = await updateMeField('email', changed.email, { currentPassword: currentPasswordForSensitiveOps });
    if (data?.message) opMessages.push(data.message);
  }

  if ('password' in changed) {
    const { data } = await updateMeField('password', changed.password, { currentPassword: currentPasswordForSensitiveOps });
    if (data?.message) opMessages.push(data.message);
  }

  if ('clubID' in changed) {
    const { data } = await requestJoinClub(currentUser.id, changed.clubID);
    if (data?.message) {
      opMessages.push(data.message);
    } else {
      opMessages.push('Заявката за смяна/присъединяване към клуб е изпратена.');
    }
  }

  // Вземи свеж user от сървъра
  let freshUser = null;
  try {
    freshUser = await fetchFreshUserById(currentUser.id);
  } catch (err) {
    console.warn('Could not fetch fresh user after save:', err);
  }

  // fallback: ако не успеем да вземем свеж user, локално patch-ваме
  if (!freshUser) {
    freshUser = {
      ...currentUser,
      firstName: changed.firstName ?? currentUser.firstName,
      lastName: changed.lastName ?? currentUser.lastName,
      yearOfBirth: ('yearOfBirth' in changed) ? toInt(changed.yearOfBirth) : currentUser.yearOfBirth,
      email: changed.email ?? currentUser.email,
      clubID: ('clubID' in changed) ? toInt(changed.clubID) : currentUser.clubID,
      statusID: ('clubID' in changed) ? 1 : currentUser.statusID
    };
  }

  const synced = await syncLocalUsersAndHash(freshUser);

  displayUserInfo(synced);
  await loadClubOptions(synced.clubID);
  await loadAndRenderClubName(synced.clubID);

  // Изчисти паролите след save
  if (pw) pw.value = '';
  if (cpw) cpw.value = '';

  clearValidationUI();

  if (opMessages.length) {
    showMessageBox(opMessages[opMessages.length - 1]);
  } else {
    showMessageBox('Профилът е успешно обновен!');
  }
}

/******************** Logout ********************/
function showLogoutConfirmation() {
  const old = document.querySelector('.confirmation-overlay');
  if (old) old.remove();

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
    setTimeout(() => {
      overlay.remove();
      document.body.style.overflow = prev || '';
      document.removeEventListener('keydown', onKey);
    }, 150);
  };

  const onKey = e => { if (e.key === 'Escape') close(); };

  overlay.addEventListener('click', e => {
    if (!e.target.closest('.confirmation-box')) close();
  });

  overlay.querySelector('.confirmation-box').addEventListener('click', e => e.stopPropagation());
  document.addEventListener('keydown', onKey);

  overlay.querySelector('#confirm-logout').addEventListener('click', () => {
    localStorage.removeItem(LS_KEYS.USER_UI);
    localStorage.removeItem(LS_KEYS.USER_SERVER);
    localStorage.removeItem(LS_KEYS.USER_HASH);
    localStorage.removeItem(LS_KEYS.SESSION);
    sessionStorage.removeItem(LS_KEYS.USER_UI);

    showMessageBox('Успешно излязохте!');
    setTimeout(() => { window.location.href = 'Index.html'; }, 800);
  });

  document.body.appendChild(overlay);
  overlay.querySelector('#confirm-logout').focus();
}

/******************** Startup ********************/
document.addEventListener('DOMContentLoaded', async () => {
  try {
    ensureEditClubControl();

    const rawUi = getStoredUiUser();
    const uiUser = normalizeUserForUI(rawUi);
    const session = getStoredSession();

    const savedHashLS = String(localStorage.getItem(LS_KEYS.USER_HASH) || '').trim();
    const savedHashUser = String(uiUser?.userTokenHash || '').trim();
    const savedHashSession = String(session?.UserTokenHash || session?.userTokenHash || '').trim();

    if (!uiUser?.id) {
      showMessageBox('Невалидни данни. Пренасочване...');
      setTimeout(() => { location.href = 'Index.html'; }, 1200);
      return;
    }

    const computedHash = await computeUserTokenHashLikeBackend(uiUser);

    const candidates = [savedHashLS, savedHashUser, savedHashSession].filter(Boolean);
    const hasMatchingHash = candidates.includes(computedHash);

    if (!hasMatchingHash) {
      showMessageBox('Профилът беше променен. Влез отново.');
      localStorage.removeItem(LS_KEYS.USER_UI);
      localStorage.removeItem(LS_KEYS.USER_SERVER);
      localStorage.removeItem(LS_KEYS.USER_HASH);
      localStorage.removeItem(LS_KEYS.SESSION);
      setTimeout(() => { location.href = 'Index.html'; }, 1200);
      return;
    }

    // Саморемонт: синквай localStorage към canonical формат/hash
    const syncedUser = await syncLocalUsersAndHash(uiUser);

    displayUserInfo(syncedUser);
    await loadClubOptions(syncedUser.clubID);
    await loadAndRenderClubName(syncedUser.clubID);

    await loadProfilePicture(syncedUser.id);
    setupProfileImageUpdate(syncedUser.id);
    setupProfileEditing();

    const logoutBtn = document.getElementById('logout-button');
    if (logoutBtn) logoutBtn.addEventListener('click', showLogoutConfirmation);
  } catch (err) {
    console.error(err);
    showMessageBox('Фатална грешка при инициализация.');
  }
});