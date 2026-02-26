// HomePageScript.js (FULL) — session/cors/404-safe + coach/admin UI fixes
// -----------------------------------------------------------------------------
// Expects existing HTML ids:
// - #first-name, #last-name, #year-of-birth, #club, #profile-picture
// - #discipline (select), #chart-container, #resultsChart (canvas)
// - #best-result, #latest-result, #normative-value, #normative-difference
// - #users-table tbody, #best-club-table tbody, #hover-info
// - Optional: #coach-button, #status-button, #admin-button
// This script injects: "+" quick add button + modal + splits containers if missing.

document.addEventListener("DOMContentLoaded", async () => {
  let chart = null;

  // ========================================
  // API base (local/prod) + override from localStorage
  // ========================================
// PROD only
const API_BASE = "https://sportstatsapi.azurewebsites.net"; // root
const API_ROOT = API_BASE; // за static paths / profile pictures

console.debug("[API_BASE]", API_BASE, "[API_ROOT]", API_ROOT);
  console.debug("[API_BASE]", API_BASE, "[API_ROOT]", API_ROOT);

  // HTML има inline onclick="redirectToCoacherPage()"
  window.redirectToCoacherPage = function () {
    window.location.href = "CoacherPage.html";
  };

  // ========================================
  // Helpers: safe DOM + fetch
  // ========================================
  const $ = (id) => document.getElementById(id);

  function redirectToIndex(message) {
    alert(message);
    localStorage.clear();
    window.location.href = "Index.html";
  }

async function apiFetch(path, options = {}) {
  const base = String(API_BASE || "").replace(/\/+$/, "");
  let p = String(path || "");

  // ако е абсолютен URL – не го пипаме
  if (!(p.startsWith("http://") || p.startsWith("https://"))) {
    // нормализирай path -> винаги да започва с /
    p = p.startsWith("/") ? p : `/${p}`;

    // гарантирай /api префикс (без /api/api)
    const baseHasApi = base.endsWith("/api");
    const pathHasApi = p === "/api" || p.startsWith("/api/");

    if (baseHasApi && pathHasApi) {
      p = p === "/api" ? "" : p.replace(/^\/api/, "");
    } else if (!baseHasApi && !pathHasApi) {
      p = `/api${p}`;
    }
  }

  const url = (p.startsWith("http://") || p.startsWith("https://"))
    ? p
    : `${base}${p}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body != null && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const u = getUIUser();
  if (u?.id && !headers.has("Requester-Id")) headers.set("Requester-Id", String(u.id));

  return fetch(url, {
    credentials: "include",
    ...options,
    headers
  });
}

  async function apiFetchJsonOrNull(path, options = {}) {
    const r = await apiFetch(path, options);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  function safeJSONParse(raw) {
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  }

  function getUIUser() {
    const raw = localStorage.getItem("user");
    return safeJSONParse(raw);
  }

  function toUIUserFromSession(sess) {
    if (!sess) return null;

    const id =
      sess.id ?? sess.Id ?? sess.userId ?? sess.UserId ?? 0;

    if (!id) return null;

    return {
      id: Number(id),
      firstName: sess.firstName ?? sess.FirstName ?? "",
      lastName: sess.lastName ?? sess.LastName ?? "",
      email: sess.email ?? sess.Email ?? null,
      gender: sess.gender ?? sess.Gender ?? "",
      roleID: Number(sess.roleID ?? sess.RoleID ?? 0),
      clubID: Number(sess.clubID ?? sess.ClubID ?? 0),
      profileImage_url: sess.profileImage_url ?? sess.ProfileImage_url ?? "",
      yearOfBirth: Number(sess.yearOfBirth ?? sess.YearOfBirth ?? 0),
      statusID: Number(sess.statusID ?? sess.StatusID ?? 0),
      userTokenHash: sess.userTokenHash ?? sess.UserTokenHash ?? null
    };
  }

  // PascalCase server user -> UI user
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

  function toSessionFromServerUser(su, userTokenHash) {
    return {
      Id: su.Id,
      FirstName: su.FirstName ?? "",
      LastName: su.LastName ?? "",
      Email: su.Email ?? null,
      Gender: su.Gender ?? "",
      RoleID: su.RoleID ?? 0,
      ClubID: su.ClubID ?? 0,
      profileImage_url: su.profileImage_url ?? "",
      YearOfBirth: su.YearOfBirth ?? 0,
      StatusID: su.StatusID ?? 0,
      UserTokenHash: userTokenHash || su.UserTokenHash || ""
    };
  }

  // ========================================
  // Shared time parser (използва се навсякъде)
  // Поддържа:
  // - 67.13 / 67,13
  // - 1:07.13
  // - 0:59,88
  // - 1:02:03.45
  // ========================================
  function parseTimeToSeconds(input) {
    const s = String(input || "").trim();
    if (!s) return NaN;

    // allow pure seconds: "67.13" / "67,13"
    if (/^\d+([.,]\d+)?$/.test(s)) {
      return Number(s.replace(",", "."));
    }

    // allow "m:ss.xx" or "h:mm:ss.xx"
    const parts = s.replace(",", ".").split(":").map(x => x.trim());
    if (parts.length === 2) {
      const m = Number(parts[0]);
      const sec = Number(parts[1]);
      if (!Number.isFinite(m) || !Number.isFinite(sec)) return NaN;
      return m * 60 + sec;
    }
    if (parts.length === 3) {
      const h = Number(parts[0]);
      const m = Number(parts[1]);
      const sec = Number(parts[2]);
      if (!Number.isFinite(h) || !Number.isFinite(m) || !Number.isFinite(sec)) return NaN;
      return h * 3600 + m * 60 + sec;
    }
    return NaN;
  }

  // ========================================
  // ✅ Session hash: canonical payload MUST match C# UserSession.GetCanonicalPayload()
  // C# order:
  // Id|FirstName|LastName|Email|Gender|RoleID|ClubID|profileImage_url|YearOfBirth|StatusID
  // ========================================
  function canonicalPayload(serverUser) {
    return [
      Number(serverUser.Id),
      (serverUser.FirstName ?? "").trim(),
      (serverUser.LastName ?? "").trim(),
      (serverUser.Email ?? "").trim(),
      (serverUser.Gender ?? "").trim(),
      Number(serverUser.RoleID),
      Number(serverUser.ClubID),
      (serverUser.profileImage_url ?? "").trim(),
      Number(serverUser.YearOfBirth),
      Number(serverUser.StatusID)
    ].join("|");
  }

  async function sha256Base64(str) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  }

  async function computeServerHash(serverUser) {
    return sha256Base64(canonicalPayload(serverUser));
  }

  // ========================================
  // ✅ Session bootstrap (FIX for "Невалидна сесия")
  // - Login page saves localStorage.session (UserSession) + localStorage.userHash
  // - Older code expected userServer + user (missing after login) -> broke.
  // ========================================
  (function bootstrapSessionFromLocalStorage() {
    const sess = safeJSONParse(localStorage.getItem("session"));
    const user = getUIUser();
    const savedHash = localStorage.getItem("userHash");

    // If "user" is missing but "session" exists -> build user from session
    if (!user && sess) {
      const ui = toUIUserFromSession(sess);
      if (ui?.id) localStorage.setItem("user", JSON.stringify(ui));
    }

    // If hash missing but session has it -> store
    const h = savedHash || sess?.UserTokenHash || sess?.userTokenHash || null;
    if (h) localStorage.setItem("userHash", h);

    // If userServer missing but we have session -> treat session as serverUser surrogate
    const serverUserJson = localStorage.getItem("userServer");
    if (!serverUserJson && sess?.Id) {
      localStorage.setItem("userServer", JSON.stringify(sess));
    }
  })();

  // ========================================
  // Refresh session from server (keeps localStorage in sync)
  // ========================================
  async function refreshSessionFromServer(userId) {
    try {
      const res = await apiFetch(`/Users/${userId}`, { method: "GET" });
      if (!res.ok) throw new Error("Неуспешно опресняване на сесията");
      const serverUser = await res.json(); // PascalCase

      // keep raw server user
      localStorage.setItem("userServer", JSON.stringify(serverUser));
      // keep UI user
      localStorage.setItem("user", JSON.stringify(toUIUser(serverUser)));

      const h = serverUser.UserTokenHash || (await computeServerHash(serverUser));
      localStorage.setItem("userHash", h);

      // also keep session shape (so next boot is stable)
      localStorage.setItem("session", JSON.stringify(toSessionFromServerUser(serverUser, h)));

      return true;
    } catch (e) {
      console.error("refreshSessionFromServer:", e);
      return false;
    }
  }

  // ========================================
  // Guard: verify session
  // ========================================
  const serverUserJson = localStorage.getItem("userServer");
  const savedHash = localStorage.getItem("userHash");

  if (!serverUserJson || !savedHash) {
    return redirectToIndex("Невалидна сесия. Влез отново.");
  }

  // UI user must exist
  let user = getUIUser();
  if (!user || !user.id) {
    // try one more fallback from session
    const sess = safeJSONParse(localStorage.getItem("session"));
    const ui = toUIUserFromSession(sess);
    if (ui?.id) {
      localStorage.setItem("user", JSON.stringify(ui));
      user = ui;
    } else {
      return redirectToIndex("Сесията е невалидна. Влез отново.");
    }
  }

  // Verify hash; if mismatch -> try refresh once, then redirect
  try {
    const serverUser = JSON.parse(serverUserJson);
    const currentHash = await sha256Base64(canonicalPayload(serverUser));
    if (currentHash !== savedHash) {
      console.warn("Hash mismatch -> trying refreshSessionFromServer()");
      const ok = await refreshSessionFromServer(user.id);
      user = getUIUser();
      if (!ok) return redirectToIndex("Сесията е невалидна. Влез отново.");

      const serverUser2 = JSON.parse(localStorage.getItem("userServer") || "{}");
      const currentHash2 = await sha256Base64(canonicalPayload(serverUser2));
      const savedHash2 = localStorage.getItem("userHash");
      if (currentHash2 !== savedHash2) {
        return redirectToIndex("Не бъди злонамерен <3");
      }
    }
  } catch (e) {
    console.error("Грешка при проверка на сесията:", e);
    return redirectToIndex("Възникна грешка. Влез отново.");
  }

  // ========================================
  // Periodic status check (club/status changed)
  // ========================================
  async function checkUserStatus(u) {
    try {
      const response = await apiFetch(`/Users/${u.id}`, { method: "GET" });
      if (!response.ok) throw new Error("Грешка при извличане на статуса");

      const updatedUser = await response.json(); // PascalCase
      if (Number(u.statusID) !== Number(updatedUser.StatusID) || Number(u.clubID) !== Number(updatedUser.ClubID)) {
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

  // ========================================
  // UI render by status (pending/rejected)
  // ========================================
  function renderUserInterface(u) {
    if (Number(u.statusID) === 1 || Number(u.statusID) === 3) {
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
            ${Number(u.statusID) === 1 ? "Вашата заявка е в процес на одобрение." : "Вашата заявка е отхвърлена."}
          </h2>

          <p style="
            margin: 0 0 18px;
            font-size: 14px;
            color: #6a7280;
            line-height: 1.55;
          ">
            ${Number(u.statusID) === 1 ? "Моля, изчакайте одобрение от администратора." : "Можете да изберете друг клуб и да изпратите нова заявка."}
          </p>

          <button id="change-club-button" style="
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
          ">Смени клуба</button>
        </div>
      `;

      $("change-club-button")?.addEventListener("click", () => loadClubs(u));
      return true;
    }
    return false;
  }

  // ========================================
  // Change club flow
  // ========================================
  async function loadClubs(u) {
    try {
      const response = await apiFetch(`/Clubs`, { method: "GET" });
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
              ${clubs.map(c => `<option value="${c.id ?? c.Id}">${c.name ?? c.Name ?? c.clubName ?? c.ClubName ?? "Без име"}</option>`).join("")}
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

      $("confirm-change-club")?.addEventListener("click", async () => {
        const selectedClubId = $("club-select")?.value;
        if (!selectedClubId) return alert("Моля, изберете клуб.");

        const selectedClubName = $("club-select")?.selectedOptions?.[0]?.textContent || "";
        const isConfirmed = confirm(`Сигурни ли сте, че искате да се присъедините към клуб "${selectedClubName}"?`);
        if (isConfirmed) await changeUserClub(u, selectedClubId);
      });
    } catch (error) {
      console.error("Грешка:", error);
      alert("Неуспешно зареждане на клубовете.");
    }
  }

  async function changeUserClub(u, newClubId) {
    try {
      const response = await apiFetch(`/Users/${u.id}/requestJoin/${newClubId}`, {
        method: "POST",
        body: JSON.stringify({})
      });

      if (!response.ok) {
        const errorMessage = await response.text();
        console.error("Грешка при изпращане на заявката:", errorMessage);
        alert(`Грешка: ${errorMessage}`);
        return;
      }

      alert("Заявката за присъединяване е изпратена. Очаква се одобрение.");

      u.clubID = Number(newClubId);
      u.statusID = 1;
      localStorage.setItem("user", JSON.stringify(u));

      await refreshSessionFromServer(u.id);
      renderUserInterface(getUIUser());
    } catch (error) {
      console.error("Грешка при смяната на клуба:", error);
      alert("Възникна грешка при смяната на клуба.");
    }
  }

  // If pending/rejected -> render and stop
  if (renderUserInterface(user)) return;

  // ========================================
  // Profile / role / club UI
  // ========================================
  if (user) {
    const firstNameEl = $("first-name");
    const lastNameEl = $("last-name");
    const yobEl = $("year-of-birth");
    if (firstNameEl) firstNameEl.textContent = user.firstName || "Няма данни";
    if (lastNameEl)  lastNameEl.textContent  = user.lastName || "Няма данни";
    if (yobEl)       yobEl.textContent       = user.yearOfBirth || "Няма данни";

    const isAthlete = Number(user.roleID) === 1;
    const isCoach = Number(user.roleID) === 2;
    const isAdmin = Number(user.roleID) === 3;

    const coachButton  = $("coach-button");
    const statusButton = $("status-button");
    const adminButton  = $("admin-button");

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

    // ✅ Add "+" quick add button for coach/admin
    if (isCoach || isAdmin) {
      setupQuickAddPlusButton({ isCoach, isAdmin });
    }

    // Club info
    apiFetch(`/Clubs/${user.clubID}`, { method: "GET" })
      .then(r => { if (!r.ok) throw new Error("Club fetch failed"); return r.json(); })
      .then(club => {
        const clubEl = $("club");
        const clubName = club?.name ?? club?.Name ?? club?.clubName ?? club?.ClubName ?? "Няма данни";
        if (clubEl) clubEl.textContent = clubName;
        fetchDisciplinesByClubId(user.clubID);
      })
      .catch(error => {
        console.error("Грешка при извличане на информация за клуба:", error);
        const clubEl = $("club");
        if (clubEl) clubEl.textContent = "Грешка при зареждане на клуба";
      });

    // Profile picture (тих fallback, без излишен шум)
    if (user.id > 0) {
      const img = $("profile-picture");

      const rawPath = String(user.profileImage_url || "").trim();
      if (img && rawPath) {
        const normalizedPath = rawPath.replace(/\\/g, "/");

        if (/^https?:\/\//i.test(normalizedPath)) {
          img.src = normalizedPath;
        } else {
          img.src = normalizedPath.startsWith("/")
            ? `${API_ROOT}${normalizedPath}`
            : `${API_ROOT}/${normalizedPath}`;
        }

        img.onerror = async () => {
          try {
            const response = await apiFetch(`/Users/profilePicture/${user.id}`, { method: "GET" });
            if (!response.ok) throw new Error("profilePicture failed");
            const imageBlob = await response.blob();
            img.src = URL.createObjectURL(imageBlob);
          } catch {
            img.src = "https://sportstats.blob.core.windows.net/$web/ProfilePhoto2.jpg";
            img.alt = "Профилната снимка не е налична";
          }
        };
      } else if (img) {
        apiFetch(`/Users/profilePicture/${user.id}`, { method: "GET" })
          .then(response => {
            if (!response.ok) throw new Error("profilePicture failed");
            return response.blob();
          })
          .then(imageBlob => {
            img.src = URL.createObjectURL(imageBlob);
          })
          .catch(() => {
            img.src = "https://sportstats.blob.core.windows.net/$web/ProfilePhoto2.jpg";
            img.alt = "Профилната снимка не е налична";
          });
      }
    }

    // discipline => show chart + fetch results
    const disciplineDropdown = $("discipline");
    const chartContainer = $("chart-container");

    disciplineDropdown?.addEventListener("change", function () {
      const disciplineId = parseInt(this.value, 10);
      if (!disciplineId) {
        if (chartContainer) chartContainer.style.display = "none";
        return;
      }

      if (chartContainer) chartContainer.style.display = "block";

      // ✅ Клубни таблици винаги
      if (currentClubId) {
        fetchBestResultsByDisciplineInClub(currentClubId, disciplineId);

        // ✅ Платформена класация по клубове (всички клубове)
        refreshBestClubComparisonForCurrentContext(disciplineId);
      }

      // ✅ Лични резултати само за атлет
      if (isAthlete) {
        fetchResults(disciplineId, user.id);
      } else {
        renderNoPersonalResultsForCoachAdmin();
      }
    });
  }

  function renderNoPersonalResultsForCoachAdmin() {
    const br = $("best-result");
    const lr = $("latest-result");
    const nd = $("normative-difference");
    const nv = $("normative-value");
    const caption = $("results-caption");

    if (br) br.textContent = "Лични резултати не се показват за треньор/админ.";
    if (lr) lr.textContent = "Използвай таблиците и страницата за резултати.";
    if (nd) nd.innerHTML = "";
    if (nv) nv.innerHTML = '<div style="padding:8px;color:#6a7280;">Нормативите се показват при атлет.</div>';
    if (caption) caption.textContent = "За треньор/админ тук се използва преглед на клубни данни.";

    const slots = ensureSplitsSlots();
    slots.clear();

    const ctxCanvas = $("resultsChart");
    if (ctxCanvas && chart) {
      chart.destroy();
      chart = null;
    }
  }

  // ========================================
  // Disciplines / club tables
  // ========================================
  let currentClubId = null;
  let disciplinesCache = null;

  // =====================================================
  // ✅ Bridge helpers: platform leaderboard (всички клубове)
  // =====================================================
  function renderBestClubComparisonPlaceholder(text) {
    const tbody = document.querySelector("#best-club-table tbody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">${text}</td></tr>`;
  }

  function refreshBestClubComparisonForCurrentContext(disciplineId) {
    if (!Number(disciplineId)) {
      renderBestClubComparisonPlaceholder("Изберете дисциплина.");
      return;
    }

    fetchBestClubByDiscipline(Number(disciplineId));
  }

  // Слушаме избор на дете от HomePageCoachResults.js -> само рефреш, вече няма филтър по година
  window.addEventListener("sportstats:comparison-athlete-changed", () => {
    const disciplineId = Number(document.getElementById("discipline")?.value || 0);
    if (!disciplineId) return;

    const u = getUIUser();
    const roleId = Number(u?.roleID || 0);
    if (![2, 3].includes(roleId)) return;

    fetchBestClubByDiscipline(disciplineId);
  });

  // ✅ Реакция при добавяне/изтриване на резултат от други модули (напр. HomePageCoachResults.js)
  function refreshCurrentHomeContextIfNeeded(changedDisciplineId = 0) {
    const selectedDisciplineId = Number($("discipline")?.value || 0);
    if (!selectedDisciplineId) return;

    if (Number(changedDisciplineId || 0) > 0 && Number(changedDisciplineId) !== selectedDisciplineId) {
      return;
    }

    if (currentClubId) {
      fetchBestResultsByDisciplineInClub(currentClubId, selectedDisciplineId);
      refreshBestClubComparisonForCurrentContext(selectedDisciplineId);
    }

    const me = getUIUser();
    if (Number(me?.roleID) === 1 && Number(me?.id) > 0) {
      fetchResults(selectedDisciplineId, Number(me.id));
    }
  }

  window.addEventListener("sportstats:result-added", (e) => {
    refreshCurrentHomeContextIfNeeded(Number(e?.detail?.disciplineId || 0));
  });

  window.addEventListener("sportstats:result-deleted", (e) => {
    refreshCurrentHomeContextIfNeeded(Number(e?.detail?.disciplineId || 0));
  });

  window.addEventListener("sportstats:refresh-coach-home-results", () => {
    refreshCurrentHomeContextIfNeeded(0);
  });

  async function fetchDisciplinesByClubId(clubId) {
    currentClubId = clubId;
    try {
      const r = await apiFetch(`/ClubDisciplines/disciplines-by-club/${clubId}`, { method: "GET" });
      if (!r.ok) throw new Error("disciplines-by-club failed");
      const disciplines = await r.json();
      disciplinesCache = disciplines || [];
      populateDisciplineDropdown(disciplinesCache);
    } catch (err) {
      console.error("Грешка при извличане на дисциплините на клуба:", err);
    }
  }

  function populateDisciplineDropdown(disciplines) {
    const disciplineSelect = $("discipline");
    if (!disciplineSelect) return;

    disciplineSelect.innerHTML = '<option value="" disabled selected>Дисциплина</option>';

    const get = (o, ...keys) => {
      for (const k of keys) {
        if (o && o[k] !== undefined && o[k] !== null) return o[k];
      }
      return undefined;
    };

    (disciplines || []).forEach(d => {
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

    // ✅ ВАЖНО:
    // Не добавяме втори change listener тук.
    // Основният listener е по-горе (в Profile / role / club UI).
    // Иначе се получават двойни заявки и race conditions.
  }

  // ----------------------------------------
  // BEST IN CLUB (table)
  // ----------------------------------------
  function fetchBestResultsByDisciplineInClub(clubId, disciplineId) {
    // ✅ Важно: за home leaderboard ползваме /best (връща ClubBestResultDto с имена)
    apiFetch(`/Results/by-club/${clubId}/by-discipline/${disciplineId}/best`, { method: "GET" })
      .then(async r => {
        const tbody = document.querySelector("#users-table tbody");
        if (!tbody) return null;

        if (r.status === 404) {
          tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">Няма налични резултати за тази дисциплина.</td></tr>`;
          return null;
        }

        if (!r.ok) throw new Error(`results/by-club/best failed: HTTP ${r.status}`);
        return r.json();
      })
      .then(results => {
        if (!results) return;

        const tbody = document.querySelector("#users-table tbody");
        if (!tbody) return;
        tbody.innerHTML = "";

        if (!Array.isArray(results) || results.length === 0) {
          tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">Няма налични резултати за тази дисциплина.</td></tr>`;
          return;
        }

        const unit = getUnitForDiscipline(Number(disciplineId));

        results.forEach((r, index) => {
          // ✅ Поддържаме и PascalCase, и camelCase
          const userFirstName =
            r.userFirstName ?? r.UserFirstName ??
            r.firstName ?? r.FirstName ?? "";

          const userLastName =
            r.userLastName ?? r.UserLastName ??
            r.lastName ?? r.LastName ?? "";

          // ✅ ClubBestResultDto има YearOfBirth (не UserYearOfBirth)
          const yearOfBirth =
            r.yearOfBirth ?? r.YearOfBirth ??
            r.userYearOfBirth ?? r.UserYearOfBirth ?? "";

          const valueTime = r.valueTime ?? r.ValueTime;
          const displayValue = formatResultValue(valueTime, unit);

          let medalIcon = "", rowClass = "";
          if (index === 0) { medalIcon = "🥇"; rowClass = "first-place"; }
          else if (index === 1) { medalIcon = "🥈"; rowClass = "second-place"; }
          else if (index === 2) { medalIcon = "🥉"; rowClass = "third-place"; }

          const fullName = `${userFirstName} ${userLastName}`.trim() || "Без име";

          const row = document.createElement("tr");
          row.className = rowClass;
          row.innerHTML = `
            <td>${medalIcon} ${fullName}</td>
            <td>${yearOfBirth || "—"}</td>
            <td>${displayValue}</td>
          `;
          tbody.appendChild(row);
        });
      })
      .catch(error => {
        console.error("Грешка при зареждане на резултатите в клуба:", error);
        const tbody = document.querySelector("#users-table tbody");
        if (tbody) tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">Грешка при зареждане.</td></tr>`;
      });
  }

  // ----------------------------------------
  // PLATFORM CLUB LEADERBOARD (ALL CLUBS)
  // ----------------------------------------
  function fetchBestClubByDiscipline(disciplineId) {
    apiFetch(`/Results/platform-club-leaderboard-by-discipline/${disciplineId}`, { method: "GET" })
      .then(async r => {
        if (r.status === 404) {
          populateBestClubTable([], Number(disciplineId));
          return null;
        }
        if (!r.ok) throw new Error(`platform-club-leaderboard failed: HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        if (data == null) return;
        populateBestClubTable(Array.isArray(data) ? data : [], Number(disciplineId));
      })
      .catch(error => {
        console.error("Грешка при зареждане на класацията по клубове:", error);
        populateBestClubTable([], Number(disciplineId));
      });
  }

  function populateBestClubTable(data, disciplineId) {
    const table = document.querySelector("#best-club-table");
    const tbody = document.querySelector("#best-club-table tbody");
    if (!tbody) return;

    // Заглавия на колоните (ако има thead)
    const thead = table?.querySelector("thead");
    if (thead) {
      thead.innerHTML = `
        <tr>
          <th>Отбор</th>
          <th>Състезател</th>
          <th>Резултат</th>
        </tr>
      `;
    }

    tbody.innerHTML = "";

    if (!Array.isArray(data) || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">Няма данни за тази дисциплина.</td></tr>`;
      return;
    }

    const isDistanceDiscipline = Number(disciplineId) === 18;
    const unit = getUnitForDiscipline(Number(disciplineId));

    const normalized = data.map(r => ({
      clubName: r.clubName ?? r.ClubName ?? "—",
      userFirstName: r.userFirstName ?? r.UserFirstName ?? "",
      userLastName: r.userLastName ?? r.UserLastName ?? "",
      yearOfBirth: r.yearOfBirth ?? r.YearOfBirth ?? "—",
      valueTime: Number(r.valueTime ?? r.ValueTime ?? NaN),
      resultDate: r.resultDate ?? r.ResultDate ?? null,
      location: r.location ?? r.Location ?? "—"
    })).filter(x => Number.isFinite(x.valueTime));

    if (!normalized.length) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">Няма данни за тази дисциплина.</td></tr>`;
      return;
    }

    // За сигурност сортираме и в клиента
    const sorted = [...normalized].sort((a, b) => {
      if (isDistanceDiscipline) {
        if (b.valueTime !== a.valueTime) return b.valueTime - a.valueTime; // по-голямото е по-добро
      } else {
        if (a.valueTime !== b.valueTime) return a.valueTime - b.valueTime; // по-малкото е по-добро
      }

      const ad = new Date(a.resultDate || 0).getTime() || 0;
      const bd = new Date(b.resultDate || 0).getTime() || 0;
      if (bd !== ad) return bd - ad;

      return String(a.clubName || "").localeCompare(String(b.clubName || ""), "bg");
    });

    sorted.forEach((rowData, index) => {
      const clubName = rowData.clubName || "—";
      const fullName = `${rowData.userFirstName || ""} ${rowData.userLastName || ""}`.trim() || "Без име";
      const formattedValue = formatResultValue(rowData.valueTime, unit);

      let medal = "";
      let rowClass = "";
      if (index === 0) { medal = "🥇"; rowClass = "gold-row"; }
      else if (index === 1) { medal = "🥈"; rowClass = "silver-row"; }
      else if (index === 2) { medal = "🥉"; rowClass = "bronze-row"; }

      const tr = document.createElement("tr");
      tr.classList.add("best-club-row");
      if (rowClass) tr.classList.add(rowClass);

      tr.innerHTML = `
        <td>${medal ? medal + " " : ""}${clubName}</td>
        <td>${fullName}</td>
        <td>${formattedValue}</td>
      `;

      tr.addEventListener("mouseenter", () => {
        const hoverDiv = $("hover-info");
        if (!hoverDiv) return;

        const dateObj = rowData.resultDate ? new Date(rowData.resultDate) : null;
        const dateText = dateObj && !isNaN(dateObj.getTime())
          ? dateObj.toLocaleDateString("bg-BG")
          : "—";

        hoverDiv.style.display = "block";
        hoverDiv.style.position = "absolute";
        hoverDiv.innerHTML = `
          <strong>Отбор:</strong> ${clubName}<br>
          <strong>Състезател:</strong> ${fullName}<br>
          <strong>Роден:</strong> ${rowData.yearOfBirth ?? "—"}<br>
          <strong>Дата:</strong> ${dateText}<br>
          <strong>Локация:</strong> ${rowData.location ?? "—"}
        `;

        const rect = tr.getBoundingClientRect();
        hoverDiv.style.top = `${rect.bottom + window.scrollY}px`;
        hoverDiv.style.left = `${rect.left}px`;
      });

      tr.addEventListener("mouseleave", () => {
        const hoverDiv = $("hover-info");
        if (hoverDiv) hoverDiv.style.display = "none";
      });

      tbody.appendChild(tr);
    });
  }

  // ========================================
  // Results + Normatives + Chart + ✅ Splits
  // ========================================
  function mapPoolLengthToId(length) {
    const n = Number(String(length).replace(/[^\d.]/g, ""));
    if (n === 25) return 1;
    if (n === 50) return 2;
    return 0;
  }

  function safeDate(d) {
    if (!d) return null;
    const t = typeof d === "string" ? d : String(d);
    const dt = new Date(t);
    if (!isNaN(dt.getTime())) return dt;
    const try2 = new Date(t.replace(" ", "T"));
    return isNaN(try2.getTime()) ? null : try2;
  }

  function normalizeResults(results) {
    return (results || []).map(r => {
      const valueTime =
        r.valueTime ?? r.ValueTime ?? r.resultTime ?? r.ResultTime ?? r.time ?? r.Time;

      const resultDateRaw =
        r.resultDate ?? r.ResultDate ?? r.date ?? r.Date ?? r.createdAt ?? r.CreatedAt;

      const location = r.location ?? r.Location ?? r.venue ?? r.Venue ?? "";

      const pool =
        r.swimmingPoolStandart ?? r.SwimmingPoolStandart ?? r.poolLength ?? r.PoolLength ?? "";

      const poolId =
        r.swimmingPoolStandartId ??
        r.SwimmingPoolStandartId ??
        mapPoolLengthToId(pool);

      const id = r.id ?? r.Id ?? 0;

      return {
        id: Number(id) || 0,
        valueTime: Number(valueTime),
        resultDate: safeDate(resultDateRaw),
        location,
        swimmingPoolStandartId: Number(poolId),
        swimmingPoolStandart: Number(pool) || (Number(poolId) === 1 ? 25 : Number(poolId) === 2 ? 50 : 0)
      };
    }).filter(x => Number.isFinite(x.valueTime));
  }

  // Fallback: ако /Results/by-user/{id}/by-discipline/{disciplineId} липсва в API,
  // ползвай GET /Results (който за атлет връща неговите резултати) и филтрирай по дисциплина.
  async function fetchUserResultsByDisciplineFallback(userId, disciplineId) {
    const r = await apiFetch(`/Results`, { method: "GET" });
    if (!r.ok) throw new Error(`Fallback /Results failed: HTTP ${r.status}`);

    const all = await r.json();
    const list = Array.isArray(all) ? all : [];

    return list.filter(x => {
      const uid = Number(x.userId ?? x.UserId ?? 0);
      const did = Number(x.disciplineId ?? x.DisciplineId ?? 0);
      return uid === Number(userId) && did === Number(disciplineId);
    });
  }

  function fetchResults(disciplineId, userId) {
    const u = getUIUser();

    if (!disciplineId || !userId || !u || !u.id || !u.yearOfBirth || !u.gender) {
      console.error("Липсват данни:", { disciplineId, userId, u });
      return;
    }

    // NOTE: тази страница е за "me" results.
    if (u.id !== userId) {
      alert("Нямате права да виждате тези резултати!");
      return;
    }

    const NO_RESULTS_MESSAGE = "Няма налични резултати.";

    function displayNoResults() {
      const br = $("best-result");
      const lr = $("latest-result");
      const nd = $("normative-difference");
      const nv = $("normative-value");

      if (br) br.textContent = NO_RESULTS_MESSAGE;
      if (lr) lr.textContent = NO_RESULTS_MESSAGE;
      if (nd) nd.textContent = "";
      if (nv) nv.innerHTML = "";

      ensureSplitsSlots().clear();

      const chartCanvas = $("resultsChart");
      if (chartCanvas && chart) {
        chart.destroy();
        chart = null;
      }
    }

    const br = $("best-result");
    const lr = $("latest-result");
    if (br) br.textContent = "Зареждане...";
    if (lr) lr.textContent = "Зареждане...";

    const url = `/Results/by-user/${userId}/by-discipline/${disciplineId}`;
    console.debug("fetchResults ->", { url, disciplineId, userId });

    apiFetch(url, { method: "GET" })
      .then(async r => {
        if (r.status === 403) {
          displayNoResults();
          alert("Нямате права да виждате тези резултати.");
          return null;
        }

        if (r.status === 404) {
          // ✅ Може да е: няма данни ИЛИ route липсва в този build.
          // Пробваме fallback към GET /Results + client-side filter.
          try {
            const fallback = await fetchUserResultsByDisciplineFallback(userId, disciplineId);
            return fallback;
          } catch {
            displayNoResults();
            return null;
          }
        }

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
    const toNum = (v) => {
      const x = Number(v);
      return Number.isFinite(x) ? x : NaN;
    };

    const min =
      toNum(n.minYearOfBorn ?? n.MinYearOfBorn) ||
      toNum(n.minYearOfBirth?.slice?.(0, 4) ?? n.MinYearOfBirth?.slice?.(0, 4));

    const max =
      toNum(n.maxYearOfBorn ?? n.MaxYearOfBorn) ||
      toNum(n.maxYearOfBirth?.slice?.(0, 4) ?? n.MaxYearOfBirth?.slice?.(0, 4));

    if (Number.isFinite(min) && Number.isFinite(max) && Number.isFinite(Number(userYear))) {
      return Number(userYear) >= min && Number(userYear) <= max;
    }

    const nowYear = new Date().getFullYear();
    const minAge = toNum(n.minAge ?? n.MinAge);
    const maxAge = toNum(n.maxAge ?? n.MaxAge);
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

    const url = `/Normatives/discipline/${disciplineId}`;
    console.debug("fetchNormatives ->", { url, disciplineId, yearOfBirth, userGender });

    apiFetch(url, { method: "GET" })
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

  // ---------------- Splits UI helpers ----------------
  function ensureSplitsSlots() {
    const br = $("best-result");
    const lr = $("latest-result");

    function ensureAfter(el, id) {
      if (!el) return null;
      let wrap = $(id);
      if (wrap) return wrap;
      wrap = document.createElement("div");
      wrap.id = id;
      wrap.style.marginTop = "8px";
      wrap.style.fontSize = "13px";
      wrap.style.color = "#0b0f19";
      el.insertAdjacentElement("afterend", wrap);
      return wrap;
    }

    const bestWrap = ensureAfter(br, "best-splits-wrap");
    const latestWrap = ensureAfter(lr, "latest-splits-wrap");

    return {
      bestWrap,
      latestWrap,
      clear() {
        if (bestWrap) bestWrap.innerHTML = "";
        if (latestWrap) latestWrap.innerHTML = "";
      }
    };
  }

  async function fetchSplitsForResult(resultId) {
    if (!resultId || resultId <= 0) return [];
    const u = getUIUser();
    if (!u?.id) return [];

    try {
      const r = await apiFetch(`/Results/${resultId}/splits`, { method: "GET" });
      if (!r.ok) return [];
      const splits = await r.json();
      return Array.isArray(splits) ? splits : [];
    } catch {
      return [];
    }
  }

  function renderSplitsHtml(splits) {
    if (!splits || splits.length === 0) return "";

    const norm = splits.map(s => ({
      distance: s.distance ?? s.Distance,
      valueTime: s.valueTime ?? s.ValueTime
    }))
      .filter(x => Number(x.distance) > 0 && Number(x.valueTime) >= 0)
      .sort((a, b) => Number(a.distance) - Number(b.distance));

    if (!norm.length) return "";

    const rows = norm.map(x => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eef2f7;color:#6a7280;">${Number(x.distance)}м</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eef2f7;font-variant-numeric:tabular-nums;font-weight:700;">${formatTime(Number(x.valueTime))}</td>
      </tr>
    `).join("");

    return `
      <details style="
        background: rgba(255,255,255,.55);
        border:1px solid #e7ebf4;
        border-radius: 12px;
        padding: 10px 12px;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.7);
      ">
        <summary style="cursor:pointer;font-weight:800;letter-spacing:.2px;color:#0c1222;">Сплитове</summary>
        <div style="height:8px"></div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left;padding:6px 8px;color:#6a7280;font-size:12px;border-bottom:1px solid #eef2f7;">Дистанция</th>
              <th style="text-align:left;padding:6px 8px;color:#6a7280;font-size:12px;border-bottom:1px solid #eef2f7;">Време (кумулативно)</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </details>
    `;
  }

  async function hydrateSplitsUI(bestResultId, latestResultId) {
    const { bestWrap, latestWrap } = ensureSplitsSlots();
    if (bestWrap) bestWrap.innerHTML = "";
    if (latestWrap) latestWrap.innerHTML = "";

    // avoid double fetch if same result
    const ids = Array.from(new Set([bestResultId, latestResultId].filter(x => Number(x) > 0)));
    const map = new Map();

    await Promise.all(ids.map(async id => {
      const splits = await fetchSplitsForResult(id);
      map.set(id, splits);
    }));

    if (bestWrap && bestResultId) {
      const splits = map.get(bestResultId) || [];
      bestWrap.innerHTML = splits.length ? renderSplitsHtml(splits) : "";
    }

    if (latestWrap && latestResultId) {
      const splits = map.get(latestResultId) || [];
      latestWrap.innerHTML = splits.length ? renderSplitsHtml(splits) : "";
    }
  }

  function displayResults(disciplineId, yearOfBirth, userGender, rawResults, normatives) {
    const isTimeDiscipline = Number(disciplineId) !== 18;

    const results = normalizeResults(rawResults);
    if (!results.length) {
      const br = $("best-result");
      const lr = $("latest-result");
      if (br) br.textContent = "Няма данни";
      if (lr) lr.textContent = "Няма данни";
      ensureSplitsSlots().clear();

      const nv = $("normative-value");
      const nd = $("normative-difference");
      if (nv) nv.innerHTML = "";
      if (nd) nd.innerHTML = "";

      if (chart) {
        chart.destroy();
        chart = null;
      }
      return;
    }

    // sort by date DESC (latest first)
    const sortedResults = [...results].sort((a, b) => {
      const ad = a.resultDate ? a.resultDate.getTime() : 0;
      const bd = b.resultDate ? b.resultDate.getTime() : 0;
      return bd - ad;
    });

    const latestResult = sortedResults[0];

    function findBestResult(rs, isTime) {
      if (!Array.isArray(rs) || rs.length === 0) return null;
      return rs.reduce((best, r) => {
        return isTime ? (r.valueTime < best.valueTime ? r : best) : (r.valueTime > best.valueTime ? r : best);
      }, rs[0]);
    }

    const bestOverall = findBestResult(sortedResults, isTimeDiscipline);

    const normative25 = (normatives || []).find(n => (n.swimmingPoolStandartId ?? n.SwimmingPoolStandartId) === 1);
    const normative50 = (normatives || []).find(n => (n.swimmingPoolStandartId ?? n.SwimmingPoolStandartId) === 2);

    function compareToNormative(normative, poolLabel, resultOverride = null) {
      const poolId = normative.swimmingPoolStandartId ?? normative.SwimmingPoolStandartId;
      const poolResults = results.filter(r => r.swimmingPoolStandartId === poolId);

      const resultToUse = resultOverride || findBestResult(poolResults, isTimeDiscipline);

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
  position: relative; display: grid; gap: 10px; padding: 14px 16px; margin: 0 0 14px;
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

    let normativeValueText = "";
    if (Number(disciplineId) !== 18) {
      if (normative25) {
        // ✅ Сравнение само с 25м резултати (без смесване с 50м)
        normativeValueText += compareToNormative(normative25, "25м басейн");
      }
      if (normative50) {
        // ✅ compareToNormative сам обработва "няма резултати"
        normativeValueText += compareToNormative(normative50, "50м басейн");
      }
      if (!normative25 && !normative50) {
        normativeValueText = "Няма норматив за тази възрастова група и дисциплина.";
      }
    } else {
      normativeValueText = '<div style="padding: 8px; color: #777;">Няма норматив за тази дисциплина.</div>';
    }

    // Chart data
    // ✅ Последни 8 резултата (наистина последни по дата), показани хронологично отляво надясно
    const latestDataCount = 8;
    const chartSource = sortedResults.slice(0, latestDataCount).reverse();

    const labelsAll = chartSource.map((r, i) => {
      const d = r.resultDate;
      return d ? d.toLocaleDateString("bg-BG") : `#${i + 1}`;
    });
    const dataAll = chartSource.map(r => r.valueTime);
    const norm25All = labelsAll.map(() => normative25 ? Number(normative25.valueStandart ?? normative25.ValueStandart) : null);
    const norm50All = labelsAll.map(() => normative50 ? Number(normative50.valueStandart ?? normative50.ValueStandart) : null);

    const ctx = $("resultsChart")?.getContext("2d");
    if (ctx && typeof Chart !== "undefined") {
      if (chart) chart.destroy();

      const latestLabels = labelsAll;
      const latestChartData = dataAll;
      const latestChartNormative25m = norm25All;
      const latestChartNormative50m = norm50All;

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
            {
              label: "Резултати",
              data: latestChartData,
              borderColor: "rgba(15,23,42,0.85)",
              backgroundColor: gResult,
              borderWidth: 2,
              tension: 0.35,
              fill: true,
              pointRadius: 3,
              pointHoverRadius: 5,
              pointBackgroundColor: "rgba(15,23,42,0.85)",
              pointBorderWidth: 0,
              pointHitRadius: 10
            },
            {
              label: "Норматив 25м",
              data: latestChartNormative25m,
              borderColor: "rgba(79,124,247,0.9)",
              backgroundColor: gNorm25,
              borderWidth: 1.5,
              borderDash: [6, 6],
              tension: 0.25,
              pointRadius: 0,
              fill: false
            },
            {
              label: "Норматив 50м",
              data: latestChartNormative50m,
              borderColor: "rgba(16,185,129,0.9)",
              backgroundColor: gNorm50,
              borderWidth: 1.5,
              borderDash: [6, 6],
              tension: 0.25,
              pointRadius: 0,
              fill: false
            }
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
                  const result = chartSource[i];
                  const value = result?.valueTime;
                  const unit = getUnitForDiscipline(disciplineId);

                  if (String(context.dataset.label || "") === "Норматив 25м") {
                    const y = context.parsed.y;
                    return `Норматив (25 м): ${isTimeDiscipline ? formatTime(y) : `${y} ${unit}`}`;
                  }

                  if (String(context.dataset.label || "") === "Норматив 50м") {
                    const y = context.parsed.y;
                    return `Норматив (50 м): ${isTimeDiscipline ? formatTime(y) : `${y} ${unit}`}`;
                  }

                  const formattedValue = isTimeDiscipline ? formatTime(value) : `${value} ${unit}`;
                  const formattedDate = result?.resultDate ? result.resultDate.toLocaleDateString("bg-BG") : "Няма дата";
                  const location = result?.location || "Няма информация";
                  const poolLength = result?.swimmingPoolStandartId === 2 ? "50 м" : result?.swimmingPoolStandartId === 1 ? "25 м" : "—";

                  return [`Дата: ${formattedDate}`, `Резултат: ${formattedValue}`, `Локация: ${location}`, `Басейн: ${poolLength}`];
                },
                title: () => ""
              }
            }
          },
          scales: {
            x: { display: false, grid: { display: false }, ticks: { display: false } },
            y: {
              title: {
                display: true,
                text: getUnitForDiscipline(disciplineId),
                color: "#6a7280",
                font: { size: 12, weight: "600", family: "Inter, system-ui, -apple-system" },
                padding: { bottom: 8 }
              },
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
    }

    // Text outputs
    const bestResEl = $("best-result");
    const latestResEl = $("latest-result");

    if (bestResEl) {
      bestResEl.textContent = bestOverall
        ? `Най-добър резултат: ${formatResultValue(bestOverall.valueTime, getUnitForDiscipline(disciplineId))}`
        : "Няма налични резултати.";
    }

    if (latestResEl) {
      latestResEl.textContent = latestResult
        ? `Последен резултат: ${formatResultValue(latestResult.valueTime, getUnitForDiscipline(disciplineId))}`
        : "Няма налични резултати.";
    }

    // ✅ Splits under best/latest
    hydrateSplitsUI(bestOverall?.id || 0, latestResult?.id || 0);

    const nv = $("normative-value");
    if (nv) {
      nv.innerHTML = normativeValueText;
      nv.classList.add("norm-cards");
    }
    const nd = $("normative-difference");
    if (nd) nd.innerHTML = "";
  }

  // ========================================
  // ✅ Quick add result (+) for coach/admin
  // ========================================
  function setupQuickAddPlusButton() {
    const existing = $("quick-add-plus");
    if (existing) return;

    // Try to attach near existing nav buttons; fallback -> floating button
    const coachBtn = $("coach-button");
    const adminBtn = $("admin-button");
    const anchorParent = coachBtn?.parentElement || adminBtn?.parentElement || null;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "quick-add-plus";
    btn.title = "Добави резултат";
    btn.setAttribute("aria-label", "Добави резултат");
    btn.textContent = "+";
    btn.style.cssText = `
      appearance:none;
      width: 40px; height: 40px;
      border-radius: 12px;
      border: 1px solid #e6e9ef;
      background: linear-gradient(180deg, #0e1425, #172033);
      color: #fff;
      font-weight: 900;
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
      box-shadow: 0 10px 24px rgba(15,23,42,.18);
      display: inline-flex;
      align-items:center;
      justify-content:center;
      margin-left: 10px;
    `;

    btn.addEventListener("click", () => openQuickAddModal());

    if (anchorParent) {
      anchorParent.appendChild(btn);
    } else {
      // floating fallback
      btn.style.position = "fixed";
      btn.style.right = "18px";
      btn.style.bottom = "18px";
      btn.style.zIndex = "9999";
      document.body.appendChild(btn);
    }
  }

  // Cache club athletes so modal opens fast
  let clubAthletesCache = null;

  async function fetchClubAthletes() {
    const u = getUIUser();
    if (!u?.clubID) return [];
    if (clubAthletesCache) return clubAthletesCache;

    // UsersController GET: /api/Users/club/{clubId} (ако съществува)
    const r = await apiFetch(`/Users/club/${u.clubID}`, { method: "GET" });
    if (!r.ok) return [];
    const data = await r.json();
    const list = Array.isArray(data) ? data : [];

    clubAthletesCache = list.map(x => ({
      id: x.id ?? x.Id,
      firstName: x.firstName ?? x.FirstName ?? "",
      lastName: x.lastName ?? x.LastName ?? "",
      yearOfBirth: x.yearOfBirth ?? x.YearOfBirth ?? "",
      statusID: x.statusID ?? x.StatusID ?? null,
      roleID: x.roleID ?? x.RoleID ?? null
    }))
      .filter(x => Number(x.id) > 0)
      // ✅ само атлети + без чакащи/отхвърлени (ако има данни)
      .filter(x => (x.roleID == null || Number(x.roleID) === 1))
      .filter(x => ![1, 3].includes(Number(x.statusID ?? 0)));

    return clubAthletesCache;
  }

  // ----------------------------------------
  // Quick Add Time Roller (NEW)
  // ----------------------------------------
  function initQuickAddTimeRoller() {
    const minSel = $("qa-time-min");
    const secSel = $("qa-time-sec");
    const csSel = $("qa-time-cs");
    if (!minSel || !secSel || !csSel) return;

    if (!minSel.dataset.inited) {
      populateQuickAddNumericSelect(minSel, 0, 59, { pad: 0 });
      populateQuickAddNumericSelect(secSel, 0, 59, { pad: 2 });
      populateQuickAddNumericSelect(csSel, 0, 99, { pad: 2 });

      minSel.dataset.inited = "1";
      secSel.dataset.inited = "1";
      csSel.dataset.inited = "1";

      const onChange = () => {
        syncQuickAddTimeInputFromRoller();
        updateQuickAddTimeHint();
      };

      minSel.addEventListener("change", onChange);
      secSel.addEventListener("change", onChange);
      csSel.addEventListener("change", onChange);
    }

    setQuickAddTimeRollerValue(0);
  }

  function populateQuickAddNumericSelect(sel, start, end, { pad = 0 } = {}) {
    sel.innerHTML = "";
    for (let i = start; i <= end; i++) {
      const label = pad > 0 ? String(i).padStart(pad, "0") : String(i);
      sel.appendChild(new Option(label, String(i)));
    }
  }

  function setQuickAddSelectValueSafe(sel, value) {
    const v = String(Number(value) || 0);
    if ([...sel.options].some(o => o.value === v)) {
      sel.value = v;
    }
  }

  function setQuickAddTimeRollerValue(totalSeconds) {
    const sec = Math.max(0, Number(totalSeconds) || 0);
    const whole = Math.floor(sec);
    let cs = Math.round((sec - whole) * 100);

    let carry = 0;
    if (cs === 100) {
      cs = 0;
      carry = 1;
    }

    const finalWhole = whole + carry;
    const minutes = Math.floor(finalWhole / 60);
    const seconds = finalWhole % 60;

    const minSel = $("qa-time-min");
    const secSel = $("qa-time-sec");
    const csSel = $("qa-time-cs");
    if (!minSel || !secSel || !csSel) return;

    setQuickAddSelectValueSafe(minSel, minutes);
    setQuickAddSelectValueSafe(secSel, seconds);
    setQuickAddSelectValueSafe(csSel, cs);
  }

  function getQuickAddTimeRollerSeconds() {
    const minSel = $("qa-time-min");
    const secSel = $("qa-time-sec");
    const csSel = $("qa-time-cs");
    if (!minSel || !secSel || !csSel) return NaN;

    const m = Number(minSel.value || 0);
    const s = Number(secSel.value || 0);
    const cs = Number(csSel.value || 0);
    if (![m, s, cs].every(Number.isFinite)) return NaN;

    return m * 60 + s + (cs / 100);
  }

  function formatQuickAddTimeForInput(seconds) {
    const s = Number(seconds);
    if (!Number.isFinite(s) || s < 0) return "";

    const whole = Math.floor(s);
    let cs = Math.round((s - whole) * 100);
    let carry = 0;
    if (cs === 100) {
      cs = 0;
      carry = 1;
    }

    const finalWhole = whole + carry;
    const m = Math.floor(finalWhole / 60);
    const sec = finalWhole % 60;
    const cc = String(cs).padStart(2, "0");

    if (m > 0) return `${m}:${String(sec).padStart(2, "0")}.${cc}`;
    return `${sec}.${cc}`;
  }

  function syncQuickAddTimeInputFromRoller() {
    const input = $("qa-time");
    if (!input) return;

    const sec = getQuickAddTimeRollerSeconds();
    if (!Number.isFinite(sec)) return;

    // Не пълним насила ако е 0 и полето е празно
    if (sec === 0 && !String(input.value || "").trim()) return;

    input.value = formatQuickAddTimeForInput(sec);
  }

  function syncQuickAddRollerFromTimeInput() {
    const input = $("qa-time");
    if (!input) return;

    const raw = String(input.value || "").trim();
    if (!raw) return;

    const sec = parseTimeToSeconds(raw);
    if (!Number.isFinite(sec) || sec < 0) return;

    setQuickAddTimeRollerValue(sec);
  }

  function updateQuickAddTimeHint() {
    const input = $("qa-time");
    const hint = $("qa-time-hint");
    if (!hint) return;

    let sec = parseTimeToSeconds(String(input?.value || "").trim());
    if (!Number.isFinite(sec)) {
      sec = getQuickAddTimeRollerSeconds();
    }

    if (Number.isFinite(sec) && sec > 0) {
      hint.textContent = `= ${sec.toFixed(2)} сек`;
    } else {
      hint.textContent = "Може да избереш време от ролера или да го въведеш ръчно.";
    }
  }

  function buildModalShell() {
    let overlay = $("qa-overlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "qa-overlay";
    overlay.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(2,8,20,.55);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      z-index: 10000;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 18px;
    `;

    overlay.innerHTML = `
      <div id="qa-modal" style="
        width: min(920px, 96vw);
        background: linear-gradient(180deg, rgba(255,255,255,.92), rgba(250,252,255,.96));
        border: 1px solid #e6e9ef;
        border-radius: 18px;
        box-shadow: 0 30px 70px rgba(15,23,42,.24), inset 0 1px 0 rgba(255,255,255,.7);
        overflow: hidden;
        font-family: inherit;
      ">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border-bottom:1px solid #eef2f7;">
          <div style="font-weight:900;letter-spacing:.2px;color:#0c1222;">Добави резултат</div>
          <button id="qa-close" type="button" style="
            appearance:none;border:1px solid #e6e9ef;background:#fff;color:#0b0f19;
            width:36px;height:36px;border-radius:12px;cursor:pointer;font-weight:900;
          ">✕</button>
        </div>

        <div style="padding:16px;">
          <div style="display:grid;gap:12px;grid-template-columns:1fr 1fr;">
            <div>
              <label style="display:block;font-size:12px;color:#6a7280;margin:0 0 6px;">Атлет (мой клуб)</label>
              <select id="qa-athlete" style="width:100%;padding:12px;border:1px solid #e6e9ef;border-radius:12px;background:#fff;"></select>
            </div>

            <div>
              <label style="display:block;font-size:12px;color:#6a7280;margin:0 0 6px;">Дисциплина</label>
              <select id="qa-discipline" style="width:100%;padding:12px;border:1px solid #e6e9ef;border-radius:12px;background:#fff;"></select>
            </div>

            <div>
              <label style="display:block;font-size:12px;color:#6a7280;margin:0 0 6px;">Басейн</label>
              <select id="qa-pool" style="width:100%;padding:12px;border:1px solid #e6e9ef;border-radius:12px;background:#fff;">
                <option value="25">25 м</option>
                <option value="50">50 м</option>
              </select>
            </div>

            <div>
              <label style="display:block;font-size:12px;color:#6a7280;margin:0 0 6px;">Дата/час</label>
              <input id="qa-date" type="datetime-local" style="width:100%;padding:12px;border:1px solid #e6e9ef;border-radius:12px;background:#fff;" />
            </div>

            <div style="grid-column:1/-1;">
              <label style="display:block;font-size:12px;color:#6a7280;margin:0 0 6px;">Локация</label>
              <input id="qa-location" type="text" placeholder="напр. София" style="width:100%;padding:12px;border:1px solid #e6e9ef;border-radius:12px;background:#fff;" />
            </div>

            <div style="grid-column:1/-1;">
              <label style="display:block;font-size:12px;color:#6a7280;margin:0 0 6px;">Време (формат: 1:07.13 или 67.13)</label>

              <div id="qa-time-roller" style="
                display:grid;
                grid-template-columns: 1fr auto 1fr auto 1fr;
                gap:8px;
                align-items:center;
                padding:10px;
                border:1px solid #e6e9ef;
                border-radius:12px;
                background: rgba(255,255,255,.7);
                margin-bottom:8px;
              ">
                <div>
                  <div style="font-size:12px;color:#6a7280;margin:0 0 4px;text-align:center;font-weight:700;">Минути</div>
                  <select id="qa-time-min" style="width:100%;padding:10px;border:1px solid #e6e9ef;border-radius:12px;background:#fff;font-weight:800;text-align:center;"></select>
                </div>

                <div style="font-weight:900;color:#475569;font-size:18px;align-self:center;">:</div>

                <div>
                  <div style="font-size:12px;color:#6a7280;margin:0 0 4px;text-align:center;font-weight:700;">Секунди</div>
                  <select id="qa-time-sec" style="width:100%;padding:10px;border:1px solid #e6e9ef;border-radius:12px;background:#fff;font-weight:800;text-align:center;"></select>
                </div>

                <div style="font-weight:900;color:#475569;font-size:18px;align-self:center;">.</div>

                <div>
                  <div style="font-size:12px;color:#6a7280;margin:0 0 4px;text-align:center;font-weight:700;">Стотни</div>
                  <select id="qa-time-cs" style="width:100%;padding:10px;border:1px solid #e6e9ef;border-radius:12px;background:#fff;font-weight:800;text-align:center;"></select>
                </div>
              </div>

              <input id="qa-time" type="text" placeholder="1:07.13" style="width:100%;padding:12px;border:1px solid #e6e9ef;border-radius:12px;background:#fff;font-variant-numeric:tabular-nums;" />
              <div id="qa-time-hint" style="margin-top:6px;font-size:12px;color:#6a7280;">Може да избереш време от ролера или да го въведеш ръчно.</div>
            </div>
          </div>

          <div style="margin-top:14px;padding-top:14px;border-top:1px solid #eef2f7;">
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
              <input id="qa-splits-toggle" type="checkbox" />
              <span style="font-weight:800;color:#0c1222;">Сплитове (по желание)</span>
              <span style="font-size:12px;color:#6a7280;">(кумулативно време на дистанция)</span>
            </label>

            <div id="qa-splits-box" style="display:none;margin-top:10px;">
              <div id="qa-splits-list" style="display:grid;gap:8px;"></div>

              <button id="qa-add-split" type="button" style="
                margin-top:10px;
                appearance:none;border:1px solid #e6e9ef;background:#fff;color:#0b0f19;
                padding:10px 12px;border-radius:12px;cursor:pointer;font-weight:800;
              ">+ Добави сплит</button>
            </div>
          </div>

          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
            <button id="qa-cancel" type="button" style="
              appearance:none;border:1px solid #e6e9ef;background:#fff;color:#0b0f19;
              padding:12px 14px;border-radius:12px;cursor:pointer;font-weight:800;
            ">Отказ</button>

            <button id="qa-save" type="button" style="
              appearance:none;border:1px solid #e6e9ef;
              background: linear-gradient(180deg, #0e1425, #172033);
              color:#fff;font-weight:900;font-size:14px;
              padding:12px 14px;border-radius:12px;cursor:pointer;
              box-shadow: 0 10px 24px rgba(15,23,42,.18);
            ">Запази</button>
          </div>

          <div id="qa-error" style="margin-top:10px;color:#b91c1c;font-size:13px;font-weight:700;"></div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // close handlers
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeQuickAddModal();
    });
    $("qa-close")?.addEventListener("click", closeQuickAddModal);
    $("qa-cancel")?.addEventListener("click", closeQuickAddModal);

    // init time roller
    initQuickAddTimeRoller();

    // splits toggle
    $("qa-splits-toggle")?.addEventListener("change", (e) => {
      const on = e.target.checked;
      const box = $("qa-splits-box");
      if (box) box.style.display = on ? "block" : "none";
      if (on && $("qa-splits-list")?.children?.length === 0) addSplitRow();
    });

    $("qa-add-split")?.addEventListener("click", addSplitRow);

    // parse hint + sync roller <-> text
    $("qa-time")?.addEventListener("input", () => {
      syncQuickAddRollerFromTimeInput();
      updateQuickAddTimeHint();
    });

    $("qa-save")?.addEventListener("click", saveQuickAdd);

    return overlay;
  }

  function openQuickAddModal() {
    const overlay = buildModalShell();
    overlay.style.display = "flex";

    // defaults
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    const isoLocal = `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}`;
    if ($("qa-date")) $("qa-date").value = isoLocal;

    if ($("qa-location")) $("qa-location").value = localStorage.getItem("qa_last_location") || "";

    // reset time fields
    if ($("qa-time")) $("qa-time").value = "";
    setQuickAddTimeRollerValue(0);
    updateQuickAddTimeHint();

    // preselect discipline = current page discipline (if any)
    const currentDisc = Number($("discipline")?.value || 0);

    // ✅ bridge from HomePageCoachResults.js (ако има избран атлет там)
    const bridgeAthleteId = Number(window.__sportStatsSelectedComparisonAthlete?.athleteId || 0);

    // load athletes + disciplines
    Promise.all([fetchClubAthletes(), Promise.resolve(disciplinesCache || [])])
      .then(([athletes, discs]) => {
        // athletes
        const aSel = $("qa-athlete");
        if (!aSel) return;
        aSel.innerHTML = "";

        if (!athletes.length) {
          aSel.innerHTML = `<option value="" disabled selected>Няма атлети</option>`;
        } else {
          aSel.innerHTML = `<option value="" disabled selected>Избери атлет...</option>`;
          athletes.forEach(a => {
            const opt = document.createElement("option");
            opt.value = String(a.id);
            opt.textContent = `${(a.lastName || "").toUpperCase()}, ${a.firstName || ""} - ${a.yearOfBirth || ""}`;
            aSel.appendChild(opt);
          });

          // ✅ приоритет: избран атлет от coach панела -> иначе първия
          const bridgeIdx = Array.from(aSel.options).findIndex(o => Number(o.value) === bridgeAthleteId);
          if (bridgeAthleteId && bridgeIdx >= 0) {
            aSel.selectedIndex = bridgeIdx;
          } else if (aSel.options.length > 1) {
            aSel.selectedIndex = 1;
          }
        }

        // disciplines
        const dSel = $("qa-discipline");
        if (!dSel) return;
        dSel.innerHTML = "";

        const get = (o, ...keys) => {
          for (const k of keys) if (o && o[k] != null) return o[k];
          return undefined;
        };

        const list = Array.isArray(discs) ? discs : [];
        if (!list.length) {
          dSel.innerHTML = `<option value="" disabled selected>Няма дисциплини</option>`;
        } else {
          dSel.innerHTML = `<option value="" disabled selected>Избери дисциплина...</option>`;
          list.forEach(d => {
            const id =
              get(d, "id", "Id", "disciplineId", "DisciplineId") ??
              get(d?.discipline, "id", "Id") ??
              get(d?.Discipline, "Id", "id");
            const name =
              get(d, "disciplineName", "DisciplineName", "name", "Name") ??
              get(d?.discipline, "disciplineName", "DisciplineName", "name", "Name") ??
              get(d?.Discipline, "Name", "disciplineName", "name");

            const opt = document.createElement("option");
            opt.value = String(id ?? "");
            opt.textContent = name ? name : `Дисциплина ${id ?? ""}`;
            dSel.appendChild(opt);
          });

          if (currentDisc) {
            const idx = Array.from(dSel.options).findIndex(o => Number(o.value) === currentDisc);
            if (idx >= 0) dSel.selectedIndex = idx;
            else if (dSel.options.length > 1) dSel.selectedIndex = 1;
          } else if (dSel.options.length > 1) {
            dSel.selectedIndex = 1;
          }
        }

        if ($("qa-error")) $("qa-error").textContent = "";
      })
      .catch(err => {
        console.error(err);
        if ($("qa-error")) $("qa-error").textContent = "Не успях да заредя данните за формата.";
      });
  }

  function closeQuickAddModal() {
    const overlay = $("qa-overlay");
    if (!overlay) return;
    overlay.style.display = "none";

    if ($("qa-error")) $("qa-error").textContent = "";
    if ($("qa-time")) $("qa-time").value = "";
    setQuickAddTimeRollerValue(0);
    updateQuickAddTimeHint();
    if ($("qa-splits-toggle")) $("qa-splits-toggle").checked = false;

    const box = $("qa-splits-box");
    if (box) box.style.display = "none";

    const list = $("qa-splits-list");
    if (list) list.innerHTML = "";
  }

  function addSplitRow(distance = "", time = "") {
    const list = $("qa-splits-list");
    if (!list) return;

    const row = document.createElement("div");
    row.style.cssText = `
      display:grid;
      grid-template-columns: 1fr 1fr auto;
      gap: 8px;
      align-items: center;
    `;

    row.innerHTML = `
      <input type="number" min="1" step="1" placeholder="Дистанция (м)" value="${distance}" style="
        padding:10px 12px;border:1px solid #e6e9ef;border-radius:12px;background:#fff;
      " />
      <input type="text" placeholder="Време (1:07.13)" value="${time}" style="
        padding:10px 12px;border:1px solid #e6e9ef;border-radius:12px;background:#fff;font-variant-numeric:tabular-nums;
      " />
      <button type="button" title="Махни" style="
        appearance:none;border:1px solid #e6e9ef;background:#fff;color:#0b0f19;
        width:38px;height:38px;border-radius:12px;cursor:pointer;font-weight:900;
      ">✕</button>
    `;

    const removeBtn = row.querySelector("button");
    removeBtn?.addEventListener("click", () => row.remove());

    list.appendChild(row);
  }

  function readSplitsFromForm() {
    const toggle = $("qa-splits-toggle");
    if (!toggle?.checked) return [];

    const list = $("qa-splits-list");
    if (!list) return [];

    const rows = Array.from(list.children);
    const out = [];

    for (const row of rows) {
      const inputs = row.querySelectorAll("input");
      const dist = Number(inputs[0]?.value || 0);
      const tStr = inputs[1]?.value || "";
      const sec = parseTimeToSeconds(tStr);

      if (!dist && !tStr.trim()) continue; // empty row
      if (!Number.isFinite(dist) || dist <= 0) return { error: "Невалидна дистанция при сплит." };
      if (!Number.isFinite(sec) || sec < 0) return { error: "Невалидно време при сплит." };

      out.push({ distance: dist, valueTime: sec });
    }

    // sort and validate monotonic time
    out.sort((a, b) => a.distance - b.distance);
    for (let i = 1; i < out.length; i++) {
      if (out[i].distance === out[i - 1].distance) return { error: "Има дублирана дистанция при сплитовете." };
      if (out[i].valueTime < out[i - 1].valueTime) return { error: "Сплитовете трябва да са с нарастващо (кумулативно) време." };
    }

    return out;
  }

  async function saveQuickAdd() {
    const u = getUIUser();
    if (!u?.id) return;

    const athleteId = Number($("qa-athlete")?.value || 0);
    const disciplineId = Number($("qa-discipline")?.value || 0);
    const pool = Number($("qa-pool")?.value || 0);
    const location = String($("qa-location")?.value || "").trim();
    const dtLocal = $("qa-date")?.value || "";
    const timeStr = $("qa-time")?.value || "";

    if ($("qa-error")) $("qa-error").textContent = "";

    if (!athleteId) return ($("qa-error").textContent = "Избери атлет.");
    if (!disciplineId) return ($("qa-error").textContent = "Избери дисциплина.");
    if (!(pool === 25 || pool === 50)) return ($("qa-error").textContent = "Избери басейн 25 или 50.");
    if (!location) return ($("qa-error").textContent = "Въведи локация.");

    let seconds = parseTimeToSeconds(timeStr);

    // fallback към ролера
    if (!Number.isFinite(seconds) || seconds <= 0) {
      seconds = getQuickAddTimeRollerSeconds();
    }

    if (!Number.isFinite(seconds) || seconds <= 0) {
      return ($("qa-error").textContent = "Невалидно време. Използвай ролера или въведи 1:07.13 / 67.13");
    }

    const splits = readSplitsFromForm();
    if (splits?.error) return ($("qa-error").textContent = splits.error);

    const resultDate = dtLocal
      ? new Date(dtLocal).toISOString()
      : new Date().toISOString();

    const payload = {
      UserId: athleteId,
      DisciplineId: disciplineId,
      ValueTime: Number(seconds.toFixed(2)),
      ResultDate: resultDate,
      SwimmingPoolStandart: pool,
      Location: location,
      Source: "manual",
      SourceKey: `manual:${Date.now()}`
    };

    try {
      localStorage.setItem("qa_last_location", location);

      const res = await apiFetch(`/Results`, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      const text = await res.text();
      let data = null;
      try { data = JSON.parse(text); } catch { data = text; }

      if (!res.ok) {
        console.error("Add result failed:", data);
        $("qa-error").textContent = typeof data === "string" ? data : (data?.message || "Грешка при запис.");
        return;
      }

      // Result id: depends on API returning Id properly
      const created = data;
      const createdId = Number(created?.id ?? created?.Id ?? 0);

      // ✅ Try to post splits if provided (ако endpoint /Results/{id}/splits POST съществува)
      if (Array.isArray(splits) && splits.length && createdId > 0) {
        const splitsPayload = splits.map(s => ({
          ResultId: createdId,
          Distance: Number(s.distance),
          ValueTime: Number(s.valueTime.toFixed(2))
        }));

        const r2 = await apiFetch(`/Results/${createdId}/splits`, {
          method: "POST",
          body: JSON.stringify(splitsPayload)
        });

        if (!r2.ok) {
          console.warn("Splits POST skipped/failed (нужен е POST endpoint /Results/{id}/splits).");
        }
      }

      alert("Записано.");
      closeQuickAddModal();

      // ✅ If you added for the same athlete as current page user, refresh current discipline view
      const me = getUIUser();
      const selectedDisc = Number($("discipline")?.value || 0);
      if (me?.id && Number(me.id) === athleteId && selectedDisc === disciplineId) {
        fetchResults(disciplineId, me.id);
      }

      // ✅ refresh club best tables (if currentClubId present)
      if (currentClubId && disciplineId) {
        fetchBestResultsByDisciplineInClub(currentClubId, disciplineId);

        // платформа: всички клубове
        refreshBestClubComparisonForCurrentContext(disciplineId);
      }

      // ✅ notify other modules (HomePageCoachResults.js и др.)
      window.dispatchEvent(new CustomEvent("sportstats:result-added", {
        detail: { athleteId, disciplineId, resultId: createdId || 0 }
      }));

    } catch (e) {
      console.error(e);
      $("qa-error").textContent = "Грешка при запис. Пробвай пак.";
    }
  }

  // ========================================
  // Formats / units
  // ========================================
  function formatTime(seconds) {
    const s = Number(seconds);
    if (!Number.isFinite(s)) return "Неизвестна стойност";

    // под 1 секунда -> стотни
    if (s < 1) {
      const hundredths = Math.round(s * 100).toString().padStart(2, "0");
      return `${hundredths}ст`;
    }

    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    const hundredthsNum = Math.round((s % 1) * 100);
    const hundredths = hundredthsNum.toString().padStart(2, "0");

    let timeString = "";
    if (hours > 0) timeString += `${hours} : `;
    if (minutes > 0 || hours > 0) timeString += `${minutes}мин `;
    if (secs > 0 || minutes > 0 || hours > 0) timeString += `${secs}сек `;
    if (hundredthsNum > 0 || s % 1 !== 0) timeString += `${hundredths}ст `;

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

    if (unit === "време") return `${sign}${formatTime(abs)}`;
    return `${sign}${abs.toFixed(2)} м`;
  }
});