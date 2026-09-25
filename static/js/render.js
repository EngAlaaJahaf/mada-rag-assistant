/* ================= Message rendering ================= */
function renderUserMsg(content, msgIdx, files, time) {
  var card = el('div', 'msg user');
  card.dataset.msgIdx = msgIdx != null ? msgIdx : '';
  card.appendChild(el('div', 'msg-head',
    '<span class="uh-av">أ</span><span class="who">أنت</span>'));

  // Wrap text + actions together
  var wrap = el('div', 'u-content-wrap');

  var timeStr = (typeof formatMessageTimestamp === 'function') ? formatMessageTimestamp(time || Date.now()) : '';
  if (timeStr) {
    var timeEl = el('div', 'msg-time-top', esc(timeStr));
    if (typeof formatFullTimestamp === 'function') {
      timeEl.title = formatFullTimestamp(time || Date.now());
    }
    wrap.appendChild(timeEl);
  }

  // عرض معاينات الصور المصغرة إذا وُجدت
  if (files && files.length) {
    var imgsBox = el('div', 'u-msg-attachments');
    files.forEach(function (fname) {
      if (/\.(png|jpe?g|bmp|webp|tiff)$/i.test(fname)) {
        var a = el('a', 'u-img-thumb-link');
        a.href = '/uploads/' + encodeURIComponent(fname);
        a.target = '_blank';
        a.title = 'عرض الصورة بالحجم الكامل: ' + fname;
        a.innerHTML =
          '<img src="/uploads/' + encodeURIComponent(fname) + '" class="u-msg-thumb" alt="' + esc(fname) + '">' +
          '<span class="u-img-thumb-name">' + esc(fname) + '</span>';
        imgsBox.appendChild(a);
      }
    });
    if (imgsBox.children.length > 0) {
      wrap.appendChild(imgsBox);
    }
  }

  wrap.appendChild(el('div', 'u-text', esc(content)));

  // User action buttons: Edit, Copy, Share
  var act = document.createElement('div');
  act.className = 'u-actions';
  act.innerHTML =
    '<button class="u-act-btn u-act-edit" type="button" title="تعديل الرسالة">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
    '</button>' +
    '<button class="u-act-btn u-act-copy" type="button" title="نسخ الرسالة">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
    '</button>' +
    '<button class="u-act-btn u-act-share" type="button" title="مشاركة الرسالة">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>' +
    '</button>';
  wrap.appendChild(act);
  card.appendChild(wrap);
  msgsEl.appendChild(card);
  return card;
}

function appendMsgActions(card, time) {
  if (card.querySelector('.msg-actions')) return;
  var act = el('div', 'msg-actions',
    '<button class="m-act-btn act-more" type="button" title="خيارات إضافية">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>' +
    '</button>' +
    '<button class="m-act-btn act-regen" type="button" title="إعادة التوليد">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>' +
    '</button>' +
    '<button class="m-act-btn act-share" type="button" title="مشاركة أو قراءة">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>' +
    '</button>' +
    '<button class="m-act-btn act-dislike" type="button" title="رد غير جيد">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>' +
    '</button>' +
    '<button class="m-act-btn act-like" type="button" title="رد جيد">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4.33A2.31 2.31 0 0 1 2 20v-7a2.31 2.31 0 0 1 2.33-2H7"/></svg>' +
    '</button>' +
    '<button class="m-act-btn act-copy" type="button" title="نسخ الرد">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
    '</button>'
  );
  card.appendChild(act);

  var timeStr = (typeof formatMessageTimestamp === 'function') ? formatMessageTimestamp(time || Date.now()) : '';
  if (timeStr) {
    var timeEl = el('div', 'msg-time-bottom', esc(timeStr));
    if (typeof formatFullTimestamp === 'function') {
      timeEl.title = formatFullTimestamp(time || Date.now());
    }
    card.appendChild(timeEl);
  }
}

function renderSourcesNote(chatEl, meta) {
  var srcEl = chatEl.querySelector('.srcs');
  if (!meta || !(meta.sources > 0) || !srcEl) return;
  var n = meta.sources;
  var details = meta.sources_detail || [];

  // دمج المصادر الفريدة مع مراجع الصفحات والشرائح
  var seen = {};
  var items = [];
  details.forEach(function (d) {
    if (!d || !d.file) return;
    var k = d.file + '::' + (d.ref || '');
    if (!seen[k]) {
      seen[k] = true;
      items.push(d);
    }
  });
  if (!items.length && meta.files) {
    items = meta.files.map(function (f) { return { file: f, ref: '' }; });
  }

  var listHtml = items.slice(0, 5).map(function (it) {
    var isImg = /\.(png|jpe?g|bmp|webp|tiff)$/i.test(it.file);
    var refHtml = it.ref ? '<span class="src-ref-tag">' + esc(it.ref) + '</span>' : '';
    if (isImg) {
      return '<a href="/uploads/' + encodeURIComponent(it.file) + '" target="_blank" class="src-file src-img-item" title="' + esc(it.file) + '">' +
        '<img src="/uploads/' + encodeURIComponent(it.file) + '" class="src-mini-thumb" alt="">' +
        '<span class="src-fn">' + esc(it.file) + '</span>' +
        (refHtml ? ' ' + refHtml : '') +
      '</a>';
    }
    return '<span class="src-file" title="' + esc(it.file) + '">' +
      '<span class="src-fn">' + esc(it.file) + '</span>' +
      (refHtml ? ' ' + refHtml : '') +
    '</span>';
  }).join('، ');

  if (items.length > 5) listHtml += ' …';

  srcEl.innerHTML = SVG_SOURCE + '<span><b>استندت إلى ' + n + ' ' + (n === 1 ? 'مصدر' : 'مصادر') + '</b>: ' + listHtml + '</span>';
  srcEl.style.display = 'flex';
}
window.renderSourcesNote = renderSourcesNote;

function extractMetaFromContent(content, prevUserMsg) {
  var sourcesDetail = [];
  var seen = {};

  if (content) {
    var re = /\[([^\n\]]+\.(?:pdf|docx?|pptx?|xlsx?|png|jpe?g|webp|bmp|txt|sql|csv|json))\s*(?:[—\-]\s*([^\]\n]+))?\]/gi;
    var m;
    while ((m = re.exec(content)) !== null) {
      var fn = m[1].trim();
      var rf = (m[2] || '').trim();
      var k = fn + '::' + rf;
      if (!seen[k]) {
        seen[k] = true;
        sourcesDetail.push({ file: fn, ref: rf });
      }
    }
  }

  if (!sourcesDetail.length && prevUserMsg && prevUserMsg.files && prevUserMsg.files.length) {
    prevUserMsg.files.forEach(function (fn) {
      if (!seen[fn]) {
        seen[fn] = true;
        sourcesDetail.push({ file: fn, ref: '' });
      }
    });
  }

  if (sourcesDetail.length > 0) {
    var files = [];
    sourcesDetail.forEach(function (d) {
      if (files.indexOf(d.file) === -1) files.push(d.file);
    });
    return {
      sources: sourcesDetail.length,
      files: files,
      sources_detail: sourcesDetail
    };
  }
  return null;
}
window.extractMetaFromContent = extractMetaFromContent;

function renderAsstMsg(content, msgIdx, meta, time) {
  var card = el('div', 'msg asst');
  card.dataset.msgIdx = msgIdx != null ? msgIdx : '';
  card.appendChild(el('div', 'msg-head',
    '<span class="logo">' + SVG_SPARKLE + '</span><span class="who">مذكّرتي</span>'));
  card.appendChild(el('div', 'md', md(content)));

  var srcEl = el('div', 'srcs');
  srcEl.style.display = 'none';
  card.appendChild(srcEl);

  if (meta) {
    renderSourcesNote(card, meta);
  }

  appendMsgActions(card, time);
  msgsEl.appendChild(card);
  return card;
}

function renderChatMessages(chat) {
  body.classList.remove('is-empty');
  msgsEl.innerHTML = '';

  var chatStartDate = chat.created_at || (chat.messages && chat.messages.length && (chat.messages[0].time || chat.messages[0].timestamp)) || chat.updated_at;
  if (chatStartDate && typeof formatFullTimestamp === 'function') {
    var fullDate = formatFullTimestamp(chatStartDate);
    var datePill = el('div', 'chat-date-separator',
      '<span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>بدأت المحادثة في ' + esc(fullDate) + '</span>'
    );
    msgsEl.appendChild(datePill);
  }

  var ms = chat.messages || [];
  for (var i = 0; i < ms.length; i++) {
    var mTime = ms[i].time || ms[i].timestamp || (i === 0 && chat.created_at ? chat.created_at : null);
    if (ms[i].role === 'user') {
      renderUserMsg(ms[i].content, i, ms[i].files, mTime);
    } else {
      var prevUser = (i > 0 && ms[i - 1].role === 'user') ? ms[i - 1] : null;
      var meta = ms[i].meta || extractMetaFromContent(ms[i].content, prevUser);
      renderAsstMsg(ms[i].content, i, meta, mTime);
    }
  }
  msgsEl.style.scrollBehavior = 'auto';
  msgsEl.scrollTop = msgsEl.scrollHeight;
  requestAnimationFrame(function () {
    if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;
  });
  updateMinimap();
  try { if (window.attachFixButtons) window.attachFixButtons(); } catch (e) {}
}

function renderEmpty(show) {
  body.classList.toggle('is-empty', show);
  if (show) {
    msgsEl.innerHTML = '';
  }
  updateMinimap();
  updateSendDisabled();
}

/* ================= Minimap Navigator (Turn Scrubber - Matching Reference) ================= */
function updateMinimap() {
  var chat = currentChatId ? getChat(currentChatId) : null;
  var mm = $('minimap');
  var ticksEl = $('minimap-ticks');
  var listEl = $('minimap-list');
  if (!mm || !ticksEl || !listEl) return;
  if (!chat || !chat.messages || chat.messages.length < 2) {
    mm.classList.add('hidden');
    return;
  }

  var ms = chat.messages;
  var userIndices = [];
  for (var i = 0; i < ms.length; i++) {
    if (ms[i].role === 'user') {
      userIndices.push(i);
    }
  }

  // Use user message turns if available, else all messages
  var itemsToShow = userIndices.length >= 1 ? userIndices : [];
  if (itemsToShow.length === 0) {
    for (var j = 0; j < ms.length; j++) itemsToShow.push(j);
  }

  if (itemsToShow.length < 2) {
    mm.classList.add('hidden');
    return;
  }

  mm.classList.remove('hidden');
  ticksEl.innerHTML = '';
  listEl.innerHTML = '';

  for (var k = 0; k < itemsToShow.length; k++) {
    var msgIdx = itemsToShow[k];
    var m = ms[msgIdx];
    var rawText = (m.content || '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/[#*`_~]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    var textSnippet = rawText.slice(0, 52);
    if (!textSnippet) {
      textSnippet = 'File upload';
    }

    var tick = el('div', 'mm-tick' + (k === 0 ? ' active' : ''));
    tick.dataset.idx = msgIdx;
    ticksEl.appendChild(tick);

    var item = el('div', 'mm-item' + (k === 0 ? ' active' : ''), esc(textSnippet));
    item.dataset.idx = msgIdx;
    item.title = rawText;
    listEl.appendChild(item);
  }
}

function scrollMsgIntoView(idx) {
  var card = msgsEl.querySelector('.msg[data-msg-idx="' + idx + '"]') || msgsEl.querySelectorAll('.msg')[idx];
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    highlightMinimapTick(idx);
  }
}

function highlightMinimapTick(msgIdx) {
  var ticks = document.querySelectorAll('.mm-tick');
  var items = document.querySelectorAll('.mm-item');
  if (!ticks.length) return;

  var matchedIdx = -1;
  for (var i = 0; i < ticks.length; i++) {
    var tIdx = parseInt(ticks[i].dataset.idx, 10);
    if (tIdx === msgIdx) {
      matchedIdx = i;
      break;
    }
  }

  if (matchedIdx === -1) {
    for (var j = 0; j < ticks.length; j++) {
      if (parseInt(ticks[j].dataset.idx, 10) <= msgIdx) {
        matchedIdx = j;
      }
    }
    if (matchedIdx === -1) matchedIdx = 0;
  }

  ticks.forEach(function(t, i) { t.classList.toggle('active', i === matchedIdx); });
  items.forEach(function(it, i) {
    it.classList.toggle('active', i === matchedIdx);
    if (i === matchedIdx) {
      try { it.scrollIntoView({ block: 'nearest' }); } catch (e) {}
    }
  });
}

