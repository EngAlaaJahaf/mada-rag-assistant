/* ================= New chat / sidebar collapse ================= */
function newChat(projectId) {
  if (streaming) return;
  if (tempActive) {
    clearTempChat();
  }
  var cur = currentChatId ? getChat(currentChatId) : null;
  if (cur && cur.messages.length === 0) {
    cur.mode = currentMode;
    if (projectId !== undefined) cur.project_id = projectId || null;
    updateModePill();
    renderEmpty(true);
    renderSidebar();
    taEl.value = '';
    updateSendDisabled();
    saveActiveChatId(cur.id);
    syncUrlChatId(cur.id);
    try { taEl.focus(); } catch (e) {}
    return;
  }
  var c = makeChat(currentMode, projectId);
  chats.unshift(c);
  currentChatId = c.id;
  saveActiveChatId(c.id);
  syncUrlChatId(c.id);
  updateModePill();
  renderSidebar();
  renderEmpty(true);
  persistChat(c);
  taEl.value = '';
  updateSendDisabled();
  if (window.innerWidth <= 900) closeDrawer();
  else if (body.classList.contains('sb-collapsed')) {
    body.classList.remove('sb-collapsed');
    try { localStorage.setItem(LS_SBAR, '0'); } catch (e) {}
  }
  try { taEl.focus(); } catch (e) {}
}

function toggleCollapse() {
  if (window.innerWidth <= 900) { closeDrawer(); return; }
  var b = !body.classList.contains('sb-collapsed');
  body.classList.toggle('sb-collapsed', b);
  try { localStorage.setItem(LS_SBAR, b ? '1' : '0'); } catch (e) {}
}
function openSidebar() {
  if (window.innerWidth <= 900) { openDrawer(); return; }
  body.classList.remove('sb-collapsed');
  try { localStorage.setItem(LS_SBAR, '0'); } catch (e) {}
}
function closeDrawer() { body.classList.remove('sb-open-m'); }
function openDrawer() { body.classList.add('sb-open-m'); }

/* ================= Copy button (delegated) ================= */
function copyText(txt) {
  function fallback() {
    var ta = document.createElement('textarea');
    ta.value = txt;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).catch(fallback);
  } else {
    fallback();
  }
}

/* ================= File upload & attachment ================= */
function handleFilesSelect(files) {
  if (!files || !files.length) return;
  attachBar.classList.remove('hidden');
  var list = Array.from(files);
  list.forEach(function (file) {
    uploadFile(file);
  });
}

async function uploadFile(file) {
  var cardId = 'att-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  var card = el('div', 'attach-card uploading');
  card.id = cardId;
  card.innerHTML =
    '<svg class="attach-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
    '<span class="attach-name">' + esc(file.name) + '</span>' +
    '<span class="attach-status">جاري الرفع والفهرسة...</span>';
  attachBar.appendChild(card);

  var fd = new FormData();
  fd.append('file', file);

  try {
    var res = await fetch('/upload', { method: 'POST', body: fd });
    var data = await res.json();
    if (data.ok && data.saved && data.saved.length) {
      card.className = 'attach-card success';
      card.querySelector('.attach-status').innerHTML = '✓ مفهرس وجاهز';
      attachedFiles.push(file.name);
      selectMode('review');
      if (!taEl.value.trim()) {
        taEl.placeholder = 'اسأل عن محتوى ' + file.name + '...';
      }
      loadServerFiles();
    } else {
      card.className = 'attach-card error';
      card.querySelector('.attach-status').textContent = 'فشل: ' + (data.skipped ? data.skipped.join(', ') : 'صيغة غير مدعومة');
    }
  } catch (e) {
    card.className = 'attach-card error';
    card.querySelector('.attach-status').textContent = 'تعذر الاتصال بالخادم';
  }
}

/* ================= Files Management (RAG Scoping & Deletion) ================= */
function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  var k = 1024;
  var sizes = ['B', 'KB', 'MB', 'GB'];
  var i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(ext) {
  var e = (ext || '').toLowerCase();
  if (e === '.sql') return '📜';
  if (e === '.pdf') return '📕';
  if (e === '.xlsx') return '📊';
  if (e === '.pptx') return '📽️';
  if (e === '.docx') return '📘';
  if (e === '.py' || e === '.js' || e === '.html' || e === '.css') return '💻';
  if (e === '.json') return '🔢';
  return '📄';
}

async function loadServerFiles() {
  fmStats.textContent = 'جاري التحديث...';
  try {
    var res = await fetch('/docs');
    var data = await res.json();
    allServerFiles = data.files_meta || (data.files || []).map(function (f) {
      return { name: f, size: 0, chunks: 0, ext: f.slice(f.lastIndexOf('.')) };
    });
    fmStats.textContent = allServerFiles.length + ' ملفات متوفرة · ' + (data.chunks || 0) + ' مقطع مفهرس';
    renderFilesModalList(fmFilterInput.value);
  } catch (e) {
    fmStats.textContent = 'تعذر تحميل قائمة الملفات';
  }
}

function renderFilesModalList(query) {
  var q = (query || '').trim().toLowerCase();
  fmList.innerHTML = '';
  var filtered = allServerFiles.filter(function (f) {
    return !q || f.name.toLowerCase().indexOf(q) !== -1;
  });

  fmEmpty.classList.toggle('hidden', filtered.length > 0);

  filtered.forEach(function (f) {
    var isChecked = selectedScopedFiles.indexOf(f.name) !== -1;
    var item = el('div', 'fm-item' + (isChecked ? ' selected' : ''));
    item.dataset.fname = f.name;

    var icon = getFileIcon(f.ext);
    var metaText = formatBytes(f.size) + (f.chunks ? ' · ' + f.chunks + ' مقطع' : '');

    item.innerHTML =
      '<input type="checkbox" class="fm-item-check"' + (isChecked ? ' checked' : '') + '>' +
      '<span class="fm-item-icon" style="font-size:18px;">' + icon + '</span>' +
      '<div class="fm-item-info">' +
        '<div class="fm-item-name" title="' + esc(f.name) + '">' + esc(f.name) + '</div>' +
        '<div class="fm-item-meta">' + metaText + '</div>' +
      '</div>' +
      '<button class="fm-item-del" type="button" title="حذف الملف نهائياً">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>' +
      '</button>';

    fmList.appendChild(item);
  });

  updateFmSelectionStatus();
}

function updateFmSelectionStatus() {
  if (selectedScopedFiles.length === 0) {
    fmStatus.textContent = 'لم يتم حصر الإجابة (البحث في جميع الملفات)';
  } else {
    fmStatus.innerHTML = 'تم تحديد <b>' + selectedScopedFiles.length + '</b> ملف لحصر الإجابة عليها';
  }
}

async function deleteServerFile(fname) {
  if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذا الملف نهائياً من الخادم؟\n' + fname)) return;
  try {
    var res = await fetch('/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: fname })
    });
    var data = await res.json();
    if (data.ok) {
      selectedScopedFiles = selectedScopedFiles.filter(function (f) { return f !== fname; });
      updateActiveFilterBar();
      loadServerFiles();
    } else {
      alert('فشل حذف الملف: ' + (data.error || 'خطأ غير معروف'));
    }
  } catch (e) {
    alert('خطأ في الاتصال بالخادم أثناء الحذف');
  }
}

function openFilesModal() {
  filesModal.classList.remove('hidden');
  loadServerFiles();
}

function closeFilesModal() {
  filesModal.classList.add('hidden');
}

function applyScopedFiles(files) {
  selectedScopedFiles = files.slice();
  updateActiveFilterBar();
  closeFilesModal();
  if (selectedScopedFiles.length > 0) {
    selectMode('review');
  }
}

function updateActiveFilterBar() {
  if (!selectedScopedFiles || selectedScopedFiles.length === 0) {
    activeFilterBar.classList.add('hidden');
    afNames.textContent = '';
  } else {
    activeFilterBar.classList.remove('hidden');
    if (selectedScopedFiles.length <= 2) {
      afNames.textContent = selectedScopedFiles.join('، ');
    } else {
      afNames.textContent = selectedScopedFiles[0] + ' و ' + (selectedScopedFiles.length - 1) + ' ملفات أخرى';
    }
  }
}

/* ================= Search Spotlight Modal ================= */
function openSearchModal() {
  searchModal.classList.remove('hidden');
  smInput.value = '';
  renderSearchResults('');
  setTimeout(function () { smInput.focus(); }, 50);
}

function closeSearchModal() {
  searchModal.classList.add('hidden');
}

function renderSearchResults(query) {
  var q = (query || '').trim().toLowerCase();
  smResults.innerHTML = '';
  var matches = [];

  for (var i = 0; i < chats.length; i++) {
    var c = chats[i];
    var title = c.title || 'محادثة جديدة';
    var titleMatch = title.toLowerCase().indexOf(q) !== -1;
    var matchedSnippet = '';
    var matchedMsgIdx = -1;

    if (q) {
      for (var m = 0; m < c.messages.length; m++) {
        var msgContent = c.messages[m].content || '';
        var pos = msgContent.toLowerCase().indexOf(q);
        if (pos !== -1) {
          var start = Math.max(0, pos - 35);
          var end = Math.min(msgContent.length, pos + q.length + 45);
          matchedSnippet = (start > 0 ? '…' : '') +
            esc(msgContent.slice(start, pos)) +
            '<mark>' + esc(msgContent.slice(pos, pos + q.length)) + '</mark>' +
            esc(msgContent.slice(pos + q.length, end)) +
            (end < msgContent.length ? '…' : '');
          matchedMsgIdx = m;
          break;
        }
      }
    }

    if (!q || titleMatch || matchedSnippet) {
      matches.push({ chat: c, titleMatch: titleMatch, snippet: matchedSnippet, msgIdx: matchedMsgIdx });
    }
  }

  smEmpty.classList.toggle('hidden', matches.length > 0);

  for (var k = 0; k < matches.length; k++) {
    var it = matches[k];
    var itemEl = el('div', 'sm-result-item');
    itemEl.dataset.id = it.chat.id;
    if (it.msgIdx !== -1) itemEl.dataset.msgIdx = it.msgIdx;

    var modeBadge = (it.chat.mode === 'review') ? 'مراجعة ملفاتك' : 'الدردشة';
    var titleHtml = esc(it.chat.title || 'محادثة جديدة');
    if (q && it.titleMatch) {
      var posT = titleHtml.toLowerCase().indexOf(q);
      if (posT !== -1) {
        titleHtml = titleHtml.slice(0, posT) + '<mark>' + titleHtml.slice(posT, posT + q.length) + '</mark>' + titleHtml.slice(posT + q.length);
      }
    }

    var inner =
      '<div class="sm-res-title">' +
        '<span>' + titleHtml + '</span>' +
        '<span class="sm-res-badge">' + modeBadge + '</span>' +
      '</div>';

    if (it.snippet) {
      inner += '<div class="sm-res-snippet">' + it.snippet + '</div>';
    } else if (it.chat.messages.length) {
      var last = it.chat.messages[it.chat.messages.length - 1].content.slice(0, 70);
      inner += '<div class="sm-res-snippet" style="color:var(--muted)">' + esc(last) + '</div>';
    }

    itemEl.innerHTML = inner;
    smResults.appendChild(itemEl);
  }
}

