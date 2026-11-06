/* Export / import helpers: PDF (via the browser's print engine, so Malayalam shaping is perfect), Fountain. */
(function () {
  'use strict';
  var THK = window.THK = window.THK || {};
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }

  /* ---------------------------------------------------------------- Fountain */
  THK.toFountain = function (d, withTitle) {
    var out = [];
    if (withTitle) {
      out.push('Title: ' + (d.title || 'Untitled'));
      if (d.credit) out.push('Credit: ' + d.credit);
      if (d.author) out.push('Author: ' + d.author);
      if (d.draft) out.push('Draft date: ' + d.draft);
      if (d.contact) out.push('Contact:\n    ' + d.contact.replace(/\n/g, '\n    '));
      out.push('');
    }
    var blank = function () { if (out.length && out[out.length - 1] !== '') out.push(''); };
    d.blocks.forEach(function (b) {
      var x = b.x.trim(); if (!x) return;
      if (b.t === 'scene') { blank(); out.push((/^(INT|EXT|EST|I\/E|INT\.?\/EXT)[. \/]/i.test(x) ? '' : '.') + x.toUpperCase()); out.push(''); }
      else if (b.t === 'char') { blank(); out.push('@' + x.toUpperCase()); }
      else if (b.t === 'paren') out.push('(' + x + ')');
      else if (b.t === 'dial') { out.push(x); out.push(''); }
      else if (b.t === 'trans') { blank(); out.push('> ' + x.toUpperCase()); out.push(''); }
      else if (b.t === 'shot') { blank(); out.push('!' + x.toUpperCase()); out.push(''); }
      else if (b.t === 'note') { blank(); out.push('[[' + x + ']]'); out.push(''); }
      else { blank(); out.push('!' + x); out.push(''); }
    });
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  };

  THK.parseFountain = function (text) {
    text = text.replace(/\r/g, '').replace(/^﻿/, '');
    var blocks = [], add = function (t, x) { x = x.trim(); if (x) blocks.push({ id: uid(), t: t, x: x }); };
    var paras = text.split(/\n{2,}/);
    if (paras.length && /^[A-Za-z][A-Za-z ]*:/.test(paras[0].split('\n')[0]) && !/^(INT|EXT)/i.test(paras[0])) paras.shift();
    paras.forEach(function (p) {
      var lines = p.split('\n').map(function (l) { return l.replace(/\s+$/, ''); }).filter(function (l) { return l.trim() !== ''; });
      if (!lines.length) return;
      var f = lines[0].trim();
      if (/^\[\[.*\]\]$/.test(p.trim())) return add('note', p.trim().slice(2, -2));
      if (f[0] === '.' && f[1] !== '.') { add('scene', f.slice(1)); lines.slice(1).forEach(function (l) { add('action', l); }); return; }
      if (/^(INT|EXT|EST|I\/E|INT\.?\/EXT)[. \/]/i.test(f)) { add('scene', f); lines.slice(1).forEach(function (l) { add('action', l); }); return; }
      if (f[0] === '>' && f.slice(-1) !== '<') return add('trans', f.slice(1));
      if (/^[A-Z0-9 ()'.\-]+TO:$/.test(f)) return add('trans', f);
      if (f[0] === '!') { lines.forEach(function (l) { add('action', l.replace(/^!/, '')); }); return; }
      var isChar = f[0] === '@' || (lines.length > 1 && /[A-Z]/.test(f) && f === f.toUpperCase() && !/[a-z]/.test(f));
      if (isChar) {
        add('char', f.replace(/^@/, ''));
        lines.slice(1).forEach(function (l) { l = l.trim(); if (/^\(.*\)$/.test(l)) add('paren', l.slice(1, -1)); else add('dial', l); });
        return;
      }
      lines.forEach(function (l) { add('action', l.replace(/^>\s*|\s*<$/g, '')); });
    });
    return blocks;
  };

  /* ---------------------------------------------------------------- PDF (print engine => correct Malayalam shaping) */
  THK.PAPER = { a4: { w: '210mm', h: '297mm', n: 'A4' }, letter: { w: '215.9mm', h: '279.4mm', n: 'Letter' } };
  THK.FONTS = [
    { id: 'Manjari', stack: "'Manjari Local','Manjari'", label: 'Manjari', g: 'Manjari:wght@400;700' },
    { id: 'Meera', stack: "'Meera'", label: 'Meera' },
    { id: 'Rachana', stack: "'Rachana'", label: 'Rachana' },
    { id: 'Dyuthi', stack: "'Dyuthi'", label: 'Dyuthi' },
    { id: 'Chilanka', stack: "'Chilanka Local','Chilanka'", label: 'Chilanka', g: 'Chilanka' },
    { id: 'Gayathri', stack: "'Gayathri Local','Gayathri'", label: 'Gayathri', g: 'Gayathri:wght@400;700' },
    { id: 'NotoSans', stack: "'Noto Sans Malayalam'", label: 'Noto Sans Malayalam', g: 'Noto+Sans+Malayalam:wght@400;700' },
    { id: 'NotoSerif', stack: "'Noto Serif Malayalam'", label: 'Noto Serif Malayalam', g: 'Noto+Serif+Malayalam:wght@400;700' },
    { id: 'System', stack: "system-ui,'Nirmala UI','Noto Sans Malayalam',sans-serif", label: 'System default' }
  ];
  THK.fontStack = function (id) { var f = THK.FONTS.filter(function (x) { return x.id === id; })[0] || THK.FONTS[0]; return f.stack + ",'Manjari','Meera',serif"; };
  THK.fontLinks = function () { // Google Fonts stylesheet URL for fonts that are not bundled (used online only, then cached by the service worker)
    var fam = THK.FONTS.filter(function (f) { return f.g; }).map(function (f) { return 'family=' + f.g; }).join('&');
    return 'https://fonts.googleapis.com/css2?' + fam + '&display=swap';
  };
  THK.fontFaceCSS = function (base) {
    base = base || '';
    var f = function (fam, file, w) { return "@font-face{font-family:'" + fam + "';src:url('" + base + 'fonts/' + file + "') format('truetype');font-weight:" + w + ";font-display:swap}"; };
    return f('Meera', 'Meera.ttf', 400) + f('Rachana', 'Rachana-Regular.ttf', 400) + f('Rachana', 'Rachana-Bold.ttf', 700) + f('Dyuthi', 'Dyuthi.ttf', 400) +
      f('Manjari Local', 'Manjari-Regular.ttf', 400) + f('Manjari Local', 'Manjari-Bold.ttf', 700) +
      f('Chilanka Local', 'Chilanka-Regular.ttf', 400) + f('Gayathri Local', 'Gayathri-Regular.ttf', 400) + f('Gayathri Local', 'Gayathri-Bold.ttf', 700);
  };
  THK.todayStr = function () { var d = new Date(); return d.getDate() + ' ' + ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.getMonth()] + ' ' + d.getFullYear(); };

  THK.buildPrint = function (d, o) {
    o = o || {};
    var P = THK.PAPER[d.paper] || THK.PAPER.a4, two = d.fmt === 'two';
    var pc = d.pageColor || '#ffffff', tc = d.textColor || '#000000', fs = d.size || 12;
    var title = d.title || 'Untitled';
    var css = '@page{size:' + P.w + ' ' + P.h + ';background:' + pc + ';margin:22mm 20mm 20mm ' + (two ? '20mm' : '30mm') + ';' +
      "@top-left{content:'" + title.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ') + "';font:7pt " + THK.fontStack(d.font) + ';color:' + tc + ';opacity:.7;vertical-align:bottom;padding-bottom:4mm}' +
      '@top-center{content:counter(page);font:8pt ' + THK.fontStack(d.font) + ';color:' + tc + ';vertical-align:bottom;padding-bottom:4mm}}' +
      '@page cover{margin:20mm;background:' + pc + ';@top-left{content:none}@top-center{content:none}}' +
      '*{box-sizing:border-box}html,body{margin:0;padding:0;background:' + pc + ';color:' + tc + ';-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      'body{font-family:' + THK.fontStack(d.font) + ';font-size:' + fs + 'pt;line-height:1.5}' +
      '.cover{page:cover;break-after:page;height:' + (parseFloat(P.h) - 41) + 'mm;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}' +
      '.cover h1{font-size:' + (fs * 2.4) + 'pt;margin:0 0 14mm;font-weight:700;line-height:1.25;white-space:pre-wrap}' +
      '.cover p{margin:0 0 3mm;font-size:' + (fs * 1.1) + 'pt;white-space:pre-wrap}.cover b{font-weight:700}' +
      '.body{counter-reset:page 0}' +
      '.b{margin:0 0 ' + (fs * 0.9) + 'pt;white-space:pre-wrap;word-wrap:break-word;orphans:2;widows:2;break-inside:avoid-page}' +
      '.b.pb{break-before:page}.b.scene,.b.char,.b.paren,.b.trans{font-weight:700}.b.scene{margin-top:' + fs + 'pt;break-after:avoid}.b.char,.b.paren{break-after:avoid;margin-bottom:' + (fs * 0.15) + 'pt}' +
      '.b.note{display:none}';
    if (!two) css += '.b.char,.b.paren{text-align:center;margin-left:12mm;margin-right:12mm}.b.dial{margin-left:22mm;max-width:90mm}.b.trans{text-align:right}.b.scene{text-transform:uppercase}';
    else css += '.b.scene{display:flex;gap:0}.b.scene .l{flex:0 0 50%;text-transform:uppercase}.b.scene .r{flex:1;text-transform:uppercase}' +
      '.b.action,.b.shot{width:46%}.b.char,.b.paren,.b.dial{margin-left:52%}.b.trans{text-align:center}';
    css += '.al-left{text-align:left!important}.al-center{text-align:center!important}.al-right{text-align:right!important}.al-justify{text-align:justify!important}';
    if (o.marks) css += '.b.mk{background:var(--mk);}';
    var h = '';
    if (o.cover !== false) {
      h += '<section class="cover"><h1>' + esc(title) + '</h1>' +
        '<p><b>Writer :</b> ' + esc(d.writer || '') + '</p><p><b>Director :</b> ' + esc(d.director || '') + '</p><p><b>Date :</b> ' + esc(d.date || THK.todayStr()) + '</p></section>';
    }
    h += '<main class="body">';
    d.blocks.forEach(function (b) {
      var x = b.x || '', cls = 'b ' + b.t + (b.al ? ' al-' + b.al : '') + (b.pb ? ' pb' : '') + (o.marks && b.mk ? ' mk' : '');
      var st = o.marks && b.mk ? ' style="--mk:' + esc(b.mk) + '"' : '';
      if (!x.trim() && !(b.x2 || '').trim()) { if (b.pb) h += '<div class="b pb"' + st + '></div>'; return; }
      if (b.t === 'paren') x = '(' + x.replace(/^\(|\)$/g, '') + ')';
      if (b.t === 'char' && two) x += ' :';
      if (b.t === 'scene' && two) h += '<div class="' + cls + '"' + st + '><div class="l">' + esc(x) + '</div><div class="r">' + esc(b.x2 || '') + '</div></div>';
      else h += '<div class="' + cls + '"' + st + '>' + esc(x) + '</div>';
    });
    h += '</main>';
    return { css: css, html: h };
  };

  THK.printDoc = function (d, o) {
    var p = THK.buildPrint(d, o);
    var base = (typeof location !== 'undefined' && /^(https?|file):/.test(location.href)) ? location.href.replace(/[#?].*$/, '').replace(/[^\/]*$/, '') : '';
    return '<!doctype html><html><head><meta charset="utf-8">' + (base ? '<base href="' + base + '">' : '') + '<title>' + esc(d.title || 'script') + '</title>' +
      '<link rel="stylesheet" href="' + THK.fontLinks() + '"><style>' + THK.fontFaceCSS('') + p.css + '</style></head><body>' + p.html + '</body></html>';
  };

  THK.fp = function () { // native Android helper (print to PDF + save dialog); null on web / desktop
    var C = window.Capacitor; if (!C) return null;
    if (C.Plugins && C.Plugins.FinnishPrint) return C.Plugins.FinnishPrint;
    if (typeof C.nativePromise === 'function') return {
      print: function (o) { return C.nativePromise('FinnishPrint', 'print', o); },
      saveFile: function (o) { return C.nativePromise('FinnishPrint', 'saveFile', o); }
    };
    if (typeof C.registerPlugin === 'function') { if (!THK._fp) THK._fp = C.registerPlugin('FinnishPrint'); return THK._fp; }
    return null;
  };
  THK.printScript = function (d, o) {
    var html = THK.printDoc(d, o), name = (d.title || 'script').replace(/[\\\/:*?"<>|\n]+/g, ' ').trim() || 'script';
    var N = window.finnishNative, FP = THK.fp();
    if (N && N.savePdf) return N.savePdf(html, name + '.pdf', d.paper === 'letter' ? 'Letter' : 'A4');
    if (FP) return FP.print({ html: html, name: name }).catch(function (err) { alert('PDF export failed: ' + (err && err.message || err)); });
    return new Promise(function (res) {
      var f = document.createElement('iframe');
      f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0';
      f.onload = function () {
        var w = f.contentWindow, go = function () { setTimeout(function () { try { w.focus(); w.print(); } catch (e) { } setTimeout(function () { f.remove(); res(); }, 1500); }, 250); };
        var fonts = (f.contentDocument && f.contentDocument.fonts);
        if (fonts && fonts.ready) Promise.race([fonts.ready, new Promise(function (r) { setTimeout(r, 3000); })]).then(go); else go();
      };
      f.srcdoc = html; document.body.appendChild(f);
    });
  };
})();
