// === Конфиг ===
const API = (() => {
  const stored = localStorage.getItem("apiBaseUrl");
  if (stored) return stored.replace(/\/+$/, "");

  // ако отваряш като file:// или от localhost → backend е локалният
  if (
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.protocol === "file:"
  ) {
    return "https://localhost:7198";
  }

  // иначе – production API
  return "https://sportstatsapi.azurewebsites.net";
})();
console.debug("[Groups API]", API);

// === Кратки помощни ===
const $ = (s) => document.querySelector(s);
const show = (el) => el && (el.hidden = false);
const hide = (el) => el && (el.hidden = true);

function getUserFromLS() {
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function getRole(user) {
  const val =
    user?.roleID ?? user?.RoleID ?? user?.roleId ?? user?.RoleId ?? 0;
  const n =
    typeof val === "string" ? parseInt(val.trim(), 10) : Number(val);
  return Number.isFinite(n) ? n : 0;
}
function requesterHeaders() {
  const u = getUserFromLS();
  if (!u) return {};
  const id = Number(u.id ?? u.Id ?? 0);
  return id > 0 ? { "Requester-Id": String(id) } : {};
}
async function fetchJson(url, opt = {}) {
  const res = await fetch(url, {
    ...opt,
    headers: {
      Accept: "application/json",
      ...(opt.headers || {}),
      ...requesterHeaders()
    }
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => res.statusText);
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : {};
}
async function fetchJsonWith404Fallback(paths, opt = {}) {
  let lastErr;
  for (const p of paths) {
    try {
      return await fetchJson(p, opt);
    } catch (e) {
      lastErr = e;
      if (!String(e?.message || "").startsWith("HTTP 404")) throw e;
    }
  }
  throw lastErr || new Error("All paths failed");
}
function showErr(msg) {
  if (!errBox) {
    alert(msg);
    return;
  }
  errBox.textContent = msg;
  show(errBox);
  clearTimeout(showErr._t);
  showErr._t = setTimeout(() => hide(errBox), 5000);
}

// === UI refs ===
const roleHint = $("#role-hint");
const authHint = $("#auth-hint");
const btnOpen = $("#btn-open-create-group");
const dlg = $("#dlg-create-group");
const form = $("#form-create-group");
const nameInput = $("#cg-name");
const fileInput = $("#cg-photo");
const prevBox = $("#cg-preview");
const prevImg = $("#cg-preview-img");
const prevClr = $("#cg-preview-clear");
const gridEl = $("#cg-member-grid");
const searchEl = $("#cg-search");
const errBox = $("#cg-err");
const btnCreate = $("#cg-create");
const btnCancel = $("#cg-cancel");

// контейнер за групите
const listBox = document.getElementById("my-chats");
const listEmpty = document.getElementById("empty-chats");

// контроли за навигация/сортиране
const chatSearchEl = $("#chat-search");
const chatSortEl = $("#chat-sort");
const chatUnreadOnlyEl = $("#chat-unread-only");

// чипове
const chipsWrap = document.getElementById("cg-selected-chips");
const selMeta = document.getElementById("cg-selected-meta");

let USER = null;
let CLUB_USERS = [];
let SELECTED_IDS = new Set();
let CHATS = [];

// ===== Аватар генератор (инициали + плавен градиент) =====
function initials(text) {
  const parts = String(text || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || "");
  return parts.join("") || "G";
}
function hashColor(seed) {
  let h = 0;
  const s = String(seed || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const h1 = h % 360;
  const h2 = (h1 + 35) % 360;
  return [`hsl(${h1} 80% 72%)`, `hsl(${h2} 82% 64%)`];
}
function groupAvatarDataURL(name, cacheKey = "") {
  const [c1, c2] = hashColor(name + cacheKey);
  const text = initials(name);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'>
      <defs><linearGradient id='g' x1='0' x2='1' y1='0' y2='1'>
        <stop offset='0%' stop-color='${c1}'/><stop offset='100%' stop-color='${c2}'/>
      </linearGradient></defs>
      <rect rx='22' ry='22' width='96' height='96' fill='url(#g)'/>
      <text x='50%' y='55%' dominant-baseline='middle' text-anchor='middle'
        font-family='system-ui,Segoe UI,Roboto,Arial' font-weight='800' font-size='38' fill='rgba(0,0,0,.62)'>${text}</text>
      <text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle'
        font-family='system-ui,Segoe UI,Roboto,Arial' font-weight='800' font-size='38' fill='white'>${text}</text>
    </svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

// ===== Профилни снимки за потребители (картите за избор) =====
// за тази страница НЕ дърпаме снимка от API – само SVG с инициали
const avatarCache = new Map();
async function getAvatarUrl(userId, displayName = "") {
  if (avatarCache.has(userId)) return avatarCache.get(userId);
  const url = groupAvatarDataURL(displayName, String(userId));
  avatarCache.set(userId, url);
  return url;
}

// === Инициализация ===
(async function init() {
  USER = getUserFromLS();
  if (!USER) {
    alert("Влез отново. Липсва потребител в LocalStorage.");
    location.replace("index.html");
    return;
  }

  try {
    $("#meta-user").textContent = `Потребител: ${USER.firstName} ${USER.lastName}`;
  } catch {}

  try {
    const club = await fetchJson(`${API}/api/Clubs/${USER.clubID}`);
    $("#meta-team").textContent = `Отбор: ${club.name || "—"}`;
  } catch {
    $("#meta-team").textContent = "Отбор: —";
  }

  const role = getRole(USER);
  roleHint.textContent =
    role === 2 || role === 3
      ? "Имаш право да създаваш групи (RoleID 2 или 3)."
      : "Нямаш право да създаваш групи (изисква се RoleID 2 или 3).";
  authHint.textContent = "Използва се Requester-Id (без JWT).";

  if (btnOpen) {
    btnOpen.classList.add("fab");
    btnOpen.setAttribute("title", "Създай група");
    btnOpen.setAttribute("aria-label", "Създай група");
    btnOpen.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
    btnOpen.disabled = !(role === 2 || role === 3);
  }

  // събития за търсене/сортиране на групи
  if (chatSearchEl) chatSearchEl.addEventListener("input", renderChats);
  if (chatSortEl) chatSortEl.addEventListener("change", renderChats);
  if (chatUnreadOnlyEl)
    chatUnreadOnlyEl.addEventListener("change", renderChats);

  await safeLoadMyChats();
})();

// === Рендер на изборни карти (име + аватар) ===
function renderMemberGrid(filter = "") {
  if (!gridEl) return;
  gridEl.innerHTML = "";

  const term = filter.trim().toLowerCase();
  const list = CLUB_USERS.filter((u) => {
    if (!term) return true;
    const full = `${u.firstName || u.FirstName || ""} ${
      u.lastName || u.LastName || ""
    }`.toLowerCase();
    return full.includes(term);
  });

  for (const u of list) {
    const id = Number(u.id ?? u.Id);
    const name =
      `${u.firstName || u.FirstName || ""} ${
        u.lastName || u.LastName || ""
      }`.trim() || `ID ${id}`;
    const card = document.createElement("div");
    card.className =
      "member-card" + (SELECTED_IDS.has(id) ? " selected" : "");
    card.dataset.uid = String(id);

    const img = document.createElement("img");
    getAvatarUrl(id, name).then((url) => {
      img.src = url;
    });

    const nm = document.createElement("div");
    nm.className = "mc-name";
    nm.textContent = name;

    const check = document.createElement("div");
    check.className = "mc-check";
    check.textContent = SELECTED_IDS.has(id) ? "✓" : "";

    card.append(img, nm, check);
    card.addEventListener("click", () => {
      if (SELECTED_IDS.has(id)) SELECTED_IDS.delete(id);
      else SELECTED_IDS.add(id);
      card.classList.toggle("selected", SELECTED_IDS.has(id));
      check.textContent = SELECTED_IDS.has(id) ? "✓" : "";
      renderSelectedChips();
    });

    gridEl.append(card);
  }
  renderSelectedChips();
}
function renderSelectedChips() {
  if (!chipsWrap || !selMeta) return;
  chipsWrap.innerHTML = "";
  const ids = [...SELECTED_IDS];
  if (ids.length === 0) {
    selMeta.textContent = "Няма избрани участници.";
    return;
  }
  selMeta.textContent = `Избрани: ${ids.length}`;

  const map = new Map();
  for (const u of CLUB_USERS) {
    map.set(Number(u.id ?? u.Id), u);
  }

  for (const id of ids) {
    const u = map.get(id);
    const name = u
      ? `${u.firstName || u.FirstName || ""} ${
          u.lastName || u.LastName || ""
        }`.trim() || `ID ${id}`
      : `ID ${id}`;
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `${name} <button title="Премахни" aria-label="Премахни">×</button>`;
    chip
      .querySelector("button")
      .addEventListener("click", () => {
        SELECTED_IDS.delete(id);
        renderMemberGrid($("#cg-search")?.value || "");
      });
    chipsWrap.appendChild(chip);
  }
}

async function loadClubUsers() {
  const clubId = USER.clubID ?? USER.ClubID;
  const list = await fetchJsonWith404Fallback(
    [
      `${API}/api/Users/club/${clubId}`,
      `${API}/api/Users/club/${clubId}` // fallback, ако промениш маршрута
    ],
    { cache: "no-store" }
  );

  CLUB_USERS = (Array.isArray(list) ? list : [])
    .filter((u) => {
      const id = Number(u.id ?? u.Id);
      if (id === Number(USER.id ?? USER.Id)) return false;
      const active = (u.isActive ?? u.IsActive ?? true) === true;
      const status = Number(u.statusID ?? u.StatusID ?? 0);
      const clubId2 = Number(u.clubID ?? u.ClubID);
      return (
        active &&
        status !== 1 &&
        status !== 3 &&
        clubId2 === Number(USER.clubID ?? USER.ClubID)
      );
    })
    .sort((a, b) => {
      const an = `${a.firstName || a.FirstName || ""} ${
        a.lastName || a.LastName || ""
      }`.toLowerCase();
      const bn = `${b.firstName || b.FirstName || ""} ${
        b.lastName || b.LastName || ""
      }`.toLowerCase();
      return an.localeCompare(bn, "bg");
    });

  renderMemberGrid("");
}

// търсене/бутончета за избор на членове
if (searchEl)
  searchEl.addEventListener("input", (e) =>
    renderMemberGrid(e.target.value)
  );
const btnSelAll = $("#cg-select-all");
const btnClrAll = $("#cg-clear-all");
if (btnSelAll)
  btnSelAll.addEventListener("click", () => {
    CLUB_USERS.forEach((u) =>
      SELECTED_IDS.add(Number(u.id ?? u.Id))
    );
    renderMemberGrid($("#cg-search")?.value || "");
  });
if (btnClrAll)
  btnClrAll.addEventListener("click", () => {
    SELECTED_IDS.clear();
    renderMemberGrid($("#cg-search")?.value || "");
  });

// ===== Моите групи =====
async function loadMyChats() {
  if (!listBox) return;
  listBox.innerHTML = "";

  try {
    const rows = await fetchJson(`${API}/api/Chats/mine`, {
      cache: "no-store"
    });

    CHATS = (Array.isArray(rows) ? rows : []).map((r) => {
      const id = r.Id ?? r.id;
      const name = r.Name || r.name || `Чат #${id}`;
      const lastMsg = r.LastMessage || r.lastMessage || "";
      const timeRaw = r.LastActivityAt || r.lastActivityAt || "";
      const unread = Number(r.UnreadCount ?? r.unreadCount ?? 0);
      const photoUrlRaw = r.PhotoUrl || r.photoUrl || "";
      const photoUpdatedAt = r.PhotoUpdatedAt || r.photoUpdatedAt || "";

      return {
        id,
        name,
        lastMsg,
        timeRaw,
        lastActivity: timeRaw ? new Date(timeRaw) : null,
        unread,
        photoUrlRaw,
        photoUpdatedAt
      };
    });

    renderChats();
  } catch (e) {
    if (listEmpty) {
      listEmpty.textContent = "Проблем при зареждане на групите.";
      show(listEmpty);
    }
    console.warn("Неуспешно зареждане на моите групи:", e?.message || e);
  }
}

function renderChats() {
  if (!listBox) return;
  listBox.innerHTML = "";

  const searchTerm = (chatSearchEl?.value || "").trim().toLowerCase();
  const sortBy = chatSortEl?.value || "activity";
  const unreadOnly = !!chatUnreadOnlyEl?.checked;

  let list = [...CHATS];

  if (searchTerm) {
    list = list.filter((c) =>
      c.name.toLowerCase().includes(searchTerm)
    );
  }

  if (unreadOnly) {
    list = list.filter((c) => c.unread > 0);
  }

  if (sortBy === "name") {
    list.sort((a, b) => a.name.localeCompare(b.name, "bg"));
  } else {
    // activity (по последна активност, най-новите горе)
    list.sort((a, b) => {
      const at = a.lastActivity ? a.lastActivity.getTime() : 0;
      const bt = b.lastActivity ? b.lastActivity.getTime() : 0;
      return bt - at;
    });
  }

  if (!list.length) {
    if (listEmpty) {
      listEmpty.textContent = "Нямаш групи по избраните филтри.";
      show(listEmpty);
    }
    return;
  }
  if (listEmpty) hide(listEmpty);

  for (const c of list) {
    const item = document.createElement("div");
    item.className = "chat-item";

    // снимка/аватар
    const photoUrl = c.photoUrlRaw
      ? `${c.photoUrlRaw}${
          c.photoUrlRaw.includes("?") ? "&" : "?"
        }v=${encodeURIComponent(c.photoUpdatedAt || "")}`
      : groupAvatarDataURL(c.name, String(c.id));

    const img = document.createElement("img");
    img.className = "chat-photo";
    img.alt = c.name;
    img.src = photoUrl;

    const body = document.createElement("div");
    body.className = "chat-body";

    const title = document.createElement("div");
    title.className = "chat-title";
    title.textContent = c.name;

    const sub = document.createElement("div");
    sub.className = "chat-sub";

    const timePart = c.lastActivity
      ? new Date(c.lastActivity).toLocaleString("bg-BG", {
          hour12: false
        })
      : "";
    sub.textContent = `${c.lastMsg ? c.lastMsg : "—"}${
      timePart ? " · " + timePart : ""
    }`;

    body.append(title, sub);
    item.append(img, body);

    if (c.unread > 0) {
      const b = document.createElement("span");
      b.className = "badge";
      b.textContent = `${c.unread} нови`;
      item.append(b);
    }

    const actions = document.createElement("div");
    actions.className = "row-actions";
    const open = document.createElement("a");
    open.className = "btn small";
    open.textContent = "Отвори";
    open.href = `GroupChat.html?chatId=${encodeURIComponent(c.id)}`;
    actions.append(open);
    item.append(actions);

    // цял ред кликаем
    item.addEventListener("click", (ev) => {
      if (ev.target === open) return;
      open.click();
    });

    listBox.append(item);
  }
}

async function safeLoadMyChats() {
  try {
    await loadMyChats();
  } catch {}
}

// === преглед снимка при създаване ===
if (fileInput) {
  fileInput.addEventListener("change", () => {
    const f = fileInput.files?.[0];
    if (!f) {
      if (prevImg) prevImg.src = "";
      hide(prevBox);
      return;
    }
    if (prevImg) prevImg.src = URL.createObjectURL(f);
    show(prevBox);
  });
}
if (prevClr) {
  prevClr.addEventListener("click", () => {
    if (fileInput) fileInput.value = "";
    if (prevImg) prevImg.src = "";
    hide(prevBox);
  });
}

// === отваряне модал ===
const btnOpenRef = $("#btn-open-create-group");
if (btnOpenRef) {
  btnOpenRef.addEventListener("click", async () => {
    const role = getRole(USER);
    if (role !== 2 && role !== 3) {
      alert("Нямаш право да създаваш групи (RoleID 2 или 3).");
      return;
    }

    hide(errBox);
    if (nameInput) nameInput.value = "";
    if (fileInput) fileInput.value = "";
    if (prevImg) prevImg.src = "";
    hide(prevBox);
    if (searchEl) searchEl.value = "";
    SELECTED_IDS.clear();
    renderSelectedChips();

    try {
      await loadClubUsers();
    } catch (e) {
      console.error(e);
      showErr("Проблем при зареждане на потребителите от клуба.");
      return;
    }

    if (dlg) {
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    }
    if (nameInput) nameInput.focus();
  });
}

// === отказ модал ===
if (btnCancel) {
  btnCancel.addEventListener("click", (e) => {
    e.preventDefault();
    if (dlg?.open) dlg.close();
  });
}

// === създаване група (Requester-Id header) ===
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hide(errBox);

    const name = (nameInput?.value || "").trim();
    if (!name) {
      showErr("Въведи име на групата.");
      return;
    }

    const selectedIds = [...SELECTED_IDS];
    if (selectedIds.length === 0) {
      showErr("Избери поне един участник.");
      return;
    }

    btnCreate && (btnCreate.disabled = true);
    try {
      const payload = { name, memberUserIds: selectedIds };
      const res = await fetch(`${API}/api/Chats`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...requesterHeaders()
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const { chatId } = await res.json();

      const photo = fileInput?.files?.[0];
      if (photo) {
        const fd = new FormData();
        fd.append("file", photo);
        try {
          const up = await fetch(`${API}/api/Chats/${chatId}/photo`, {
            method: "POST",
            body: fd,
            headers: {
              ...requesterHeaders()
            }
          });
          if (!up.ok && up.status !== 501) {
            console.warn(
              "Качване на снимка неуспешно:",
              up.status,
              await up.text().catch(() => "")
            );
          }
        } catch (e2) {
          console.warn("Грешка при качване на снимка:", e2);
        }
      }

      alert("Групата е създадена успешно.");
      if (dlg?.open) dlg.close();
      await safeLoadMyChats();
    } catch (err) {
      console.error(err);
      showErr("Неуспешно създаване: " + err.message);
    } finally {
      btnCreate && (btnCreate.disabled = false);
    }
  });
}
