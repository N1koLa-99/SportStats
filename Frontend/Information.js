// ====================== ГЛОБАЛНО СЪСТОЯНИЕ ======================
const appState = {
  user: null,
  clubUsers: [],
  disciplines: [],
  charts: {},            // id -> Chart instance
  lastNormatives: []     // последно филтрирани нормативи за текущия атлет/дисциплина
};

// ====================== УТИЛИТИ ======================
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function hashUserData(user) {
  const data = `${user.firstName}${user.lastName}${user.email}${user.gender}${user.roleID}${user.clubID}${user.profileImage_url}${user.id}${user.yearOfBirth}${user.statusID}`;
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function populateDropdown(selectId, items, getText, keyForValue) {
  const dropdown = document.getElementById(selectId);
  if (!dropdown) return;
  dropdown.innerHTML = '<option value="">Избери...</option>';

  items.forEach(item => {
    const option = document.createElement('option');
    option.textContent = typeof getText === 'function' ? getText(item) : item[getText];
    option.value = item[keyForValue];
    dropdown.appendChild(option);
  });
}

function showMessageBox(msg, isError=false){
  if (typeof window.displayMessageBox === 'function') return window.displayMessageBox(msg, isError);
  if (typeof window.showMessageBox === 'function') return window.showMessageBox(msg, isError);
  alert(msg);
}

// ====================== АУТЕНТИКАЦИЯ/ЗАРЕЖДАНЕ НА ПОТРЕБИТЕЛ ======================
async function loadUser() {
  try {
    const storedUser = localStorage.getItem('user');
    const savedHash = localStorage.getItem('userHash');

    if (!storedUser || !savedHash) {
      alert('Няма достъп до тази страница.');
      window.location.href = 'HomePage.html';
      return;
    }

    const user = JSON.parse(storedUser);
    const currentHash = await hashUserData(user);

    if (currentHash !== savedHash) {
      alert('Не бъди злонамерен <3');
      localStorage.clear();
      window.location.href = 'Index.html';
      return;
    }

    const role = Number(user.roleID);
    const isCoach = role === 2;
    const isAdmin = role === 3;

    if (!(isCoach || isAdmin)) {
      alert('Нямате права за достъп.');
      window.location.href = 'HomePage.html';
      return;
    }

    appState.user = user;

    const coachNameEl = document.getElementById('coach-name');
    if (coachNameEl) coachNameEl.textContent = `${user.firstName} ${user.lastName}`;

    await handleCoach(user);
  } catch (error) {
    console.error('Грешка при зареждане на потребителя:', error);
    showMessageBox('Грешка при зареждане на потребителя!', true);
  }
}

// ====================== ДАННИ ЗА КЛУБ/ДИСЦИПЛИНИ ======================
async function handleCoach(user) {
  try {
    const [disciplines, clubUsers] = await Promise.all([
      fetchJson(`https://sportstatsapi.azurewebsites.net/api/ClubDisciplines/disciplines-by-club/${user.clubID}`),
      fetchJson(`https://sportstatsapi.azurewebsites.net/api/Users/club/${user.clubID}`)
    ]);

    appState.disciplines = disciplines || [];
    appState.clubUsers = clubUsers || [];

    populateDropdown('discipline', appState.disciplines, 'disciplineName', 'id');
    populateDropdown('athlete-select', appState.clubUsers, u => `${u.firstName} ${u.lastName}`, 'id');

    // Слушатели
    const disciplineSel = document.getElementById('discipline');
    const athleteSel    = document.getElementById('athlete-select');
    const sortSel       = document.getElementById('sort-select');
    const poolSel       = document.getElementById('pool-select');
    const searchInput   = document.getElementById('search-input');

    if (disciplineSel) disciplineSel.addEventListener('change', fetchAndDisplayResults);
    if (athleteSel)    athleteSel.addEventListener('change', fetchAndDisplayResults);

    if (sortSel) sortSel.addEventListener('change', async () => {
      await fetchAndDisplayResults();
    });

    if (poolSel) poolSel.addEventListener('change', async () => {
      await fetchAndDisplayResults();
    });

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        const filtered = appState.clubUsers.filter(u => (`${u.firstName} ${u.lastName}`).toLowerCase().includes(searchTerm));
        populateDropdown('athlete-select', filtered, u => `${u.firstName} ${u.lastName}`, 'id');
      });
    }
  } catch (error) {
    console.error('Грешка при зареждане на данните:', error);
    showMessageBox('Грешка при зареждане на данните!', true);
  }
}

// ====================== ПОМОЩНИ ФОРМАТИ ======================
function getUnitForDiscipline(disciplineId) {
  // по твоята логика: само id 18 е „метра“
  return disciplineId === 18 ? 'метра' : 'време';
}

function formatTime(time) {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  const hundredths = Math.round((time - Math.floor(time)) * 100);

  const formattedMinutes = minutes > 0 ? `${minutes} мин ` : '';
  const formattedSeconds = `${seconds < 10 ? '0' : ''}${seconds} сек `;
  const formattedHundredths = `${hundredths < 10 ? '0' : ''}${hundredths} ст`;

  return `${formattedMinutes}${formattedSeconds}${formattedHundredths}`.trim();
}

function formatResultValue(value, unit) {
  if (unit === 'време') return formatTime(Number(value));
  if (unit === 'метра') return `${Number(value).toFixed(2)} м`;
  return String(value);
}

function formatDifference(diff, unit) {
  const sign = diff > 0 ? '+' : '-';
  return unit === 'време'
    ? `${sign}${formatTime(Math.abs(diff))}`
    : `${sign}${Math.abs(diff).toFixed(2)} м`;
}

// ====================== НОРМАТИВИ ======================
function displayNormativesInHTML(disciplineId, normatives) {
  const container = document.getElementById('normatives-container');
  if (!container) return;
  container.innerHTML = '';

  const unit = getUnitForDiscipline(disciplineId);

  if (normatives.length > 0) {
    const list = document.createElement('ul');
    normatives.forEach(n => {
      const formattedValue = formatResultValue(n.valueStandart, unit);
      const label = unit === 'време' ? 'сек' : '';
      const item = document.createElement('li');
      item.innerHTML = `${n.gender === 'M' ? 'Мъжки' : 'Женски'} - ${n.minYearOfBorn} до ${n.maxYearOfBorn} г., норматив: ${formattedValue} ${label}`;
      list.appendChild(item);
    });
    container.appendChild(list);
  } else {
    container.textContent = 'Няма налични нормативи за тази възрастова група и дисциплина.';
  }
}

function fetchNormativesAndCompare(disciplineId, yearOfBirth, userGender, results, selectedUser) {
  fetch(`https://sportstatsapi.azurewebsites.net/api/Normatives/discipline/${disciplineId}`)
    .then(response => {
      if (!response.ok) throw new Error('Network response was not ok');
      return response.json();
    })
    .then(normatives => {
      const genderMapping = { 'male': 'M', 'female': 'F' };
      const mappedGender = genderMapping[String(userGender || '').toLowerCase()] || String(userGender || '').toUpperCase();

      const relevant = (normatives || []).filter(n =>
        selectedUser.yearOfBirth >= n.minYearOfBorn &&
        selectedUser.yearOfBirth <= n.maxYearOfBorn &&
        n.gender === mappedGender
      );

      appState.lastNormatives = relevant; // <-- запазваме за диаграмите

      displayNormativesInHTML(disciplineId, relevant);
      displayResults(disciplineId, yearOfBirth, mappedGender, results, relevant);
      updateCharts(results, disciplineId); // обнови всички графики след като имаме и нормативи
    })
    .catch(error => {
      console.error('Грешка при извличане на нормативите:', error);
      appState.lastNormatives = [];
      displayResults(disciplineId, yearOfBirth, userGender, results, []); 
      updateCharts(results, disciplineId);
    });
}

// ====================== РЕЗУЛТАТИ (ЛИСТИНГ) ======================
function resetResults() {
  const best = document.getElementById('best-result');
  if (best) best.textContent = 'Най-добрият резултат: —';

  // унищожи всички графики
  Object.keys(appState.charts).forEach(id => {
    try { appState.charts[id].destroy(); } catch(e){}
    delete appState.charts[id];
  });
}

function displayResults(disciplineId, yearOfBirth, gender, results, normatives) {
  const resultsContainer = document.getElementById('results-container');
  const sortSelect = document.getElementById('sort-select');
  const poolSelect = document.getElementById('pool-select');
  if (!resultsContainer) return;

  const unit = getUnitForDiscipline(disciplineId);

  // Филтър + Сорт
  const selectedPool = poolSelect ? poolSelect.value : 'all';
  let list = Array.isArray(results) ? [...results] : [];

  if (selectedPool === '25' || selectedPool === '50') {
    list = list.filter(r => Number(r.swimmingPoolStandart) === Number(selectedPool));
  }
  const sortOption = sortSelect ? sortSelect.value : 'date-desc';
  switch (sortOption) {
    case 'date-asc':  list.sort((a,b)=>new Date(a.resultDate)-new Date(b.resultDate)); break;
    case 'date-desc': list.sort((a,b)=>new Date(b.resultDate)-new Date(a.resultDate)); break;
    case 'time-asc':  list.sort((a,b)=> unit==='време'? a.valueTime-b.valueTime : b.valueTime-a.valueTime); break;
    case 'time-desc': list.sort((a,b)=> unit==='време'? b.valueTime-a.valueTime : a.valueTime-b.valueTime); break;
  }

  resultsContainer.innerHTML = '';
  if (!list.length) {
    resultsContainer.textContent = 'Няма налични резултати за този атлет.';
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'results-wrap';
  const grid = document.createElement('div');
  grid.className = 'results-grid';
  wrap.appendChild(grid);

  list.forEach(r => {
    const pool = Number(r.swimmingPoolStandart);
    const raw = unit === 'метра' ? (r.valueDistance ?? r.valueTime) : (r.valueTime ?? r.valueDistance);
    const valueTxt = formatResultValue(raw, unit);

    // Дата ДД.ММ.ГГГГ
    const d = new Date(r.resultDate);
    const dateTxt = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
    const location = r.location || 'Няма данни';

    const card = document.createElement('div');
    card.className = 'result-card';

    // Header (резултат + дата – една линия)
    const head = document.createElement('div');
    head.className = 'result-head';
    head.innerHTML = `
      <div class="result-title">${valueTxt}</div>
      <div class="result-date">${dateTxt}</div>
    `;
    card.appendChild(head);

    // Meta – един ред, без „скачане“
    const meta = document.createElement('div');
    meta.className = 'result-meta';
    meta.innerHTML = `
      <span class="meta-chip">${pool || '—'} м басейн</span>
      <span class="meta-chip" title="${location}">Локация: ${location}</span>
    `;
    card.appendChild(meta);

    // НОРМАТИВИ
    const showNorm = unit === 'време' && (pool === 25 || pool === 50);

    // помощник за инфо-съобщение
    const appendNote = (text) => {
      const normBlock = document.createElement('div');
      normBlock.className = 'norm-block';

      const normHead = document.createElement('div');
      normHead.className = 'norm-head';

      const normTitle = document.createElement('div');
      normTitle.className = 'norm-title';
      normTitle.textContent = 'Нормативи';

      const normMeta = document.createElement('div');
      normMeta.className = 'norm-meta';
      normMeta.textContent = '—';

      normHead.appendChild(normTitle);
      normHead.appendChild(normMeta);
      normBlock.appendChild(normHead);

      const row = document.createElement('div');
      row.className = 'norm-row';
      row.style.gridTemplateColumns = '1fr';
      row.innerHTML = `<div class="norm-target" style="text-align:center">${text}</div>`;

      normBlock.appendChild(row);
      card.appendChild(normBlock);
    };

    if (showNorm && Array.isArray(normatives) && normatives.length) {
      const target =
        pool === 25
          ? normatives.find(n => n.swimmingPoolStandartId === 1)
          : normatives.find(n => n.swimmingPoolStandartId === 2);

      if (target) {
        const diff = raw - target.valueStandart;   // <0 по-добро време
        const covered = diff <= 0;

        const normBlock = document.createElement('div');
        normBlock.className = 'norm-block';

        // header: Нормативи | Норматив БФПС: XX
        const normHead = document.createElement('div');
        normHead.className = 'norm-head';

        const normTitle = document.createElement('div');
        normTitle.className = 'norm-title';
        normTitle.textContent = 'Норматив БФПС';

        const normMeta = document.createElement('div');
        normMeta.className = 'norm-meta';
        normMeta.textContent = `: ${formatResultValue(target.valueStandart, unit)}`;

        normHead.appendChild(normTitle);
        normHead.appendChild(normMeta);
        normBlock.appendChild(normHead);

        // ред: басейн | разлика | статус
        const row = document.createElement('div');
        row.className = 'norm-row';
        row.innerHTML = `
          <div class="norm-label">${pool} м басейн</div>
          <div class="norm-diff ${covered ? 'ok' : 'fail'}">${formatDifference(diff, unit)}</div>
          <div class="badge ${covered ? 'ok' : 'fail'}">${covered ? 'Покрит' : 'Не е покрит'}</div>
        `;
        normBlock.appendChild(row);
        card.appendChild(normBlock);
      } else {
        // няма норматив за този басейн (25/50) в получения списък
        appendNote('Липсва норматив за този басейн. Не се съпоставя.');
      }
    } else if (unit === 'време') {
      // нестандартен басейн (не е 25/50) → изрично съобщение
      appendNote(`Резултатът е от <strong>${pool || '—'} м</strong> басейн (нестандартен). Не се съпоставя с норматив.`);
    }
    // ако дисциплината е „метра“, по дизайн не сравняваме — оставяме картата чиста

    grid.appendChild(card);
  });

  resultsContainer.appendChild(wrap);
}




// ====================== ДИАГРАМИ ======================
function ensureChartsContainer() {
  const lineCanvas = document.getElementById('lineChart');
  if (!lineCanvas) {
    console.error('Грешка: Не е намерено платно за диаграмата lineChart.');
    return null;
  }

  let extra = document.getElementById('charts-extra');
  if (!extra) {
    extra = document.createElement('div');
    extra.id = 'charts-extra';
    extra.style.marginTop = '16px';
    extra.style.display = 'grid';
    // адаптивна мрежа
    extra.style.gridTemplateColumns = 'repeat(auto-fit, minmax(280px, 1fr))';
    extra.style.gap = '16px';
    lineCanvas.parentElement.insertAdjacentElement('afterend', extra);
  }
  return extra;
}

function createOrGetCanvas(container, id, titleText) {
  let wrap = document.getElementById(id + '-wrap');
  if (wrap) {
    const canvas = wrap.querySelector('canvas');
    const title = wrap.querySelector('h4');
    if (title) title.textContent = titleText || title.textContent;
    return canvas;
  }
  wrap = document.createElement('div');
  wrap.id = id + '-wrap';
  wrap.style.background = 'var(--card, #fff)';
  wrap.style.border = '1px solid var(--border, rgba(15,23,42,0.08))';
  wrap.style.borderRadius = '16px';
  wrap.style.padding = '12px';

  const title = document.createElement('h4');
  title.textContent = titleText;
  title.style.margin = '4px 0 8px 4px';
  title.style.fontSize = '14px';
  title.style.color = 'var(--text, #1f2937)';

  const canvas = document.createElement('canvas');
  canvas.id = id;
  canvas.style.width = '100%';
  canvas.style.height = '280px';

  wrap.appendChild(title);
  wrap.appendChild(canvas);
  container.appendChild(wrap);
  return canvas;
}

function destroyChart(id) {
  if (appState.charts[id]) {
    try { appState.charts[id].destroy(); } catch(e){}
    delete appState.charts[id];
  }
}

function chartTheme() {
  const css = getComputedStyle(document.documentElement);
  const PRIMARY = (css.getPropertyValue('--primary') || '#2563eb').trim();
  const TEXT    = (css.getPropertyValue('--text') || '#1f2937').trim();
  const GRID    = (css.getPropertyValue('--border') || 'rgba(15,23,42,0.08)').trim();
  return { PRIMARY, TEXT, GRID };
}

// помощни агрегации
function groupCountsByMonth(results) {
  // последни 12 месеца, етикети ММ/ГГ
  const now = new Date();
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`;
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label, count25: 0, count50: 0 });
  }
  const indexByKey = new Map(months.map((m,i)=>[m.key,i]));

  results.forEach(r => {
    const d = new Date(r.resultDate);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const idx = indexByKey.get(key);
    if (idx === undefined) return;
    if (Number(r.swimmingPoolStandart) === 25) months[idx].count25++;
    if (Number(r.swimmingPoolStandart) === 50) months[idx].count50++;
  });

  return months;
}

function normalizeMetric(value, min, max, invert=false) {
  if (value == null || Number.isNaN(value)) return null;
  if (max === min) return 50; // ако няма размах
  let norm = (value - min) / (max - min); // 0..1, по-голямо => по-силно
  if (invert) norm = 1 - norm;            // при време по-малко е по-добре
  return Math.round(norm * 100);          // 0..100
}

function statsForPool(values, isDistance) {
  if (!values.length) return { best:null, avg:null, std:null, recentAvg:null, volume:0 };
  const sorted = [...values].sort((a,b)=>a-b);
  const sum = values.reduce((a,b)=>a+b,0);
  const avg = sum / values.length;
  const best = isDistance ? Math.max(...values) : Math.min(...values);
  const mean = avg;
  const variance = values.reduce((a,v)=>a + (v-mean)*(v-mean),0) / values.length;
  const std = Math.sqrt(variance);
  const recent = values.slice(-3);
  const recentAvg = recent.reduce((a,b)=>a+b,0) / recent.length;
  return { best, avg, std, recentAvg, volume: values.length };
}

function updateCharts(results, disciplineId) {
  if (!Array.isArray(results) || results.length === 0) {
    console.warn('Няма данни за диаграмите.');
    return;
  }

  const lineCanvas = document.getElementById('lineChart');
  if (!lineCanvas) {
    console.error('Грешка: Не е намерено платно lineChart.');
    return;
  }

  const unit = getUnitForDiscipline(disciplineId);
  const isDistance = unit === 'метра';
  const { PRIMARY, TEXT, GRID } = chartTheme();

  // общи масиви
  const labels = results.map(r => new Date(r.resultDate).toLocaleDateString());
  const dataVals = results.map(r => {
    let v = isDistance ? r.valueDistance : r.valueTime;
    if (v === undefined || v === null) v = isDistance ? r.valueTime : r.valueDistance;
    return Number(v);
  });

  if (dataVals.some(v => Number.isNaN(v))) {
    console.warn('Невалидни стойности в резултатите за графика:', dataVals);
    return;
  }

  const best = isDistance ? Math.max(...dataVals) : Math.min(...dataVals);
  const bestEl = document.getElementById('best-result');
  if (bestEl) bestEl.textContent = `Най-добрият резултат: ${formatResultValue(best, unit)}`;

  // унифициран градиент
  const ctxLine = lineCanvas.getContext('2d');
  const grad = ctxLine.createLinearGradient(0, 0, 0, 400);
  grad.addColorStop(0, PRIMARY);
  grad.addColorStop(1, 'rgba(37,99,235,0.25)');

  destroyChart('lineChart');

  appState.charts.lineChart = new Chart(ctxLine, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: isDistance ? 'Резултати (метри)' : 'Резултати (секунди)',
        data: dataVals,
        borderColor: PRIMARY,
        backgroundColor: grad,
        pointBackgroundColor: '#fff',
        pointBorderColor: PRIMARY,
        pointBorderWidth: 2,
        borderWidth: 2.5,
        tension: 0.3,
        fill: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: {
          reverse: !isDistance,
          grid: { color: GRID, drawBorder: false },
          ticks: {
            color: TEXT,
            callback: (v) => formatResultValue(v, unit)
          }
        },
        x: { grid: { display: false }, ticks: { color: TEXT } }
      },
      plugins: {
        legend: { labels: { color: TEXT } },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.92)',
          borderColor: 'rgba(37,99,235,0.25)',
          borderWidth: 1,
          titleColor: '#fff',
          bodyColor: '#e5e7eb',
          padding: 12,
          displayColors: false,
          callbacks: {
            title: (items) => `Дата: ${items[0].label}`,
            label: (ctx) => {
              const i = ctx.dataIndex;
              const r = results[i] || {};
              let raw = isDistance ? r.valueDistance : r.valueTime;
              if (raw === undefined || raw === null) raw = isDistance ? r.valueTime : r.valueDistance;
              const value = formatResultValue(Number(raw), unit);
              const location = r.location || 'Няма данни';
              const pool = r.swimmingPoolStandart || 'Няма данни';
              return [`Резултат: ${value}`, `Локация: ${location}`, `Басейн: ${pool} м`];
            }
          }
        }
      }
    }
  });

  // 2+) ДОПЪЛНИТЕЛНИ ДИАГРАМИ
  const extra = ensureChartsContainer();
  if (!extra) return;

  // BAR: Най-добър vs Среден по басейн (25/50)
  const byPool = { '25': [], '50': [] };
  results.forEach(r => {
    const pool = String(r.swimmingPoolStandart || '');
    let v = isDistance ? r.valueDistance : r.valueTime;
    if (v === undefined || v === null) v = isDistance ? r.valueTime : r.valueDistance;
    const num = Number(v);
    if (!Number.isNaN(num) && (pool === '25' || pool === '50')) byPool[pool].push(num);
  });

  const pools = ['25', '50'];
  const avg = p => (byPool[p].length ? byPool[p].reduce((a,b)=>a+b,0)/byPool[p].length : null);
  const bestFn = p => (byPool[p].length
    ? (isDistance ? Math.max(...byPool[p]) : Math.min(...byPool[p]))
    : null);

  const barDataBest  = pools.map(p => bestFn(p));
  const barDataAvg   = pools.map(p => avg(p));

  const barWrap = createOrGetCanvas(extra, 'barChart', 'Най-добър срещу Среден резултат (по басейн)');
  const ctxBar = barWrap.getContext('2d');
  destroyChart('barChart');

  appState.charts.barChart = new Chart(ctxBar, {
    type: 'bar',
    data: {
      labels: pools.map(p => `${p} м`),
      datasets: [
        { label: 'Най-добър', data: barDataBest },
        { label: 'Среден',    data: barDataAvg }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          reverse: !isDistance,
          grid: { color: GRID, drawBorder: false },
          ticks: { color: TEXT, callback: v => formatResultValue(v, unit) }
        },
        x: { grid: { display: false }, ticks: { color: TEXT } }
      },
      plugins: { legend: { labels: { color: TEXT } } }
    }
  });

  // SCATTER: Всички опити във времето + тренд линия (без time adapter)
  const scatterPoints = results.map(r => {
    const t = new Date(r.resultDate).getTime();
    let v = isDistance ? r.valueDistance : r.valueTime;
    if (v === undefined || v === null) v = isDistance ? r.valueTime : r.valueDistance;
    return { x: t, y: Number(v), pool: r.swimmingPoolStandart };
  }).filter(p => !Number.isNaN(p.x) && !Number.isNaN(p.y));

  function linearRegression(points) {
    if (points.length < 2) return null;
    const n = points.length;
    const sumX = points.reduce((a,p)=>a+p.x,0);
    const sumY = points.reduce((a,p)=>a+p.y,0);
    const sumXY= points.reduce((a,p)=>a+p.x*p.y,0);
    const sumX2= points.reduce((a,p)=>a+p.x*p.x,0);
    const denom = (n*sumX2 - sumX*sumX);
    if (denom === 0) return null;
    const m = (n*sumXY - sumX*sumY) / denom;
    const b = (sumY - m*sumX) / n;
    return { m, b };
  }
  const lr = linearRegression(scatterPoints);
  let trendData = [];
  if (lr) {
    const xs = scatterPoints.map(p => p.x).sort((a,b)=>a-b);
    const x1 = xs[0], x2 = xs[xs.length-1];
    trendData = [
      { x: x1, y: lr.m * x1 + lr.b },
      { x: x2, y: lr.m * x2 + lr.b }
    ];
  }

  const scatterWrap = createOrGetCanvas(extra, 'scatterChart', 'Всички опити във времето (по басейн) + тренд');
  const ctxScat = scatterWrap.getContext('2d');
  destroyChart('scatterChart');

  appState.charts.scatterChart = new Chart(ctxScat, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: '25 м',
          data: scatterPoints.filter(p => p.pool === 25).map(p => ({ x: p.x, y: p.y })),
        },
        {
          label: '50 м',
          data: scatterPoints.filter(p => p.pool === 50).map(p => ({ x: p.x, y: p.y })),
        },
        ...(trendData.length ? [{
          type: 'line',
          label: 'Тренд линия',
          data: trendData,
          borderWidth: 2,
        }] : [])
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      scales: {
        x: {
          type: 'linear',
          grid: { color: GRID, drawBorder: false },
          ticks: {
            color: TEXT,
            callback: (v) => {
              const d = new Date(Number(v));
              return `${d.getDate()}.${d.getMonth()+1}.${String(d.getFullYear()).slice(-2)}`;
            }
          }
        },
        y: {
          reverse: !isDistance,
          grid: { color: GRID, drawBorder: false },
          ticks: { color: TEXT, callback: v => formatResultValue(v, unit) }
        }
      },
      plugins: { legend: { labels: { color: TEXT } } }
    }
  });

  // PIE: Дял на опитите 25/50
  const pieCounts = [byPool['25'].length, byPool['50'].length];
  const pieWrap = createOrGetCanvas(extra, 'pieChart', 'Дял на опитите по басейн');
  const ctxPie = pieWrap.getContext('2d');
  destroyChart('pieChart');

  appState.charts.pieChart = new Chart(ctxPie, {
    type: 'pie',
    data: {
      labels: ['25 м', '50 м'],
      datasets: [{ data: pieCounts }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: TEXT } } }
    }
  });

  // GROUPED BAR: Опити по месеци (последни 12)
  const months = groupCountsByMonth(results);
  const monthsWrap = createOrGetCanvas(extra, 'monthsChart', 'Опити по месеци (последни 12), по басейн');
  const ctxMonths = monthsWrap.getContext('2d');
  destroyChart('monthsChart');

  appState.charts.monthsChart = new Chart(ctxMonths, {
    type: 'bar',
    data: {
      labels: months.map(m => m.label),
      datasets: [
        { label: '25 м', data: months.map(m => m.count25) },
        { label: '50 м', data: months.map(m => m.count50) }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, grid: { color: GRID, drawBorder: false }, ticks: { color: TEXT } },
        x: { grid: { display: false }, ticks: { color: TEXT } }
      },
      plugins: { legend: { labels: { color: TEXT } } }
    }
  });

  // DONUT: Покрити нормативи (на база последно филтрирани нормативи)
  const relevantNorms = appState.lastNormatives || [];
  let covered = 0, notCovered = 0;
  if (relevantNorms.length) {
    results.forEach(r => {
      const pool = Number(r.swimmingPoolStandart);
      let v = isDistance ? r.valueDistance : r.valueTime;
      if (v === undefined || v === null) v = isDistance ? r.valueTime : r.valueDistance;
      const val = Number(v);
      if (Number.isNaN(val)) return;

      // 25 м -> само 25; 50 м -> 25 или 50 (както е в листинга)
      const candidates = pool === 25
        ? relevantNorms.filter(n => n.swimmingPoolStandartId === 1)
        : relevantNorms.filter(n => n.swimmingPoolStandartId === 1 || n.swimmingPoolStandartId === 2);

      if (!candidates.length) return;

      const coveredHere = candidates.some(n => {
        const normVal = Number(n.valueStandart);
        return isDistance ? (val >= normVal) : (val <= normVal);
      });

      if (coveredHere) covered++; else notCovered++;
    });
  }
  const donutWrap = createOrGetCanvas(extra, 'donutChart', 'Покрити нормативи');
  const ctxDonut = donutWrap.getContext('2d');
  destroyChart('donutChart');

  appState.charts.donutChart = new Chart(ctxDonut, {
    type: 'doughnut',
    data: {
      labels: ['Покрити', 'Непокрити'],
      datasets: [{ data: [covered, notCovered] }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: TEXT } } }
    }
  });

  // RADAR: Нормализиран профил по басейн
  const stats25 = statsForPool(byPool['25'], isDistance);
  const stats50 = statsForPool(byPool['50'], isDistance);

  // за нормализация събираме всички релевантни стойности по метрика
  const collect = (k) => {
    const arr = [];
    if (stats25[k] != null) arr.push(stats25[k]);
    if (stats50[k] != null) arr.push(stats50[k]);
    return arr;
  };

  const bestVals = collect('best');
  const avgVals = collect('avg');
  const recentVals = collect('recentAvg');
  const stdVals = collect('std');
  const volumeVals = collect('volume');

  const minmax = arr => ({ min: Math.min(...arr), max: Math.max(...arr) });

  const bMM = bestVals.length ? minmax(bestVals) : {min:0,max:1};
  const aMM = avgVals.length ? minmax(avgVals) : {min:0,max:1};
  const rMM = recentVals.length ? minmax(recentVals) : {min:0,max:1};
  const sMM = stdVals.length ? minmax(stdVals) : {min:0,max:1};
  const vMM = volumeVals.length ? minmax(volumeVals) : {min:0,max:1};

  const metricsLabels = ['Най-добър', 'Среден', 'Последни 3', 'Стабилност', 'Обем'];

  const normalizeSet = (s) => ([
    normalizeMetric(s.best,      bMM.min, bMM.max, !isDistance), // време -> invert
    normalizeMetric(s.avg,       aMM.min, aMM.max, !isDistance),
    normalizeMetric(s.recentAvg, rMM.min, rMM.max, !isDistance),
    s.std != null ? 100 - normalizeMetric(s.std, sMM.min, sMM.max, false) : null, // по-малък std = по-стабилно
    normalizeMetric(s.volume,    vMM.min, vMM.max, false)
  ].map(v => v == null ? 0 : v));

  const radar25 = normalizeSet(stats25);
  const radar50 = normalizeSet(stats50);

  const radarWrap = createOrGetCanvas(extra, 'radarChart', 'Профил по басейн (0–100 нормализирано)');
  const ctxRadar = radarWrap.getContext('2d');
  destroyChart('radarChart');

  appState.charts.radarChart = new Chart(ctxRadar, {
    type: 'radar',
    data: {
      labels: metricsLabels,
      datasets: [
        { label: '25 м', data: radar25 },
        { label: '50 м', data: radar50 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: true,
          suggestedMax: 100,
          angleLines: { color: GRID },
          grid: { color: GRID },
          pointLabels: { color: TEXT },
          ticks: { color: TEXT }
        }
      },
      plugins: { legend: { labels: { color: TEXT } } }
    }
  });
}

// ====================== ПОТРЕБИТЕЛСКА КАРТИНКА/ИНФО ======================
function displayUserInfo(user) {
  const userInfoContainer = document.getElementById('user-info');
  const profilePicture = document.getElementById('profile-picture');
  const userName = document.getElementById('user-name');
  const userBirthDate = document.getElementById('user-birthdate');

  if (userInfoContainer) userInfoContainer.style.display = 'block';
  if (profilePicture) profilePicture.src = `https://sportstatsapi.azurewebsites.net/api/Users/profilePicture/${user.id}`;
  if (userName) userName.textContent = `${user.firstName} ${user.lastName}`;
  if (userBirthDate) userBirthDate.textContent = `Година на раждане: ${user.yearOfBirth}`;
}

// ====================== ОСНОВНА ФУНКЦИЯ ЗА ЗАРЕЖДАНЕ НА РЕЗУЛТАТИ ======================
async function fetchAndDisplayResults() {
  try {
    resetResults();

    const athleteSel = document.getElementById('athlete-select');
    const disciplineSel = document.getElementById('discipline');
    if (!athleteSel || !disciplineSel) return;

    const selectedUserId = Number(athleteSel.value);
    const disciplineId = Number(disciplineSel.value);
    if (!selectedUserId || !disciplineId) return;

    const selectedUser = appState.clubUsers.find(u => u.id === selectedUserId);
    if (!selectedUser) return;

    const res = await fetch(`https://sportstatsapi.azurewebsites.net/api/Results/by-user/${selectedUserId}/by-discipline/${disciplineId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Requester-Id': appState.user.id
      }
    });

    if (!res.ok) throw new Error(`Грешка: ${res.status} - ${res.statusText}`);

    const userResults = await res.json();
    displayUserInfo(selectedUser);

    const currentYear = new Date().getFullYear();
    const yearOfBirth = currentYear - (selectedUser.age ?? (currentYear - selectedUser.yearOfBirth));

    // Първо взимаме нормативите и вътре ще се извика updateCharts след филтъра
    fetchNormativesAndCompare(disciplineId, yearOfBirth, selectedUser.gender, userResults, selectedUser);
  } catch (error) {
    console.error('Грешка при зареждане на резултатите:', error);
    showMessageBox('Грешка при зареждане на резултатите!', true);
  }
}

// ====================== STARTUP ======================
document.addEventListener('DOMContentLoaded', () => {
  const lineCanvas = document.getElementById('lineChart');
  if (!lineCanvas) {
    console.error('Не е намерено платно за диаграмата.');
    return;
  }
  loadUser();
});
