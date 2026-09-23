/* ================= Message rendering ================= */
function renderUserMsg(content, msgIdx) {
  var card = el('div', 'msg user');
  card.dataset.msgIdx = msgIdx != null ? msgIdx : '';
  card.appendChild(el('div', 'msg-head',
    '<span class="uh-av">أ</span><span class="who">أنت</span>'));

  // Wrap text + actions together
  var wrap = el('div', 'u-content-wrap');
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

function appendMsgActions(card) {
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
}

function renderAsstMsg(content, msgIdx) {
  var card = el('div', 'msg asst');
  card.dataset.msgIdx = msgIdx != null ? msgIdx : '';
  card.appendChild(el('div', 'msg-head',
    '<span class="logo">' + SVG_SPARKLE + '</span><span class="who">مذكّرتي</span>'));
  card.appendChild(el('div', 'md', md(content)));
  appendMsgActions(card);
  msgsEl.appendChild(card);
  return card;
}

function renderChatMessages(chat) {
  body.classList.remove('is-empty');
  msgsEl.innerHTML = '';
  var ms = chat.messages;
  for (var i = 0; i < ms.length; i++) {
    if (ms[i].role === 'user') renderUserMsg(ms[i].content, i);
    else renderAsstMsg(ms[i].content, i);
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

/* ================= Minimap Navigator (Images 1 & 2) ================= */
function updateMinimap() {
  var chat = currentChatId ? getChat(currentChatId) : null;
  var mm = $('minimap');
  var ticksEl = $('minimap-ticks');
  var listEl = $('minimap-list');
  if (!mm || !ticksEl || !listEl) return;
  if (!chat || chat.messages.length < 2) {
    mm.classList.add('hidden');
    return;
  }
  mm.classList.remove('hidden');
  ticksEl.innerHTML = '';
  listEl.innerHTML = '';
  var ms = chat.messages;
  for (var i = 0; i < ms.length; i++) {
    var m = ms[i];
    var isAsst = m.role === 'assistant';
    var textSnippet = m.content.replace(/```[\s\S]*?```/g, 'code').replace(/[#*`_]/g, '').trim().slice(0, 48);
    
    var tick = el('div', 'mm-tick' + (i === 0 ? ' active' : ''));
    tick.dataset.idx = i;
    ticksEl.appendChild(tick);

    var item = el('div', 'mm-item' + (isAsst ? ' is-asst' : '') + (i === 0 ? ' active' : ''), esc(textSnippet || 'رسالة'));
    item.dataset.idx = i;
    listEl.appendChild(item);
  }
}

function scrollMsgIntoView(idx) {
  var cards = msgsEl.querySelectorAll('.msg');
  if (cards[idx]) {
    cards[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
    highlightMinimapTick(idx);
  }
}

function highlightMinimapTick(idx) {
  var ticks = document.querySelectorAll('.mm-tick');
  var items = document.querySelectorAll('.mm-item');
  ticks.forEach(function(t, i) { t.classList.toggle('active', i === idx); });
  items.forEach(function(it, i) { it.classList.toggle('active', i === idx); });
}

