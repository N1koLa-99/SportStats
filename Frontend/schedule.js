'use strict';

/* ========= КОНФИГ ========= */
const API_BASE = 'https://localhost:7198/api'; // смени при нужда

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

// безопасно взимане на поле с fallback-и
function pick(obj, keys, def = '') {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') {
      return String(obj[k]);
    }
  }
  return def;
}

async function hashUserData(user) {
  const data = [
    pick(user, ['firstName','FirstName']),
    pick(user, ['lastName','LastName']),
    pick(user, ['email','Email']),
    pick(user, ['gender','Gender']),
    pick(user, ['roleID','roleId','RoleID','RoleId']),
    pick(user, ['clubID','clubId','ClubID','ClubId']),
    pick(user, ['profileImage_url','profileImageUrl','ProfileImage_url','ProfileImageUrl']),
    pick(user, ['id','Id','ID']),
    pick(user, ['yearOfBirth','YearOfBirth']),
    pick(user, ['statusID','statusId','StatusID','StatusId']),
  ].join('');

  if (!window.crypto || !window.crypto.subtle) {
    throw new Error('Crypto Subtle API изисква HTTPS (secure context).');
  }
  const encoder = new TextEncoder();
  const buffer  = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function readUserFromLocalStorage() {
  const userJson  = localStorage.getItem('user');
  const savedHash = localStorage.getItem('userHash');

  if (!userJson || !savedHash) {
    redirectToIndex('Невалидни данни. Пренасочване към началната страница.');
    return null;
  }
  let parsed;
  try { parsed = JSON.parse(userJson); }
  catch { redirectToIndex('Повредени данни за потребител. Пренасочване...'); return null; }
  return { user: parsed, savedHash };
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

// кеш: имена на групи по id
let groupNameById = new Map();

/* ========= HELPERS ========= */
function normalizeDow(dow) {
  const n = Number(dow);
  if (Number.isNaN(n)) return null;
  return n === 0 ? 7 : n; // 0 (Нед) -> 7
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

/* ========= LABELS: имена вместо ID ========= */
async function resolveClubDisplayName(user, clubId) {
  // 1) опит от user обекта
  const fromUser = pick(user, ['clubName','ClubName']) ||
                   (user.club?.name || user.Club?.Name || '');
  if (fromUser) return fromUser;

  // 2) опит през API (ако има ендпойнт)
  try {
    const club = await apiGet(`${API_BASE}/clubs/${clubId}`);
    return club.name ?? club.Name ?? 'Клуб';
  } catch { /* ignore */ }

  // 3) fallback
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
  const groups = await apiGet(`${API_BASE}/traininggroups/club/${clubId}`);
  groups.forEach(g => {
    const id = g.id ?? g.Id;
    const name = g.name ?? g.Name ?? 'Група';
    groupNameById.set(id, name);
  });
}

/* ========= КЕШ: инфо за слот (count + mine + capacity) ========= */
const slotInfoCache = new Map(); // slotId -> { count, mine, capacity }

async function getSlotInfo(slotId, capacity){
  if (slotInfoCache.has(slotId)) return slotInfoCache.get(slotId);
  try{
    const res = await fetch(`${API_BASE}/athleteselections/slot/${slotId}`);
    if (!res.ok) throw new Error();
    const arr = await res.json(); // [{ UserId/userId/... }]
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

/* ========= LOAD ========= */
async function loadSeasons() {
  setMessage('Зареждам сезони…');
  seasons = await apiGet(`${API_BASE}/seasons/club/${clubId}`);
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

// fallback: ако няма слотове за seasonId → проба без сезон
async function loadSlots() {
  setMessage('Зареждам слотове…');
  const withSeason = seasonId
    ? `${API_BASE}/scheduleslots/club/${clubId}?seasonId=${seasonId}`
    : `${API_BASE}/scheduleslots/club/${clubId}`;

  let raw = await apiGet(withSeason);

  if (seasonId && (!Array.isArray(raw) || raw.length === 0)) {
    const raw2 = await apiGet(`${API_BASE}/scheduleslots/club/${clubId}`);
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

  console.log('Seasons:', seasons);
  console.log('Chosen seasonId:', seasonId);
  console.log('Slots received (raw):', raw);
  console.log('Slots normalized:', slots.slice(0, 10));
}

async function loadMySelections() {
  if (!userId) return;
  const arr = await apiGet(`${API_BASE}/athleteselections/user/${userId}`);
  selectedSlotIds = new Set(arr.map(x => x.slotId ?? x.SlotId));
}

/* ========= FEE ========= */
async function refreshFee() {
  if (!userId || !clubId) { feeBox.textContent = 'Такса: —'; return; }

  // 1) колко тренировки/седмица (TPW) имаш по текущите избори
  const mySel = await apiGet(`${API_BASE}/athleteselections/user/${userId}`);
  const mySlotIds = new Set(mySel.map(x => x.slotId ?? x.SlotId));
  const mySlots = slots.filter(s => mySlotIds.has(s.id));
  const tpw = new Set(mySlots.map(s => `${s.dayOfWeek}-${s.startTime}-${s.endTime}`)).size;

  // 2) активен сезон
  const active = seasons.find(x => (x.isActive ?? x.IsActive) === true);
  const sid = active ? (active.id ?? active.Id) : null;

  // 3) има ли активен план за този TPW?
  let planOk = true;
  if (tpw > 0) {
    const today = new Date();
    const ymStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-15`;
    try {
      const url = `${API_BASE}/feeplans/active?clubId=${clubId}&tpw=${tpw}` + (sid ? `&seasonId=${sid}` : '') + `&on=${ymStr}`;
      await apiGet(url); // ако 404 -> ще влезем в catch
    } catch {
      planOk = false;
    }
  }

  // 4) опитай реалната сметка
  const fee = await apiGetOrNull(`${API_BASE}/athleteselections/monthly-fee?clubId=${clubId}&userId=${userId}`);

  if (fee) {
    const ym = fee.yearMonth ?? fee.YearMonth ?? 'текущ месец';
    const amount = Number(
      fee.monthlyFee ?? fee.MonthlyFee ?? // <- връща API-то
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
async function saveSelections() {
  if (!userId) return;
  const payload = { slotIds: Array.from(selectedSlotIds) };
  try {
    setMessage('Запис…');
    await apiPut(`${API_BASE}/athleteselections/user/${userId}/replace`, payload);
    dirty = false;
    updateSummary();
    await refreshFee();
    setMessage('Записано.');
    setTimeout(()=> setMessage(''), 1200);
  } catch (e) {
    console.error(e);
    setMessage('Грешка при запис.');
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

        // съдържание + ред за капацитет/заети
        btn.innerHTML = `
          <div class="slot-title">${slot.groupName ? slot.groupName : 'Тренировка'}</div>
          <div class="slot-meta">
            ${Number.isFinite(slot.capacity)
              ? `Капацитет: <span class="cap">${slot.capacity}</span> • Записани: <span class="taken" data-slot-id="${slot.id}">—</span>`
              : `Записани: <span class="taken" data-slot-id="${slot.id}">—</span>`}
          </div>
        `;

        // tooltip
        btn.title = `${days[(slot.dayOfWeek-1)]} ${start}-${end}${slot.capacity ? ` • капацитет: ${slot.capacity}` : ''}`;

        // клик: ако е пълен и НЕ е мой и НЕ е селектиран → блокирай; иначе allow toggle
        btn.addEventListener('click', async () => {
          const id = parseInt(btn.dataset.slotId,10);
          const isSelected = selectedSlotIds.has(id);

          const info = await getSlotInfo(id, slot.capacity);
          const isFull = Number.isFinite(info.capacity) && info.count >= info.capacity;

          if (!isSelected && isFull && !info.mine) {
            return; // блокирай нов запис в чужд пълен слот
          }

          // toggle
          if (isSelected) {
            selectedSlotIds.delete(id);
            btn.classList.remove('selected');
          } else {
            selectedSlotIds.add(id);
            btn.classList.add('selected');
          }
          dirty = true;
          updateSummary();
        });

        cell.appendChild(btn);

        // след рендър: вземи count + mine и маркирай Full (и mine)
        (async ()=>{
          try{
            const info = await getSlotInfo(slot.id, slot.capacity);
            const takenEl = gridEl.querySelector(`.taken[data-slot-id="${slot.id}"]`);
            if (takenEl) takenEl.textContent = info.count;

            if (Number.isFinite(info.capacity) && info.count >= info.capacity){
              btn.classList.add('full');                 // визуално „пълен“
              if (takenEl) takenEl.style.color = '#dc2626';
              if (info.mine) btn.classList.add('mine');  // мой пълен слот (по желание стил)
            }
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
    const { user, savedHash } = payload;

    // валидирай хеша
    try {
      const currentHash = await hashUserData(user);
      if (currentHash !== savedHash) {
        redirectToIndex('Не бъди злонамерен <3');
        return;
      }
    } catch (err) {
      console.error('Грешка при хеширането:', err);
      redirectToIndex('Възникна грешка. Пренасочване...');
      return;
    }

    // Id-та остават само вътрешно
    userId = Number(user.id ?? user.Id ?? user.ID ?? 0) || null;
    clubId = Number(user.clubID ?? user.clubId ?? user.ClubID ?? user.ClubId ?? 0) || null;
    if (!userId || !clubId) {
      redirectToIndex('Липсват userId/clubId. Пренасочване...');
      return;
    }

    // Етикети: имена вместо числа
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
