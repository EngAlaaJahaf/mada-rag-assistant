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

var CODE_EXTENSIONS = {
  python: 'py', py: 'py',
  javascript: 'js', js: 'js',
  typescript: 'ts', ts: 'ts',
  sql: 'sql',
  html: 'html', htm: 'html',
  css: 'css', scss: 'scss', sass: 'sass',
  json: 'json',
  bash: 'sh', sh: 'sh', shell: 'sh', zsh: 'sh',
  powershell: 'ps1', ps1: 'ps1',
  bat: 'bat', cmd: 'cmd',
  c: 'c', cpp: 'cpp', 'c++': 'cpp',
  csharp: 'cs', 'c#': 'cs', cs: 'cs',
  java: 'java', kotlin: 'kt', kt: 'kt',
  go: 'go', golang: 'go',
  rust: 'rs', rs: 'rs',
  php: 'php', ruby: 'rb', rb: 'rb',
  swift: 'swift', r: 'r', dart: 'dart',
  yaml: 'yaml', yml: 'yaml', xml: 'xml', svg: 'svg',
  markdown: 'md', md: 'md',
  dockerfile: 'dockerfile', ini: 'ini', toml: 'toml',
  lua: 'lua', perl: 'pl',
  txt: 'txt', plaintext: 'txt', text: 'txt'
};

function getCodeDownloadMeta(lang, code) {
  var l = String(lang || '').trim().toLowerCase();
  var aliases = {
    '': 'text',
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'rb': 'ruby',
    'sh': 'bash',
    'shell': 'bash',
    'zsh': 'bash',
    'ps': 'powershell',
    'ps1': 'powershell',
    'c++': 'cpp',
    'c#': 'csharp',
    'cs': 'csharp',
    'golang': 'go',
    'htm': 'html',
    'yml': 'yaml'
  };
  var normalized = aliases[l] || l;

  var map = {
    javascript: { name: 'code', ext: 'js' },
    typescript: { name: 'code', ext: 'ts' },
    python: { name: 'main', ext: 'py' },
    php: { name: 'code', ext: 'php' },
    sql: { name: 'query', ext: 'sql' },
    json: { name: 'data', ext: 'json' },
    markdown: { name: 'README', ext: 'md' },
    css: { name: 'styles', ext: 'css' },
    bash: { name: 'script', ext: 'sh' },
    powershell: { name: 'script', ext: 'ps1' },
    yaml: { name: 'config', ext: 'yml' },
    xml: { name: 'code', ext: 'xml' },
    html: { name: 'index', ext: 'html' },
    c: { name: 'code', ext: 'c' },
    cpp: { name: 'code', ext: 'cpp' },
    csharp: { name: 'Program', ext: 'cs' },
    java: { name: 'Main', ext: 'java' },
    go: { name: 'main', ext: 'go' },
    rust: { name: 'main', ext: 'rs' },
    ruby: { name: 'main', ext: 'rb' },
    kotlin: { name: 'Main', ext: 'kt' },
    swift: { name: 'main', ext: 'swift' },
    dart: { name: 'main', ext: 'dart' },
    bat: { name: 'script', ext: 'bat' },
    cmd: { name: 'script', ext: 'cmd' },
    text: { name: 'code', ext: 'txt' }
  };

  var meta = map[normalized] || { name: 'snippet', ext: CODE_EXTENSIONS[normalized] || 'txt' };
  var ext = meta.ext || 'txt';
  var filename = meta.name + '.' + ext;

  var sample = String(code || '').trim();
  var firstLine = (sample.split('\n')[0] || '').trim();
  var commentMatch = firstLine.match(/^(?:#|\/\/|\/\*|--|<!--|REM|::|;)\s*([a-zA-Z0-9_\-]+\.([a-zA-Z0-9]{1,8}))\s*(?:\*\/|-->)?$/i);
  if (commentMatch && commentMatch[1]) {
    var detectedName = commentMatch[1];
    var detectedExt = commentMatch[2].toLowerCase();
    if (map[detectedExt] || CODE_EXTENSIONS[detectedExt] || detectedExt === ext) {
      filename = detectedName;
    }
  }

  if (!filename.includes('.') || filename.endsWith('.')) {
    filename = (meta.name || 'code') + '.' + ext;
  }

  var mimeMap = {
    js: 'text/javascript;charset=utf-8',
    ts: 'text/plain;charset=utf-8',
    py: 'text/x-python;charset=utf-8',
    php: 'application/x-httpd-php;charset=utf-8',
    sql: 'application/sql;charset=utf-8',
    json: 'application/json;charset=utf-8',
    md: 'text/markdown;charset=utf-8',
    css: 'text/css;charset=utf-8',
    sh: 'application/x-sh;charset=utf-8',
    ps1: 'text/plain;charset=utf-8',
    yml: 'application/x-yaml;charset=utf-8',
    xml: 'application/xml;charset=utf-8',
    html: 'text/html;charset=utf-8',
    c: 'text/plain;charset=utf-8',
    cpp: 'text/plain;charset=utf-8',
    cs: 'text/plain;charset=utf-8',
    java: 'text/plain;charset=utf-8',
    go: 'text/plain;charset=utf-8',
    rs: 'text/plain;charset=utf-8',
    rb: 'text/plain;charset=utf-8',
    kt: 'text/plain;charset=utf-8',
    swift: 'text/plain;charset=utf-8',
    dart: 'text/plain;charset=utf-8',
    bat: 'text/plain;charset=utf-8',
    cmd: 'text/plain;charset=utf-8',
    txt: 'text/plain;charset=utf-8'
  };

  return {
    filename: filename,
    mime: mimeMap[ext] || 'application/octet-stream'
  };
}

function downloadCodeSnippet(code, lang) {
  var meta = getCodeDownloadMeta(lang, code);
  var filename = meta.filename;
  if (!/\.[a-zA-Z0-9]{1,8}$/.test(filename)) {
    filename = filename + '.txt';
  }

  var blob = new Blob([code], { type: meta.mime });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  a.setAttribute('download', filename);
  document.body.appendChild(a);
  a.click();
  setTimeout(function () {
    try {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {}
  }, 10000);
}

/* ================= Date & Timestamp formatting ================= */
function parseAnyDate(val) {
  if (!val) return null;
  var d;
  if (typeof val === 'number') {
    d = new Date(val);
  } else {
    var str = String(val).trim();
    if (/^\d+$/.test(str)) {
      d = new Date(parseInt(str, 10));
    } else {
      d = new Date(str.replace(' ', 'T'));
    }
  }
  return (d && !isNaN(d.getTime())) ? d : null;
}

function formatMessageTimestamp(val) {
  var d = parseAnyDate(val);
  if (!d) return '';
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var month = months[d.getMonth()];
  var day = d.getDate();
  var hours = d.getHours();
  var minutes = d.getMinutes();
  var ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  var strHours = hours < 10 ? '0' + hours : hours;
  var strMinutes = minutes < 10 ? '0' + minutes : minutes;
  return month + ' ' + day + ', ' + strHours + ':' + strMinutes + ' ' + ampm;
}

function formatFullTimestamp(val) {
  var d = parseAnyDate(val);
  if (!d) return '';
  try {
    return d.toLocaleString('ar-SA', { dateStyle: 'full', timeStyle: 'short' });
  } catch (e) {
    return d.toLocaleString();
  }
}

function formatConversationDateLabel(val) {
  var d = parseAnyDate(val);
  if (!d) return '';
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  var diffDays = Math.round((today - target) / 86400000);
  if (diffDays === 0) return 'اليوم';
  if (diffDays === 1) return 'أمس';
  if (diffDays > 1 && diffDays < 7) {
    var arabicDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return arabicDays[d.getDay()];
  }
  var arabicMonths = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  if (d.getFullYear() !== now.getFullYear()) {
    return d.getDate() + ' ' + arabicMonths[d.getMonth()] + ' ' + d.getFullYear();
  }
  return d.getDate() + ' ' + arabicMonths[d.getMonth()];
}



