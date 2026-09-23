/* ================= SQLite Storage & Server Sync ================= */
function loadTempChat() {
  try {
    var raw = sessionStorage.getItem(SS_TEMP);
    if (raw) {
      var obj = JSON.parse(raw);
      if (obj && obj.id) {
        tempChat = obj;
        tempActive = true;
      }
    }
  } catch (e) {}
}

function saveTempChat() {
  if (tempChat) {
    try { sessionStorage.setItem(SS_TEMP, JSON.stringify(tempChat)); } catch (e) {}
  }
}

function clearTempChat() {
  tempActive = false;
  tempChat = null;
  try { sessionStorage.removeItem(SS_TEMP); } catch (e) {}
  updateTempUI();
}

function updateTempUI() {
  var badge = $('tb-temp-badge');
  var btn = $('btn-temp-chat');
  if (badge) badge.classList.toggle('hidden', !tempActive);
  if (btn) btn.classList.toggle('active', tempActive);
}

async function loadServerData() {
  try {
    var resP = await fetch('/projects');
    if (resP.ok) {
      var dp = await resP.json();
      projects = dp.projects || [];
    }
  } catch (e) {
    console.warn('Failed to load projects from server:', e);
  }
  try {
    var resC = await fetch('/convs');
    if (resC.ok) {
      var dc = await resC.json();
      chats = dc.chats || dc.conversations || [];
    }
  } catch (e) {
    console.warn('Failed to load chats from server:', e);
  }
}

var _persistTimer = null;
function persistChat(chat) {
  if (tempActive || !chat || !chat.id) return;
  clearTimeout(_persistTimer);
  _persistTimer = setTimeout(function () {
    fetch('/convs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat: chat })
    }).catch(function (err) {
      console.warn('Failed to persist chat:', err);
    });
  }, 300);
}

function serverDeleteChat(id) {
  return fetch('/convs/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: id })
  }).catch(function (e) {});
}

function serverMoveChat(id, projectId) {
  return fetch('/convs/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: id, project_id: projectId || null })
  }).catch(function (e) {});
}

function serverPinChat(id, pinned) {
  return fetch('/convs/pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: id, pinned: !!pinned })
  }).catch(function (e) {});
}

function serverArchiveChat(id, archived) {
  return fetch('/convs/archive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: id, archived: archived !== false })
  }).catch(function (e) {});
}

function serverClearAllConvs() {
  return fetch('/convs/clear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }).catch(function (e) {});
}

/* Compatibility alias */
function saveChats() {
  var cur = currentChatId ? getChat(currentChatId) : null;
  if (cur) persistChat(cur);
}
var accountTrigger = $('account-trigger');
var accountPopover = $('account-popover');

