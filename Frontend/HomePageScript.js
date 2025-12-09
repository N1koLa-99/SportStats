// HomePageScript.js (финална версия с фиксове за резултатите/датите и диаграмата)

document.addEventListener("DOMContentLoaded", async () => {
  let chart = null;

  // ========================================
  // База за API (локал/прод) + опция от localStorage
  // ========================================
  const API_BASE = (() => {
    const stored = localStorage.getItem("apiBaseUrl");
    if (stored) return stored.replace(/\/+$/, "");
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
      return "https://localhost:7198/api";
    }
    return "https://sportstatsapi.azurewebsites.net/api";
  })();
  console.debug("[API_BASE]", API_BASE);

  // =========================
  // Guard: верифицирай сесията
  // =========================
  const serverUserJson = localStorage.getItem("userServer");
  const savedHash = localStorage.getItem("userHash");

  if (!serverUserJson || !savedHash) {
    return redirectToIndex("Невалидни данни. Пренасочване към началната страница.");
  }

  try {
    const serverUser = JSON.parse(serverUserJson);
    const s = `${serverUser.FirstName}${serverUser.LastName}${serverUser.Email}${serverUser.Gender}${serverUser.RoleID}${serverUser.ClubID}${serverUser.profileImage_url}${serverUser.Id}${serverUser.YearOfBirth}${serverUser.StatusID}`;
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    const currentHash = btoa(String.fromCharCode(...new Uint8Array(buf)));
    if (currentHash !== savedHash) {
      return redirectToIndex("Не бъди злонамерен <3");
    }
  } catch (e) {
    console.error("Грешка при хеширането:", e);
    return redirectToIndex("Възникна грешка. Пренасочване...");
  }

  // Зареди UI потребителя (camelCase) за интерфейса
  const uiUserRaw = localStorage.getItem("user");
  const user = uiUserRaw ? JSON.parse(uiUserRaw) : null;
  if (!user || !user.id) {
    return redirectToIndex("Сесията е невалидна. Влез отново.");
  }

  // =========================
  // Helpers за сесията
  // =========================
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

  async function computeServerHash(su) {
    const s = `${su.FirstName}${su.LastName}${su.Email}${su.Gender}${su.RoleID}${su.ClubID}${su.profileImage_url}${su.Id}${su.YearOfBirth}${su.StatusID}`;
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  }

  async function refreshSessionFromServer(userId) {
    try {
      const res = await fetch(`${API_BASE}/Users/${userId}`);
      if (!res.ok) throw new Error("Неуспешно опресняване на сесията");
      const serverUser = await res.json(); // PascalCase
      localStorage.setItem("userServer", JSON.stringify(serverUser));
      localStorage.setItem("user", JSON.stringify(toUIUser(serverUser)));
      const h = serverUser.UserTokenHash || (await computeServerHash(serverUser));
      localStorage.setItem("userHash", h);
    } catch (e) {
      console.error("refreshSessionFromServer:", e);
      localStorage.clear();
      window.location.href = "Index.html";
    }
  }

  function redirectToIndex(message) {
    alert(message);
    localStorage.clear();
    window.location.href = "Index.html";
  }

  // =========================
  // Периодична проверка на статус
  // =========================
  async function checkUserStatus(u) {
    try {
      const response = await fetch(`${API_BASE}/Users/${u.id}`);
      if (!response.ok) throw new Error("Грешка при извличане на статуса");

      const updatedUser = await response.json(); // PascalCase
      if (u.statusID !== updatedUser.StatusID || u.clubID !== updatedUser.ClubID) {
        alert("Вашият статус или клуб е променен. Моля, влезте отново.");
        localStorage.clear();
        window.location.href = "Index.html";
      }
    } catch (error) {
      console.error("Грешка при проверка на статуса:", error);
    }
  }
  setInterval(() => checkUserStatus(user), 8000);
  checkUserStatus(user);

  // =========================
  // UI рендер според статус
  // =========================
  function renderUserInterface(u) {
    if (u.statusID === 1) {
      document.body.innerHTML = `
        <div class="status-container" style="
          box-sizing:border-box;
          width: min(92%, 720px);
          margin: 40px auto;
          padding: 24px 20px;
          background: linear-gradient(180deg, rgba(255,255,255,.86), rgba(250,252,255,.92));
          border: 1px solid #e6e9ef;
          border-radius: 16px;
          backdrop-filter: blur(10px) saturate(1.05);
          -webkit-backdrop-filter: blur(10px) saturate(1.05);
          box-shadow: 0 10px 30px rgba(15,23,42,.08), inset 0 1px 0 rgba(255,255,255,.7);
          font-family: inherit;
          color: #0b0f19;
          text-align: center;
        ">
          <img src="https://sportstats.blob.core.windows.net/$web/SportStats.png" alt="SportStats Logo" style="
            width: 120px;
            height: auto;
            margin: 4px auto 16px;
            display:block;
            border-radius: 12px;
            box-shadow: 0 6px 18px rgba(15,23,42,.10);
          ">

          <h2 style="
            margin: 0 0 8px;
            font-size: 20px;
            font-weight: 800;
            letter-spacing: .2px;
            color: #0c1222;
          ">
            ${u.statusID === 1 ? "Вашата заявка е в процес на одобрение." : "Вашата заявка е отхвърлена."}
          </h2>

          <p style="
            margin: 0 0 18px;
            font-size: 14px;
            color: #6a7280;
            line-height: 1.55;
          ">
            ${u.statusID === 1 ? "Моля, изчакайте одобрение от администратора." : "Можете да изберете друг клуб."}
          </p>

          ${
            u.statusID === 1
              ? `<button id="change-club-button" style="
                   appearance:none;
                   border:1px solid #e6e9ef;
                   background: linear-gradient(180deg, #0e1425, #172033);
                   color:#fff;
                   font-weight:700;
                   font-size:14px;
                   padding: 12px 18px;
                   border-radius: 12px;
                   cursor:pointer;
                   box-shadow: 0 10px 24px rgba(15,23,42,.18);
                   transition: transform .12s ease, box-shadow .12s ease;
                 ">
                   Смени клуба
                 </button>`
              : ""
          }
        </div>
      `;

      if (u.statusID === 1) {
        document
          .getElementById("change-club-button")
          .addEventListener("click", () => loadClubs(u));
      }
    }
  }

  // =========================
  // Смяна на клуб
  // =========================
  async function loadClubs(u) {
    try {
      const response = await fetch(`${API_BASE}/Clubs`);
      if (!response.ok) throw new Error("Грешка при зареждане на клубовете.");

      const clubs = await response.json();
      document.body.innerHTML = `
        <div class="club-selection-container" style="
          box-sizing:border-box;
          width: min(92%, 720px);
          margin: 40px auto;
          padding: 24px 20px;
          background: linear-gradient(180deg, rgba(255,255,255,.86), rgba(250,252,255,.92));
          border: 1px solid #e6e9ef;
          border-radius: 16px;
          backdrop-filter: blur(10px) saturate(1.05);
          -webkit-backdrop-filter: blur(10px) saturate(1.05);
          box-shadow: 0 10px 30px rgba(15,23,42,.08), inset 0 1px 0 rgba(255,255,255,.7);
          font-family: inherit;
          color: #0b0f19;
          text-align: center;
        ">
          <h2 style="margin:0 0 16px;font-size:18px;font-weight:800;color:#0c1222;letter-spacing:.2px;">Изберете нов клуб</h2>

          <div style="width:100%;max-width:520px;margin:0 auto 14px;text-align:left;">
            <label for="club-select" style="display:block;font-size:12px;color:#6a7280;margin:0 0 6px;">Клуб</label>
            <select id="club-select" style="
              box-sizing:border-box;width:100%;padding:12px 40px 12px 12px;font-size:14px;color:#0b0f19;
              border:1px solid #e6e9ef;border-radius:12px;background:#fff;outline:none;transition:.12s;
              -webkit-appearance:none;appearance:none;
              background-image:url('data:image/svg+xml;utf8,<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; width=&quot;14&quot; height=&quot;14&quot; viewBox=&quot;0 0 24 24&quot;><path fill=&quot;%236a7280&quot; d=&quot;M7 10l5 5 5-5z&quot;/></svg>');
              background-repeat:no-repeat;background-position:right 12px center;background-size:14px 14px;
            ">
              <option value="" disabled selected>Изберете клуб...</option>
              ${clubs.map(c => `<option value="${c.id ?? c.Id}">${c.name ?? c.Name ?? c.clubName ?? c.ClubName ?? 'Без име'}</option>`).join("")}
            </select>
          </div>

          <button id="confirm-change-club" style="
            appearance:none;display:inline-block;border:1px solid #e6e9ef;
            background:linear-gradient(180deg,#0e1425,#172033);color:#fff;font-weight:700;font-size:14px;
            padding:12px 18px;border-radius:12px;cursor:pointer;box-shadow:0 10px 24px rgba(15,23,42,.18);
            transition:transform .12s ease, box-shadow .12s ease;
          ">Потвърди</button>
        </div>
      `;

      document.getElementById("confirm-change-club").addEventListener("click", async () => {
        const selectedClubId = document.getElementById("club-select").value;
        if (!selectedClubId) {
          alert("Моля, изберете клуб.");
          return;
        }
        const selectedClubName = document.getElementById("club-select").selectedOptions[0].textContent;
        const isConfirmed = confirm(`Сигурни ли сте, че искате да се присъедините към клуб "${selectedClubName}"?`);
        if (isConfirmed) {
          await changeUserClub(u, selectedClubId);
        }
      });
    } catch (error) {
      console.error("Грешка:", error);
      alert("Неуспешно зареждане на клубовете.");
    }
  }

  async function changeUserClub(u, newClubId) {
    try {
      const response = await fetch(`${API_BASE}/users/${u.id}/requestJoin/${newClubId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!response.ok) {
        const errorMessage = await response.text();
        console.error("Грешка при изпращане на заявката за присъединяване:", errorMessage);
        alert(`Грешка: ${errorMessage}`);
        return;
      }

      alert("Заявката за присъединяване е изпратена. Очаква се одобрение.");

      u.clubID = Number(newClubId);
      u.statusID = 1;
      localStorage.setItem("user", JSON.stringify(u));
      renderUserInterface(u);

      await refreshSessionFromServer(u.id);
    } catch (error) {
      console.error("Грешка при смяната на клуба:", error);
      alert("Възникна грешка при смяната на клуба.");
    }
  }

  // Рендерни статус екрана при нужда
  renderUserInterface(user);

  // =========================
  // Профил/роля/клуб UI
  // =========================
  if (user) {
    const firstNameEl = document.getElementById("first-name");
    const lastNameEl = document.getElementById("last-name");
    const yobEl = document.getElementById("year-of-birth");

    if (firstNameEl) firstNameEl.textContent = user.firstName || "Няма данни";
    if (lastNameEl)  lastNameEl.textContent  = user.lastName || "Няма данни";
    if (yobEl)       yobEl.textContent       = user.yearOfBirth || "Няма данни";

    const isCoach = Number(user.roleID) === 2;
    const isAdmin =
      Number(user.roleID) === 3 ||
      (typeof user.role === "string" && user.role.toLowerCase() === "admin") ||
      user.isAdmin === true ||
      (Array.isArray(user.roles) && user.roles.some(r => String(r).toLowerCase() === "admin"));

    const coachButton  = document.getElementById("coach-button");
    const statusButton = document.getElementById("status-button");
    const adminButton  = document.getElementById("admin-button");

    if (isCoach || isAdmin) {
      coachButton?.classList.remove("hidden");
      statusButton?.classList.remove("hidden");
      coachButton?.addEventListener("click", () => { window.location.href = "CoacherPage.html"; });
      statusButton?.addEventListener("click", () => { window.location.href = "Status.html"; });
    } else {
      coachButton?.classList.add("hidden");
      statusButton?.classList.add("hidden");
    }

    if (isAdmin) {
      adminButton?.classList.remove("hidden");
      adminButton?.addEventListener("click", () => { window.location.href = "AdminHome.html"; });
    } else {
      adminButton?.classList.add("hidden");
    }

    // Клуб инфо
    fetch(`${API_BASE}/Clubs/${user.clubID}`)
      .then(response => {
        if (!response.ok) throw new Error("Network response was not ok");
        return response.json();
      })
      .then(club => {
        const clubEl = document.getElementById("club");
        const clubName =
          club?.name ??
          club?.Name ??
          club?.clubName ??
          club?.ClubName ??
          "Няма данни";
        if (clubEl) clubEl.textContent = clubName;

        fetchDisciplinesByClubId(user.clubID);
      })
      .catch(error => {
        console.error("Грешка при извличане на информация за клуба:", error);
        const clubEl = document.getElementById("club");
        if (clubEl) clubEl.textContent = "Грешка при зареждане на клуба";
      });

    // Профилна снимка
    if (user.id > 0) {
      fetch(`${API_BASE}/Users/profilePicture/${user.id}`)
        .then(response => {
          if (!response.ok) {
            console.error("Неуспешно зареждане на профилната снимка:", response.status, response.statusText);
            throw new Error("Неуспешно зареждане на профилната снимка");
          }
          return response.blob();
        })
        .then(imageBlob => {
          const imageUrl = URL.createObjectURL(imageBlob);
          const img = document.getElementById("profile-picture");
          if (img) img.src = imageUrl;
        })
        .catch(error => {
          console.error("Грешка при зареждане на профилната снимка:", error);
          const img = document.getElementById("profile-picture");
          if (img) {
            img.src = "https://sportstats.blob.core.windows.net/$web/ProfilePhoto2.jpg";
            img.alt = "Профилната снимка не е налична";
          }
        });
    } else {
      console.warn("Невалиден user.id:", user ? user.id : "user не е дефиниран");
      const img = document.getElementById("profile-picture");
      if (img) {
        img.src = "https://sportstats.blob.core.windows.net/$web/ProfilePhoto2.jpg";
        img.alt = "Профилната снимка не е налична";
      }
    }

    // Дисциплини/резултати (UI show/hide chart)
    const disciplineDropdown = document.getElementById("discipline");
    const chartContainer = document.getElementById("chart-container");

    disciplineDropdown?.addEventListener("change", function () {
      if (disciplineDropdown.value) {
        chartContainer && (chartContainer.style.display = "block");
        const disciplineId = parseInt(this.value, 10);
        if (disciplineId) {
          fetchResults(disciplineId, user.id);
        }
      } else {
        chartContainer && (chartContainer.style.display = "none");
      }
    });
  }

  // =========================
  // Дисциплини/класации
  // =========================
  let currentClubId = null;

  function fetchDisciplinesByClubId(clubId) {
    currentClubId = clubId;

    fetch(`${API_BASE}/ClubDisciplines/disciplines-by-club/${clubId}`)
      .then(r => { if (!r.ok) throw new Error("Network response was not ok"); return r.json(); })
      .then(disciplines => {
        populateDisciplineDropdown(disciplines);
      })
      .catch(err => console.error("Грешка при извличане на дисциплините на клуба:", err));
  }

  let disciplineSelectInitialized = false;
  function populateDisciplineDropdown(disciplines) {
    const disciplineSelect = document.getElementById("discipline");
    if (!disciplineSelect) return;

    disciplineSelect.innerHTML = '<option value="" disabled selected>Дисциплина</option>';

    const get = (o, ...keys) => {
      for (const k of keys) {
        if (o && o[k] !== undefined && o[k] !== null) return o[k];
      }
      return undefined;
    };

    disciplines.forEach(d => {
      const id =
        get(d, "id", "Id", "disciplineId", "DisciplineId") ??
        get(d?.discipline, "id", "Id") ??
        get(d?.Discipline, "Id", "id");

      const name =
        get(d, "disciplineName", "DisciplineName", "name", "Name") ??
        get(d?.discipline, "disciplineName", "DisciplineName", "name", "Name") ??
        get(d?.Discipline, "Name", "disciplineName", "name");

      const option = document.createElement("option");
      option.value = id ?? "";
      option.textContent = name ? name : `Дисциплина ${id ?? ""} (Без име)`;
      disciplineSelect.appendChild(option);
    });

    if (!disciplineSelectInitialized) {
      disciplineSelect.addEventListener("change", function () {
        const selectedDisciplineId = Number(this.value);
        if (currentClubId && selectedDisciplineId) {
          fetchBestResultsByDisciplineInClub(currentClubId, selectedDisciplineId);
          fetchBestClubByDiscipline(selectedDisciplineId, user.yearOfBirth);
        }
      });
      disciplineSelectInitialized = true;
    }
  }

  // ========================================
  // НАЙ-ДОБРИ В КЛУБА (таблица)
  // ========================================
  function fetchBestResultsByDisciplineInClub(clubId, disciplineId) {
    fetch(`${API_BASE}/results/by-club/${clubId}/by-discipline/${disciplineId}`)
      .then(r => { if (!r.ok) throw new Error("Грешка при извличане на резултатите"); return r.json(); })
      .then(results => {
        const tbody = document.querySelector("#users-table tbody");
        if (!tbody) return;
        tbody.innerHTML = "";

        if (!results || results.length === 0) {
          const row = document.createElement("tr");
          row.innerHTML = `<td colspan="4" style="text-align:center;">Няма налични резултати за тази дисциплина.</td>`;
          tbody.appendChild(row);
          return;
        }

        const unit = getUnitForDiscipline(Number(disciplineId));
        results.forEach((r, index) => {
          const userFirstName = r.userFirstName ?? r.UserFirstName ?? "";
          const userLastName  = r.userLastName  ?? r.UserLastName  ?? "";
          const yearOfBirth   = r.userYearOfBirth ?? r.UserYearOfBirth ?? "";
          const valueTime     = r.valueTime ?? r.ValueTime;

          const displayValue = formatResultValue(valueTime, unit);

          let medalIcon = "", rowClass = "";
          if (index === 0) { medalIcon = "🥇"; rowClass = "first-place"; }
          else if (index === 1) { medalIcon = "🥈"; rowClass = "second-place"; }
          else if (index === 2) { medalIcon = "🥉"; rowClass = "third-place"; }

          const row = document.createElement("tr");
          row.className = rowClass;
          row.innerHTML = `
            <td>${medalIcon} ${userFirstName} ${userLastName}</td>
            <td>${yearOfBirth}</td>
            <td>${displayValue}</td>
          `;
          tbody.appendChild(row);
        });
      })
      .catch(error => console.error("Грешка при зареждане на резултатите:", error));
  }

  function fetchBestClubByDiscipline(disciplineId, yearOfBirth) {
    fetch(`${API_BASE}/Results/best-club-by-discipline/${disciplineId}/year/${yearOfBirth}`)
      .then(r => { if (!r.ok) throw new Error("Неуспешно извличане на резултати"); return r.json(); })
      .then(data => populateBestClubTable([data], Number(disciplineId)))
      .catch(error => console.error("Грешка при зареждане на най-добър клуб:", error));
  }

  function populateBestClubTable(data, disciplineId) {
    const tbody = document.querySelector("#best-club-table tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const normalized = Array.isArray(data) ? data.map(x => {
      const br = x.bestResult ?? x.BestResult;
      return {
        ageGroup: x.ageGroup ?? x.AgeGroup,
        bestResult: br ? {
          clubName:      br.clubName      ?? br.ClubName,
          valueTime:     br.valueTime     ?? br.ValueTime,
          userFirstName: br.userFirstName ?? br.UserFirstName,
          userLastName:  br.userLastName  ?? br.UserLastName,
          yearOfBirth:   br.yearOfBirth   ?? br.YearOfBirth,
          resultDate:    br.resultDate    ?? br.ResultDate,
          location:      br.location      ?? br.Location
        } : null
      };
    }) : [];

    const unit = getUnitForDiscipline(Number(disciplineId));
    const sorted = normalized.sort((a, b) => (a.bestResult?.valueTime || 0) - (b.bestResult?.valueTime || 0));

    sorted.forEach((entry, index) => {
      const { ageGroup, bestResult } = entry;
      if (!bestResult || bestResult.valueTime == null) return;

      const formattedValue = formatResultValue(bestResult.valueTime, unit);
      const row = document.createElement("tr");
      let rowClass = "", medalEmoji = "";
      if (index === 0) { rowClass = "gold-row";   medalEmoji = "🥇"; }
      else if (index === 1) { rowClass = "silver-row"; medalEmoji = "🥈"; }
      else if (index === 2) { rowClass = "bronze-row"; medalEmoji = "🥉"; }

      row.classList.add("best-club-row", rowClass);
      row.innerHTML = `
        <td>${ageGroup}</td>
        <td>${medalEmoji} ${bestResult.clubName}</td>
        <td>${formattedValue}</td>
      `;

      // hover-инфо
      row.addEventListener("mouseenter", () => {
        const hoverDiv = document.getElementById("hover-info");
        if (!hoverDiv) return;
        hoverDiv.style.display = "block";
        hoverDiv.innerHTML = `
          <strong>Състезател:</strong> ${bestResult.userFirstName} ${bestResult.userLastName}<br>
          <strong>Роден:</strong> ${bestResult.yearOfBirth}<br>
          <strong>Дата:</strong> ${new Date(bestResult.resultDate).toLocaleDateString()}<br>
          <strong>Локация:</strong> ${bestResult.location}
        `;
        const rect = row.getBoundingClientRect();
        hoverDiv.style.top = `${rect.bottom + window.scrollY}px`;
        hoverDiv.style.left = `${rect.left}px`;
        hoverDiv.style.position = "absolute";
      });
      row.addEventListener("mouseleave", () => {
        const hoverDiv = document.getElementById("hover-info");
        if (hoverDiv) hoverDiv.style.display = "none";
      });

      tbody.appendChild(row);
    });
  }

  // =========================
  // Резултати + нормативи
  // =========================
  function mapPoolLengthToId(length) {
    const n = Number(String(length).replace(/[^\d.]/g, ""));
    if (n === 25) return 1;
    if (n === 50) return 2;
    return 0;
  }

  // Безопасен парс на дата – връща Date или null
  function safeDate(d) {
    if (!d) return null;
    const t = typeof d === "string" ? d : String(d);
    const dt = new Date(t);
    if (!isNaN(dt.getTime())) return dt;
    // ISO без T?
    const try2 = new Date(t.replace(" ", "T"));
    return isNaN(try2.getTime()) ? null : try2;
  }

  // Нормализация на резултатите към единен формат
  function normalizeResults(results) {
    return (results || []).map(r => {
      const valueTime =
        r.valueTime ?? r.ValueTime ?? r.resultTime ?? r.ResultTime ?? r.time ?? r.Time;

      const resultDateRaw =
        r.resultDate ?? r.ResultDate ?? r.date ?? r.Date ?? r.createdAt ?? r.CreatedAt;

      const location = r.location ?? r.Location ?? r.venue ?? r.Venue ?? "";

      const pool =
        r.swimmingPoolStandart ?? r.SwimmingPoolStandart ?? r.poolLength ?? r.PoolLength ?? "";

      const poolId = r.swimmingPoolStandartId ??
                     r.SwimmingPoolStandartId ??
                     mapPoolLengthToId(pool);

      return {
        valueTime: Number(valueTime),
        resultDate: safeDate(resultDateRaw),
        location,
        swimmingPoolStandartId: Number(poolId)
      };
    }).filter(x => Number.isFinite(x.valueTime));
  }

  function fetchResults(disciplineId, userId) {
    const userString = localStorage.getItem("user");
    let u;
    try { u = JSON.parse(userString); } catch (err) { console.error("Грешка при парсване на потребителя от localStorage.", err); }

    if (!disciplineId || !userId || !u || !u.id || !u.yearOfBirth || !u.gender) {
      console.error("Липсват данни: disciplineId, userId или потребителската информация.", { disciplineId, userId, u });
      return;
    }

    if (u.id !== userId) {
      alert("Нямате права да виждате тези резултати!");
      return;
    }

    const NO_RESULTS_MESSAGE = "Няма налични резултати.";

    function displayNoResults() {
      const br = document.getElementById("best-result");
      const lr = document.getElementById("latest-result");
      const nd = document.getElementById("normative-difference");
      const nv = document.getElementById("normative-value");
      if (br) br.textContent = NO_RESULTS_MESSAGE;
      if (lr) lr.textContent = NO_RESULTS_MESSAGE;
      if (nd) nd.textContent = "";
      if (nv) nv.innerHTML = "";

      const chartCanvas = document.getElementById("resultsChart");
      if (chartCanvas && chart) chart.destroy();
    }

    const br = document.getElementById("best-result");
    const lr = document.getElementById("latest-result");
    if (br) br.textContent = "Зареждане...";
    if (lr) lr.textContent = "Зареждане...";

    const url = `${API_BASE}/Results/by-user/${userId}/by-discipline/${disciplineId}`;
    console.debug("fetchResults ->", { url, disciplineId, userId });

    fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json", "Requester-Id": String(u.id) }
    })
      .then(async r => {
        if (r.status === 404) { displayNoResults(); return null; }
        if (r.status === 403) { displayNoResults(); alert("Нямате права да виждате тези резултати."); return null; }
        if (!r.ok) throw new Error("Network response was not ok");
        return r.json();
      })
      .then(results => {
        if (!results) return;
        if (!Array.isArray(results) || results.length === 0) { displayNoResults(); return; }
        console.debug("fetchResults -> получени резултати:", results.length);
        fetchNormativesAndDisplayResults(disciplineId, u.yearOfBirth, u.gender, results);
      })
      .catch(error => {
        console.error("Грешка при извличане на резултатите:", error);
        displayNoResults();
      });
  }

  function normalizeGender(g) {
    if (!g) return null;
    const s = String(g).trim().toLowerCase();
    if (["m","male","момче","мъж"].includes(s)) return "M";
    if (["f","female","момиче","жена"].includes(s)) return "F";
    if (s === "m" || s === "f") return s.toUpperCase();
    return g;
  }

  function inYearRange(userYear, n) {
    const num = (v) => Number.isFinite(Number(v)) ? Number(v) : NaN;

    const min =
      num(n.minYearOfBorn) ??
      num(n.MinYearOfBorn) ??
      num(n.minYearOfBirth?.slice?.(0,4)) ??
      num(n.MinYearOfBirth?.slice?.(0,4));

    const max =
      num(n.maxYearOfBorn) ??
      num(n.MaxYearOfBorn) ??
      num(n.maxYearOfBirth?.slice?.(0,4)) ??
      num(n.MaxYearOfBirth?.slice?.(0,4));

    if (Number.isFinite(min) && Number.isFinite(max) && Number.isFinite(userYear)) {
      return userYear >= min && userYear <= max;
    }

    const nowYear = new Date().getFullYear();
    const minAge = num(n.minAge ?? n.MinAge);
    const maxAge = num(n.maxAge ?? n.MaxAge);
    if (Number.isFinite(minAge) && Number.isFinite(maxAge)) {
      const age = nowYear - Number(userYear);
      return age >= minAge && age <= maxAge;
    }

    return true;
  }

  function fetchNormativesAndDisplayResults(disciplineId, yearOfBirth, userGender, results) {
    if (Number(disciplineId) === 18) {
      displayResults(disciplineId, yearOfBirth, userGender, results, []);
      return;
    }

    const url = `${API_BASE}/Normatives/discipline/${disciplineId}`;
    console.debug("fetchNormatives ->", { url, disciplineId, yearOfBirth, userGender });

    fetch(url)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(raw => {
        const g = normalizeGender(userGender) ?? userGender;

        const filtered = (raw || []).filter(n => {
          const nGender = normalizeGender(n.gender ?? n.Gender) ?? (n.gender ?? n.Gender);
          const okGender = !g || !nGender || nGender === g;
          const okYear   = inYearRange(Number(yearOfBirth), n);
          return okGender && okYear;
        });

        console.debug("fetchNormatives -> counts", {
          total: raw?.length ?? 0,
          filtered: filtered.length,
          sample: filtered.slice(0, 3)
        });

        displayResults(disciplineId, yearOfBirth, g, results, filtered);
      })
      .catch(error => {
        console.warn("Грешка при извличане на нормативите:", error);
        displayResults(disciplineId, yearOfBirth, userGender, results, []);
      });
  }

  function displayResults(disciplineId, yearOfBirth, userGender, rawResults, normatives) {
    const isTimeDiscipline = Number(disciplineId) !== 18;

    // ***** НОВО: нормализирай резултатите *****
    const results = normalizeResults(rawResults);
    if (!results.length) {
      const br = document.getElementById("best-result");
      const lr = document.getElementById("latest-result");
      if (br) br.textContent = "Няма данни";
      if (lr) lr.textContent = "Няма данни";
    }

    // сортирай по дата (ако има), иначе по входния ред
    const sortedResults = [...results].sort((a, b) => {
      const ad = a.resultDate ? a.resultDate.getTime() : 0;
      const bd = b.resultDate ? b.resultDate.getTime() : 0;
      return bd - ad;
    });

    const latestResult = sortedResults[0];
    const oldestResult = sortedResults[sortedResults.length - 1];

    function findBestResult(rs, isTime) {
      return rs.reduce((best, r) => {
        return isTime ? (r.valueTime < best.valueTime ? r : best) : (r.valueTime > best.valueTime ? r : best);
      }, rs[0]);
    }

    const normative25 = (normatives || []).find(n => (n.swimmingPoolStandartId ?? n.SwimmingPoolStandartId) === 1);
    const normative50 = (normatives || []).find(n => (n.swimmingPoolStandartId ?? n.SwimmingPoolStandartId) === 2);

    function compareToNormative(normative, poolLabel, resultOverride = null) {
      const poolId = normative.swimmingPoolStandartId ?? normative.SwimmingPoolStandartId;
      const resultToUse = resultOverride || findBestResult(
        results.filter(r => r.swimmingPoolStandartId === poolId),
        isTimeDiscipline
      );

      if (!resultToUse) {
        return `
          <div style="border: 1px solid #eee; padding: 12px; margin-bottom: 16px; border-radius: 8px; background-color: #f9f9f9;">
            <div style="font-weight: 600;">${poolLabel}</div>
            <div>Няма резултати за сравнение с този норматив.</div>
          </div>`;
      }

      const valueStandart = Number(normative.valueStandart ?? normative.ValueStandart);
      const diff = isTimeDiscipline
        ? resultToUse.valueTime - valueStandart
        : valueStandart - resultToUse.valueTime;

      const isSuccess = diff <= 0;
      const formattedDiff = formatDifference(diff, getUnitForDiscipline(disciplineId));
      return `
<div class="norm-card" style="
  position: relative; display: grid; gap: 10px; padding: 14px 16px; margin: 0;
  border-radius: 12px; background: rgba(255,255,255,.58); border: 1px solid #e7ebf4;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.7), 0 12px 30px rgba(15,23,42,.08);
  backdrop-filter: blur(14px) saturate(1.05); -webkit-backdrop-filter: blur(14px) saturate(1.05);
  font-family: 'Inter','Segoe UI',system-ui,-apple-system,Roboto,Helvetica,Arial; font-size: 13px; color: #0b0f19; max-width: 100%;
">
  <span style="
    position:absolute; inset:0 auto 0 0; width:4px;
    background:${isSuccess ? 'linear-gradient(180deg,#12b886,#0f9b6d)' : 'linear-gradient(180deg,#f43f5e,#dc2626)'};">
  </span>

  <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
    <div style="font-weight:700; color:#0c1222; font-size:15px; letter-spacing:.2px;">${poolLabel}</div>
    <div style="
      display:inline-flex; align-items:center; gap:8px; padding:6px 10px; border-radius:999px;
      background:${isSuccess ? 'rgba(18,184,134,.12)' : 'rgba(244,63,94,.12)'}; color:${isSuccess ? '#0f9b6d' : '#b91c1c'};
      border:1px solid ${isSuccess ? 'rgba(18,184,134,.35)' : 'rgba(244,63,94,.35)'}; font-weight:700; font-size:12px;">
      ${isSuccess ? "Покрит норматив" : "Непокрит норматив"}
    </div>
  </div>

  <div style="height:1px; background:linear-gradient(to right, transparent, #e7ebf5 30%, #e7ebf5 70%, transparent);"></div>

  <div style="display:grid; gap:10px; font-variant-numeric: tabular-nums;">
    <div>
      <div style="color:#6a7280; font-size:12px; margin-bottom:2px;">Норматив БФПС</div>
      <div style="font-weight:700; color:#0e1425; font-size:14px;">${formatTime(valueStandart)}</div>
    </div>
    <div>
      <div style="color:#6a7280; font-size:12px; margin-bottom:2px;">Разлика</div>
      <div style="font-weight:800; font-size:14px; color:${isSuccess ? "#0f9b6d" : "#b91c1c"};">${formattedDiff}</div>
    </div>
  </div>
</div>`;
    }

    const bestOverall = results.length ? findBestResult(results, isTimeDiscipline) : null;

    let normativeValueText = "";
    if (Number(disciplineId) !== 18) {
      if (normative25) {
        const candidate = results
          .filter(r => [1, 2].includes(r.swimmingPoolStandartId))
          .filter(r => r.valueTime <= Number(normative25.valueStandart ?? normative25.ValueStandart));
        normativeValueText += compareToNormative(normative25, "25м басейн", candidate[0] || null);
      }
      if (normative50) {
        const has50 = results.some(r => r.swimmingPoolStandartId === 2);
        normativeValueText += has50
          ? compareToNormative(normative50, "50м басейн")
          : `
            <div style="border: 1px solid #eee; padding: 12px; margin-bottom: 16px; border-radius: 8px; background-color: #f9f9f9;">
              <div style="font-weight: 600;">50м басейн</div>
              <div>Няма резултати за сравнение с този норматив.</div>
            </div>`;
      }
      if (!normative25 && !normative50) {
        normativeValueText = "Няма норматив за тази възрастова група и дисциплина.";
      }
    } else {
      normativeValueText = '<div style="padding: 8px; color: #777;">Няма норматив за тази дисциплина.</div>';
    }

    // ***** ДИАГРАМА – използвай нормализираните данни *****
    const labelsAll = sortedResults.map((r, i) => {
      const d = r.resultDate;
      return d ? d.toLocaleDateString("bg-BG") : `#${sortedResults.length - i}`;
    });
    const dataAll = sortedResults.map(r => r.valueTime);
    const norm25All = labelsAll.map(() => normative25 ? Number(normative25.valueStandart ?? normative25.ValueStandart) : null);
    const norm50All = labelsAll.map(() => normative50 ? Number(normative50.valueStandart ?? normative50.ValueStandart) : null);

    const ctx = document.getElementById("resultsChart")?.getContext("2d");
    console.debug("Chart debug ->", {
      points: dataAll.length,
      labels: labelsAll.slice(-8),
      data: dataAll.slice(-8),
      norm25: norm25All.slice(-8),
      norm50: norm50All.slice(-8),
      hasCtx: !!ctx,
      ChartAvailable: typeof Chart !== "undefined"
    });

    if (ctx && typeof Chart !== "undefined") {
      if (chart) chart.destroy();

      const latestDataCount = 8;
      const latestLabels = labelsAll.slice(-latestDataCount);
      const latestChartData = dataAll.slice(-latestDataCount);
      const latestChartNormative25m = norm25All.slice(-latestDataCount);
      const latestChartNormative50m = norm50All.slice(-latestDataCount);

      const gResult = ctx.createLinearGradient(0, 0, 0, 300);
      gResult.addColorStop(0, "rgba(15, 23, 42, 0.28)");
      gResult.addColorStop(1, "rgba(15, 23, 42, 0.06)");

      const gNorm25 = ctx.createLinearGradient(0, 0, 0, 300);
      gNorm25.addColorStop(0, "rgba(79, 124, 247, 0.55)");
      gNorm25.addColorStop(1, "rgba(79, 124, 247, 0.10)");

      const gNorm50 = ctx.createLinearGradient(0, 0, 0, 300);
      gNorm50.addColorStop(0, "rgba(16, 185, 129, 0.55)");
      gNorm50.addColorStop(1, "rgba(16, 185, 129, 0.10)");

      chart = new Chart(ctx, {
        type: "line",
        data: {
          labels: latestLabels,
          datasets: [
            { label: "Резултати", data: latestChartData, borderColor: "rgba(15,23,42,0.85)", backgroundColor: gResult, borderWidth: 2, tension: 0.35, fill: true, pointRadius: 3, pointHoverRadius: 5, pointBackgroundColor: "rgba(15,23,42,0.85)", pointBorderWidth: 0, pointHitRadius: 10 },
            { label: "Норматив 25м", data: latestChartNormative25m, borderColor: "rgba(79,124,247,0.9)", backgroundColor: gNorm25, borderWidth: 1.5, borderDash: [6, 6], tension: 0.25, pointRadius: 0, fill: false },
            { label: "Норматив 50м", data: latestChartNormative50m, borderColor: "rgba(16,185,129,0.9)", backgroundColor: gNorm50, borderWidth: 1.5, borderDash: [6, 6], tension: 0.25, pointRadius: 0, fill: false }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "nearest", intersect: false },
          layout: { padding: { left: 6, right: 6, top: 4, bottom: 2 } },
          plugins: {
            legend: {
              position: "top",
              align: "start",
              labels: {
                usePointStyle: true,
                pointStyle: "line",
                font: { family: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial", size: 12, weight: 600 },
                color: "#0b0f19",
                padding: 12,
                boxWidth: 16
              }
            },
            tooltip: {
              backgroundColor: "rgba(255,255,255,0.92)",
              titleColor: "#0b0f19",
              bodyColor: "#0b0f19",
              borderColor: "#e7ebf4",
              borderWidth: 1,
              displayColors: false,
              titleFont: { family: "Inter, system-ui, -apple-system", size: 13, weight: 700 },
              bodyFont: { family: "Inter, system-ui, -apple-system", size: 12, weight: 500 },
              padding: 10,
              callbacks: {
                label: (context) => {
                  const i = context.dataIndex;
                  const result = sortedResults.slice(-8)[i];
                  const value = result?.valueTime;
                  const unit = getUnitForDiscipline(disciplineId);
                  const formattedValue = isTimeDiscipline ? formatTime(value) : `${value} ${unit}`;
                  const formattedDate = result?.resultDate ? result.resultDate.toLocaleDateString("bg-BG") : "Няма дата";
                  const location = result?.location || "Няма информация";
                  const poolLength = result?.swimmingPoolStandartId === 2 ? "50 м" : result?.swimmingPoolStandartId === 1 ? "25 м" : "—";

                  if (context.dataset.label.includes("Норматив")) {
                    const y = context.parsed.y;
                    return `Норматив (${poolLength}): ${isTimeDiscipline ? formatTime(y) : `${y} ${unit}`}`;
                  }
                  return [`Дата: ${formattedDate}`, `Резултат: ${formattedValue}`, `Локация: ${location}`, `Басейн: ${poolLength}`];
                },
                title: () => ""
              }
            }
          },
          scales: {
            x: { display: false, grid: { display: false }, ticks: { display: false } },
            y: {
              title: { display: true, text: getUnitForDiscipline(disciplineId), color: "#6a7280", font: { size: 12, weight: "600", family: "Inter, system-ui, -apple-system" }, padding: { bottom: 8 } },
              beginAtZero: !isTimeDiscipline,
              reverse: isTimeDiscipline,
              ticks: {
                color: "#6a7280",
                padding: 6,
                autoSkip: true,
                maxTicksLimit: 7,
                callback: (v) => (isTimeDiscipline ? formatTime(v) : `${v} ${getUnitForDiscipline(disciplineId)}`)
              },
              grid: { color: "rgba(15,23,42,0.06)", borderColor: "#e7ebf4", tickColor: "transparent" }
            }
          },
          animation: { duration: 700, easing: "easeOutQuart" },
          elements: { line: { capBezierPoints: true }, point: { hoverBorderWidth: 0 } },
          hover: { mode: "nearest", intersect: false }
        }
      });
    } else {
      console.warn("Chart.js не е наличен или canvas липсва.");
    }

    const bestResEl = document.getElementById("best-result");
    const latestResEl = document.getElementById("latest-result");
    if (bestResEl) {
      bestResEl.textContent = bestOverall
        ? `Най-добър резултат: ${formatResultValue(bestOverall.valueTime, getUnitForDiscipline(disciplineId))}`
        : "Няма налични резултати.";
    }
    if (latestResEl) {
      latestResEl.textContent = oldestResult
        ? `Последен резултат: ${formatResultValue(oldestResult.valueTime, getUnitForDiscipline(disciplineId))}`
        : "Няма налични резултати.";
    }

    const nv = document.getElementById("normative-value");
    if (nv) {
      nv.innerHTML = normativeValueText;
      nv.classList.add("norm-cards");
    }
    const nd = document.getElementById("normative-difference");
    if (nd) nd.innerHTML = "";
  }

  // =========================
  // Формати и единици
  // =========================
  function formatTime(seconds) {
    const s = Number(seconds);
    if (!Number.isFinite(s)) return "Неизвестна стойност";
    if (s < 1) {
      const millis = Math.round(s * 100).toString().padStart(2, "0");
      return `${millis}ст`;
    }
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    const millisNum = Math.round((s % 1) * 100);
    const millis = millisNum.toString().padStart(2, "0");

    let timeString = "";
    if (hours > 0) timeString += `${hours} : `;
    if (minutes > 0 || hours > 0) timeString += `${minutes}мин `;
    if (secs > 0 || minutes > 0 || hours > 0) timeString += `${secs}сек `;
    if (millisNum > 0 || s % 1 !== 0) timeString += `${millis}ст `;
    return timeString.trim();
  }

  function getUnitForDiscipline(disciplineId) {
    const id = Number(disciplineId);
    const timeDisciplines = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17];
    const distanceDisciplines = [18];
    if (timeDisciplines.includes(id)) return "време";
    if (distanceDisciplines.includes(id)) return "метра";
    return "";
  }

  function formatResultValue(value, unit) {
    const v = Number(value);
    if (!Number.isFinite(v)) return "Няма данни";
    if (unit === "време") return formatTime(v);
    if (unit === "метра") return `${v.toFixed(2)} м`;
    return String(v);
  }

  function formatDifference(diff, unit) {
    const d = Number(diff) || 0;
    const sign = d > 0 ? "+" : d < 0 ? "-" : "±";
    const abs = Math.abs(d);

    if (unit === "време") {
      return `${sign}${formatTime(abs)}`;
    }
    return `${sign}${abs.toFixed(2)} м`;
  }
});
