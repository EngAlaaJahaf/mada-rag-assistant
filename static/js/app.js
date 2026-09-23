/* ================= Event wiring ================= */
function bindEvents() {
  $('btn-new').addEventListener('click', newChat);
  $('btn-collapse').addEventListener('click', toggleCollapse);
  $('sb-reopen').addEventListener('click', openSidebar);
  $('sb-scrim').addEventListener('click', closeDrawer);

  var btnTheme = $('btn-theme');
  if (btnTheme) {
    btnTheme.addEventListener('click', function () {
      var t = htmlRoot.getAttribute('data-theme');
      setTheme(t === 'dark' ? 'light' : 'dark');
      renderSidebar();
    });
  }

  /* Account Trigger & Popover Menu */
  if (accountTrigger) {
    accountTrigger.addEventListener('click', function (e) {
      if (e.target.closest('#btn-upgrade-pill')) return;
      toggleAccountPopover();
    });
    accountTrigger.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleAccountPopover();
      }
    });
  }

  var btnUpgradePill = $('btn-upgrade-pill');
  if (btnUpgradePill) {
    btnUpgradePill.addEventListener('click', function (e) {
      e.stopPropagation();
      openAppModal('modal-upgrade');
    });
  }

  var muHeader = $('menu-item-user-header');
  if (muHeader) muHeader.addEventListener('click', function () { openAppModal('modal-profile'); });

  var muUpgrade = $('menu-item-upgrade');
  if (muUpgrade) muUpgrade.addEventListener('click', function () { openAppModal('modal-upgrade'); });

  var muCustomize = $('menu-item-customize');
  if (muCustomize) muCustomize.addEventListener('click', function () { openAppModal('modal-settings', 'personalization'); });

  var muProfile = $('menu-item-profile');
  if (muProfile) muProfile.addEventListener('click', function () { openAppModal('modal-profile'); });

  var muSettings = $('menu-item-settings');
  if (muSettings) muSettings.addEventListener('click', function () { openAppModal('modal-settings', 'general'); });

  var muHelp = $('menu-item-help');
  if (muHelp) muHelp.addEventListener('click', function () { openAppModal('modal-help'); });

  var muLogout = $('menu-item-logout');
  if (muLogout) muLogout.addEventListener('click', function () { openAppModal('modal-logout'); });

  /* Click outside to close account popover */
  document.addEventListener('click', function (e) {
    if (accountPopover && accountPopover.classList.contains('open')) {
      if (!accountPopover.contains(e.target) && !accountTrigger.contains(e.target)) {
        closeAccountPopover();
      }
    }
  });

  /* Escape & Shortcut keys */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (accountPopover && accountPopover.classList.contains('open')) {
        closeAccountPopover();
        return;
      }
      var openModals = document.querySelectorAll('.app-dialog-modal:not(.hidden)');
      openModals.forEach(function (m) { m.classList.add('hidden'); });
    } else if (e.ctrlKey && e.key === ',') {
      e.preventDefault();
      openAppModal('modal-settings', 'general');
    }
  });

  /* Generic modal close buttons & backdrops */
  document.querySelectorAll('[data-close]').forEach(function (el) {
    el.addEventListener('click', function () {
      var mId = el.getAttribute('data-close');
      closeAppModal(mId);
    });
  });

  /* Settings Modal: Tab Navigation */
  document.querySelectorAll('.st-tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      switchSettingsTab(btn.dataset.tab);
    });
  });

  /* Settings Modal: Search Filter */
  var stSearchInp = $('st-search-input');
  if (stSearchInp) {
    stSearchInp.addEventListener('input', function () {
      var q = (stSearchInp.value || '').trim().toLowerCase();
      var btns = document.querySelectorAll('.st-tab-btn');
      var foundActive = false;
      var firstMatch = null;
      btns.forEach(function (b) {
        var txt = (b.textContent || '').toLowerCase();
        var match = !q || txt.indexOf(q) !== -1;
        b.style.display = match ? 'flex' : 'none';
        if (match) {
          if (!firstMatch) firstMatch = b;
          if (b.classList.contains('active')) foundActive = true;
        }
      });
      if (!foundActive && firstMatch) {
        switchSettingsTab(firstMatch.dataset.tab);
      }
    });
  }

  /* Settings Modal: Switch Toggles */
  document.querySelectorAll('.st-switch').forEach(function (sw) {
    sw.addEventListener('click', function () {
      var isActive = sw.classList.toggle('active');
      sw.setAttribute('aria-checked', isActive ? 'true' : 'false');
    });
  });

  /* Settings Modal: Model Presets */
  document.querySelectorAll('.st-badge-preset').forEach(function (badge) {
    badge.addEventListener('click', function () {
      if (badge.dataset.presetUrl) {
        var inpU = $('cfg-model-endpoint');
        if (inpU) {
          inpU.value = badge.dataset.presetUrl;
          inpU.focus();
        }
      }
      if (badge.dataset.presetModel) {
        var inpM = $('cfg-model-name');
        if (inpM) {
          inpM.value = badge.dataset.presetModel;
          inpM.focus();
        }
      }
    });
  });

  /* Settings Modal: Temperature Slider */
  var rngTemp = $('cfg-model-temp');
  var lblTemp = $('cfg-model-temp-label');
  if (rngTemp && lblTemp) {
    rngTemp.addEventListener('input', function () {
      lblTemp.textContent = rngTemp.value;
    });
  }

  /* Settings Modal: Save Model Settings */
  var btnSaveModel = $('btn-save-model-settings');
  if (btnSaveModel) {
    btnSaveModel.addEventListener('click', function () {
      var endp = ($('cfg-model-endpoint').value || '').trim();
      var mName = ($('cfg-model-name').value || 'Qwen3-4B').trim();
      var aKey = ($('cfg-model-api-key').value || '').trim();
      var temp = parseFloat($('cfg-model-temp').value) || 0.7;
      var maxT = parseInt($('cfg-model-max-tokens').value, 10) || 2048;
      saveModelConfig({
        endpoint: endp,
        model: mName,
        apiKey: aKey,
        temperature: temp,
        maxTokens: maxT
      });
      alert('🎉 تم حفظ وتطبيق إعدادات النموذج المخصص بنجاح.');
    });
  }

  /* Settings Modal: Save Personalization */
  var btnSavePers = $('btn-save-personalization');
  if (btnSavePers) {
    btnSavePers.addEventListener('click', function () {
      var p = {
        tone: $('cfg-tone').value || 'default',
        warmth: $('cfg-trait-warmth').value || 'default',
        enthusiasm: $('cfg-trait-enthusiasm').value || 'default',
        formatting: $('cfg-trait-formatting').value || 'default',
        emojis: $('cfg-trait-emojis').value || 'default',
        fastAnswers: $('cfg-switch-fast-answers') ? $('cfg-switch-fast-answers').classList.contains('active') : true,
        customInstructions: ($('cfg-custom-instructions').value || '').trim(),
        prefName: ($('cfg-pref-name').value || '').trim(),
        prefRole: ($('cfg-pref-role').value || '').trim(),
        prefBio: ($('cfg-pref-bio').value || '').trim(),
        memoryEnabled: $('cfg-switch-memory') ? $('cfg-switch-memory').classList.contains('active') : true
      };
      savePersonalization(p);
      alert('✨ تم حفظ تفضيلات وإعدادات التخصيص بنجاح.');
    });
  }

  /* Settings Modal: Clear Memory */
  var btnClearMem = $('btn-clear-memory');
  if (btnClearMem) {
    btnClearMem.addEventListener('click', function () {
      if (confirm('هل ترغب في مسح ملخص الذاكرة والتعليمات المخصصة؟')) {
        var p = getPersonalization();
        p.customInstructions = '';
        p.prefBio = '';
        savePersonalization(p);
        alert('تم تفريغ الذاكرة بنجاح.');
      }
    });
  }

  /* Settings Modal: General Tab Controls */
  var selThemeGen = $('cfg-theme-select');
  if (selThemeGen) {
    selThemeGen.value = getTheme();
    selThemeGen.addEventListener('change', function () {
      setTheme(selThemeGen.value);
    });
  }

  var selFontGen = $('cfg-general-font-size');
  if (selFontGen) {
    selFontGen.value = getFontSize();
    selFontGen.addEventListener('change', function () {
      setFontSize(selFontGen.value);
    });
  }

  var btnClearGen = $('btn-clear-all-chats-gen');
  if (btnClearGen) {
    btnClearGen.addEventListener('click', function () {
      if (confirm('هل أنت متأكد من رغبتك في حذف جميع المحادثات نهائياً؟')) {
        chats = [];
        saveChats();
        currentChatId = null;
        saveActiveChatId(null);
        syncUrlChatId(null);
        renderSidebar();
        newChat();
        closeAppModal('modal-settings');
      }
    });
  }

  /* Settings Modal: Data Controls Tab */
  var btnExport = $('btn-export-chats');
  if (btnExport) {
    btnExport.addEventListener('click', function () {
      var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(chats, null, 2));
      var dlAnchor = document.createElement('a');
      dlAnchor.setAttribute("href", dataStr);
      dlAnchor.setAttribute("download", "mada_chats_export_" + (new Date().toISOString().slice(0, 10)) + ".json");
      document.body.appendChild(dlAnchor);
      dlAnchor.click();
      dlAnchor.remove();
    });
  }

  var btnDelData = $('btn-delete-all-data');
  if (btnDelData) {
    btnDelData.addEventListener('click', function () {
      if (confirm('تحذير: سيتم حذف كافة المحادثات والتفضيلات بشكل نهائي. هل ترغب بالاستمرار؟')) {
        localStorage.clear();
        chats = [];
        currentChatId = null;
        location.reload();
      }
    });
  }

  /* Settings Modal: Account Tab links */
  var btnAccEdit = $('btn-acc-edit-profile');
  if (btnAccEdit) {
    btnAccEdit.addEventListener('click', function () {
      closeAppModal('modal-settings');
      openAppModal('modal-profile');
    });
  }

  var btnAccUpgr = $('btn-acc-upgrade');
  if (btnAccUpgr) {
    btnAccUpgr.addEventListener('click', function () {
      closeAppModal('modal-settings');
      openAppModal('modal-upgrade');
    });
  }

  /* Profile Save */
  var btnSaveProfile = $('btn-save-profile');
  if (btnSaveProfile) {
    btnSaveProfile.addEventListener('click', function () {
      var name = ($('profile-input-name').value || 'سامي صالح').trim();
      var initials = ($('profile-input-initials').value || 'RY').trim().toUpperCase();
      var email = ($('profile-input-email').value || '').trim();
      var plan = $('profile-input-plan').value || 'المجانية';
      saveProfile({ name: name, initials: initials, email: email, plan: plan });
      closeAppModal('modal-profile');
    });
  }

  /* Theme Cards in Customize Modal */
  document.querySelectorAll('.adm-theme-card').forEach(function (card) {
    card.addEventListener('click', function () {
      var t = card.dataset.themeVal;
      setTheme(t);
      renderSidebar();
    });
  });

  /* Font Size in Customize Modal */
  var selFontSize = $('cfg-font-size');
  if (selFontSize) {
    selFontSize.value = getFontSize();
    selFontSize.addEventListener('change', function () {
      setFontSize(selFontSize.value);
    });
  }

  /* Upgrade Confirm */
  var btnConfirmUpgrade = $('btn-confirm-upgrade');
  if (btnConfirmUpgrade) {
    btnConfirmUpgrade.addEventListener('click', function () {
      var p = getProfile();
      p.plan = 'الاحترافية (Plus)';
      saveProfile(p);
      closeAppModal('modal-upgrade');
      alert('🎉 تهانينا! تم ترقية حسابك بنجاح إلى الخطة الاحترافية Plus.');
    });
  }

  /* Clear All Chats in Settings */
  var btnClearAllChats = $('btn-clear-all-chats');
  if (btnClearAllChats) {
    btnClearAllChats.addEventListener('click', function () {
      if (confirm('هل أنت متأكد من رغبتك في حذف جميع المحادثات نهائياً؟')) {
        chats = [];
        saveChats();
        currentChatId = null;
        saveActiveChatId(null);
        syncUrlChatId(null);
        renderSidebar();
        newChat();
        closeAppModal('modal-settings');
      }
    });
  }

  /* Logout Confirm */
  var btnConfirmLogout = $('btn-confirm-logout');
  if (btnConfirmLogout) {
    btnConfirmLogout.addEventListener('click', function () {
      closeAppModal('modal-logout');
      alert('تم تسجيل الخروج بنجاح.');
    });
  }

  $('btn-search-toggle').addEventListener('click', openSearchModal);

  smInput.addEventListener('input', function () {
    renderSearchResults(smInput.value);
  });
  $('sm-backdrop').addEventListener('click', closeSearchModal);
  smResults.addEventListener('click', function (e) {
    var item = e.target.closest('.sm-result-item');
    if (item && item.dataset.id) {
      var id = item.dataset.id;
      var msgIdx = item.dataset.msgIdx;
      closeSearchModal();
      loadChat(id);
      if (msgIdx != null) {
        setTimeout(function () { scrollMsgIntoView(parseInt(msgIdx, 10)); }, 120);
      }
    }
  });

  /* Files Manager wiring */
  $('fm-close').addEventListener('click', closeFilesModal);
  $('fm-backdrop').addEventListener('click', closeFilesModal);
  $('fm-btn-upload').addEventListener('click', function () { fileInput.click(); });
  $('fm-btn-select-all').addEventListener('click', function () {
    selectedScopedFiles = allServerFiles.map(function (f) { return f.name; });
    renderFilesModalList(fmFilterInput.value);
  });
  $('fm-btn-clear-all').addEventListener('click', function () {
    selectedScopedFiles = [];
    renderFilesModalList(fmFilterInput.value);
  });
  $('fm-btn-reset-filter').addEventListener('click', function () {
    applyScopedFiles([]);
  });
  $('fm-btn-apply').addEventListener('click', function () {
    applyScopedFiles(selectedScopedFiles);
  });
  $('af-edit').addEventListener('click', openFilesModal);
  $('af-clear').addEventListener('click', function () {
    applyScopedFiles([]);
  });
  fmFilterInput.addEventListener('input', function () {
    renderFilesModalList(fmFilterInput.value);
  });
  fmList.addEventListener('click', function (e) {
    var delBtn = e.target.closest('.fm-item-del');
    if (delBtn) {
      e.stopPropagation();
      var item = delBtn.closest('.fm-item');
      if (item && item.dataset.fname) deleteServerFile(item.dataset.fname);
      return;
    }
    var item = e.target.closest('.fm-item');
    if (item && item.dataset.fname) {
      var fname = item.dataset.fname;
      var idx = selectedScopedFiles.indexOf(fname);
      if (idx === -1) selectedScopedFiles.push(fname);
      else selectedScopedFiles.splice(idx, 1);
      renderFilesModalList(fmFilterInput.value);
    }
  });

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openSearchModal();
    } else if (e.key === 'Escape') {
      if (!filesModal.classList.contains('hidden')) closeFilesModal();
      else if (!searchModal.classList.contains('hidden')) closeSearchModal();
    }
  });

  $('tab-chat').addEventListener('click', function () { selectMode('free'); });
  $('tab-work').addEventListener('click', function () { selectMode('review'); });
  $('btn-refresh-chat').addEventListener('click', newChat);

  $('btn-thinking').addEventListener('click', function () {
    this.classList.toggle('active');
  });

  $('btn-attach').addEventListener('click', function () {
    fileInput.click();
  });

  fileInput.addEventListener('change', function () {
    handleFilesSelect(fileInput.files);
    fileInput.value = '';
  });

  window.addEventListener('dragover', function (e) { e.preventDefault(); });
  window.addEventListener('drop', function (e) {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
      handleFilesSelect(e.dataTransfer.files);
    }
  });

  btnVoice.addEventListener('click', function () {
    alert('وضع الصوت المباشر (Voice Mode) متاح قريباً!');
  });

  $('btn-mic').addEventListener('click', function () {
    alert('الإملاء الصوتي متاح قريباً!');
  });

  sbSearchEl.addEventListener('input', renderSidebar);
  sbSearchEl.addEventListener('keydown', function (e) { e.stopPropagation(); });

  taEl.addEventListener('input', function () {
    taEl.style.height = 'auto';
    var h = Math.min(taEl.scrollHeight, 200);
    taEl.style.height = h + 'px';
    updateSendDisabled();
  });
  taEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  });
  taEl.addEventListener('click', function (e) { e.stopPropagation(); });

  btnSend.addEventListener('click', doSend);
  btnStop.addEventListener('click', stopStream);

  $('mbtn').addEventListener('click', function (e) {
    e.stopPropagation();
    mmenuEl.classList.toggle('open');
  });
  mmenuEl.querySelectorAll('button[data-mode]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      selectMode(b.dataset.mode);
    });
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.mselect')) closeModeMenu();
  });

  /* sidebar delegation */
  var sidebar = $('sidebar');
  if (sidebar) {
    sidebar.addEventListener('click', function (e) {
      var kb = e.target.closest('.kebabbtn');
      if (kb) {
        e.stopPropagation();
        var km = kb.parentElement.querySelector('.kmenu');
        var isOpen = km && km.classList.contains('open');
        closeKmenus();
        if (km && !isOpen) km.classList.add('open');
        return;
      }

      var act = e.target.closest('.kmenu button[data-act]');
      if (act) {
        e.stopPropagation();
        var actionType = act.dataset.act;

        if (actionType === 'proj-rename') {
          var pid = act.dataset.pid;
          var proj = projects.find(function (p) { return p.id === pid; });
          if (proj) openProjectModalForEdit(proj, false);
          closeKmenus();
          return;
        }
        if (actionType === 'proj-edit') {
          var pid = act.dataset.pid;
          var proj = projects.find(function (p) { return p.id === pid; });
          if (proj) openProjectModalForEdit(proj, true);
          closeKmenus();
          return;
        }
        if (actionType === 'proj-del') {
          var pid = act.dataset.pid;
          var proj = projects.find(function (p) { return p.id === pid; });
          if (proj && confirm('هل تريد حذف المجلد «' + proj.name + '»؟ ستظل محادثاته محفوظة في القائمة الرئيسية.')) {
            fetch('/projects/delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: pid })
            }).then(function () {
              projects = projects.filter(function (p) { return p.id !== pid; });
              chats.forEach(function (c) { if (c.project_id === pid) c.project_id = null; });
              renderSidebar();
            });
          }
          closeKmenus();
          return;
        }

        var item = act.closest('.chat-item');
        var cid = item ? item.dataset.id : null;
        if (cid) {
          var chat = getChat(cid);
          if (actionType === 'del') {
            deleteChat(cid);
          } else if (actionType === 'rename') {
            renameChat(cid);
          } else if (actionType === 'pin') {
            if (chat) {
              chat.pinned = !chat.pinned;
              serverPinChat(chat.id, chat.pinned);
              renderSidebar();
            }
          } else if (actionType === 'archive') {
            if (chat) {
              chat.archived = true;
              serverArchiveChat(chat.id, true);
              renderSidebar();
            }
          } else if (actionType === 'move') {
            openMoveChatModal(cid);
          } else if (actionType === 'share') {
            if (chat) {
              copyText(chat.title + '\n' + (chat.messages.length ? chat.messages[0].content : ''));
              alert('تم نسخ تفاصيل المحادثة!');
            }
          }
        }
        closeKmenus();
        return;
      }

      var pinBtn = e.target.closest('.ci-pin-btn');
      if (pinBtn) {
        e.stopPropagation();
        var pItem = pinBtn.closest('.chat-item');
        var pcid = pItem ? pItem.dataset.id : null;
        var pChat = pcid ? getChat(pcid) : null;
        if (pChat) {
          pChat.pinned = !pChat.pinned;
          serverPinChat(pChat.id, pChat.pinned);
          renderSidebar();
        }
        return;
      }

      var pHead = e.target.closest('.sb-proj-head');
      if (pHead) {
        var ppid = pHead.dataset.pid;
        if (ppid) {
          expandedProjectIds[ppid] = true;
          renderSidebar();
          navigateTo('project', ppid);
        }
        return;
      }

      var it = e.target.closest('.chat-item');
      if (it) {
        closeKmenus();
        if (tempActive) {
          if (confirm('هل ترغب في الخروج من الدردشة المؤقتة؟ سيتم مسحها.')) {
            clearTempChat();
            loadChat(it.dataset.id);
          }
        } else {
          loadChat(it.dataset.id);
        }
        return;
      }
    });
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.ci-kebab')) closeKmenus();
  });

  /* Hero suggestions and sidebar nav clicks */
  document.addEventListener('click', function (e) {
    var sug = e.target.closest('.hero-sug-btn');
    if (sug && sug.dataset.prompt) {
      send(sug.dataset.prompt, currentChatId);
      return;
    }
    var sbn = e.target.closest('.sb-nav-item');
    if (sbn && sbn.id !== 'btn-new') {
      var act = sbn.dataset.action;
      if (act === 'images') {
        send('أنشئ لي رسماً أو تصميماً بيانياً يوضح الموضوع المطلوب', currentChatId);
      } else if (act === 'library') {
        openFilesModal();
      } else if (act === 'codex') {
        send('اكتب لي سكريبت برمجي احترافي نظيف مع الشرح', currentChatId);
      } else if (act === 'schedule') {
        send('اقترح جدولاً زمنياً ومهام مجدولة لتنظيم العمل والمذاكرة', currentChatId);
      } else if (act === 'plugins') {
        send('ما هي الأدوات والمكونات الذكية التي يمكنك مساعدتي بها؟', currentChatId);
      } else if (act === 'projects') {
        navigateTo('projects');
      } else {
        newChat();
      }
    }
  });

  /* code copy button delegation */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.cb-copy-btn');
    if (!btn) return;
    var pre = btn.closest('.cb');
    if (!pre) return;
    var codeEl = pre.querySelector('pre code');
    var txt = codeEl ? codeEl.textContent : '';
    copyText(txt);
    btn.classList.add('copied');
    var oldHtml = btn.innerHTML;
    btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    setTimeout(function () {
      btn.classList.remove('copied');
      btn.innerHTML = oldHtml;
    }, 1400);
  });

  /* message action buttons delegation (Image 3) */
  document.addEventListener('click', function (e) {
    var act = e.target.closest('.m-act-btn');
    if (!act) return;
    var card = act.closest('.msg.asst');
    if (!card) return;

    if (act.classList.contains('act-copy')) {
      var mdEl = card.querySelector('.md');
      var txt = mdEl ? mdEl.innerText : '';
      copyText(txt);
      var oldHtml = act.innerHTML;
      act.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      setTimeout(function () { act.innerHTML = oldHtml; }, 1400);
    } else if (act.classList.contains('act-like')) {
      act.classList.toggle('active');
      var dis = card.querySelector('.act-dislike');
      if (dis) dis.classList.remove('active');
    } else if (act.classList.contains('act-dislike')) {
      act.classList.toggle('active');
      var lik = card.querySelector('.act-like');
      if (lik) lik.classList.remove('active');
    } else if (act.classList.contains('act-regen')) {
      var chat = currentChatId ? getChat(currentChatId) : null;
      if (!chat || streaming) return;
      var lastQ = lastUser(chat);
      if (lastQ) send(lastQ, chat.id);
    } else if (act.classList.contains('act-share')) {
      var mdEl = card.querySelector('.md');
      copyText(mdEl ? mdEl.innerText : '');
      alert('تم نسخ الرد لمشاركته!');
    } else if (act.classList.contains('act-more')) {
      var mdEl = card.querySelector('.md');
      copyText(mdEl ? mdEl.innerText : '');
    }
  });

  /* === User message action buttons (Edit / Copy / Share) === */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.u-act-btn');
    if (!btn) return;
    var card = btn.closest('.msg.user');
    if (!card) return;
    var textEl = card.querySelector('.u-text');
    var rawText = textEl ? textEl.textContent : '';

    /* --- COPY --- */
    if (btn.classList.contains('u-act-copy')) {
      copyText(rawText);
      var oldHtml = btn.innerHTML;
      btn.classList.add('copied');
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      setTimeout(function () { btn.classList.remove('copied'); btn.innerHTML = oldHtml; }, 1400);

    /* --- SHARE --- */
    } else if (btn.classList.contains('u-act-share')) {
      copyText(rawText);
      var oldHtmlS = btn.innerHTML;
      btn.classList.add('copied');
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      setTimeout(function () { btn.classList.remove('copied'); btn.innerHTML = oldHtmlS; }, 1400);

    /* --- EDIT --- */
    } else if (btn.classList.contains('u-act-edit')) {
      if (card.querySelector('.u-edit-area')) return; // already editing
      var wrap = card.querySelector('.u-content-wrap');
      if (!wrap) return;
      // Hide text + actions
      textEl.style.display = 'none';
      card.querySelector('.u-actions').style.display = 'none';
      // Build edit UI
      var editArea = document.createElement('textarea');
      editArea.className = 'u-edit-area';
      editArea.value = rawText;
      editArea.rows = Math.max(2, rawText.split('\n').length);
      var editBtns = document.createElement('div');
      editBtns.className = 'u-edit-btns';
      var cancelBtn = document.createElement('button');
      cancelBtn.className = 'u-edit-cancel';
      cancelBtn.textContent = 'إلغاء';
      var sendBtn = document.createElement('button');
      sendBtn.className = 'u-edit-send';
      sendBtn.textContent = 'إرسال';
      editBtns.appendChild(cancelBtn);
      editBtns.appendChild(sendBtn);
      wrap.appendChild(editArea);
      wrap.appendChild(editBtns);
      editArea.focus();
      editArea.selectionStart = editArea.value.length;

      cancelBtn.addEventListener('click', function () {
        wrap.removeChild(editArea);
        wrap.removeChild(editBtns);
        textEl.style.display = '';
        card.querySelector('.u-actions').style.display = '';
      });

      sendBtn.addEventListener('click', function () {
        var newText = editArea.value.trim();
        if (!newText || streaming) return;
        // Determine msgIdx to truncate history
        var msgIdx = parseInt(card.dataset.msgIdx, 10);
        // Get active chat
        var chat = currentChatId ? getChat(currentChatId) : null;
        if (!chat) return;
        // Truncate messages from this index onward
        if (!isNaN(msgIdx) && msgIdx >= 0) {
          chat.messages = chat.messages.slice(0, msgIdx);
        }
        // Re-render
        msgsEl.innerHTML = '';
        for (var ri = 0; ri < chat.messages.length; ri++) {
          if (chat.messages[ri].role === 'user') renderUserMsg(chat.messages[ri].content, ri);
          else renderAsstMsg(chat.messages[ri].content, ri);
        }
        // Send as new message
        send(newText, chat.id);
      });

      // Ctrl+Enter / Cmd+Enter to send
      editArea.addEventListener('keydown', function (ke) {
        if ((ke.ctrlKey || ke.metaKey) && ke.key === 'Enter') {
          ke.preventDefault();
          sendBtn.click();
        } else if (ke.key === 'Escape') {
          cancelBtn.click();
        }
      });
    }
  });

  /* Minimap hover, click, and scroll synchronization (Images 1 & 2) */
  var mm = $('minimap');
  var mmPop = $('minimap-popover');
  if (mm && mmPop) {
    mm.addEventListener('mouseenter', function () { mmPop.classList.add('open'); });
    mm.addEventListener('mouseleave', function () { mmPop.classList.remove('open'); });
    mm.addEventListener('click', function (e) {
      var target = e.target.closest('.mm-tick, .mm-item');
      if (target && target.dataset.idx != null) {
        scrollMsgIntoView(parseInt(target.dataset.idx, 10));
      }
    });
  }

  msgsEl.addEventListener('scroll', function () {
    var cards = msgsEl.querySelectorAll('.msg');
    if (!cards.length) return;
    var containerTop = msgsEl.getBoundingClientRect().top;
    var activeIdx = 0;
    for (var i = 0; i < cards.length; i++) {
      var rect = cards[i].getBoundingClientRect();
      if (rect.top - containerTop <= 200) {
        activeIdx = i;
      }
    }
    highlightMinimapTick(activeIdx);
  });
}

function doSend() {
  send(taEl.value, currentChatId);
  taEl.value = '';
  taEl.style.height = 'auto';
  updateSendDisabled();
}
function stopStream() {
  var cid = activeGenChatId;
  if (cid) {
    fetch('/api/generation/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: cid })
    }).catch(function () {});
  }
  if (streamCtrl) {
    try { streamCtrl.abort(); } catch (e) {}
  }
}
function updateSendDisabled() {
  var has = taEl.value.trim().length > 0;
  if (streaming) {
    if (btnVoice) btnVoice.classList.add('hidden');
    if (btnSend) btnSend.classList.add('hidden');
    if (btnStop) btnStop.classList.remove('hidden');
  } else if (has) {
    if (btnVoice) btnVoice.classList.add('hidden');
    if (btnSend) btnSend.classList.remove('hidden');
    if (btnStop) btnStop.classList.add('hidden');
  } else {
    if (btnVoice) btnVoice.classList.remove('hidden');
    if (btnSend) btnSend.classList.add('hidden');
    if (btnStop) btnStop.classList.add('hidden');
  }
}

/* ================= Init ================= */
async function init() {
  setTheme(getTheme());
  setFontSize(getFontSize());
  renderProfileUI();
  renderModelConfigUI();
  renderPersonalizationUI();
  try {
    if (localStorage.getItem(LS_SBAR) === '1') body.classList.add('sb-collapsed');
  } catch (e) {}

  loadTempChat();
  await loadServerData();

  initProjectPicker();
  initTempChatUI();
  initDataControls();
  initProjectsWorkspaceAndHubEvents();

  updateTempUI();
  bindEvents();
  loadServerFiles();

  var targetChat = null;
  if (tempActive && tempChat) {
    targetChat = tempChat;
  } else {
    var urlParams = new URLSearchParams(window.location.search);
    var targetId = urlParams.get('c') || urlParams.get('chat') || getSavedActiveChatId();
    if (targetId && targetId !== 'new') {
      targetChat = getChat(targetId);
    }
    if (!targetChat && chats.length && targetId !== 'new') {
      targetChat = chats[0];
    }
  }

  if (targetChat) {
    currentChatId = targetChat.id;
    currentMode = targetChat.mode;
    saveActiveChatId(currentChatId);
    syncUrlChatId(currentChatId);
    updateModePill();
    if (targetChat.messages && targetChat.messages.length) {
      renderChatMessages(targetChat);
    } else {
      renderEmpty(true);
    }
  } else {
    currentChatId = null;
    saveActiveChatId('new');
    syncUrlChatId(null);
    updateModePill();
    renderEmpty(true);
  }

  renderSidebar();
  updateSendDisabled();

  routeCurrentUrl();
  resumePendingGeneration();
}

init();

