// ===================== Index.js (чист и работещ) =====================
(() => {
  const API_BASE = 'https://sportstatsapi.azurewebsites.net';
  const INDEX_HREF = 'Index.html';
  const HOME_HREF  = 'HomePage.html';

  // ---------- helpers ----------
  const byId = (id) => document.getElementById(id);
  const safeJSON = (s) => { try { return JSON.parse(s); } catch { return null; } };

  function showMessageBox(message, type) {
    const box = byId('message-box');
    const text = byId('message-text');
    if (!box || !text) return;
    text.textContent = message;
    box.className = 'message-box ' + type;
    box.style.display = 'block';
    setTimeout(() => { box.style.display = 'none'; }, 5000);
  }

  function createErrorElement(id) {
    const el = document.createElement('div');
    el.id = id;
    el.classList.add('error-message');
    el.style.display = 'none';
    return el;
  }
  function showError(errorEl, inputEl, msg) { errorEl.textContent = msg; errorEl.style.display = 'block'; inputEl.classList.add('error'); }
  function hideError(errorEl, inputEl) { errorEl.textContent = ''; errorEl.style.display = 'none'; inputEl.classList.remove('error'); }
  function validateField(input, errorEl, pattern, msg) {
    if (!pattern.test(input.value)) { showError(errorEl, input, msg); return false; }
    hideError(errorEl, input); return true;
  }

  // ---------- session & hash ----------
  async function computeServerHash(su) {
    // съвпада 1:1 със сървъра
    const s = `${su.FirstName}${su.LastName}${su.Email}${su.Gender}${su.RoleID}${su.ClubID}${su.profileImage_url}${su.Id}${su.YearOfBirth}${su.StatusID}`;
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  }

  function toUIUser(su) {
    return {
      id: su.Id,
      firstName: su.FirstName,
      lastName: su.LastName,
      email: su.Email,
      gender: su.Gender,
      roleID: su.RoleID,
      clubID: su.ClubID,
      profileImage_url: su.profileImage_url,
      yearOfBirth: su.YearOfBirth,
      statusID: su.StatusID,
      userTokenHash: su.UserTokenHash
    };
  }

  async function persistSessionFromServer(serverUser) {
    // пазим оригинала (PascalCase) за хеш-верификация
    localStorage.setItem('userServer', JSON.stringify(serverUser));
    // пазим camelCase за UI
    localStorage.setItem('user', JSON.stringify(toUIUser(serverUser)));
    // userHash – от сървъра ако го има, иначе смятаме локално
    if (serverUser.UserTokenHash) {
      localStorage.setItem('userHash', serverUser.UserTokenHash);
    } else {
      const h = await computeServerHash(serverUser);
      localStorage.setItem('userHash', h);
    }
  }

  async function verifySessionOrRedirect() {
    // DEV: ако отваряш file:/// — пропусни проверката (няма общ origin с http)
    if (location.protocol === 'file:') return;

    const raw = localStorage.getItem('userServer');
    const saved = localStorage.getItem('userHash');
    if (!raw || !saved) return; // няма сесия → стоим на Index

    try {
      const su = JSON.parse(raw);
      const curr = await computeServerHash(su);
      if (curr !== saved) {
        alert('Не бъди злонамерен <3');
        localStorage.clear();
        window.location.href = INDEX_HREF;
        return;
      }
      // валидна сесия → кратко приветствие и към Home
      const ui = safeJSON(localStorage.getItem('user'));
      if (ui) {
        showMessageBox(`Здравей, ${ui.firstName}!`, 'success');
        setTimeout(() => { window.location.href = HOME_HREF; }, 800);
      }
    } catch (e) {
      console.error('Хеш грешка:', e);
      alert('Възникна грешка. Пренасочване...');
      localStorage.clear();
      window.location.href = INDEX_HREF;
    }
  }

  // ---------- data / api ----------
  async function checkEmailAvailability(email) {
    // приемаме { exists: boolean } или { emailExists: boolean } – поддържаме и двата формата
    const url = `${API_BASE}/api/Users/check-email?email=${encodeURIComponent(email)}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return false;
      const data = await res.json();
      return !!(data && (data.exists === true || data.emailExists === true));
    } catch {
      return false;
    }
  }

  async function fetchClubs() {
    try {
      const res = await fetch(`${API_BASE}/api/Clubs`);
      if (!res.ok) throw new Error(res.statusText);
      const clubs = await res.json();
      const sel = byId('club'); if (!sel) return;
      sel.innerHTML = '<option value="" disabled selected></option>';
      clubs.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        sel.appendChild(opt);
      });
    } catch (e) {
      console.error('Грешка при извличане на клубове:', e);
    }
  }

  // ---------- UI wiring ----------
  function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    document.querySelector('.tab-button[data-tab="login"]')?.classList.add('active');
    byId('login-form')?.classList.add('active');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        const tabContent = byId(`${tabId}-form`);
        if (!tabContent) return;
        tabButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        tabContent.classList.add('active');
      });
    });

    // ?form=signup → отваряме регистрацията
    const params = new URLSearchParams(window.location.search);
    if (params.get('form') === 'signup') {
      document.querySelector('[data-tab="registration"]')?.click();
    }
  }

  function populateYears() {
    const ddl = byId('yearOfBirth');
    if (!ddl) return;
    const start = 1924, end = new Date().getFullYear();
    ddl.innerHTML = '<option value="" disabled selected></option>';
    for (let y = start; y <= end; y++) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      ddl.appendChild(opt);
    }
  }

  function setupSelect2() {
    if (window.$ && $.fn && $.fn.select2) {
      $('#yearOfBirth, #gender, #club').select2({ placeholder: '', allowClear: true });
    }
  }

  function setupInputHints(input, hintId) {
    if (!input) return;
    input.addEventListener('focus', () => { const h = byId(hintId); if (h) h.style.display = 'block'; });
    input.addEventListener('blur',  () => { const h = byId(hintId); if (h) h.style.display = 'none'; });
  }

  function setupFloatingLabels() {
    document.querySelectorAll('.form-group input, .form-group select').forEach(input => {
      const label = input.nextElementSibling; if (!label) return;
      input.addEventListener('focus', () => label.classList.add('hidden-label'));
      input.addEventListener('blur',  () => { if (!input.value) label.classList.remove('hidden-label'); });
    });
  }

  // ---------- Registration ----------
  function setupRegistration() {
    const form = byId('registration-form');
    if (!form) return;

    const emailInput = byId('email');
    const passwordInput = byId('password');
    const firstNameInput = byId('firstName');
    const lastNameInput = byId('lastName');
    const genderInput = byId('gender');
    const clubInput = byId('club');

    const emailError = createErrorElement('email-error');
    const passwordError = createErrorElement('password-error');
    const firstNameError = createErrorElement('first-name-error');
    const lastNameError = createErrorElement('last-name-error');
    const genderError = createErrorElement('gender-error');
    const clubError = createErrorElement('club-error');

    emailInput?.parentNode?.insertBefore(emailError, emailInput.nextSibling);
    passwordInput?.parentNode?.insertBefore(passwordError, passwordInput.nextSibling);
    firstNameInput?.parentNode?.insertBefore(firstNameError, firstNameInput.nextSibling);
    lastNameInput?.parentNode?.insertBefore(lastNameError, lastNameInput.nextSibling);
    genderInput?.parentNode?.insertBefore(genderError, genderInput.nextSibling);
    clubInput?.parentNode?.insertBefore(clubError, clubInput.nextSibling);

    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|bg|org|net|info|edu|gov|biz|co\.uk)$/i;
    const passwordPattern = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/;
    const namePattern = /^[A-Za-zА-Яа-я]+$/;

    let emailTimeout;
    emailInput?.addEventListener('input', () => {
      clearTimeout(emailTimeout);
      emailTimeout = setTimeout(async () => {
        try {
          if (!emailPattern.test(emailInput.value)) { showError(emailError, emailInput, 'Моля, въведете валиден имейл адрес.'); return; }
          const exists = await checkEmailAvailability(emailInput.value);
          if (exists) showError(emailError, emailInput, 'Имейлът вече е зает. Опитайте с друг.');
          else hideError(emailError, emailInput);
        } catch (e) { console.error(e); }
      }, 500);
    });

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      let ok = true;

      ok = validateField(passwordInput, passwordError, passwordPattern, 'Паролата трябва да съдържа поне 8 символа, една главна буква и цифра.') && ok;
      ok = validateField(firstNameInput, firstNameError, namePattern, 'Трябва да съдържа само букви.') && ok;
      ok = validateField(lastNameInput, lastNameError, namePattern, 'Трябва да съдържа само букви.') && ok;

      if (!emailPattern.test(emailInput.value)) { showError(emailError, emailInput, 'Моля, въведете валиден имейл адрес.'); ok = false; }
      else {
        try {
          const exists = await checkEmailAvailability(emailInput.value);
          if (exists) { showError(emailError, emailInput, 'Този имейл вече е регистриран.'); ok = false; }
          else hideError(emailError, emailInput);
        } catch { showError(emailError, emailInput, 'Грешка при проверка на имейла.'); ok = false; }
      }

      if (!genderInput.value) { showError(genderError, genderInput, 'Моля, изберете пол.'); ok = false; } else hideError(genderError, genderInput);
      if (!clubInput.value)   { showError(clubError, clubInput,   'Моля, изберете отбор.'); ok = false; } else hideError(clubError, clubInput);
      if (!ok) return;

      const fd = new FormData(form);
      const payload = {
        firstName: fd.get('firstName'),
        lastName: fd.get('lastName'),
        email: fd.get('email'),
        password: fd.get('password'),
        gender: fd.get('gender'),
        roleID: 1,
        clubID: parseInt(fd.get('club'), 10),
        profileImage_url: `${API_BASE}/ProfilePictures/ProfilePhoto2.jpg`,
        yearOfBirth: parseInt(fd.get('yearOfBirth'), 10),
        statusID: 1
      };

      try {
        const res = await fetch(`${API_BASE}/api/Users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Грешка при изпращане: ' + res.statusText);

        // съвместимост с два формата: (A) UserSession (PascalCase) или (B) { user, userTokenHash }
        const raw = await res.json();
        const serverUser =
          (raw && raw.UserTokenHash !== undefined) ? raw :
          (raw && raw.user && raw.userTokenHash) ? { ...raw.user, UserTokenHash: raw.userTokenHash } :
          null;

        if (!serverUser) throw new Error('Неочакван формат на отговора при регистрация.');

        await persistSessionFromServer(serverUser);

        // изпращаме заявка за одобрение без да блокираме UX
        try {
          await fetch(`${API_BASE}/api/approvalRequests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: serverUser.Id, clubId: serverUser.ClubID, status: 'pending' })
          });
        } catch (e) { console.warn('Approval request failed:', e); }

        showMessageBox('Потребителят е регистриран успешно!', 'success');
        form.reset();
        setTimeout(() => { window.location.href = HOME_HREF; }, 800);
      } catch (e) {
        console.error(e);
        showMessageBox('Възникна грешка при регистрацията.', 'error');
      }
    });
  }

  // ---------- Login ----------
  function setupLogin() {
    const form = byId('login-form');
    if (!form) return;

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const payload = { email: fd.get('login-email'), password: fd.get('login-password') };

      try {
        const res = await fetch(`${API_BASE}/api/Users/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          let err = '';
          try { err = JSON.stringify(await res.json()); } catch {}
          throw new Error('Грешка при влизането: ' + (err || res.statusText));
        }

        const serverUser = await res.json(); // PascalCase + UserTokenHash
        await persistSessionFromServer(serverUser);

        const uiUser = safeJSON(localStorage.getItem('user'));
        showMessageBox(`Входът е успешен! Добре дошъл, ${uiUser?.firstName || 'потребителю'}!`, 'success');
        setTimeout(() => { window.location.href = HOME_HREF; }, 800);
      } catch (e) {
        console.error('Грешка при влизането:', e);
        showMessageBox('Възникна грешка при влизането. Моля, проверете имейла и паролата и опитайте отново.', 'error');
      }
    });
  }

  // ---------- boot ----------
  document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    populateYears();
    setupSelect2();
    fetchClubs();
    setupRegistration();
    setupLogin();

    setupInputHints(byId('email'), 'email-hint');
    setupInputHints(byId('password'), 'password-hint');
    setupFloatingLabels();

    // ако вече има сесия → верифицирай и редирект
    verifySessionOrRedirect();
  });
})();
