// IndexPageScript.js — fixed login + userTokenHash canonical sync (same as backend UserSession)
(() => {
  const API_BASE = 'https://localhost:7198';
  const HOME_HREF = 'HomePage.html';

  const $ = (id) => document.getElementById(id);

  console.log('IndexPageScript loaded ✅');

  // ---------------- helpers ----------------
  const pick = (obj, ...keys) => {
    for (const k of keys) {
      if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
    }
    return undefined;
  };

  const toInt = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  };

  // ✅ user model for UI/local use
  function normalizeUser(raw) {
    if (!raw) return null;

    const id = toInt(pick(raw, 'id', 'Id'));
    if (!id) return null;

    return {
      id,
      firstName: String(pick(raw, 'firstName', 'FirstName') ?? '').trim(),
      lastName: String(pick(raw, 'lastName', 'LastName') ?? '').trim(),
      email: pick(raw, 'email', 'Email') ?? null,
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

  // ✅ canonical object like backend UserSession (field names/order matter for hash)
  function normalizeSessionLikeBackend(raw) {
    if (!raw) return null;

    const id = toInt(pick(raw, 'id', 'Id'));
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

  // ✅ exactly as backend GetCanonicalPayload() in UserSession.cs
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

  async function generateUserTokenHashLikeBackend(raw) {
    const s = normalizeSessionLikeBackend(raw);
    if (!s) return '';

    const payload = getCanonicalPayloadLikeBackend(s);
    return await sha256Base64Utf8(payload);
  }

  function toServerUser(ui) {
    // ✅ PascalCase + same key names used by backend/session hash
    return {
      Id: ui.id,
      FirstName: ui.firstName ?? '',
      LastName: ui.lastName ?? '',
      Email: ui.email ?? '',
      Gender: ui.gender ?? '',
      RoleID: ui.roleID ?? 0,
      ClubID: ui.clubID ?? 0,
      profileImage_url: ui.profileImage_url ?? '',
      YearOfBirth: ui.yearOfBirth ?? 0,
      StatusID: ui.statusID ?? 0,
      UserTokenHash: ui.userTokenHash ?? ''
    };
  }

  function setLoading(btn, isLoading) {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.classList.toggle('is-loading', isLoading);
  }

  async function fetchJSON(url, options = {}) {
    const res = await fetch(url, {
      credentials: 'include', // важно за HttpContext.Session
      headers: {
        Accept: 'application/json',
        ...(options.headers || {})
      },
      ...options
    });

    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = text; }

    return { res, data };
  }

  // ---------------- toast ----------------
  let toastTimer = null;

  function toast(type, title, msg) {
    const el = $('toast');
    const icon = $('toastIcon');
    const t = $('toastTitle');
    const m = $('toastMsg');
    const close = $('toastClose');

    if (!el) return;

    el.classList.remove('toast--ok', 'toast--bad', 'toast--info');
    if (type === 'ok') el.classList.add('toast--ok');
    else if (type === 'bad') el.classList.add('toast--bad');
    else el.classList.add('toast--info');

    icon.innerHTML =
      type === 'ok' ? '<i class="fa-solid fa-circle-check"></i>' :
      type === 'bad' ? '<i class="fa-solid fa-triangle-exclamation"></i>' :
      '<i class="fa-solid fa-circle-info"></i>';

    t.textContent = title || '';
    m.textContent = msg || '';

    el.classList.add('is-show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-show'), 4200);

    close?.addEventListener('click', () => {
      clearTimeout(toastTimer);
      el.classList.remove('is-show');
    }, { once: true });
  }

  // ---------------- tabs ----------------
  function setupTabs() {
    const tabLogin = $('tabLogin');
    const tabRegister = $('tabRegister');
    const panelLogin = $('panelLogin');
    const panelRegister = $('panelRegister');
    const pill = $('segPill');

    if (!tabLogin || !tabRegister || !panelLogin || !panelRegister || !pill) {
      console.warn('Tabs elements missing.');
      return;
    }

    function activate(which) {
      const isLogin = which === 'login';

      tabLogin.classList.toggle('is-active', isLogin);
      tabRegister.classList.toggle('is-active', !isLogin);
      tabLogin.setAttribute('aria-selected', isLogin ? 'true' : 'false');
      tabRegister.setAttribute('aria-selected', !isLogin ? 'true' : 'false');

      panelLogin.classList.toggle('is-active', isLogin);
      panelRegister.classList.toggle('is-active', !isLogin);

      pill.style.transform = isLogin ? 'translateX(0)' : 'translateX(100%)';
      document.title = isLogin ? 'Sport Stats • Вход' : 'Sport Stats • Регистрация';
    }

    tabLogin.addEventListener('click', () => activate('login'));
    tabRegister.addEventListener('click', () => activate('register'));

    activate('login');

    const params = new URLSearchParams(location.search);
    if (params.get('form') === 'signup') activate('register');
  }

  // ---------------- password toggles ----------------
  function setupPasswordToggles() {
    document.querySelectorAll('[data-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-toggle');
        const input = $(id);
        if (!input) return;

        const icon = btn.querySelector('i');
        const isPwd = input.type === 'password';
        input.type = isPwd ? 'text' : 'password';
        if (icon) icon.className = isPwd ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
      });
    });
  }

  // ---------------- populate years & clubs ----------------
  function populateYears() {
    const ddl = $('yearOfBirth');
    if (!ddl) return;

    const end = new Date().getFullYear();
    const start = 1924;

    ddl.innerHTML = `<option value="" selected disabled>Избери</option>`;
    for (let y = end; y >= start; y--) {
      const opt = document.createElement('option');
      opt.value = String(y);
      opt.textContent = String(y);
      ddl.appendChild(opt);
    }
  }

  async function fetchClubs() {
    const sel = $('club');
    if (!sel) return;

    try {
      const { res, data } = await fetchJSON(`${API_BASE}/api/Clubs`);
      if (!res.ok) throw new Error('Clubs fetch failed');

      sel.innerHTML = `<option value="" selected disabled>Избери</option>`;
      (data || []).forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id ?? c.Id;
        opt.textContent = c.name ?? c.Name;
        sel.appendChild(opt);
      });
    } catch (e) {
      console.error(e);
      toast('bad', 'Клубове', 'Не успях да заредя списъка с клубове.');
    }
  }

  // ---------------- validation ----------------
  function setInvalid(fieldEl, msg) {
    const wrap = fieldEl?.closest('.field');
    const err = wrap?.querySelector('.field__error');
    wrap?.classList.add('is-invalid');
    if (err) err.textContent = msg || 'Невалидно поле.';
  }

  function clearInvalid(fieldEl) {
    const wrap = fieldEl?.closest('.field');
    const err = wrap?.querySelector('.field__error');
    wrap?.classList.remove('is-invalid');
    if (err) err.textContent = '';
  }

  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|bg|org|net|info|edu|gov|biz|co\.uk)$/i;
  const passwordPattern = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/;
  const namePattern = /^[A-Za-zА-Яа-я]+$/;

  async function checkEmailExists(email) {
    const url = `${API_BASE}/api/Users/check-email?email=${encodeURIComponent(email)}`;
    try {
      const { res, data } = await fetchJSON(url);
      if (!res.ok) return false;
      return !!(data && (data.exists === true || data.emailExists === true));
    } catch {
      return false;
    }
  }

  // ---------------- session persist ----------------
  async function persistSession(payload) {
    // payload може да е:
    // - login: { session: {..UserSession..}, athleteDisplay }
    // - register: { user: {...}, userTokenHash: "..." }
    // - login-code: { session: {...}, athleteDisplay, mustSetCredentials }
    const sessionObj = payload?.session ?? payload?.Session ?? payload;

    const rawUser =
      payload?.user ?? payload?.User ??
      sessionObj?.user ?? sessionObj?.User ??
      sessionObj;

    const uiUser = normalizeUser(rawUser);
    const canonicalSession = normalizeSessionLikeBackend(rawUser);

    // token от backend (предпочитан)
    const serverToken = String(
      pick(payload, 'userTokenHash', 'UserTokenHash') ??
      pick(sessionObj, 'userTokenHash', 'UserTokenHash', 'token') ??
      ''
    ).trim();

    // local token със същия canonical payload като backend (fallback / verify)
    let localToken = '';
    try {
      if (canonicalSession) localToken = await generateUserTokenHashLikeBackend(canonicalSession);
    } catch (err) {
      console.warn('Local hash generation failed:', err);
    }

    const finalToken = serverToken || localToken;

    // ✅ пазим session винаги в PascalCase и с UserTokenHash
    let sessionToStore = sessionObj && typeof sessionObj === 'object'
      ? { ...sessionObj }
      : {};

    if (canonicalSession) {
      sessionToStore = {
        ...canonicalSession,
        ...sessionToStore, // ако има още полета, ги запази
        UserTokenHash: finalToken || canonicalSession.UserTokenHash || ''
      };
    } else if (finalToken) {
      sessionToStore.UserTokenHash = finalToken;
    }

    localStorage.setItem('session', JSON.stringify(sessionToStore || {}));

    if (payload?.athleteDisplay) {
      localStorage.setItem('athleteDisplay', payload.athleteDisplay);
    }

    if (finalToken) {
      localStorage.setItem('userHash', finalToken);
    }

    if (uiUser?.id) {
      const userToStore = {
        ...uiUser,
        userTokenHash: finalToken || uiUser.userTokenHash || ''
      };

      localStorage.setItem('user', JSON.stringify(userToStore));
      localStorage.setItem('userServer', JSON.stringify(toServerUser(userToStore)));
    }

    // optional debug: сравнение backend vs local
    if (serverToken && localToken && serverToken !== localToken) {
      console.warn('UserTokenHash mismatch (server vs local)', {
        serverToken,
        localToken,
        canonicalPayload: canonicalSession ? getCanonicalPayloadLikeBackend(canonicalSession) : null
      });
    }
  }

  // ---------------- login (email/pass) ----------------
  function setupLogin() {
    const form = $('login-form');
    const email = $('login-email');
    const pass = $('login-password');
    const btn = $('loginBtn');

    if (!form || !email || !pass) {
      console.error('Missing login elements', { form, email, pass, btn });
      return;
    }

    // ако бутонът е type="button", пак да работи:
    btn?.addEventListener('click', () => {
      if (typeof form.requestSubmit === 'function') form.requestSubmit();
      else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    });

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();

      clearInvalid(email);
      clearInvalid(pass);

      let ok = true;
      const eRaw = (email.value || '').trim();
      const p = (pass.value || '').trim();

      if (!emailPattern.test(eRaw)) { setInvalid(email, 'Невалиден имейл.'); ok = false; }
      if (!p) { setInvalid(pass, 'Въведи парола.'); ok = false; }
      if (!ok) return;

      const e = eRaw.toLowerCase();

      setLoading(btn, true);

      try {
        // ✅ PascalCase към ASP.NET model binder
        const body = { Email: e, Password: p };

        const { res, data } = await fetchJSON(`${API_BASE}/api/Users/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        if (!res.ok) {
          if (res.status === 401) throw new Error('Unauthorized');
          const msg = (typeof data === 'string' ? data : (data?.message || data?.error || 'Login failed'));
          throw new Error(msg);
        }

        // ✅ async, за да запише hash/session преди redirect
        await persistSession(data);

        toast('ok', 'Вход', 'Успешно влизане.');
        setTimeout(() => { location.href = HOME_HREF; }, 450);
      } catch (err) {
        console.error(err);
        const msg =
          String(err?.message || '').toLowerCase().includes('unauthorized')
            ? 'Грешен имейл или парола (или профилът няма парола/не е активиран).'
            : 'Входът не мина. Провери имейла/паролата и опитай пак.';
        toast('bad', 'Вход', msg);
      } finally {
        setLoading(btn, false);
      }
    });
  }

  // ---------------- login by code (access code OR swrid) ----------------
  function setupLoginByCode() {
    const input = $('login-code');
    const btn = $('loginCodeBtn');
    if (!input || !btn) return;

    async function run() {
      clearInvalid(input);

      const code = (input.value || '').trim();
      if (!code) { setInvalid(input, 'Въведи код.'); return; }

      setLoading(btn, true);

      // 1) access code endpoint
      try {
        const { res, data } = await fetchJSON(`${API_BASE}/api/Users/login-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ Code: code }) // ✅ PascalCase
        });

        if (res.ok) {
          await persistSession(data);
          toast('ok', 'Код', 'Успешен вход с код.');
          setTimeout(() => { location.href = HOME_HREF; }, 450);
          return;
        }
      } catch (e) {
        console.warn('login-code failed, trying swrid...', e);
      }

      // 2) swrid endpoint
      try {
        const { res, data } = await fetchJSON(`${API_BASE}/api/Users/login-swrid`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ Swrid: code }) // ✅ PascalCase
        });

        if (!res.ok) throw new Error('Invalid SWRID');

        await persistSession(data);
        toast('ok', 'SWRID', 'Успешен вход със SWRID.');
        setTimeout(() => { location.href = HOME_HREF; }, 450);
      } catch (err) {
        console.error(err);
        toast('bad', 'Код/SWRID', 'Невалиден код или профилът не е одобрен.');
      } finally {
        setLoading(btn, false);
      }
    }

    btn.addEventListener('click', run);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); run(); }
    });
  }

  // ---------------- registration ----------------
  function setupRegistration() {
    const form = $('registration-form');
    const btn = $('registerBtn');

    const firstName = $('firstName');
    const lastName = $('lastName');
    const yob = $('yearOfBirth');
    const gender = $('gender');
    const club = $('club');
    const email = $('email');
    const pass = $('password');
    const confirm = $('confirmPassword');

    if (!form || !btn || !firstName || !lastName || !yob || !gender || !club || !email || !pass || !confirm) {
      console.warn('Registration elements missing.');
      return;
    }

    let emailDebounce = null;

    email.addEventListener('input', () => {
      clearTimeout(emailDebounce);
      emailDebounce = setTimeout(async () => {
        clearInvalid(email);
        const e = (email.value || '').trim();
        if (!e) return;
        if (!emailPattern.test(e)) { setInvalid(email, 'Невалиден имейл.'); return; }
        const exists = await checkEmailExists(e.toLowerCase());
        if (exists) setInvalid(email, 'Този имейл вече е зает.');
      }, 400);
    });

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();

      [firstName, lastName, yob, gender, club, email, pass, confirm].forEach(clearInvalid);

      let ok = true;

      const fn = (firstName.value || '').trim();
      const ln = (lastName.value || '').trim();
      const y = (yob.value || '').trim();
      const g = (gender.value || '').trim();
      const c = (club.value || '').trim();
      const eRaw = (email.value || '').trim();
      const p = (pass.value || '');
      const cp = (confirm.value || '');

      if (!namePattern.test(fn)) { setInvalid(firstName, 'Само букви.'); ok = false; }
      if (!namePattern.test(ln)) { setInvalid(lastName, 'Само букви.'); ok = false; }
      if (!y) { setInvalid(yob, 'Избери година.'); ok = false; }
      if (!g) { setInvalid(gender, 'Избери пол.'); ok = false; }
      if (!c) { setInvalid(club, 'Избери клуб.'); ok = false; }

      if (!emailPattern.test(eRaw)) { setInvalid(email, 'Невалиден имейл.'); ok = false; }
      else {
        const exists = await checkEmailExists(eRaw.toLowerCase());
        if (exists) { setInvalid(email, 'Този имейл вече е зает.'); ok = false; }
      }

      if (!passwordPattern.test(p)) { setInvalid(pass, '8+ символа, 1 главна и 1 цифра.'); ok = false; }
      if (cp !== p) { setInvalid(confirm, 'Паролите не съвпадат.'); ok = false; }

      if (!ok) return;

      setLoading(btn, true);

      const payload = {
        FirstName: fn,
        LastName: ln,
        Email: eRaw.toLowerCase(),
        Password: p,
        Gender: g,
        RoleID: 1,
        ClubID: parseInt(c, 10),
        profileImage_url: `${API_BASE}/ProfilePictures/ProfilePhoto2.jpg`,
        YearOfBirth: parseInt(y, 10),
        StatusID: 1
      };

      try {
        const { res, data } = await fetchJSON(`${API_BASE}/api/Users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const msg = (typeof data === 'string' ? data : (data?.message || data?.error || 'Registration failed'));
          throw new Error(msg);
        }

        // data: { user, userTokenHash }
        await persistSession(data);

        toast('ok', 'Регистрация', 'Успешна регистрация.');
        setTimeout(() => { location.href = HOME_HREF; }, 650);
      } catch (err) {
        console.error(err);
        toast('bad', 'Регистрация', 'Възникна грешка при регистрацията.');
      } finally {
        setLoading(btn, false);
      }
    });
  }

  // ---------------- video bg slideshow ----------------
  function setupBgVideos() {
    const vidA = document.getElementById('bgVidA');
    const vidB = document.getElementById('bgVidB');
    if (!vidA || !vidB) return;

    const sources = [
      '6012392-uhd_3840_2160_25fps.mp4',
      '8685906-hd_1920_1080_30fps.mp4',
      '3125907-uhd_3840_2160_25fps.mp4',
      '6540493-uhd_2560_1440_25fps.mp4'
    ];

    if (!sources.length) return;

    let idx = 0;
    let active = vidA;
    let idle = vidB;

    const fadeMs = 1200;
    const triggerBeforeEndSec = Math.max(1.6, fadeMs / 1000 + 0.25);
    let switching = false;

    [vidA, vidB].forEach(v => {
      v.muted = true;
      v.playsInline = true;
      v.loop = false;
    });

    function setSource(videoEl, src) {
      videoEl.src = src;
      videoEl.load();
    }

    async function safePlay(videoEl) {
      try { await videoEl.play(); } catch { }
    }

    function swapRoles() {
      const tmp = active;
      active = idle;
      idle = tmp;
    }

    async function switchToNext() {
      if (switching) return;
      switching = true;

      idx = (idx + 1) % sources.length;

      setSource(idle, sources[idx]);
      idle.currentTime = 0;

      await safePlay(idle);

      idle.classList.add('is-active');
      active.classList.remove('is-active');

      setTimeout(() => {
        active.pause();
        active.removeAttribute('src');
        active.load();

        swapRoles();
        bindEndWatcher(active);
        switching = false;
      }, fadeMs + 90);
    }

    function bindEndWatcher(videoEl) {
      const onTime = () => {
        if (switching) return;
        const dur = videoEl.duration;
        if (!isFinite(dur) || dur <= 0) return;

        const remaining = dur - videoEl.currentTime;
        if (remaining <= triggerBeforeEndSec) {
          videoEl.removeEventListener('timeupdate', onTime);
          switchToNext();
        }
      };

      videoEl.addEventListener('timeupdate', onTime);
    }

    setSource(active, sources[idx]);
    active.classList.add('is-active');

    active.addEventListener('loadedmetadata', () => bindEndWatcher(active), { once: true });
    safePlay(active);

    active.addEventListener('error', () => switchToNext());
    idle.addEventListener('error', () => switchToNext());

    window.addEventListener('pointerdown', () => {
      safePlay(active);
    }, { once: true });
  }

  // ---------------- boot ----------------
  document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupPasswordToggles();
    populateYears();
    fetchClubs();

    setupLogin();
    setupLoginByCode();
    setupRegistration();

    setupBgVideos();
  });
})();