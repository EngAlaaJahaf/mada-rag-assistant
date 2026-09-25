/* ================= Chat model helpers ================= */
function newId() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function makeChat(mode, projectId) {
  var now = Date.now();
  return {
    id: newId(),
    project_id: projectId || null,
    mode: mode || currentMode,
    title: '',
    messages: [],
    pinned: false,
    archived: false,
    created_at: now,
    updated_at: now
  };
}
function getChat(id) {
  if (tempActive && tempChat && (tempChat.id === id || id === 'temp')) return tempChat;
  for (var i = 0; i < chats.length; i++) if (chats[i].id === id) return chats[i];
  return null;
}
function lastUser(chat) {
  var ms = chat.messages;
  for (var i = ms.length - 1; i >= 0; i--) if (ms[i].role === 'user') return ms[i].content;
  return '';
}
function trimHistory(msgs) {
  var total = 0;
  var out = [];
  var ms = msgs.slice();
  for (var i = ms.length - 1; i >= 0; i--) {
    var m = ms[i];
    total += (m.content.length + 40);
    if (total > 14000 && out.length >= 2) break;
    out.unshift(m);
  }
  return out.map(function (m) {
    return { role: m.role, content: String(m.content).slice(0, 6000) };
  });
}

var MD_CBS = [];
var MD_MATH_BLOCKS = [];
var MD_MATH_INLINES = [];

function renderKatex(tex, isBlock) {
  if (typeof katex !== 'undefined' && katex.renderToString) {
    try {
      return katex.renderToString(tex, {
        displayMode: !!isBlock,
        throwOnError: false,
        output: 'htmlAndMathml'
      });
    } catch (err) {
      console.warn('KaTeX render error:', err);
    }
  }
  return '<span class="katex-fallback" dir="ltr">' + esc(tex) + '</span>';
}

function mbHTML(k) {
  var tex = MD_MATH_BLOCKS[k] || '';
  return '<div class="katex-block-wrap" dir="ltr">' + renderKatex(tex, true) + '</div>';
}

function miHTML(k) {
  var tex = MD_MATH_INLINES[k] || '';
  return '<span class="katex-inline-wrap" dir="ltr">' + renderKatex(tex, false) + '</span>';
}

function cbHTML(k) {
  var cb = MD_CBS[k];
  if (!cb) return '';
  var rawLang = (cb.lang || '').trim();
  var displayLang = rawLang ? rawLang.toUpperCase() : 'CODE';
  var effectiveLang = rawLang.toLowerCase();
  var highlightedCode = '';

  if (typeof hljs !== 'undefined') {
    try {
      if (effectiveLang && hljs.getLanguage(effectiveLang)) {
        var hRes = hljs.highlight(cb.code, { language: effectiveLang, ignoreIllegals: true });
        highlightedCode = hRes.value;
      } else {
        var hRes = hljs.highlightAuto(cb.code);
        highlightedCode = hRes.value;
        if (!rawLang && hRes.language) {
          effectiveLang = hRes.language;
          displayLang = hRes.language.toUpperCase();
        }
      }
    } catch (e) {
      highlightedCode = esc(cb.code);
    }
  } else {
    highlightedCode = esc(cb.code);
  }

  var safeLangAttr = esc(effectiveLang || 'plaintext');

  return '<div class="cb" data-lang="' + safeLangAttr + '">' +
    '<div class="cb-head">' +
      '<div class="cb-head-left">' +
        '<span class="cb-lang">' + esc(displayLang) + '</span>' +
      '</div>' +
      '<div class="cb-head-actions">' +
        '<button class="cb-btn cb-copy-btn" type="button" title="نسخ الكود">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
          '<span>Copy</span>' +
        '</button>' +
        '<button class="cb-btn cb-download-btn" type="button" title="تنزيل الكود كملف">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
          '<span>Download</span>' +
        '</button>' +
      '</div>' +
    '</div>' +
    '<pre><code class="hljs language-' + safeLangAttr + '">' + highlightedCode + '</code></pre>' +
  '</div>';
}

function inline(t) {
  var stash = [];
  var s = String(t);
  s = s.replace(/`([^`\n]+)`/g, function (m, c) {
    var k = stash.length;
    stash.push(c);
    return '\u0001IC' + k + '\u0000';
  });
  s = s.replace(/\[([^\]\n]{1,400})\]\((https?:\/\/[^\s)\]]{1,3000})\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  s = s.replace(/\u0001IC(\d+)\u0000/g, function (m, k) {
    return '<code>' + stash[+k] + '</code>';
  });
  return s;
}

function parseRow(line){
  if(!line || line.indexOf('|')===-1) return null;
  var trimmed = line.trim();
  var explicit = trimmed.startsWith('|') || trimmed.endsWith('|');
  if(trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if(trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
  var parts = trimmed.split('|');
  if(parts.length < 2) return null;
  var cells = parts.map(function(c){ return c.trim(); });
  var isSep = cells.every(function(c){ return /^:?[-=]{2,}:?$/.test(c); });
  return { cells: cells, isSep: isSep, explicit: explicit, raw: line };
}

function isRealTable(rows){
  if(!rows || rows.length === 0) return false;
  if(rows.some(function(r){ return r.isSep; })) return true;
  if(rows.length >= 2) return true;
  if(rows.length === 1 && rows[0].cells.length >= 3) return true;
  if(rows.length === 1 && rows[0].cells.length >= 2 && rows[0].explicit) return true;
  return false;
}

function md(src) {
  var s = String(src == null ? '' : src);
  MD_CBS.length = 0;
  MD_MATH_BLOCKS.length = 0;
  MD_MATH_INLINES.length = 0;

  s = s.replace(/(`{3,})([^\n]*)\n?([\s\S]*?)\1/g, function (m, ticks, lang, code) {
    var k = MD_CBS.length;
    MD_CBS.push({ lang: (lang || '').trim(), code: code.replace(/\n$/, '') });
    return '\u0001CB' + k + '\u0000';
  });
  s = s.replace(/(~{3,})([^\n]*)\n?([\s\S]*?)\1/g, function (m, t, lang, code) {
    var k = MD_CBS.length;
    MD_CBS.push({ lang: (lang || '').trim(), code: code.replace(/\n$/, '') });
    return '\u0001CB' + k + '\u0000';
  });

  // Block math: \[ ... \] and $$ ... $$ and \begin{env} ... \end{env}
  s = s.replace(/\\\[([\s\S]*?)\\\]/g, function (m, tex) {
    var k = MD_MATH_BLOCKS.length;
    MD_MATH_BLOCKS.push(tex.trim());
    return '\n\n\u0001MB' + k + '\u0000\n\n';
  });
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, function (m, tex) {
    var k = MD_MATH_BLOCKS.length;
    MD_MATH_BLOCKS.push(tex.trim());
    return '\n\n\u0001MB' + k + '\u0000\n\n';
  });
  s = s.replace(/\\begin\{([a-zA-Z*]+)\}([\s\S]*?)\\end\{\1\}/gi, function (m) {
    var k = MD_MATH_BLOCKS.length;
    MD_MATH_BLOCKS.push(m.trim());
    return '\n\n\u0001MB' + k + '\u0000\n\n';
  });

  // Fix remaining orphaned \] without \[ when preceded by LaTeX expression
  s = s.replace(/(?:^|\n)([ \t]*)([^\n]*?(?:\\[a-zA-Z]+[^\n]*?))\n?[ \t]*\\\]/g, function (m, indent, formula) {
    var k = MD_MATH_BLOCKS.length;
    MD_MATH_BLOCKS.push(formula.trim());
    return '\n\n\u0001MB' + k + '\u0000\n\n';
  });

  // Inline math: \( ... \) and $ ... $
  s = s.replace(/\\\(([\s\S]*?)\\\)/g, function (m, tex) {
    var k = MD_MATH_INLINES.length;
    MD_MATH_INLINES.push(tex.trim());
    return '\u0001MI' + k + '\u0000';
  });
  s = s.replace(/(^|[^\$0-9a-zA-Z\\])\$([^\$\n]+?)\$(?!\$|[0-9])/g, function (m, pre, tex) {
    var k = MD_MATH_INLINES.length;
    MD_MATH_INLINES.push(tex.trim());
    return pre + '\u0001MI' + k + '\u0000';
  });

  var h = esc(s);
  var lines = h.split('\n');
  var out = [];

  function isCB(line) { return /^\u0001CB\d+\u0000$/.test(line); }
  function isMB(line) { return /^\u0001MB\d+\u0000$/.test(line); }

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (isCB(line)) {
      out.push(cbHTML(+line.replace(/\D/g, '')));
      continue;
    }
    if (isMB(line)) {
      out.push(mbHTML(+line.replace(/\D/g, '')));
      continue;
    }
    if (!line.trim()) continue;

    var rTest = parseRow(line);
    if (rTest) {
      var tRows = [rTest];
      while (i + 1 < lines.length) {
        var nxt = lines[i + 1];
        if (!nxt.trim()) {
          var foundNext = null;
          for (var k = i + 2; k < Math.min(i + 4, lines.length); k++) {
            if (lines[k].trim()) {
              foundNext = parseRow(lines[k]);
              break;
            }
          }
          if (foundNext) {
            i++;
            continue;
          }
          break;
        }
        var nRow = parseRow(nxt);
        if (nRow) {
          tRows.push(nRow);
          i++;
        } else {
          break;
        }
      }
      if (isRealTable(tRows)) {
        var hasHeader = (tRows.length > 1 && tRows[1].isSep);
        if (!hasHeader && tRows.length > 1) {
          var r0T = tRows[0].cells.join(' ');
          var r1T = tRows[1].cells.join(' ');
          var hasHKw = /(?:اسم|رقم|كود|تاريخ|عنوان|ملاحظ|درجة|نسبة|بيان|هاتف|بريد|حالة|مدينة|نشاط|تخصص|id|name|code|date|status|city|activity|dept|grade)/i.test(r0T);
          var r0D = /\d{3,}/.test(r0T);
          var r1D = /\d{3,}/.test(r1T);
          if (hasHKw || (!r0D && r1D)) hasHeader = true;
        }
        var sIdx = (tRows.length > 1 && tRows[1].isSep) ? 2 : (hasHeader ? 1 : 0);
        var tHtml = ['<div class="table-wrap"><table>'];
        if (hasHeader) {
          tHtml.push('<thead><tr>');
          tRows[0].cells.forEach(function(c) { tHtml.push('<th>' + inline(c) + '</th>'); });
          tHtml.push('</tr></thead><tbody>');
        } else {
          tHtml.push('<tbody>');
        }
        for (var ri = sIdx; ri < tRows.length; ri++) {
          if (tRows[ri].isSep) continue;
          tHtml.push('<tr>');
          tRows[ri].cells.forEach(function(c) { tHtml.push('<td>' + inline(c) + '</td>'); });
          tHtml.push('</tr>');
        }
        tHtml.push('</tbody></table></div>');
        out.push(tHtml.join(''));
        continue;
      } else {
        tRows.forEach(function(r) { out.push('<p>' + inline(r.raw) + '</p>'); });
        continue;
      }
    }

    var hmm = line.match(/^(#{1,6})\s+(.*)$/);
    if (hmm) {
      var lvl = hmm[1].length;
      out.push('<h' + lvl + '>' + inline(hmm[2]) + '</h' + lvl + '>');
      continue;
    }

    if (line.indexOf('&gt;') === 0) {
      var buf = [];
      while (i < lines.length && lines[i].indexOf('&gt;') === 0) {
        buf.push(lines[i].replace(/^&gt;\s?/, ''));
        i++;
      }
      out.push('<blockquote>' + inline(buf.join('<br>')) + '</blockquote>');
      i--;
      continue;
    }

    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push('<hr>');
      continue;
    }

    var ordered = /^\d+\.\s+/.test(line);
    var ul = /^[-*+•]\s+/.test(line);
    if (ordered || ul) {
      var items = [];
      while (i < lines.length &&
        (/^[-*+•]\s+/.test(lines[i]) || /^\d+\.\s+/.test(lines[i]))) {
        var it = lines[i].replace(/^(?:-{2,}|\*{2,}|\+{2,}|[-*+•]\s+|\d+\.\s+)/, '');
        items.push(inline(it));
        i++;
      }
      out.push(ordered ? '<ol>' : '<ul>');
      for (var j = 0; j < items.length; j++) out.push('<li>' + items[j] + '</li>');
      out.push(ordered ? '</ol>' : '</ul>');
      i--;
      continue;
    }

    var para = [];
    while (i < lines.length) {
      var l = lines[i];
      if (!l.trim() || /^(#{1,6})\s/.test(l) || l.indexOf('&gt;') === 0 || isCB(l) || isMB(l) ||
        /^[-*+•]\s+/.test(l) || /^\d+\.\s+/.test(l)) break;
      para.push(l);
      i++;
    }
    if (para.length) {
      out.push('<p>' + inline(para.join('<br>')) + '</p>');
      i--;
    }
  }

  var res = out.join('\n');
  res = res.replace(/\u0001CB(\d+)\u0000/g, function (m, k) {
    return cbHTML(+k);
  });
  res = res.replace(/\u0001MB(\d+)\u0000/g, function (m, k) {
    return mbHTML(+k);
  });
  res = res.replace(/\u0001MI(\d+)\u0000/g, function (m, k) {
    return miHTML(+k);
  });
  return res;
}

