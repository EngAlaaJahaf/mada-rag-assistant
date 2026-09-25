/* ================= Temporary Chat UI Helpers ================= */
function initTempChatUI() {
  var btnTemp = $('btn-temp-chat');
  if (btnTemp) {
    btnTemp.addEventListener('click', function () {
      if (tempActive) {
        if (confirm('أنت الآن في وضع «دردشة مؤقتة». هل ترغب في إنهاء هذه الدردشة وبدء محادثة جديدة؟ ستُمسح هذه المحادثة.')) {
          clearTempChat();
          newChat();
        }
      } else {
        openAppModal('modal-temp-chat');
      }
    });
  }

  var swFiles = $('sw-temp-use-files');

  var btnStartTemp = $('btn-confirm-start-temp');
  if (btnStartTemp) {
    btnStartTemp.addEventListener('click', function () {
      var useFiles = swFiles ? swFiles.classList.contains('active') : true;
      tempActive = true;
      tempChat = {
        id: 'temp_' + Date.now(),
        mode: currentMode,
        title: 'دردشة مؤقتة',
        messages: [],
        useFiles: useFiles
      };
      saveTempChat();
      closeAppModal('modal-temp-chat');
      updateTempUI();
      currentChatId = tempChat.id;
      renderEmpty(true);
      renderSidebar();
      try { taEl.focus(); } catch (e) {}
    });
  }
}

/* ================= Data Controls Wire-up ================= */
function initDataControls() {
  var btnArchiveAll = $('btn-archive-all-chats');
  if (btnArchiveAll) {
    btnArchiveAll.addEventListener('click', async function () {
      if (!confirm('أرشفة جميع الدردشات الحالية؟ ستُخفى من القائمة الرئيسية.')) return;
      for (var i = 0; i < chats.length; i++) {
        chats[i].archived = true;
        serverArchiveChat(chats[i].id, true);
      }
      renderSidebar();
      alert('تمت أرشفة جميع المحادثات.');
    });
  }

  var btnDeleteAll = $('btn-delete-all-data');
  if (btnDeleteAll) {
    btnDeleteAll.addEventListener('click', async function () {
      if (!confirm('تحذير: هل أنت متأكد من حذف جميع الدردشات نهائياً من قاعدة بيانات SQLite؟ لا يمكن التراجع!')) return;
      await serverClearAllConvs();
      chats = [];
      clearTempChat();
      renderSidebar();
      newChat();
      closeAppModal('modal-settings');
    });
  }

  var btnExport = $('btn-export-chats');
  if (btnExport) {
    btnExport.addEventListener('click', function () {
      var data = {
        version: 1,
        exported_at: new Date().toISOString(),
        projects: projects,
        conversations: chats
      };
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'mada_conversations_backup.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }
}

/* ================= Mode selector ================= */
function updateModePill() {
  var curModel = (getModelConfig().model || 'Qwen3-4B');
  mpLabelEl.textContent = (currentMode === 'review') ? 'مراجعة ملفاتك' : curModel;
  var f = $('mi-free');
  var r = $('mi-review');
  if (f) f.classList.toggle('active', currentMode === 'free');
  if (r) r.classList.toggle('active', currentMode === 'review');
  if (f && f.querySelector('.mm-check')) f.querySelector('.mm-check').innerHTML = currentMode === 'free' ? SVG_CHECK : '';
  if (r && r.querySelector('.mm-check')) r.querySelector('.mm-check').innerHTML = currentMode === 'review' ? SVG_CHECK : '';
  var tabChat = $('tab-chat');
  var tabWork = $('tab-work');
  if (tabChat) tabChat.classList.toggle('active', currentMode === 'free');
  if (tabWork) tabWork.classList.toggle('active', currentMode === 'review');
}

function selectMode(mode) {
  currentMode = mode;
  var cur = currentChatId ? getChat(currentChatId) : null;
  if (cur && cur.mode !== mode) {
    cur.mode = mode;
    saveChats();
  }
  updateModePill();
  closeModeMenu();
}

function currentChatIdMessagesLength() {
  var c = currentChatId ? getChat(currentChatId) : null;
  return c ? c.messages.length : 0;
}

function closeModeMenu() { mmenuEl.classList.remove('open'); }

/* ================= Streaming / send ================= */
var activeGenChatId = null;
var activeGenIsTemp = false;

function setStreamingUI(on) {
  streaming = on;
  body.classList.toggle('streaming', on);
  updateSendDisabled();
  if (on) {
    taEl.disabled = true;
  } else {
    taEl.disabled = false;
    try { taEl.focus(); } catch (e) {}
  }
}

function nearBottom() {
  return msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 150;
}
function autoScroll() { if (nearBottom()) msgsEl.scrollTop = msgsEl.scrollHeight; }

function showErrorBubble(chatEl, msgHtml) {
  var box = el('div', 'errbox', SVG_ELLIPSE + '<span>' + msgHtml + '</span>');
  chatEl.appendChild(box);
  msgsEl.scrollTop = msgsEl.scrollHeight;
}



async function streamChat(chat, resume) {
  var mode = chat.mode;
  if (tempActive && tempChat && tempChat.useFiles === false) {
    mode = 'free';
  } else if (selectedScopedFiles && selectedScopedFiles.length > 0) {
    mode = 'review';
  }
  var modelCfg = getModelConfig();
  var personalizedPrompt = buildPersonalizedSystemPrompt();
  var isTemp = !!(tempActive && tempChat && chat.id === tempChat.id);
  activeGenChatId = chat.id;
  activeGenIsTemp = isTemp;
  var endpoint = (mode === 'review') ? '/ragen' : '/cgen';
  var payload;
  if (resume) {
    payload = {
      chat_id: chat.id,
      reconnect: true,
      is_temp: isTemp,
      endpoint: modelCfg.endpoint || undefined,
      model: modelCfg.model || undefined
    };
  } else if (mode === 'review') {
    payload = {
      chat_id: chat.id,
      is_temp: isTemp,
      q: lastUser(chat),
      tr: true,
      files: (selectedScopedFiles && selectedScopedFiles.length) ? selectedScopedFiles : undefined,
      custom_instructions: personalizedPrompt || undefined,
      memory_enabled: getPersonalization().memoryEnabled !== false,
      endpoint: modelCfg.endpoint || undefined,
      model: modelCfg.model || undefined,
      api_key: modelCfg.apiKey || undefined,
      temperature: parseFloat(modelCfg.temperature) || 0.3
    };
  } else {
    var msgs = trimHistory(chat.messages);
    if (personalizedPrompt) {
      msgs.unshift({ role: 'system', content: personalizedPrompt });
    }
    payload = {
      chat_id: chat.id,
      is_temp: isTemp,
      messages: msgs,
      memory_enabled: getPersonalization().memoryEnabled !== false,
      endpoint: modelCfg.endpoint || undefined,
      model: modelCfg.model || undefined,
      api_key: modelCfg.apiKey || undefined,
      temperature: parseFloat(modelCfg.temperature) || 0.6,
      max_tokens: parseInt(modelCfg.maxTokens, 10) || 2048
    };
  }

  var card = el('div', 'msg asst');
  card.appendChild(el('div', 'msg-head',
    '<span class="logo">' + SVG_SPARKLE + '</span><span class="who">مذكّرتي</span>'));
  var mdEl = el('div', 'md', '<span class="cur">▍</span>');
  card.appendChild(mdEl);
  var srcEl = el('div', 'srcs');
  srcEl.style.display = 'none';
  card.appendChild(srcEl);
  msgsEl.appendChild(card);
  autoScroll();

  var ctrl = new AbortController();
  streamCtrl = ctrl;
  streamCtx = { chat: chat, card: card, mdEl: mdEl, srcEl: srcEl, raw: '', meta: null, finished: false };
  setStreamingUI(true);
  renderEmpty(false);

  var reader = null;
  try {
    var res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    });
    if (!res.ok || !res.body) {
      streamCtx.finished = true;
      showErrorBubble(card, 'تعذر الاتصال بالخادم (' + res.status + ')');
      finishStream(false, chat);
      return;
    }
    reader = res.body.getReader();
    var dec = new TextDecoder('utf-8');
    var buf = '';
    for (;;) {
      var r = await reader.read();
      if (r.done) break;
      buf += dec.decode(r.value, { stream: true });
      var idx;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        var block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        var lines = block.split('\n');
        for (var li = 0; li < lines.length; li++) {
          var ln = lines[li].replace(/\r$/, '');
          if (ln.indexOf('data:') !== 0) continue;
          var data = ln.slice(5).trim();
          if (!data) continue;
          if (data === '[DONE]') {
            streamCtx.finished = true;
            break;
          }
          var ev;
          try { ev = JSON.parse(data); } catch (e) { continue; }
          if (!ev || !ev.type) continue;
          if (ev.type === 'txt' && typeof ev.t === 'string') {
            streamCtx.raw += ev.t;
            mdEl.innerHTML = md(streamCtx.raw) + '<span class="cur">▍</span>';
            autoScroll();
          } else if (ev.type === 'meta') {
            streamCtx.meta = ev;
          } else if (ev.type === 'err') {
            mdEl.innerHTML = md(streamCtx.raw);
            showErrorBubble(card, esc(ev.msg || 'حدث خطأ أثناء التوليد'));
            streamCtx.finished = true;
            break;
          } else if (ev.type === 'done') {
            streamCtx.finished = true;
            break;
          }
        }
        if (streamCtx.finished) break;
      }
      if (streamCtx.finished) break;
    }
    if (reader) { try { await reader.cancel(); } catch (e) {} }
  } catch (err) {
    if (err && err.name === 'AbortError') {
      // user stopped — treat as graceful finalize
    } else {
      streamCtx.finished = true;
      showErrorBubble(card, esc('خطأ في الاتصال بالخادم'));
    }
  }

  finishStream(true, chat);
}

function finishStream(ok, chat) {
  var ctx = streamCtx;
  streamCtrl = null;
  streamCtx = null;
  activeGenChatId = null;
  activeGenIsTemp = false;
  setStreamingUI(false);
  if (!ctx) return;
  ctx.mdEl.innerHTML = md(ctx.raw);
  if (ctx.meta) renderSourcesNote(ctx.card, ctx.meta);
  var asstTime = Date.now();
  chat.updated_at = asstTime;
  appendMsgActions(ctx.card, asstTime);
  if (ctx.raw) {
    var asstMsg = { role: 'assistant', content: ctx.raw, time: asstTime };
    if (ctx.meta) asstMsg.meta = ctx.meta;
    chat.messages.push(asstMsg);
    ctx.card.dataset.msgIdx = chat.messages.length - 1;
    if (tempActive && tempChat && chat.id === tempChat.id) {
      saveTempChat();
    } else {
      persistChat(chat);
      renderSidebar();
    }
  }
  updateMinimap();
  autoScroll();
  try { if (window.applyMemoryFix) window.applyMemoryFix(chat); } catch (e) {}
  try { if (window.attachFixButtons) window.attachFixButtons(); } catch (e) {}
  try { if (ok && window.maybeLearnFromReply) window.maybeLearnFromReply(chat); } catch (e) {}
}

function send(text, chatId) {
  if (streaming) return;
  var t = (text || '').trim();
  if (!t) return;

  // جمع الصور المرفقة أو المحددة حالياً لتظهر معاينتها المصغرة في رسالة المستخدم
  var currentImgs = [];
  if (attachedFiles && attachedFiles.length) {
    currentImgs = currentImgs.concat(attachedFiles.filter(function (f) { return /\.(png|jpe?g|bmp|webp|tiff)$/i.test(f); }));
  }
  if (selectedScopedFiles && selectedScopedFiles.length) {
    selectedScopedFiles.forEach(function (f) {
      if (/\.(png|jpe?g|bmp|webp|tiff)$/i.test(f) && currentImgs.indexOf(f) === -1) {
        currentImgs.push(f);
      }
    });
  }

  if (tempActive && tempChat) {
    currentChatId = tempChat.id;
    var nowTime = Date.now();
    tempChat.updated_at = nowTime;
    if (!tempChat.created_at) tempChat.created_at = nowTime;
    var userMsg = { role: 'user', content: t, time: nowTime };
    if (currentImgs.length) userMsg.files = currentImgs.slice();
    tempChat.messages.push(userMsg);
    saveTempChat();
    renderUserMsg(t, tempChat.messages.length - 1, currentImgs, nowTime);
    if (attachBar) {
      attachBar.innerHTML = '';
      attachBar.classList.add('hidden');
    }
    attachedFiles = [];
    renderEmpty(false);
    streamChat(tempChat);
    return;
  }

  var chat;
  if (chatId) chat = getChat(chatId);
  if (!chat) {
    chat = makeChat(currentMode);
    chats.unshift(chat);
  } else if (chat.mode !== currentMode) {
    currentMode = chat.mode;
    updateModePill();
  }
  currentChatId = chat.id;
  saveActiveChatId(chat.id);
  syncUrlChatId(chat.id);
  if (!chat.title) chat.title = t.slice(0, 42);
  var nowTime = Date.now();
  chat.updated_at = nowTime;
  if (!chat.created_at) chat.created_at = nowTime;
  var userMsg = { role: 'user', content: t, time: nowTime };
  if (currentImgs.length) userMsg.files = currentImgs.slice();
  chat.messages.push(userMsg);

  renderUserMsg(t, chat.messages.length - 1, currentImgs, nowTime);
  if (attachBar) {
    attachBar.innerHTML = '';
    attachBar.classList.add('hidden');
  }
  attachedFiles = [];
  renderSidebar();
  persistChat(chat);
  renderEmpty(false);
  streamChat(chat);
}

function sendChip(text) {
  if (streaming) return;
  if (tempActive && tempChat) {
    send(text, tempChat.id);
    return;
  }
  var chat = currentChatId ? getChat(currentChatId) : null;
  if (chat && chat.messages.length === 0 && chat.mode !== currentMode) {
    chat.mode = currentMode;
  }
  if (!chat) {
    chat = makeChat(currentMode);
    chats.unshift(chat);
    currentChatId = chat.id;
    saveActiveChatId(chat.id);
    syncUrlChatId(chat.id);
  }
  send(text, chat.id);
}

/* ================= Conversation actions ================= */
function loadChat(id) {
  if (streaming) return;
  jumpToChatView(); // أياً كان العرض الحالي، فتح محادثة يجب أن يظهرها دائماً
  if (tempActive) {
    clearTempChat();
  }
  var chat = getChat(id);
  if (!chat) return;
  currentChatId = id;
  saveActiveChatId(id);
  syncUrlChatId(id);
  currentMode = chat.mode;
  updateModePill();
  if (chat.messages.length === 0) {
    renderEmpty(true);
  } else {
    renderChatMessages(chat);
  }
  renderSidebar();
  setTimeout(function () { resumePendingGeneration(); }, 0);
  try { if (window.attachFixButtons) window.attachFixButtons(); } catch (e) {}
  try { if (window.applyMemoryFix && chat.messages.length) window.applyMemoryFix(chat); } catch (e) {}
}

function deleteChat(id) {
  if (streaming) return;
  var chat = getChat(id);
  if (!chat) return;
  if (!window.confirm('حذف هذه المحادثة نهائيًا؟')) return;
  var idx = -1;
  for (var i = 0; i < chats.length; i++) if (chats[i].id === id) idx = i;
  if (idx !== -1) chats.splice(idx, 1);
  serverDeleteChat(id);
  if (currentChatId === id) {
    currentChatId = chats.length ? chats[0].id : null;
    saveActiveChatId(currentChatId);
    syncUrlChatId(currentChatId);
    if (currentChatId) {
      var c = getChat(currentChatId);
      currentMode = c.mode;
      updateModePill();
      if (c.messages.length) renderChatMessages(c); else renderEmpty(true);
    } else {
      renderEmpty(true);
      updateModePill();
    }
  }
  renderSidebar();
}

function renameChat(id) {
  var chat = getChat(id);
  if (!chat) return;
  var name = window.prompt('الاسم الجديد للمحادثة:', chat.title || '');
  if (name == null) return;
  chat.title = name.trim() || chat.title;
  renderSidebar();
  persistChat(chat);
}

