/* finnish – Malayalam / English screenplay writer. Offline, no dependencies. Creator: Nishan */
(function () {
  'use strict';
  var THK = window.THK, VERSION = '2.0.0';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function uid() { return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var N = window.finnishNative || null;
  var PT = (function () { var t = document.createElement('div'); try { t.contentEditable = 'plaintext-only'; } catch (e) { } return t.contentEditable === 'plaintext-only' ? 'plaintext-only' : 'true'; })();

  /* ------------------------------------------------------------------ constants */
  var LAB = { scene: 'Scene heading', action: 'Action', char: 'Character', paren: 'Parenthetical', dial: 'Dialogue', trans: 'Transition', shot: 'Shot', note: 'Note' };
  var ORDER = ['scene', 'action', 'char', 'paren', 'dial', 'trans'];
  var NEXT = { scene: 'action', action: 'action', char: 'dial', paren: 'dial', dial: 'char', trans: 'scene', shot: 'action', note: 'action' };
  var PH = { scene: 'INT. / EXT. – place – time', action: 'Action…', char: 'Character', paren: 'parenthetical', dial: 'Dialogue…', trans: 'CUT TO:', shot: 'Shot', note: 'Note' };
  var MARKS = [['Yellow', 'rgba(255,214,10,.55)'], ['Green', 'rgba(52,199,89,.45)'], ['Blue', 'rgba(10,132,255,.40)'], ['Pink', 'rgba(255,55,140,.40)'], ['Orange', 'rgba(255,149,0,.50)']];
  var PRESETS = [['White', '#ffffff', '#000000'], ['Cream', '#fbf3df', '#2b2118'], ['Sepia', '#f1e4c8', '#4a3420'], ['Grey', '#e9ebee', '#1b1d21'], ['Mint', '#e3f6ec', '#0f3a2a'], ['Sky', '#e4f0ff', '#10264a'],
    ['Rose', '#fde8ee', '#4a1428'], ['Legal pad', '#fff8b8', '#222222'], ['Night', '#14171d', '#e8ecf3'], ['Black', '#000000', '#ffffff'], ['Amber', '#1a1208', '#ffb454'], ['Terminal', '#06130b', '#6dff9c']];
  var PAPERPX = { a4: 794, letter: 816 };

  /* ------------------------------------------------------------------ settings */
  var S = { theme: 'auto', ml: true, lastId: '' };
  try { Object.assign(S, JSON.parse(localStorage.getItem('finnish.set') || '{}')); } catch (e) { }
  function saveS() { try { localStorage.setItem('finnish.set', JSON.stringify(S)); } catch (e) { } }
  function applyTheme() {
    var dark = S.theme === 'dark' || (S.theme === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    var m = $('meta[name=theme-color]'); if (m) m.content = dark ? '#0b0f17' : '#dfe9f7';
  }

  /* ------------------------------------------------------------------ storage (IndexedDB, localStorage fallback) */
  var DB = {
    db: null,
    init: function () {
      return new Promise(function (res) {
        try {
          var r = indexedDB.open('finnish', 1);
          r.onupgradeneeded = function () { r.result.createObjectStore('docs', { keyPath: 'id' }); };
          r.onsuccess = function () { DB.db = r.result; res(); };
          r.onerror = r.onblocked = function () { res(); };
        } catch (e) { res(); }
      });
    },
    all: function () {
      var ls = []; try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf('finnish.doc.') === 0) ls.push(JSON.parse(localStorage.getItem(k))); } } catch (e) { }
      if (!DB.db) return Promise.resolve(ls);
      return new Promise(function (res) {
        var q = DB.db.transaction('docs').objectStore('docs').getAll();
        q.onsuccess = function () { var m = {}; q.result.concat(ls).forEach(function (d) { if (!m[d.id] || m[d.id].updated < d.updated) m[d.id] = d; }); res(Object.keys(m).map(function (k) { return m[k]; })); };
        q.onerror = function () { res(ls); };
      });
    },
    put: function (d) {
      var ok = function () { return true; };
      if (!DB.db) { try { localStorage.setItem('finnish.doc.' + d.id, JSON.stringify(d)); } catch (e) { } return Promise.resolve(); }
      return new Promise(function (res) {
        try { var tx = DB.db.transaction('docs', 'readwrite'); tx.objectStore('docs').put(d); tx.oncomplete = function () { res(ok()); }; tx.onerror = tx.onabort = function () { try { localStorage.setItem('finnish.doc.' + d.id, JSON.stringify(d)); } catch (e) { } res(); }; }
        catch (e) { res(); }
      });
    },
    del: function (id) {
      try { localStorage.removeItem('finnish.doc.' + id); } catch (e) { }
      if (!DB.db) return Promise.resolve();
      return new Promise(function (res) { var tx = DB.db.transaction('docs', 'readwrite'); tx.objectStore('docs').delete(id); tx.oncomplete = tx.onerror = function () { res(); }; });
    }
  };

  /* ------------------------------------------------------------------ document model */
  function newDoc(fmt, paper, cover) {
    cover = cover || {};
    return norm({ id: uid(), fmt: fmt, paper: paper, title: cover.title || '', writer: cover.writer || '', director: cover.director || '', date: cover.date || '', blocks: [{ id: uid(), t: 'scene', x: '', x2: '' }] });
  }
  function norm(d) {
    d.id = d.id || uid(); d.fmt = d.fmt === 'two' ? 'two' : 'std'; d.paper = d.paper === 'letter' ? 'letter' : 'a4';
    d.title = d.title || ''; d.writer = d.writer != null && d.writer !== '' ? d.writer : (d.author || ''); d.director = d.director || ''; d.date = d.date || '';
    d.font = d.font || 'Manjari'; d.size = d.size || 12; d.pageColor = d.pageColor || '#ffffff'; d.textColor = d.textColor || '#000000';
    d.created = d.created || Date.now(); d.updated = d.updated || Date.now(); d.credit = d.credit || 'Written by';
    d.blocks = (d.blocks && d.blocks.length ? d.blocks : [{ t: 'scene', x: '' }]).map(function (b) { b.id = b.id || uid(); b.x = b.x || ''; if (b.t === 'scene') b.x2 = b.x2 || ''; return b; });
    return d;
  }
  var cur = null, cb = null, handles = {};
  var hist = { st: [], re: [], t: 0 };
  function snapStr() { return JSON.stringify([cur.blocks, cur.title, cur.writer, cur.director, cur.date]); }
  function snap(force) { clearTimeout(hist.t); hist.t = 0; var s = snapStr(); if (hist.st[hist.st.length - 1] !== s) { hist.st.push(s); if (hist.st.length > 120) hist.st.shift(); hist.re = []; } }
  function snapSoon() { clearTimeout(hist.t); hist.t = setTimeout(snap, 700); }
  function restore(s) { var a = JSON.parse(s); cur.blocks = a[0]; cur.title = a[1]; cur.writer = a[2]; cur.director = a[3]; cur.date = a[4]; renderAll(); dirty(); }
  function undo() { if (hist.t) snap(); if (hist.st.length < 2) return; hist.re.push(hist.st.pop()); restore(hist.st[hist.st.length - 1]); focusBlock(cb && blockById(cb.id) ? cb.id : cur.blocks[0].id); }
  function redo() { if (!hist.re.length) return; var s = hist.re.pop(); hist.st.push(s); restore(s); }
  function blockById(id) { for (var i = 0; i < cur.blocks.length; i++) if (cur.blocks[i].id === id) return cur.blocks[i]; return null; }
  function idxOf(id) { for (var i = 0; i < cur.blocks.length; i++) if (cur.blocks[i].id === id) return i; return -1; }

  /* ------------------------------------------------------------------ autosave + crash journal */
  var saveT = 0, jT = 0, status = 'saved';
  function setStatus(s) { status = s; var e = $('#svdot'); if (e) { e.textContent = s === 'saved' ? '● Saved' : '○ Saving…'; e.style.color = s === 'saved' ? '#30d158' : '#ff9f0a'; } }
  function dirty() {
    if (!cur) return; setStatus('saving');
    clearTimeout(jT); jT = setTimeout(journal, 200);
    clearTimeout(saveT); saveT = setTimeout(persist, 700);
  }
  function journal() { if (!cur || status === 'saved') return; try { cur.updated = Date.now(); localStorage.setItem('finnish.recover', JSON.stringify(cur)); } catch (e) { } }
  function persist() {
    if (!cur) return Promise.resolve(); clearTimeout(saveT); cur.updated = Date.now(); cur.author = cur.writer; S.lastId = cur.id; saveS();
    var c = JSON.parse(JSON.stringify(cur)); delete c._tmp;
    return DB.put(c).then(function () { setStatus('saved'); try { localStorage.removeItem('finnish.recover'); } catch (e) { } });
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden && cur) { journal(); persist(); } });
  window.addEventListener('pagehide', function () { if (cur) journal(); });

  /* ------------------------------------------------------------------ UI helpers */
  var toastT = 0;
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 2200); }
  function dlg(title, body, acts, opt) {
    var sc = el('div', 'scrim'), d = el('div', 'dlg glass'); opt = opt || {};
    if (title) d.appendChild(el('h3', '', esc(title)));
    if (typeof body === 'string') d.appendChild(el('div', '', body)); else if (body) d.appendChild(body);
    var close = function () { sc.remove(); if (opt.onclose) opt.onclose(); };
    if (acts) { var a = el('div', 'acts'); acts.forEach(function (x) { var b = el('button', 'btn ' + (x.cls || ''), esc(x.l)); b.onclick = function () { if (!x.fn || x.fn(d) !== false) close(); }; a.appendChild(b); }); d.appendChild(a); }
    sc.appendChild(d); sc.addEventListener('mousedown', function (e) { if (e.target === sc) close(); }); $('#layer').appendChild(sc);
    var f = $('input,textarea', d); if (f && !opt.nofocus) setTimeout(function () { f.focus(); }, 50);
    d.close = close; return d;
  }
  function menu(anchor, items, right) {
    $$('.menu').forEach(function (m) { m.remove(); });
    var m = el('div', 'menu'), L = $('#layer'), r = anchor.getBoundingClientRect();
    items.forEach(function (it) {
      if (it.hr) return m.appendChild(el('hr')); if (it.hd) return m.appendChild(el('div', 'hd', esc(it.hd)));
      var b = el('button', '', (it.dot ? '<i class="dot" style="background:' + it.dot + '"></i>' : '') + '<span style="flex:1">' + esc(it.l) + '</span>' + (it.k ? '<small style="opacity:.5">' + esc(it.k) + '</small>' : ''));
      b.onclick = function () { close(); it.fn(); }; m.appendChild(b);
    });
    var sc = el('div', 'scrim'); sc.style.background = 'transparent'; sc.style.alignItems = 'flex-start'; sc.style.justifyContent = 'flex-start'; sc.style.padding = '0';
    var close = function () { sc.remove(); }; sc.addEventListener('mousedown', function (e) { if (e.target === sc) close(); });
    sc.appendChild(m); L.appendChild(sc);
    var w = m.offsetWidth, h = m.offsetHeight, x = right ? r.right - w : r.left, y = r.bottom + 6;
    x = Math.max(8, Math.min(x, innerWidth - w - 8)); if (y + h > innerHeight - 8) y = Math.max(8, r.top - h - 6);
    m.style.left = x + 'px'; m.style.top = y + 'px';
  }
  function ask(title, label, val, ok, okLabel) {
    var i = el('input', 't'); i.value = val || ''; i.placeholder = label;
    var d = dlg(title, i, [{ l: 'Cancel' }, { l: okLabel || 'OK', cls: 'pri', fn: function () { ok(i.value.trim()); } }]);
    i.addEventListener('keydown', function (e) { if (e.key === 'Enter') { ok(i.value.trim()); d.close(); } });
  }
  function confirmD(title, msg, ok, label) { dlg(title, '<p>' + esc(msg) + '</p>', [{ l: 'Cancel' }, { l: label || 'OK', cls: 'pri', fn: ok }]); }
  function isPhone() { return (window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) || (matchMedia('(pointer:coarse)').matches && innerWidth < 900); }
  function show(id) { ['splash', 'home', 'wiz', 'app'].forEach(function (s) { if (s !== 'splash') $('#' + s).hidden = s !== id; }); }

  /* ------------------------------------------------------------------ HOME */
  var homeTab = 'start';
  function svgStd() { return '<svg viewBox="0 0 96 72" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><rect x="20" y="3" width="56" height="66" rx="5" opacity=".5"/><path d="M34 16h28M44 28h18M38 36h26M44 52h22"/></svg>'; }
  function svgTwo() { return '<svg viewBox="0 0 96 72" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><rect x="8" y="3" width="80" height="66" rx="5" opacity=".5"/><path d="M48 14v50" stroke-dasharray="4 4"/><path d="M16 22h24M16 32h20M56 40h24M56 50h20"/></svg>'; }
  function renderHome() {
    var h = $('#home'); h.innerHTML = ''; var c = el('div', 'center'); h.appendChild(c);
    c.appendChild(el('div', 'hero', '<img src="icons/finnish-wordmark.png" alt="finnish" style="filter:drop-shadow(0 3px 10px rgba(40,40,100,.45))"><p>Malayalam &amp; English screenplay writer</p>'));
    var tabs = el('div', 'row'); [['start', 'New script'], ['saved', 'Saved']].forEach(function (t) { var b = el('button', 'btn' + (homeTab === t[0] ? ' on' : ''), t[1]); b.onclick = function () { homeTab = t[0]; renderHome(); }; tabs.appendChild(b); });
    c.appendChild(tabs);
    if (homeTab === 'start') {
      c.appendChild(el('h2', '', '<span style="font-weight:600;font-size:19px;display:block;text-align:center">Which format do you want?</span>'));
      var g = el('div', 'formats');
      [['std', 'Standard', 'Classic screenplay layout', svgStd()], ['two', 'Two Column', 'Action on the left, dialogue on the right', svgTwo()]].forEach(function (f) {
        var b = el('button', 'fbtn', f[3] + '<h2>' + f[1] + '</h2><small>' + f[2] + '</small>'); b.onclick = function () { wizard(f[0]); }; g.appendChild(b);
      });
      c.appendChild(g);
    } else {
      var p = el('div', 'panel glass'); p.appendChild(el('h3', '', 'Saved on this device')); var list = el('div', 'saved-list'); p.appendChild(list); c.appendChild(p);
      DB.all().then(function (ds) {
        ds.sort(function (a, b) { return b.updated - a.updated; });
        if (!ds.length) list.innerHTML = '<p style="color:var(--ink2)">Nothing saved yet. Everything you write is saved here automatically.</p>';
        ds.forEach(function (d) {
          var r = el('div', 'sv', '<div class="n"><b>' + esc(d.title || 'Untitled') + '</b><small>' + new Date(d.updated).toLocaleString() + ' · ' + (d.blocks || []).length + ' lines</small></div><span class="tag">' + (d.fmt === 'two' ? 'Two column' : 'Standard') + '</span>');
          var x = el('button', 'btn sm sq danger', '✕'); x.title = 'Delete';
          x.onclick = function (e) { e.stopPropagation(); confirmD('Delete script?', '“' + (d.title || 'Untitled') + '” will be removed from this device.', function () { DB.del(d.id).then(renderHome); }, 'Delete'); };
          r.appendChild(x); r.onclick = function () { openDoc(norm(d)); }; list.appendChild(r);
        });
      });
    }
    var row = el('div', 'row');
    var imp = el('button', 'btn', '⇪ Import (FDX, Scriptty, Fountain, .finnish)'); imp.onclick = pickImport; row.appendChild(imp);
    var ab = el('button', 'btn', 'ⓘ About'); ab.onclick = about; row.appendChild(ab);
    var th = el('button', 'btn', '◐ Theme'); th.onclick = function () { S.theme = S.theme === 'dark' ? 'light' : S.theme === 'light' ? 'auto' : 'dark'; saveS(); applyTheme(); toast('Theme: ' + S.theme); }; row.appendChild(th);
    c.appendChild(row);
    show('home');
  }

  /* ------------------------------------------------------------------ WIZARD: cover -> paper -> editor */
  function wizard(fmt) {
    var data = { title: '', writer: '', director: '', date: '' }, paper = 'a4', w = $('#wiz');
    function stepCover() {
      w.innerHTML = ''; var c = el('div', 'wizcard glass');
      c.innerHTML = '<div class="steps"><i class="on"></i><i></i></div><h2>Cover page</h2><p style="margin:0;text-align:center;color:var(--ink2);font-size:14px">' + (fmt === 'two' ? 'Two Column' : 'Standard') + ' format · you can edit this any time before exporting</p>' +
        '<label>The main title</label><input class="t" id="w1" placeholder="Title of the film" value="' + esc(data.title) + '">' +
        '<label>Writer :</label><input class="t" id="w2" value="' + esc(data.writer) + '">' +
        '<label>Director :</label><input class="t" id="w3" value="' + esc(data.director) + '">' +
        '<label>Date of the exporting :</label><input class="t" id="w4" placeholder="Leave empty = date of export" value="' + esc(data.date) + '">';
      var a = el('div', 'row'); var back = el('button', 'btn', '‹ Back'); back.onclick = renderHome; var nx = el('button', 'btn pri', 'Next ›');
      nx.onclick = function () { data = { title: $('#w1').value.trim(), writer: $('#w2').value.trim(), director: $('#w3').value.trim(), date: $('#w4').value.trim() }; stepPaper(); };
      a.appendChild(back); a.appendChild(nx); c.appendChild(a); w.appendChild(c); show('wiz'); setTimeout(function () { $('#w1').focus(); }, 60);
    }
    function stepPaper() {
      w.innerHTML = ''; var c = el('div', 'wizcard glass');
      c.innerHTML = '<div class="steps"><i></i><i class="on"></i></div><h2>Paper size</h2><p style="margin:0;text-align:center;color:var(--ink2);font-size:14px">Which size will you print or export to?</p>';
      var g = el('div', 'papers');
      [['a4', 'A4', '210 × 297 mm', 84, 119], ['letter', 'Letter', '8.5 × 11 in', 86, 111]].forEach(function (p) {
        var o = el('div', 'paper-opt' + (paper === p[0] ? ' sel' : ''), '<i style="width:' + p[3] + 'px;height:' + p[4] + 'px"></i><b>' + p[1] + '</b><br><small style="color:var(--ink2)">' + p[2] + '</small>');
        o.onclick = function () { paper = p[0]; $$('.paper-opt', g).forEach(function (x) { x.classList.remove('sel'); }); o.classList.add('sel'); }; g.appendChild(o);
      });
      c.appendChild(g);
      var a = el('div', 'row'); var back = el('button', 'btn', '‹ Back'); back.onclick = stepCover; var go = el('button', 'btn pri', 'Open first page ›');
      go.onclick = function () { var d = newDoc(fmt, paper, data); openDoc(d, true); }; a.appendChild(back); a.appendChild(go); c.appendChild(a); w.appendChild(c);
    }
    stepCover();
  }

  /* ------------------------------------------------------------------ EDITOR: render */
  function applyLook() {
    var A = $('#app'), s = A.style;
    s.setProperty('--pagec', cur.pageColor); s.setProperty('--textc', cur.textColor);
    s.setProperty('--font', THK.fontStack(cur.font)); s.setProperty('--fs', (cur.size * 1.3333).toFixed(2) + 'px'); s.setProperty('--pw', PAPERPX[cur.paper] + 'px');
    var pg = $('#page'); pg.className = cur.fmt === 'two' ? 'two' : 'std';
    ['#cover', '#page'].forEach(function (q) { $(q).style.background = cur.pageColor; $(q).style.color = cur.textColor; });
  }
  function mkBlock(b) {
    var w = el('div', 'b ' + b.t + (b.al ? ' al-' + b.al : '') + (b.pb ? ' pb' : '') + (b.mk ? ' mk' : '')); w.dataset.id = b.id; w.dataset.lab = LAB[b.t];
    if (b.pb) w.dataset.pg = 'page break · next page'; if (b.mk) w.style.setProperty('--mk', b.mk);
    var ed = function (f, ph) { var e = el('div', 'ed'); e.dataset.f = f; e.dataset.ph = ph; e.contentEditable = PT; e.spellcheck = false; e.setAttribute('autocapitalize', 'off'); e.textContent = b[f] || ''; return e; };
    if (b.t === 'scene' && cur.fmt === 'two') { w.appendChild(ed('x', 'Place')); w.appendChild(ed('x2', 'Day / Night')); } else w.appendChild(ed('x', PH[b.t]));
    return w;
  }
  function renderCover() {
    var c = $('#cover'); c.innerHTML = '';
    var f = function (key, ph) { var e = el('div', 'ed'); e.dataset.f = key; e.dataset.ph = ph; e.contentEditable = PT; e.spellcheck = false; e.textContent = cur[key] || ''; return e; };
    var t = f('title', 'The Main Title'); t.classList.add('ct'); c.appendChild(t);
    [['writer', 'Writer :', 'name'], ['director', 'Director :', 'name'], ['date', 'Date of the exporting :', 'auto – today’s date when you export']].forEach(function (r) {
      var l = el('div', 'cl'); l.appendChild(el('b', '', r[1])); l.appendChild(f(r[0], r[2])); c.appendChild(l);
    });
    c.appendChild(el('div', 'edh', 'Cover page – editable until you export. It has no title or page number on top.'));
  }
  function renderAll() {
    applyLook(); renderCover();
    var pg = $('#page'); pg.innerHTML = ''; cur.blocks.forEach(function (b) { pg.appendChild(mkBlock(b)); });
    var t = $('#ttl'); if (t) t.firstChild.nodeValue = cur.title || 'Untitled'; refreshSide(); refreshRibbon();
  }
  function blockEl(id) { return $('#page .b[data-id="' + id + '"]'); }
  function getCaret(e) { var s = getSelection(); if (!s.rangeCount || !e.contains(s.anchorNode)) return e.textContent.length; var r = s.getRangeAt(0).cloneRange(); r.selectNodeContents(e); r.setEnd(s.anchorNode, s.anchorOffset); return r.toString().length; }
  function setCaret(e, pos) {
    var w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT), n, rem = pos; var r = document.createRange();
    while ((n = w.nextNode())) { if (rem <= n.length) { r.setStart(n, rem); r.collapse(true); var s = getSelection(); s.removeAllRanges(); s.addRange(r); return; } rem -= n.length; }
    r.selectNodeContents(e); r.collapse(false); var s2 = getSelection(); s2.removeAllRanges(); s2.addRange(r);
  }
  function focusBlock(id, pos, field) {
    var w = blockEl(id); if (!w) return; var e = $('.ed[data-f="' + (field || 'x') + '"]', w) || $('.ed', w); e.focus(); setCaret(e, pos == null ? e.textContent.length : pos); keepVisible(e);
  }
  function keepVisible(e) { try { e.scrollIntoView({ block: 'nearest' }); } catch (x) { } }
  function setCur(id) {
    var b = blockById(id); if (!b || cb === b) { updateElSel(); return; } cb = b;
    $$('#page .b.cur').forEach(function (x) { x.classList.remove('cur'); }); var w = blockEl(id); if (w) w.classList.add('cur'); updateElSel(); suggest();
  }

  /* ------------------------------------------------------------------ editing events */
  var tl = { buf: '', len: 0, pos: -1, el: null };
  function readField(e) { return e.textContent.replace(/​/g, '').replace(/\n$/, ''); }
  function syncField(e) {
    if (e.closest('#cover')) { cur[e.dataset.f] = readField(e); if (e.dataset.f === 'title') { var t = $('#ttl'); if (t) t.firstChild.nodeValue = cur.title || 'Untitled'; } }
    else { var w = e.closest('.b'); if (!w) return; var b = blockById(w.dataset.id); if (b) b[e.dataset.f] = readField(e); }
    dirty(); snapSoon();
  }
  function tlType(e, ch) {
    var pos = getCaret(e), txt = e.textContent;
    if (tl.el !== e || tl.pos !== pos) { tl.buf = ''; tl.len = 0; tl.el = e; }
    tl.buf += ch; var out = ML.translit(tl.buf), before = txt.slice(0, pos - tl.len), after = txt.slice(pos);
    e.textContent = before + out + after; setCaret(e, before.length + out.length); tl.len = out.length; tl.pos = before.length + out.length; syncField(e);
  }
  function tlBack(e) {
    var pos = getCaret(e), txt = e.textContent; tl.buf = tl.buf.slice(0, -1);
    var out = tl.buf ? ML.translit(tl.buf) : '', before = txt.slice(0, pos - tl.len), after = txt.slice(pos);
    e.textContent = before + out + after; setCaret(e, before.length + out.length); tl.len = out.length; tl.pos = before.length + out.length; if (!tl.buf) tl.pos = -1; syncField(e);
  }
  function addAfter(i, nb, focusPos) {
    snap(); cur.blocks.splice(i + 1, 0, nb); var w = mkBlock(nb), ref = blockEl(cur.blocks[i].id); ref.after(w); snap(); dirty(); refreshSide(); focusBlock(nb.id, focusPos || 0);
  }
  function onKey(ev) {
    var e = ev.target.closest && ev.target.closest('.ed'); if (!e) return; var inCover = !!e.closest('#cover');
    var k = ev.key, mod = ev.ctrlKey || ev.metaKey;
    if (mod) {
      var lk = k.toLowerCase();
      if (lk === 'z' && !ev.shiftKey) { ev.preventDefault(); return undo(); }
      if (lk === 'y' || (lk === 'z' && ev.shiftKey)) { ev.preventDefault(); return redo(); }
      if (lk === 's') { ev.preventDefault(); return ev.shiftKey ? saveAs() : save(); }
      if (lk === 'f') { ev.preventDefault(); return findDlg(); }
      if (lk === 'k') { ev.preventDefault(); return palette(); }
      if (k === 'Enter') { ev.preventDefault(); return nextPage(); }
      if (k === ' ') { ev.preventDefault(); S.ml = !S.ml; saveS(); refreshRibbon(); return toast(S.ml ? 'Malayalam typing ON (Manglish)' : 'English typing'); }
      if (k === 'ArrowUp' || k === 'ArrowDown') { ev.preventDefault(); return jumpScene(k === 'ArrowUp' ? -1 : 1); }
      return;
    }
    if (inCover) {
      if (k === 'Enter' && !ev.shiftKey) { ev.preventDefault(); var all = $$('#cover .ed'), i = all.indexOf(e); if (i < all.length - 1) { all[i + 1].focus(); setCaret(all[i + 1], 1e6); } else focusBlock(cur.blocks[0].id, 0); return; }
      if (k.length === 1 && S.ml && /[A-Za-z]/.test(k) && !ev.altKey && e.dataset.f !== 'date') { ev.preventDefault(); return tlType(e, k); }
      if (k === 'Backspace' && tl.buf && tl.el === e && tl.pos === getCaret(e)) { ev.preventDefault(); return tlBack(e); }
      tl.buf = ''; return;
    }
    var w = e.closest('.b'), b = blockById(w.dataset.id), i2 = idxOf(b.id), f = e.dataset.f;
    if (k.length === 1 && S.ml && /[A-Za-z]/.test(k) && !ev.altKey) { ev.preventDefault(); return tlType(e, k); }
    if (k === 'Backspace' && tl.buf && tl.el === e && tl.pos === getCaret(e)) { ev.preventDefault(); return tlBack(e); }
    if (k !== 'Shift' && k !== 'Control' && k !== 'Alt') tl.buf = '';
    if (k === 'Enter' && ev.shiftKey) { ev.preventDefault(); document.execCommand('insertText', false, '\n'); return; }
    if (k === 'Enter') {
      ev.preventDefault(); var pos = getCaret(e), txt = readField(e);
      if (b.t === 'scene' && cur.fmt === 'two' && f === 'x') { var e2 = $('.ed[data-f=x2]', w); e2.focus(); setCaret(e2, 0); return; }
      var before = txt.slice(0, pos), after = txt.slice(pos);
      if (!txt.trim() && f === 'x' && b.t !== 'scene' && !b.pb) { setType(b, 'scene'); return; } // Enter on an empty line → scene heading
      b[f] = before; e.textContent = before; var nt = NEXT[b.t];
      if (b.t === 'scene' && cur.fmt === 'two' && f === 'x2') { if (b.x2 === undefined) b.x2 = ''; }
      var nb = { id: uid(), t: nt, x: after }; if (nt === 'scene') nb.x2 = ''; addAfter(i2, nb, 0); return;
    }
    if (k === 'Backspace' && getCaret(e) === 0 && getSelection().isCollapsed) {
      if (f === 'x2') { ev.preventDefault(); focusBlock(b.id, null, 'x'); return; }
      if (i2 > 0) {
        ev.preventDefault(); snap(); var pv = cur.blocks[i2 - 1], txt2 = readField(e), joinAt = (pv.x || '').length;
        if (!txt2 && pv.t === 'scene' && cur.fmt === 'two' && false) { }
        pv.x = (pv.x || '') + txt2; cur.blocks.splice(i2, 1); w.remove(); var pe = blockEl(pv.id); $('.ed[data-f=x]', pe).textContent = pv.x; snap(); dirty(); refreshSide(); focusBlock(pv.id, joinAt);
      }
      return;
    }
    if (k === 'Tab') { ev.preventDefault(); var j = ORDER.indexOf(b.t); j = j < 0 ? 1 : j; setType(b, ORDER[(j + (ev.shiftKey ? ORDER.length - 1 : 1)) % ORDER.length]); return; }
    if (k === 'ArrowUp' && !ev.shiftKey && caretOnFirstLine(e) && i2 > 0) { ev.preventDefault(); focusBlock(cur.blocks[i2 - 1].id, null); return; }
    if (k === 'ArrowDown' && !ev.shiftKey && caretOnLastLine(e) && i2 < cur.blocks.length - 1) { ev.preventDefault(); focusBlock(cur.blocks[i2 + 1].id, 0); return; }
  }
  function caretRect(e) { var s = getSelection(); if (!s.rangeCount) return null; var r = s.getRangeAt(0).cloneRange(); var rs = r.getClientRects(); return rs.length ? rs[0] : e.getBoundingClientRect(); }
  function caretOnFirstLine(e) { if (e.textContent.indexOf('\n') < 0 && getCaret(e) === 0) return true; var c = caretRect(e), b = e.getBoundingClientRect(); return !c || c.top - b.top < 6; }
  function caretOnLastLine(e) { var c = caretRect(e), b = e.getBoundingClientRect(); return !c || b.bottom - c.bottom < 6; }
  function onInput(ev) { var e = ev.target.closest && ev.target.closest('.ed'); if (!e) return; if (tl.el === e && getCaret(e) !== tl.pos) tl.buf = ''; syncField(e); keepVisible(e); suggest(); }
  function onPaste(ev) {
    var e = ev.target.closest && ev.target.closest('.ed'); if (!e) return; ev.preventDefault();
    var t = (ev.clipboardData || window.clipboardData).getData('text/plain').replace(/\r/g, ''); tl.buf = '';
    var lines = t.split('\n'); if (e.closest('#cover') || lines.length < 2 || e.dataset.f === 'x2') { document.execCommand('insertText', false, t.replace(/\n+/g, ' ')); return; }
    var w = e.closest('.b'), b = blockById(w.dataset.id), i = idxOf(b.id), pos = getCaret(e), txt = readField(e), after = txt.slice(pos);
    b.x = txt.slice(0, pos) + lines[0]; e.textContent = b.x; var last = i, nbs = [];
    lines.slice(1).forEach(function (l) { nbs.push({ id: uid(), t: b.t === 'scene' ? 'action' : b.t, x: l }); });
    nbs[nbs.length - 1].x += after; snap(); nbs.forEach(function (nb) { cur.blocks.splice(++last, 0, nb); }); renderAll(); snap(); dirty(); focusBlock(nbs[nbs.length - 1].id, nbs[nbs.length - 1].x.length - after.length);
  }
  function onFocus(ev) { var w = ev.target.closest && ev.target.closest('#page .b'); if (w) setCur(w.dataset.id); else if (ev.target.closest && ev.target.closest('#cover')) { cb = null; $$('#page .b.cur').forEach(function (x) { x.classList.remove('cur'); }); } }
  function setType(b, t) {
    snap(); b.t = t; if (t === 'scene' && b.x2 === undefined) b.x2 = ''; var old = blockEl(b.id), nw = mkBlock(b); old.replaceWith(nw); if (cb && cb.id === b.id) nw.classList.add('cur'); snap(); dirty(); refreshSide(); updateElSel(); focusBlock(b.id, null);
  }
  function setAlign(a) { if (!cb) return toast('Click on a line first'); snap(); cb.al = cb.al === a ? '' : a; var w = blockEl(cb.id); ['left', 'center', 'right', 'justify'].forEach(function (x) { w.classList.remove('al-' + x); }); if (cb.al) w.classList.add('al-' + cb.al); snap(); dirty(); }
  function nextPage() {
    if (!cb) cb = cur.blocks[cur.blocks.length - 1]; var i = idxOf(cb.id); snap();
    if (!(cb.x || '').trim() && !(cb.x2 || '').trim()) { cb.pb = !cb.pb; var w = blockEl(cb.id); w.classList.toggle('pb', cb.pb); if (cb.pb) w.dataset.pg = 'page break · next page'; focusBlock(cb.id, 0); toast(cb.pb ? 'New page started' : 'Page break removed'); snap(); dirty(); return; }
    var nb = { id: uid(), t: 'scene', x: '', x2: '', pb: true }; addAfter(i, nb, 0); toast('Next page ✓');
  }
  function jumpScene(d) {
    var i = cb ? idxOf(cb.id) : 0, j = i + d; while (j >= 0 && j < cur.blocks.length && cur.blocks[j].t !== 'scene') j += d; if (j >= 0 && j < cur.blocks.length) focusBlock(cur.blocks[j].id, null);
  }

  /* ------------------------------------------------------------------ character suggestions */
  function suggest() {
    var s = $('#sug'); if (!s) return; s.innerHTML = '';
    if (!cb || cb.t !== 'char') { s.hidden = true; return; }
    var q = (cb.x || '').trim(), seen = {}, names = [];
    cur.blocks.forEach(function (b) { if (b.t === 'char' && b !== cb) { var n = (b.x || '').trim(); if (n && !seen[n] && n !== q && (!q || n.indexOf(q) === 0)) { seen[n] = 1; names.push(n); } } });
    if (!names.length) { s.hidden = true; return; }
    names.slice(0, 8).forEach(function (n) { var b = el('button', 'btn sm', esc(n)); b.onmousedown = function (e) { e.preventDefault(); cb.x = n; $('.ed', blockEl(cb.id)).textContent = n; dirty(); var i = idxOf(cb.id); var nb = { id: uid(), t: cur.fmt === 'two' ? 'dial' : 'dial', x: '' }; addAfter(i, nb, 0); }; s.appendChild(b); });
    s.hidden = false;
  }

  /* ------------------------------------------------------------------ ribbon / top bar / accessory */
  var R = {};
  function btn(label, fn, cls, title) { var b = el('button', 'btn ' + (cls || ''), label); b.onmousedown = function (e) { e.preventDefault(); }; b.onclick = fn; if (title) b.title = title; return b; }
  function buildChrome() {
    var T = $('#top'); T.innerHTML = '';
    T.appendChild(btn('‹', goHome, 'sq', 'Home'));
    var tt = el('div', 'ttl', ''); tt.id = 'ttl'; tt.appendChild(document.createTextNode(cur.title || 'Untitled')); var sd = el('small', '', ''); sd.id = 'svdot'; tt.appendChild(sd);
    tt.onclick = function () { $('#scroll').scrollTop = 0; var e = $('#cover .ed'); e.focus(); setCaret(e, 1e6); }; T.appendChild(tt);
    T.appendChild(btn('Next page ⏎', nextPage, 'pri', 'Start the next page (Ctrl+Enter)'));
    T.appendChild(btn('⋯', function (e) { moreMenu(e.currentTarget); }, 'sq', 'More'));
    var Rb = $('#ribbon'); Rb.innerHTML = '';
    R.undo = btn('↶', undo, 'sq', 'Undo'); R.redo = btn('↷', redo, 'sq', 'Redo'); Rb.appendChild(R.undo); Rb.appendChild(R.redo); Rb.appendChild(el('i', 'sep'));
    var sel = el('select', 't'); sel.id = 'elsel'; ORDER.concat(['shot', 'note']).forEach(function (t) { var o = el('option', '', LAB[t]); o.value = t; sel.appendChild(o); });
    sel.onchange = function () { if (cb) setType(cb, sel.value); }; Rb.appendChild(sel);
    [['⇤', 'left'], ['↔', 'center'], ['⇥', 'right'], ['☰', 'justify']].forEach(function (a) { Rb.appendChild(btn(a[0], function () { setAlign(a[1]); }, 'sq hide-s', 'Align ' + a[1])); });
    Rb.appendChild(el('i', 'sep'));
    var fs = el('select', 't'); THK.FONTS.forEach(function (f) { var o = el('option', '', f.label); o.value = f.id; fs.appendChild(o); }); fs.value = cur.font; fs.onchange = function () { cur.font = fs.value; applyLook(); dirty(); }; R.font = fs; Rb.appendChild(fs);
    var sz = el('select', 't'); [10, 11, 12, 13, 14, 16, 18, 20].forEach(function (n) { var o = el('option', '', n + ' pt'); o.value = n; sz.appendChild(o); }); sz.value = cur.size; sz.onchange = function () { cur.size = +sz.value; applyLook(); dirty(); }; R.size = sz; Rb.appendChild(sz);
    Rb.appendChild(el('i', 'sep'));
    Rb.appendChild(btn('🎨 Colours', colourDlg, '', 'Page and text colour')); Rb.appendChild(btn('⇄', reverseColours, 'sq', 'Reverse page / text colours (click again to undo)'));
    Rb.appendChild(btn('🖍 Marker', function (e) { markerMenu(e.currentTarget); }, '', 'Mark a line with a colour'));
    Rb.appendChild(el('i', 'sep'));
    Rb.appendChild(btn('🔍', findDlg, 'sq', 'Find & replace')); Rb.appendChild(btn('☷', function () { toggleSide(); }, 'sq', 'Scenes & markers'));
    Rb.appendChild(btn('💾 Save', save, '', 'Save (Ctrl+S)')); Rb.appendChild(btn('⇩ Export', exportDlg, 'pri', 'Export PDF / FDX / Fountain'));
    var A = $('#acc'); A.innerHTML = ''; var sg = el('div', ''); sg.id = 'sug'; sg.hidden = true; sg.style.cssText = 'position:fixed;left:12px;right:12px;bottom:84px;display:flex;gap:6px;flex-wrap:wrap;justify-content:center;z-index:6;pointer-events:none';
    sg.addEventListener('mousedown', function () { }); $('#app').appendChild(sg); sg.style.pointerEvents = 'auto';
    ORDER.forEach(function (t) { var b = btn(LAB[t].replace(' heading', ''), function () { if (!cb) return toast('Click on a line first'); setType(cb, t); }, '', LAB[t]); b.dataset.t = t; A.appendChild(b); });
    R.ml = btn('', function () { S.ml = !S.ml; saveS(); refreshRibbon(); toast(S.ml ? 'Malayalam typing ON (Manglish)' : 'English typing'); }, '', 'Manglish typing (Ctrl+Space)'); A.appendChild(R.ml);
    refreshRibbon();
  }
  function refreshRibbon() { if (R.ml) { R.ml.textContent = S.ml ? 'മ  ML' : 'A  EN'; R.ml.classList.toggle('on', S.ml); } if (R.font) { R.font.value = cur.font; R.size.value = cur.size; } updateElSel(); }
  function updateElSel() { var s = $('#elsel'); if (s && cb) s.value = cb.t; $$('#acc .btn[data-t]').forEach(function (b) { b.classList.toggle('on', !!cb && b.dataset.t === cb.t); }); }
  function moreMenu(a) {
    menu(a, [
      { hd: 'File' }, { l: 'Save', k: 'Ctrl+S', fn: save }, { l: 'Save As…', k: 'Ctrl+Shift+S', fn: saveAs }, { l: 'Export…', fn: exportDlg }, { l: 'Import file…', fn: pickImport },
      { hr: 1 }, { hd: 'Script' }, { l: 'Edit cover page', fn: function () { $('#scroll').scrollTop = 0; var e = $('#cover .ed'); e.focus(); setCaret(e, 1e6); } },
      { l: 'Switch to ' + (cur.fmt === 'two' ? 'Standard' : 'Two Column') + ' layout', fn: switchFmt }, { l: 'Paper: ' + (cur.paper === 'a4' ? 'switch to Letter' : 'switch to A4'), fn: function () { cur.paper = cur.paper === 'a4' ? 'letter' : 'a4'; applyLook(); dirty(); toast('Paper: ' + (cur.paper === 'a4' ? 'A4' : 'Letter')); } },
      { l: 'Scenes & markers panel', fn: function () { toggleSide(); } }, { l: 'Command palette…', k: 'Ctrl+K', fn: palette },
      { hr: 1 }, { l: 'Help & shortcuts', fn: helpDlg }, { l: 'Theme: ' + S.theme, fn: function () { S.theme = S.theme === 'dark' ? 'light' : S.theme === 'light' ? 'auto' : 'dark'; saveS(); applyTheme(); } }, { l: 'About finnish', fn: about }
    ], true);
  }
  function switchFmt() {
    snap(); cur.fmt = cur.fmt === 'two' ? 'std' : 'two'; cur.blocks.forEach(function (b) { if (b.t === 'scene' && b.x2 === undefined) b.x2 = ''; }); renderAll(); dirty(); toast('Layout: ' + (cur.fmt === 'two' ? 'Two Column' : 'Standard'));
  }

  /* ------------------------------------------------------------------ colours, markers */
  function colourDlg() {
    var b = el('div', ''); b.appendChild(el('p', '', 'One tap changes the whole page and all the text. “Reverse” swaps them and swaps back on the next tap.'));
    var g = el('div', 'grid'); b.appendChild(g);
    var d;
    PRESETS.forEach(function (p) { var c = el('div', 'pc', 'അ'); c.style.background = p[1]; c.style.color = p[2]; c.title = p[0]; if (cur.pageColor.toLowerCase() === p[1] && cur.textColor.toLowerCase() === p[2]) c.classList.add('sel'); c.onclick = function () { setColours(p[1], p[2]); $$('.pc', g).forEach(function (x) { x.classList.remove('sel'); }); c.classList.add('sel'); cp.value = p[1]; ct.value = p[2]; }; g.appendChild(c); });
    var r = el('div', 'row'); r.style.margin = '10px 0 0';
    var cp = el('input'); cp.type = 'color'; cp.value = cur.pageColor; var ct = el('input'); ct.type = 'color'; ct.value = cur.textColor;
    cp.oninput = function () { setColours(cp.value, cur.textColor); }; ct.oninput = function () { setColours(cur.pageColor, ct.value); };
    r.appendChild(el('span', '', 'Page')); r.appendChild(cp); r.appendChild(el('span', '', 'Text')); r.appendChild(ct); b.appendChild(r);
    dlg('Page & text colour', b, [{ l: 'Reverse', fn: function () { reverseColours(); cp.value = cur.pageColor; ct.value = cur.textColor; return false; } }, { l: 'Reset', fn: function () { setColours('#ffffff', '#000000'); } }, { l: 'Done', cls: 'pri' }]);
  }
  function setColours(p, t) { cur.pageColor = p; cur.textColor = t; applyLook(); dirty(); }
  function reverseColours() { setColours(cur.textColor, cur.pageColor); toast('Colours reversed'); }
  function markerMenu(a) {
    var items = [{ hd: 'Mark current line' }]; MARKS.forEach(function (m) { items.push({ l: m[0], dot: m[1], fn: function () { mark(m[1], false); } }); });
    items.push({ hr: 1 }, { hd: 'Mark whole scene' }); MARKS.forEach(function (m) { items.push({ l: m[0] + ' – scene', dot: m[1], fn: function () { mark(m[1], true); } }); });
    items.push({ hr: 1 }, { l: 'Clear marker (line)', fn: function () { mark('', false); } }, { l: 'Clear all markers', fn: function () { snap(); cur.blocks.forEach(function (b) { delete b.mk; }); renderAll(); dirty(); } });
    menu(a, items);
  }
  function mark(c, scene) {
    if (!cb) return toast('Click on a line first'); snap(); var i = idxOf(cb.id), from = i, to = i;
    if (scene) { while (from > 0 && cur.blocks[from].t !== 'scene') from--; to = from + 1; while (to < cur.blocks.length && cur.blocks[to].t !== 'scene') to++; to--; }
    for (var j = from; j <= to; j++) { var b = cur.blocks[j]; if (c) b.mk = c; else delete b.mk; var w = blockEl(b.id); w.classList.toggle('mk', !!c); if (c) w.style.setProperty('--mk', c); else w.style.removeProperty('--mk'); }
    snap(); dirty(); refreshSide();
  }

  /* ------------------------------------------------------------------ side panel */
  var sideTab = 'scenes';
  function toggleSide() { var s = $('#side'); s.hidden = !s.hidden; refreshSide(); }
  function refreshSide() {
    var s = $('#side'); if (!s || s.hidden) return; s.innerHTML = '';
    var t = el('div', 'tabs'); [['scenes', 'Scenes'], ['marks', 'Markers']].forEach(function (x) { var b = el('button', 'btn sm' + (sideTab === x[0] ? ' on' : ''), x[1]); b.onclick = function () { sideTab = x[0]; refreshSide(); }; t.appendChild(b); }); s.appendChild(t);
    var words = 0; cur.blocks.forEach(function (b) { words += ((b.x || '') + ' ' + (b.x2 || '')).trim().split(/\s+/).filter(Boolean).length; });
    s.appendChild(el('div', 'side-item', '<small>' + cur.blocks.filter(function (b) { return b.t === 'scene'; }).length + ' scenes · ' + words + ' words · ' + (cur.blocks.filter(function (b) { return b.pb; }).length + 1) + '+ pages</small>'));
    var n = 0;
    cur.blocks.forEach(function (b) {
      if (sideTab === 'scenes' && b.t === 'scene') { n++; var it = el('div', 'side-item', '<b>' + n + '</b><span>' + esc(((b.x || '') + ' ' + (b.x2 || '')).trim() || '(empty scene)') + '</span>'); it.onclick = function () { focusBlock(b.id, null); }; s.appendChild(it); }
      if (sideTab === 'marks' && b.mk) { var im = el('div', 'side-item', '<i class="dot" style="background:' + b.mk + '"></i><span>' + esc((b.x || '').slice(0, 60) || '(empty)') + '</span><small>' + LAB[b.t] + '</small>'); im.onclick = function () { focusBlock(b.id, null); }; s.appendChild(im); }
    });
    if (s.children.length < 3) s.appendChild(el('div', 'side-item', '<small>' + (sideTab === 'scenes' ? 'No scene headings yet.' : 'No marked lines. Use 🖍 Marker.') + '</small>'));
  }

  /* ------------------------------------------------------------------ find & replace */
  function findDlg() {
    var b = el('div', ''), f = el('input', 't'), r = el('input', 't'); f.placeholder = 'Find'; r.placeholder = 'Replace with'; r.style.marginTop = '8px'; b.appendChild(f); b.appendChild(r);
    var pos = { i: cb ? idxOf(cb.id) : 0, off: 0 }, info = el('p', '', ''); b.appendChild(info);
    function all() { var res = []; var q = f.value.toLowerCase(); if (!q) return res; cur.blocks.forEach(function (bl, i) { ['x', 'x2'].forEach(function (fl) { var t = (bl[fl] || '').toLowerCase(), k = -1; while ((k = t.indexOf(q, k + 1)) >= 0) res.push([i, fl, k]); }); }); return res; }
    function next() {
      var a = all(); info.textContent = a.length + ' match(es)'; if (!a.length) return;
      var hit = a.filter(function (m) { return m[0] > pos.i || (m[0] === pos.i && m[2] >= pos.off); })[0] || a[0]; pos.i = hit[0]; pos.off = hit[2] + 1;
      var w = blockEl(cur.blocks[hit[0]].id), e = $('.ed[data-f=' + hit[1] + ']', w); e.focus(); var tn = e.firstChild; if (tn) { var rg = document.createRange(); rg.setStart(tn, hit[2]); rg.setEnd(tn, hit[2] + f.value.length); var s = getSelection(); s.removeAllRanges(); s.addRange(rg); } keepVisible(e);
    }
    dlg('Find & replace', b, [{ l: 'Replace all', fn: function () { var q = f.value; if (!q) return false; snap(); var c = 0; var re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); cur.blocks.forEach(function (bl) { ['x', 'x2'].forEach(function (fl) { if (bl[fl]) bl[fl] = bl[fl].replace(re, function () { c++; return r.value; }); }); }); renderAll(); snap(); dirty(); toast(c + ' replaced'); } }, { l: 'Find next', cls: 'pri', fn: function () { next(); return false; } }, { l: 'Close' }], { nofocus: false });
    f.addEventListener('keydown', function (e) { if (e.key === 'Enter') { next(); } });
  }

  /* ------------------------------------------------------------------ save / save as / files */
  function wrapFile() { return JSON.stringify({ app: 'finnish', v: 2, docs: [Object.assign({}, cur, { path: undefined })] }); }
  function fname() { return (cur.title || 'Untitled').replace(/[\\\/:*?"<>|\n]+/g, ' ').trim() || 'Untitled'; }
  function save() {
    persist().then(function () {
      if (isPhone() || (!N && !window.showSaveFilePicker)) return toast('Saved on this device ✓ (see “Saved” tab)');
      return saveFile(false);
    });
  }
  function saveAs() {
    if (isPhone()) { return ask('Save As', 'New name', fname(), function (n) { if (!n) return; var c = JSON.parse(JSON.stringify(cur)); c.id = uid(); c.title = n; cur = c; cb = null; persist().then(function () { renderAll(); toast('Saved as “' + n + '” – find it under Saved'); }); }, 'Save'); }
    persist().then(function () { saveFile(true); });
  }
  function saveFile(as) {
    var json = wrapFile();
    if (N && N.saveFile) return N.saveFile(fname() + '.finnish', json, as ? null : cur.path).then(function (p) { if (p) { cur.path = p; toast('Saved to ' + p); } });
    if (window.showSaveFilePicker) {
      var h = handles[cur.id], pr = (!as && h) ? Promise.resolve(h) : showSaveFilePicker({ suggestedName: fname() + '.finnish', types: [{ description: 'finnish script', accept: { 'application/json': ['.finnish'] } }] });
      return pr.then(function (hh) { handles[cur.id] = hh; return hh.createWritable().then(function (w) { return w.write(json).then(function () { return w.close(); }); }).then(function () { toast('Saved to ' + hh.name + ' ✓'); }); }).catch(function (e) { if (e && e.name !== 'AbortError') toast('Could not save file'); });
    }
    return deliver(fname() + '.finnish', 'application/json', json);
  }
  function deliver(name, mime, text) {
    if (N && N.saveText) return N.saveText(name, text);
    var C = window.Capacitor, P = C && C.Plugins;
    if (C && C.isNativePlatform && C.isNativePlatform() && P && P.Filesystem && P.Share) {
      return P.Filesystem.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' }).then(function (r) { return P.Share.share({ title: name, url: r.uri, dialogTitle: 'Save or share ' + name }); }).catch(function () { toast('Could not share file'); });
    }
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime + ';charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); URL.revokeObjectURL(a.href); }, 1000); toast('Downloaded ' + name);
  }
  function exportDlg() {
    var b = el('div', ''); b.innerHTML = '<label style="display:flex;gap:8px;align-items:center;margin-bottom:8px"><input type="checkbox" id="xc" checked> Include cover page</label><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="xm"> Print marker colours</label><p>The export date on the cover is filled in automatically if you left it empty. The middle line of Two Column is never printed.</p>';
    var d = dlg('Export', b, [{ l: 'Close' }, { l: 'FDX (Final Draft)', fn: function () { syncOut(); deliver(fname() + '.fdx', 'application/xml', THK.toFDX(cur)); } }, { l: 'Fountain', fn: function () { syncOut(); deliver(fname() + '.fountain', 'text/plain', THK.toFountain(cur, true)); } }, { l: 'Backup (.finnish)', fn: function () { deliver(fname() + '.finnish', 'application/json', wrapFile()); } },
      { l: 'PDF', cls: 'pri', fn: function () { var o = { cover: $('#xc', d).checked, marks: $('#xm', d).checked }; setTimeout(function () { persist(); THK.printScript(cur, o); }, 60); } }]);
  }
  function syncOut() { cur.author = cur.writer; }

  /* ------------------------------------------------------------------ import */
  function pickImport() {
    if (window.showOpenFilePicker && !isPhone()) {
      showOpenFilePicker({ multiple: false, types: [{ description: 'Scripts', accept: { 'text/plain': ['.fdx', '.screenplay', '.fountain', '.txt', '.finnish', '.json', '.pdf'] } }] }).then(function (hs) { return hs[0].getFile().then(function (f) { importFile(f, hs[0]); }); }).catch(function () { });
      return;
    }
    var i = $('#fileIn'); i.value = ''; i.onchange = function () { if (i.files[0]) importFile(i.files[0]); }; i.click();
  }
  function importFile(f, handle) {
    var name = f.name, ext = (name.split('.').pop() || '').toLowerCase();
    if (ext === 'pdf') return dlg('PDF import', '<p>PDF files can’t be turned back into editable text reliably (Final Draft PDFs store glyph shapes, not real Malayalam text).</p><p><b>Best way:</b> in Final Draft use <i>File ▸ Save As</i> (.fdx) or <i>Export ▸ Fountain</i> and open that file here. The old Malayalam text then becomes real Unicode and you can pick Manjari, Meera, Rachana and more.</p>', [{ l: 'OK', cls: 'pri' }]);
    var rd = new FileReader(); rd.onerror = function () { toast('Could not read file'); };
    rd.onload = function () {
      var text = String(rd.result), docs;
      try {
        if (ext === 'fdx' || THK.isFDX(text)) docs = [THK.parseFDX(text)];
        else if (/^\s*[\[{]/.test(text)) { var o = JSON.parse(text); if (o && o.app === 'finnish') { docs = o.docs; if (handle && docs.length === 1) { docs[0]._h = handle; } } else if (THK.isScriptty(o) || ext === 'screenplay') docs = THK.parseScriptty(o); else throw new Error('Unknown JSON file'); }
        else { var d = norm({ title: name.replace(/\.[^.]+$/, ''), blocks: THK.parseFountain(text) }); if (!d.blocks.length) throw new Error('Empty'); docs = [d]; }
      } catch (e) { return dlg('Could not open file', '<p>' + esc(e.message || 'Unknown file') + '</p><p>Supported: Final Draft .fdx, Scriptty .screenplay, Fountain / text, and finnish .finnish. If a Scriptty file will not open, export it from Scriptty as Fountain or FDX and open that.</p>', [{ l: 'OK', cls: 'pri' }]); }
      var isNative = docs[0].app === undefined && !(docs[0].fmt);
      var go = function (fmt) {
        docs = docs.map(function (d) { var h = d._h; delete d._h; if (!d.fmt || isNative) d.fmt = fmt; if (!d.paper) d.paper = 'a4'; d = norm(d); if (h) handles[d.id] = h; return d; });
        Promise.all(docs.map(function (d) { return DB.put(d); })).then(function () { toast(docs.length > 1 ? docs.length + ' scripts imported – see Saved' : 'Imported ✓'); openDoc(docs[0]); });
      };
      if (isNative) dlg('Open as…', '<p>“' + esc(docs[0].title || name) + '” – ' + docs.reduce(function (n, d) { return n + d.blocks.length; }, 0) + ' lines. Which layout do you want?</p>', [{ l: 'Standard', cls: 'pri', fn: function () { go('std'); } }, { l: 'Two Column', cls: 'pri', fn: function () { go('two'); } }]); else go('std');
    };
    rd.readAsText(f);
  }

  /* ------------------------------------------------------------------ dialogs: help, about, palette */
  function about() {
    dlg('', '<img class="logo-sm" src="icons/icon-192.png" alt=""><div style="text-align:center"><img src="icons/finnish-wordmark.png" alt="finnish" style="height:46px;background:#16202e;padding:8px 18px;border-radius:14px"><p style="margin-top:10px">Malayalam &amp; English screenplay writer</p><p style="font-size:20px;color:var(--ink)"><b>Creator : Nishan</b></p><p>Version ' + VERSION + ' · works fully offline · your scripts stay on your device</p><p style="font-size:12px">Fonts: Meera, Rachana, Dyuthi, Manjari, Chilanka, Gayathri © Swathanthra Malayalam Computing (SIL OFL 1.1); Noto fonts © Google (OFL).</p></div>', [{ l: 'Close', cls: 'pri' }]);
  }
  function helpDlg() {
    dlg('Help & shortcuts', '<p><b>Enter</b> new line (type follows the flow: scene → action → character → dialogue)<br><b>Tab / Shift+Tab</b> change element · <b>Shift+Enter</b> line break<br><b>Ctrl+Enter</b> next page · <b>Ctrl+S</b> save · <b>Ctrl+Shift+S</b> save as<br><b>Ctrl+Space</b> Malayalam (Manglish) / English typing · <b>Ctrl+K</b> command palette<br><b>Ctrl+↑/↓</b> jump scene · <b>Ctrl+F</b> find &amp; replace</p><p>Manglish: type <i>“namaskaaram”</i> on a keyboard and it becomes Malayalam. On a phone use your Malayalam keyboard – it works directly.</p><p>Two Column: scene heading has two boxes (place | time) and may cross the middle line; Enter in the left box jumps to the right one. Transition is centred and bold. The line is never printed.</p>', [{ l: 'Close', cls: 'pri' }]);
  }
  function palette() {
    var cmds = [['Next page', nextPage], ['Save', save], ['Save As…', saveAs], ['Export…', exportDlg], ['Import file…', pickImport], ['Page & text colour…', colourDlg], ['Reverse colours', reverseColours], ['Find & replace…', findDlg], ['Scenes & markers panel', function () { toggleSide(); }], ['Switch layout (Standard / Two Column)', switchFmt], ['Undo', undo], ['Redo', redo], ['Help', helpDlg], ['About', about], ['Home', goHome]];
    var b = el('div', ''), i = el('input', 't'), l = el('div', 'saved-list'); i.placeholder = 'Type a command…'; b.appendChild(i); l.style.marginTop = '8px'; b.appendChild(l);
    var d = dlg('', b, null);
    function draw() { l.innerHTML = ''; cmds.filter(function (c) { return c[0].toLowerCase().indexOf(i.value.toLowerCase()) >= 0; }).forEach(function (c) { var r = el('div', 'sv', esc(c[0])); r.onclick = function () { d.close(); c[1](); }; l.appendChild(r); }); }
    i.oninput = draw; i.onkeydown = function (e) { if (e.key === 'Enter') { var r = $('.sv', l); if (r) r.click(); } }; draw();
  }

  /* ------------------------------------------------------------------ open / navigation */
  function openDoc(d, fresh) {
    persistSafe(); cur = norm(d); cb = null; hist = { st: [], re: [], t: 0 }; tl.buf = '';
    show('app'); buildChrome(); renderAll(); snap(); setStatus('saved'); if (fresh) persist();
    S.lastId = cur.id; saveS(); $('#scroll').scrollTop = 0;
    setTimeout(function () { if (!cur) return; focusBlock(cur.blocks[0].id, 0); $('#scroll').scrollTop = fresh ? $('#cover').offsetHeight : 0; }, 80);
  }
  function persistSafe() { if (cur) { try { persist(); } catch (e) { } } }
  function goHome() { persistSafe(); cur = null; cb = null; $('#sug') && $('#sug').remove(); homeTab = 'start'; renderHome(); }

  /* ------------------------------------------------------------------ boot */
  function bind() {
    var pg = $('#page'), cv = $('#cover');
    [pg, cv].forEach(function (r) { r.addEventListener('keydown', onKey); r.addEventListener('input', onInput); r.addEventListener('paste', onPaste); r.addEventListener('focusin', onFocus); r.addEventListener('mousedown', function () { tl.buf = ''; }); });
    pg.addEventListener('click', function (e) { if (e.target === pg && cur) { var l = cur.blocks[cur.blocks.length - 1]; focusBlock(l.id, null); } });
    if (window.visualViewport) { var fit = function () { $('#app').style.height = visualViewport.height + 'px'; }; visualViewport.addEventListener('resize', fit); visualViewport.addEventListener('scroll', function () { window.scrollTo(0, 0); }); fit(); }
    document.addEventListener('keydown', function (e) { if (cur && (e.ctrlKey || e.metaKey) && !e.target.closest('.ed') && /^[sk]$/i.test(e.key)) { e.preventDefault(); e.key.toLowerCase() === 's' ? save() : palette(); } });
    if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener && matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
    document.addEventListener('dragover', function (e) { e.preventDefault(); }); document.addEventListener('drop', function (e) { e.preventDefault(); if (e.dataTransfer.files[0]) importFile(e.dataTransfer.files[0]); });
  }
  function boot() {
    applyTheme(); bind();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () { });
    if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(function () { });
    var t0 = Date.now();
    DB.init().then(function () {
      var rec = null; try { rec = JSON.parse(localStorage.getItem('finnish.recover') || 'null'); } catch (e) { }
      return DB.all().then(function (ds) {
        if (rec && rec.id) { var saved = ds.filter(function (d) { return d.id === rec.id; })[0]; if (!saved || saved.updated < rec.updated) { return DB.put(rec).then(function () { toast('Recovered unsaved work ✓'); }); } }
      });
    }).then(function () {
      setTimeout(function () { renderHome(); $('#splash').classList.add('out'); setTimeout(function () { $('#splash').remove(); }, 800); }, Math.max(0, 1900 - (Date.now() - t0)));
    });
  }
  THK._t = { norm: norm, newDoc: newDoc, get cur() { return cur; } };
  boot();
})();
