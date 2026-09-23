/* ================= Profile & Account helpers ================= */
function getProfile() {
  try {
    var raw = localStorage.getItem(LS_PROFILE);
    if (raw) {
      var p = JSON.parse(raw);
      if (p && p.name) return p;
    }
  } catch (e) {}
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
  } catch (e) {}
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

  if (tabKey === 'memory' && typeof window.renderMemoryManager === 'function') {
    renderMemoryManager();
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
  } catch (e) {}
  return {
    endpoint: 'http://127.0.0.1:8080/v1',
    model: 'Qwen3-4B',
    apiKey: '',
    temperature: 0.7,
    maxTokens: 2048
  };
}

function saveModelConfig(cfg) {
  try {
    localStorage.setItem(LS_MODEL_CONFIG, JSON.stringify(cfg));
  } catch (e) {}
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
  } catch (e) {}
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
  } catch (e) {}
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
  try { localStorage.setItem(LS_FONT, sz); } catch (e) {}
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
  try { localStorage.setItem(LS_THEME, t); } catch (e) {}
  updateThemeCards(t);
}

function getTheme() {
  try {
    var t = localStorage.getItem(LS_THEME);
    return (t === 'light' || t === 'auto') ? t : 'dark';
  } catch (e) { return 'dark'; }
}

