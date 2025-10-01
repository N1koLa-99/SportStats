// === НАСТРОЙКИ ===
const API_BASE = 'https://localhost:7198';
const POLL_MS = 3000;
const AVATAR_FALLBACK = 'https://sportstats.blob.core.windows.net/$web/ProfilePhoto2.jpg';

// Четем потребителя от localStorage
const userJson = localStorage.getItem('user');
const savedHash = localStorage.getItem('userHash');

if (!userJson || !savedHash) {
  redirectToIndex("Невалидни данни. Пренасочване към началната страница.");
  throw new Error("Missing user or hash in localStorage");
}

const user = JSON.parse(userJson);

// userId и teamId
const userId = user.id;
const teamId = user.clubID;

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

const $messages = document.getElementById('messages');
const $text = document.getElementById('text');
const $send = document.getElementById('send');
const $err = document.getElementById('err');
const $jumpNew = document.getElementById('jump-new');
const $menu = document.getElementById('msg-menu');
const $menuSender = document.getElementById('menu-sender');
const $menuTime = document.getElementById('menu-time');
const $menuDelete = document.getElementById('menu-delete');
const $menuClose = document.getElementById('menu-close');

function api(path) { return API_BASE + path; }
function fmtDate(d) {
  const date = new Date(d);
  return isNaN(date.getTime()) ? '' : date.toLocaleString();
}
function fmtTimeChip(d) {
  const date = new Date(d);
  return isNaN(date.getTime()) ? '' :
    date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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
  showError._t = setTimeout(() => ($err.style.display = 'none'), 5000);
}

/* --- Аватари с кеш --- */
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

/* --- Управление на скрол/пауза --- */
let isNearBottom = true;
let userActiveUntil = 0;

function calcIsNearBottom() {
  const delta = $messages.scrollHeight - $messages.scrollTop - $messages.clientHeight;
  return delta < 48;
}

function preserveScrollDuring(updateFn) {
  const fromBottom = $messages.scrollHeight - $messages.scrollTop;
  updateFn();
  if (isNearBottom) {
    $messages.scrollTop = $messages.scrollHeight;
  } else {
    $messages.scrollTop = $messages.scrollHeight - fromBottom;
  }
}

/* --- Времеви разделители (на всеки ≥10 мин или нов ден) --- */
function shouldInsertTimeSep(prevISO, curISO) {
  if (!prevISO) return true;
  const a = new Date(prevISO);
  const b = new Date(curISO);
  if (isNaN(a) || isNaN(b)) return false;
  const diffMin = Math.abs((b - a) / 60000);
  return diffMin >= 10 || a.toDateString() !== b.toDateString();
}

/* --- Рендериране на съобщения (нов markup с avatar + bubble) --- */
async function renderMessages(list) {
  // Ще пълним фрагмент асинхронно заради аватарите
  const frag = document.createDocumentFragment();
  let prevTime = null;

  for (const m of list) {
    const id = m.id ?? m.Id;
    const sender = Number(m.senderId ?? m.SenderId);
    const mine = sender === userId;
    const created = m.createdAt ?? m.CreatedAt;
    const content = (m.content ?? m.Content) || '';

    // Времеви чип
    if (shouldInsertTimeSep(prevTime, created)) {
      const sep = document.createElement('div');
      sep.className = 'time-sep';
      sep.textContent = fmtTimeChip(created);
      frag.appendChild(sep);
    }
    prevTime = created;

    // Ред на съобщението
    const row = document.createElement('div');
    row.className = 'msg' + (mine ? ' mine' : '');
    row.dataset.msgId = id ?? '';                 // за менюто/изтриването
    row.dataset.senderId = String(sender);
    row.dataset.createdAt = created;

    // Аватар
    const img = document.createElement('img');
    img.className = 'avatar';
    img.alt = 'Аватар';
    // await avatar
    // eslint-disable-next-line no-await-in-loop
    img.src = await getAvatarUrl(sender);

    // Балонче (само текст)
    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    const body = document.createElement('div');
    body.className = 'body';
    body.innerHTML = escapeHTML(content);

    bubble.appendChild(body);
    row.appendChild(img);
    row.appendChild(bubble);

    // Клик за меню
    bubble.addEventListener('click', (ev) => openMsgMenu(ev, row));

    frag.appendChild(row);
  }

  preserveScrollDuring(() => {
    $messages.replaceChildren(frag);
  });

  if ($jumpNew) $jumpNew.hidden = isNearBottom;
}

/* --- Зареждане на съобщения --- */
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

/* --- Изпращане на съобщение --- */
async function sendMessage() {
  const content = $text.value.trim();
  if (!content) { $text.focus(); return; }

  $send.disabled = true;
  try {
    const body = { TeamId: teamId, SenderId: userId, Content: content };
    const res = await fetch(api('/api/messages'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

    // след изпращане – скрол долу и презареждане
    isNearBottom = true;
    $text.value = '';
    $text.focus();
    await loadMessages();
  } catch (err) {
    console.error("Грешка при изпращане:", err);
    showError("Неуспешно изпращане: " + err.message);
  } finally {
    $send.disabled = false;
  }
}

/* --- Контекстно меню --- */
let menuForMsg = null; // реф към елемента .msg, за който е менюто

function openMsgMenu(ev, msgRow) {
  menuForMsg = msgRow;

  // Попълваме текстовете
  const sid = Number(msgRow.dataset.senderId);
  const createdAt = msgRow.dataset.createdAt;
  const mine = sid === userId;

  $menuSender.textContent = mine ? 'Аз' : `Потребител #${sid}`;
  $menuTime.textContent = fmtDate(createdAt);

  // Показваме/скриваме бутона Изтрий (само за мои)
  if (mine) {
    $menuDelete.removeAttribute('disabled');
    $menuDelete.style.display = '';
  } else {
    $menuDelete.setAttribute('disabled', 'true');
    $menuDelete.style.display = 'none';
  }

  // Позициониране около клика (в границите на #chat)
  const chatRect = document.getElementById('chat').getBoundingClientRect();
  const x = Math.min(ev.clientX - chatRect.left + 8, chatRect.width - 240);
  const y = Math.min(ev.clientY - chatRect.top + 8, chatRect.height - 140);

  $menu.style.left = x + 'px';
  $menu.style.top = y + 'px';
  $menu.hidden = false;
}

function closeMsgMenu() {
  $menu.hidden = true;
  menuForMsg = null;
}

async function deleteCurrentMessage() {
  if (!menuForMsg) return;

  const id = menuForMsg.dataset.msgId;        // идва от row.dataset.msgId в renderMessages
  if (!id) { showError('Липсва идентификатор на съобщението.'); return; }

  try {
    const headers = {};
    // ако бекендът очаква токен/хеш — отключи реда по-долу
    // const token = localStorage.getItem('userHash'); if (token) headers['Authorization'] = `Bearer ${token}`;

    // ТВОЯТ РУТ
    const url = api(`/api/messages/${id}/user/${userId}`);
    const res = await fetch(url, { method: 'DELETE', headers });

    const text = await res.text().catch(() => '');

    if (res.ok) {
      closeMsgMenu();
      await loadMessages();
      return;
    }

    if (res.status === 403) {
      showError(text || 'Нямате право да изтриете това съобщение.');
      return;
    }

    showError(`Неуспешно изтриване (HTTP ${res.status}) ${text ? '— ' + text : ''}`);
  } catch (err) {
    console.error('Грешка при изтриване:', err);
    showError('Неуспешно изтриване: ' + err.message);
  }
}


/* --- Слушатели --- */
$send.addEventListener('click', sendMessage);

$text.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
$text.addEventListener('input', () => { $send.disabled = !$text.value.trim(); });

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

// Меню бутони / извънкликове
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

/* --- Старт --- */
(async function init() {
  try {
    $text.focus();
    $send.disabled = true;
    isNearBottom = true;
    await loadMessages();
    setInterval(loadMessages, POLL_MS);
  } catch (e) {
    console.error(e);
  }
})();
