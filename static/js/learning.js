/* ============== ذاكرة التعلم: كشف الخطأ + تأكيد + حفظ في ذاكرة الخادم ============== */
(function () {
  var chipActive = false;
  var cachedRules = null;

  function memoryIsEnabled() {
    try {
      return getPersonalization().memoryEnabled !== false;
    } catch (e) { return true; }
  }

  function fetchRules(force) {
    if (cachedRules && !force) return Promise.resolve(cachedRules);
    return fetch('/api/memory')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        cachedRules = (d && d.rules) || [];
        return cachedRules;
      })
      .catch(function () { return []; });
  }

  /* قواعد كشف حتمية عالية الدقة: لا تُصدر إلا ما هو مؤكد */
  var DETECTORS = [
    {
      name: 'ta-marbuta-dup',
      reason: 'تكرار التاء المربوطة في نهاية الكلمة',
      regex: /([\u0600-\u06FF]+)ةة/g,
      fix: function (wrong) { return wrong.slice(0, -1); /* إزالة آخر ة */ }
    }
  ];

  function detectIssues(text) {
    if (!text || text.length < 30) return [];
    var issues = [];
    var seen = {};
    for (var d = 0; d < DETECTORS.length; d++) {
      var det = DETECTORS[d];
      var m;
      det.regex.lastIndex = 0;
      while ((m = det.regex.exec(text)) !== null) {
        /* وسّع ليشمل كلمة واحدة سابقة فقط (لا بداية الجملة) */
        var start = m.index;
        var crossedSpace = false;
        while (start > 0) {
          var ch = text.charAt(start - 1);
          if (/[\u0600-\u06FF]/.test(ch)) { start--; continue; }
          if (ch === ' ' && !crossedSpace) {
            crossedSpace = true;
            start--;
            continue;
          }
          break;
        }
        var wrong = text.slice(start, m.index + m[0].length).trim();
        var correct = det.fix(wrong);
        if (!wrong || !correct || wrong === correct || wrong.length > 60) continue;
        var key = wrong + '|' + correct;
        if (seen[key]) continue;
        seen[key] = true;
        issues.push({ wrong: wrong, correct: correct, reason: det.reason });
        if (issues.length >= 3) return issues;
      }
    }
    return issues;
  }

  function saveIssues(issues, chat) {
    if (!memoryIsEnabled()) return;
    var saved = 0;
    Promise.all(issues.map(function (it) {
      return fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'term', subject: it.correct, wrong: it.wrong, note: '' })
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (d && d.ok) { saved += 1; return true; }
        return false;
      }).catch(function () { return false; });
    })).then(function () {
      fetchRules(true);
      /* طبّق الإصلاح مباشرة على الرد الحالي */
      var last = chat.messages[chat.messages.length - 1];
      if (last && last.role === 'assistant') {
        var before = last.content || '';
        var after = before;
        issues.forEach(function (it) { after = after.split(it.wrong).join(it.correct); });
        if (after !== before) {
          last.content = after;
          if (tempActive && tempChat && tempChat.id === chat.id) {
            saveTempChat();
          } else {
            persistChat(chat);
          }
          if (currentChatId === chat.id) {
            var cards = document.querySelectorAll('#msgs .msg.asst');
            if (cards.length) {
              var mdEl = cards[cards.length - 1].querySelector('.md');
              if (mdEl) mdEl.innerHTML = md(after);
            }
          }
        }
      }
      showToast(saved > 0 ? ('حفظت ' + saved + ' قاعدة في ذاكرتي') : 'تعذّر الحفظ');
    });
  }

  function renderChip(card, issues, chat) {
    chipActive = true;
    var it = issues[0];
    var chip = document.createElement('div');
    chip.className = 'lm-chip';
    chip.style.cssText = 'margin:2px 10px 10px;padding:9px 12px;border-radius:10px;font-size:12.5px;line-height:1.8;background:#fff8e6;border:1px dashed #e0b25b;color:#6b4a00;display:flex;flex-wrap:wrap;align-items:center;gap:8px;';
    var label = document.createElement('span');
    label.textContent = 'رصدت خطأً محتملاً في ردّي: «' + it.wrong + '» والصواب «' + it.correct + '». هل أتعلّم هذا؟';
    var bSave = document.createElement('button');
    bSave.className = 'lm-save';
    bSave.textContent = 'تعلّم';
    bSave.style.cssText = 'background:#10a37f;color:#fff;border:0;border-radius:8px;padding:4px 14px;cursor:pointer;font-size:12.5px;';
    var bSkip = document.createElement('button');
    bSkip.className = 'lm-skip';
    bSkip.textContent = 'تجاهل';
    bSkip.style.cssText = 'background:transparent;color:#8a6d2f;border:1px solid #e0b25b;border-radius:8px;padding:4px 10px;cursor:pointer;font-size:12.5px;';
    bSave.addEventListener('click', function () { chipActive = false; chip.remove(); saveIssues(issues, chat); });
    bSkip.addEventListener('click', function () { chipActive = false; chip.remove(); });
    chip.appendChild(label);
    chip.appendChild(bSave);
    chip.appendChild(bSkip);
    if (card.parentNode) card.parentNode.insertBefore(chip, card.nextSibling);
  }

  function maybeLearnFromReply(chat) {
    if (chipActive) return;
    if (!memoryIsEnabled()) return;
    var last = chat.messages[chat.messages.length - 1];
    if (!last || last.role !== 'assistant') return;
    fetchRules().then(function (rules) {
      var known = {};
      rules.forEach(function (r) { if (r.kind === 'term' && r.wrong) known[r.wrong] = true; });
      var issues = detectIssues(last.content).filter(function (it) { return !known[it.wrong]; });
      if (!issues.length) return;
      var cards = document.querySelectorAll('#msgs .msg.asst');
      if (!cards.length) return;
      renderChip(cards[cards.length - 1], issues, chat);
    });
  }

  /* ترقية الردود القديمة بأي مصطلح تعلّمتُه لاحقاً */
  function applyMemoryFix(chat) {
    if (!memoryIsEnabled()) return;
    fetchRules().then(function (rules) {
      var termRules = rules.filter(function (r) { return r.kind === 'term' && r.wrong && r.subject; });
      if (!termRules.length) return;
      var changed = false;
      chat.messages.forEach(function (msg) {
        if (msg.role !== 'assistant') return;
        var orig = msg.content || '';
        var next = orig;
        termRules.forEach(function (r) { next = next.split(r.wrong).join(r.subject); });
        if (next !== orig) { msg.content = next; changed = true; }
      });
      if (!changed) return;
      if (tempActive && tempChat && tempChat.id === chat.id) {
        saveTempChat();
      } else {
        persistChat(chat);
      }
      if (currentChatId === chat.id) {
        renderChatMessages(chat);
        attachFixButtons();
      }
    });
  }

  function showToast(msg) {
    var el0 = document.getElementById('mm-toast');
    if (!el0) {
      el0 = document.createElement('div');
      el0.id = 'mm-toast';
      el0.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1d2939;color:#fff;padding:9px 16px;border-radius:999px;font-size:13px;z-index:9999;box-shadow:0 4px 14px rgba(0,0,0,.25);transition:opacity .3s;pointer-events:none;';
      document.body.appendChild(el0);
    }
    el0.textContent = msg;
    el0.style.opacity = '1';
    clearTimeout(el0._t);
    el0._t = setTimeout(function () { el0.style.opacity = '0'; }, 2600);
  }

  window.maybeLearnFromReply = maybeLearnFromReply;
  window.applyMemoryFix = applyMemoryFix;

  /* ============== زر «صحّح الرد»: تعلّم تصحيح يدوي من أي رد ============== */
  function openFixForm(btn) {
    var card = btn.closest('.msg.asst');
    if (!card) return;
    var old = card.querySelector('.lm-fix-form');
    if (old) { old.remove(); return; }
    var msgIdx = parseInt(card.dataset.msgIdx || '-1', 10);
    var chat = (tempActive && tempChat) ? tempChat : getChat(currentChatId);
    var msg = (chat && msgIdx >= 0 && chat.messages[msgIdx]) ? chat.messages[msgIdx] : null;
    if (!msg || msg.role !== 'assistant') return;

    var form = document.createElement('div');
    form.className = 'lm-fix-form';
    form.style.cssText = 'margin:6px 8px 2px;padding:10px 12px;border-radius:10px;font-size:12.5px;background:#f0f7ff;border:1px solid #b9d9f5;color:#1f4a73;display:flex;flex-direction:column;gap:6px;';
    form.innerHTML =
      '<div style="font-weight:700;margin-bottom:2px;">صحّح الرد وتعلّم من التصحيح</div>' +
      '<label style="display:block;">العبارة الخاطئة في الرد:' +
        '<input class="lm-w" style="width:100%;box-sizing:border-box;margin-top:2px;padding:6px 8px;border:1px solid #cfd8e3;border-radius:8px;font-size:12.5px;background:#fff;" placeholder="مثال: الاحتمالات اللوغاريتمية"></label>' +
      '<label style="display:block;">الصواب:' +
        '<input class="lm-s" style="width:100%;box-sizing:border-box;margin-top:2px;padding:6px 8px;border:1px solid #cfd8e3;border-radius:8px;font-size:12.5px;background:#fff;" placeholder="مثال: لوغاريتم الأرجحية"></label>' +
      '<div style="display:flex;gap:8px;margin-top:4px;">' +
        '<button class="lm-save-fix" style="background:#10a37f;color:#fff;border:0;border-radius:8px;padding:5px 14px;cursor:pointer;font-size:12.5px;">حفظ وتطبيق</button>' +
        '<button class="lm-cancel-fix" style="background:transparent;color:#5c7389;border:1px solid #cfd8e3;border-radius:8px;padding:5px 10px;cursor:pointer;font-size:12.5px;">إلغاء</button>' +
      '</div>';
    form.querySelector('.lm-cancel-fix').addEventListener('click', function () { form.remove(); });
    form.querySelector('.lm-save-fix').addEventListener('click', function () {
      if (!memoryIsEnabled()) { showToast('ذاكرة التعلم معطّلة — فعّلها من الإعدادات أولاً'); return; }
      var w = form.querySelector('.lm-w').value.trim();
      var s = form.querySelector('.lm-s').value.trim();
      if (!w || !s) { showToast('أدخل العبارة الخاطئة وصوابها معاً'); return; }
      if (w === s) { showToast('العبارتان متطابقتان'); return; }
      fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'term', subject: s, wrong: w, note: '' })
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (!d || !d.ok) { showToast('تعذّر الحفظ في الذاكرة'); return; }
        fetchRules(true);
        var before = msg.content || '';
        var after = before.split(w).join(s);
        msg.content = after;
        if (after !== before) {
          if (tempActive && tempChat && tempChat.id === chat.id) { saveTempChat(); } else { persistChat(chat); }
          var mdEl = card.querySelector('.md');
          if (mdEl) mdEl.innerHTML = md(after);
        }
        form.remove();
        showToast('حفظت التصحيح في ذاكرتي وطبّقته على الرد');
      }).catch(function () { showToast('تعذّر الوصول للخادم'); });
    });
    card.appendChild(form);
    form.querySelector('.lm-w').focus();
  }

  function attachFixButtons() {
    var cards = document.querySelectorAll('#msgs .msg.asst');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      if (card.querySelector('.lm-fix')) continue;
      var act = card.querySelector('.msg-actions');
      if (!act) continue;
      var btn = document.createElement('button');
      btn.className = 'm-act-btn lm-fix';
      btn.title = 'صحّح الرد وتعلّم';
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
      btn.addEventListener('click', function () { openFixForm(this); });
      act.appendChild(btn);
    }
  }

  window.attachFixButtons = attachFixButtons;
  window.openFixForm = openFixForm;

  /* ============== مدير الذاكرة في الإعدادات: عرض + تعديل + حذف + إضافة ============== */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function memKindLabel(kind) {
    return kind === 'rule' ? 'قاعدة (أسلوب)' : 'مصطلح (استبدال)';
  }

  function memApi(payload) {
    return fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); }).catch(function () { return null; });
  }

  function buildMemPreview(subject, wrong, note, kind) {
    if (kind === 'term') {
      var t = 'مصطلح «<b>' + esc(subject || '…') + '</b>» هو الصواب، ولا تكتبه «' + esc(wrong || '…') + '».';
      return t + (note ? ' ملاحظة: ' + esc(note) : '');
    }
    return esc(subject || '') + (note ? ' <b>ملاحظة:</b> ' + esc(note) : '');
  }

  function refreshVisibleReplies() {
    var chat = (tempActive && tempChat) ? tempChat : (currentChatId ? getChat(currentChatId) : null);
    if (chat) applyMemoryFix(chat);
  }

  function bindNewForm() {
    var addBtn = document.getElementById('btn-mem-add');
    var form = document.getElementById('mem-new-form');
    if (!addBtn || !form || window._memFormBound) return;
    window._memFormBound = true;
    addBtn.addEventListener('click', function () {
      form.style.display = (form.style.display === 'none') ? 'flex' : 'none';
    });
    document.getElementById('btn-mem-cancel-new').addEventListener('click', function () {
      form.style.display = 'none';
    });
    document.getElementById('btn-mem-save-new').addEventListener('click', function () {
      var subject = document.getElementById('mem-new-subject').value.trim();
      if (!subject) { showToast('أدخل المصطلح الصواب أو عنوان القاعدة'); return; }
      memApi({
        action: 'add',
        kind: document.getElementById('mem-new-kind').value,
        subject: subject,
        wrong: document.getElementById('mem-new-wrong').value.trim(),
        note: document.getElementById('mem-new-note').value.trim()
      }).then(function (d) {
        if (!d || !d.ok) { showToast('تعذّر الإضافة'); return; }
        form.style.display = 'none';
        document.getElementById('mem-new-subject').value = '';
        document.getElementById('mem-new-wrong').value = '';
        document.getElementById('mem-new-note').value = '';
        renderMemoryManager();
        refreshVisibleReplies();
        showToast('أُضيف التصحيح إلى الذاكرة');
      });
    });
  }

  function renderMemoryManager() {
    var listEl = document.getElementById('mem-list');
    var countEl = document.getElementById('mem-count');
    if (!listEl) return;
    bindNewForm();
    fetchRules(true).then(function (rules) {
      if (countEl) countEl.textContent = rules.length + ' تصحيحات';
      listEl.innerHTML = '';
      if (!memoryIsEnabled()) {
        var banner = el('div', 'mem-banner', 'ذاكرة التعلم <b>معطّلة</b> حالياً من إعدادات التخصيص: لن تُكتشف الأخطاء تلقائياً، ولن تُحقن التصحيحات في ردود النموذج، حتى تُعيد تشغيلها.');
        listEl.appendChild(banner);
      }
      if (!rules.length) {
        listEl.innerHTML = '<div class="mem-empty">لا توجد تصحيحات بعد&hellip; علّم النموذج من زر «صحّح الرد» تحت أي ردّ، أو أضِف تصحيحاً يدوياً من الزر أعلاه.</div>';
        return;
      }
      rules.forEach(function (rule) {
        var item = el('div', 'mem-item');
        item.dataset.id = rule.id;

        var head = el('div', 'mem-item-head');
        var title = el('div', 'mem-item-title');
        title.appendChild(el('span', 'mem-kind-badge ' + (rule.kind === 'rule' ? 'kind-rule' : ''), memKindLabel(rule.kind)));
        title.appendChild(el('b', '', esc(rule.subject || '')));
        head.appendChild(title);
        var actions = el('div', 'mem-item-actions');
        var bSave = el('button', 'adm-btn adm-btn-primary mem-save', 'حفظ التعديل');
        var bDel = el('button', 'adm-btn adm-btn-danger mem-del', 'حذف');
        actions.appendChild(bSave);
        actions.appendChild(bDel);
        head.appendChild(actions);
        item.appendChild(head);

        var fields = el('div', 'mem-item-fields');
        var fSubject = el('div', 'mem-field');
        fSubject.appendChild(el('label', '', 'المصطلح الصواب / نص القاعدة'));
        var iSubject = el('input', 'st-input mem-subject');
        iSubject.type = 'text';
        iSubject.value = rule.subject || '';
        fSubject.appendChild(iSubject);
        fields.appendChild(fSubject);

        var fWrong = el('div', 'mem-field');
        fWrong.appendChild(el('label', '', 'الصيغة الخاطئة (الاستبدال)'));
        var iWrong = el('input', 'st-input mem-wrong');
        iWrong.type = 'text';
        iWrong.placeholder = 'مثال: الاحتمال اللوغاريتمي';
        iWrong.value = rule.wrong || '';
        fWrong.appendChild(iWrong);
        fields.appendChild(fWrong);

        var fNote = el('div', 'mem-field');
        fNote.appendChild(el('label', '', 'ملاحظة / نص القاعدة التفصيلي'));
        var iNote = el('input', 'st-input mem-note');
        iNote.type = 'text';
        iNote.value = rule.note || '';
        fNote.appendChild(iNote);
        fields.appendChild(fNote);
        item.appendChild(fields);

        var prev = el('div', 'mem-preview');
        prev.innerHTML = '<b>ما سيُحقن في ترويسة النموذج:</b> ' + buildMemPreview(rule.subject, rule.wrong, rule.note, rule.kind);
        item.appendChild(prev);

        function updatePreview() {
          prev.innerHTML = '<b>ما سيُحقن في ترويسة النموذج:</b> ' + buildMemPreview(iSubject.value, iWrong.value, iNote.value, rule.kind);
        }
        iSubject.addEventListener('input', updatePreview);
        iWrong.addEventListener('input', updatePreview);
        iNote.addEventListener('input', updatePreview);

        bSave.addEventListener('click', function () {
          var subject = iSubject.value.trim();
          if (!subject) { showToast('أدخل المصطلح الصواب أو عنوان القاعدة'); return; }
          memApi({
            action: 'update',
            id: rule.id,
            kind: rule.kind,
            subject: subject,
            wrong: iWrong.value.trim(),
            note: iNote.value.trim()
          }).then(function (d) {
            if (!d || !d.ok) { showToast('تعذّر الحفظ'); return; }
            renderMemoryManager();
            refreshVisibleReplies();
            showToast('عُدّل التصحيح وطُبّق على الردود');
          });
        });

        bDel.addEventListener('click', function () {
          if (bDel.dataset.armed === '1') {
            memApi({ action: 'delete', id: rule.id }).then(function (d) {
              if (!d || !d.ok) { showToast('تعذّر الحذف'); return; }
              renderMemoryManager();
              refreshVisibleReplies();
              showToast('حُذف التصحيح');
            });
            return;
          }
          bDel.dataset.armed = '1';
          bDel.textContent = 'تأكيد الحذف؟';
          setTimeout(function () {
            bDel.dataset.armed = '';
            bDel.textContent = 'حذف';
          }, 2600);
        });

        listEl.appendChild(item);
      });
    });
  }

  window.renderMemoryManager = renderMemoryManager;
})();