/* ================= Persistent Generation: Reconnect & Emergency Save =================
   يُحمّل بعد chat.js/app.js — يضيف:
   1) resumePendingGeneration(): استئناف التوليد المحجوز في الخلفية عند فتح الصفحة أو الدخول للمحادثة.
   2) beforeunload: حفظ «حتى آخر حرف» للرد الجاري (sessionStorage للمؤقتة، SQLite للدائمة).
*/

function isTempChatId(cid) {
  return !!(cid && String(cid).indexOf('temp_') === 0);
}

async function resumePendingGeneration() {
  if (streaming) return;
  try {
    var res = await fetch('/api/generation/active');
    if (!res.ok) return;
    var data = await res.json();
    var gens = (data && data.generations) || [];
    if (!gens.length) return;
    /* اختر: الدردشة المؤقتة إن كانت جارية، ثم المحادثة المفتوحة حالياً، ثم أول محادثة جارية */
    var pick = null;
    if (tempActive && tempChat) {
      for (var i = 0; i < gens.length; i++) {
        if (gens[i].chat_id === tempChat.id) { pick = gens[i]; break; }
      }
    }
    if (!pick && currentChatId) {
      for (var j = 0; j < gens.length; j++) {
        if (gens[j].chat_id === currentChatId) { pick = gens[j]; break; }
      }
    }
    if (!pick) {
      for (var k = 0; k < gens.length; k++) {
        if (getChat(gens[k].chat_id)) { pick = gens[k]; break; }
      }
    }
    if (!pick) return;
    var cid = pick.chat_id;
    var chat = (tempActive && tempChat && tempChat.id === cid) ? tempChat : getChat(cid);
    if (!chat) return;
    /* حوّل الواجهة إلى المحادثة الجارية */
    currentChatId = cid;
    saveActiveChatId(cid);
    syncUrlChatId(cid);
    currentMode = chat.mode;
    updateModePill();
    /* أزل أي رد مساعد جزئي سابق من العرض والذاكرة: البثّ المعاد سيعيد توليده كاملاً */
    var popped = [];
    while (chat.messages.length && chat.messages[chat.messages.length - 1].role === 'assistant') {
      popped.unshift(chat.messages.pop());
    }
    if (chat.messages && chat.messages.length) {
      renderChatMessages(chat);
    } else {
      renderEmpty(true);
    }
    renderSidebar();
    try {
      await streamChat(chat, true);
    } catch (e2) {
      chat.messages = chat.messages.concat(popped);
      if (chat.messages.length) renderChatMessages(chat);
      console.warn('[persist] resume stream failed', e2);
    }
  } catch (e) {
    console.warn('[persist] resume failed', e);
  }
}

window.addEventListener('beforeunload', function () {
  var ctx = streamCtx;
  if (!ctx || !ctx.raw || ctx.finished) return;
  ctx.finished = true;
  var cid = activeGenChatId || (ctx.chat ? ctx.chat.id : null);
  if (!cid) return;

  /* محادثة مؤقتة: حفظ في sessionStorage */
  if (activeGenIsTemp || isTempChatId(cid)) {
    if (tempChat) {
      var tMsgs = tempChat.messages.slice();
      if (tMsgs.length && tMsgs[tMsgs.length - 1].role === 'assistant') {
        tMsgs[tMsgs.length - 1].content = ctx.raw;
      } else {
        tMsgs.push({ role: 'assistant', content: ctx.raw });
      }
      tempChat.messages = tMsgs;
      saveTempChat();
    }
    return;
  }

  /* محادثة دائمة: حفظ جزئي فوري في SQLite عبر keepalive */
  var chat = getChat(cid);
  if (!chat) return;
  var msgs = chat.messages.slice();
  if (msgs.length && msgs[msgs.length - 1].role === 'assistant') {
    msgs[msgs.length - 1].content = ctx.raw;
  } else {
    msgs.push({ role: 'assistant', content: ctx.raw });
  }
  var body = JSON.stringify({ chat: {
    id: chat.id,
    mode: chat.mode,
    title: chat.title,
    project_id: chat.project_id || null,
    messages: msgs
  } });
  try {
    fetch('/convs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body,
      keepalive: true
    }).catch(function () {});
  } catch (e) {}
});