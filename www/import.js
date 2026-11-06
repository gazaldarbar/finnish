/* Importers/exporters for other screenwriting formats: Final Draft (.fdx), Scriptty (.screenplay), Fountain (see export.js). */
(function () {
  'use strict';
  var THK = window.THK = window.THK || {};
  function uid() { return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function newDoc(title) { return { id: uid(), title: title || '', credit: 'രചന', author: '', contact: '', draft: '', created: Date.now(), updated: Date.now(), blocks: [] }; }
  function push(d, t, x) { x = String(x == null ? '' : x).replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n').trim(); if (x) d.blocks.push({ id: uid(), t: t, x: x }); }

  /* ------------------------------------------------------------ Final Draft (.fdx) */
  var FDX_MAP = { 'scene heading': 'scene', 'action': 'action', 'general': 'action', 'character': 'char', 'dialogue': 'dial',
    'parenthetical': 'paren', 'transition': 'trans', 'shot': 'shot' };
  THK.isFDX = function (t) { return /<FinalDraft[\s>]/.test(t.slice(0, 4000)); };
  THK.parseFDX = function (xml) {
    var dom = new DOMParser().parseFromString(xml.replace(/^﻿/, ''), 'application/xml');
    if (dom.querySelector('parsererror')) throw new Error('Invalid FDX');
    var d = newDoc('');
    var textOf = function (p) { var s = ''; Array.prototype.forEach.call(p.children, function (c) { if (c.tagName === 'Text') s += c.textContent; }); return s; };
    // title page
    var tp = dom.querySelector('TitlePage > Content'), lines = [];
    if (tp) Array.prototype.forEach.call(tp.querySelectorAll(':scope > Paragraph'), function (p) { lines.push(textOf(p).trim()); });
    var ne = lines.filter(function (l) { return l; });
    if (ne.length) {
      d.title = ne[0];
      var ci = -1; ne.forEach(function (l, i) { if (ci < 0 && i > 0 && /^(written|screenplay|story|a film|by\b)/i.test(l)) ci = i; });
      if (ci > 0) { d.credit = ne[ci]; d.author = ne[ci + 1] || ''; d.contact = ne.slice(ci + 2).join('\n'); }
      else { d.contact = ne.slice(1).join('\n'); }
    }
    var cont = dom.querySelector('FinalDraft > Content') || dom.querySelector('Content');
    var n = 0;
    if (cont) Array.prototype.forEach.call(cont.children, function (p) {
      if (p.tagName !== 'Paragraph') return;
      var type = (p.getAttribute('Type') || 'Action').toLowerCase(), t = FDX_MAP[type];
      var x = textOf(p);
      if (type === 'cast list' || type === 'new act' || type === 'end of act' || type === 'show/ep. title' || type === 'outline') { if (type === 'outline') return; }
      if (!t) t = 'action';
      if (t === 'paren') x = x.trim().replace(/^\(/, '').replace(/\)$/, '');
      push(d, t, x); n++;
      Array.prototype.forEach.call(p.children, function (c) { if (c.tagName === 'ScriptNote') push(d, 'note', c.textContent); });
    });
    if (!d.title) d.title = 'Imported Final Draft script';
    if (!d.blocks.length) d.blocks.push({ id: uid(), t: 'scene', x: '' });
    return d;
  };

  THK.toFDX = function (doc) {
    var map = { scene: 'Scene Heading', action: 'Action', char: 'Character', dial: 'Dialogue', paren: 'Parenthetical', trans: 'Transition', shot: 'Shot' };
    var out = ['<?xml version="1.0" encoding="UTF-8" standalone="no" ?>', '<FinalDraft DocumentType="Script" Template="No" Version="5">', '<Content>'];
    doc.blocks.forEach(function (b) {
      var x = b.x.trim(); if (!x) return;
      if (b.t === 'note') { out.push('<Paragraph Type="Action"><ScriptNote><Paragraph><Text>' + esc(x) + '</Text></Paragraph></ScriptNote></Paragraph>'); return; }
      if (b.t === 'scene') x = x.toUpperCase();
      if (b.t === 'paren') x = '(' + x + ')';
      out.push('<Paragraph Type="' + map[b.t] + '"><Text>' + esc(x) + '</Text></Paragraph>');
    });
    out.push('</Content>', '<TitlePage><Content>');
    var tl = [doc.title || '', '', doc.credit || '', doc.author || '', '', doc.contact || '', doc.draft || ''];
    tl.forEach(function (l) { out.push('<Paragraph Alignment="Center"><Text>' + esc(l) + '</Text></Paragraph>'); });
    out.push('</Content></TitlePage>', '</FinalDraft>');
    return out.join('\n');
  };

  /* ------------------------------------------------------------ Scriptty (.screenplay, JSON / ProseMirror-style tree) */
  var NODE_RULES = [
    [/scene|slug|heading/, 'scene'], [/transition/, 'trans'], [/paren/, 'paren'], [/character|speaker|cue/, 'char'],
    [/dialog|speech/, 'dial'], [/shot/, 'shot'], [/note/, 'note'], [/action|general|paragraph|description/, 'action']
  ];
  function mapType(t) {
    t = String(t || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!t || t === 'text' || t === 'doc' || t === 'hardbreak') return null;
    for (var i = 0; i < NODE_RULES.length; i++) if (NODE_RULES[i][0].test(t)) return NODE_RULES[i][1];
    return null;
  }
  function plain(n) {
    if (n == null) return '';
    if (typeof n === 'string') return n;
    if (Array.isArray(n)) return n.map(plain).join('');
    if (typeof n.text === 'string') return n.text;
    var t = String(n.type || '').toLowerCase().replace(/[^a-z]/g, '');
    var inner = plain(n.content);
    return t === 'hardbreak' ? '\n' : inner;
  }
  function hasBlockChild(n) {
    if (!n || typeof n !== 'object') return false;
    var kids = Array.isArray(n) ? n : (Array.isArray(n.content) ? n.content : []);
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i]; if (!k || typeof k !== 'object') continue;
      if (mapType(k.type) || hasBlockChild(k)) return true;
    }
    return false;
  }
  function walk(n, d, depth) {
    if (!n || typeof n !== 'object' || depth > 60) return;
    if (Array.isArray(n)) { n.forEach(function (c) { walk(c, d, depth + 1); }); return; }
    var t = mapType(n.type);
    if (t && !hasBlockChild(n)) {
      var x = plain(n.content != null ? n.content : n.text);
      if (t === 'paren') x = x.trim().replace(/^\(/, '').replace(/\)$/, '');
      push(d, t, x); return;
    }
    if (typeof n.type === 'string' && /^(text|hard_?break)$/i.test(n.type)) return;
    Object.keys(n).forEach(function (k) { if (k !== 'meta' && k !== 'marks' && k !== 'attrs' && typeof n[k] === 'object') walk(n[k], d, depth + 1); });
  }
  function metaOf(o) {
    var m = o.meta || o.metadata || o.title_page || o.titlePage || {};
    var g = function (keys) { for (var i = 0; i < keys.length; i++) { var v = m[keys[i]] != null ? m[keys[i]] : o[keys[i]]; if (typeof v === 'string' && v.trim()) return v.trim(); } return ''; };
    return { title: g(['title', 'name']), author: g(['author', 'writer', 'written_by']), draft: g(['draft_date', 'draftDate', 'draft', 'date']), contact: g(['contact']) };
  }
  THK.isScriptty = function (o) { return o && typeof o === 'object' && !o.app && !o.docs && (o.meta || o.doc || o.content || o.episodes || o.screenplay || o.type === 'doc'); };
  THK.parseScriptty = function (o) {
    var docs = [], m = metaOf(o);
    var build = function (node, title) {
      var d = newDoc(title || m.title || 'Imported Scriptty script'); d.author = m.author; d.draft = m.draft; d.contact = m.contact;
      walk(node, d, 0); if (!d.blocks.length) return null; return d;
    };
    var eps = o.episodes || (o.series && o.series.episodes);
    if (Array.isArray(eps) && eps.length) {
      eps.forEach(function (e, i) { var d = build(e.doc || e.content || e.screenplay || e, (m.title || 'Series') + ' – ' + (e.title || e.name || ('Episode ' + (i + 1)))); if (d) docs.push(d); });
    }
    if (!docs.length) { var d = build(o.doc || o.screenplay || o.content || o); if (d) docs.push(d); }
    if (!docs.length) throw new Error('No script content found');
    return docs;
  };
})();
