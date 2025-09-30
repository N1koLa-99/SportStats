// === НАСТРОЙКИ ===
// Смени порта, ако бекендът ти работи на друг
const API_BASE = 'https://localhost:7198';

function getQueryParam(key) {
  const url = new URL(window.location.href);
  return url.searchParams.get(key);
}

// Взимаме teamId от URL или localStorage (по подразбиране 1)
const teamId = Number(getQueryParam('teamId')) || Number(localStorage.getItem('teamId')) || 1;

// Взимаме userId от URL или localStorage, ако липсва → по подразбиране 112
const userId = Number(getQueryParam('userId')) || Number(localStorage.getItem('userId')) || 112;

localStorage.setItem('teamId', String(teamId));
localStorage.setItem('userId', String(userId));

document.getElementById('meta-team').textContent = 'Отбор: ' + teamId;
document.getElementById('meta-user').textContent = 'Потребител: ' + userId;

const $messages = document.getElementById('messages');
const $text = document.getElementById('text');
const $send = document.getElementById('send');
const $err = document.getElementById('err');

function api(path) { return API_BASE + path; }
function fmtDate(d) {
  const date = new Date(d);
  return isNaN(date.getTime()) ? '' : date.toLocaleString();
}
function escapeHTML(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}
function showError(msg) {
  $err.style.display = 'block';
  $err.textContent = msg;
  setTimeout(() => ($err.style.display = 'none'), 5000);
}

// Рендериране на съобщения
function renderMessages(list) {
  $messages.innerHTML = '';
  list.forEach(m => {
    const mine = Number(m.senderId ?? m.SenderId) === userId;
    const wrap = document.createElement('div');
    wrap.className = 'msg' + (mine ? ' mine' : '');

    const head = document.createElement('div');
    head.className = 'head';
    head.textContent = (mine ? 'Аз' : `Потребител #${m.senderId ?? m.SenderId}`) +
                       ' • ' + (fmtDate(m.createdAt ?? m.CreatedAt) || '');
    wrap.appendChild(head);

    if (m.content ?? m.Content) {
      const body = document.createElement('div');
      body.className = 'body';
      body.innerHTML = escapeHTML(m.content ?? m.Content);
      wrap.appendChild(body);
    }

    $messages.appendChild(wrap);
  });
  $messages.scrollTop = $messages.scrollHeight;
}

// Зареждане на съобщения
async function loadMessages() {
  try {
    const res = await fetch(api(`/api/messages/${teamId}`));
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    const data = await res.json();
    renderMessages(data || []);
  } catch (err) {
    console.error("Грешка при зареждане:", err);
    showError("Проблем при зареждане на съобщения.");
  }
}

// Изпращане на съобщение
async function sendMessage() {
  const content = $text.value.trim();
  if (!content) { $text.focus(); return; }
  $send.disabled = true;
  try {
    const body = { TeamId: teamId, SenderId: userId, Content: content }; // PascalCase!
    const res = await fetch(api('/api/messages'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    $text.value = '';
    $text.focus();
    await loadMessages();
  } catch (err) {
    console.error("Грешка при изпращане:", err);
    showError("Неуспешно изпращане: " + err.message);
  } finally {
    $send.disabled = false;
  }
}

$send.addEventListener('click', sendMessage);
$text.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });

// Стартиране
(function init() {
  $text.focus();
  loadMessages();
  setInterval(loadMessages, 3000);
})();