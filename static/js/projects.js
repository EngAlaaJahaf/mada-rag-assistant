/* ================= Views Routing, Projects Hub & Workspace ================= */
var currentView = 'chat'; // 'chat' | 'projects' | 'project'
var activeProjectId = null;
var activeProjectSubtab = 'chats';
var hubFilter = 'all';

function formatRelativeTime(ts) {
  if (!ts) return 'اليوم';
  var time = typeof ts === 'number' ? ts : (new Date(ts).getTime() || Date.now());
  var diff = Date.now() - time;
  if (diff < 0) return 'اليوم';
  var sec = Math.floor(diff / 1000);
  if (sec < 60) return 'الآن';
  var min = Math.floor(sec / 60);
  if (min < 60) return 'منذ ' + min + ' د';
  var hr = Math.floor(min / 60);
  if (hr < 24) return 'اليوم';
  var day = Math.floor(hr / 24);
  if (day === 1) return 'أمس';
  if (day < 7) return 'منذ ' + day + ' أيام';
  return 'هذا الشهر';
}

function hexToRgba(hex, a) {
  if (!hex || hex[0] !== '#') return 'rgba(16,163,127,' + a + ')';
  var h = hex.slice(1);
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var num = parseInt(h, 16);
  if (isNaN(num)) return 'rgba(16,163,127,' + a + ')';
  return 'rgba(' + (num >> 16) + ',' + ((num >> 8) & 255) + ',' + (num & 255) + ',' + a + ')';
}

function jumpToChatView() {
  // أي إجراء يفتح محادثة يجب أن يُخرج من عرض المشروعات أولاً، وإلا يبقى
  // المركز مخفياً (centerHidden) ويعلق الرابط عند /projects
  if (currentView !== 'chat') {
    navigateTo('chat');
  }
}

function navigateTo(view, id, pushState) {
  currentView = view || 'chat';
  activeProjectId = (currentView === 'project' ? id : null);

  if (pushState !== false) {
    try {
      if (currentView === 'projects') {
        history.pushState({ view: 'projects' }, '', '/projects');
      } else if (currentView === 'project' && id) {
        history.pushState({ view: 'project', id: id }, '', '/project/' + id);
      } else {
        history.pushState({ view: 'chat' }, '', '/chat');
      }
    } catch (e) {}
  }

  body.classList.toggle('view-projects', currentView === 'projects');
  body.classList.toggle('view-project-detail', currentView === 'project');

  var viewHub = $('view-projects-hub');
  var viewDetail = $('view-project-detail');
  var centerZone = $('center-zone');

  if (viewHub) viewHub.classList.toggle('hidden', currentView !== 'projects');
  if (viewDetail) viewDetail.classList.toggle('hidden', currentView !== 'project');
  if (centerZone) centerZone.classList.toggle('hidden', currentView !== 'chat');

  document.querySelectorAll('.sb-nav-item').forEach(function (item) {
    if (item.id === 'btn-new') {
      item.classList.toggle('active', currentView === 'chat');
    } else if (item.dataset.action === 'projects') {
      item.classList.toggle('active', currentView === 'projects');
    } else {
      item.classList.remove('active');
    }
  });

  if (currentView === 'projects') {
    document.title = 'المشروعات - مذكّرتي شات';
    renderProjectsHub();
  } else if (currentView === 'project') {
    renderProjectWorkspace(activeProjectId);
  } else {
    var cur = currentChatId ? getChat(currentChatId) : null;
    document.title = (cur && cur.title) ? (cur.title + ' - مذكّرتي شات') : 'مذكّرتي شات';
  }
}

function ensureChatView() {
  if (typeof currentView === 'undefined' || currentView !== 'chat') {
    navigateTo('chat');
  }
}

function routeCurrentUrl() {
  var path = window.location.pathname;
  var hash = window.location.hash;
  if (path.indexOf('/project/') === 0) {
    var pid = path.substring(9).replace(/\/$/, '');
    if (pid) { navigateTo('project', pid, false); return; }
  } else if (hash.indexOf('#/project/') === 0) {
    var pid = hash.substring(10);
    if (pid) { navigateTo('project', pid, false); return; }
  } else if (path === '/projects' || path === '/projects/' || hash === '#/projects' || hash === '#projects') {
    navigateTo('projects', null, false);
    return;
  }
  navigateTo('chat', null, false);
}

function renderProjectsHub() {
  var listEl = $('hub-projects-list');
  var emptyEl = $('hub-empty-state');
  var searchInput = $('hub-search-input');
  var q = searchInput ? searchInput.value.trim().toLowerCase() : '';

  if (!listEl) return;
  listEl.innerHTML = '';

  var filtered = projects.slice();
  if (q) {
    filtered = filtered.filter(function (p) {
      return (p.name || '').toLowerCase().indexOf(q) !== -1;
    });
  }

  if (filtered.length === 0) {
    if (emptyEl) {
      emptyEl.classList.remove('hidden');
      var pheTitle = emptyEl.querySelector('.phe-title');
      if (pheTitle) pheTitle.textContent = q ? ('لم يتم العثور على أي مشاريع تطابق «' + q + '»') : 'لا توجد مشاريع حتى الآن';
    }
    return;
  }

  if (emptyEl) emptyEl.classList.add('hidden');

  filtered.forEach(function (p) {
    var row = el('div', 'proj-hub-row');
    row.dataset.pid = p.id;

    // Right: Icon Badge + Name
    var right = el('div', 'phr-right');
    var badge = el('div', 'phr-icon-badge');
    var col = p.color || '#10a37f';
    badge.style.color = col;
    badge.style.backgroundColor = hexToRgba(col, 0.15);
    var svgCode = PROJECT_ICONS[p.icon] || PROJECT_ICONS.folder;
    badge.innerHTML = svgCode;
    right.appendChild(badge);

    var title = el('div', 'phr-title', esc(p.name));
    right.appendChild(title);
    row.appendChild(right);

    // Left: Date + Kebab
    var left = el('div', 'phr-left');
    var dt = el('div', 'phr-date', formatRelativeTime(p.created_at || Date.now()));
    left.appendChild(dt);

    var kebWrap = el('div', 'phr-kebab');
    var kbBtn = el('button', 'kebabbtn', SVG_KEBAB);
    kbBtn.style.opacity = '1';
    kbBtn.type = 'button';
    kbBtn.title = 'خيارات';
    kebWrap.appendChild(kbBtn);

    var km = el('div', 'kmenu');
    var btnEdit = el('button', '', '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg><span>تعديل الاسم واللون</span>');
    btnEdit.addEventListener('click', function (e) {
      e.stopPropagation();
      closeKmenus();
      openProjectModalForEdit(p);
    });
    km.appendChild(btnEdit);

    km.appendChild(el('div', 'km-divider'));

    var btnDel = el('button', 'km-del', '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg><span>حذف المشروع</span>');
    btnDel.addEventListener('click', function (e) {
      e.stopPropagation();
      closeKmenus();
      deleteProjectPrompt(p);
    });
    km.appendChild(btnDel);

    kebWrap.appendChild(km);
    left.appendChild(kebWrap);
    row.appendChild(left);

    kbBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var wasOpen = km.classList.contains('open');
      closeKmenus();
      if (!wasOpen) km.classList.add('open');
    });

    row.addEventListener('click', function (e) {
      if (e.target.closest('.phr-kebab')) return;
      navigateTo('project', p.id);
    });

    listEl.appendChild(row);
  });
}

function renderProjectWorkspace(pid) {
  var p = projects.find(function (x) { return x.id === pid; });
  if (!p) {
    navigateTo('projects');
    return;
  }

  var titleEl = $('pd-header-title');
  if (titleEl) titleEl.textContent = p.name;
  document.title = p.name + ' - مذكّرتي شات';

  var iconEl = $('pd-header-icon');
  if (iconEl) {
    iconEl.style.color = p.color || '#10a37f';
    var iconSvg = PROJECT_ICONS[p.icon] || PROJECT_ICONS.folder;
    iconEl.innerHTML = iconSvg;
  }

  var projTa = $('proj-ta');
  if (projTa) {
    projTa.placeholder = 'دردشة جديدة في ' + p.name;
    projTa.value = '';
    updateProjSendDisabled();
  }

  renderProjectTabContent(p);
}

function renderProjectTabContent(p) {
  var chatsContent = $('pdt-content-chats');
  var sourcesContent = $('pdt-content-sources');
  var emptyState = $('pd-empty-state');
  var emptySubtitle = $('pd-empty-subtitle');
  var grid = $('pd-chats-grid');

  if (activeProjectSubtab === 'sources') {
    if (chatsContent) chatsContent.classList.add('hidden');
    if (sourcesContent) sourcesContent.classList.remove('hidden');
    return;
  }

  if (sourcesContent) sourcesContent.classList.add('hidden');
  if (chatsContent) chatsContent.classList.remove('hidden');

  var pChats = chats.filter(function (c) { return c.project_id === p.id && !c.archived; });
  pChats.sort(function (a, b) {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (b.updated_at || b.id) - (a.updated_at || a.id);
  });

  if (pChats.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
    if (emptySubtitle) emptySubtitle.textContent = 'ستُعرض الدردشات الخاصة بـ ' + p.name + ' هنا';
    if (grid) { grid.classList.add('hidden'); grid.innerHTML = ''; }
  } else {
    if (emptyState) emptyState.classList.add('hidden');
    if (grid) {
      grid.classList.remove('hidden');
      grid.innerHTML = '';
      pChats.forEach(function (c) {
        var card = el('div', 'proj-chat-card');
        card.dataset.id = c.id;

        var right = el('div', 'pcc-right');
        var icon = el('div', 'pcc-icon', '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>');
        right.appendChild(icon);

        var info = el('div', 'pcc-info');
        var t = el('div', 'pcc-title', esc(c.title || 'محادثة جديدة'));
        info.appendChild(t);

        var lastMsg = (c.messages && c.messages.length) ? c.messages[c.messages.length - 1].content : '';
        if (lastMsg) {
          var preview = el('div', 'pcc-preview', esc(lastMsg.substring(0, 75) + (lastMsg.length > 75 ? '...' : '')));
          info.appendChild(preview);
        }
        right.appendChild(info);
        card.appendChild(right);

        var left = el('div', 'pcc-left');
        var d = el('div', 'pcc-date', formatRelativeTime(c.updated_at || c.id));
        left.appendChild(d);
        card.appendChild(left);

        card.addEventListener('click', function () {
          navigateTo('chat');
          loadChat(c.id);
        });

        grid.appendChild(card);
      });
    }
  }
}

function deleteProjectPrompt(proj) {
  if (!proj) return;
  if (confirm('هل تريد حذف المشروع «' + proj.name + '»؟ ستظل محادثاته محفوظة في القائمة الرئيسية.')) {
    fetch('/projects/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: proj.id })
    }).then(function () {
      projects = projects.filter(function (x) { return x.id !== proj.id; });
      chats.forEach(function (c) { if (c.project_id === proj.id) c.project_id = null; });
      renderSidebar();
      if (activeProjectId === proj.id) {
        navigateTo('projects');
      } else if (currentView === 'projects') {
        renderProjectsHub();
      }
    });
  }
}

function updateProjSendDisabled() {
  var projTa = $('proj-ta');
  var sendBtn = $('btn-proj-send');
  var voiceBtn = $('btn-proj-voice');
  var hasText = !!(projTa && projTa.value.trim());
  if (sendBtn) sendBtn.classList.toggle('hidden', !hasText);
  if (voiceBtn) voiceBtn.classList.toggle('hidden', hasText);
}

function sendFromProjectWorkspace() {
  var projTa = $('proj-ta');
  if (!projTa) return;
  var text = projTa.value.trim();
  if (!text || !activeProjectId) return;
  projTa.value = '';
  updateProjSendDisabled();
  newChat(activeProjectId);
  navigateTo('chat');
  send(text, currentChatId);
}

function initProjectsWorkspaceAndHubEvents() {
  var btnHubNew = $('btn-hub-new-project');
  if (btnHubNew) btnHubNew.addEventListener('click', openProjectModalForCreate);
  var btnHubFirst = $('btn-hub-create-first');
  if (btnHubFirst) btnHubFirst.addEventListener('click', openProjectModalForCreate);

  var searchInput = $('hub-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      renderProjectsHub();
    });
  }

  document.querySelectorAll('.proj-filter-pill').forEach(function (pill) {
    pill.addEventListener('click', function () {
      document.querySelectorAll('.proj-filter-pill').forEach(function (p) { p.classList.remove('active'); });
      pill.classList.add('active');
      hubFilter = pill.dataset.filter || 'all';
      renderProjectsHub();
    });
  });

  var projTa = $('proj-ta');
  var btnProjSend = $('btn-proj-send');
  if (projTa) {
    projTa.addEventListener('input', function () {
      projTa.style.height = 'auto';
      projTa.style.height = Math.min(projTa.scrollHeight, 180) + 'px';
      updateProjSendDisabled();
    });
    projTa.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendFromProjectWorkspace();
      }
    });
  }
  if (btnProjSend) {
    btnProjSend.addEventListener('click', function () {
      sendFromProjectWorkspace();
    });
  }

  var tabChats = $('pdt-tab-chats');
  var tabSources = $('pdt-tab-sources');
  if (tabChats) {
    tabChats.addEventListener('click', function () {
      activeProjectSubtab = 'chats';
      tabChats.classList.add('active');
      if (tabSources) tabSources.classList.remove('active');
      var p = projects.find(function (x) { return x.id === activeProjectId; });
      if (p) renderProjectTabContent(p);
    });
  }
  if (tabSources) {
    tabSources.addEventListener('click', function () {
      activeProjectSubtab = 'sources';
      tabSources.classList.add('active');
      if (tabChats) tabChats.classList.remove('active');
      var p = projects.find(function (x) { return x.id === activeProjectId; });
      if (p) renderProjectTabContent(p);
    });
  }

  var btnShare = $('btn-proj-share');
  if (btnShare) {
    btnShare.addEventListener('click', function () {
      var url = window.location.origin + '/project/' + activeProjectId;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
          alert('تم نسخ رابط المشروع بنجاح:\n' + url);
        }).catch(function () {
          prompt('رابط المشروع:', url);
        });
      } else {
        prompt('رابط المشروع:', url);
      }
    });
  }

  var btnKb = $('btn-proj-kebab');
  if (btnKb) {
    btnKb.addEventListener('click', function (e) {
      e.stopPropagation();
      var km = $('pd-kmenu');
      if (km) {
        var wasOpen = km.classList.contains('open');
        closeKmenus();
        if (!wasOpen) km.classList.add('open');
      }
    });
  }

  var pdkEdit = $('pdk-edit');
  if (pdkEdit) {
    pdkEdit.addEventListener('click', function (e) {
      e.stopPropagation();
      closeKmenus();
      var p = projects.find(function (x) { return x.id === activeProjectId; });
      if (p) openProjectModalForEdit(p);
    });
  }

  var pdkDelete = $('pdk-delete');
  if (pdkDelete) {
    pdkDelete.addEventListener('click', function (e) {
      e.stopPropagation();
      closeKmenus();
      var p = projects.find(function (x) { return x.id === activeProjectId; });
      if (p) deleteProjectPrompt(p);
    });
  }

  var btnOpenDocs = $('btn-proj-open-docs');
  if (btnOpenDocs) {
    btnOpenDocs.addEventListener('click', function () {
      openFilesModal();
    });
  }

  window.addEventListener('popstate', function () {
    routeCurrentUrl();
  });
  window.addEventListener('hashchange', function () {
    routeCurrentUrl();
  });
}

