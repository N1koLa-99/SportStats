// HomePageCoachResults.js
// ------------------------------------------------------------
// Coach/Admin layer върху HomePage (без да чупи HomePageScript.js)
// - Таблицата остава видима СЛЕД избор на дисциплина
// - Преди избор на дисциплина всичко под филтрите е скрито
// - При избор на атлет се показва диаграма (визуално НАД таблицата чрез CSS order)
// - Визуално първо е "Атлет", после "Дисциплина" (CSS order)
// - Нормативи: оцветяване в таблица + summary под диаграмата
// - Диаграмата показва само последните 8 резултата
// - Клик върху чип в "Стари резултати" => изтриване на резултат (въведи 1)
// - Hover върху чип => локация + сплитове (lazy load от /Results/{id}/splits)
// - Добавено: 25м + 50м норматив на диаграмата
// - Добавено: ясно показване в таблица дали нормативът е покрит на 25м / 50м / и двете
// - Добавено: по-лесно въвеждане на време чрез ролер (mobile-friendly select wheel)
// - Добавено: bridge към HomePageScript.js за избрания атлет
// ------------------------------------------------------------

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", initCoachResultsModule);

  async function initCoachResultsModule() {
    bootstrapUserFromSessionIfMissing();

    const user = getStoredUser();
    if (!user) return;

    const isCoachOrAdmin = Number(user.roleID) === 2 || Number(user.roleID) === 3;
    if (!isCoachOrAdmin) return;

    const els = getEls();
    if (!els.disciplineSelect || !els.coachPanel) return;

    // Показваме coach филтрите, но скриваме coach съдържанието,
    // докато няма избрана дисциплина
    els.athleteFilterWrap?.classList.remove("hidden");
    els.coachPanel?.classList.add("hidden");
    els.legacyStack?.classList.add("hidden");

    // Подсказка върху колоната "Стари резултати"
    const oldResultsTh = document.querySelector("#coach-discipline-table thead th:nth-child(4)");
    if (oldResultsTh && !oldResultsTh.dataset.deleteHintApplied) {
      oldResultsTh.dataset.deleteHintApplied = "1";
      oldResultsTh.title = "Клик върху резултат (чип) за изтриване • hover = локация/сплитове (ако има)";
    }

    const state = {
      apiBase: getApiBase(),
      requesterId: Number(user.id),
      clubId: Number(user.clubID || 0),
      roleId: Number(user.roleID || 0),

      athletes: [],
      athletesMap: new Map(),
      disciplines: [],
      disciplinesMap: new Map(),

      selectedDisciplineId: 0,
      selectedAthleteId: 0,
      searchText: "",

      clubDisciplineResultsCache: new Map(), // disciplineId -> results[]
      normativesCache: new Map(),            // disciplineId -> normatives[]
      resultSplitsCache: new Map(),          // resultId -> [{distance, valueTime}]
      resultSplitsPending: new Map(),        // resultId -> Promise

      chart: null
    };

    if (!state.clubId || !state.requesterId) return;

    setupBindings(els, state);

    // Зареди атлетите
    await loadClubAthletes(els, state);

    // Изчакай HomePageScript.js да напълни дисциплините
    await waitForDisciplineOptions(els.disciplineSelect);

    // Синхронизация на дисциплините
    readDisciplinesFromDom(els, state);

    // Начален state (ако вече има избрана дисциплина от HomePageScript)
    state.selectedDisciplineId = Number(els.disciplineSelect?.value || 0);
    state.selectedAthleteId = Number(els.athleteFilterSelect?.value || 0);

    // Публикувай bridge още в началото (дори да е "Всички деца")
    publishComparisonAthlete(state, state.selectedAthleteId);

    // Единна логика за стартов render
    await refreshCoachUi(els, state);

    // expose roller modal for HomePageScript.js "+"
    window.__sportStatsCoachOpenAddResultModal = function (opts = {}) {
      const prefillAthleteId = Number(opts.prefillAthleteId || state.selectedAthleteId || 0);
      const prefillDisciplineId = Number(opts.prefillDisciplineId || state.selectedDisciplineId || 0);

      openAddResultModal({
        state,
        prefillAthleteId,
        prefillDisciplineId
      });
    };
  }

  // ==========================================================
  // DOM
  // ==========================================================
  function getEls() {
    return {
      disciplineSelect: document.getElementById("discipline"),
      athleteFilterWrap: document.getElementById("coach-athlete-filter-wrap"),
      athleteFilterSelect: document.getElementById("coach-athlete-filter"),

      legacyStack: document.getElementById("results-legacy-stack"),
      coachPanel: document.getElementById("coach-results-panel"),

      // Table view (always visible after discipline selected)
      overviewView: document.getElementById("coach-overview-view"),
      overviewCaption: document.getElementById("coach-overview-caption"),
      searchInput: document.getElementById("coach-results-search"),
      searchBtn: document.getElementById("coach-results-search-btn"),
      tableBody: document.querySelector("#coach-discipline-table tbody"),

      // Athlete chart view (shown when athlete selected; visually above table via CSS)
      athleteView: document.getElementById("coach-athlete-view"),
      athleteTitle: document.getElementById("coach-athlete-title"),
      athleteSubtitle: document.getElementById("coach-athlete-subtitle"),
      athleteSummary: document.getElementById("coach-athlete-summary"),
      detailsBtn: document.getElementById("coach-details-btn"),
      athleteChartCanvas: document.getElementById("coachAthleteChart")
    };
  }

  // ВАЖНО: спира "други" click listener-и (напр. от HomePageScript.js),
  // които могат да отворят стария modal с текстово поле вместо този с ролер.
  function consumeClickEvent(e) {
    if (!e) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function") {
      e.stopImmediatePropagation();
    }
  }

  function setupBindings(els, state) {
    // discipline change (guard against double bind)
    if (els.disciplineSelect && !els.disciplineSelect.dataset.coachBound) {
      els.disciplineSelect.addEventListener("change", async () => {
        readDisciplinesFromDom(els, state);

        state.selectedDisciplineId = Number(els.disciplineSelect.value || 0);
        state.selectedAthleteId = Number(els.athleteFilterSelect?.value || 0);

        // bridge към HomePageScript (важно за comparison таблицата)
        publishComparisonAthlete(state, state.selectedAthleteId);

        await refreshCoachUi(els, state);
      });

      els.disciplineSelect.dataset.coachBound = "1";
    }

    // athlete dropdown change
    if (els.athleteFilterSelect && !els.athleteFilterSelect.dataset.coachBound) {
      els.athleteFilterSelect.addEventListener("change", async () => {
        state.selectedAthleteId = Number(els.athleteFilterSelect.value || 0);

        // bridge към HomePageScript
        publishComparisonAthlete(state, state.selectedAthleteId);

        await refreshCoachUi(els, state);
      });

      els.athleteFilterSelect.dataset.coachBound = "1";
    }

    // search button
    els.searchBtn?.addEventListener("click", async () => {
      state.searchText = String(els.searchInput?.value || "").trim();
      if (!state.selectedDisciplineId) {
        hideCoachContentUntilDiscipline(els, state);
        return;
      }
      await renderCoachOverviewTable(els, state);
    });

    // search enter
    els.searchInput?.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        state.searchText = String(els.searchInput?.value || "").trim();
        if (!state.selectedDisciplineId) {
          hideCoachContentUntilDiscipline(els, state);
          return;
        }
        await renderCoachOverviewTable(els, state);
      }
    });

    // table event delegation
    // capture:true => по-голям шанс да изпреварим generic listener-и от други скриптове
    els.tableBody?.addEventListener("click", async (e) => {
      const target = e.target;
      if (!target) return;

      // 1) delete old result chip
      const resultChip = target.closest(".coach-result-chip.is-deletable");
      if (resultChip) {
        consumeClickEvent(e);
        await handleOldResultChipDeleteClick(els, state, resultChip);
        return;
      }

      // 2) name button -> add result modal (ролер)
      const nameBtn = target.closest(".coach-name-btn");
      if (nameBtn) {
        consumeClickEvent(e);

        const athleteId = Number(nameBtn.dataset.userId || 0);
        if (!athleteId) return;

        openAddResultModal({
          state,
          prefillAthleteId: athleteId,
          prefillDisciplineId: state.selectedDisciplineId
        });
        return;
      }

      // 3) plus button -> add result modal (ролер)
      const plusBtn = target.closest(".coach-plus-btn");
      if (plusBtn) {
        consumeClickEvent(e);

        const athleteId = Number(plusBtn.dataset.userId || 0);
        if (!athleteId) return;

        openAddResultModal({
          state,
          prefillAthleteId: athleteId,
          prefillDisciplineId: state.selectedDisciplineId
        });
        return;
      }
    }, true);

    // lazy load splits on chip hover/focus (за title tooltip в таблицата)
    const handleChipHoverLoad = async (e) => {
      const chip = e.target?.closest?.(".coach-result-chip.is-deletable");
      if (!chip) return;

      const resultId = Number(chip.dataset.resultId || 0);
      if (!resultId) return;

      if (chip.dataset.splitsLoaded === "1" || chip.dataset.splitsLoading === "1") return;

      chip.dataset.splitsLoading = "1";

      try {
        const splits = await fetchResultSplits(state, resultId);
        const splitsText = formatSplitsForTooltip(splits);

        const location = String(chip.dataset.location || "").trim() || "Без локация";

        chip.title = buildResultChipTitle({
          canDelete: true,
          location,
          splitsText
        });

        chip.dataset.splitsLoaded = "1";
      } catch (err) {
        console.warn("Chip hover splits load failed:", err);
      } finally {
        chip.dataset.splitsLoading = "0";
      }
    };

    els.tableBody?.addEventListener("mouseover", handleChipHoverLoad);
    els.tableBody?.addEventListener("focusin", handleChipHoverLoad);

    // details button -> Information.html
    els.detailsBtn?.addEventListener("click", () => {
      const athleteId = Number(state.selectedAthleteId || 0);
      const disciplineId = Number(state.selectedDisciplineId || 0);
      if (!athleteId || !disciplineId) return;

      localStorage.setItem("info_selectedAthleteId", String(athleteId));
      localStorage.setItem("info_selectedDisciplineId", String(disciplineId));

      window.location.href = `Information.html?athleteId=${athleteId}&disciplineId=${disciplineId}`;
    });

    // Външен refresh hook (ако друг скрипт добави/редактира резултат)
    window.addEventListener("sportstats:refresh-coach-home-results", async () => {
      if (!state.selectedDisciplineId) return;
      state.clubDisciplineResultsCache.delete(Number(state.selectedDisciplineId));
      await refreshCoachUi(els, state);
    });

    // Ако друг модул dispatch-не result-added
    window.addEventListener("sportstats:result-added", async (e) => {
      const disciplineId = Number(e?.detail?.disciplineId || 0);
      if (disciplineId) {
        state.clubDisciplineResultsCache.delete(disciplineId);
        state.normativesCache.delete(disciplineId);
      }
      if (Number(state.selectedDisciplineId || 0) > 0) {
        await refreshCoachUi(els, state);
      }
    });
  }

  async function handleOldResultChipDeleteClick(els, state, chipEl) {
    const resultId = Number(chipEl.dataset.resultId || 0);
    const athleteId = Number(chipEl.dataset.userId || 0);
    const disciplineId = Number(chipEl.dataset.disciplineId || state.selectedDisciplineId || 0);
    const athleteName = String(chipEl.dataset.athleteName || "").trim() || "състезателя";
    const valueTime = Number(chipEl.dataset.valueTime || NaN);
    const resultDate = String(chipEl.dataset.resultDate || "").trim() || "—";
    const location = String(chipEl.dataset.location || "").trim() || "Без локация";

    if (!resultId) return;

    const timeText = Number.isFinite(valueTime) ? formatTimeSeconds(valueTime) : "резултата";

    const promptText =
      `За да изтриеш резултата, въведи 1\n\n` +
      `Атлет: ${athleteName}\n` +
      `Резултат: ${timeText}\n` +
      `Дата: ${resultDate}\n` +
      `Място: ${location}\n\n` +
      `Потвърждение: 1`;

    const typed = window.prompt(promptText, "");
    if (typed === null) return;
    if (String(typed).trim() !== "1") {
      alert("Изтриването е отказано. За потвърждение трябва да въведеш 1.");
      return;
    }

    chipEl.classList.add("is-busy");

    try {
      const r = await apiFetch(state, `/Results/${resultId}`, { method: "DELETE" });

      let responseText = "";
      try {
        responseText = await r.text();
      } catch {
        responseText = "";
      }

      if (!r.ok) {
        let parsed = null;
        try { parsed = responseText ? JSON.parse(responseText) : null; } catch { parsed = responseText; }
        const msg = typeof parsed === "string"
          ? parsed
          : (parsed?.message || `Грешка при изтриване (HTTP ${r.status})`);
        alert(msg);
        return;
      }

      if (disciplineId) {
        state.clubDisciplineResultsCache.delete(Number(disciplineId));
      }
      state.resultSplitsCache.delete(Number(resultId));
      state.resultSplitsPending.delete(Number(resultId));

      await renderCoachOverviewTable(els, state);

      if (
        Number(state.selectedAthleteId || 0) === Number(athleteId) &&
        Number(state.selectedDisciplineId || 0) === Number(disciplineId) &&
        Number(athleteId) > 0 &&
        Number(disciplineId) > 0
      ) {
        showAthleteChartSection(els);
        await renderCoachAthleteChart(els, state, athleteId, disciplineId);
      }

      // notify others
      window.dispatchEvent(new CustomEvent("sportstats:result-deleted", {
        detail: { resultId, athleteId, disciplineId }
      }));

      alert("Резултатът е изтрит успешно.");
    } catch (e) {
      console.error("CoachResults delete result error", e);
      alert("Грешка при изтриване. Пробвай пак.");
    } finally {
      chipEl.classList.remove("is-busy");
    }
  }

  // ==========================================================
  // Main refresh flow
  // ==========================================================
  async function refreshCoachUi(els, state) {
    const disciplineId = Number(state.selectedDisciplineId || 0);
    const athleteId = Number(state.selectedAthleteId || 0);

    // bridge (дори при 0 / "Всички деца")
    publishComparisonAthlete(state, athleteId);

    // НЯМА дисциплина => скрий всичко (таблица + графика + search блока)
    if (!disciplineId) {
      hideCoachContentUntilDiscipline(els, state);
      return;
    }

    // ИМА дисциплина => показваме таблицата/overview
    showCoachOverviewContent(els);

    await renderCoachOverviewTable(els, state);

    // Ако няма избран атлет => само таблица, без графика
    if (!athleteId) {
      hideAthleteChartSection(els, state);
      return;
    }

    // Ако има и атлет => показваме графиката
    showAthleteChartSection(els);
    await renderCoachAthleteChart(els, state, athleteId, disciplineId);
  }

  function hideCoachContentUntilDiscipline(els, state) {
    // Скриваме целия coach panel (таблица + chart + search)
    els.coachPanel?.classList.add("hidden");

    // За всеки случай — и вътрешните части
    els.overviewView?.classList.add("hidden");
    els.athleteView?.classList.add("hidden");
    els.detailsBtn?.classList.add("hidden");

    // Чистим стари данни
    if (els.overviewCaption) els.overviewCaption.textContent = "";
    if (els.tableBody) els.tableBody.innerHTML = "";
    if (els.athleteTitle) els.athleteTitle.textContent = "";
    if (els.athleteSubtitle) els.athleteSubtitle.textContent = "";
    if (els.athleteSummary) els.athleteSummary.textContent = "";

    destroyCoachChart(state);
  }

  function showCoachOverviewContent(els) {
    // Показваме панела и таблицата (chart-а се контролира отделно)
    els.coachPanel?.classList.remove("hidden");
    els.overviewView?.classList.remove("hidden");
  }

  function hideAthleteChartSection(els, state) {
    els.athleteView?.classList.add("hidden");
    els.detailsBtn?.classList.add("hidden");
    destroyCoachChart(state);
  }

  function showAthleteChartSection(els) {
    els.athleteView?.classList.remove("hidden");
    els.detailsBtn?.classList.remove("hidden");
  }

  function renderOverviewPlaceholder(els, text) {
    if (!els.tableBody) return;
    els.tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="coach-empty">${escapeHtml(text)}</td>
      </tr>
    `;
    if (els.overviewCaption) {
      els.overviewCaption.textContent = text;
    }
  }

  // ==========================================================
  // API / Data
  // ==========================================================
function getApiBase() {
  // PROD only (без localStorage, без localhost)
  return "https://sportstatsapi.azurewebsites.net";
}

  function safeJSONParse(raw) {
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function toUiUserFromSession(sess) {
    if (!sess) return null;

    const id = Number(sess.id ?? sess.Id ?? sess.userId ?? sess.UserId ?? 0);
    if (!id) return null;

    return {
      id,
      firstName: String(sess.firstName ?? sess.FirstName ?? "").trim(),
      lastName: String(sess.lastName ?? sess.LastName ?? "").trim(),
      email: sess.email ?? sess.Email ?? null,
      gender: String(sess.gender ?? sess.Gender ?? "").trim(),
      roleID: Number(sess.roleID ?? sess.RoleID ?? 0),
      clubID: Number(sess.clubID ?? sess.ClubID ?? 0),
      profileImage_url: sess.profileImage_url ?? sess.ProfileImage_url ?? "",
      yearOfBirth: Number(sess.yearOfBirth ?? sess.YearOfBirth ?? 0) || 0,
      statusID: Number(sess.statusID ?? sess.StatusID ?? 0) || 0,
      userTokenHash: sess.userTokenHash ?? sess.UserTokenHash ?? null
    };
  }

  function bootstrapUserFromSessionIfMissing() {
    const existing = safeJSONParse(localStorage.getItem("user"));
    if (existing?.id) return;

    const sessionObj = safeJSONParse(localStorage.getItem("session"));
    const uiUser = toUiUserFromSession(sessionObj);
    if (uiUser?.id) {
      localStorage.setItem("user", JSON.stringify(uiUser));
    }
  }

  function getStoredUser() {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) return null;
      const u = JSON.parse(raw);
      if (!u || !u.id) return null;
      return u;
    } catch {
      return null;
    }
  }

async function apiFetch(state, path, options = {}) {
  const base = String(state.apiBase || "").replace(/\/+$/, "");
  let p = String(path || "");

  // ако е абсолютен URL – не пипаме
  if (p.startsWith("http://") || p.startsWith("https://")) {
    // noop
  } else {
    // нормализирай path -> винаги да започва с /
    p = p.startsWith("/") ? p : `/${p}`;

    // гарантирай /api префикс (без double /api/api)
    const baseHasApi = base.endsWith("/api");
    const pathHasApi = p === "/api" || p.startsWith("/api/");

    if (baseHasApi && pathHasApi) {
      // base: .../api + path: /api/...  => махаме първото /api от path
      p = p === "/api" ? "" : p.replace(/^\/api/, "");
    } else if (!baseHasApi && !pathHasApi) {
      // base: ... (без /api) + path: /Results => добавяме /api отпред
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
  if (state.requesterId && !headers.has("Requester-Id")) {
    headers.set("Requester-Id", String(state.requesterId));
  }

  return fetch(url, {
    credentials: "include",
    ...options,
    headers
  });
}

  async function loadClubAthletes(els, state) {
    try {
      let all = [];

      // 1) primary endpoint
      try {
        const r = await apiFetch(state, `/Users/club/${state.clubId}`, { method: "GET" });
        if (r.ok) {
          const raw = await r.json();
          all = Array.isArray(raw) ? raw : [];
        } else if (r.status !== 404) {
          throw new Error(`HTTP ${r.status}`);
        }
      } catch (err) {
        console.warn("CoachResults: /Users/club fallback to /Users", err);
      }

      // 2) fallback endpoint
      if (!all.length) {
        const r2 = await apiFetch(state, `/Users`, { method: "GET" });
        if (r2.ok) {
          const raw2 = await r2.json();
          const list2 = Array.isArray(raw2) ? raw2 : [];
          all = list2.filter(x => Number(x.clubID ?? x.ClubID ?? 0) === Number(state.clubId));
        }
      }

      const mapped = all.map(normalizeUser).filter(Boolean);

      state.athletes = mapped.filter(u => {
        // само деца/атлети (ако roleID е наличен)
        const roleOk = (u.roleID == null) ? true : Number(u.roleID) === 1;

        // скрий чакащи/отхвърлени (ако statusID е наличен)
        const st = Number(u.statusID ?? 0);
        const statusOk = ![1, 3].includes(st);

        return roleOk && statusOk;
      });

      state.athletesMap = new Map(state.athletes.map(a => [Number(a.id), a]));
      populateAthleteFilter(els, state);
    } catch (e) {
      console.error("CoachResults: loadClubAthletes error", e);
      state.athletes = [];
      state.athletesMap = new Map();
      populateAthleteFilter(els, state);
    }
  }

  function normalizeUser(u) {
    if (!u) return null;
    const id = Number(u.id ?? u.Id ?? 0);
    if (!id) return null;

    return {
      id,
      firstName: String(u.firstName ?? u.FirstName ?? "").trim(),
      lastName: String(u.lastName ?? u.LastName ?? "").trim(),
      yearOfBirth: Number(u.yearOfBirth ?? u.YearOfBirth ?? 0) || "",
      gender: String(u.gender ?? u.Gender ?? "").trim(),
      roleID: u.roleID ?? u.RoleID ?? null,
      statusID: u.statusID ?? u.StatusID ?? null
    };
  }

  function populateAthleteFilter(els, state) {
    const sel = els.athleteFilterSelect;
    if (!sel) return;

    const current = Number(sel.value || 0);

    sel.innerHTML = "";
    sel.appendChild(new Option("Всички деца (таблица)", ""));

    if (!state.athletes.length) {
      sel.value = "";
      return;
    }

    state.athletes
      .slice()
      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, "bg"))
      .forEach(a => {
        const label = `${a.firstName} ${a.lastName}${a.yearOfBirth ? ` (${a.yearOfBirth})` : ""}`;
        sel.appendChild(new Option(label, String(a.id)));
      });

    if (current && [...sel.options].some(o => Number(o.value) === current)) {
      sel.value = String(current);
    } else {
      sel.value = "";
    }
  }

  async function waitForDisciplineOptions(selectEl, timeoutMs = 8000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const hasRealOptions = [...(selectEl?.options || [])].some(o => Number(o.value) > 0);
      if (hasRealOptions) return true;
      await sleep(250);
    }
    return false;
  }

  function readDisciplinesFromDom(els, state) {
    const sel = els.disciplineSelect;
    if (!sel) return;

    const list = [];
    for (const opt of sel.options) {
      const id = Number(opt.value || 0);
      if (!id) continue;
      list.push({
        id,
        name: opt.textContent?.trim() || `Дисциплина ${id}`
      });
    }

    state.disciplines = list;
    state.disciplinesMap = new Map(list.map(d => [Number(d.id), d]));
  }

  async function fetchResultsByClubAndDiscipline(state, disciplineId) {
    const key = Number(disciplineId);
    if (state.clubDisciplineResultsCache.has(key)) {
      return state.clubDisciplineResultsCache.get(key);
    }

    const r = await apiFetch(state, `/Results/by-club/${state.clubId}/by-discipline/${disciplineId}`, { method: "GET" });

    if (r.status === 404) {
      const empty = [];
      state.clubDisciplineResultsCache.set(key, empty);
      return empty;
    }

    if (!r.ok) throw new Error(`HTTP ${r.status}`);

    const raw = await r.json();
    const list = (Array.isArray(raw) ? raw : []).map(normalizeResult).filter(Boolean);

    state.clubDisciplineResultsCache.set(key, list);
    return list;
  }

  async function fetchResultsByUserAndDisciplineForCoach(state, athleteId, disciplineId) {
    try {
      const r = await apiFetch(state, `/Results/by-user/${athleteId}/by-discipline/${disciplineId}`, { method: "GET" });
      if (r.ok) {
        const raw = await r.json();
        return (Array.isArray(raw) ? raw : []).map(normalizeResult).filter(Boolean);
      }
    } catch (e) {
      console.warn("CoachResults: by-user endpoint failed, fallback to by-club", e);
    }

    const all = await fetchResultsByClubAndDiscipline(state, disciplineId);
    return all.filter(x => Number(x.userId) === Number(athleteId));
  }

  function normalizeResult(r) {
    if (!r) return null;

    const id = Number(r.id ?? r.Id ?? 0);
    const userId = Number(r.userId ?? r.UserId ?? 0);
    const disciplineId = Number(r.disciplineId ?? r.DisciplineId ?? 0);
    const valueTime = Number(r.valueTime ?? r.ValueTime ?? NaN);

    if (!userId || !disciplineId || !Number.isFinite(valueTime)) return null;

    const rawDate = r.resultDate ?? r.ResultDate ?? r.date ?? r.Date ?? null;
    const dt = rawDate ? new Date(rawDate) : null;
    const resultDate = dt && !Number.isNaN(dt.getTime()) ? dt : null;

    const pool = Number(r.swimmingPoolStandart ?? r.SwimmingPoolStandart ?? r.poolLength ?? r.PoolLength ?? 0) || 0;

    return {
      id,
      userId,
      disciplineId,
      valueTime,
      resultDate,
      location: String(r.location ?? r.Location ?? "").trim(),
      pool,
      splits: extractResultSplits(r),

      userFirstName: String(r.userFirstName ?? r.UserFirstName ?? "").trim(),
      userLastName: String(r.userLastName ?? r.UserLastName ?? "").trim(),
      userYearOfBirth: Number(r.userYearOfBirth ?? r.UserYearOfBirth ?? 0) || ""
    };
  }

  // ==========================================================
  // Bridge -> HomePageScript.js (selected comparison athlete)
  // ==========================================================
  function publishComparisonAthlete(state, athleteId) {
    const id = Number(athleteId || 0);
    const athlete = id ? state.athletesMap.get(id) : null;

    const payload = athlete
      ? {
          athleteId: Number(athlete.id || 0),
          firstName: String(athlete.firstName || ""),
          lastName: String(athlete.lastName || ""),
          yearOfBirth: Number(athlete.yearOfBirth || 0) || null
        }
      : {
          athleteId: 0,
          firstName: "",
          lastName: "",
          yearOfBirth: null
        };

    window.__sportStatsSelectedComparisonAthlete = payload;

    try {
      window.dispatchEvent(new CustomEvent("sportstats:comparison-athlete-changed", {
        detail: payload
      }));
    } catch (e) {
      console.warn("CoachResults bridge dispatch failed:", e);
    }
  }

  // ==========================================================
  // Splits API (lazy load / cache)
  // ==========================================================
  async function fetchResultSplits(state, resultId) {
    const id = Number(resultId || 0);
    if (!id) return [];

    if (state.resultSplitsCache?.has(id)) return state.resultSplitsCache.get(id) || [];
    if (state.resultSplitsPending?.has(id)) return await state.resultSplitsPending.get(id);

    const p = (async () => {
      try {
        const r = await apiFetch(state, `/Results/${id}/splits`, { method: "GET" });

        if (r.status === 404) {
          state.resultSplitsCache.set(id, []);
          return [];
        }

        if (!r.ok) throw new Error(`HTTP ${r.status}`);

        const raw = await r.json();
        const list = (Array.isArray(raw) ? raw : [])
          .map(normalizeResultSplit)
          .filter(Boolean)
          .sort((a, b) => Number(a.distance || 0) - Number(b.distance || 0));

        state.resultSplitsCache.set(id, list);
        return list;
      } catch (e) {
        console.warn(`fetchResultSplits failed for result ${id}`, e);
        state.resultSplitsCache.set(id, []);
        return [];
      } finally {
        state.resultSplitsPending.delete(id);
      }
    })();

    state.resultSplitsPending.set(id, p);
    return await p;
  }

  function normalizeResultSplit(s) {
    if (!s) return null;

    const distance = Number(s.distance ?? s.Distance ?? 0);
    const valueTime = Number(s.valueTime ?? s.ValueTime ?? NaN);

    if (!Number.isFinite(valueTime)) return null;

    return {
      distance: Number.isFinite(distance) ? distance : 0,
      valueTime
    };
  }

  async function hydrateSplitsForResults(state, results) {
    const list = Array.isArray(results) ? results : [];
    if (!list.length) return;

    await Promise.allSettled(
      list.map(async (r) => {
        if (!r || !Number(r.id)) return;
        if (Array.isArray(r.splits) && r.splits.length) return;
        const splits = await fetchResultSplits(state, r.id);
        r.splits = splits;
      })
    );
  }

  function buildResultChipTitle({ canDelete, location, splitsText }) {
    const lines = [];
    if (canDelete) lines.push("Клик за изтриване (ще поиска да въведеш 1)");
    lines.push(`Локация: ${location || "Без локация"}`);
    lines.push(splitsText ? `Сплитове: ${splitsText}` : "Сплитове: няма");
    return lines.join("\n");
  }

  // ==========================================================
  // Normatives (cache + logic)
  // ==========================================================
  async function fetchNormativesByDiscipline(state, disciplineId) {
    const key = Number(disciplineId);
    if (state.normativesCache.has(key)) {
      return state.normativesCache.get(key);
    }

    if (!isTimeDiscipline(disciplineId)) {
      state.normativesCache.set(key, []);
      return [];
    }

    try {
      const r = await apiFetch(state, `/Normatives/discipline/${disciplineId}`, { method: "GET" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const raw = await r.json();

      const list = (Array.isArray(raw) ? raw : []).map(normalizeNormative).filter(Boolean);
      state.normativesCache.set(key, list);
      return list;
    } catch (e) {
      console.warn("CoachResults: fetchNormativesByDiscipline failed", e);
      state.normativesCache.set(key, []);
      return [];
    }
  }

  function normalizeNormative(n) {
    if (!n) return null;

    const valueStandart = Number(n.valueStandart ?? n.ValueStandart ?? NaN);
    if (!Number.isFinite(valueStandart)) return null;

    const poolId = Number(n.swimmingPoolStandartId ?? n.SwimmingPoolStandartId ?? 0) || 0;

    return {
      poolId, // 1=25m, 2=50m
      gender: String(n.gender ?? n.Gender ?? "").trim(),
      valueStandart,

      minYearOfBorn: n.minYearOfBorn ?? n.MinYearOfBorn ?? null,
      maxYearOfBorn: n.maxYearOfBorn ?? n.MaxYearOfBorn ?? null,
      minYearOfBirth: n.minYearOfBirth ?? n.MinYearOfBirth ?? null,
      maxYearOfBirth: n.maxYearOfBirth ?? n.MaxYearOfBirth ?? null,

      minAge: n.minAge ?? n.MinAge ?? null,
      maxAge: n.maxAge ?? n.MaxAge ?? null
    };
  }

  function evaluateResultVsNormative({ result, athlete, normatives, disciplineId }) {
    if (!result || !athlete || !Array.isArray(normatives) || !normatives.length) {
      return { status: "unknown", reason: "Няма норматив" };
    }

    if (!isTimeDiscipline(disciplineId)) {
      return { status: "unknown", reason: "Няма норматив за дисциплината" };
    }

    const year = Number(athlete.yearOfBirth || 0);
    const gender = normalizeGender(athlete.gender);
    if (!year || !gender) {
      return { status: "unknown", reason: "Липсват пол/година" };
    }

    const poolId = mapPoolLengthToNormativePoolId(result.pool);
    if (!poolId) {
      return { status: "unknown", reason: "Липсва размер на басейна" };
    }

    const candidates = normatives.filter(n => {
      const nGender = normalizeGender(n.gender);
      const sameGender = !nGender || nGender === gender;
      const samePool = Number(n.poolId) === Number(poolId);
      const inRange = isYearInNormativeRange(year, n);
      return sameGender && samePool && inRange;
    });

    if (!candidates.length) {
      return { status: "unknown", reason: "Няма съвпадащ норматив" };
    }

    // Ако има няколко, взимаме най-строгия (най-ниско време)
    const normative = candidates.slice().sort((a, b) => Number(a.valueStandart) - Number(b.valueStandart))[0];

    const diffSeconds = Number(result.valueTime) - Number(normative.valueStandart); // <=0 => покрит
    const covered = diffSeconds <= 0;

    return {
      status: covered ? "covered" : "not-covered",
      covered,
      diffSeconds,
      absDiffSeconds: Math.abs(diffSeconds),
      normativeSeconds: Number(normative.valueStandart),
      poolId,
      poolLabel: poolId === 1 ? "25м" : poolId === 2 ? "50м" : "—"
    };
  }

  function isTimeDiscipline(disciplineId) {
    return Number(disciplineId) !== 18;
  }

  function mapPoolLengthToNormativePoolId(poolLength) {
    const p = Number(poolLength || 0);
    if (p === 25) return 1;
    if (p === 50) return 2;
    return 0;
  }

  function normalizeGender(g) {
    if (!g) return null;
    const s = String(g).trim().toLowerCase();
    if (["m", "male", "момче", "мъж"].includes(s)) return "M";
    if (["f", "female", "момиче", "жена"].includes(s)) return "F";
    return s.toUpperCase();
  }

  function isYearInNormativeRange(userYear, n) {
    const toNum = (v) => {
      if (v == null) return NaN;
      if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return Number(v.slice(0, 4));
      const x = Number(v);
      return Number.isFinite(x) ? x : NaN;
    };

    const minYear =
      toNum(n.minYearOfBorn) ||
      toNum(n.minYearOfBirth);

    const maxYear =
      toNum(n.maxYearOfBorn) ||
      toNum(n.maxYearOfBirth);

    if (Number.isFinite(minYear) && Number.isFinite(maxYear) && Number.isFinite(Number(userYear))) {
      return Number(userYear) >= minYear && Number(userYear) <= maxYear;
    }

    const minAge = toNum(n.minAge);
    const maxAge = toNum(n.maxAge);
    if (Number.isFinite(minAge) && Number.isFinite(maxAge) && Number.isFinite(Number(userYear))) {
      const nowYear = new Date().getFullYear();
      const age = nowYear - Number(userYear);
      return age >= minAge && age <= maxAge;
    }

    return true;
  }

  // ==========================================================
  // Coverage helpers (25м / 50м / и двете)
  // ==========================================================
  function hasKnownEval(evalResult) {
    return !!evalResult && (evalResult.status === "covered" || evalResult.status === "not-covered");
  }

  function getPoolCoverageMeta(eval25, eval50) {
    const k25 = hasKnownEval(eval25);
    const k50 = hasKnownEval(eval50);

    const c25 = eval25?.status === "covered";
    const c50 = eval50?.status === "covered";

    // Няма нито един резултат/проверка
    if (!k25 && !k50) {
      return {
        key: "unknown",
        cssClass: "unknown",
        shortText: "Няма проверка",
        longText: "Няма достатъчно данни за 25м/50м"
      };
    }

    // И двата са налични
    if (k25 && k50) {
      if (c25 && c50) {
        return {
          key: "both-covered",
          cssClass: "covered",
          shortText: "Покрит: 25м + 50м",
          longText: "Покрит норматив и на 25м, и на 50м"
        };
      }
      if (c25 && !c50) {
        return {
          key: "partial",
          cssClass: "partial",
          shortText: "Покрит: само 25м",
          longText: "Покрит норматив само на 25м"
        };
      }
      if (!c25 && c50) {
        return {
          key: "partial",
          cssClass: "partial",
          shortText: "Покрит: само 50м",
          longText: "Покрит норматив само на 50м"
        };
      }
      return {
        key: "none-covered",
        cssClass: "not-covered",
        shortText: "Непокрит: 25м + 50м",
        longText: "Непокрит норматив и на 25м, и на 50м"
      };
    }

    // Само 25м е налично
    if (k25 && !k50) {
      return c25
        ? {
            key: "single-covered",
            cssClass: "covered",
            shortText: "Покрит: 25м",
            longText: "Има данни само за 25м • нормативът е покрит"
          }
        : {
            key: "single-not-covered",
            cssClass: "not-covered",
            shortText: "Непокрит: 25м",
            longText: "Има данни само за 25м • нормативът не е покрит"
          };
    }

    // Само 50м е налично
    if (!k25 && k50) {
      return c50
        ? {
            key: "single-covered",
            cssClass: "covered",
            shortText: "Покрит: 50м",
            longText: "Има данни само за 50м • нормативът е покрит"
          }
        : {
            key: "single-not-covered",
            cssClass: "not-covered",
            shortText: "Непокрит: 50м",
            longText: "Има данни само за 50м • нормативът не е покрит"
          };
    }

    return {
      key: "unknown",
      cssClass: "unknown",
      shortText: "Няма проверка",
      longText: "Няма достатъчно данни"
    };
  }

  function getPoolMiniStatus(evalResult, poolLabel) {
    if (!evalResult) {
      return { cssClass: "unknown", text: `${poolLabel}: няма` };
    }
    if (evalResult.status === "covered") {
      return { cssClass: "covered", text: `${poolLabel}: ✅` };
    }
    if (evalResult.status === "not-covered") {
      return { cssClass: "not-covered", text: `${poolLabel}: ❌` };
    }
    return { cssClass: "unknown", text: `${poolLabel}: ?` };
  }

  function getBestCellVisualClass({ coverageMeta, fallbackEval }) {
    if (coverageMeta?.cssClass === "covered") return "coach-best-cell norm-covered";
    if (coverageMeta?.cssClass === "not-covered") return "coach-best-cell norm-not-covered";
    if (coverageMeta?.cssClass === "partial") return "coach-best-cell norm-partial";

    if (fallbackEval?.status === "covered") return "coach-best-cell norm-covered";
    if (fallbackEval?.status === "not-covered") return "coach-best-cell norm-not-covered";
    return "coach-best-cell norm-unknown";
  }

  // ==========================================================
  // Table render (visible after discipline selected)
  // ==========================================================
  async function renderCoachOverviewTable(els, state) {
    const disciplineId = Number(state.selectedDisciplineId || 0);
    if (!disciplineId) {
      hideCoachContentUntilDiscipline(els, state);
      return;
    }

    const discName = state.disciplinesMap.get(disciplineId)?.name || `Дисциплина ${disciplineId}`;
    if (els.overviewCaption) {
      els.overviewCaption.textContent =
        `Таблица за ${discName}. Кликни върху име или + за добавяне на резултат. ` +
        `В "Стари резултати" клик върху чип = изтриване (въведи 1). Hover = локация/сплитове.`;
    }

    if (els.tableBody) {
      els.tableBody.innerHTML = `<tr><td colspan="5" class="coach-empty">Зареждане...</td></tr>`;
    }

    try {
      const [results, normatives] = await Promise.all([
        fetchResultsByClubAndDiscipline(state, disciplineId),
        fetchNormativesByDiscipline(state, disciplineId)
      ]);

      const grouped = new Map();

      for (const res of results) {
        const uid = Number(res.userId);
        if (!grouped.has(uid)) grouped.set(uid, []);
        grouped.get(uid).push(res);
      }

      // включи и атлети без резултати
      for (const athlete of state.athletes) {
        const uid = Number(athlete.id);
        if (!grouped.has(uid)) grouped.set(uid, []);
      }

      let rows = [...grouped.entries()].map(([userId, list]) => {
        const athlete = state.athletesMap.get(Number(userId));

        list.sort((a, b) => (b.resultDate?.getTime() || 0) - (a.resultDate?.getTime() || 0));

        const best = list.length
          ? list.reduce((min, x) => (x.valueTime < min.valueTime ? x : min), list[0])
          : null;

        const best25 = getBestForPool(list, 25);
        const best50 = getBestForPool(list, 50);

        const evalOverall = best
          ? evaluateResultVsNormative({ result: best, athlete, normatives, disciplineId })
          : { status: "unknown", reason: "Няма резултат" };

        const eval25 = best25
          ? evaluateResultVsNormative({ result: best25, athlete, normatives, disciplineId })
          : null;

        const eval50 = best50
          ? evaluateResultVsNormative({ result: best50, athlete, normatives, disciplineId })
          : null;

        const coverageMeta = getPoolCoverageMeta(eval25, eval50);
        const bestCellClass = getBestCellVisualClass({ coverageMeta, fallbackEval: evalOverall });

        return {
          userId: Number(userId),
          athlete,
          name: getAthleteDisplayName(athlete, list[0]),
          yearOfBirth: athlete?.yearOfBirth || list[0]?.userYearOfBirth || "",
          best,
          best25,
          best50,
          allResults: list,
          evalOverall,
          eval25,
          eval50,
          coverageMeta,
          bestCellClass
        };
      });

      const q = String(state.searchText || "").trim().toLowerCase();
      if (q) {
        rows = rows.filter(r => r.name.toLowerCase().includes(q));
      }

      rows.sort((a, b) => {
        if (!a.best && !b.best) return a.name.localeCompare(b.name, "bg");
        if (!a.best) return 1;
        if (!b.best) return -1;
        if (a.best.valueTime !== b.best.valueTime) return a.best.valueTime - b.best.valueTime;
        return a.name.localeCompare(b.name, "bg");
      });

      if (!rows.length) {
        renderOverviewPlaceholder(els, q ? "Няма съвпадения по търсене." : "Няма данни за тази дисциплина.");
        return;
      }

      if (!els.tableBody) return;
      els.tableBody.innerHTML = rows.map(row => renderOverviewRowHtml(row, disciplineId)).join("");
    } catch (e) {
      console.error("CoachResults: renderCoachOverviewTable error", e);
      renderOverviewPlaceholder(els, "Грешка при зареждане на таблицата.");
    }
  }

  function getAthleteDisplayName(athlete, fallbackResult) {
    const fn = athlete?.firstName || fallbackResult?.userFirstName || "";
    const ln = athlete?.lastName || fallbackResult?.userLastName || "";
    const name = `${fn} ${ln}`.trim();
    return name || `Състезател #${athlete?.id ?? fallbackResult?.userId ?? "?"}`;
  }

  function renderOverviewRowHtml(row, disciplineId) {
    const bestText = row.best ? formatTimeSeconds(row.best.valueTime) : "Няма резултат";

    let bestSub = "";
    if (row.best) {
      if (row.evalOverall?.status === "covered" || row.evalOverall?.status === "not-covered") {
        bestSub = `${row.evalOverall.status === "covered" ? "✅" : "❌"} ${row.evalOverall.poolLabel} • ${formatNormativeDelta(row.evalOverall.diffSeconds)}`;
      } else {
        bestSub = row.evalOverall?.reason ? `ℹ ${row.evalOverall.reason}` : "ℹ Няма норматив";
      }
    }

    const s25 = getPoolMiniStatus(row.eval25, "25м");
    const s50 = getPoolMiniStatus(row.eval50, "50м");

    const statusRowHtml = row.best
      ? `
        <div class="coach-best-status-row" aria-label="Статус норматив 25м и 50м">
          <span class="coach-mini-status ${s25.cssClass}">${escapeHtml(s25.text)}</span>
          <span class="coach-mini-status ${s50.cssClass}">${escapeHtml(s50.text)}</span>
        </div>
        <div class="coach-best-status-summary ${row.coverageMeta?.cssClass || "unknown"}">
          ${escapeHtml(row.coverageMeta?.shortText || "Няма проверка")}
        </div>
      `
      : "";

    const chips = row.allResults.length
      ? row.allResults
          .slice(0, 4)
          .map(r => {
            const dt = r.resultDate ? r.resultDate.toLocaleDateString("bg-BG") : "—";
            const canDelete = Number(r.id || 0) > 0;

            const splitTooltip = formatSplitsForTooltip(r.splits);
            const chipTitle = buildResultChipTitle({
              canDelete,
              location: r.location || "Без локация",
              splitsText: splitTooltip
            });

            return `
              <span class="coach-result-chip${canDelete ? " is-deletable" : ""}"
                    title="${escapeHtml(chipTitle)}"
                    ${canDelete ? `data-result-id="${Number(r.id)}"` : ""}
                    ${canDelete ? `data-user-id="${Number(row.userId)}"` : ""}
                    ${canDelete ? `data-discipline-id="${Number(disciplineId)}"` : ""}
                    ${canDelete ? `data-athlete-name="${escapeHtml(row.name)}"` : ""}
                    ${canDelete ? `data-value-time="${Number(r.valueTime)}"` : ""}
                    ${canDelete ? `data-result-date="${escapeHtml(dt)}"` : ""}
                    ${canDelete ? `data-location="${escapeHtml(r.location || "Без локация")}"` : ""}>
                <span class="t">${escapeHtml(formatTimeSeconds(r.valueTime))}</span>
                <span class="d">${escapeHtml(dt)}${r.pool ? ` • ${r.pool}м` : ""}</span>
              </span>
            `;
          })
          .join("")
      : `<span class="coach-result-chip"><span class="d">Няма резултати</span></span>`;

    return `
      <tr>
        <td>
          <button type="button"
                  class="coach-name-btn"
                  data-user-id="${row.userId}"
                  data-discipline-id="${disciplineId}">
            ${escapeHtml(row.name)}
          </button>
        </td>

        <td>${row.yearOfBirth ? escapeHtml(String(row.yearOfBirth)) : "—"}</td>

        <td class="coach-best-cell-td">
          <div class="${row.bestCellClass} coach-best-pill" title="${escapeHtml(row.coverageMeta?.longText || "")}">
            <div class="coach-best-main">${escapeHtml(bestText)}</div>
            ${bestSub ? `<div class="coach-best-sub">${escapeHtml(bestSub)}</div>` : ""}
            ${statusRowHtml}
          </div>
        </td>

        <td>
          <div class="coach-old-results">${chips}</div>
        </td>

        <td>
          <button type="button"
                  class="coach-plus-btn"
                  title="Добави резултат"
                  aria-label="Добави резултат"
                  data-user-id="${row.userId}"
                  data-discipline-id="${disciplineId}">
            +
          </button>
        </td>
      </tr>
    `;
  }

  // ==========================================================
  // Athlete chart + normative summary
  // ==========================================================
  async function renderCoachAthleteChart(els, state, athleteId, disciplineId) {
    const athlete = state.athletesMap.get(Number(athleteId));
    const discipline = state.disciplinesMap.get(Number(disciplineId));

    if (els.athleteTitle) {
      els.athleteTitle.textContent = athlete
        ? `${athlete.firstName} ${athlete.lastName}${athlete.yearOfBirth ? ` (${athlete.yearOfBirth})` : ""}`
        : `Атлет #${athleteId}`;
    }

    if (els.athleteSubtitle) {
      els.athleteSubtitle.textContent = discipline
        ? `Дисциплина: ${discipline.name}`
        : `Дисциплина #${disciplineId}`;
    }

    if (els.athleteSummary) {
      els.athleteSummary.textContent = "Зареждане на резултати...";
    }

    try {
      const [results, normatives] = await Promise.all([
        fetchResultsByUserAndDisciplineForCoach(state, athleteId, disciplineId),
        fetchNormativesByDiscipline(state, disciplineId)
      ]);

      if (!results.length) {
        destroyCoachChart(state);
        if (els.athleteSummary) {
          els.athleteSummary.textContent = "Няма резултати за този атлет и дисциплина.";
        }
        return;
      }

      const sorted = results.slice().sort((a, b) => (a.resultDate?.getTime() || 0) - (b.resultDate?.getTime() || 0));

      // последни 8 за диаграма
      const chartResults = sorted.slice(-8);

      await hydrateSplitsForResults(state, chartResults);

      const labels = chartResults.map((r, i) =>
        r.resultDate ? r.resultDate.toLocaleDateString("bg-BG") : `#${i + 1}`
      );
      const data = chartResults.map(r => r.valueTime);

      const best = sorted.reduce((min, x) => (x.valueTime < min.valueTime ? x : min), sorted[0]);
      const latest = sorted[sorted.length - 1];

      const evalOverall = evaluateResultVsNormative({
        result: best,
        athlete,
        normatives,
        disciplineId
      });

      const best25 = getBestForPool(sorted, 25);
      const best50 = getBestForPool(sorted, 50);

      const eval25 = best25 ? evaluateResultVsNormative({ result: best25, athlete, normatives, disciplineId }) : null;
      const eval50 = best50 ? evaluateResultVsNormative({ result: best50, athlete, normatives, disciplineId }) : null;

      const coverageMeta = getPoolCoverageMeta(eval25, eval50);

      // МАХНАТО: "Брой резултати" и "Диаграма: последни X"
      // FIX: 👑 е на "Най-добър", а "Последен" е неутрален.
      // Добавени са класове is-best / is-last за по-стабилно CSS оцветяване.
      const summaryTopHtml = `
        <div class="coach-summary-topline">
          <span class="coach-summary-kpi is-best" data-kpi="best">
            <strong>👑 Най-добър:</strong>
            ${escapeHtml(formatTimeSeconds(best.valueTime))}
          </span>
          <span class="coach-summary-kpi is-last" data-kpi="last">
            <strong>Последен:</strong>
            ${escapeHtml(formatTimeSeconds(latest.valueTime))}
          </span>
        </div>
      `;

      const normativeHtml = renderAthleteNormativeSummary({
        disciplineId,
        coverageMeta,
        evalOverall,
        eval25,
        eval50,
        best,
        best25,
        best50
      });

      if (els.athleteSummary) {
        els.athleteSummary.innerHTML = summaryTopHtml + normativeHtml;
      }

      const ctx = els.athleteChartCanvas?.getContext("2d");
      if (!ctx || typeof Chart === "undefined") return;

      destroyCoachChart(state);

      let normative25LineValue = null;
      if (eval25 && (eval25.status === "covered" || eval25.status === "not-covered")) {
        normative25LineValue = Number(eval25.normativeSeconds);
      }

      let normative50LineValue = null;
      if (eval50 && (eval50.status === "covered" || eval50.status === "not-covered")) {
        normative50LineValue = Number(eval50.normativeSeconds);
      }

      // по-ясно и не много шарено: линия + точки оцветени според пул (25/50)
      const pointBgColors = chartResults.map(r => Number(r.pool) === 50
        ? "rgba(124, 92, 255, 0.95)"
        : "rgba(47, 95, 215, 0.95)"
      );
      const pointBorderColors = chartResults.map(r => Number(r.pool) === 50
        ? "rgba(124, 92, 255, 1)"
        : "rgba(47, 95, 215, 1)"
      );

      state.chart = new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Резултати",
              data,
              borderColor: "rgba(47, 95, 215, 0.90)",
              backgroundColor: "rgba(47, 95, 215, 0.06)",
              fill: true,
              tension: 0.22,
              pointRadius: 4,
              pointHoverRadius: 5,
              pointBackgroundColor: pointBgColors,
              pointBorderColor: pointBorderColors,
              pointBorderWidth: 1.5,
              borderWidth: 2
            },
            ...(normative25LineValue != null ? [{
              label: "Норматив 25м",
              data: labels.map(() => normative25LineValue),
              borderColor: "rgba(16, 185, 129, 0.90)",
              borderWidth: 1.5,
              borderDash: [6, 5],
              pointRadius: 0,
              fill: false,
              tension: 0
            }] : []),
            ...(normative50LineValue != null ? [{
              label: "Норматив 50м",
              data: labels.map(() => normative50LineValue),
              borderColor: "rgba(217, 119, 6, 0.90)",
              borderWidth: 1.5,
              borderDash: [6, 5],
              pointRadius: 0,
              fill: false,
              tension: 0
            }] : [])
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "nearest", intersect: false },
          plugins: {
            legend: {
              display: true,
              position: "top",
              labels: {
                boxWidth: 18,
                usePointStyle: false
              }
            },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const label = String(ctx.dataset.label || "");
                  if (label.startsWith("Норматив")) {
                    return ` ${label}: ${formatTimeSeconds(ctx.parsed.y)}`;
                  }

                  const r = chartResults[ctx.dataIndex];
                  const poolText = r?.pool ? ` • ${r.pool}м` : "";
                  return ` ${formatTimeSeconds(ctx.parsed.y)}${poolText}`;
                },
                afterLabel: (ctx) => {
                  const label = String(ctx.dataset.label || "");
                  if (label.startsWith("Норматив")) return [];

                  const r = chartResults[ctx.dataIndex];
                  if (!r) return [];

                  const lines = [];
                  if (r.location) lines.push(`Място: ${r.location}`);

                  const splitTooltip = formatSplitsForTooltip(r.splits);
                  if (splitTooltip) lines.push(`Сплитове: ${splitTooltip}`);

                  return lines;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { display: false }
            },
            y: {
              reverse: true,
              ticks: {
                callback: (v) => formatTimeSeconds(v)
              }
            }
          }
        }
      });
    } catch (e) {
      console.error("CoachResults: renderCoachAthleteChart error", e);
      destroyCoachChart(state);
      if (els.athleteSummary) {
        els.athleteSummary.textContent = "Грешка при зареждане на диаграмата.";
      }
    }
  }

  function getBestForPool(results, poolLength) {
    const list = (results || []).filter(r => Number(r.pool) === Number(poolLength));
    if (!list.length) return null;
    return list.reduce((min, x) => (x.valueTime < min.valueTime ? x : min), list[0]);
  }

  function renderAthleteNormativeSummary({ disciplineId, coverageMeta, evalOverall, eval25, eval50, best, best25, best50 }) {
    if (!isTimeDiscipline(disciplineId)) {
      return `
        <div class="coach-normative-box">
          <div class="coach-normative-title">Норматив</div>
          <div class="coach-normative-overall unknown">За тази дисциплина не се прилага норматив.</div>
        </div>
      `;
    }

    // МАХНАТО: общият нормативен банер (напр. "Има данни само за 25м • нормативът е покрит")

    // Показваме две карти (25м и 50м) винаги -> по-лесно за възприемане
    const card25 = renderNormativeCardHtml({
      title: "25м басейн",
      resultValue: best25?.valueTime,
      evalResult: eval25
    });

    const card50 = renderNormativeCardHtml({
      title: "50м басейн",
      resultValue: best50?.valueTime,
      evalResult: eval50
    });

    // Ако няма нито 25, нито 50 - оставяме и кратък контекст за най-добър
    const extraBestInfo =
      !best25 && !best50 && best
        ? `<div class="coach-normative-overall unknown">Най-добър общ резултат: ${escapeHtml(formatTimeSeconds(best.valueTime))}${evalOverall?.poolLabel ? ` (${escapeHtml(evalOverall.poolLabel)})` : ""}</div>`
        : "";

    return `
      <div class="coach-normative-box">
        <div class="coach-normative-title">Норматив</div>
        ${extraBestInfo}
        <div class="coach-normative-grid">
          ${card25}
          ${card50}
        </div>
      </div>
    `;
  }

  function renderNormativeCardHtml({ title, resultValue, evalResult }) {
    const resultText = resultValue != null ? formatTimeSeconds(resultValue) : "—";

    if (!evalResult) {
      return `
        <div class="coach-normative-card unknown">
          <div class="label">${escapeHtml(title)}</div>
          <div class="value">Няма резултат</div>
          <div class="meta">Няма записан резултат за този басейн.</div>
        </div>
      `;
    }

    if (evalResult.status === "unknown") {
      return `
        <div class="coach-normative-card unknown">
          <div class="label">${escapeHtml(title)}</div>
          <div class="value">Няма проверка</div>
          <div class="meta">Резултат: ${escapeHtml(resultText)}</div>
          <div class="meta">${escapeHtml(evalResult.reason || "Няма съвпадащ норматив")}</div>
        </div>
      `;
    }

    const covered = evalResult.status === "covered";
    const cls = covered ? "covered" : "not-covered";
    const statusText = covered ? "✅ Покрит норматив" : "❌ Непокрит норматив";
    const diffText = covered
      ? `Покрит с ${formatAbsSeconds(evalResult.absDiffSeconds)}`
      : `Изостава с ${formatAbsSeconds(evalResult.absDiffSeconds)}`;

    return `
      <div class="coach-normative-card ${cls}">
        <div class="label">${escapeHtml(title)}</div>
        <div class="value">${statusText}</div>
        <div class="meta">Резултат: ${escapeHtml(resultText)}</div>
        <div class="meta">Норматив: ${escapeHtml(formatTimeSeconds(evalResult.normativeSeconds))}</div>
        <div class="meta">${escapeHtml(diffText)}</div>
      </div>
    `;
  }

  function destroyCoachChart(state) {
    if (state.chart) {
      state.chart.destroy();
      state.chart = null;
    }
  }

  // ==========================================================
  // Add Result Modal
  // ==========================================================
  function ensureAddResultModal() {
    let overlay = document.getElementById("coach-add-result-modal-overlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "coach-add-result-modal-overlay";
    overlay.className = "coach-modal-overlay";

    overlay.innerHTML = `
      <div class="coach-modal" role="dialog" aria-modal="true" aria-labelledby="coach-modal-title">
        <div class="coach-modal-head">
          <h3 id="coach-modal-title" class="coach-modal-title">Добавяне на резултат</h3>
          <button type="button" class="coach-modal-close" id="coach-modal-close-btn">✕</button>
        </div>

        <div class="coach-modal-body">
          <div class="coach-modal-grid">
            <div class="coach-field">
              <label for="coach-modal-athlete">Атлет</label>
              <select id="coach-modal-athlete"></select>
            </div>

            <div class="coach-field">
              <label for="coach-modal-discipline">Дисциплина</label>
              <select id="coach-modal-discipline"></select>
            </div>

            <div class="coach-field">
              <label for="coach-modal-pool">Размер на басейн</label>
              <select id="coach-modal-pool">
                <option value="25">25 м</option>
                <option value="50">50 м</option>
              </select>
            </div>

            <div class="coach-field">
              <label for="coach-modal-date">Дата/час</label>
              <input id="coach-modal-date" type="datetime-local" />
            </div>

            <div class="coach-field full">
              <label for="coach-modal-location">Място на провеждане</label>
              <input id="coach-modal-location" type="text" placeholder="гр. София, плувен басейн Спартак" />
            </div>

            <div class="coach-field full">
              <label for="coach-modal-time">Резултат (време)</label>

              <div id="coach-time-roller" class="coach-time-roller" aria-label="Избор на време">
                <div class="coach-time-col">
                  <div class="coach-time-col-label">Минути</div>
                  <select id="coach-time-min"></select>
                </div>

                <div class="coach-time-sep">:</div>

                <div class="coach-time-col">
                  <div class="coach-time-col-label">Секунди</div>
                  <select id="coach-time-sec"></select>
                </div>

                <div class="coach-time-sep">.</div>

                <div class="coach-time-col">
                  <div class="coach-time-col-label">Стотни</div>
                  <select id="coach-time-cs"></select>
                </div>
              </div>

              <input id="coach-modal-time" type="text" inputmode="decimal" placeholder="Пример: 1:07.13 или 67.13 (може и ръчно)" />
              <div id="coach-modal-time-help" class="coach-time-help"></div>
            </div>
          </div>

          <div class="coach-modal-actions">
            <button type="button" class="coach-btn ghost" id="coach-modal-cancel-btn">Отказ</button>
            <button type="button" class="coach-btn primary" id="coach-modal-save-btn">Добави</button>
          </div>

          <div id="coach-modal-error" class="coach-modal-error"></div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeAddResultModal();
    });

    document.getElementById("coach-modal-close-btn")?.addEventListener("click", closeAddResultModal);
    document.getElementById("coach-modal-cancel-btn")?.addEventListener("click", closeAddResultModal);

    initTimeRoller();

    document.getElementById("coach-modal-time")?.addEventListener("input", () => {
      syncRollerFromTimeInput();
      updateModalTimeHelp();
    });

    return overlay;
  }

  function initTimeRoller() {
    const minSel = document.getElementById("coach-time-min");
    const secSel = document.getElementById("coach-time-sec");
    const csSel = document.getElementById("coach-time-cs");
    if (!minSel || !secSel || !csSel) return;

    if (!minSel.dataset.inited) {
      populateNumericSelect(minSel, 0, 59, { pad: 0 });
      populateNumericSelect(secSel, 0, 59, { pad: 2 });
      populateNumericSelect(csSel, 0, 99, { pad: 2 });

      minSel.dataset.inited = "1";
      secSel.dataset.inited = "1";
      csSel.dataset.inited = "1";

      const onRollerChange = () => {
        syncTimeInputFromRoller();
        updateModalTimeHelp();
      };

      minSel.addEventListener("change", onRollerChange);
      secSel.addEventListener("change", onRollerChange);
      csSel.addEventListener("change", onRollerChange);
    }

    setTimeRollerValue(0);
  }

  function populateNumericSelect(sel, start, end, { pad = 0 } = {}) {
    sel.innerHTML = "";
    for (let i = start; i <= end; i++) {
      const label = pad > 0 ? String(i).padStart(pad, "0") : String(i);
      sel.appendChild(new Option(label, String(i)));
    }
  }

  function setTimeRollerValue(totalSeconds) {
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

    const minSel = document.getElementById("coach-time-min");
    const secSel = document.getElementById("coach-time-sec");
    const csSel = document.getElementById("coach-time-cs");
    if (!minSel || !secSel || !csSel) return;

    setSelectValueSafe(minSel, minutes);
    setSelectValueSafe(secSel, seconds);
    setSelectValueSafe(csSel, cs);
  }

  function setSelectValueSafe(sel, value) {
    const v = String(Number(value) || 0);
    if ([...sel.options].some(o => o.value === v)) {
      sel.value = v;
    }
  }

  function getTimeRollerSeconds() {
    const minSel = document.getElementById("coach-time-min");
    const secSel = document.getElementById("coach-time-sec");
    const csSel = document.getElementById("coach-time-cs");
    if (!minSel || !secSel || !csSel) return NaN;

    const m = Number(minSel.value || 0);
    const s = Number(secSel.value || 0);
    const cs = Number(csSel.value || 0);

    if (![m, s, cs].every(Number.isFinite)) return NaN;
    return m * 60 + s + (cs / 100);
  }

  function syncTimeInputFromRoller() {
    const input = document.getElementById("coach-modal-time");
    if (!input) return;

    const seconds = getTimeRollerSeconds();
    if (!Number.isFinite(seconds)) return;

    // Не натрапваме 0.00 ако всичко е нула и полето е празно
    if (seconds === 0 && !String(input.value || "").trim()) return;

    input.value = formatTimeForInput(seconds);
  }

  function syncRollerFromTimeInput() {
    const input = document.getElementById("coach-modal-time");
    if (!input) return;

    const raw = String(input.value || "").trim();
    if (!raw) return;

    const seconds = parseTimeToSeconds(raw);
    if (!Number.isFinite(seconds) || seconds < 0) return;

    setTimeRollerValue(seconds);
  }

  function updateModalTimeHelp() {
    const input = document.getElementById("coach-modal-time");
    const help = document.getElementById("coach-modal-time-help");
    if (!help) return;

    let sec = parseTimeToSeconds(String(input?.value || "").trim());
    if (!Number.isFinite(sec)) {
      sec = getTimeRollerSeconds();
    }

    if (Number.isFinite(sec) && sec > 0) {
      help.textContent = `= ${sec.toFixed(2)} сек`;
    } else {
      help.textContent = "Може да избереш време от ролера или да го въведеш ръчно.";
    }
  }

  function formatTimeForInput(seconds) {
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

  function openAddResultModal({ state, prefillAthleteId = 0, prefillDisciplineId = 0 }) {
    const overlay = ensureAddResultModal();
    overlay.style.display = "flex";

    const athleteSel = document.getElementById("coach-modal-athlete");
    const disciplineSel = document.getElementById("coach-modal-discipline");
    const poolSel = document.getElementById("coach-modal-pool");
    const locationInput = document.getElementById("coach-modal-location");
    const dateInput = document.getElementById("coach-modal-date");
    const timeInput = document.getElementById("coach-modal-time");
    const errorEl = document.getElementById("coach-modal-error");
    const saveBtn = document.getElementById("coach-modal-save-btn");
    const timeHelp = document.getElementById("coach-modal-time-help");

    if (errorEl) errorEl.textContent = "";
    if (timeInput) timeInput.value = "";
    if (timeHelp) timeHelp.textContent = "Може да избереш време от ролера или да го въведеш ръчно.";
    setTimeRollerValue(0);

    // disciplines
    if (disciplineSel) {
      disciplineSel.innerHTML = "";
      state.disciplines.forEach(d => {
        disciplineSel.appendChild(new Option(d.name, String(d.id)));
      });

      const wantedDisc = Number(prefillDisciplineId || state.selectedDisciplineId || 0);
      if (wantedDisc && [...disciplineSel.options].some(o => Number(o.value) === wantedDisc)) {
        disciplineSel.value = String(wantedDisc);
      }
    }

    // athletes
    if (athleteSel) {
      athleteSel.innerHTML = "";
      state.athletes.forEach(a => {
        athleteSel.appendChild(new Option(
          `${a.firstName} ${a.lastName}${a.yearOfBirth ? ` (${a.yearOfBirth})` : ""}`,
          String(a.id)
        ));
      });

      const wantedAth = Number(prefillAthleteId || state.selectedAthleteId || 0);
      if (wantedAth && [...athleteSel.options].some(o => Number(o.value) === wantedAth)) {
        athleteSel.value = String(wantedAth);
      }
    }

    if (poolSel) poolSel.value = "25";
    if (locationInput) locationInput.value = localStorage.getItem("coach_last_location") || "";

    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    const pad = (n) => String(n).padStart(2, "0");
    const dtValue = `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}`;
    if (dateInput) dateInput.value = dtValue;

    if (saveBtn) {
      saveBtn.onclick = async () => {
        if (errorEl) errorEl.textContent = "";

        const athleteId = Number(athleteSel?.value || 0);
        const disciplineId = Number(disciplineSel?.value || 0);
        const pool = Number(poolSel?.value || 0);
        const location = String(locationInput?.value || "").trim();
        const dtLocal = String(dateInput?.value || "").trim();
        const rawTime = String(timeInput?.value || "").trim();

        if (!athleteId) return setErr("Избери атлет.");
        if (!disciplineId) return setErr("Избери дисциплина.");
        if (![25, 50].includes(pool)) return setErr("Избери басейн 25/50 м.");
        if (!location) return setErr("Въведи място на провеждане.");

        let seconds = parseTimeToSeconds(rawTime);

        // fallback към ролера
        if (!Number.isFinite(seconds) || seconds <= 0) {
          seconds = getTimeRollerSeconds();
        }

        if (!Number.isFinite(seconds) || seconds <= 0) {
          return setErr("Невалидно време. Използвай ролера или въведи: 32.33 / 1:07.13");
        }

        const resultDate = dtLocal ? new Date(dtLocal).toISOString() : new Date().toISOString();

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
          saveBtn.disabled = true;
          localStorage.setItem("coach_last_location", location);

          const r = await apiFetch(state, `/Results`, {
            method: "POST",
            body: JSON.stringify(payload)
          });

          const text = await r.text();
          let parsed = null;
          try { parsed = JSON.parse(text); } catch { parsed = text; }

          if (!r.ok) {
            console.error("CoachResults add result failed:", parsed);
            return setErr(typeof parsed === "string" ? parsed : (parsed?.message || `Грешка: HTTP ${r.status}`));
          }

          closeAddResultModal();

          // invalidate caches for this discipline
          state.clubDisciplineResultsCache.delete(Number(disciplineId));
          state.normativesCache.delete(Number(disciplineId));

          state.selectedDisciplineId = Number(disciplineId);
          const els = getEls();

          if (els.disciplineSelect && Number(els.disciplineSelect.value || 0) !== Number(disciplineId)) {
            els.disciplineSelect.value = String(disciplineId);
          }

          await renderCoachOverviewTable(els, state);

          if (Number(state.selectedAthleteId || 0) === Number(athleteId)) {
            showAthleteChartSection(els);
            await renderCoachAthleteChart(els, state, athleteId, disciplineId);
          }

          // bridge / refresh notifications
          window.dispatchEvent(new CustomEvent("sportstats:result-added", {
            detail: { athleteId, disciplineId }
          }));

          alert("Резултатът е добавен успешно.");
        } catch (e) {
          console.error(e);
          setErr("Грешка при запис. Пробвай пак.");
        } finally {
          saveBtn.disabled = false;
        }

        function setErr(msg) {
          if (errorEl) errorEl.textContent = msg;
        }
      };
    }
  }

  function closeAddResultModal() {
    const overlay = document.getElementById("coach-add-result-modal-overlay");
    if (overlay) overlay.style.display = "none";
  }

  // ==========================================================
  // Utils
  // ==========================================================
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function parseTimeToSeconds(input) {
    const s = String(input || "").trim();
    if (!s) return NaN;

    // "32.33"
    if (/^\d+([.,]\d+)?$/.test(s)) {
      return Number(s.replace(",", "."));
    }

    // "m:ss.xx" или "h:mm:ss.xx"
    const parts = s.replace(",", ".").split(":").map(x => x.trim());

    if (parts.length === 2) {
      const m = Number(parts[0]);
      const sec = Number(parts[1]);
      if (!Number.isFinite(m) || !Number.isFinite(sec)) return NaN;
      return (m * 60) + sec;
    }

    if (parts.length === 3) {
      const h = Number(parts[0]);
      const m = Number(parts[1]);
      const sec = Number(parts[2]);
      if (!Number.isFinite(h) || !Number.isFinite(m) || !Number.isFinite(sec)) return NaN;
      return (h * 3600) + (m * 60) + sec;
    }

    return NaN;
  }

  function formatTimeSeconds(seconds) {
    const s = Number(seconds);
    if (!Number.isFinite(s)) return "—";

    const totalSeconds = Math.floor(s);

    let hundredths = Math.round((s - totalSeconds) * 100);
    let carry = 0;
    if (hundredths === 100) {
      hundredths = 0;
      carry = 1;
    }

    const total = totalSeconds + carry;
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = total % 60;

    const hh = h > 0 ? `${h}:` : "";
    const mm = h > 0 ? String(m).padStart(2, "0") : (m > 0 ? `${m}:` : "");
    const ss = (h > 0 || m > 0) ? String(sec).padStart(2, "0") : String(sec);
    const cc = String(hundredths).padStart(2, "0");

    return `${hh}${mm}${ss}.${cc} сек`;
  }

  function formatTimeSecondsCompact(seconds) {
    return formatTimeSeconds(seconds).replace(/\s*сек$/i, "");
  }

  function formatAbsSeconds(seconds) {
    const s = Number(seconds);
    if (!Number.isFinite(s)) return "—";
    return `${s.toFixed(2)} сек`;
  }

  function formatNormativeDelta(diffSeconds) {
    const d = Number(diffSeconds);
    if (!Number.isFinite(d)) return "—";
    if (d <= 0) return `-${Math.abs(d).toFixed(2)} сек`;
    return `+${Math.abs(d).toFixed(2)} сек`;
  }

  // -----------------------------
  // Splits helpers (generic parser)
  // -----------------------------
  function extractResultSplits(resultDto) {
    if (!resultDto || typeof resultDto !== "object") return [];

    const directCandidates = [
      resultDto.splits,
      resultDto.Splits,
      resultDto.splitTimes,
      resultDto.SplitTimes,
      resultDto.lapTimes,
      resultDto.LapTimes,
      resultDto.splitsJson,
      resultDto.SplitsJson,
      resultDto.splitsText,
      resultDto.SplitsText
    ];

    for (const c of directCandidates) {
      const parsed = parseSplitsCandidate(c);
      if (parsed.length) return parsed;
    }

    const numberedKeys = Object.keys(resultDto)
      .filter(k => /^(split|lap)\d+$/i.test(k))
      .sort((a, b) => extractTrailingNumber(a) - extractTrailingNumber(b));

    if (numberedKeys.length) {
      const values = numberedKeys.map(k => resultDto[k]);
      const parsed = normalizeSplitsArray(values);
      if (parsed.length) return parsed;
    }

    const possibleObjects = [
      resultDto.splitData,
      resultDto.SplitData,
      resultDto.laps,
      resultDto.Laps
    ];

    for (const obj of possibleObjects) {
      const parsed = parseSplitsCandidate(obj);
      if (parsed.length) return parsed;
    }

    return [];
  }

  function parseSplitsCandidate(candidate) {
    if (candidate == null) return [];

    if (Array.isArray(candidate)) {
      return normalizeSplitsArray(candidate);
    }

    if (typeof candidate === "number") {
      return Number.isFinite(candidate) ? [candidate] : [];
    }

    if (typeof candidate === "string") {
      const s = candidate.trim();
      if (!s) return [];

      if (
        (s.startsWith("[") && s.endsWith("]")) ||
        (s.startsWith("{") && s.endsWith("}"))
      ) {
        try {
          const parsed = JSON.parse(s);
          const arr = parseSplitsCandidate(parsed);
          if (arr.length) return arr;
        } catch { /* noop */ }
      }

      if (/[;|\n]/.test(s)) {
        const parts = s.split(/[;|\n]+/).map(x => x.trim()).filter(Boolean);
        const arr = normalizeSplitsArray(parts);
        if (arr.length) return arr;
      }

      if (/^\s*[\d:.]+\s*(,\s*[\d:.]+\s*){1,}$/.test(s.replace(/\s+/g, " "))) {
        const parts = s.split(",").map(x => x.trim()).filter(Boolean);
        const arr = normalizeSplitsArray(parts);
        if (arr.length) return arr;
      }

      return [];
    }

    if (typeof candidate === "object") {
      if (Array.isArray(candidate.values)) return normalizeSplitsArray(candidate.values);
      if (Array.isArray(candidate.items)) return normalizeSplitsArray(candidate.items);
      if (Array.isArray(candidate.data)) return normalizeSplitsArray(candidate.data);

      const keys = Object.keys(candidate)
        .filter(k => /^(split|lap|s|l)\d+$/i.test(k))
        .sort((a, b) => extractTrailingNumber(a) - extractTrailingNumber(b));

      if (keys.length) {
        return normalizeSplitsArray(keys.map(k => candidate[k]));
      }

      return [];
    }

    return [];
  }

  function normalizeSplitsArray(arr) {
    if (!Array.isArray(arr)) return [];

    const out = [];

    for (const item of arr) {
      if (item == null || item === "") continue;

      if (typeof item === "number") {
        if (Number.isFinite(item)) out.push(item);
        continue;
      }

      if (typeof item === "string") {
        const t = item.trim();
        if (!t) continue;

        const sec = parseTimeToSeconds(t);
        if (Number.isFinite(sec)) out.push(sec);
        else out.push(t);
        continue;
      }

      if (typeof item === "object") {
        const val =
          item.valueTime ?? item.ValueTime ??
          item.time ?? item.Time ??
          item.value ?? item.Value ??
          item.split ?? item.Split;

        if (val != null) {
          const parsedSingle = normalizeSplitsArray([val]);
          if (parsedSingle.length) out.push(parsedSingle[0]);
        }
      }
    }

    return out;
  }

  function extractTrailingNumber(key) {
    const m = String(key).match(/(\d+)(?!.*\d)/);
    return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
  }

  function formatSplitsForTooltip(splits) {
    if (!Array.isArray(splits) || !splits.length) return "";

    return splits
      .map((v, i) => {
        if (v && typeof v === "object") {
          const dist = Number(v.distance ?? v.Distance ?? 0);
          const timeVal = Number(v.valueTime ?? v.ValueTime ?? NaN);

          if (Number.isFinite(timeVal)) {
            const label = dist > 0 ? `${dist}м` : `S${i + 1}`;
            return `${label}:${formatTimeSecondsCompact(timeVal)}`;
          }
        }

        if (typeof v === "number" && Number.isFinite(v)) {
          return `S${i + 1}:${formatTimeSecondsCompact(v)}`;
        }

        return `S${i + 1}:${String(v)}`;
      })
      .join(" | ");
  }
})();