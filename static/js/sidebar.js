/* ================= Sidebar & Project rendering ================= */
function renderSidebar() {
  var q = sbSearchEl.value.trim().toLowerCase();
  chatListEl.innerHTML = '';
  var projListEl = $('sb-projects-list');
  var projCardEl = $('btn-projects-card');

  if (q) {
    if (projCardEl) projCardEl.classList.add('hidden');
    if (projListEl) projListEl.classList.add('hidden');
    var matched = [];
    for (var i = 0; i < chats.length; i++) {
      var c = chats[i];
      if (c.archived) continue;
      var t = (c.title || '').toLowerCase();
      if (t.indexOf(q) !== -1) matched.push(c);
    }
    listEmptyEl.classList.toggle('hidden', matched.length > 0);
    for (var k = 0; k < matched.length; k++) {
      chatListEl.appendChild(createChatItemEl(matched[k]));
    }
    return;
  }

  if (projCardEl) projCardEl.classList.remove('hidden');
  if (projListEl) {
    projListEl.classList.remove('hidden');
    projListEl.innerHTML = '';

    for (var pi = 0; pi < projects.length; pi++) {
      var p = projects[pi];
      var isExp = !!expandedProjectIds[p.id];
      var pChats = chats.filter(function (c) { return c.project_id === p.id && !c.archived; });
      pChats.sort(function (a, b) {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return 0;
      });

      var pItem = el('div', 'sb-proj-item' + (isExp ? ' expanded' : ''));
      pItem.dataset.pid = p.id;

      var pHead = el('div', 'sb-proj-head');
      pHead.dataset.pid = p.id;

      var pTitleGroup = el('div', 'sb-proj-title-group');
      var pIcon = el('span', 'sb-proj-icon');
      pIcon.style.color = p.color || '#10a37f';
      var iconSvg = PROJECT_ICONS[p.icon] || PROJECT_ICONS.folder;
      pIcon.innerHTML = iconSvg;
      pTitleGroup.appendChild(pIcon);

      var pName = el('span', 'sb-proj-name', esc(p.name));
      pTitleGroup.appendChild(pName);

      if (pChats.length > 0) {
        var pCount = el('span', 'sb-proj-count', String(pChats.length));
        pTitleGroup.appendChild(pCount);
      }
      pHead.appendChild(pTitleGroup);

      var pActions = el('div', 'sb-proj-actions');
      var chevron = el('span', 'sb-proj-chevron', '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>');
      pActions.appendChild(chevron);

      var pKebabWrap = el('div', 'ci-kebab');
      var pKbBtn = el('button', 'kebabbtn', SVG_KEBAB);
      pKbBtn.title = 'خيارات المجلد';
      pKbBtn.type = 'button';
      pKbBtn.dataset.act = 'proj-kebab';
      pKbBtn.dataset.pid = p.id;
      pKebabWrap.appendChild(pKbBtn);

      var pKm = el('div', 'kmenu');
      var pKmRename = el('button', '', '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg><span>إعادة التسمية</span>');
      pKmRename.dataset.act = 'proj-rename';
      pKmRename.dataset.pid = p.id;
      pKm.appendChild(pKmRename);

      var pKmColor = el('button', '', '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg><span>تغيير اللون والأيقونة</span>');
      pKmColor.dataset.act = 'proj-edit';
      pKmColor.dataset.pid = p.id;
      pKm.appendChild(pKmColor);

      var pKmDiv = el('div', 'km-divider');
      pKm.appendChild(pKmDiv);

      var pKmDel = el('button', 'km-del', '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg><span>حذف المجلد</span>');
      pKmDel.dataset.act = 'proj-del';
      pKmDel.dataset.pid = p.id;
      pKm.appendChild(pKmDel);

      pKebabWrap.appendChild(pKm);
      pActions.appendChild(pKebabWrap);
      pHead.appendChild(pActions);

      pItem.appendChild(pHead);

      var pChatsContainer = el('div', 'sb-proj-chats');
      for (var ci = 0; ci < pChats.length; ci++) {
        pChatsContainer.appendChild(createChatItemEl(pChats[ci]));
      }
      pItem.appendChild(pChatsContainer);

      projListEl.appendChild(pItem);
    }
  }

  var rootChats = chats.filter(function (c) { return !c.project_id && !c.archived; });
  rootChats.sort(function (a, b) {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  listEmptyEl.classList.toggle('hidden', rootChats.length > 0 || (projects.length > 0));
  for (var rk = 0; rk < rootChats.length; rk++) {
    chatListEl.appendChild(createChatItemEl(rootChats[rk]));
  }
}

function createChatItemEl(c) {
  var isActive = (c.id === currentChatId && !tempActive);
  var item = el('div', 'chat-item' + (isActive ? ' active' : ''));
  item.dataset.id = c.id;

  if (c.pinned) {
    var pinInd = el('span', 'ci-pinned-indicator', '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5M5 12V7a5 5 0 0 1 10 0v5l2 2H3l2-2z"/></svg>');
    item.appendChild(pinInd);
  }

  var title = c.title || 'محادثة جديدة';
  item.appendChild(el('span', 'ci-title', esc(title)));

  var actionsWrap = el('div', 'ci-actions', '');
  actionsWrap.style.display = 'flex';
  actionsWrap.style.alignItems = 'center';
  actionsWrap.style.gap = '2px';

  var pinBtn = el('button', 'ci-pin-btn' + (c.pinned ? ' pinned' : ''), '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5M5 12V7a5 5 0 0 1 10 0v5l2 2H3l2-2z"/></svg>');
  pinBtn.type = 'button';
  pinBtn.title = c.pinned ? 'إلغاء تثبيت الدردشة' : 'تثبيت الدردشة';
  pinBtn.dataset.act = 'pin';
  pinBtn.dataset.id = c.id;
  actionsWrap.appendChild(pinBtn);

  var keb = el('div', 'ci-kebab', '');
  var kbBtn = el('button', 'kebabbtn', SVG_KEBAB);
  kbBtn.title = 'خيارات';
  kbBtn.type = 'button';
  keb.appendChild(kbBtn);

  var km = el('div', 'kmenu', '');

  var btnShare = el('button', '', '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg><span>مشاركة</span>');
  btnShare.dataset.act = 'share';
  km.appendChild(btnShare);

  var btnRen = el('button', '', '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg><span>إعادة التسمية</span>');
  btnRen.dataset.act = 'rename';
  km.appendChild(btnRen);

  km.appendChild(el('div', 'km-divider'));

  var btnMove = el('button', '', '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><span>نقل إلى مجلد…</span>');
  btnMove.dataset.act = 'move';
  km.appendChild(btnMove);

  var pinText = c.pinned ? 'إلغاء التثبيت' : 'تثبيت الدردشة';
  var btnPin = el('button', '', '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5M5 12V7a5 5 0 0 1 10 0v5l2 2H3l2-2z"/></svg><span>' + pinText + '</span>');
  btnPin.dataset.act = 'pin';
  km.appendChild(btnPin);

  var btnArch = el('button', '', '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg><span>أرشفة</span>');
  btnArch.dataset.act = 'archive';
  km.appendChild(btnArch);

  var btnDel = el('button', 'km-del', '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg><span>حذف</span>');
  btnDel.dataset.act = 'del';
  km.appendChild(btnDel);

  keb.appendChild(km);
  actionsWrap.appendChild(keb);
  item.appendChild(actionsWrap);

  return item;
}

function closeKmenus() {
  var open = document.querySelectorAll('.kmenu.open');
  for (var i = 0; i < open.length; i++) open[i].classList.remove('open');
}

/* ================= Project Modal & Picker Helpers ================= */
var selectedProjColor = '#10a37f';
var selectedProjIcon = 'folder';

function initProjectPicker() {
  var grid = $('pip-icons-grid');
  if (grid && !grid.children.length) {
    for (var k in PROJECT_ICONS) {
      (function (iconKey) {
        var btn = el('button', 'pip-icon-btn' + (iconKey === selectedProjIcon ? ' selected' : ''), PROJECT_ICONS[iconKey]);
        btn.type = 'button';
        btn.dataset.icon = iconKey;
        btn.title = iconKey;
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          selectedProjIcon = iconKey;
          grid.querySelectorAll('.pip-icon-btn').forEach(function (b) { b.classList.toggle('selected', b.dataset.icon === iconKey); });
          updateProjPreview();
        });
        grid.appendChild(btn);
      })(k);
    }
  }

  var pop = $('proj-picker-popover');
  var trigger = $('btn-proj-picker-trigger');
  if (trigger && pop) {
    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      pop.classList.toggle('hidden');
    });
  }

  document.querySelectorAll('.pip-color-dot').forEach(function (dot) {
    dot.addEventListener('click', function (e) {
      e.stopPropagation();
      selectedProjColor = dot.dataset.color;
      document.querySelectorAll('.pip-color-dot').forEach(function (d) { d.classList.toggle('selected', d === dot); });
      updateProjPreview();
    });
  });

  var customColorInput = $('pip-custom-color-input');
  if (customColorInput) {
    customColorInput.addEventListener('input', function (e) {
      selectedProjColor = customColorInput.value;
      document.querySelectorAll('.pip-color-dot').forEach(function (d) { d.classList.remove('selected'); });
      updateProjPreview();
    });
  }

  var nameInput = $('mp-input-name');
  var submitBtn = $('btn-submit-project');
  if (nameInput && submitBtn) {
    nameInput.addEventListener('input', function () {
      submitBtn.disabled = !nameInput.value.trim();
    });
    nameInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !submitBtn.disabled) {
        submitBtn.click();
      }
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', async function () {
      var name = (nameInput ? nameInput.value.trim() : '');
      if (!name) return;
      var editId = ($('mp-input-id') ? $('mp-input-id').value : '').trim();
      submitBtn.disabled = true;

      if (editId) {
        try {
          var res = await fetch('/projects/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editId, name: name, color: selectedProjColor, icon: selectedProjIcon })
          });
          var data = await res.json();
          if (data.ok) {
            for (var i = 0; i < projects.length; i++) {
              if (projects[i].id === editId) {
                projects[i].name = name;
                projects[i].color = selectedProjColor;
                projects[i].icon = selectedProjIcon;
                break;
              }
            }
          }
        } catch (err) {
          console.warn('Update project error:', err);
        }
      } else {
        try {
          var res = await fetch('/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, color: selectedProjColor, icon: selectedProjIcon })
          });
          var data = await res.json();
          if (data.ok && data.project) {
            projects.push(data.project);
            expandedProjectIds[data.project.id] = true;
          }
        } catch (err) {
          console.warn('Create project error:', err);
        }
      }

      closeAppModal('modal-project');
      renderSidebar();
      submitBtn.disabled = false;

      if (!editId && data && data.ok && data.project) {
        navigateTo('project', data.project.id);
      } else if (editId) {
        if (activeProjectId === editId) renderProjectWorkspace(editId);
        if (currentView === 'projects') renderProjectsHub();
      }
    });
  }

  var newProjTrigger = $('btn-new-project-trigger');
  if (newProjTrigger) {
    newProjTrigger.addEventListener('click', function (e) {
      e.stopPropagation();
      openProjectModalForCreate();
    });
  }

  var btnProjectsCard = $('btn-projects-card');
  if (btnProjectsCard) {
    btnProjectsCard.addEventListener('click', function (e) {
      if (!e.target.closest('#btn-new-project-trigger')) {
        navigateTo('projects');
      }
    });
  }

  document.addEventListener('click', function (e) {
    if (pop && !pop.classList.contains('hidden') && !e.target.closest('#proj-picker-popover') && !e.target.closest('#btn-proj-picker-trigger')) {
      pop.classList.add('hidden');
    }
  });
}

function updateProjPreview() {
  var badge = $('mp-preview-badge');
  var svg = $('mp-preview-svg');
  if (badge) badge.style.backgroundColor = selectedProjColor;
  if (svg) {
    var iconSvg = PROJECT_ICONS[selectedProjIcon] || PROJECT_ICONS.folder;
    svg.innerHTML = iconSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  }
}

function openProjectModalForCreate() {
  var idInput = $('mp-input-id'); if (idInput) idInput.value = '';
  var nameInput = $('mp-input-name'); if (nameInput) nameInput.value = '';
  var titleEl = $('mp-modal-title'); if (titleEl) titleEl.textContent = 'إنشاء مشروع';
  var submitBtn = $('btn-submit-project'); if (submitBtn) { submitBtn.textContent = 'إنشاء مشروع'; submitBtn.disabled = true; }
  selectedProjColor = '#10a37f';
  selectedProjIcon = 'folder';
  updateProjPreview();
  openAppModal('modal-project');
  if (nameInput) setTimeout(function () { nameInput.focus(); }, 150);
}

function openProjectModalForEdit(proj, openPickerImmediately) {
  if (!proj) return;
  var idInput = $('mp-input-id'); if (idInput) idInput.value = proj.id;
  var nameInput = $('mp-input-name'); if (nameInput) nameInput.value = proj.name;
  var titleEl = $('mp-modal-title'); if (titleEl) titleEl.textContent = 'تعديل المشروع';
  var submitBtn = $('btn-submit-project'); if (submitBtn) { submitBtn.textContent = 'حفظ التعديلات'; submitBtn.disabled = false; }
  selectedProjColor = proj.color || '#10a37f';
  selectedProjIcon = proj.icon || 'folder';
  updateProjPreview();
  openAppModal('modal-project');
  var pop = $('proj-picker-popover');
  if (pop) {
    if (openPickerImmediately) pop.classList.remove('hidden');
    else pop.classList.add('hidden');
  }
  if (nameInput) setTimeout(function () { nameInput.focus(); }, 150);
}

/* ================= Move Chat Modal Helpers ================= */
function openMoveChatModal(chatId) {
  currentMovingChatId = chatId;
  var listEl = $('move-chat-projects-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  var chat = getChat(chatId);
  var curPid = chat ? chat.project_id : null;

  var rootBtn = el('button', 'adm-list-btn' + (!curPid ? ' active' : ''));
  rootBtn.style.display = 'flex';
  rootBtn.style.alignItems = 'center';
  rootBtn.style.gap = '10px';
  rootBtn.style.width = '100%';
  rootBtn.style.padding = '10px 14px';
  rootBtn.style.borderRadius = '10px';
  rootBtn.style.background = 'var(--panel-hover)';
  rootBtn.style.color = 'var(--text)';
  rootBtn.style.cursor = 'pointer';
  rootBtn.innerHTML = '<span style="color:var(--muted);">' + PROJECT_ICONS.folder + '</span><span style="font-size:14px;font-weight:600;flex:1;text-align:right;">بدون مجلد (المحادثات الأخيرة)</span>' + (!curPid ? '<span style="color:var(--accent);">' + SVG_CHECK + '</span>' : '');
  rootBtn.addEventListener('click', function () {
    applyMoveChat(chatId, null);
  });
  listEl.appendChild(rootBtn);

  for (var i = 0; i < projects.length; i++) {
    (function (p) {
      var isThis = (curPid === p.id);
      var btn = el('button', 'adm-list-btn' + (isThis ? ' active' : ''));
      btn.style.display = 'flex';
      btn.style.alignItems = 'center';
      btn.style.gap = '10px';
      btn.style.width = '100%';
      btn.style.padding = '10px 14px';
      btn.style.borderRadius = '10px';
      btn.style.background = 'var(--panel-hover)';
      btn.style.color = 'var(--text)';
      btn.style.cursor = 'pointer';
      var pIconSvg = PROJECT_ICONS[p.icon] || PROJECT_ICONS.folder;
      btn.innerHTML = '<span style="color:' + (p.color || '#10a37f') + ';">' + pIconSvg + '</span><span style="font-size:14px;font-weight:600;flex:1;text-align:right;">' + esc(p.name) + '</span>' + (isThis ? '<span style="color:var(--accent);">' + SVG_CHECK + '</span>' : '');
      btn.addEventListener('click', function () {
        applyMoveChat(chatId, p.id);
      });
      listEl.appendChild(btn);
    })(projects[i]);
  }

  openAppModal('modal-move-chat');
}

function applyMoveChat(chatId, targetProjectId) {
  var chat = getChat(chatId);
  if (chat) {
    chat.project_id = targetProjectId || null;
    serverMoveChat(chat.id, targetProjectId || null);
    if (targetProjectId) expandedProjectIds[targetProjectId] = true;
    renderSidebar();
  }
  closeAppModal('modal-move-chat');
}

