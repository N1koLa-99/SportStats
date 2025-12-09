// CoachPageScript.js – фиксове за dropdown-и, дати, резултати + placeholder-и
document.addEventListener('DOMContentLoaded', async function () {
  const API = 'https://sportstatsapi.azurewebsites.net/api';
  const user = JSON.parse(localStorage.getItem('user'));

  // ---------- helpers ----------
  const get = (o, ...keys) => {
    for (const k of keys) {
      if (o && o[k] !== undefined && o[k] !== null) return o[k];
    }
    return undefined;
  };
  const num = v => (v === '' || v === null || v === undefined ? NaN : Number(v));

  function safeDate(input) {
    if (!input) return null;
    const d1 = new Date(input);
    if (!isNaN(d1)) return d1;
    const d2 = new Date(String(input).replace(' ', 'T'));
    return isNaN(d2) ? null : d2;
  }

  function normalizeDiscipline(d) {
    // може да идва: {Id, DisciplineName} или {id, disciplineName} или {discipline:{Id, Name}}
    const id =
      get(d, 'id', 'Id', 'disciplineId', 'DisciplineId') ??
      get(d?.discipline, 'id', 'Id');
    const name =
      get(d, 'disciplineName', 'DisciplineName', 'name', 'Name') ??
      get(d?.discipline, 'disciplineName', 'DisciplineName', 'name', 'Name');
    return { id: Number(id), name: name ?? `Дисциплина ${id ?? ''}` };
  }

  function normalizeUser(u) {
    return {
      id: Number(get(u, 'id', 'Id')),
      firstName: get(u, 'firstName', 'FirstName') ?? '',
      lastName: get(u, 'lastName', 'LastName') ?? '',
      yearOfBirth: get(u, 'yearOfBirth', 'YearOfBirth') ?? ''
    };
  }

  function poolToId(p) {
    const n = Number(String(p).replace(/[^\d.]/g, ''));
    if (n === 25) return 1;
    if (n === 50) return 2;
    return 0;
  }

  function normalizeResult(r) {
    return {
      id: Number(get(r, 'id', 'Id')),
      userId: Number(get(r, 'userId', 'UserId')),
      disciplineId: Number(get(r, 'disciplineId', 'DisciplineId')),
      valueTime: num(get(r, 'valueTime', 'ValueTime')),
      resultDate: safeDate(get(r, 'resultDate', 'ResultDate', 'date', 'Date')),
      location: get(r, 'location', 'Location') ?? '',
      swimmingPoolStandart: get(r, 'swimmingPoolStandart', 'SwimmingPoolStandart', 'poolLength', 'PoolLength'),
      swimmingPoolStandartId:
        Number(get(r, 'swimmingPoolStandartId', 'SwimmingPoolStandartId')) || poolToId(get(r, 'swimmingPoolStandart', 'SwimmingPoolStandart'))
    };
  }

  function formatTime(seconds) {
    if (seconds === undefined || seconds === null || isNaN(seconds)) {
      return 'Неизвестна стойност';
    }
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const cs = Math.round((seconds % 1) * 100).toString().padStart(2, '0');

    let out = '';
    if (h > 0) out += `${h} ч `;
    if (m > 0 || h > 0) out += `${m} мин `;
    out += `${s}.${cs} сек`;
    return out;
  }

  function formatResult(valueTime, disciplineId) {
    const timeIds = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17];
    if (typeof valueTime !== 'number' || isNaN(valueTime)) return 'Неизвестна стойност';
    if (Number(disciplineId) === 18) return `${valueTime.toFixed(0)} м`;
    return timeIds.includes(Number(disciplineId)) ? formatTime(valueTime) : valueTime.toFixed(2);
  }

  async function fetchJson(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return await res.json();
    } catch (e) {
      console.error(`Грешка при заявката: ${url}`, e);
      throw e;
    }
  }

  // ---------- UI toggles ----------
  const container = document.querySelector('.container');
  const addForm = document.getElementById('add-result-form');
  const showResultsBtn = document.getElementById('show-results-btn');
  const showAddFormBtn = document.getElementById('show-add-form-btn');

  showResultsBtn.addEventListener('click', () => {
    container.style.display = 'block';
    addForm.style.display = 'none';
    showResultsBtn.classList.add('active');
    showAddFormBtn.classList.remove('active');
  });
  showAddFormBtn.addEventListener('click', () => {
    container.style.display = 'none';
    addForm.style.display = 'block';
    showAddFormBtn.classList.add('active');
    showResultsBtn.classList.remove('active');
  });
  container.style.display = 'block';
  addForm.style.display = 'none';
  showResultsBtn.classList.add('active');

  document.getElementById('go-home').addEventListener('click', function () {
    window.location.href = 'HomePage.html';
  });

  // ---------- message box ----------
  function showMessageBox(message) {
    const messageBox = document.getElementById('message-box');
    const messageText = document.getElementById('message-box-text');
    const progressBar = document.getElementById('message-box-progress-bar');
    messageText.textContent = message;
    messageBox.style.display = 'flex';
    progressBar.style.width = '0%';
    setTimeout(() => { progressBar.style.width = '100%'; }, 50);
    setTimeout(() => { messageBox.style.opacity = '0'; messageBox.style.transform = 'translateY(-20px)'; }, 3000);
    setTimeout(() => { messageBox.style.display = 'none'; messageBox.style.opacity = '1'; messageBox.style.transform = 'none'; }, 3200);
  }

  // ---------- dropdown populate (robust) ----------
  function populateDropdown(elementId, items, textSelector, valueSelector) {
    const select = document.getElementById(elementId);
    if (!select) return;
    select.innerHTML = ''; // почисти

    items.forEach(item => {
      let text, value;
      if (textSelector === 'disciplineName' && valueSelector === 'id') {
        const d = normalizeDiscipline(item);
        text = d.name;
        value = d.id;
      } else if (typeof textSelector === 'function') {
        const u = normalizeUser(item);
        text = textSelector(u);
        value = u.id;
      } else {
        text = get(item, textSelector) ?? `Опция ${get(item, valueSelector) ?? ''}`;
        value = get(item, valueSelector);
      }

      if (value === undefined || value === null || value === '') return;

      const option = document.createElement('option');
      option.value = value;
      option.textContent = text ?? `Опция ${value}`;
      select.appendChild(option);
    });
  }

  // placeholder помощник
  function addPlaceholder(select, text = 'Изберете опция') {
    if (!select) return;
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = text;
    opt.disabled = true;
    opt.selected = true;
    select.insertBefore(opt, select.firstChild);
  }

  // ---------- table ----------
  function displayUsersTable(usersRaw, resultsRaw, disciplineId = null) {
    const users = (usersRaw || []).map(normalizeUser);
    const results = (resultsRaw || []).map(normalizeResult);

    const usersTable = document.getElementById('users-table');
    const tbody = usersTable.querySelector('tbody');
    tbody.innerHTML = '';

    if (!disciplineId) return;

    users.forEach(u => {
      const userResults = results.filter(r => r.userId === u.id && r.disciplineId === Number(disciplineId));
      let bestResultText = 'Няма резултат';

      if (userResults.length) {
        const values = userResults.map(r => r.valueTime);
        const bestValue = (Number(disciplineId) === 18) ? Math.max(...values) : Math.min(...values);
        bestResultText = formatResult(bestValue, disciplineId);
      }

      const entries = userResults.map(r => {
        const tooltipText = `Локация: ${r.location || 'Няма данни'}\nДължина на басейна: ${r.swimmingPoolStandart || '—'} м`;
        const dateText = r.resultDate ? r.resultDate.toLocaleDateString('bg-BG') : 'Няма дата';
        return `
          <tr>
            <td>
              <div class="tooltip-container">
                ${formatResult(r.valueTime, disciplineId)}
                <span class="tooltip-text">${tooltipText}</span>
              </div>
            </td>
            <td>
              <div class="tooltip-container">
                ${dateText}
                <span class="tooltip-text">${tooltipText}</span>
              </div>
            </td>
            <td>
              <button class="delete-result" data-result-id="${r.id}" title="Изтрий">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          </tr>`;
      }).join('');

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${u.firstName}<br>${u.lastName}</td>
        <td>${u.yearOfBirth || 'Няма данни'}</td>
        <td>${bestResultText}</td>
        <td>
          <table><tbody>${entries || '<tr><td colspan="3">Няма резултати</td></tr>'}</tbody></table>
        </td>`;
      tbody.appendChild(row);
    });

    document.querySelectorAll('.delete-result').forEach(btn => {
      btn.addEventListener('click', async function () {
        const resultId = this.getAttribute('data-result-id');
        await deleteResult(resultId);
      });
    });
  }

  // ---------- delete result ----------
  async function deleteResult(resultId) {
    if (!resultId || isNaN(resultId)) {
      showMessageBox('Грешка: Невалиден резултат за изтриване.');
      return;
    }
    const confirmation = prompt('Сигурни ли сте, че искате да изтриете резултата? Напишете 1 за потвърждение.');
    if (confirmation !== '1') {
      showMessageBox('Изтриването е отменено.');
      return;
    }

    try {
      const res = await fetch(`${API}/Results/${resultId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Requester-Id': user.id,
          'Role-Id': user.roleID,
          'Club-Id': user.clubID
        }
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Грешка при изтриване: ${res.status} - ${t}`);
      }
      showMessageBox('Резултатът е изтрит успешно!');
      // refresh table
      const disciplineId = Number(document.getElementById('discipline').value);
      const clubUsers = await fetchJson(`${API}/Users/club/${user.clubID}`);
      const results = await fetchJson(`${API}/Results?requesterId=${user.id}`);
      displayUsersTable(clubUsers, results, disciplineId);
    } catch (e) {
      console.error('Грешка при изтриване:', e);
      showMessageBox('Грешка при изтриване на резултата.');
    }
  }
  window.deleteResult = deleteResult;

  // ---------- add form ----------
  function populateRollers() {
    populateRoller('hours', 0, 23);
    populateRoller('minutes', 0, 59);
    populateRoller('seconds', 0, 59);
    populateRoller('milliseconds', 0, 99);
  }
  function populateRoller(id, start, end) {
    const select = document.getElementById(id);
    select.innerHTML = '';
    for (let i = start; i <= end; i++) {
      const o = document.createElement('option');
      o.value = i;
      o.textContent = i.toString().padStart(2, '0');
      select.appendChild(o);
    }
  }
  function calculateTimeValue() {
    const h = parseInt(document.getElementById('hours').value, 10) || 0;
    const m = parseInt(document.getElementById('minutes').value, 10) || 0;
    const s = parseInt(document.getElementById('seconds').value, 10) || 0;
    const cs = parseInt(document.getElementById('milliseconds').value, 10) || 0;
    return h * 3600 + m * 60 + s + cs / 100;
  }

  async function setupAddResultForm() {
    const disciplinesRaw = await fetchJson(`${API}/ClubDisciplines/disciplines-by-club/${user.clubID}`);
    populateDropdown('add-discipline', disciplinesRaw, 'disciplineName', 'id');
    addPlaceholder(document.getElementById('add-discipline'), 'Изберете дисциплина'); // <-- ново

    const clubUsersRaw = await fetchJson(`${API}/Users/club/${user.clubID}`);
    populateDropdown('add-user', clubUsersRaw, u => `${u.firstName} ${u.lastName} (${u.yearOfBirth || 'н/д'})`, 'id');
    addPlaceholder(document.getElementById('add-user'), 'Изберете състезател'); // по желание

    document.getElementById('add-discipline').addEventListener('change', function () {
      const id = Number(this.value);
      const timeInput = document.getElementById('time-input');
      const decimalInput = document.getElementById('decimal-input');
      const distanceInput = document.getElementById('distance-input');

      if (id >= 1 && id <= 17) {
        timeInput.style.display = 'block'; decimalInput.style.display = 'none'; distanceInput.style.display = 'none';
      } else if (id === 18) {
        timeInput.style.display = 'none'; decimalInput.style.display = 'none'; distanceInput.style.display = 'block';
      } else {
        timeInput.style.display = 'none'; decimalInput.style.display = 'block'; distanceInput.style.display = 'none';
      }
    });

    document.getElementById('add-user').addEventListener('change', async function () {
      const userId = this.value;
      const img = document.getElementById('user-profile-picture');
      if (!userId) { img.style.display = 'none'; return; }
      try {
        const imageResponse = await fetch(`${API}/Users/profilePicture/${userId}`);
        if (imageResponse.ok) {
          const blob = await imageResponse.blob();
          img.src = URL.createObjectURL(blob);
        } else {
          img.src = '../SportStatsImg/ProfilePhoto2.jpg';
        }
        img.style.display = 'block';
      } catch {
        img.src = '../SportStatsImg/ProfilePhoto2.jpg';
        img.style.display = 'block';
      }
    });

    document.getElementById('submit-result').addEventListener('click', async function () {
      const disciplineIdRaw = document.getElementById('add-discipline').value;
      if (!disciplineIdRaw) { showMessageBox('Моля, изберете дисциплина.'); return; }
      const disciplineId = Number(disciplineIdRaw);

      const userIdRaw = document.getElementById('add-user').value;
      if (!userIdRaw) { showMessageBox('Моля, изберете състезател.'); return; }
      const userId = Number(userIdRaw);

      const isTimeBased = document.getElementById('time-input').style.display === 'block';
      const isDistanceBased = document.getElementById('distance-input').style.display === 'block';

      const poolLocation = document.getElementById('pool-location').value.trim();
      const poolSize = Number(document.getElementById('pool-size').value);

      let valueTime;
      if (isTimeBased) valueTime = calculateTimeValue();
      else if (isDistanceBased) valueTime = parseFloat(document.getElementById('distance-result').value);
      else valueTime = parseFloat(document.getElementById('decimal-result').value);

      if (isNaN(valueTime) || valueTime < 0 || valueTime > 86400) {
        showMessageBox('Моля, въведете валиден резултат (0 до 86400).'); return;
      }
      if (!poolLocation || isNaN(poolSize) || poolSize < 15 || poolSize > 50) {
        showMessageBox('Моля, попълнете място и размер на басейна 15–50 м.'); return;
      }

      try {
        const res = await fetch(`${API}/Results`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Requester-Id': user.id,
            'Role-Id': user.roleID,
            'Club-Id': user.clubID
          },
          body: JSON.stringify({
            userId,
            disciplineId,
            valueTime,
            resultDate: new Date().toISOString(),
            swimmingPoolStandart: poolSize,
            location: poolLocation
          })
        });
        if (!res.ok) throw new Error(await res.text());
        showMessageBox('Резултатът е добавен успешно! Презареди страницата!');
        try { await handleRankingUpdate(userId, disciplineId, valueTime); } catch {}
      } catch (e) {
        console.error('Грешка при добавяне:', e);
        showMessageBox('Грешка при добавяне на резултата.');
      }
    });

    populateRollers();
  }

  // (стъбове – ако не са дефинирани другаде)
  async function compareResultWithNorms(){ return false; }
  async function addPointsToRankings(){}

  async function handleRankingUpdate(userId, disciplineId, valueTime) {
    try {
      const isQualified = await compareResultWithNorms(userId, disciplineId, valueTime);
      if (isQualified) await addPointsToRankings(userId, disciplineId, 50);
    } catch (e) {
      console.warn('Грешка при класиране:', e);
    }
  }

  // ---------- main flow ----------
  async function handleCoach() {
    const role = Number(user.roleID);
    const isCoach = role === 2;
    const isAdmin = role === 3;
    if (!(isCoach || isAdmin)) {
      alert('Нямате права за достъп.');
      window.location.href = 'HomePage.html';
      return;
    }

    document.getElementById('coach-name').textContent = `${user.firstName} ${user.lastName}`;

    try {
      const disciplinesRaw = await fetchJson(`${API}/ClubDisciplines/disciplines-by-club/${user.clubID}`);
      populateDropdown('discipline', disciplinesRaw, 'disciplineName', 'id');
      addPlaceholder(document.getElementById('discipline'), 'Изберете дисциплина'); // <-- ново

      const clubUsers = await fetchJson(`${API}/Users/club/${user.clubID}`);
      let results = await fetchJson(`${API}/Results?requesterId=${user.id}`);

      let selectedDisciplineId = null;
      document.getElementById('discipline').addEventListener('change', function () {
        selectedDisciplineId = parseInt(this.value, 10);
        displayUsersTable(clubUsers, results, selectedDisciplineId);
      });

      // search
      const searchInput = document.getElementById('search-input');
      const datalist = document.createElement('datalist');
      datalist.id = 'users-list';
      searchInput.setAttribute('list', 'users-list');
      document.body.appendChild(datalist);

      const normalizedUsers = (clubUsers || []).map(normalizeUser);

      searchInput.addEventListener('input', function () {
        const q = searchInput.value.toLowerCase();
        datalist.innerHTML = '';
        normalizedUsers.forEach(u => {
          const full = `${u.firstName} ${u.lastName}`.toLowerCase();
          if (full.includes(q)) {
            const opt = document.createElement('option');
            opt.value = `${u.firstName} ${u.lastName}`;
            datalist.appendChild(opt);
          }
        });
      });

      document.getElementById('search-form').addEventListener('submit', function (e) {
        e.preventDefault();
        const q = searchInput.value.trim().toLowerCase();
        if (!q) { showMessageBox('Моля, въведете търсен текст.'); return; }
        const filteredUsers = normalizedUsers.filter(u => `${u.firstName} ${u.lastName}`.toLowerCase().includes(q));
        const filteredResults = (results || []).filter(r => {
          const rr = normalizeResult(r);
          return selectedDisciplineId && rr.disciplineId === selectedDisciplineId;
        });
        displayUsersTable(filteredUsers, filteredResults, selectedDisciplineId);
      });
    } catch (e) {
      console.error('Грешка при зареждане на данни:', e);
      showMessageBox('Не можа да се извлекат данните.');
    }
  }

  await setupAddResultForm();
  await handleCoach();
});
