'use strict';
/* ================= Constants / helpers ================= */
var SS_TEMP    = 'mada.temp';
var LS_THEME   = 'mada.theme';
var LS_SBAR    = 'mada.sbar';
var LS_PROFILE = 'mada.profile';
var LS_FONT    = 'mada.font';
var LS_ACTIVE_CHAT = 'mada.active_chat';

function saveActiveChatId(id) {
  try {
    if (id) localStorage.setItem(LS_ACTIVE_CHAT, id);
    else localStorage.removeItem(LS_ACTIVE_CHAT);
  } catch (e) {}
}

function getSavedActiveChatId() {
  try {
    return localStorage.getItem(LS_ACTIVE_CHAT);
  } catch (e) {
    return null;
  }
}

function syncUrlChatId(id) {
  try {
    if (window.history && window.history.replaceState) {
      var url = new URL(window.location.href);
      if (id && id !== 'new') {
        url.searchParams.set('c', id);
      } else {
        url.searchParams.delete('c');
        url.searchParams.delete('chat');
      }
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
  } catch (e) {}
}

var MODES = {
  free:   { label: 'محادثة عامة',  sub: 'Qwen3-4B', full: 'Qwen3-4B · محادثة عامة' },
  review: { label: 'مراجعة ملفاتك', sub: 'Qwen3-4B', full: 'Qwen3-4B · مراجعة ملفاتك' }
};

var CHIPS = {
  free: [
    'اشرح لي فكرة التعلم الآلي',
    'اكتب قائمة تمارين يومية',
    'لخّص أفكار كتاب',
    'أقترح طريقة لتنظيم وقتي'
  ],
  review: [
    'ما أهم أفكار محاضراتي؟',
    'اشرح المصطلحات الصعبة',
    'حضّرني لأسئلة امتحان',
    'لخّص أبرز معادلة في دروسي'
  ]
};

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function $(id) { return document.getElementById(id); }
function el(tag, cls, html) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

