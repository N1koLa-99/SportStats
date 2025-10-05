// === НАСТРОЙКИ ===
const API_BASE = 'https://sportstatsapi.azurewebsites.net'; // смени при нужда
const POLL_MS = 3000;
const AVATAR_FALLBACK = 'https://sportstats.blob.core.windows.net/$web/ProfilePhoto2.jpg';
const SOFIA_TZ = 'Europe/Sofia';

// === ПРЕНАСОЧВАНЕ / УТИЛИТИ ===
function redirectToIndex(msg) {
  try { alert(msg); } catch {}
  window.location.replace('index.html');
}

// Хеш на потребителските данни (трябва да съвпада с начина, по който е записан savedHash)
async function hashUserData(user) {
  const data = `${user.firstName}${user.lastName}${user.email}${user.gender}${user.roleID}${user.clubID}${user.profileImage_url}${user.id}${user.yearOfBirth}${user.statusID}`;
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  // 32 байта -> безопасно за btoa
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

// === РАННА АУТЕНТИКАЦИЯ И СТАРТ ===
(async function authAndStart() {
  const userJson = localStorage.getItem('user');
  const savedHash = localStorage.getItem('userHash');

  if (!userJson || !savedHash) {
    redirectToIndex("Невалидни данни. Пренасочване към началната страница.");
    return;
  }

  let user;
  try {
    user = JSON.parse(userJson);
  } catch {
    redirectToIndex("Повредени данни за профил. Пренасочване...");
    return;
  }

  try {
    const currentHash = await hashUserData(user);
    if (currentHash !== savedHash) {
      redirectToIndex("Не бъди злонамерен <3");
      return;
    }
  } catch (error) {
    console.error("Грешка при хеширането:", error);
    redirectToIndex("Възникна грешка. Пренасочване...");
    return;
  }

  // Хешът е валиден — стартираме приложението
  startApp(user);
})();

// === ОСНОВНО ПРИЛОЖЕНИЕ (стартира само след валиден хеш) ===
function startApp(user) {
  // userId и teamId
  const userId = Number(user.id);
  const teamId = Number(user.clubID);
  localStorage.setItem('teamId', String(teamId));
  localStorage.setItem('userId', String(userId));

  // UI refs
  document.getElementById('meta-user').textContent = `Потребител: ${user.firstName} ${user.lastName}`;
  fetch(`https://sportstatsapi.azurewebsites.net/api/Clubs/${user.clubID}`)
    .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.json(); })
    .then(club => { document.getElementById('meta-team').textContent = `Отбор: ${club.name || 'Няма данни'}`; })
    .catch(err => {
      console.error('Грешка при извличане на информация за клуба:', err);
      document.getElementById('meta-team').textContent = 'Грешка при зареждане на клуба';
    });

  const $messages   = document.getElementById('messages');
  const $text       = document.getElementById('text');
  const $send       = document.getElementById('send');
  const $err        = document.getElementById('err');
  const $jumpNew    = document.getElementById('jump-new');
  const $menu       = document.getElementById('msg-menu');
  const $menuSender = document.getElementById('menu-sender');
  const $menuTime   = document.getElementById('menu-time');
  const $menuDelete = document.getElementById('menu-delete');
  const $menuClose  = document.getElementById('menu-close');

  const $btnAttach  = document.getElementById('btn-attach');
  const $fileInput  = document.getElementById('files');
  const $attBar     = document.getElementById('att-bar');
  const $drop       = document.getElementById('drop');

  // Държим селектираните файлове тук
  let selectedFiles = [];

  // helpers
  function api(path) { return API_BASE + path; }

  // >>> ВАЖНО: показваме време в Europe/Sofia <<<
  function fmtDate(d) {
    const date = new Date(d);
    return isNaN(date.getTime()) ? '' : date.toLocaleString('bg-BG', {
      timeZone: SOFIA_TZ,
      hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  }
  function fmtTimeChip(d) {
    const date = new Date(d);
    return isNaN(date.getTime()) ? '' : date.toLocaleTimeString('bg-BG', {
      timeZone: SOFIA_TZ,
      hour12: false,
      hour: '2-digit', minute: '2-digit'
    });
  }

  function escapeHTML(s) {
    const div = document.createElement('div');
    div.textContent = s ?? '';
    return div.innerHTML;
  }
  function showError(msg) {
    $err.style.display = 'block';
    $err.textContent = msg;
    clearTimeout(showError._t);
    $err._t = setTimeout(() => ($err.style.display = 'none'), 5000);
  }
  function bytesToSize(b) {
    if (b === 0) return '0 B';
    if (!b && b !== 0) return '';
    const u = ['B','KB','MB','GB','TB'];
    const i = Math.floor(Math.log(b) / Math.log(1024));
    return (b / Math.pow(1024, i)).toFixed(i ? 1 : 0) + ' ' + u[i];
  }
  function fileBadge(file) {
    if (file.type?.startsWith('image/')) return 'IMG';
    const ext = (file.name.split('.').pop() || '').toUpperCase();
    if (ext) return ext.length > 5 ? 'FILE' : ext;
    return 'FILE';
  }

  // Аватари с кеш
  const avatarCache = new Map(); // id -> objectURL
  async function getAvatarUrl(uid) {
    if (avatarCache.has(uid)) return avatarCache.get(uid);
    try {
      const res = await fetch(`https://sportstatsapi.azurewebsites.net/api/Users/profilePicture/${uid}`);
      if (!res.ok) throw new Error('no avatar');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      avatarCache.set(uid, url);
      return url;
    } catch {
      avatarCache.set(uid, AVATAR_FALLBACK);
      return AVATAR_FALLBACK;
    }
  }

  // === ИМЕНА: кеш + резолвър по senderId ===
  const nameCache = new Map(); // id -> "Име Фамилия"
  async function getUserName(uid) {
    if (uid === userId) {
      const myName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
      if (myName) return myName;
    }
    if (nameCache.has(uid)) return nameCache.get(uid);
    try {
      // Смени с твоя реален endpoint, ако е различен
      const res = await fetch(api(`/api/Users/${uid}`));
      if (!res.ok) throw new Error('no user');
      const u = await res.json();
      const first = u.firstName ?? u.FirstName ?? '';
      const last  = u.lastName  ?? u.LastName  ?? '';
      const full = `${first} ${last}`.trim() || `Потребител #${uid}`;
      nameCache.set(uid, full);
      return full;
    } catch {
      const fallback = `Потребител #${uid}`;
      nameCache.set(uid, fallback);
      return fallback;
    }
  }

  // Скрол/пауза
  let isNearBottom = true;
  let userActiveUntil = 0;

  function calcIsNearBottom() {
    const delta = $messages.scrollHeight - $messages.scrollTop - $messages.clientHeight;
    return delta < 48;
  }
  function preserveScrollDuring(updateFn) {
    const fromBottom = $messages.scrollHeight - $messages.scrollTop;
    updateFn();
    if (isNearBottom) $messages.scrollTop = $messages.scrollHeight;
    else $messages.scrollTop = $messages.scrollHeight - fromBottom;
  }

  // Времеви разделители
  function shouldInsertTimeSep(prevISO, curISO) {
    if (!prevISO) return true;
    const a = new Date(prevISO);
    const b = new Date(curISO);
    if (isNaN(a) || isNaN(b)) return false;
    const diffMin = Math.abs((b - a) / 60000);
    return diffMin >= 10 || a.toDateString() !== b.toDateString();
  }

  // ===== Прикачване – поддръжка =====
  const ALLOWED = new Set(["image/jpeg","image/png","image/webp","image/gif","application/pdf"]);
  const MAX_FILE = 10 * 1024 * 1024; // 10MB

  function syncFileInputFromSelected() {
    const dt = new DataTransfer();
    selectedFiles.forEach(f => dt.items.add(f));
    $fileInput.files = dt.files;
  }

  function toggleSendDisabled() {
    $send.disabled = !$text.value.trim() && selectedFiles.length === 0;
  }

  function renderSelectedFiles() {
    $attBar.innerHTML = '';
    if (selectedFiles.length === 0) {
      $attBar.classList.remove('show');
    } else {
      $attBar.classList.add('show');
    }

    selectedFiles.forEach((f, idx) => {
      const chip = document.createElement('div');
      chip.className = 'att-chip';

      if (f.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.alt = f.name;
        img.src = URL.createObjectURL(f);
        img.onload = () => URL.revokeObjectURL(img.src);
        chip.appendChild(img);
      } else {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = fileBadge(f);
        chip.appendChild(badge);
      }

      const name = document.createElement('span');
      name.className = 'name';
      name.title = f.name;
      name.textContent = f.name;
      chip.appendChild(name);

      const size = document.createElement('span');
      size.className = 'size';
      size.textContent = ' · ' + bytesToSize(f.size);
      chip.appendChild(size);

      const rm = document.createElement('button');
      rm.className = 'rm';
      rm.type = 'button';
      rm.title = 'Премахни';
      rm.textContent = '×';
      rm.addEventListener('click', () => {
        selectedFiles.splice(idx, 1);
        syncFileInputFromSelected();
        renderSelectedFiles();
        toggleSendDisabled();
      });
      chip.appendChild(rm);

      $attBar.appendChild(chip);
    });
  }

  function addFiles(files) {
    let added = 0;
    for (const f of files) {
      if (!ALLOWED.has(f.type || '')) { showError(`Неподдържан тип: ${f.name}`); continue; }
      if (f.size > MAX_FILE) { showError(`Твърде голям файл (>10MB): ${f.name}`); continue; }
      selectedFiles.push(f);
      added++;
    }
    if (added > 0) {
      syncFileInputFromSelected();
      renderSelectedFiles();
      toggleSendDisabled();
    }
  }

  // UI: „Прикачи“
  $btnAttach.addEventListener('click', () => $fileInput.click());
  $fileInput.addEventListener('change', (e) => addFiles(e.target.files));

  // Drag & Drop
  ['dragenter','dragover'].forEach(ev =>
    document.addEventListener(ev, (e) => {
      e.preventDefault(); e.stopPropagation();
      $drop.classList.add('active');
    })
  );
  ['dragleave','drop'].forEach(ev =>
    document.addEventListener(ev, (e) => {
      e.preventDefault(); e.stopPropagation();
      if (ev === 'dragleave') $drop.classList.remove('active');
    })
  );
  $drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    $drop.classList.add('drag');
  });
  $drop.addEventListener('dragleave', () => $drop.classList.remove('drag'));
  $drop.addEventListener('drop', (e) => {
    $drop.classList.remove('drag');
    $drop.classList.remove('active');
    const dt = e.dataTransfer;
    if (dt && dt.files) addFiles(dt.files);
  });

  // ===== Рендериране на съобщения с прикачени =====
  function renderAttachments(list, container) {
    if (!Array.isArray(list) || list.length === 0) return;
    const wrap = document.createElement('div');
    wrap.className = 'att-list';

    for (const a of list) {
      const url = a.fileUrl ?? a.FileUrl;
      const type = (a.fileType ?? a.FileType ?? '').toString();

      if (!url) continue;

      if (type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'прикачено изображение';
        img.loading = 'lazy';
        img.addEventListener('click', () => window.open(url, '_blank', 'noopener'));
        wrap.appendChild(img);
      } else if (type === 'application/pdf') {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = 'PDF файл';
        wrap.appendChild(link);
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = 'Прикачен файл';
        wrap.appendChild(link);
      }
    }

    container.appendChild(wrap);
  }

  async function renderMessages(list) {
    const frag = document.createDocumentFragment();
    let prevTime = null;

    for (const m of list) {
      const id = m.id ?? m.Id;
      const sender = Number(m.senderId ?? m.SenderId);
      const mine = sender === userId;
      const created = m.createdAt ?? m.CreatedAt;
      const content = (m.content ?? m.Content) || '';

      const first = m.senderFirstName ?? m.SenderFirstName ?? m.firstName ?? m.FirstName;
      const last  = m.senderLastName  ?? m.SenderLastName  ?? m.lastName  ?? m.LastName;
      const apiName = [first, last].filter(Boolean).join(' ').trim();
      const myName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();

      if (shouldInsertTimeSep(prevTime, created)) {
        const sep = document.createElement('div');
        sep.className = 'time-sep';
        sep.textContent = fmtTimeChip(created); // HH:mm в Europe/Sofia
        frag.appendChild(sep);
      }
      prevTime = created;

      const row = document.createElement('div');
      row.className = 'msg' + (mine ? ' mine' : '');
      row.dataset.msgId = id ?? '';
      row.dataset.senderId = String(sender);
      row.dataset.createdAt = created;
      row.dataset.senderName = mine ? (myName || 'Аз') : (apiName || '');

      const img = document.createElement('img');
      img.className = 'avatar';
      img.alt = 'Аватар';
      // eslint-disable-next-line no-await-in-loop
      img.src = await getAvatarUrl(sender);

      const bubble = document.createElement('div');
      bubble.className = 'bubble';

      if (content) {
        const body = document.createElement('div');
        body.className = 'body';
        body.innerHTML = escapeHTML(content);
        bubble.appendChild(body);
      }

      const atts = m.attachments ?? m.Attachments ?? [];
      if (atts.length) renderAttachments(atts, bubble);

      row.appendChild(img);
      row.appendChild(bubble);

      bubble.addEventListener('click', (ev) => openMsgMenu(ev, row));

      frag.appendChild(row);
    }

    preserveScrollDuring(() => {
      $messages.replaceChildren(frag);
    });

    if ($jumpNew) $jumpNew.hidden = isNearBottom;
  }

  // ===== Зареждане =====
  async function loadMessages() {
    if (Date.now() < userActiveUntil && !isNearBottom) return;
    try {
      const res = await fetch(api(`/api/messages/${teamId}`), { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      await renderMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Грешка при зареждане:", err);
      showError("Проблем при зареждане на съобщения.");
    }
  }

  // ===== Изпращане (текст + файлове, multipart/form-data) =====
  async function sendMessage() {
    const content = $text.value.trim();
    if (!content && selectedFiles.length === 0) { $text.focus(); return; }

    $send.disabled = true;
    try {
      const fd = new FormData();
      fd.append('TeamId', String(teamId));
      fd.append('SenderId', String(userId)); // в прод – бекенд да взема от JWT
      if (content) fd.append('Content', content);
      for (const f of selectedFiles) fd.append('Files', f);

      const res = await fetch(api('/api/messages/send'), {
        method: 'POST',
        body: fd
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

      // успех – чистим
      isNearBottom = true;
      $text.value = '';
      selectedFiles = [];
      syncFileInputFromSelected();
      renderSelectedFiles();
      $text.focus();
      toggleSendDisabled();

      await loadMessages();
    } catch (err) {
      console.error("Грешка при изпращане:", err);
      showError("Неуспешно изпращане: " + err.message);
    } finally {
      $send.disabled = false;
    }
  }

  // ===== Контекстно меню / изтриване =====
  let menuForMsg = null;

  function openMsgMenu(ev, msgRow) {
    menuForMsg = msgRow;
    const sid = Number(msgRow.dataset.senderId);
    const createdAt = msgRow.dataset.createdAt;
    const mine = sid === userId;

    const cachedName = msgRow.dataset.senderName;
    const myName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();

    $menuSender.textContent = mine
      ? (myName || 'Аз')
      : (cachedName || `Потребител #${sid}`);

    if (!mine && !cachedName) {
      getUserName(sid).then(name => {
        msgRow.dataset.senderName = name;
        if (menuForMsg === msgRow) $menuSender.textContent = name;
      });
    }

    $menuTime.textContent = fmtDate(createdAt); // дата+час в Europe/Sofia

    if (mine) { $menuDelete.removeAttribute('disabled'); $menuDelete.style.display = ''; }
    else { $menuDelete.setAttribute('disabled', 'true'); $menuDelete.style.display = 'none'; }

    const chatRect = document.getElementById('chat').getBoundingClientRect();
    const x = Math.min(ev.clientX - chatRect.left + 8, chatRect.width - 240);
    const y = Math.min(ev.clientY - chatRect.top + 8, chatRect.height - 140);

    $menu.style.left = x + 'px';
    $menu.style.top = y + 'px';
    $menu.hidden = false;
  }
  function closeMsgMenu() { $menu.hidden = true; menuForMsg = null; }

  async function deleteCurrentMessage() {
    if (!menuForMsg) return;
    const id = menuForMsg.dataset.msgId;
    if (!id) { showError('Липсва идентификатор на съобщението.'); return; }

    try {
      const url = api(`/api/messages/${id}/user/${userId}`);
      const res = await fetch(url, { method: 'DELETE' });
      const text = await res.text().catch(() => '');

      if (res.ok) { closeMsgMenu(); await loadMessages(); return; }
      if (res.status === 403) { showError(text || 'Нямате право да изтриете това съобщение.'); return; }
      showError(`Неуспешно изтриване (HTTP ${res.status}) ${text ? '— ' + text : ''}`);
    } catch (err) {
      console.error('Грешка при изтриване:', err);
      showError('Неуспешно изтриване: ' + err.message);
    }
  }

  // Слушатели
  $send.addEventListener('click', sendMessage);
  $text.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  $text.addEventListener('input', () => { toggleSendDisabled(); });

  $messages.addEventListener('scroll', () => {
    isNearBottom = calcIsNearBottom();
    userActiveUntil = Date.now() + 2000;
    if ($jumpNew) $jumpNew.hidden = isNearBottom;
  });
  if ($jumpNew) {
    $jumpNew.addEventListener('click', () => {
      $messages.scrollTop = $messages.scrollHeight;
      isNearBottom = true;
      $jumpNew.hidden = true;
    });
  }

  $menuDelete.addEventListener('click', deleteCurrentMessage);
  $menuClose.addEventListener('click', closeMsgMenu);
  document.addEventListener('click', (e) => {
    if ($menu.hidden) return;
    const clickedInsideMenu = $menu.contains(e.target);
    const clickedBubble = e.target.closest?.('.bubble');
    if (!clickedInsideMenu && !clickedBubble) closeMsgMenu();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) userActiveUntil = Date.now() + 10000;
  });

  // Старт
  (async function init() {
    try {
      $text.focus();
      toggleSendDisabled();
      isNearBottom = true;
      await loadMessages();
      setInterval(loadMessages, POLL_MS);
    } catch (e) {
      console.error(e);
    }
  })();
}
