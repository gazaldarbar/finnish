/* Manglish -> Malayalam transliteration (Google-Input-Tools style).
   Pure function: translit("avan") -> "അവൻ". Used while typing with a physical keyboard. */
(function (root) {
  'use strict';
  var V = '്'; // virama / chandrakkala

  // Consonants. Keys are matched longest-first. Values are the Malayalam base letter
  // or a ready-made conjunct (conjuncts do not end with a virama).
  var CONS = {
    'ksh': 'ക്ഷ', 'chh': 'ഛ', 'ndh': 'ന്ദ', 'nth': 'ന്ത',
    'tth': 'ത്ത', 'ddh': 'ദ്ദ',
    'nt': 'ന്റ', 'nd': 'ണ്ട', 'tt': 'ട്ട', 'rr': 'റ്റ',
    'kh': 'ഖ', 'gh': 'ഘ', 'ng': 'ങ', 'ch': 'ച', 'nj': 'ഞ', 'jh': 'ഝ',
    'th': 'ത', 'dh': 'ദ', 'Th': 'ഠ', 'Dh': 'ഢ', 'ph': 'ഫ', 'bh': 'ഭ',
    'zh': 'ഴ', 'sh': 'ശ',
    'k': 'ക', 'g': 'ഗ', 'c': 'ച', 'j': 'ജ', 't': 'ട', 'T': 'ട', 'd': 'ഡ', 'D': 'ഡ',
    'N': 'ണ', 'n': 'ന', 'p': 'പ', 'f': 'ഫ', 'b': 'ബ', 'm': 'മ', 'y': 'യ',
    'r': 'ര', 'R': 'റ', 'l': 'ല', 'L': 'ള', 'v': 'വ', 'w': 'വ',
    'S': 'ഷ', 's': 'സ', 'h': 'ഹ', 'q': 'ക', 'z': 'സ', 'x': 'ക്സ'
  };
  // Vowels: [independent letter, dependent sign]
  var VOW = {
    'aa': ['ആ', 'ാ'], 'ai': ['ഐ', 'ൈ'], 'au': ['ഔ', 'ൗ'], 'ae': ['ഏ', 'േ'],
    'ee': ['ഈ', 'ീ'], 'ii': ['ഈ', 'ീ'], 'oo': ['ഊ', 'ൂ'], 'uu': ['ഊ', 'ൂ'],
    'a': ['അ', ''], 'i': ['ഇ', 'ി'], 'u': ['ഉ', 'ു'], 'e': ['എ', 'െ'],
    'o': ['ഒ', 'ൊ'], 'E': ['ഏ', 'േ'], 'O': ['ഓ', 'ോ'], 'A': ['ആ', 'ാ']
  };
  // Word-final chillu / anusvara forms (only when the letter closes a syllable)
  var FINAL = { 'n': 'ൻ', 'N': 'ൺ', 'l': 'ൽ', 'L': 'ൾ', 'r': 'ർ', 'm': 'ം' };

  function lookup(s, i) {
    for (var L = 3; L >= 1; L--) {
      var k = s.substr(i, L);
      if (k.length < L) continue;
      if (CONS[k] !== undefined) return { t: 'c', v: CONS[k], len: L, k: k };
      if (VOW[k] !== undefined) return { t: 'v', v: VOW[k], len: L, k: k };
    }
    return null;
  }

  function translit(s) {
    var out = '', i = 0, pend = false, toks = [];
    while (i < s.length) {
      var m = lookup(s, i);
      if (!m) {
        var lc = s.charAt(i).toLowerCase();
        if (lc !== s.charAt(i)) m = lookup(lc, 0);
        if (m) m.len = 1;
      }
      if (!m) { m = { t: 'x', v: s.charAt(i), len: 1, k: s.charAt(i) }; }
      toks.push(m);
      i += m.len;
    }
    for (var j = 0; j < toks.length; j++) {
      var t = toks[j], last = j === toks.length - 1;
      if (t.t === 'c') {
        if (last && !pend && out.length && FINAL[t.k] !== undefined) {
          out += FINAL[t.k]; pend = false; continue;
        }
        out += t.v + V; pend = true;
      } else if (t.t === 'v') {
        if (pend) { out = out.slice(0, -1); out += t.v[1]; pend = false; }
        else out += t.v[0];
      } else { out += t.v; pend = false; }
    }
    return out;
  }

  var api = { translit: translit };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ML = api;
})(typeof window !== 'undefined' ? window : this);
