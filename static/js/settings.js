/* ================= Profile & Account helpers ================= */
function getProfile() {
  try {
    var raw = localStorage.getItem(LS_PROFILE);
    if (raw) {
      var p = JSON.parse(raw);
      if (p && p.name) return p;
    }
  } catch (e) { }
  return {
    name: 'سامي صالح',
    plan: 'المجانية',
    initials: 'RY',
    email: 'sami.saleh@example.com'
  };
}

function saveProfile(p) {
  try {
    localStorage.setItem(LS_PROFILE, JSON.stringify(p));
  } catch (e) { }
  renderProfileUI(p);
}

function renderProfileUI(p) {
  if (!p) p = getProfile();
  var upPill = $('user-name-pill'); if (upPill) upPill.textContent = p.name;
  var planPill = $('user-plan-pill'); if (planPill) planPill.textContent = p.plan;
  var avPill = $('user-avatar-pill'); if (avPill) avPill.textContent = p.initials;

  var menuName = $('menu-user-name'); if (menuName) menuName.textContent = p.name;
  var menuPlan = $('menu-user-plan'); if (menuPlan) menuPlan.textContent = p.plan;
  var menuAv = $('menu-avatar'); if (menuAv) menuAv.textContent = p.initials;

  var logoutName = $('logout-confirm-name'); if (logoutName) logoutName.textContent = p.name;

  var inpName = $('profile-input-name'); if (inpName) inpName.value = p.name;
  var inpInit = $('profile-input-initials'); if (inpInit) inpInit.value = p.initials;
  var inpEmail = $('profile-input-email'); if (inpEmail) inpEmail.value = p.email || '';
  var inpPlan = $('profile-input-plan'); if (inpPlan) inpPlan.value = p.plan;

  var stAccName = $('st-acc-name-label'); if (stAccName) stAccName.textContent = p.name;
  var stAccPlan = $('st-acc-plan-label'); if (stAccPlan) stAccPlan.textContent = p.plan;
}

function toggleAccountPopover(force) {
  if (!accountPopover) return;
  var willOpen = (typeof force === 'boolean') ? force : !accountPopover.classList.contains('open');
  if (willOpen) {
    accountPopover.classList.add('open');
    accountPopover.setAttribute('aria-hidden', 'false');
    if (accountTrigger) accountTrigger.setAttribute('aria-expanded', 'true');
  } else {
    accountPopover.classList.remove('open');
    accountPopover.setAttribute('aria-hidden', 'true');
    if (accountTrigger) accountTrigger.setAttribute('aria-expanded', 'false');
  }
}

function closeAccountPopover() {
  toggleAccountPopover(false);
}

function openAppModal(id, initialTab) {
  closeAccountPopover();
  var m = $(id);
  if (m) {
    m.classList.remove('hidden');
    if (id === 'modal-settings') {
      switchSettingsTab(initialTab || 'general');
      if (typeof renderModelLocalUI === 'function') {
        renderModelLocalUI();
      }
    }
  }
}

function closeAppModal(id) {
  var m = $(id);
  if (m) m.classList.add('hidden');
}

function switchSettingsTab(tabKey) {
  var tabs = document.querySelectorAll('.st-tab-btn');
  var panels = document.querySelectorAll('.st-panel');
  var targetPanel = $('st-panel-' + tabKey);
  if (!targetPanel) tabKey = 'general';

  tabs.forEach(function (btn) {
    var isTarget = (btn.dataset.tab === tabKey);
    btn.classList.toggle('active', isTarget);
    btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
  });

  panels.forEach(function (p) {
    if (p.id === 'st-panel-' + tabKey) {
      p.classList.remove('hidden');
    } else {
      p.classList.add('hidden');
    }
  });

  if (tabKey === 'model') {
    if (typeof renderModelConfigUI === 'function') renderModelConfigUI();
    if (typeof renderModelLocalUI === 'function') renderModelLocalUI();
  }
  if (tabKey === 'personalization' && typeof renderPersonalizationUI === 'function') {
    renderPersonalizationUI();
  }
  if (tabKey === 'general' && typeof renderProfileUI === 'function') {
    renderProfileUI();
  }
  if (tabKey === 'memory' && typeof window.renderMemoryManager === 'function') {
    renderMemoryManager();
  }
  if (tabKey === 'quickpopup') {
    renderQuickPopupSettings();
  }
}

/* ================= Model & Personalization Settings ================= */
var LS_MODEL_CONFIG = 'mada.custom_model';
var LS_PERSONALIZATION = 'mada.personalization';

function getModelConfig() {
  try {
    var raw = localStorage.getItem(LS_MODEL_CONFIG);
    if (raw) {
      var cfg = JSON.parse(raw);
      if (cfg && cfg.endpoint) return cfg;
    }
  } catch (e) { }
  return {
    endpoint: 'http://127.0.0.1:8081/v1',
    model: 'Qwen3-4B',
    apiKey: '',
    temperature: 0.7,
    maxTokens: 2048
  };
}

function saveModelConfig(cfg) {
  try {
    localStorage.setItem(LS_MODEL_CONFIG, JSON.stringify(cfg));
  } catch (e) { }
  renderModelConfigUI(cfg);
  updateModePill();
}

function renderModelConfigUI(cfg) {
  if (!cfg) cfg = getModelConfig();
  var inpEnd = $('cfg-model-endpoint'); if (inpEnd) inpEnd.value = cfg.endpoint || '';
  var inpMod = $('cfg-model-name'); if (inpMod) inpMod.value = cfg.model || 'Qwen3-4B';
  var inpKey = $('cfg-model-api-key'); if (inpKey) inpKey.value = cfg.apiKey || '';
  var inpTemp = $('cfg-model-temp'); if (inpTemp) inpTemp.value = (cfg.temperature != null ? cfg.temperature : 0.7);
  var lblTemp = $('cfg-model-temp-label'); if (lblTemp) lblTemp.textContent = (cfg.temperature != null ? cfg.temperature : 0.7);
  var selTok = $('cfg-model-max-tokens'); if (selTok) selTok.value = cfg.maxTokens || 2048;
}

function getPersonalization() {
  try {
    var raw = localStorage.getItem(LS_PERSONALIZATION);
    if (raw) {
      var p = JSON.parse(raw);
      if (p) return p;
    }
  } catch (e) { }
  return {
    tone: 'default',
    warmth: 'default',
    enthusiasm: 'default',
    formatting: 'default',
    emojis: 'default',
    fastAnswers: true,
    customInstructions: '',
    prefName: '',
    prefRole: '',
    prefBio: '',
    memoryEnabled: true
  };
}

function savePersonalization(p) {
  try {
    localStorage.setItem(LS_PERSONALIZATION, JSON.stringify(p));
  } catch (e) { }
  renderPersonalizationUI(p);
}

function renderPersonalizationUI(p) {
  if (!p) p = getPersonalization();
  var selTone = $('cfg-tone'); if (selTone) selTone.value = p.tone || 'default';
  var selWarmth = $('cfg-trait-warmth'); if (selWarmth) selWarmth.value = p.warmth || 'default';
  var selEnth = $('cfg-trait-enthusiasm'); if (selEnth) selEnth.value = p.enthusiasm || 'default';
  var selFmt = $('cfg-trait-formatting'); if (selFmt) selFmt.value = p.formatting || 'default';
  var selEmo = $('cfg-trait-emojis'); if (selEmo) selEmo.value = p.emojis || 'default';

  var swFast = $('cfg-switch-fast-answers');
  if (swFast) {
    swFast.classList.toggle('active', p.fastAnswers !== false);
    swFast.setAttribute('aria-checked', p.fastAnswers !== false ? 'true' : 'false');
  }

  var txInst = $('cfg-custom-instructions'); if (txInst) txInst.value = p.customInstructions || '';
  var inName = $('cfg-pref-name'); if (inName) inName.value = p.prefName || '';
  var inRole = $('cfg-pref-role'); if (inRole) inRole.value = p.prefRole || '';
  var inBio = $('cfg-pref-bio'); if (inBio) inBio.value = p.prefBio || '';

  var swMem = $('cfg-switch-memory');
  if (swMem) {
    swMem.classList.toggle('active', p.memoryEnabled !== false);
    swMem.setAttribute('aria-checked', p.memoryEnabled !== false ? 'true' : 'false');
  }
}

function buildPersonalizedSystemPrompt() {
  var p = getPersonalization();
  var parts = [];
  if (p.customInstructions && p.customInstructions.trim()) {
    parts.push('تعليمات مخصصة من المستخدم:\n' + p.customInstructions.trim());
  }
  var userFacts = [];
  if (p.prefName && p.prefName.trim()) userFacts.push('الاسم المفضل للمستخدم: ' + p.prefName.trim());
  if (p.prefRole && p.prefRole.trim()) userFacts.push('الوظيفة/التخصص: ' + p.prefRole.trim());
  if (p.prefBio && p.prefBio.trim()) userFacts.push('معلومات عن المستخدم: ' + p.prefBio.trim());
  if (userFacts.length) {
    parts.push('بيانات المستخدم:\n' + userFacts.join('\n'));
  }
  var toneMap = {
    professional: 'الأسلوب والنبرة: أسلوب مهني واحترافي ورسمي، فصيح ودقيق علمياً.',
    friendly: 'الأسلوب والنبرة: أسلوب ودود ومرح ولطيف وقريب من المستخدم.',
    candid: 'الأسلوب والنبرة: أسلوب صريح ومباشر وواضح دون مجاملات.',
    humorous: 'الأسلوب والنبرة: أسلوب طريف وخفيف الظل وذكي.',
    efficient: 'الأسلوب والنبرة: أسلوب عملي وفعال ومختصر، يركز على الخلاصة السريعة.',
    sarcastic: 'الأسلوب والنبرة: أسلوب ساخر وذكي وممتع.'
  };
  if (p.tone && toneMap[p.tone]) {
    parts.push(toneMap[p.tone]);
  }
  if (p.warmth === 'high') parts.push('درجة الترحيب والود: مرتفعة جداً.');
  if (p.warmth === 'low') parts.push('درجة الترحيب والود: رسمية وموجزة بدون استرسال عاطفي.');
  if (p.enthusiasm === 'high') parts.push('درجة الحماس: عالية ومشجعة ومحفزة.');
  if (p.formatting === 'detailed') parts.push('التنسيق: استخدم عناوين رئيسية وفرعية وقوائم نقطية منظمة جداً.');
  if (p.formatting === 'concise') parts.push('التنسيق: إجابات مركزة ومباشرة بدون إطالة أو حشو.');
  if (p.emojis === 'none') parts.push('توجيه: تجنب تماماً استخدام أي رموز تعبيرية (emojis).');
  if (p.emojis === 'many') parts.push('توجيه: استخدم الرموز التعبيرية المناسبة لإضفاء حيوية وتفاعل.');

  return parts.join('\n\n');
}

function updateThemeCards(currentT) {
  var cards = document.querySelectorAll('.adm-theme-card');
  cards.forEach(function (card) {
    if (card.dataset.themeVal === currentT) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });
}

function setFontSize(sz) {
  document.body.style.fontSize = sz;
  try { localStorage.setItem(LS_FONT, sz); } catch (e) { }
  var sel = $('cfg-font-size');
  if (sel && sel.value !== sz) sel.value = sz;
}

function getFontSize() {
  try { return localStorage.getItem(LS_FONT) || '16px'; } catch (e) { return '16px'; }
}

function setTheme(t) {
  var effectiveTheme = t;
  if (t === 'auto') {
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    effectiveTheme = prefersDark ? 'dark' : 'light';
  }
  htmlRoot.setAttribute('data-theme', effectiveTheme);
  if (iconThemeEl) iconThemeEl.innerHTML = (effectiveTheme === 'dark') ? SVG_SUN : SVG_MOON;
  try { localStorage.setItem(LS_THEME, t); } catch (e) { }
  updateThemeCards(t);
}

function getTheme() {
  try {
    var t = localStorage.getItem(LS_THEME);
    return (t === 'light' || t === 'auto') ? t : 'dark';
  } catch (e) { return 'dark'; }
}

/* ================= لون التطبيق (Accent Color) ================= */
var LS_ACCENT = 'mada.accent_color';

// قائمة الألوان المُعرَّفة مسبقاً مع متغيرات كل لون
var ACCENT_PRESETS = [
  { id: 'blue',   label: 'أزرق (افتراضي)', color: '#0066cc', hover: '#0052a3', soft: 'rgba(0,102,204,.12)',  ink: '#0052a3',  ring: 'rgba(0,102,204,.35)', grad: 'linear-gradient(135deg,#0066cc,#38bdf8)' },
  { id: 'indigo', label: 'نيلي',           color: '#4f46e5', hover: '#4338ca', soft: 'rgba(79,70,229,.12)',  ink: '#4338ca',  ring: 'rgba(79,70,229,.35)',  grad: 'linear-gradient(135deg,#4f46e5,#818cf8)' },
  { id: 'violet', label: 'بنفسجي',         color: '#7c3aed', hover: '#6d28d9', soft: 'rgba(124,58,237,.12)', ink: '#6d28d9',  ring: 'rgba(124,58,237,.35)', grad: 'linear-gradient(135deg,#7c3aed,#a78bfa)' },
  { id: 'rose',   label: 'وردي',           color: '#e11d48', hover: '#be123c', soft: 'rgba(225,29,72,.12)',  ink: '#be123c',  ring: 'rgba(225,29,72,.35)',  grad: 'linear-gradient(135deg,#e11d48,#fb7185)' },
  { id: 'amber',  label: 'عنبري',          color: '#d97706', hover: '#b45309', soft: 'rgba(217,119,6,.12)',  ink: '#b45309',  ring: 'rgba(217,119,6,.35)',  grad: 'linear-gradient(135deg,#d97706,#fbbf24)' },
  { id: 'emerald',label: 'زمردي',          color: '#059669', hover: '#047857', soft: 'rgba(5,150,105,.12)',  ink: '#047857',  ring: 'rgba(5,150,105,.35)',  grad: 'linear-gradient(135deg,#059669,#34d399)' },
  { id: 'teal',   label: 'أخضر مائي',     color: '#0891b2', hover: '#0e7490', soft: 'rgba(8,145,178,.12)',  ink: '#0e7490',  ring: 'rgba(8,145,178,.35)',  grad: 'linear-gradient(135deg,#0891b2,#22d3ee)' },
  { id: 'slate',  label: 'رمادي',          color: '#475569', hover: '#334155', soft: 'rgba(71,85,105,.12)',  ink: '#334155',  ring: 'rgba(71,85,105,.35)',  grad: 'linear-gradient(135deg,#475569,#94a3b8)' },
];

function _hexToRgbaSoft(hex, a) {
  var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return 'rgba('+r+','+g+','+b+','+a+')';
}

function applyAccentVars(color, hover, soft, ink, ring, grad) {
  var root = document.documentElement;
  root.style.setProperty('--accent',       color);
  root.style.setProperty('--accent-hover', hover);
  root.style.setProperty('--accent-soft',  soft);
  root.style.setProperty('--accent-ink',   ink);
  root.style.setProperty('--ring',         ring);
  root.style.setProperty('--grad',         grad);
  root.style.setProperty('--blue-accent',  color);
}

function setAccentColor(idOrHex) {
  var preset = null;
  for (var i = 0; i < ACCENT_PRESETS.length; i++) {
    if (ACCENT_PRESETS[i].id === idOrHex) { preset = ACCENT_PRESETS[i]; break; }
  }
  var saved;
  if (preset) {
    applyAccentVars(preset.color, preset.hover, preset.soft, preset.ink, preset.ring, preset.grad);
    saved = { id: preset.id, color: preset.color };
  } else if (/^#[0-9a-fA-F]{6}$/.test(idOrHex)) {
    // لون مخصص — نحسب المتغيرات تلقائياً
    var c = idOrHex;
    var hover  = idOrHex;   // نستخدم نفس اللون (يمكن التحسين لاحقاً)
    var soft   = _hexToRgbaSoft(c, 0.12);
    var ring   = _hexToRgbaSoft(c, 0.35);
    applyAccentVars(c, hover, soft, c, ring, 'linear-gradient(135deg,'+c+','+c+'cc)');
    saved = { id: 'custom', color: c };
  } else {
    return; // قيمة غير صالحة
  }
  try { localStorage.setItem(LS_ACCENT, JSON.stringify(saved)); } catch(e) {}
  _updateAccentSwatches(saved.id !== 'custom' ? saved.id : saved.color);
}

function getAccentColor() {
  try {
    var raw = localStorage.getItem(LS_ACCENT);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return null; // null = استخدم ألوان variables.css الافتراضية
}

function applyAccentColor() {
  var saved = getAccentColor();
  if (!saved) return; // لا تعديل — استخدم القيم الافتراضية في CSS
  setAccentColor(saved.id !== 'custom' ? saved.id : saved.color);
}

function _updateAccentSwatches(activeIdOrHex) {
  var container = $('accent-swatches');
  if (!container) return;
  var btns = container.querySelectorAll('.accent-swatch');
  btns.forEach(function(btn) {
    var v = btn.dataset.accentId || btn.dataset.accentColor;
    btn.classList.toggle('accent-swatch--active', v === activeIdOrHex);
  });
  var custom = $('accent-custom-input');
  if (custom && /^#/.test(activeIdOrHex)) custom.value = activeIdOrHex;
}

function initAccentSwatches() {
  var container = $('accent-swatches');
  if (!container || container.dataset.bound) return;
  container.dataset.bound = '1';

  // إنشاء الأزرار الجاهزة
  ACCENT_PRESETS.forEach(function(p) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.title = p.label;
    btn.dataset.accentId = p.id;
    btn.className = 'accent-swatch';
    btn.style.cssText = 'width:26px;height:26px;border-radius:50%;background:'+p.color+';border:2.5px solid transparent;cursor:pointer;transition:transform .15s,border-color .15s;flex-shrink:0;';
    btn.addEventListener('click', function() { setAccentColor(p.id); });
    btn.addEventListener('mouseenter', function() { btn.style.transform='scale(1.2)'; });
    btn.addEventListener('mouseleave', function() { btn.style.transform='scale(1)'; });
    container.appendChild(btn);
  });

  // زر اللون المخصص
  var custom = $('accent-custom-input');
  if (custom) {
    custom.addEventListener('input', function() {
      if (/^#[0-9a-fA-F]{6}$/.test(custom.value)) setAccentColor(custom.value);
    });
  }

  // زر إعادة التعيين
  var reset = $('accent-reset-btn');
  if (reset) {
    reset.addEventListener('click', function() {
      try { localStorage.removeItem(LS_ACCENT); } catch(e) {}
      document.documentElement.style.removeProperty('--accent');
      document.documentElement.style.removeProperty('--accent-hover');
      document.documentElement.style.removeProperty('--accent-soft');
      document.documentElement.style.removeProperty('--accent-ink');
      document.documentElement.style.removeProperty('--ring');
      document.documentElement.style.removeProperty('--grad');
      document.documentElement.style.removeProperty('--blue-accent');
      _updateAccentSwatches('blue');
    });
  }

  // تطبيق اللون المحفوظ مع تحديد الزر النشط
  var saved = getAccentColor();
  if (saved) _updateAccentSwatches(saved.id !== 'custom' ? saved.id : saved.color);
  else _updateAccentSwatches('blue');
}

/* ================= البوب-أب السريع (Quick Popup) ================= */
var _qpBound = false;

function uiToast(msg, err) {
  var el = $('app-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'app-toast';
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1d2939;color:#fff;padding:9px 16px;border-radius:999px;font-size:13px;z-index:99999;box-shadow:0 4px 14px rgba(0,0,0,.25);transition:opacity .3s;pointer-events:none;max-width:90vw;';
    document.body.appendChild(el);
  }
  el.style.background = err ? '#a43a32' : '#1d2939';
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(function () { el.style.opacity = '0'; }, 2600);
}

function setSwitchState(id, on) {
  var el = $(id);
  if (!el) return;
  el.classList.toggle('active', !!on);
  el.setAttribute('aria-checked', on ? 'true' : 'false');
}

function qpHotkeyWarning(val) {
  var warn = $('qp-warn');
  if (!warn) return;
  var s = String(val || '').toLowerCase();
  var parts = s.split('+').map(function (p) { return p.trim(); }).filter(Boolean);
  var key = parts.length ? parts[parts.length - 1] : '';
  var show = (key === 'space');
  warn.classList.toggle('hidden', !show);
}

function qpPost(payload, okMsg) {
  return fetch('/api/bg', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(function (r) { return r.json(); }).then(function (d) {
    if (d && d.ok) { if (okMsg) uiToast(okMsg); return d.settings; }
    uiToast('تعذر حفظ الإعدادات', true);
    return null;
  }).catch(function () {
    uiToast('الخادم غير متصل', true);
    return null;
  });
}

/* ================= مسجّل الاختصارات التفاعلي (Interactive Hotkey Recorder) ================= */
function bindHotkeyRecorder(input) {
  if (!input || input._hotkeyBound) return;
  input._hotkeyBound = true;
  input.classList.add('st-hotkey-input');

  var SPECIAL_MAP = {
    'Space': 'Space',
    'Enter': 'Enter',
    'Tab': 'Tab',
    'Backspace': 'Back',
    'Delete': 'Delete',
    'Insert': 'Insert',
    'Escape': 'Esc',
    'Home': 'Home',
    'End': 'End',
    'PageUp': 'PageUp',
    'PageDown': 'PageDown',
    'ArrowUp': 'Up',
    'ArrowDown': 'Down',
    'ArrowLeft': 'Left',
    'ArrowRight': 'Right'
  };

  input.dataset.placeholderDefault = input.placeholder || '';

  function startRecord() {
    input._recording = true;
    input._originalVal = input.value;
    input.classList.add('is-recording');
    input.placeholder = 'اضغط على المفاتيح معاً...';
  }

  function stopRecord(restoreIfEmpty) {
    if (!input._recording) return;
    input._recording = false;
    input.classList.remove('is-recording');
    if (restoreIfEmpty && !input.value.trim()) {
      input.value = input._originalVal || '';
    }
    input.placeholder = input.dataset.placeholderDefault || 'Ctrl+Alt+Space';
    if (typeof qpHotkeyWarning === 'function') {
      qpHotkeyWarning(input.value);
    }
  }

  input.addEventListener('focus', function () {
    startRecord();
  });

  input.addEventListener('click', function () {
    startRecord();
  });

  input.addEventListener('blur', function () {
    if (input.value.endsWith('+...') || input.value.endsWith('+')) {
      input.value = input._originalVal || '';
    }
    stopRecord(true);
  });

  input.addEventListener('keydown', function (e) {
    if (!input._recording) {
      startRecord();
    }

    e.preventDefault();
    e.stopPropagation();

    // إلغاء التسجيل بمفتاح Esc المفرد
    if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
      input.value = input._originalVal || '';
      stopRecord(false);
      input.blur();
      return;
    }

    // تفريغ الحقل بمفتاح Backspace أو Delete المفرد
    if ((e.key === 'Backspace' || e.key === 'Delete') && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
      input.value = '';
      stopRecord(false);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.blur();
      return;
    }

    var isModifierOnly = (
      e.key === 'Control' || e.key === 'Alt' || e.key === 'Shift' || e.key === 'Meta'
    );

    var parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Win');

    if (isModifierOnly) {
      input.value = parts.length ? (parts.join('+') + '+...') : '';
      return;
    }

    // استخراج المفتاح الرئيسي غير المعدل
    var keyName = null;

    if (e.code === 'Space' || e.key === ' ' || e.key === 'Space') {
      keyName = 'Space';
    } else if (e.code && e.code.indexOf('Key') === 0 && e.code.length === 4) {
      // المفتاح الفيزيائي بالحروف اللاتينية حتى لو كانت لوحة المفاتيح عربية
      keyName = e.code.slice(3).toUpperCase();
    } else if (e.code && e.code.indexOf('Digit') === 0) {
      keyName = e.code.slice(5);
    } else if (e.code && e.code.indexOf('Numpad') === 0 && e.code.length === 7 && !isNaN(e.code.slice(6))) {
      keyName = e.code.slice(6);
    } else if (e.code && /^F([1-9]|1[0-9]|2[0-4])$/i.test(e.code)) {
      keyName = e.code.toUpperCase();
    } else if (SPECIAL_MAP[e.key] || SPECIAL_MAP[e.code]) {
      keyName = SPECIAL_MAP[e.key] || SPECIAL_MAP[e.code];
    } else if (e.key && e.key.length === 1 && /^[a-zA-Z0-9]$/.test(e.key)) {
      keyName = e.key.toUpperCase();
    }

    if (!keyName) return;

    parts.push(keyName);
    var finalShortcut = parts.join('+');

    input.value = finalShortcut;
    stopRecord(false);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();
  });
}

function initHotkeyRecorders() {
  document.querySelectorAll('input[data-hotkey="true"], .st-hotkey-input').forEach(function (inp) {
    bindHotkeyRecorder(inp);
  });
}

function renderQuickPopupSettings() {
  initHotkeyRecorders();
  if (!_qpBound) {
    _qpBound = true;
    var swEn = $('cfg-qp-enabled');
    if (swEn) swEn.addEventListener('click', function () {
      var on = swEn.classList.contains('active');
      qpPost({ enabled: on }, on ? 'تم تفعيل البوب-أب السريع (سيُطلق خلال ثوانٍ)' : 'تم إيقاف البوب-أب السريع');
    });
    var swSv = $('cfg-qp-save');
    if (swSv) swSv.addEventListener('click', function () {
      qpPost({ saveReplies: swSv.classList.contains('active') });
    });
    var hk = $('cfg-qp-hotkey');
    if (hk) {
      bindHotkeyRecorder(hk);
      hk.addEventListener('input', function () { qpHotkeyWarning(hk.value); });
    }
    var rk = $('cfg-qp-reopen');
    if (rk) {
      bindHotkeyRecorder(rk);
    }
    var btnSave = $('btn-save-quickpopup');
    if (btnSave) btnSave.addEventListener('click', function () {
      var payload = {
        enabled: $('cfg-qp-enabled') ? $('cfg-qp-enabled').classList.contains('active') : false,
        hotkey: (hk ? hk.value : '').trim(),
        reopen_hotkey: $('cfg-qp-reopen') ? $('cfg-qp-reopen').value.trim() : '',
        length: $('cfg-qp-length') ? $('cfg-qp-length').value : 'short',
        custom_command: $('cfg-qp-command') ? $('cfg-qp-command').value : '',
        duration: $('cfg-qp-duration') ? (function () {
          var v = parseFloat($('cfg-qp-duration').value);
          return (!isNaN(v) && v > 0) ? Math.max(0.1, Math.min(30, Math.round(v * 100) / 100)) : 3;
        })() : 3,
        position: $('cfg-qp-position') ? $('cfg-qp-position').value : 'right',
        color: $('cfg-qp-color') ? $('cfg-qp-color').value : 'light',
        size: $('cfg-qp-size') ? $('cfg-qp-size').value : 'medium',
        saveReplies: $('cfg-qp-save') ? $('cfg-qp-save').classList.contains('active') : true,
        opacity: $('cfg-qp-opacity') ? (parseInt($('cfg-qp-opacity').value, 10) / 100) : 1.0
      };
      qpPost(payload, 'تم حفظ وتطبيق إعدادات البوب-أب');
    });

    // شريط الشفافية — تحديث العرض فوراً
    var opSlider = $('cfg-qp-opacity');
    var opVal = $('cfg-qp-opacity-val');
    if (opSlider && opVal) {
      opSlider.addEventListener('input', function () {
        opVal.textContent = opSlider.value + '%';
      });
    }
  }

  fetch('/api/bg').then(function (r) { return r.json(); }).then(function (d) {
    var s = (d && d.settings) || {};
    setSwitchState('cfg-qp-enabled', s.enabled !== false);
    var hk = $('cfg-qp-hotkey'); if (hk) hk.value = s.hotkey || 'Ctrl+Q';
    var rk = $('cfg-qp-reopen'); if (rk) rk.value = s.reopen_hotkey || 'Ctrl+Alt+Q';
    var ln = $('cfg-qp-length'); if (ln) ln.value = s.length || 'short';
    var cc = $('cfg-qp-command'); if (cc) cc.value = s.custom_command || '';
    var du = $('cfg-qp-duration'); if (du) du.value = s.duration != null ? s.duration : 3;
    var po = $('cfg-qp-position'); if (po) po.value = s.position || 'right';
    var co = $('cfg-qp-color'); if (co) co.value = s.color || 'dark';
    var sz = $('cfg-qp-size');
    if (sz) {
      if (s.size === 'custom' && s.custom_width && s.custom_height) {
        var opt = sz.querySelector('option[value="custom"]');
        if (opt) opt.textContent = 'مخصص (' + s.custom_width + '×' + s.custom_height + 'px)';
      }
      sz.value = s.size || 'medium';
    }
    setSwitchState('cfg-qp-save', s.saveReplies !== false);
    var op = $('cfg-qp-opacity');
    var opV = $('cfg-qp-opacity-val');
    if (op) {
      var pct = Math.round((s.opacity != null ? parseFloat(s.opacity) : 1.0) * 100);
      op.value = pct;
      if (opV) opV.textContent = pct + '%';
    }
    qpHotkeyWarning(s.hotkey || '');
  }).catch(function () { });
}

/* ================= النموذج المحلي (مسار + أداء) ================= */
var _mlBound = false;

function saveLocalModelSettings(callback) {
  var bs = $('btn-save-llm-local');
  var origText = bs ? bs.textContent : '⚡ إعادة تشغيل النموذج المحلي وتطبيق الإعدادات';
  if (bs) {
    bs.disabled = true;
    bs.textContent = 'جاري الحفظ وإعادة التشغيل...';
  }
  var body = {
    spec: $('cfg-llm-spec') ? $('cfg-llm-spec').value : 'auto',
    exe: $('cfg-llm-exe') ? $('cfg-llm-exe').value.trim() : '',
    model: $('cfg-llm-model') ? $('cfg-llm-model').value.trim() : ''
  };
  return fetch('/api/model', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(function (r) { return r.json(); }).then(function (d) {
    if (d && d.ok) {
      uiToast(d.restarted ? '⚡ تم حفظ المسارات وإعادة تشغيل النموذج المحلي بنجاح' : 'تم حفظ إعدادات النموذج المحلي');
      fillModelLocalUI(d.model);
      if (typeof callback === 'function') callback(null, d);
    } else {
      uiToast('تعذر حفظ إعدادات النموذج المحلي', true);
      if (typeof callback === 'function') callback(new Error('Save failed'));
    }
  }).catch(function (err) {
    uiToast('الخادم غير متصل', true);
    if (typeof callback === 'function') callback(err);
  }).finally(function () {
    if (bs) {
      bs.disabled = false;
      bs.textContent = origText;
    }
  });
}

/* ================= مستكشف الملفات المدمج داخل المتصفح (In-App File Explorer) ================= */
var _currentFpKind = 'exe';
var _currentFpTargetId = 'cfg-llm-exe';
var _currentFpPath = '';
var _lastDiscovered = null;
var _fpEventsBound = false;

function openFilePickerModal(kind, targetInputId) {
  _currentFpKind = kind;
  _currentFpTargetId = targetInputId;

  var titleEl = $('fp-modal-title');
  var iconEl = $('fp-modal-icon');
  if (titleEl) titleEl.textContent = (kind === 'exe' ? 'اختيار مشغل llama-server.exe' : 'اختيار ملف النموذج (.gguf)');
  if (iconEl) iconEl.textContent = (kind === 'exe' ? '⚙️' : '🧠');

  var targetInp = $(targetInputId);
  var selInp = $('fp-selected-path');
  if (selInp) selInp.value = (targetInp && targetInp.value) ? targetInp.value.trim() : '';

  // ربط أزرار المودال لمرة واحدة
  if (!_fpEventsBound) {
    _fpEventsBound = true;
    var btnConfirm = $('fp-btn-confirm');
    if (btnConfirm) {
      btnConfirm.addEventListener('click', function () {
        var sp = $('fp-selected-path');
        if (sp && sp.value.trim()) {
          selectPathAndClose(sp.value.trim());
        } else {
          uiToast('يرجى تحديد أو لصق مسار ملف أولاً', true);
        }
      });
    }

    var btnGo = $('fp-btn-go');
    if (btnGo) {
      btnGo.addEventListener('click', function () {
        var cp = $('fp-current-path');
        if (cp && cp.value.trim()) loadFpDirectory(cp.value.trim());
      });
    }

    var btnOpenOs = $('fp-btn-open-os');
    if (btnOpenOs) {
      btnOpenOs.addEventListener('click', function () {
        pickNativeFile(_currentFpKind, _currentFpTargetId, btnOpenOs, function (chosenPath) {
          selectPathAndClose(chosenPath);
        });
      });
    }
  }

  // عرض الملفات المكتشفة تلقائياً في أعلى المودال
  var discBox = $('fp-discovered-box');
  var discItems = $('fp-discovered-items');
  if (discBox && discItems) {
    discItems.innerHTML = '';
    var list = (_lastDiscovered && _lastDiscovered[kind === 'exe' ? 'exes' : 'models']) || [];
    if (list.length) {
      discBox.style.display = 'block';
      list.forEach(function (p) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:8px 12px;cursor:pointer;transition:border-color .15s ease;';
        row.innerHTML = '<div style="font-family:var(--font-mono, monospace);font-size:12px;direction:ltr;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;color:var(--text);">' + p + '</div><button class="adm-btn adm-btn-accent" type="button" style="padding:4px 10px;font-size:11.5px;white-space:nowrap;">اختيار هذا</button>';
        row.addEventListener('click', function () {
          selectPathAndClose(p);
        });
        discItems.appendChild(row);
      });
    } else {
      discBox.style.display = 'none';
    }
  }

  // تحديد مسار البداية
  var initialDir = '';
  if (targetInp && targetInp.value) {
    var parts = targetInp.value.trim().split(/[\\\/]/);
    parts.pop();
    initialDir = parts.join('\\');
  }
  loadFpDirectory(initialDir || '');

  openAppModal('modal-file-picker');
}

function loadFpDirectory(dirPath) {
  var listContainer = $('fp-explorer-list');
  if (listContainer) {
    listContainer.innerHTML = '<div style="padding:25px;text-align:center;color:var(--muted);font-size:13px;">جاري قراءة محتويات المجلد...</div>';
  }

  var url = '/api/fs/ls?kind=' + encodeURIComponent(_currentFpKind) + (dirPath ? ('&path=' + encodeURIComponent(dirPath)) : '');
  fetch(url).then(function (r) { return r.json(); }).then(function (d) {
    if (!d || !d.ok) {
      if (listContainer) listContainer.innerHTML = '<div style="padding:25px;text-align:center;color:#e5484d;font-size:13px;">تعذر فتح هذا المجلد أو لا توجد صلاحيات وصول كافية.</div>';
      return;
    }

    _currentFpPath = d.current;
    var inpCur = $('fp-current-path');
    if (inpCur) inpCur.value = d.current;

    // أزرار الأقراص
    var drivesCont = $('fp-drives-list');
    if (drivesCont && Array.isArray(d.drives)) {
      drivesCont.innerHTML = '<span style="font-size:12px;color:var(--muted);align-self:center;font-weight:600;">الأقراص:</span>';
      d.drives.forEach(function (drv) {
        var b = document.createElement('button');
        b.type = 'button';
        var isActive = d.current.toUpperCase().startsWith(drv.toUpperCase());
        b.className = 'adm-btn' + (isActive ? ' adm-btn-accent' : '');
        b.style.cssText = 'padding:3px 10px;font-size:12px;font-weight:700;';
        b.textContent = drv;
        b.addEventListener('click', function () { loadFpDirectory(drv); });
        drivesCont.appendChild(b);
      });
    }

    // زر مجلد للأعلى
    var btnUp = $('fp-btn-up');
    if (btnUp) {
      btnUp.disabled = !d.parent;
      btnUp.onclick = function () {
        if (d.parent) loadFpDirectory(d.parent);
      };
    }

    // قائمة المجلدات والملفات
    if (listContainer) {
      listContainer.innerHTML = '';
      if (!d.dirs.length && !d.files.length) {
        listContainer.innerHTML = '<div style="padding:30px;text-align:center;color:var(--muted);font-size:13px;">المجلد فارغ من الملفات المطابقة.</div>';
        return;
      }

      // 1. المجلدات أولاً
      d.dirs.forEach(function (folder) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:6px;cursor:pointer;transition:background .12s ease;border-bottom:1px solid rgba(0,0,0,0.04);';
        row.onmouseover = function () { row.style.background = 'var(--panel-hover)'; };
        row.onmouseout = function () { row.style.background = 'transparent'; };
        row.innerHTML = '<span style="font-size:16px;">📁</span><span style="flex:1;direction:ltr;text-align:left;font-size:13px;font-weight:600;color:var(--text);">' + folder + '</span><span style="font-size:11px;color:var(--muted);">مجلد</span>';
        row.addEventListener('click', function () {
          var sep = _currentFpPath.endsWith('\\') || _currentFpPath.endsWith('/') ? '' : '\\';
          loadFpDirectory(_currentFpPath + sep + folder);
        });
        listContainer.appendChild(row);
      });

      // 2. الملفات المطابقة
      d.files.forEach(function (file) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:6px;cursor:pointer;transition:background .12s ease;background:var(--accent-soft, rgba(59,130,246,0.06));border:1px solid var(--accent, #3b82f6);margin-top:4px;';
        var icon = (_currentFpKind === 'exe' ? '⚙️' : '🧠');
        row.innerHTML = '<span style="font-size:16px;">' + icon + '</span><span style="flex:1;direction:ltr;text-align:left;font-size:13px;font-weight:700;color:var(--text);font-family:var(--font-mono, monospace);">' + file.name + '</span><span style="font-size:11.5px;color:var(--muted);white-space:nowrap;font-weight:600;">' + file.size + '</span>';
        row.addEventListener('click', function () {
          var selInp = $('fp-selected-path');
          if (selInp) selInp.value = file.path;
          selectPathAndClose(file.path);
        });
        listContainer.appendChild(row);
      });
    }
  }).catch(function () {
    if (listContainer) listContainer.innerHTML = '<div style="padding:25px;text-align:center;color:#e5484d;font-size:13px;">تعذر الاتصال بالخادم لجلب الملفات.</div>';
  });
}

function selectPathAndClose(path) {
  if (!path) return;
  var target = $(_currentFpTargetId);
  if (target) {
    target.value = path;
    target.style.borderColor = 'var(--accent)';
    setTimeout(function () { target.style.borderColor = ''; }, 1500);
  }
  closeAppModal('modal-file-picker');
  var filename = path.replace(/^.*[\\\/]/, '');
  uiToast('تم اختيار: ' + filename);
}

function renderDiscoveredFiles(disc) {
  if (!disc) return;
  _lastDiscovered = disc;
  var contExe = $('cfg-llm-exe-discovered');
  if (contExe && Array.isArray(disc.exes) && disc.exes.length) {
    contExe.innerHTML = '<span style="font-size:11.5px;color:var(--muted);align-self:center;">ملفات مكتشفة تلقائياً:</span>';
    disc.exes.forEach(function (p) {
      var badge = document.createElement('span');
      badge.className = 'st-badge-preset';
      badge.title = p;
      var shortName = p.indexOf('win-avx-cuda') !== -1 ? '⚡ llama-server.exe (CUDA GPU)' : '⚡ llama-server.exe';
      badge.textContent = shortName;
      badge.addEventListener('click', function () {
        var inp = $('cfg-llm-exe');
        if (inp) {
          inp.value = p;
          inp.style.borderColor = 'var(--accent)';
          setTimeout(function () { inp.style.borderColor = ''; }, 1200);
        }
        uiToast('تم تحديد مسار المشغّل: ' + p.replace(/^.*[\\\/]/, ''));
      });
      contExe.appendChild(badge);
    });
  }

  var contMod = $('cfg-llm-model-discovered');
  if (contMod && Array.isArray(disc.models) && disc.models.length) {
    contMod.innerHTML = '<span style="font-size:11.5px;color:var(--muted);align-self:center;">نماذج مكتشفة تلقائياً:</span>';
    disc.models.forEach(function (p) {
      var parts = p.split(/[\\\/]/);
      var folderName = parts.length > 2 ? parts[parts.length - 2] : '';
      var fileName = parts[parts.length - 1];
      var displayLabel = folderName ? (folderName + ' / ' + fileName) : fileName;
      if (displayLabel.length > 28) displayLabel = displayLabel.substring(0, 26) + '...';

      var badge = document.createElement('span');
      badge.className = 'st-badge-preset';
      badge.title = p;
      badge.textContent = '⚡ ' + displayLabel;
      badge.addEventListener('click', function () {
        var inp = $('cfg-llm-model');
        if (inp) {
          inp.value = p;
          inp.style.borderColor = 'var(--accent)';
          setTimeout(function () { inp.style.borderColor = ''; }, 1200);
        }
        uiToast('تم تحديد النموذج: ' + (folderName || fileName));
      });
      contMod.appendChild(badge);
    });
  }
}

function pickNativeFile(kind, inputId, btnEl, onComplete) {
  var origText = btnEl ? (btnEl.getAttribute('data-orig-text') || btnEl.textContent) : '📁 اختيار...';
  if (btnEl) {
    if (!btnEl.getAttribute('data-orig-text')) btnEl.setAttribute('data-orig-text', origText);
    btnEl.disabled = true;
    btnEl.textContent = '⏳ جاري الفتح...';
  }

  var currentVal = '';
  var inp = $(inputId);
  if (inp && inp.value) currentVal = inp.value.trim();

  var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var timer = null;
  if (ctrl) {
    timer = setTimeout(function () {
      try { ctrl.abort(); } catch (e) { }
    }, 120000);
  }

  fetch('/api/model/pick', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: kind, current_path: currentVal }),
    signal: ctrl ? ctrl.signal : undefined
  }).then(function (r) {
    if (timer) clearTimeout(timer);
    return r.json();
  }).then(function (d) {
    if (d && d.ok && d.path) {
      if (inp) {
        inp.value = d.path;
        inp.style.borderColor = 'var(--accent, #3b82f6)';
        setTimeout(function () { inp.style.borderColor = ''; }, 1500);
      }
      var fn = d.path.replace(/^.*[\\\/]/, '');
      uiToast('تم اختيار: ' + fn);
      if (typeof onComplete === 'function') onComplete(d.path);
    } else if (d && d.ok && !d.path) {
      // ألغى المستخدم النافذة دون اختيار
    } else {
      uiToast('تعذر فتح متصفح ملفات ويندوز، يمكنك استخدام زر «استعراض» أو لصق المسار يدوياً', true);
    }
  }).catch(function (err) {
    if (timer) clearTimeout(timer);
    if (!err || err.name !== 'AbortError') {
      uiToast('تعذر الاتصال بالخادم لفتح متصفح الملفات', true);
    }
  }).finally(function () {
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.textContent = btnEl.getAttribute('data-orig-text') || origText;
    }
  });
}

function renderModelLocalUI() {
  if (!_mlBound) {
    _mlBound = true;

    // زر متصفح ويندوز الأصلي للمشغل
    var b1 = $('btn-pick-llm-exe');
    if (b1) {
      b1.addEventListener('click', function () {
        pickNativeFile('exe', 'cfg-llm-exe', b1);
      });
    }

    // زر استعراض المجلدات عبر المتصفح للمشغل
    var br1 = $('btn-browse-llm-exe');
    if (br1) {
      br1.addEventListener('click', function () {
        openFilePickerModal('exe', 'cfg-llm-exe');
      });
    }

    // زر متصفح ويندوز الأصلي للنموذج
    var b2 = $('btn-pick-llm-model');
    if (b2) {
      b2.addEventListener('click', function () {
        pickNativeFile('model', 'cfg-llm-model', b2);
      });
    }

    // زر استعراض المجلدات عبر المتصفح للنموذج
    var br2 = $('btn-browse-llm-model');
    if (br2) {
      br2.addEventListener('click', function () {
        openFilePickerModal('model', 'cfg-llm-model');
      });
    }

    var bs = $('btn-save-llm-local');
    if (bs) bs.addEventListener('click', function () { saveLocalModelSettings(); });
  }

  fetch('/api/model').then(function (r) { return r.json(); }).then(function (d) {
    if (d && d.ok) {
      fillModelLocalUI(d.model);
      if (d.discovered) renderDiscoveredFiles(d.discovered);
    }
  }).catch(function () { });
}

function fillModelLocalUI(m) {
  if (!m) return;
  var e = $('cfg-llm-exe'); if (e && !e.value) e.value = m.exe || '';
  var g = $('cfg-llm-model'); if (g && !g.value) g.value = m.model || '';
  var sp = $('cfg-llm-spec'); if (sp) sp.value = m.spec || 'auto';
  var st = $('cfg-llm-status');
  if (st) {
    var lines = [];
    if (m.hardware) {
      var hw = m.hardware;
      var gpuStr = hw.has_nvidia ? (hw.gpu_name + ' (' + (hw.gpu_vram_mb >= 1024 ? (hw.gpu_vram_mb / 1024).toFixed(1) + ' GB' : hw.gpu_vram_mb + ' MB') + ' VRAM)') : 'لا يوجد كارت NVIDIA خارجي منفصل';
      lines.push('🖥️ العتاد المكتشف: ' + gpuStr + ' | الرام: ' + hw.ram_total_gb + ' GB (' + hw.cpu_cores + ' أنوية معالج)');
    }
    var eff = m.effective_spec || m.spec || 'auto';
    var specLabel = (m.spec === 'auto' ? 'تلقائي ذكي ⚡ (' + eff + ')' : eff);
    lines.push('⚙️ الوضع النشط: ' + specLabel + ' — طبقات GPU: ' + m.ngl + ' | حجم السياق (ctx): ' + m.ctx + ' | خيوط المعالج: ' + m.threads);
    if (m.reason) lines.push('💡 ' + m.reason);
    st.textContent = lines.join('\n');
  }
}

window.renderModelLocalUI = renderModelLocalUI;
window.saveLocalModelSettings = saveLocalModelSettings;
window.openFilePickerModal = openFilePickerModal;

