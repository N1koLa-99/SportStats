/* ================== БАЗА / КОНФИГ ================== */
const API_BASE = 'https://localhost:7198';
let currentUser = null;

/* ================== УТИЛИТИ ================== */
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const apiBase = () => API_BASE;
const clubId  = () => currentUser?.clubID ?? 0;
const setStatus = (t) => { const s = $('#status'); if (s) s.textContent = t || ''; };

function redirectToIndex(msg){
  try { if (msg) alert(msg); } catch(_) {}
  window.location.href = '/';
}

// safe fetch helpers
async function safeText(r){ try{ return await r.text(); }catch{ return 'Грешка.'; } }
async function getJson(url){
  const r = await fetch(url);
  if(!r.ok) throw new Error(await safeText(r));
  return r.json();
}
async function sendJson(url, method, body){
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : null
  });
  if(!r.ok) throw new Error(await safeText(r));
  return r.status === 204 ? null : r.json();
}
const postJson = (u,b) => sendJson(u,'POST',b);
const putJson  = (u,b) => sendJson(u,'PUT',b);
const patch    = (u)   => sendJson(u,'PATCH');
const del      = async (u) => {
  const r = await fetch(u,{method:'DELETE'});
  if(!r.ok) throw new Error(await safeText(r));
  return null;
};

// Busy обвивка за бутони
async function withBusy(btn, fn){
  if(btn){ btn.disabled = true; btn.dataset._old = btn.textContent; btn.textContent = 'Работи…'; }
  try{ return await fn(); }
  finally{ if(btn){ btn.disabled = false; btn.textContent = btn.dataset._old || btn.textContent; } }
}

// 24h време (нормализира към HH:MM)
function toHHMM(input){
  if (!input) return '';
  const s = String(input).trim();

  // ISO '...T12:30:00'
  const isoMatch = s.match(/T(\d{2}):(\d{2})(?::\d{2})?/);
  if (isoMatch) return `${isoMatch[1]}:${isoMatch[2]}`;

  // HH:MM:SS
  const hms = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})$/);
  if (hms) return `${hms[1].padStart(2,'0')}:${hms[2]}`;

  // HH:MM
  const hm  = s.match(/^(\d{1,2}):(\d{2})$/);
  if (hm)  return `${hm[1].padStart(2,'0')}:${hm[2]}`;

  // HH:MM am/pm
  const ampm = s.match(/^(\d{1,2}):(\d{2})\s*([APap][Mm])$/);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = ampm[2];
    const isPM = /pm/i.test(ampm[3]);
    if (isPM && h !== 12) h += 12;
    if (!isPM && h === 12) h = 0;
    return `${String(h).padStart(2,'0')}:${m}`;
  }

  // извадка от стринг
  const any = s.match(/(\d{1,2}):(\d{2})/);
  if (any) return `${any[1].padStart(2,'0')}:${any[2]}`;

  return '';
}

// хелпър: нормализира time input в 24ч при blur/input
function normalizeTimeField(el){
  if (!el) return;
  const v = el.value;
  const hhmm = toHHMM(v);
  if (hhmm) {
    el.value = hhmm;
  } else {
    // по желание: alert('Невалиден час'); el.focus();
  }
}

const weekdayName = (n)=>({1:'Понеделник',2:'Вторник',3:'Сряда',4:'Четвъртък',5:'Петък',6:'Събота',7:'Неделя'})[n]||n;

// --- Транслитерация BG <-> LAT за търсене ---
function cyrToLat(s){
  const map = {
    'щ':'sht','ш':'sh','ч':'ch','ц':'ts','й':'y','ю':'yu','я':'ya','ь':'','ъ':'y','ж':'zh',
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','з':'z','и':'i','к':'k','л':'l','м':'m',
    'н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ѝ':'i'
  };
  return (s||'').toLowerCase().split('').map(ch=>map[ch] ?? ch).join('');
}
function latToCyr(s){
  let t = (s||'').toLowerCase();
  // важен ред: първо по-дългите комбинации
  t = t
    .replace(/sht/g,'щ')
    .replace(/sh/g,'ш')
    .replace(/zh/g,'ж')
    .replace(/ch/g,'ч')
    .replace(/ts/g,'ц')
    .replace(/yu/g,'ю')
    .replace(/ya/g,'я');
  const map = {
    'a':'а','b':'б','v':'в','g':'г','d':'д','e':'е','z':'з','i':'и','y':'й','k':'к','l':'л','m':'м',
    'n':'н','o':'о','p':'п','r':'р','s':'с','t':'т','u':'у','f':'ф','h':'х'
  };
  return t.split('').map(ch=>map[ch] ?? ch).join('');
}
function normFold(s){
  const x = (s||'').trim().toLowerCase();
  return {
    raw: x,
    cyr: latToCyr(x),
    lat: cyrToLat(x)
  };
}
function nameMatches(query, candidate){
  const q = normFold(query);
  const c = normFold(candidate);
  // съвпадение, ако която и да е форма се съдържа в която и да е форма
  const qForms = [q.raw, q.cyr, q.lat].filter(Boolean);
  const cForms = [c.raw, c.cyr, c.lat].filter(Boolean);
  for (const qa of qForms){
    for (const ca of cForms){
      if (ca.includes(qa)) return true;
    }
  }
  return false;
}

// КЕШ за снимки: userId -> objectURL | външен URL | null
const userPhotoCache = new Map();

// генерира fallback SVG с инициали (data URL)
function avatarFallbackDataUrl(name){
  const initials = (name || '')
    .split(/\s+/).filter(Boolean).slice(0,2)
    .map(x=>x[0]?.toUpperCase() || '').join('');
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'>
      <rect width='100%' height='100%' fill='#e5e7eb'/>
      <text x='50%' y='50%' dy='.35em' text-anchor='middle'
            font-family='Inter,Segoe UI,Arial,sans-serif'
            font-size='14' fill='#374151'>${initials || '?'}</text>
     </svg>`;
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

// дърпа снимка за userId; връща URL за <img src=...>
async function getProfilePhotoUrl(userId){
  if (userPhotoCache.has(userId)) return userPhotoCache.get(userId);
  const endpoint = `https://sportstatsapi.azurewebsites.net/api/Users/profilePicture/${userId}`;
  try{
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error('no image');

    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('application/json')){
      // ако API връща JSON с url поле
      const data = await res.json();
      const url = data?.url || data?.profileImageUrl || null;
      userPhotoCache.set(userId, url);
      return url;
    } else {
      // вероятно е image/* → blob → objectURL
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      userPhotoCache.set(userId, objUrl);
      return objUrl;
    }
  }catch{
    userPhotoCache.set(userId, null);
    return null;
  }
}



/* ================== АВТЕНТИКАЦИЯ ================== */
async function hashUserData(user) {
  const data = `${user.firstName}${user.lastName}${user.email}${user.gender}${user.roleID}${user.clubID}${user.profileImage_url}${user.id}${user.yearOfBirth}${user.statusID}`;
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

async function initAuth() {
  const userJson  = localStorage.getItem('user');
  const savedHash = localStorage.getItem('userHash');
  if (!userJson || !savedHash) {
    redirectToIndex("Невалидни данни. Пренасочване...");
    return false;
  }

  try {
    const user = JSON.parse(userJson);
    const currentHash = await hashUserData(user);
    if (currentHash !== savedHash) {
      redirectToIndex("Не бъди злонамерен <3");
      return false;
    }
    currentUser = user;
    return true;
  } catch (err) {
    console.error("Грешка при валидация:", err);
    redirectToIndex("Възникна грешка. Пренасочване...");
    return false;
  }
}

/* ================== ТАБОВЕ ================== */
function initTabs(){
  const tabs = $('#tabs');
  if (!tabs) return;
  tabs.addEventListener('click', (e)=>{
    const btn = e.target.closest('.tab'); if(!btn) return;
    $$('.tab').forEach(x=>x.classList.remove('active'));
    btn.classList.add('active');

    const tabId = btn.dataset.tab;
    $$('.tab-pane').forEach(p=>p.classList.remove('active'));
    $('#'+tabId).classList.add('active');
  });
}

/* ================== СЕЗОНИ ================== */
// кеш на сезони + активен
let seasonsCache = [];
let activeSeasonIdCache = null;

// дружелюбни селекти (скрит input → селект по име)
function hideInput(id){
  const el = $('#'+id);
  if (!el) return;
  try { el.type = 'hidden'; } catch { el.style.display = 'none'; }
}
function upsertSelectForInput(inputId, selectId, items, placeholder, autoPick){
  const input = $('#'+inputId);
  if(!input) return null;
  hideInput(inputId);

  let select = $('#'+selectId);
  if(!select){
    select = document.createElement('select');
    select.id = selectId;
    select.className = 'friendly-select';
    input.insertAdjacentElement('afterend', select);
  }

  select.innerHTML = '';
  const ph = document.createElement('option');
  ph.value = '';
  ph.textContent = placeholder || '— избери —';
  select.appendChild(ph);

  items.forEach(({id,label})=>{
    const opt = document.createElement('option');
    opt.value = String(id);
    opt.textContent = label;
    select.appendChild(opt);
  });

  if (input.value){
    const opt = Array.from(select.options).find(o => o.value === String(input.value));
    if (opt) select.value = opt.value;
  } else if (typeof autoPick === 'function') {
    const chosenId = autoPick(items);
    if (chosenId){
      select.value = String(chosenId);
      input.value  = String(chosenId);
    }
  }

  select.onchange = () => { input.value = select.value; };
  return select;
}

const getActiveSeasonId = () => activeSeasonIdCache ?? null;

async function loadSeasons(){
  const seasons = await getJson(`${apiBase()}/api/seasons/club/${clubId()}`);
  seasonsCache = seasons || [];
  activeSeasonIdCache = seasonsCache.find(s => !!s.IsActive)?.Id ?? null;

  // Таблица
  const tb = $('#tblSeasons tbody');
  if (tb){
    tb.innerHTML = '';
    seasons.forEach(s=>{
      const tr = document.createElement('tr');
    tr.innerHTML = `
  <td>${s.Name}</td>
  <td>${(s.StartDate||'').slice(0,10)} → ${(s.EndDate||'').slice(0,10)}</td>
  <td>${s.IsActive?'Да':'Не'}</td>
  <td>
    <button class="btnUseSeason" data-id="${s.Id}">Избери</button>
    <button class="btnToggleActive" data-id="${s.Id}" data-val="${s.IsActive?0:1}">
      ${s.IsActive?'Деактивирай':'Активирай'}
    </button>
    <button class="btnDelSeason" data-id="${s.Id}" data-name="${s.Name}"
      ${s.IsActive ? 'disabled title="Активен сезон не може да се трие"' : ''}>
      Изтрий
    </button>
  </td>`;

      tb.appendChild(tr);
    });

    $$('#tblSeasons .btnUseSeason').forEach(b=>{
      b.addEventListener('click', ()=>{
        const id = b.dataset.id;
        const input = $('#seasonIdMonths');
        if (input) input.value = id;
        setStatus(`SeasonId=${id} е избран за „Месеци“.`);
      });
    });

    $$('#tblSeasons .btnToggleActive').forEach(b=>{
      b.addEventListener('click', async ()=>{
        await withBusy(b, async ()=>{
          const bool = (b.dataset.val === '1') ? 'true' : 'false';
          await patch(`${apiBase()}/api/seasons/${b.dataset.id}/active?value=${bool}`);
          await loadSeasons();
        });
      });
    });
    $$('#tblSeasons .btnDelSeason').forEach(b=>{
  b.addEventListener('click', async ()=>{
    const id   = b.dataset.id;
    const name = b.dataset.name || `ID ${id}`;
    if (!confirm(`Да изтрия сезона "${name}"?\nТова действие е необратимо.`)) return;

    await withBusy(b, async ()=>{
      try{
        await del(`${apiBase()}/api/seasons/${id}`);
        await loadSeasons(); // рефреш на списъка
        setStatus(`Сезон "${name}" е изтрит.`);
      }catch(err){
        // Бекендът връща 409 при активен сезон или 404 ако липсва;
        // del() вече хвърля Error с текст от отговора – показваме го.
        alert(err?.message || err);
      }
    });
  });
});

  }

  // Селекти по име + автоподбор активен
  const items = seasons.map(s => ({
    id: s.Id,
    label: `${s.Name} (${(s.StartDate||'').slice(0,10)} → ${(s.EndDate||'').slice(0,10)})`,
    _isActive: !!s.IsActive
  }));
  const autoPickActive = (arr) => (arr.find(x=>x._isActive)?.id) ?? (arr[0]?.id || null);

  upsertSelectForInput('seasonIdMonths','seasonSelectMonths',items,'— сезон за месеци —',autoPickActive);
  upsertSelectForInput('feeSeasonId','seasonSelectForFee',items,'— сезон за цени —',autoPickActive);
}

async function createSeason(e){
  e.preventDefault();
  const payload = {
    ClubId: clubId(),
    Name: $('#seasonName').value.trim(),
    StartDate: $('#seasonStart').value,
    EndDate: $('#seasonEnd').value,
    IsActive: $('#seasonActive').checked
  };
  const btn = e.submitter;
  await withBusy(btn, async ()=>{
    await postJson(`${apiBase()}/api/seasons`, payload);
    e.target.reset();
    await loadSeasons();
  });
}

async function generateMonths(){
  const sidEl = $('#seasonIdMonths');
  const sid = sidEl ? parseInt(sidEl.value,10) : 0;
  if(!sid) return alert('Посочи сезон.');
  await postJson(`${apiBase()}/api/seasons/${sid}/months/generate?billable=true`, {});
  await loadMonths();
}

async function loadMonths(){
  const sidEl = $('#seasonIdMonths');
  const sid = sidEl ? parseInt(sidEl.value,10) : 0;
  if(!sid) return alert('Посочи сезон.');
  const rows = await getJson(`${apiBase()}/api/seasons/${sid}/months`);
  const tb = $('#tblMonths tbody'); if(!tb) return;
  tb.innerHTML = '';
  rows.forEach(m=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${m.YearMonth}</td>
      <td>${m.IsBillable?'Да':'Не'}</td>
      <td><button class="btnToggleMonth" data-id="${m.Id}" data-val="${m.IsBillable?0:1}">${m.IsBillable?'Скрий':'Покажи'}</button></td>`;
    tb.appendChild(tr);
  });
  $$('#tblMonths .btnToggleMonth').forEach(b=>{
    b.addEventListener('click', async ()=>{
      await withBusy(b, async ()=>{
        const bool = (b.dataset.val === '1') ? 'true' : 'false';
        await patch(`${apiBase()}/api/seasons/months/${b.dataset.id}/billable?value=${bool}`);
        await loadMonths();
      });
    });
  });
}

/* ================== ЦЕНОРАЗПИС ================== */
function upsertStaticSelectForInput(inputId, selectId, options, placeholder, autoPickIndex=0){
  const items = options.map(o => typeof o === 'object' ? o : ({ id: o, label: String(o) }));
  return upsertSelectForInput(inputId, selectId, items, placeholder, () => items[autoPickIndex]?.id ?? null);
}

async function loadFeePlans(e){
  const sidEl = $('#feeSeasonId');
  const sid = sidEl ? sidEl.value.trim() : '';
  const url = `${apiBase()}/api/feeplans/club/${clubId()}${sid?`?seasonId=${sid}`:''}`;
  const btn = e?.currentTarget;
  await withBusy(btn, async ()=>{
    const rows = await getJson(url);
    const tb = $('#tblFeePlans tbody'); if(!tb) return;
    tb.innerHTML='';
    rows.forEach(p=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.TrainingsPerWeek}</td>
        <td>${Number(p.MonthlyFee).toFixed(2)}</td>
        <td>${(p.ValidFrom||'').slice(0,10)}</td>
        <td>${p.ValidTo?(p.ValidTo.slice(0,10)):""}</td>`;
      tr.addEventListener('click', ()=>{
        $('#feeId').value = p.Id;
        $('#feeTPW').value = p.TrainingsPerWeek;
        $('#feeTPWSelect') && ($('#feeTPWSelect').value = String(p.TrainingsPerWeek));
        $('#feePrice').value = p.MonthlyFee;
        $('#feeFrom').value = (p.ValidFrom||'').slice(0,10);
        $('#feeTo').value   = p.ValidTo ? p.ValidTo.slice(0,10) : '';
        $('#feeClubSeasonId').value = p.ClubSeasonId ?? '';
        const seasonSel = $('#seasonSelectForFee');
        if (seasonSel && p.ClubSeasonId) seasonSel.value = String(p.ClubSeasonId);
      });
      tb.appendChild(tr);
    });
  });
}

async function submitFeePlan(e){
  e.preventDefault();
  const id = $('#feeId').value;
  const tpw = parseInt($('#feeTPW').value,10);
  const price = parseFloat($('#feePrice').value);
  if (isNaN(tpw) || tpw<1 || tpw>7) return alert('Избери тренировки/седмица 1–7.');
  if (isNaN(price) || price<=0) return alert('Въведи валидна цена.');

  const payload = {
    Id: id? parseInt(id,10): 0,
    ClubId: clubId(),
    TrainingsPerWeek: tpw,
    MonthlyFee: price,
    ValidFrom: $('#feeFrom').value,
    ValidTo: $('#feeTo').value || null,
    ClubSeasonId: $('#feeClubSeasonId').value || null
  };
  const btn = e.submitter;
  await withBusy(btn, async ()=>{
    if(id) await putJson(`${apiBase()}/api/feeplans/${id}`, payload);
    else    await postJson(`${apiBase()}/api/feeplans`, payload);
    e.target.reset();
    const tpwSel = $('#feeTPWSelect'); if(tpwSel){ tpwSel.value='1'; $('#feeTPW').value='1'; }
    await loadFeePlans();
  });
}

async function archiveFee(e){
  const id = $('#feeId').value;
  const validTo = $('#feeTo').value;
  if(!id || !validTo) return alert('Избери план и попълни „В сила до“.');
  const btn = e?.currentTarget;
  await withBusy(btn, async ()=>{
    await patch(`${apiBase()}/api/feeplans/${id}/archive?validTo=${encodeURIComponent(validTo)}`);
    await loadFeePlans();
  });
}

/* ================== ГРАФИК (ГРУПИ + СЛОТОВЕ) ================== */
// кеш на групи (Id→обект) и име→Id
let groupsCache = [];
let groupsByName = new Map();
let groupsById   = new Map();

async function refreshGroupsCache(){
  groupsCache = await getJson(`${apiBase()}/api/traininggroups/club/${clubId()}`);
  groupsByName.clear(); groupsById.clear();
  for (const g of groupsCache) {
    groupsById.set(g.Id, g);
    groupsByName.set(g.Name.trim().toLowerCase(), g.Id);
  }
}

// намира или създава група по име
async function ensureGroupByName(name, level){
  const key = name.trim().toLowerCase();
  if (groupsByName.has(key)) return groupsByName.get(key);

  // създай
  const payload = {
    Id: 0,
    ClubId: clubId(),
    Name: name.trim(),
    Description: levelToDescription(level) // пазим нивото и в описанието
  };
  const newId = await postJson(`${apiBase()}/api/traininggroups`, payload);
  await refreshGroupsCache();
  return parseInt(newId,10);
}

function levelToDescription(level){
  if (level === 'pro') return 'Състезатели';
  if (level === 'adv') return 'Напреднали';
  if (level === 'beg') return 'Начинаещи';
  return null;
}

function levelFromGroup(g){
  const text = `${g?.Description ?? ''} ${g?.Name ?? ''}`.toLowerCase();
  if (text.includes('състезател')) return 'pro';
  if (text.includes('напредн'))    return 'adv';
  if (text.includes('начина'))     return 'beg';
  return '';
}

// помощни иконки
const ico = { clock:'⏱️', pin:'📍', users:'👥' };

// връща CSS клас според нивото
function badgeClass(level){
  return level === 'pro' ? 'slot-card--pro'
       : level === 'adv' ? 'slot-card--adv'
       : level === 'beg' ? 'slot-card--beg'
       : '';
}

// за сортиране по време HH:MM
function hhmmToMinutes(hhmm){
  if (!hhmm) return 0;
  const [h,m] = hhmm.split(':').map(Number);
  return (h||0)*60 + (m||0);
}

async function loadWeekSchedule(){
  if (groupsCache.length === 0) await refreshGroupsCache();

  const list = await getJson(`${apiBase()}/api/scheduleslots/club/${clubId()}`);

  // обнови cache за търсене
  slotsCache = Array.isArray(list) ? list.map(s => ({
    Id: s.Id, GroupId: s.GroupId, Weekday: s.Weekday, StartTime: s.StartTime, EndTime: s.EndTime
  })) : [];

  // изчисти колоните
  $$('#weekGrid .day-list').forEach(dl => dl.innerHTML = '');

  // сортирай по ден -> начало
  list.sort((a,b)=>{
    if (a.Weekday !== b.Weekday) return a.Weekday - b.Weekday;
    return hhmmToMinutes(toHHMM(a.StartTime)) - hhmmToMinutes(toHHMM(b.StartTime));
  });

  for (const s of list) {
    const g = groupsById.get(s.GroupId);
    const level = levelFromGroup(g);
    const levelClass = badgeClass(level);
    const start = toHHMM(s.StartTime);
    const end   = toHHMM(s.EndTime);

    const card = document.createElement('article');
    card.className = `slot-card ${levelClass}`;
    card.setAttribute('role','listitem');
    card.dataset.slotId = String(s.Id);

    const levelLabel = level === 'pro' ? 'Състезатели'
                      : level === 'adv' ? 'Напреднали'
                      : level === 'beg' ? 'Начинаещи'
                      : 'Група';

    card.innerHTML = `
      <header class="slot-card__head">
        <div class="slot-card__title-wrap">
          <strong class="slot-card__title">${g?.Name ?? 'Група без име'}</strong>
          <span class="slot-chip">${levelLabel}</span>
        </div>
        <button class="btn ghost btnDelSlot" data-id="${s.Id}" title="Изтрий">✕</button>
      </header>

      <div class="slot-card__row">
        <span class="slot-card__icon">${ico.clock}</span>
        <span class="slot-card__text">${start} – ${end}</span>
      </div>

      ${s.Location ? `
        <div class="slot-card__row">
          <span class="slot-card__icon">${ico.pin}</span>
          <span class="slot-card__text">${s.Location}</span>
        </div>` : ''}

      <div class="slot-card__row">
        <span class="slot-card__icon">${ico.users}</span>
        <span class="slot-card__text">
          ${Number.isFinite(s.Capacity)
            ? `Капацитет: ${s.Capacity} • Записани: <strong class="slot-taken" data-slot-id="${s.Id}">—</strong>`
            : `Записани: <strong class="slot-taken" data-slot-id="${s.Id}">—</strong>`}
        </span>
      </div>
    `;

    // Изтриване (без да отваря поповър)
    card.querySelector('.btnDelSlot').addEventListener('click', async (ev)=>{
      ev.stopPropagation();
      if (!confirm('Да изтрия ли слота?')) return;
      await del(`${apiBase()}/api/scheduleslots/${s.Id}`);
      await loadWeekSchedule();
    });

    // Клик -> поповър (или alert)
    card.addEventListener('click', async ()=>{
      const title = `${g?.Name ?? 'Група'} • ${weekdayName(s.Weekday)} ${start}–${end}`;
      const pop = document.getElementById('slotPopover');
      if (pop) {
        await showSlotPopover(s.Id, card, title);
      } else {
        try {
          const list = await getSlotAttendees(s.Id);
          if (!list || list.length === 0) {
            alert(`${title}\n\nНяма записани.`);
          } else {
            const names = list.map(u => `${u.FirstName} ${u.LastName}`.trim()).join('\n');
            alert(`${title}\n\nЗаписани (${list.length}):\n${names}`);
          }
        } catch(err) {
          alert(`Грешка при зареждане на записаните: ${err?.message || err}`);
        }
      }
    });

    // Hover поповър
    card.addEventListener('mouseenter', ()=>{
      const title = `${g?.Name ?? 'Група'} • ${weekdayName(s.Weekday)} ${start}–${end}`;
      scheduleShowPopover(s.Id, card, title);
    });
    card.addEventListener('mouseleave', scheduleHidePopover);

    const col = $(`.day-col[data-weekday="${s.Weekday}"] .day-list`);
    if (col) col.appendChild(card);

    // След рендър: попълни броя „Записани“ и маркирай, ако е пълен
    (async ()=>{
      try{
        const attendees = await getSlotAttendees(s.Id);
        const taken = attendees?.length ?? 0;
        const span = document.querySelector(`.slot-taken[data-slot-id="${s.Id}"]`);
        if (span) span.textContent = taken;

        if (Number.isFinite(s.Capacity) && taken >= s.Capacity) {
          card.classList.add('slot-full');           // по желание стил за пълен слот
          if (span) span.style.color = '#dc2626';    // оцветяване на брояча
        }
      }catch(_){}
    })();
  }
}




// обработчик на „+ Добави тук“
function bindAddHere(){
  $$('#weekGrid .add-here').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const day = btn.dataset.weekday;
      const sel = $('#quickWeekday');
      if (sel) sel.value = String(day);
      $('#quickGroupName')?.focus();
      window.scrollTo({ top: $('#formQuickSlot').offsetTop - 20, behavior: 'smooth' });
    });
  });
}

// форма „Бързо добавяне“
async function submitQuickSlot(e){
  e.preventDefault();
  const btn = e.submitter;

  normalizeTimeField($('#quickStart'));
  normalizeTimeField($('#quickEnd'));

  const name   = $('#quickGroupName').value.trim();
  const level  = $('#quickLevel').value;
  const day    = parseInt($('#quickWeekday').value,10);
  const start  = $('#quickStart').value;
  const end    = $('#quickEnd').value;
  const loc    = $('#quickLocation').value.trim();
  const capStr = $('#quickCap').value.trim();
  const cap    = capStr ? parseInt(capStr,10) : null;

  if (!name) return alert('Въведи име на група.');
  if (!level) return alert('Избери ниво.');
  if (!day || day<1 || day>7) return alert('Избери ден.');
  if (!start || !end) return alert('Попълни начален и краен час.');
  if (end <= start) return alert('Край трябва да е след Начало.');
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return alert('Невалиден формат на час (използвай HH:MM).');

  await withBusy(btn, async ()=>{
    const groupId = await ensureGroupByName(name, level);
    const payload = {
      GroupId: groupId,
      ClubSeasonId: null,
      Weekday: day,
      StartTime: start + ':00',
      EndTime: end   + ':00',
      Location: loc || null,
      Capacity: Number.isFinite(cap) ? cap : null
    };
    await postJson(`${apiBase()}/api/scheduleslots`, payload);
    await loadWeekSchedule();
    $('#quickStart').value=''; $('#quickEnd').value='';
    $('#quickLocation').value=''; $('#quickCap').value='';
  });
}

function clearQuickForm(){
  $('#formQuickSlot')?.reset();
}

/* ================== ПЛАЩАНИЯ & СПРАВКИ ================== */
function initDefaultYM(){
  const ym = $('#ym');
  if (!ym) return;
  const d = new Date();
  const m = String(d.getMonth()+1).padStart(2,'0');
  ym.value = `${d.getFullYear()}-${m}`;
  ym.addEventListener('input', ()=>{
    ym.value = ym.value.replace(/[^\d-]/g,'').slice(0,7);
  });
}

// колатор за BG азбучен ред
const nameCollator = new Intl.Collator('bg', { sensitivity:'base', ignorePunctuation:true });
// формат левове
const fmt = (n) => Number(n || 0).toFixed(2);

// събира статистика за конкретен месец: очаквано, платено, неплатили
async function getMonthStats(ym) {
  const seasonId = getActiveSeasonId();

  // 1) Очаквано (по правилната логика per season, per user)
  const expectedRes = await getJson(
    `${apiBase()}/api/Payments/expected/by-user?clubId=${clubId()}&ym=${encodeURIComponent(ym)}${seasonId?`&seasonId=${seasonId}`:''}`
  );
  const expected = Number(expectedRes?.Total || 0);

  // 2) Платено: този ендпойнт е вече по месец; ако някъде връща повече – изрично филтрираме.
  const paidRowsAll = await getJson(`${apiBase()}/api/payments/month/club/${clubId()}?ym=${encodeURIComponent(ym)}`);
  const paidRows = Array.isArray(paidRowsAll)
    ? paidRowsAll.filter(p => (p.YearMonth || p.yearMonth) === ym)
    : [];
  const paidTotal = paidRows.reduce((sum, p) => sum + Number(p.AmountPaid || p.amountPaid || 0), 0);

  // 3) Неплатили (старият ендпойнт; може да не е сезон-осъзнат, но върши работа за броя)
  const unpaidRows = await getJson(`${apiBase()}/api/payments/unpaid/club/${clubId()}?ym=${encodeURIComponent(ym)}`);
  const unpaidCount = (unpaidRows || []).length;

  console.debug('[getMonthStats]', { ym, expectedRes, expected, paidRows, paidTotal, unpaidCount });

  return { expected, paidTotal, unpaidCount, paidCount: paidRows.length };
}

// визуална лента с обобщение над таблицата с неплатили
function renderUnpaidSummary(stats, ym) {
  const hostTable = document.getElementById('tblUnpaid');
  if (!hostTable) return;

  let box = document.getElementById('unpaidSummary');
  if (!box) {
    box = document.createElement('div');
    box.id = 'unpaidSummary';
    box.style.margin = '10px 0';
    box.style.padding = '10px 12px';
    box.style.borderRadius = '8px';
    box.style.border = '1px solid #e5e7eb';
    box.style.background = '#fff8e1';
    hostTable.insertAdjacentElement('beforebegin', box);
  }

  const diff = stats.expected - stats.paidTotal;
  const danger = diff > 0;

  box.style.background = danger ? '#fff8e1' : '#ecfdf5';
  box.style.borderColor = danger ? '#f59e0b' : '#10b981';

  box.innerHTML = `
    <strong>${ym}</strong> — очакван приход: <strong>${fmt(stats.expected)} лв</strong>,
    платено до момента: <strong>${fmt(stats.paidTotal)} лв</strong>,
    неплатили: <strong>${stats.unpaidCount}</strong>.
    ${danger ? 'Има още неплатени такси.' : 'Всичко е платено.'}
  `;
}

async function loadUnpaid(e){
  const ymEl = $('#ym'); const ym = ymEl ? ymEl.value.trim() : '';
  if(!/^\d{4}-\d{2}$/.test(ym)) return alert('Въведи месец във формат YYYY-MM.');
  const btn = e?.currentTarget;

  await withBusy(btn, async ()=>{
    const [rows, stats] = await Promise.all([
      getJson(`${apiBase()}/api/payments/unpaid/club/${clubId()}?ym=${encodeURIComponent(ym)}`),
      getMonthStats(ym)
    ]);

    // обобщение
    renderUnpaidSummary(stats, ym);

    // сортиране по Фамилия, Име
    rows.sort((a, b) => {
      const na = `${a.LastName ?? ''} ${a.FirstName ?? ''}`.trim();
      const nb = `${b.LastName ?? ''} ${b.FirstName ?? ''}`.trim();
      return nameCollator.compare(na, nb);
    });

    const tb = $('#tblUnpaid tbody'); if(!tb) return;
    tb.innerHTML = '';
    rows.forEach(u=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${u.FirstName} ${u.LastName}</td>
        <td><button class="btnMarkPaid" data-id="${u.Id}" data-name="${u.FirstName} ${u.LastName}">Маркирай платено</button></td>`;
      tb.appendChild(tr);
    });

    // потвърждение преди маркиране платено + автоматично обновяване
    $$('#tblUnpaid .btnMarkPaid').forEach(b=>{
      b.addEventListener('click', async ()=>{
        const s = await getMonthStats(ym);
        const msg = [
          `Ще маркираш платено за: ${b.dataset.name}`,
          `Месец: ${ym}`,
          `Очакван приход: ${fmt(s.expected)} лв`,
          `В касата сега: ${fmt(s.paidTotal)} лв`,
          `Оставащи неплатили: ${s.unpaidCount}`,
          '',
          'Да продължа?'
        ].join('\n');

        if (!confirm(msg)) return;

        await withBusy(b, async ()=>{
          await postJson(`${apiBase()}/api/payments/mark-paid`, {
            ClubId: clubId(),
            UserId: parseInt(b.dataset.id,10),
            YearMonth: ym,
            RecordedByUserId: null
          });
          await loadUnpaid(); // рефреш след успех
        });
      });
    });
  });
}
async function loadPaid(e){
  const ymEl = $('#ym'); const ym = ymEl ? ymEl.value.trim() : '';
  if(!/^\d{4}-\d{2}$/.test(ym)) return alert('Въведи месец във формат YYYY-MM.');
  const btn = e?.currentTarget;

  await withBusy(btn, async ()=>{
    // 1) списък платили
    const rows = await getJson(`${apiBase()}/api/payments/paid/club/${clubId()}?ym=${encodeURIComponent(ym)}`);

    // 2) сортиране по Фамилия, Име
    rows.sort((a, b) => {
      const na = `${a.LastName ?? ''} ${a.FirstName ?? ''}`.trim();
      const nb = `${b.LastName ?? ''} ${b.FirstName ?? ''}`.trim();
      return nameCollator.compare(na, nb);
    });

    // 3) рендер
    const tb = $('#tblPaid tbody'); if(!tb) return;
    tb.innerHTML = '';
    rows.forEach(u=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${u.FirstName} ${u.LastName}</td>
        <td>
          <button class="btnMarkUnpaid" data-id="${u.Id}" data-name="${u.FirstName} ${u.LastName}">
            Маркирай неплатено
          </button>
        </td>`;
      tb.appendChild(tr);
    });

    // 4) обработчик: „Маркирай неплатено“
    $$('#tblPaid .btnMarkUnpaid').forEach(b=>{
      b.addEventListener('click', async ()=>{
        const msg = [
          `Ще върнеш в неплатено: ${b.dataset.name}`,
          `Месец: ${ym}`,
          '',
          'Да продължа?'
        ].join('\n');
        if (!confirm(msg)) return;

        await withBusy(b, async ()=>{
          await postJson(`${apiBase()}/api/payments/mark-unpaid`, {
            ClubId: clubId(),
            UserId: parseInt(b.dataset.id,10),
            YearMonth: ym
          });
          // след успех рефреш на платили + опционално и на неплатили (ако е заредена)
          await loadPaid();
          // ако имаш заредена таблица с неплатили – рефрешни и нея:
          try { await loadUnpaid(); } catch(_) {}
        });
      });
    });
  });
}


// Очакван приход — вече по избрания месец и активния сезон
async function loadExpected(e){
  const ym = ($('#ym')?.value || '').trim();
  if(!/^\d{4}-\d{2}$/.test(ym)) return alert('Въведи месец във формат YYYY-MM.');
  const seasonId = getActiveSeasonId();
  const btn = e?.currentTarget;

  await withBusy(btn, async ()=>{
    const res = await getJson(
      `${apiBase()}/api/Payments/expected/by-user?clubId=${clubId()}&ym=${encodeURIComponent(ym)}${seasonId?`&seasonId=${seasonId}`:''}`
    );

    const tb = $('#tblExpected tbody'); if(!tb) return;
    tb.innerHTML='';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${res?.YearMonth || ym}</td><td>${res?.Count ?? 0}</td><td>${fmt(res?.Total ?? 0)}</td>`;
    tb.appendChild(tr);
  });
}

async function loadNoSelections(e){
  const btn = e?.currentTarget;
  await withBusy(btn, async ()=>{
    const rows = await getJson(`${apiBase()}/api/athleteselections/without?clubId=${clubId()}`);
    const tb = $('#tblNoSel tbody'); if(!tb) return;
    tb.innerHTML='';
    rows.forEach(u=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${u.Id}</td><td>${u.FirstName} ${u.LastName}</td>`;
      tb.appendChild(tr);
    });
  });
}

/* ===== 24h time picker (polyfill) ===== */
function attach24hPicker(inputId, stepMinutes = 5) {
  const input = document.getElementById(inputId);
  if (!input) return;

  // скрий native time input, ще го пълним ние (HH:MM)
  input.type = 'hidden';

  const wrap = document.createElement('div');
  wrap.className = 'time24-wrap';

  // Часове 00..23
  const selH = document.createElement('select');
  selH.className = 'time24-hour';
  for (let h = 0; h <= 23; h++) {
    const opt = document.createElement('option');
    opt.value = String(h).padStart(2, '0');
    opt.textContent = opt.value; // 00..23
    selH.appendChild(opt);
  }

  // Минути 00, step, 55
  const selM = document.createElement('select');
  selM.className = 'time24-minute';
  for (let m = 0; m < 60; m += stepMinutes) {
    const opt = document.createElement('option');
    opt.value = String(m).padStart(2, '0');
    opt.textContent = opt.value; // 00..59
    selM.appendChild(opt);
  }

  // ако имаш предварителна стойност HH:MM — избери я
  if (input.value && /^\d{2}:\d{2}$/.test(input.value)) {
    const [hh, mm] = input.value.split(':');
    if ([...selH.options].some(o => o.value === hh)) selH.value = hh;
    if ([...selM.options].some(o => o.value === mm)) selM.value = mm;
  }

  function sync() {
    input.value = `${selH.value}:${selM.value}`;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  selH.addEventListener('change', sync);
  selM.addEventListener('change', sync);

  // първоначална синхронизация
  sync();

  // вмъкни селектите след скритото поле
  wrap.appendChild(selH);
  wrap.appendChild(selM);
  input.insertAdjacentElement('afterend', wrap);
}

// малък debounce
function debounce(fn, delay=250){
  let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), delay); };
}

// кеш на последно заредените слотове за търсене
let slotsCache = []; // [{ Id, GroupId, Weekday, StartTime, EndTime }]

// инжектира поле за търсене над #weekGrid
function ensureSearchUI(){
  const host = document.getElementById('weekGrid');
  if (!host) return;

  // ако вече е създадено – не дублираме
  if (document.getElementById('attendeeSearchBox')) return;

  const box = document.createElement('div');
  box.id = 'attendeeSearchBox';
  box.innerHTML = `
    <input id="attendeeSearch" type="search" placeholder="Търси по име (мин. 2 букви)..." autocomplete="off" />
    <div id="attendeeSearchResults"></div>
  `;
  host.insertAdjacentElement('beforebegin', box);

  const input = document.getElementById('attendeeSearch');
  input.addEventListener('input', debounce(()=> runAttendeeSearch(input.value), 300));
}

// визуализация на резултатите
function renderAttendeeResults(results, query){
  const wrap = document.getElementById('attendeeSearchResults');
  if (!wrap) return;
  wrap.innerHTML = '';

  if (!query || query.trim().length < 2){
    wrap.innerHTML = `<div class="muted">Въведи поне 2 букви за търсене.</div>`;
    return;
  }
  if (!results || results.length === 0){
    wrap.innerHTML = `<div class="muted">Няма съвпадения.</div>`;
    return;
  }

  // Първо – скелет
  results.forEach(r=>{
    const div = document.createElement('div');
    div.className = 'result-item';
    div.innerHTML = `
      <img class="avatar" alt="" data-user-id="${r.userId}" src="${avatarFallbackDataUrl(r.name)}" />
      <div>
        <div><strong>${r.name}</strong></div>
        <div class="meta">${r.groupLabel} • ${r.weekdayLabel} ${r.start}–${r.end}</div>
      </div>
    `;
    div.addEventListener('click', ()=>{
      const card = document.querySelector(`.slot-card[data-slot-id="${r.slotId}"]`);
      if (card){
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const title = `${r.groupLabel} • ${r.weekdayLabel} ${r.start}–${r.end}`;
        const pop = document.getElementById('slotPopover');
        if (pop) showSlotPopover(r.slotId, card, title).catch(console.error);
      }
    });
    wrap.appendChild(div);
  });

  // После – асинхронно зареждаме снимките
  (async ()=>{
    for (const r of results){
      const url = await getProfilePhotoUrl(r.userId);
      const img = wrap.querySelector(`img[data-user-id="${r.userId}"]`);
      if (img && url) img.src = url; // fallback остава, ако няма снимка
    }
  })();
}

showSlotPopover

// основна логика за търсене по име: обхожда всички слотове, кеширайки списъците
async function runAttendeeSearch(query){
  const q = (query || '').trim().toLowerCase();
  if (q.length < 2){
    renderAttendeeResults([], query);
    return;
  }

  // взимаме attendees за всеки слот (ползва кеша slotAttendeesCache от твоя код)
  const out = [];
  // ограничаване на паралелизма, за да не изстреляме стотици заявки наведнъж
  const batchSize = 10;
  for (let i=0; i<slotsCache.length; i+=batchSize){
    const batch = slotsCache.slice(i, i+batchSize);
    const promises = batch.map(async s=>{
      try{
        const attendees = await getSlotAttendees(s.Id);
        const matches = attendees.filter(u => nameMatches(query, `${u.FirstName} ${u.LastName}`));
        if (matches.length > 0){
          const g = groupsById.get(s.GroupId);
          const groupLabel = g?.Name ?? 'Група';
          const weekdayLabel = weekdayName(s.Weekday);
          const start = toHHMM(s.StartTime);
          const end   = toHHMM(s.EndTime);
          for (const u of matches){
        out.push({
  slotId: s.Id,
  userId: u.UserId,                         // НОВО
  name: `${u.FirstName} , ${u.LastName}`.trim(),
  groupLabel,
  weekdayLabel,
  start, end
});

          }
        }
      }catch(e){
        // игнор за конкретния слот
      }
    });
    await Promise.all(promises);
  }

  // по избор: сортираме по име, после по ден/час
  out.sort((a,b)=>{
    const byName = a.name.localeCompare(b.name, 'bg', { sensitivity:'base' });
    if (byName) return byName;
    if (a.weekdayLabel !== b.weekdayLabel) return a.weekdayLabel.localeCompare(b.weekdayLabel, 'bg');
    if (a.start !== b.start) return a.start.localeCompare(b.start);
    return 0;
  });

  renderAttendeeResults(out, query);
}

/* ================== BIND / BOOTСТАРТ ================== */
function bind(){
  initTabs();
  initDefaultYM();

  // Сезони
  $('#formSeason')?.addEventListener('submit', createSeason);
  $('#btnGenMonths')?.addEventListener('click', generateMonths);
  $('#btnLoadMonths')?.addEventListener('click', loadMonths);
  $('#btnLoadPaid')?.addEventListener('click', loadPaid);


  // Цени
  upsertStaticSelectForInput('feeTPW','feeTPWSelect',
    [1,2,3,4,5,6,7].map(n=>({id:n,label:`${n} трен./седмица`})),
    '— избери —', 0
  );
  $('#btnLoadFeePlans')?.addEventListener('click', loadFeePlans);
  $('#formFeePlan')?.addEventListener('submit', submitFeePlan);
  $('#btnArchiveFee')?.addEventListener('click', archiveFee);

  // График
  $('#formQuickSlot')?.addEventListener('submit', submitQuickSlot);
  $('#btnClearQuick')?.addEventListener('click', clearQuickForm);
  bindAddHere();

  // 24h UX
  const startEl = $('#quickStart');
  const endEl   = $('#quickEnd');
  if (startEl){
    startEl.setAttribute('step','60');
    startEl.addEventListener('blur',  ()=> normalizeTimeField(startEl));
    startEl.addEventListener('change',()=> normalizeTimeField(startEl));
    startEl.addEventListener('input', ()=> normalizeTimeField(startEl));
  }
  if (endEl){
    endEl.setAttribute('step','60');
    endEl.addEventListener('blur',  ()=> normalizeTimeField(endEl));
    endEl.addEventListener('change',()=> normalizeTimeField(endEl));
    endEl.addEventListener('input', ()=> normalizeTimeField(endEl));
  }

  attach24hPicker('quickStart', 5);
  attach24hPicker('quickEnd',   5);

  // Плащания / справки
  $('#btnLoadUnpaid')?.addEventListener('click', loadUnpaid);
  $('#btnLoadExpected')?.addEventListener('click', loadExpected);
  $('#btnLoadNoSelections')?.addEventListener('click', loadNoSelections);
}

async function bootstrap(){
  const ok = await initAuth();
  if (!ok) return;

  bind();

  // НОВО: инжектирай търсачката
  ensureSearchUI();

  try{
    setStatus('Зареждам…');
    await loadSeasons();
    await refreshGroupsCache();
    await loadWeekSchedule();
    await loadFeePlans();
    setStatus('Готово');
  }catch(e){
    console.error(e);
    setStatus('Грешка');
    alert(e.message || e);
  }
}


/* ---------- Hover popover: избрали слота ---------- */
const slotAttendeesCache = new Map(); // slotId -> [{UserId, FirstName, LastName}]
const hoverState = { showTimer: null, hideTimer: null };

async function getSlotAttendees(slotId){
  const url = `${apiBase()}/api/athleteselections/slot/${slotId}`;
  if (slotAttendeesCache.has(slotId)) return slotAttendeesCache.get(slotId);
  const rows = await getJson(url);
  slotAttendeesCache.set(slotId, rows);
  return rows;
}

function positionPopover(anchorEl){
  const pop = document.getElementById('slotPopover');
  if (!pop || !anchorEl) return;

  pop.hidden = false;
  pop.style.visibility = 'hidden';
  pop.style.position = 'fixed';

  const rect = anchorEl.getBoundingClientRect();
  const gap = 8;

  let top  = rect.bottom + gap;
  let left = rect.left;

  const maxLeft = window.innerWidth - pop.offsetWidth - 8;
  const maxTop  = window.innerHeight - pop.offsetHeight - 8;

  left = Math.max(8, Math.min(left, maxLeft));
  top  = Math.max(8, Math.min(top, maxTop));

  pop.style.left = `${left}px`;
  pop.style.top  = `${top}px`;
  pop.style.visibility = 'visible';
}

async function showSlotPopover(slotId, anchorEl, titleText){
  const pop = document.getElementById('slotPopover');
  if (!pop) return;

  const list  = await getSlotAttendees(slotId); // [{UserId, FirstName, LastName}]
  const title = document.getElementById('slotPopoverTitle');
  const count = document.getElementById('slotPopoverCount');
  const ul    = document.getElementById('slotPopoverList');

  if (title) title.textContent = titleText || 'Група';
  if (count) count.textContent = list.length;

  if (ul){
    if (!list || list.length === 0){
      ul.innerHTML = `<li class="muted">Няма записани.</li>`;
    } else {
      // първо рендерираме скелет (име на един ред + евентуален аватар плейсхолдър)
      ul.innerHTML = list.map(u => {
        const fullName = `${u.FirstName} ${u.LastName}`.trim();
        // ако имаш avatarFallbackDataUrl, ползвай го; иначе празен src
        const fallback = (typeof avatarFallbackDataUrl === 'function')
          ? avatarFallbackDataUrl(fullName)
          : '';
        return `
          <li class="attendee-row">
            ${typeof getProfilePhotoUrl === 'function'
              ? `<img class="avatar" alt="" data-user-id="${u.UserId}" src="${fallback}" />`
              : ''
            }
            <span class="attendee-name">${fullName}</span>
          </li>`;
      }).join('');

      // асинхронно до-зареждаме реалните снимки, ако имаме хелпъра
      if (typeof getProfilePhotoUrl === 'function'){
        (async ()=>{
          for (const u of list){
            try{
              const url = await getProfilePhotoUrl(u.UserId);
              if (url){
                const img = ul.querySelector(`img[data-user-id="${u.UserId}"]`);
                if (img) img.src = url;
              }
            }catch(_){}
          }
        })();
      }
    }
  }

  positionPopover(anchorEl);
}


function scheduleShowPopover(slotId, anchorEl, titleText){
  clearTimeout(hoverState.hideTimer);
  clearTimeout(hoverState.showTimer);
  hoverState.showTimer = setTimeout(()=>{
    showSlotPopover(slotId, anchorEl, titleText).catch(console.error);
  }, 220);
}

function scheduleHidePopover(){
  clearTimeout(hoverState.showTimer);
  clearTimeout(hoverState.hideTimer);
  hoverState.hideTimer = setTimeout(()=>{
    const pop = document.getElementById('slotPopover');
    if (pop) pop.hidden = true;
  }, 180);
}

(function wirePopoverHover(){
  const pop = document.getElementById('slotPopover');
  const close = document.getElementById('slotPopoverClose');
  if (!pop) return;

  pop.addEventListener('mouseenter', ()=> clearTimeout(hoverState.hideTimer));
  pop.addEventListener('mouseleave', scheduleHidePopover);
  if (close) close.addEventListener('click', ()=> { pop.hidden = true; });
})();

document.addEventListener('DOMContentLoaded', bootstrap);
