// HomePageCoachCreateAthlete.js
(() => {
  "use strict";

  const API_BASE = resolveApiBase();

  document.addEventListener("DOMContentLoaded", () => {
    initCoachCreateAthleteModule().catch((err) => {
      console.error("Init coach create athlete module error:", err);
    });
  });

  async function initCoachCreateAthleteModule() {
    // Create athlete UI
    const openBtn = document.getElementById("coach-open-create-athlete-btn");
    const closeBtn = document.getElementById("coach-close-create-athlete-btn");
    const panel = document.getElementById("coach-create-athlete-inline-panel");

    const form = document.getElementById("coach-create-athlete-form");
    const submitBtn = document.getElementById("coach-create-athlete-btn");
    const statusEl = document.getElementById("coach-create-athlete-status");

    const resultBox = document.getElementById("coach-create-athlete-result");
    const copyBtn = document.getElementById("copy-created-athlete-code-btn");

    // Access codes UI (new)
    const openCodesBtn = document.getElementById("coach-open-access-codes-btn");
    const closeCodesBtn = document.getElementById("coach-close-access-codes-btn");
    const refreshCodesBtn = document.getElementById("coach-refresh-access-codes-btn");
    const codesPanel = document.getElementById("coach-access-codes-panel");
    const codesStatusEl = document.getElementById("coach-access-codes-status");
    const codesTable = document.getElementById("coach-access-codes-table");
    const codesTbody = codesTable?.querySelector("tbody");

    if (!openBtn || !closeBtn || !panel || !form || !submitBtn || !statusEl || !resultBox || !copyBtn) {
      return;
    }

    // По подразбиране скрито
    openBtn.classList.add("hidden");
    panel.classList.add("hidden");

    if (openCodesBtn) openCodesBtn.classList.add("hidden");
    if (codesPanel) codesPanel.classList.add("hidden");

    // user от localStorage -> fallback /me
    const currentUser = await getCurrentUserSafe();
    const roleId = getRoleId(currentUser);

    // Само coach/admin
    if (!isCoachOrAdmin(roleId)) {
      openBtn.classList.add("hidden");
      panel.classList.add("hidden");
      if (openCodesBtn) openCodesBtn.classList.add("hidden");
      if (codesPanel) codesPanel.classList.add("hidden");
      return;
    }

    openBtn.classList.remove("hidden");
    if (openCodesBtn) openCodesBtn.classList.remove("hidden");

    // ===== Create athlete panel toggle =====
    openBtn.addEventListener("click", () => {
      const isHidden = panel.classList.contains("hidden");
      if (isHidden) {
        openCreatePanel(panel, openBtn);
      } else {
        closeCreatePanel(panel, openBtn, false);
      }
    });

    closeBtn.addEventListener("click", () => {
      closeCreatePanel(panel, openBtn, false);
    });

    // ===== Access codes panel toggle =====
    if (openCodesBtn && codesPanel && codesStatusEl && codesTbody) {
      openCodesBtn.addEventListener("click", async () => {
        const isHidden = codesPanel.classList.contains("hidden");

        if (isHidden) {
          codesPanel.classList.remove("hidden");
          openCodesBtn.setAttribute("aria-expanded", "true");
          openCodesBtn.textContent = "Скрий кодовете за достъп";

          await loadCoachAccessCodes({
            codesStatusEl,
            codesTbody,
            refreshBtn: refreshCodesBtn
          });
        } else {
          codesPanel.classList.add("hidden");
          openCodesBtn.setAttribute("aria-expanded", "false");
          openCodesBtn.textContent = "Преглед на кодове за достъп";
        }
      });

      closeCodesBtn?.addEventListener("click", () => {
        codesPanel.classList.add("hidden");
        openCodesBtn.setAttribute("aria-expanded", "false");
        openCodesBtn.textContent = "Преглед на кодове за достъп";
      });

      refreshCodesBtn?.addEventListener("click", async () => {
        await loadCoachAccessCodes({
          codesStatusEl,
          codesTbody,
          refreshBtn: refreshCodesBtn
        });
      });

      // event delegation за copy бутоните в таблицата
      codesTbody.addEventListener("click", async (e) => {
        const btn = e.target.closest("[data-copy-access-code]");
        if (!btn) return;

        const code = (btn.getAttribute("data-copy-access-code") || "").trim();
        if (!code) {
          setCodesStatus(codesStatusEl, "Няма активен код за копиране.", "error");
          return;
        }

        try {
          await copyText(code);
          setCodesStatus(codesStatusEl, "Кодът е копиран.", "success");
        } catch {
          setCodesStatus(codesStatusEl, "Неуспешно копиране. Копирай ръчно.", "error");
        }
      });
    }

    // ===== Submit create athlete =====
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const firstNameEl = document.getElementById("coach-athlete-first-name");
      const lastNameEl = document.getElementById("coach-athlete-last-name");
      const yearEl = document.getElementById("coach-athlete-year");
      const genderEl = document.getElementById("coach-athlete-gender");

      const firstName = (firstNameEl?.value || "").trim();
      const lastName = (lastNameEl?.value || "").trim();
      const yearOfBirthRaw = (yearEl?.value || "").trim();
      const yearOfBirth = Number(yearOfBirthRaw);
      const gender = normalizeGender((genderEl?.value || "M").trim());

      const validationError = validateInput({ firstName, lastName, yearOfBirth, gender });
      if (validationError) {
        setStatus(statusEl, validationError, "error");
        return;
      }

      setLoading(submitBtn, true);
      setStatus(statusEl, "Създаване на профил...", "info");

      try {
        const response = await fetch(`${API_BASE}/coach/create-athlete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify({
            FirstName: firstName,
            LastName: lastName,
            YearOfBirth: yearOfBirth,
            Gender: gender // M/F
          })
        });

        const text = await response.text();
        const data = tryParseJson(text);

        if (!response.ok) {
          throw buildHttpError(response, data, text, "Неуспешно създаване на профил.");
        }

        const athlete =
          data?.athlete ||
          data?.Athlete ||
          data?.user ||
          data?.User ||
          data?.createdUser ||
          data?.CreatedUser ||
          null;

        const accessCode =
          data?.accessCode ||
          data?.AccessCode ||
          data?.code ||
          data?.Code ||
          data?.generatedCode ||
          data?.GeneratedCode ||
          data?.loginCode ||
          data?.LoginCode ||
          "";

        renderCreatedAthleteResult({
          athlete,
          accessCode,
          fallback: { firstName, lastName, yearOfBirth }
        });

        setStatus(statusEl, "Профилът е създаден успешно.", "success");

        appendAthleteToCoachFilter(athlete, { firstName, lastName, yearOfBirth });

        form.reset();
        if (genderEl) genderEl.value = "M";

        // Ако панелът с кодове е отворен -> refresh
        if (codesPanel && !codesPanel.classList.contains("hidden") && codesStatusEl && codesTbody) {
          await loadCoachAccessCodes({
            codesStatusEl,
            codesTbody,
            refreshBtn: refreshCodesBtn,
            silent: true
          });
          setCodesStatus(codesStatusEl, "Списъкът с кодове е обновен.", "success");
        }

        window.dispatchEvent(
          new CustomEvent("coach-athlete-created", {
            detail: {
              athlete,
              accessCode,
              createdAt: new Date().toISOString()
            }
          })
        );
      } catch (err) {
        console.error("Coach create athlete error:", err);

        let msg = err?.message || "Грешка при създаване на профил.";
        if (err instanceof TypeError) {
          msg = "Няма връзка с API. Провери backend URL, CORS и дали API-то е стартирано.";
        }

        setStatus(statusEl, msg, "error");
      } finally {
        setLoading(submitBtn, false);
      }
    });

    // Copy code from create result
    copyBtn.addEventListener("click", async () => {
      const codeEl = document.getElementById("created-athlete-code");
      const code = (codeEl?.textContent || "").trim();

      if (!code || code === "—" || code.includes("Няма върнат код")) {
        setStatus(statusEl, "Няма валиден код за копиране.", "error");
        return;
      }

      try {
        await copyText(code);
        setStatus(statusEl, "Кодът е копиран.", "success");
      } catch (err) {
        console.warn("Copy failed:", err);
        setStatus(statusEl, "Неуспешно копиране. Копирай ръчно кода.", "error");
      }
    });
  }

  // =========================
  // Access codes table
  // =========================
  async function loadCoachAccessCodes({ codesStatusEl, codesTbody, refreshBtn, silent = false }) {
    if (!codesTbody) return;

    setButtonLoading(refreshBtn, true, "Обновяване...");

    if (!silent) {
      setCodesStatus(codesStatusEl, "Зареждане на кодовете...", "info");
    }

    renderCodesLoading(codesTbody);

    try {
      const res = await fetch(`${API_BASE}/coach/access-codes`, {
        method: "GET",
        credentials: "include"
      });

      const text = await res.text();
      const data = tryParseJson(text);

      if (!res.ok) {
        console.warn("coach/access-codes failed", {
          status: res.status,
          statusText: res.statusText,
          body: text
        });
        throw buildHttpError(res, data, text, "Неуспешно зареждане на кодовете.");
      }

      const items = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.rows)
            ? data.rows
            : [];

      renderAccessCodesRows(codesTbody, items);

      const activeCodesCount = items.filter((x) => {
        const code = String(x?.accessCode ?? x?.AccessCode ?? "").trim();
        return !!code;
      }).length;

      setCodesStatus(
        codesStatusEl,
        `Заредени ${items.length} атлета. Активни кодове: ${activeCodesCount}.`,
        "success"
      );
    } catch (err) {
      console.error("Load coach access codes error:", err);

      let msg = err?.message || "Грешка при зареждане на кодовете.";
      if (err instanceof TypeError) {
        msg = "Няма връзка с API. Провери backend URL, CORS и дали API-то е стартирано.";
      }

      renderCodesError(codesTbody, msg);
      setCodesStatus(codesStatusEl, msg, "error");
    } finally {
      setButtonLoading(refreshBtn, false);
    }
  }

  function renderCodesLoading(tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="coach-empty">Зареждане...</td>
      </tr>
    `;
  }

  function renderCodesError(tbody, message) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="coach-empty">${escapeHtml(message || "Грешка.")}</td>
      </tr>
    `;
  }

  function renderAccessCodesRows(tbody, items) {
    tbody.innerHTML = "";

    if (!Array.isArray(items) || items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="coach-empty">Няма атлети за показване.</td>
        </tr>
      `;
      return;
    }

    for (const item of items) {
      const id = item?.id ?? item?.Id ?? "";
      const firstName = item?.firstName ?? item?.FirstName ?? "";
      const lastName = item?.lastName ?? item?.LastName ?? "";
      const year = item?.yearOfBirth ?? item?.YearOfBirth ?? "—";
      const profileImageRaw = item?.profileImageUrl ?? item?.ProfileImageUrl ?? item?.profileImage_url ?? "";
      const accessCode = String(item?.accessCode ?? item?.AccessCode ?? "").trim();
      const mustSetCredentials = Boolean(item?.mustSetCredentials ?? item?.MustSetCredentials);

      const tr = document.createElement("tr");

      // Снимка
      const tdImg = document.createElement("td");
      const img = document.createElement("img");
      img.alt = `${firstName} ${lastName}`.trim() || "Athlete";
      img.loading = "lazy";
      img.width = 44;
      img.height = 44;
      img.style.width = "44px";
      img.style.height = "44px";
      img.style.objectFit = "cover";
      img.style.borderRadius = "50%";
      img.style.border = "1px solid rgba(255,255,255,.15)";
      img.src = resolveAthleteImageUrl(profileImageRaw);
      img.onerror = () => {
        img.onerror = null;
        img.src = "https://sportstats.blob.core.windows.net/$web/ProfilePhoto2.jpg";
      };
      tdImg.appendChild(img);

      // Име
      const tdName = document.createElement("td");
      tdName.textContent = `${firstName} ${lastName}`.trim() || `Атлет #${id}`;

      // Година
      const tdYear = document.createElement("td");
      tdYear.textContent = String(year || "—");

      // Код
      const tdCode = document.createElement("td");
      const codeEl = document.createElement("code");
      codeEl.className = "coach-access-code";
      codeEl.style.userSelect = "all";
      codeEl.style.whiteSpace = "nowrap";

      if (accessCode) {
        codeEl.textContent = accessCode;
      } else {
        codeEl.textContent = mustSetCredentials ? "—" : "Профилът е активиран (кодът е изтрит)";
      }
      tdCode.appendChild(codeEl);

      // Copy button
      const tdCopy = document.createElement("td");
      const rowCopyBtn = document.createElement("button");
      rowCopyBtn.type = "button";
      rowCopyBtn.className = "coach-btn ghost";
      rowCopyBtn.textContent = "Копирай";

      if (accessCode) {
        rowCopyBtn.setAttribute("data-copy-access-code", accessCode);
      } else {
        rowCopyBtn.disabled = true;
        rowCopyBtn.textContent = "—";
      }

      tdCopy.appendChild(rowCopyBtn);

      tr.appendChild(tdImg);
      tr.appendChild(tdName);
      tr.appendChild(tdYear);
      tr.appendChild(tdCode);
      tr.appendChild(tdCopy);

      tbody.appendChild(tr);
    }
  }

  function setCodesStatus(el, message, state = "info") {
    if (!el) return;
    el.textContent = message || "";
    el.dataset.state = state;
  }

  function setButtonLoading(btn, isLoading, loadingText = "Зареждане...") {
    if (!btn) return;
    btn.disabled = isLoading;

    if (!btn.dataset.originalText) {
      btn.dataset.originalText = btn.textContent || "";
    }
    btn.textContent = isLoading ? loadingText : btn.dataset.originalText;
  }

  // =========================
  // Helpers
  // =========================
  function resolveApiBase() {
    // Ако искаш ръчно:
    // window.SPORTSTATS_API_BASE = "https://localhost:7198/api/Users";
    const fromWindow = (window.SPORTSTATS_API_BASE || "").trim();
    if (fromWindow) return fromWindow.replace(/\/+$/, "");

    const sameOriginLikelyApi =
      location.hostname === "localhost" &&
      (location.port === "7198" || location.port === "7199");

    if (sameOriginLikelyApi) {
      return "/api/Users";
    }

    return "https://localhost:7198/api/Users";
  }

  function resolveAthleteImageUrl(rawUrl) {
    const value = (rawUrl || "").trim();

    if (!value) {
      return "https://sportstats.blob.core.windows.net/$web/ProfilePhoto2.jpg";
    }

    if (/^https?:\/\//i.test(value)) {
      return value;
    }

    try {
      const apiOrigin = new URL(API_BASE, window.location.origin).origin;
      return new URL(value, apiOrigin).toString();
    } catch {
      return value;
    }
  }

  function normalizeGender(gender) {
    const g = (gender || "").trim();
    if (g.toLowerCase() === "male") return "M";
    if (g.toLowerCase() === "female") return "F";
    return g;
  }

  function openCreatePanel(panel, openBtn) {
    panel.classList.remove("hidden");
    openBtn.setAttribute("aria-expanded", "true");
    openBtn.textContent = "− Скрий формата";

    const firstInput = document.getElementById("coach-athlete-first-name");
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 60);
    }
  }

  function closeCreatePanel(panel, openBtn, resetResult = false) {
    panel.classList.add("hidden");
    openBtn.setAttribute("aria-expanded", "false");
    openBtn.textContent = "+ Добави състезател";

    if (resetResult) {
      const resultBox = document.getElementById("coach-create-athlete-result");
      if (resultBox) {
        resultBox.classList.remove("show");
      }
    }
  }

  function validateInput({ firstName, lastName, yearOfBirth, gender }) {
    if (!firstName) return "Въведи име.";
    if (!lastName) return "Въведи фамилия.";

    if (firstName.length < 2) return "Името е твърде кратко.";
    if (lastName.length < 2) return "Фамилията е твърде кратка.";

    const namePattern = /^[\p{L}\s\-']+$/u;
    if (!namePattern.test(firstName)) return "Името съдържа невалидни символи.";
    if (!namePattern.test(lastName)) return "Фамилията съдържа невалидни символи.";

    const currentYear = new Date().getFullYear();
    if (!Number.isInteger(yearOfBirth)) return "Въведи валидна година на раждане.";
    if (yearOfBirth < 1900 || yearOfBirth > currentYear) {
      return `Годината трябва да е между 1900 и ${currentYear}.`;
    }

    if (!["M", "F"].includes(gender)) return "Невалиден пол.";

    return null;
  }

  function renderCreatedAthleteResult({ athlete, accessCode, fallback }) {
    const resultBox = document.getElementById("coach-create-athlete-result");
    const nameEl = document.getElementById("created-athlete-name");
    const yearEl = document.getElementById("created-athlete-year");
    const codeEl = document.getElementById("created-athlete-code");

    if (!resultBox || !nameEl || !yearEl || !codeEl) return;

    const firstName = athlete?.firstName || athlete?.FirstName || fallback?.firstName || "—";
    const lastName = athlete?.lastName || athlete?.LastName || fallback?.lastName || "—";
    const yearOfBirth =
      athlete?.yearOfBirth ??
      athlete?.YearOfBirth ??
      fallback?.yearOfBirth ??
      "—";

    nameEl.textContent = `${firstName} ${lastName}`.trim();
    yearEl.textContent = String(yearOfBirth);
    codeEl.textContent = accessCode || "Няма върнат код (провери response-а от API)";

    resultBox.classList.add("show");
  }

  function appendAthleteToCoachFilter(athlete, fallback) {
    const select = document.getElementById("coach-athlete-filter");
    if (!select) return;

    const athleteId =
      athlete?.id ??
      athlete?.Id ??
      athlete?.userId ??
      athlete?.UserId ??
      null;

    const firstName = athlete?.firstName || athlete?.FirstName || fallback?.firstName || "";
    const lastName = athlete?.lastName || athlete?.LastName || fallback?.lastName || "";
    const yearOfBirth = athlete?.yearOfBirth || athlete?.YearOfBirth || fallback?.yearOfBirth || "";

    const label = `${firstName} ${lastName}${yearOfBirth ? ` (${yearOfBirth})` : ""}`.trim();

    if (!athleteId || !label) return;

    const exists = Array.from(select.options).some((o) => String(o.value) === String(athleteId));
    if (exists) return;

    const option = document.createElement("option");
    option.value = String(athleteId);
    option.textContent = label;
    select.appendChild(option);
  }

  function setStatus(el, message, type = "info") {
    if (!el) return;
    el.textContent = message || "";
    el.dataset.state = type;
  }

  function setLoading(button, isLoading) {
    if (!button) return;

    button.disabled = isLoading;

    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent || "Създай профил";
    }

    button.textContent = isLoading ? "Създаване..." : button.dataset.originalText;
  }

  function isCoachOrAdmin(roleId) {
    return Number(roleId) === 2 || Number(roleId) === 3;
  }

  async function getCurrentUserSafe() {
    const localUser = getLocalUser();
    if (localUser && getRoleId(localUser) > 0) {
      return localUser;
    }

    try {
      const res = await fetch(`${API_BASE}/me`, {
        method: "GET",
        credentials: "include"
      });

      if (!res.ok) return null;

      const data = await res.json();
      if (data && (data.Id || data.id || data.RoleID || data.roleID || data.roleId)) {
        return data;
      }

      return null;
    } catch (err) {
      console.warn("Cannot load current user from /me:", err);
      return null;
    }
  }

  function getLocalUser() {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn("Cannot parse localStorage user:", e);
      return null;
    }
  }

  function getRoleId(user) {
    if (!user) return 0;

    return Number(
      user.roleID ??
      user.RoleID ??
      user.roleId ??
      user.RoleId ??

      user.user?.roleID ??
      user.user?.RoleID ??
      user.user?.roleId ??
      user.user?.RoleId ??

      user.session?.roleID ??
      user.session?.RoleID ??
      user.session?.roleId ??
      user.session?.RoleId ??

      user.session?.user?.roleID ??
      user.session?.user?.RoleID ??
      user.session?.user?.roleId ??
      user.session?.user?.RoleId ??

      0
    );
  }

  function tryParseJson(text) {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  function buildHttpError(response, data, text, fallbackMessage) {
    const status = response?.status ?? 0;

    // Приоритет: ясни custom съобщения по status
    let message;
    if (status === 401) {
      message = "401: Нямаш активна сесия. Влез през приложението като треньор/админ.";
    } else if (status === 403) {
      message = "403: Нямаш права за тази операция.";
    } else if (status === 405) {
      message = "405: Грешен API URL (заявката отива към frontend сървъра, не към ASP.NET API).";
    } else {
      const serverMessage =
        (data && (data.message || data.error || data.title || data.detail)) ||
        "";

      const plain = String(text || "").trim();
      const shortPlain =
        plain && plain.length < 220 && !plain.startsWith("<!DOCTYPE")
          ? plain
          : "";

      message =
        serverMessage ||
        shortPlain ||
        `${fallbackMessage} (HTTP ${status || "?"})`;
    }

    return new Error(message);
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();

    const ok = document.execCommand("copy");
    ta.remove();

    if (!ok) throw new Error("Copy failed");
  }
})();