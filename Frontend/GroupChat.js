// ===== Конфиг =====
const API = 'https://localhost:7198';
const PAGE_SIZE = 50;

// ===== Помощни =====
const $ = (s) => document.querySelector(s);
const show = (el) => (el && (el.hidden = false));
const hide = (el) => (el && (el.hidden = true));

function redirectToIndex(msg) {
  try { if (msg) alert(msg); } catch {}
  location.replace('index.html');
}

function getUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
}
function getUserId() {
  const u = getUser();
  const id = Number(u?.id ?? u?.Id ?? 0);
  return Number.isFinite(id) && id > 0 ? id : null;
}
function requesterHeaders() {
  const id = getUserId();
  return id ? { 'Requester-Id': String(id) } : {};
}
async function fetchJson(url, opt = {}) {
  const res = await fetch(url, {
    ...opt,
    headers: { 'Accept':'application/json', ...(opt.headers||{}), ...requesterHeaders() }
  });
  if (!res.ok) {
    const body = await res.text().catch(()=>res.statusText);
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : {};
}
function qs(name) {
  const m = new URLSearchParams(location.search).get(name);
  return m ? decodeURIComponent(m) : null;
}
function fmtDate(d){
  try { return new Date(d).toLocaleString('bg-BG', { hour12:false }); } catch { return '' }
}

// ===== Нормализация на отговорите (PascalCase/camelCase) =====
function normalizeAttachment(a){
  if (!a) return null;
  return {
    id: a.id ?? a.Id ?? null,
    chatMessageId: a.chatMessageId ?? a.ChatMessageId ?? null,
    fileUrl: a.fileUrl ?? a.FileUrl ?? '',
    fileType: a.fileType ?? a.FileType ?? '',
    createdAt: a.createdAt ?? a.CreatedAt ?? null
  };
}
function normalizeMessage(m){
  if (!m) return null;
  return {
    id: m.id ?? m.Id ?? null,
    chatId: m.chatId ?? m.ChatId ?? null,
    senderId: m.senderId ?? m.SenderId ?? null,
    content: m.content ?? m.Content ?? '',
    createdAt: m.createdAt ?? m.CreatedAt ?? null,
    attachments: Array.isArray(m.attachments ?? m.Attachments)
      ? (m.attachments ?? m.Attachments).map(normalizeAttachment)
      : []
  };
}
function normalizeList(list){
  return Array.isArray(list) ? list.map(normalizeMessage).filter(Boolean) : [];
}

// ===== Аватари (кеш + дедупликация) =====
const avatarCache = new Map(); // userId -> string URL или Promise<string>
async function getAvatarUrl(userId){
  if (!userId || userId <= 0) return fallbackAvatar();
  const cached = avatarCache.get(userId);
  if (cached) return await cached;

  const promise = (async () => {
    try {
      const res = await fetch(
        `${API}/api/Users/profilePicture/${userId}?t=${Date.now()}`,
        { headers:{...requesterHeaders()} }
      );
      if (!res.ok) throw new Error('no avatar');
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    } catch {
      return fallbackAvatar();
    }
  })();

  avatarCache.set(userId, promise);
  const url = await promise;
  avatarCache.set(userId, url);
  return url;
}
function fallbackAvatar(){
  return 'data:image/svg+xml;utf8,'+encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
      <rect width="100%" height="100%" fill="#eef4ff"/>
      <text x="50%" y="54%" text-anchor="middle" font-size="28" fill="#2e7bff">👤</text>
    </svg>`
  );
}

// Качване на профилна снимка + рефреш на аватарите
async function uploadProfilePicture(userId, file){
  if (!userId || !file) throw new Error('Липсва userId или файл');
  const fd = new FormData();
  fd.append('file', file, file.name);

  const res = await fetch(`${API}/api/Users/uploadProfilePicture/${userId}`, {
    method: 'POST',
    headers: { ...requesterHeaders() },
    body: fd
  });
  if (!res.ok) {
    const t = await res.text().catch(()=>res.statusText);
    throw new Error(`HTTP ${res.status}: ${t}`);
  }

  avatarCache.delete(userId);
  const newUrl = await getAvatarUrl(userId);
  document.querySelectorAll('img.avatar[data-userid="'+userId+'"]').forEach(img => { img.src = newUrl; });
  return true;
}
window.uploadProfilePicture = uploadProfilePicture;

// ===== UI refs =====
const metaTeam   = $('#meta-team');
const metaUser   = $('#meta-user');
const chatTitle  = $('#chat-title');
const chatSub    = $('#chat-sub');
const scroller   = $('#msg-scroll');
const olderBox   = $('#load-older');
const sendForm   = $('#send-form');
const textBox    = $('#msg-text');
const btnFile    = $('#btn-file');
const fileInput  = $('#file-input');
const filesBox   = $('#files');
const errBox     = $('#err');
const sendBtn    = sendForm?.querySelector('button[type="submit"]');

const memberList = $('#member-list');
const memberSub  = $('#member-sub');

// ===== Глобално състояние =====
let USER = null;
let USER_ID = null;
let CHAT_ID = null;

let messages = [];
let afterId = null;
let oldestId = null;
let pollingT = 0;
let pendingFiles = [];

let MEMBERS = [];
let IS_ADMIN = false;
let loadingNewer = false;

// ===== Хеш на user за ранна автентикация =====
async function hashUserData(user) { 
  const data = `${user.firstName}${user.lastName}${user.email}${user.gender}${user.roleID}${user.clubID}${user.profileImage_url}${user.id}${user.yearOfBirth}${user.statusID}`;
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

// ===== Head (име, отбор) =====
async function initHead(){
  if (!USER_ID) { redirectToIndex('Моля, влез отново.'); return; }
  try {
    metaUser.textContent = `Потребител: ${USER?.firstName ?? ''} ${USER?.lastName ?? ''}`.trim();
  } catch {}

  try {
    const clubId = Number(USER?.clubID ?? USER?.clubId ?? 0);
    if (clubId > 0) {
      const club = await fetchJson(`${API}/api/Clubs/${clubId}`).catch(()=>null);
      metaTeam.textContent = `Отбор: ${club?.name || '—'}`;
    } else {
      metaTeam.textContent = 'Отбор: —';
    }
  } catch {
    metaTeam.textContent = 'Отбор: —';
  }

  chatTitle.textContent = `Чат #${CHAT_ID}`;
}

// ===== Участници в групата =====
function normalizeMember(m){
  if (!m) return null;
  return {
    userId:     m.userId     ?? m.UserId     ?? 0,
    firstName:  m.firstName  ?? m.FirstName  ?? '',
    lastName:   m.lastName   ?? m.LastName   ?? '',
    isAdmin:    m.isAdmin    ?? m.IsAdmin    ?? false,
    joinedAt:   m.joinedAt   ?? m.JoinedAt   ?? null,
    lastReadAt: m.lastReadAt ?? m.LastReadAt ?? null
  };
}

async function loadMembers(){
  if (!CHAT_ID || !memberList) return;
  try{
    const raw = await fetchJson(`${API}/api/Chats/${CHAT_ID}/members`);
    const list = Array.isArray(raw) ? raw.map(normalizeMember).filter(Boolean) : [];
    MEMBERS = list;

    IS_ADMIN = !!list.find(m => Number(m.userId) === Number(USER_ID) && m.isAdmin);

    renderMembers();
  } catch(e){
    console.warn('Грешка при зареждане на участници:', e?.message || e);
  }
}

function renderMembers(){
  if (!memberList) return;
  memberList.innerHTML = '';

  if (!MEMBERS.length){
    memberSub.textContent = 'Няма участници.';
    return;
  }
  memberSub.textContent = `${MEMBERS.length} участници${IS_ADMIN ? ' · ти си админ' : ''}`;

  for (const m of MEMBERS){
    const row = document.createElement('div');
    row.className = 'member-row';

    const img = document.createElement('img');
    img.alt = 'аватар';
    img.src = fallbackAvatar();
    getAvatarUrl(m.userId).then(url => { img.src = url; }).catch(()=>{});

    const main = document.createElement('div');
    main.className = 'member-main';

    const name = document.createElement('div');
    name.className = 'member-name';
    name.textContent = `${m.firstName || ''} ${m.lastName || ''}`.trim() || `Потребител ${m.userId}`;

    const meta = document.createElement('div');
    meta.className = 'member-meta';
    meta.textContent = m.lastReadAt
      ? 'Последно виждан: ' + fmtDate(m.lastReadAt)
      : 'В групата от: ' + (fmtDate(m.joinedAt) || '—');

    main.append(name, meta);

    row.append(img, main);

    if (m.isAdmin){
      const badge = document.createElement('span');
      badge.className = 'badge-admin';
      badge.textContent = 'Админ';
      row.append(badge);
    }

    if (IS_ADMIN && Number(m.userId) !== Number(USER_ID)){
      const btn = document.createElement('button');
      btn.className = 'btn-kick';
      btn.type = 'button';
      btn.title = 'Премахни от групата';
      btn.textContent = '✕';
      btn.addEventListener('click', () => kickMember(m.userId));
      row.append(btn);
    }

    memberList.appendChild(row);
  }
}

async function kickMember(userId){
  if (!userId) return;
  if (!confirm('Да премахна ли този участник от групата?')) return;
  try{
    await fetchJson(`${API}/api/Chats/${CHAT_ID}/members/${userId}`, { method:'DELETE' });
    await loadMembers();
  }catch(err){
    errBox.textContent = 'Неуспешно премахване на участник: ' + (err?.message || err);
    show(errBox);
  }
}

// ===== Съобщения =====
function renderMessage(m){
  const isMe = Number(m.senderId) === Number(USER_ID);
  const canDelete = isMe || IS_ADMIN;

  const row = document.createElement('div');
  row.className = 'msg' + (isMe ? ' me' : '');

  const av = document.createElement('img');
  av.className = 'avatar';
  av.setAttribute('data-userid', String(m.senderId ?? ''));
  av.src = fallbackAvatar();
  getAvatarUrl(m.senderId).then(url => { av.src = url; }).catch(()=>{});

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  const head = document.createElement('div');
  head.className = 'bubble-head';

  const meta = document.createElement('div');
  meta.className = 'meta';
  const who = isMe ? 'Ти' : `Потребител ${m.senderId ?? '—'}`;
  meta.textContent = `${who} · ${fmtDate(m.createdAt) || '—'}`;
  head.appendChild(meta);

  if (canDelete){
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'msg-delete';
    del.title = 'Изтрий съобщението';
    del.textContent = '🗑';
    del.addEventListener('click', (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      deleteMessage(m.id);
    });
    head.appendChild(del);
  }

  bubble.appendChild(head);

  const text = (m.content || '').trim();
  if (text) {
    const p = document.createElement('div');
    p.textContent = text;
    bubble.appendChild(p);
  }

  if (Array.isArray(m.attachments) && m.attachments.length){
    const wrap = document.createElement('div'); wrap.className = 'att';
    for (const a of m.attachments){
      const fileType = String(a.fileType || '');
      if (fileType.startsWith('image/')){
        const img = document.createElement('img');
        img.src = a.fileUrl;
        img.alt = 'изображение';
        img.loading = 'lazy';
        wrap.appendChild(img);
      } else {
        const chip = document.createElement('span');
        chip.className = 'chip';
        const link = document.createElement('a');
        link.href = a.fileUrl; link.target = '_blank'; link.rel = 'noreferrer';
        link.textContent = a.fileUrl?.split('/').pop() || 'файл';
        chip.append('📎 ', link);
        wrap.appendChild(chip);
      }
    }
    bubble.appendChild(wrap);
  }

  row.append(av, bubble);
  return row;
}

function rebuildList(){
  scroller.innerHTML = '';
  for (const m of messages) scroller.appendChild(renderMessage(m));
  scroller.scrollTop = scroller.scrollHeight + 1000;
}

async function loadInitial(){
  if (!CHAT_ID) return;
  const raw = await fetchJson(`${API}/api/Chats/${CHAT_ID}/messages?take=${PAGE_SIZE}`);
  const list = normalizeList(raw).sort((a,b)=> (a.id||0)-(b.id||0));
  messages = list;

  if (messages.length){
    afterId  = messages[messages.length-1].id ?? null;
    oldestId = messages[0].id ?? null;
    chatSub.textContent = `${messages.length} съобщения`;
  } else {
    afterId = oldestId = null;
    chatSub.textContent = 'Няма съобщения';
  }

  rebuildList();

  try {
    await fetch(`${API}/api/Chats/${CHAT_ID}/read`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', ...requesterHeaders() },
      body: JSON.stringify({ atUtc: new Date().toISOString() })
    });
  } catch {}
}

async function loadNewer(){
  if (!afterId || loadingNewer) return;
  loadingNewer = true;
  try{
    const raw = await fetchJson(`${API}/api/Chats/${CHAT_ID}/messages?afterId=${afterId}&take=${PAGE_SIZE}`);
    const list = normalizeList(raw);
    if (!list.length) return;

    for (const m of list) messages.push(m);
    messages.sort((a,b)=> (a.id||0)-(b.id||0));
    afterId = messages[messages.length-1]?.id ?? afterId;
    rebuildList();
  } finally {
    loadingNewer = false;
  }
}

async function loadOlder(){
  if (!oldestId) return;
  const raw = await fetchJson(`${API}/api/Chats/${CHAT_ID}/messages?take=${PAGE_SIZE}`);
  const list = normalizeList(raw);
  const older = list.filter(x => (x.id||0) < (oldestId||0))
                    .sort((a,b)=> (a.id||0)-(b.id||0));
  if (!older.length) { olderBox.innerHTML = '<span class="muted-small">Няма по-стари.</span>'; return; }

  messages = [...older, ...messages];
  oldestId = messages[0]?.id ?? oldestId;

  const prevH = scroller.scrollHeight;
  rebuildList();
  const diff = scroller.scrollHeight - prevH;
  scroller.scrollTop = diff + 20;
}

// бутон „по-стари“
olderBox.innerHTML = '';
const btnOlder = document.createElement('button');
btnOlder.className = 'btn small';
btnOlder.type = 'button';
btnOlder.textContent = 'Зареди по-стари';
btnOlder.addEventListener('click', loadOlder);
olderBox.appendChild(btnOlder);

// === изтриване на съобщение ===
async function deleteMessage(messageId){
  if (!messageId) return;
  if (!confirm('Да изтря ли това съобщение?')) return;
  try{
    await fetchJson(`${API}/api/Chats/${CHAT_ID}/messages/${messageId}`, { method:'DELETE' });
    messages = messages.filter(m => m.id !== messageId);
    rebuildList();
  }catch(err){
    errBox.textContent = 'Неуспешно изтриване: ' + (err?.message || err);
    show(errBox);
  }
}

// Изпращане
btnFile?.addEventListener('click', () => fileInput?.click());

fileInput?.addEventListener('change', () => {
  pendingFiles = Array.from(fileInput.files || []); // File[]
  filesBox.innerHTML = '';
  pendingFiles.forEach((f, i) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    const btnX = document.createElement('button');
    btnX.type = 'button';
    btnX.textContent = '×';
    btnX.title = 'Премахни';
    btnX.addEventListener('click', () => {
      pendingFiles.splice(i,1);
      const ev = new Event('change');
      fileInput.dispatchEvent(ev);
    });
    chip.textContent = f.name + ' ';
    chip.appendChild(btnX);
    filesBox.appendChild(chip);
  });
});

sendForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  hide(errBox);

  if (!USER_ID) {
    errBox.textContent = 'Няма валиден потребител. Влез отново.';
    show(errBox);
    return;
  }

  const text = (textBox.value || '').trim();
  if (!text && pendingFiles.length===0) return;

  try{
    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = 'Качва...'; }

    const fd = new FormData();
    if (text) fd.append('content', text);
    for (const f of pendingFiles) fd.append('files', f, f.name);

    const res = await fetch(`${API}/api/Chats/${CHAT_ID}/messages`, {
      method:'POST',
      headers: { ...requesterHeaders() },
      body: fd
    });
    if (!res.ok) {
      const t = await res.text().catch(()=>res.statusText);
      throw new Error(`HTTP ${res.status}: ${t}`);
    }

    textBox.value = '';
    pendingFiles = [];
    if (fileInput) fileInput.value = '';
    filesBox.innerHTML = '';

    await loadNewer();

    try {
      await fetch(`${API}/api/Chats/${CHAT_ID}/read`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', ...requesterHeaders() },
        body: JSON.stringify({ atUtc: new Date().toISOString() })
      });
    } catch {}
  } catch(err){
    errBox.textContent = 'Неуспешно изпращане: ' + (err?.message || err);
    show(errBox);
  } finally {
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'Изпрати'; }
  }
});

function startPolling(){
  if (pollingT) clearInterval(pollingT);
  pollingT = setInterval(() => { loadNewer().catch(()=>{}); }, 3500);
}

async function startApp(user) {
  USER = user;
  USER_ID = getUserId();
  CHAT_ID = Number(qs('chatId') || 0);

  await initHead();
  await loadMembers();
  await loadInitial().catch(err => { errBox.textContent = err?.message || String(err); show(errBox); });
  startPolling();
}

// === РАННА АУТЕНТИКАЦИЯ И СТАРТ ===
(async function authAndStart() {
  const userJson = localStorage.getItem('user');
  const savedHash = localStorage.getItem('userHash');

  if (!userJson || !savedHash) {
    redirectToIndex('Невалидни данни. Пренасочване към началната страница.');
    return;
  }

  let user;
  try {
    user = JSON.parse(userJson);
  } catch {
    redirectToIndex('Повредени данни за профил. Пренасочване...');
    return;
  }

  try {
    const currentHash = await hashUserData(user);
    if (currentHash !== savedHash) {
      redirectToIndex('Не бъди злонамерен <3');
      return;
    }
  } catch (error) {
    console.error('Грешка при хеширането:', error);
    redirectToIndex('Възникна грешка. Пренасочване...');
    return;
  }

  startApp(user);
})();
