'use strict';

/* ========= КОНФИГ ========= */
const API_HOST = 'https://sportstatsapi.azurewebsites.net';
const API = (path) => {
  const clean = String(path).replace(/^\/+/, '');
  return `${API_HOST}/api/${clean}`;
};

/* ========= DOM ========= */
const gridEl       = document.getElementById('grid');
const saveBtn      = document.getElementById('saveBtn');
const feeBox       = document.getElementById('feeBox');
const summaryEl    = document.getElementById('summary');
const seasonSelect = document.getElementById('seasonSelect');
const messagesEl   = document.getElementById('messages');
const clubLabelEl  = document.getElementById('clubLabel');
const userLabelEl  = document.getElementById('userLabel');

function setMessage(msg) { messagesEl.textContent = msg || ''; }

/* ========= ПОЛЗВАТЕЛ + ХЕШ ВАЛИДАЦИЯ ========= */

function redirectToIndex(message) {
  alert(message);
  localStorage.clear();
  window.location.href = 'Index.html';
}

function pick(obj, keys, def = '') {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') {
      return String(obj[k]);
    }
  }
  return def;
}

/* ========= HASH (СЪЩИЯ КАТО INDEX/BACKEND) ========= */

function safeParseJson(str) {
  try { return JSON.parse(str); } catch { return null; }
}

function pickHash(obj, ...keys) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

function toIntHash(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

// Canonical session object like backend UserSession
function normalizeSessionLikeBackend(raw) {
  if (!raw) return null;

  const id = toIntHash(pickHash(raw, 'id', 'Id', 'ID'));
  if (!id) return null;

  return {
    Id: id,
    FirstName: String(pickHash(raw, 'firstName', 'FirstName') ?? '').trim(),
    LastName: String(pickHash(raw, 'lastName', 'LastName') ?? '').trim(),
    Email: String(pickHash(raw, 'email', 'Email') ?? '').trim(),
    Gender: String(pickHash(raw, 'gender', 'Gender') ?? '').trim(),
    RoleID: toIntHash(pickHash(raw, 'roleID', 'RoleID', 'roleId', 'RoleId')),
    ClubID: toIntHash(pickHash(raw, 'clubID', 'ClubID', 'clubId', 'ClubId')),
    profileImage_url: String(
      pickHash(raw, 'profileImage_url', 'ProfileImage_url', 'profileImageUrl', 'ProfileImageUrl') ?? ''
    ).trim(),
    YearOfBirth: toIntHash(pickHash(raw, 'yearOfBirth', 'YearOfBirth')),
    StatusID: toIntHash(pickHash(raw, 'statusID', 'StatusID', 'statusId', 'StatusId')),
    UserTokenHash: String(pickHash(raw, 'userTokenHash', 'UserTokenHash') ?? '').trim()
  };
}

// Exactly like backend GetCanonicalPayload()
function getCanonicalPayloadLikeBackend(s) {
  if (!s) return '';

  return [
    String(toIntHash(s.Id)),
    String(s.FirstName ?? '').trim(),
    String(s.LastName ?? '').trim(),
    String(s.Email ?? '').trim(),
    String(s.Gender ?? '').trim(),
    String(toIntHash(s.RoleID)),
    String(toIntHash(s.ClubID)),
    String(s.profileImage_url ?? '').trim(),
    String(toIntHash(s.YearOfBirth)),
    String(toIntHash(s.StatusID))
  ].join('|');
}

async function sha256Base64Utf8(text) {
  if (!(window.crypto && window.crypto.subtle)) {
    throw new Error('Crypto Subtle API изисква HTTPS (secure context).');
  }

  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hashBuffer);

  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function hashUserDataLikeIndex(raw) {
  const s = normalizeSessionLikeBackend(raw);
  if (!s) return '';
  const payload = getCanonicalPayloadLikeBackend(s);
  return sha256Base64Utf8(payload);
}

function readUserFromLocalStorage() {
  const savedHash = String(localStorage.getItem('userHash') || '').trim();

  // Index записва обикновено и трите
  const user       = safeParseJson(localStorage.getItem('user'));
  const userServer = safeParseJson(localStorage.getItem('userServer'));
  const session    = safeParseJson(localStorage.getItem('session'));

  if (!savedHash) {
    redirectToIndex('Липсва userHash. Пренасочване към началната страница.');
    return null;
  }

  // За hash проверка ползваме най-каноничния източник
  const sourceForHash = session || userServer || user;

  // За UI/ид-та ползваме user (snake/camel), fallback ако липсва
  const userForApp = user || userServer || session;

  if (!sourceForHash || !userForApp) {
    redirectToIndex('Невалидни данни за потребител. Пренасочване...');
    return null;
  }

  return { user: userForApp, sourceForHash, savedHash };
}

/* ========= STATE ========= */
let userId   = null;
let clubId   = null;
let seasonId = null;

let seasons = [];
let slots = [];
let selectedSlotIds = new Set();
let dirty = false;

const days = ['Пон', 'Вто', 'Сря', 'Чет', 'Пет', 'Съб', 'Нед'];

let groupNameById = new Map();

/* ========= HELPERS ========= */
function normalizeDow(dow) {
  const n = Number(dow);
  if (Number.isNaN(n)) return null;
  return n === 0 ? 7 : n;
}
function toHHMM(ts) {
  if (!ts) return '';
  const s = String(ts);
  const m = /^(\d{2}:\d{2})/.exec(s);
  return m ? m[1] : s;
}
function adaptSlot(x) {
  const id        = x.id ?? x.Id;
  const day       = normalizeDow(x.dayOfWeek ?? x.DayOfWeek ?? x.Weekday ?? x.weekday);
  const start     = toHHMM(x.startTime ?? x.StartTime);
  const end       = toHHMM(x.endTime   ?? x.EndTime);
  const groupId   = x.groupId ?? x.GroupId;
  const groupName = x.groupName ?? x.GroupName ?? x.group?.name ?? x.Group?.Name ?? null;
  const capacity  = x.capacity ?? x.Capacity;
  const currentCount = x.currentCount ?? x.CurrentCount;
  return { id, dayOfWeek: day, startTime: start, endTime: end, groupId, groupName, capacity, currentCount };
}
function uniqTimes(allSlots) {
  const set = new Set(allSlots.map(s => `${s.startTime}-${s.endTime}`));
  return Array.from(set).sort((a,b)=>{
    const [aS] = a.split('-'); const [bS] = b.split('-');
    return aS.localeCompare(bS);
  });
}
function slotsByDayTime() {
  const map = new Map();
  for (const s of slots) {
    if (!s.dayOfWeek) continue;
    map.set(`${s.dayOfWeek}-${s.startTime}-${s.endTime}`, s);
  }
  return map;
}
function updateSummary() {
  summaryEl.textContent = `${selectedSlotIds.size} слота избрани`;
  saveBtn.disabled = !dirty;
}
function div(cls, txt) {
  const d = document.createElement('div');
  if (cls) d.className = cls;
  if (txt !== undefined) d.textContent = txt;
  return d;
}

/* ========= API ========= */
async function apiGet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiGetOrNull(url) {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiPut(url, body) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.text();
}

/* ========= LABELS ========= */
async function resolveClubDisplayName(user, clubId) {
  const fromUser = pick(user, ['clubName','ClubName']) ||
                   (user.club?.name || user.Club?.Name || '');
  if (fromUser) return fromUser;

  try {
    const club = await apiGet(API(`Clubs/${clubId}`));
    return club.name ?? club.Name ?? 'Клуб';
  } catch { /* ignore */ }

  return 'Клуб';
}
function resolveUserDisplayName(user) {
  const full = [pick(user, ['firstName','FirstName']), pick(user, ['lastName','LastName'])].filter(Boolean).join(' ').trim();
  if (full) return full;
  const email = pick(user, ['email','Email']);
  if (email) return email;
  const username = pick(user, ['username','userName','Username','UserName']);
  if (username) return username;
  return 'Потребител';
}

/* ========= GROUPS ========= */
async function ensureGroupNames() {
  if (groupNameById.size) return;
  const groups = await apiGet(API(`TrainingGroups/club/${clubId}`));
  groups.forEach(g => {
    const id = g.id ?? g.Id;
    const name = g.name ?? g.Name ?? 'Група';
    groupNameById.set(id, name);
  });
}

/* ========= СЛОТ INFO КЕШ ========= */
const slotInfoCache = new Map(); // slotId -> { count, mine, capacity }

async function getSlotInfo(slotId, capacity){
  if (slotInfoCache.has(slotId)) return slotInfoCache.get(slotId);
  try{
    const res = await fetch(API(`AthleteSelections/slot/${slotId}`));
    if (!res.ok) throw new Error();
    const arr = await res.json();
    const count = Array.isArray(arr) ? arr.length : 0;
    const mine  = Array.isArray(arr) && arr.some(u => {
      const uid = Number(u.UserId ?? u.userId ?? u.userid ?? u.id);
      return uid === userId;
    });
    const info = { count, mine: !!mine, capacity: Number.isFinite(capacity) ? capacity : null };
    slotInfoCache.set(slotId, info);
    return info;
  }catch{
    const info = { count: 0, mine: false, capacity: Number.isFinite(capacity) ? capacity : null };
    slotInfoCache.set(slotId, info);
    return info;
  }
}

/* ========= UI helpers за броячи (NEW) ========= */
function updateSlotVisual(slotId, info) {
  // ъпдейт на числото „Записани“
  const takenEl = gridEl.querySelector(`.taken[data-slot-id="${slotId}"]`);
  if (takenEl) takenEl.textContent = info.count;

  // намери самия бутон (слота) за класове
  const slotBtn = gridEl.querySelector(`.slot[data-slot-id="${slotId}"]`);
  if (!slotBtn) return;

  // пълнота
  const isFull = Number.isFinite(info.capacity) && info.count >= info.capacity;
  slotBtn.classList.toggle('full', isFull);
  if (takenEl) takenEl.style.color = isFull ? '#dc2626' : '';

  // мой ли е
  slotBtn.classList.toggle('mine', !!info.mine);
}

/* ========= LOAD ========= */
async function loadSeasons() {
  setMessage('Зареждам сезони…');
  seasons = await apiGet(API(`Seasons/club/${clubId}`));
  seasonSelect.innerHTML = '';
  for (const s of seasons) {
    const opt = document.createElement('option');
    opt.value = s.id ?? s.Id;
    const start = (s.startDate ?? s.StartDate ?? '').toString().substring(0,10);
    const end   = (s.endDate   ?? s.EndDate   ?? '').toString().substring(0,10);
    const isActive = (s.isActive ?? s.IsActive) ? ' • активен' : '';
    opt.textContent = `${(s.name ?? s.Name ?? '')} (${start} → ${end})${isActive}`;
    seasonSelect.appendChild(opt);
  }
  const active = seasons.find(x => (x.isActive ?? x.IsActive) === true);
  seasonId = (active ? (active.id ?? active.Id) : (seasons[0] ? (seasons[0].id ?? seasons[0].Id) : null));
  if (seasonId) seasonSelect.value = seasonId;
  setMessage('');
}

async function loadSlots() {
  setMessage('Зареждам слотове…');
  const withSeason = seasonId
    ? API(`ScheduleSlots/club/${clubId}?seasonId=${seasonId}`)
    : API(`ScheduleSlots/club/${clubId}`);

  let raw = await apiGet(withSeason);

  if (seasonId && (!Array.isArray(raw) || raw.length === 0)) {
    const raw2 = await apiGet(API(`ScheduleSlots/club/${clubId}`));
    if (Array.isArray(raw2) && raw2.length > 0) {
      setMessage('Показвам слотовете без филтър по сезон (ClubSeasonId липсва).');
      raw = raw2;
    } else {
      setMessage('');
    }
  } else {
    setMessage('');
  }

  await ensureGroupNames();

  slots = (raw || [])
    .map(adaptSlot)
    .filter(s => s.id && s.dayOfWeek && s.startTime && s.endTime)
    .map(s => ({ ...s, groupName: s.groupName || groupNameById.get(s.groupId) || 'Група' }));

  // изчистваме кеша за броячите при нов рендер
  slotInfoCache.clear();
}

/* ========= MY SELECTIONS ========= */
async function loadMySelections() {
  if (!userId) return;
  const arr = await apiGet(API(`AthleteSelections/user/${userId}`));
  selectedSlotIds = new Set(arr.map(x => x.slotId ?? x.SlotId));
}

/* ========= FEE ========= */
async function refreshFee() {
  if (!userId || !clubId) { feeBox.textContent = 'Такса: —'; return; }

  const mySel = await apiGet(API(`AthleteSelections/user/${userId}`));
  const mySlotIds = new Set(mySel.map(x => x.slotId ?? x.SlotId));
  const mySlots = slots.filter(s => mySlotIds.has(s.id));
  const tpw = new Set(mySlots.map(s => `${s.dayOfWeek}-${s.startTime}-${s.endTime}`)).size;

  const active = seasons.find(x => (x.isActive ?? x.IsActive) === true);
  const sid = active ? (active.id ?? active.Id) : null;

  let planOk = true;
  if (tpw > 0) {
    const today = new Date();
    const ymStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-15`;
    try {
      const url = API(`FeePlans/active?clubId=${clubId}&tpw=${tpw}`) + (sid ? `&seasonId=${sid}` : '') + `&on=${ymStr}`;
      await apiGet(url);
    } catch {
      planOk = false;
    }
  }

  const fee = await apiGetOrNull(API(`AthleteSelections/monthly-fee?clubId=${clubId}&userId=${userId}`));

  if (fee) {
    const ym = fee.yearMonth ?? fee.YearMonth ?? 'текущ месец';
    const amount = Number(
      fee.monthlyFee ?? fee.MonthlyFee ??
      fee.amountDue  ?? fee.AmountDue  ?? 0
    ).toFixed(2);
    const tpwR = fee.trainingsPerWeek ?? fee.TrainingsPerWeek ?? tpw;
    const src = (fee.feeSource ?? fee.FeeSource ?? '').toString().toUpperCase();
    const srcTxt = src ? (src === 'SPECIAL' ? ' • спец. цена' : ' • план') : '';
    feeBox.textContent = `Такса (${ym}): ${amount} лв • ${tpwR} трен./седм.${srcTxt}`;
  } else {
    if (tpw === 0) {
      feeBox.textContent = 'Такса: — (няма избрани тренировки)';
    } else if (!planOk) {
      feeBox.textContent = `Такса: — (липсва активен план за ${tpw} трен./седм.)`;
    } else if (!sid) {
      feeBox.textContent = 'Такса: — (няма активен сезон)';
    } else {
      feeBox.textContent = 'Такса: — (няма данни/план)';
    }
  }
}

/* ========= SAVE ========= */
// NEW: общо „меко презареждане“ след запис
async function refreshAllAfterSave() {
  await loadSlots();
  await loadMySelections();
  renderGrid();
  await refreshFee();
}

async function saveSelections() {
  if (!userId) return;
  const payload = { slotIds: Array.from(selectedSlotIds) };
  try {
    setMessage('Запис…');
    await apiPut(API(`AthleteSelections/user/${userId}/replace`), payload);
    dirty = false;
    updateSummary();

    // NEW: вместо да чакаш ръчен reload – правим меко презареждане
    await refreshAllAfterSave();

    setMessage('Записано.');
    setTimeout(()=> setMessage(''), 1200);
  } catch (e) {
    console.error(e);
    setMessage('Грешка при запис.');
    // по желание можем да „ресинхронизираме“
    await refreshAllAfterSave();
  }
}

/* ========= RENDER ========= */
function renderGrid() {
  gridEl.innerHTML = '';
  gridEl.appendChild(div('head time-col','Час'));
  for (let i=0;i<7;i++) gridEl.appendChild(div('head', days[i]));

  if (!slots || slots.length === 0) {
    const empty = div('cell', 'Няма дефинирани слотове.');
    empty.style.gridColumn = '1 / span 8';
    gridEl.appendChild(empty);
    return;
  }

  const timeBands = uniqTimes(slots);
  const map = slotsByDayTime();

  for (const band of timeBands) {
    const [start,end] = band.split('-');
    gridEl.appendChild(div('cell time-col', `${start}–${end}`));
    for (let dow=1; dow<=7; dow++) {
      const key = `${dow}-${start}-${end}`;
      const slot = map.get(key);
      const cell = document.createElement('div');
      cell.className = 'cell';
      if (!slot) {
        cell.appendChild(div('muted', '—'));
      } else {
        const btn = document.createElement('div');
        btn.className = 'slot';
        btn.dataset.slotId = slot.id;
        if (selectedSlotIds.has(slot.id)) btn.classList.add('selected');

        btn.innerHTML = `
          <div class="slot-title">${slot.groupName ? slot.groupName : 'Тренировка'}</div>
          <div class="slot-meta">
            ${Number.isFinite(slot.capacity)
              ? `Капацитет: <span class="cap">${slot.capacity}</span> • Записани: <span class="taken" data-slot-id="${slot.id}">—</span>`
              : `Записани: <span class="taken" data-slot-id="${slot.id}">—</span>`}
          </div>
        `;

        btn.title = `${days[(slot.dayOfWeek-1)]} ${start}-${end}${slot.capacity ? ` • капацитет: ${slot.capacity}` : ''}`;

        // КЛИК: оптимистично обновяване (NEW)
        btn.addEventListener('click', async () => {
          const id = parseInt(btn.dataset.slotId,10);
          const wasSelected = selectedSlotIds.has(id);

          // вземи текущото инфо и работи оптимистично върху него
          const info = await getSlotInfo(id, slot.capacity);

          if (!wasSelected) {
            // добавям нов избор
            const isFull = Number.isFinite(info.capacity) && info.count >= info.capacity;
            if (isFull && !info.mine) {
              // чужд и пълен → блокираме
              return;
            }
            selectedSlotIds.add(id);
            btn.classList.add('selected');

            // оптимистично вдигаме броя само ако преди не е бил „mine“
            if (!info.mine) { info.count += 1; info.mine = true; }
          } else {
            // махам избор
            selectedSlotIds.delete(id);
            btn.classList.remove('selected');

            // оптимистично сваляме броя само ако беше „mine“
            if (info.mine && info.count > 0) { info.count -= 1; info.mine = false; }
          }

          // визуален ъпдейт на брояча/класовете
          updateSlotVisual(id, info);

          dirty = true;
          updateSummary();
        });

        cell.appendChild(btn);

        // първоначален fetch за броячите
        (async ()=>{
          try{
            const info = await getSlotInfo(slot.id, slot.capacity);
            updateSlotVisual(slot.id, info);
          }catch(_){}
        })();
      }
      gridEl.appendChild(cell);
    }
  }
  updateSummary();
}

/* ========= INIT ========= */
seasonSelect.addEventListener('change', async (e) => {
  const v = e.target.value;
  seasonId = v ? parseInt(v,10) : null;
  await loadSlots();
  await loadMySelections();
  renderGrid();
  refreshFee();
});

saveBtn.addEventListener('click', saveSelections);

(async function init() {
  try {
    const payload = readUserFromLocalStorage();
    if (!payload) return;

    const { user, sourceForHash, savedHash } = payload;

    try {
      const currentHash = await hashUserDataLikeIndex(sourceForHash);

      if (!currentHash || currentHash !== savedHash) {
        console.warn('HASH MISMATCH', {
          savedHash,
          currentHash,
          sourceForHash,
          canonicalPayload: normalizeSessionLikeBackend(sourceForHash)
            ? getCanonicalPayloadLikeBackend(normalizeSessionLikeBackend(sourceForHash))
            : null
        });

        redirectToIndex('Не бъди злонамерен <3');
        return;
      }
    } catch (err) {
      console.error('Грешка при хеширането:', err);
      redirectToIndex('Възникна грешка. Пренасочване...');
      return;
    }

    userId = Number(user.id ?? user.Id ?? user.ID ?? 0) || null;
    clubId = Number(user.clubID ?? user.clubId ?? user.ClubID ?? user.ClubId ?? 0) || null;

    if (!userId || !clubId) {
      redirectToIndex('Липсват userId/clubId. Пренасочване...');
      return;
    }

    userLabelEl.textContent = resolveUserDisplayName(user);
    clubLabelEl.textContent = await resolveClubDisplayName(user, clubId);

    setMessage('Зареждам…');
    await loadSeasons();
    await loadSlots();
    await loadMySelections();
    renderGrid();
    await refreshFee();
    setMessage('');
  } catch (e) {
    console.error(e);
    setMessage('Грешка при зареждане на данни.');
  }
})();