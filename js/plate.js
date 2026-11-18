/* 完成イメージの絵（写真ではなく、食材の色と形から描くイメージ図） */
(function (root) {
  'use strict';
  function rng(seed) { var t = seed >>> 0; return function () { t += 0x6D2B79F5; var r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function shade(hex, k) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var f = function (c) { return Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k))); };
    return '#' + ((1 << 24) | (f(r) << 16) | (f(g) << 8) | f(b)).toString(16).slice(1);
  }
  // ひとつの具を描く
  function piece(shape, color, x, y, s, R) {
    var rot = Math.round(R() * 360), d = shade(color, -0.25), w, h;
    var tr = 'transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + rot + ')"';
    switch (shape) {
      case 'slice': w = s * 1.5; h = s * 0.8; return '<path ' + tr + ' d="M' + (-w / 2) + ' ' + (-h / 2) + ' q' + (w / 2) + ' ' + (-h / 3) + ' ' + w + ' 0 q' + (h / 4) + ' ' + (h / 2) + ' 0 ' + h + ' q' + (-w / 2) + ' ' + (h / 3) + ' ' + (-w) + ' 0 q' + (-h / 4) + ' ' + (-h / 2) + ' 0 ' + (-h) + 'z" fill="' + color + '" stroke="' + d + '" stroke-width="1"/>';
      case 'chunk': case 'cube': w = s * 0.95; return '<rect ' + tr + ' x="' + (-w / 2) + '" y="' + (-w / 2) + '" width="' + w + '" height="' + w + '" rx="' + (shape === 'chunk' ? w * 0.3 : w * 0.12) + '" fill="' + color + '" stroke="' + d + '" stroke-width="1"/>';
      case 'strip': case 'stick': w = s * (shape === 'stick' ? 1.8 : 1.6); h = s * (shape === 'stick' ? 0.28 : 0.32); return '<rect ' + tr + ' x="' + (-w / 2) + '" y="' + (-h / 2) + '" width="' + w + '" height="' + h + '" rx="' + h / 2 + '" fill="' + color + '" stroke="' + d + '" stroke-width=".8"/>';
      case 'leaf': w = s * 1.3; return '<path ' + tr + ' d="M0 ' + (-w / 2) + ' C' + (w / 2) + ' ' + (-w / 3) + ' ' + (w / 2) + ' ' + (w / 3) + ' 0 ' + (w / 2) + ' C' + (-w / 2) + ' ' + (w / 3) + ' ' + (-w / 2) + ' ' + (-w / 3) + ' 0 ' + (-w / 2) + 'z" fill="' + color + '" stroke="' + d + '" stroke-width="1"/>';
      case 'round': return '<g ' + tr + '><circle r="' + s * 0.5 + '" fill="' + color + '" stroke="' + d + '" stroke-width="1"/><circle r="' + s * 0.22 + '" fill="' + shade(color, 0.25) + '"/></g>';
      case 'bits': case 'grain': var o = ''; for (var i = 0; i < 4; i++) o += '<circle cx="' + ((R() - 0.5) * s).toFixed(1) + '" cy="' + ((R() - 0.5) * s).toFixed(1) + '" r="' + (s * 0.18).toFixed(1) + '" fill="' + color + '" stroke="' + d + '" stroke-width=".5"/>'; return '<g ' + tr + '>' + o + '</g>';
      case 'sprout': return '<g ' + tr + ' stroke="' + d + '" stroke-width="2.2" stroke-linecap="round"><path d="M0 ' + (-s * 0.7) + ' q' + s * 0.2 + ' ' + s * 0.7 + ' 0 ' + s * 1.4 + '" fill="none" stroke="' + color + '"/><path d="M' + s * 0.25 + ' ' + (-s * 0.6) + ' q' + s * 0.15 + ' ' + s * 0.6 + ' ' + (-s * 0.05) + ' ' + s * 1.2 + '" fill="none" stroke="' + color + '"/></g>';
      case 'floret': return '<g ' + tr + '><rect x="' + (-s * 0.12) + '" y="0" width="' + s * 0.24 + '" height="' + s * 0.55 + '" fill="' + shade(color, 0.35) + '"/><circle cx="' + (-s * 0.25) + '" cy="' + (-s * 0.05) + '" r="' + s * 0.3 + '" fill="' + color + '"/><circle cx="' + s * 0.25 + '" cy="' + (-s * 0.05) + '" r="' + s * 0.3 + '" fill="' + color + '"/><circle cx="0" cy="' + (-s * 0.3) + '" r="' + s * 0.32 + '" fill="' + shade(color, -0.1) + '"/></g>';
      case 'mush': return '<g ' + tr + '><rect x="' + (-s * 0.12) + '" y="' + (-s * 0.05) + '" width="' + s * 0.24 + '" height="' + s * 0.6 + '" rx="3" fill="' + shade(color, 0.45) + '"/><path d="M' + (-s * 0.5) + ' 0 q' + s * 0.5 + ' ' + (-s * 0.8) + ' ' + s + ' 0z" fill="' + color + '" stroke="' + d + '" stroke-width="1"/></g>';
      case 'fillet': w = s * 2.6; h = s * 1.4; return '<g transform="translate(' + x + ' ' + y + ') rotate(' + (rot % 30 - 15) + ')"><rect x="' + (-w / 2) + '" y="' + (-h / 2) + '" width="' + w + '" height="' + h + '" rx="' + h * 0.35 + '" fill="' + color + '" stroke="' + d + '" stroke-width="1.2"/><path d="M' + (-w / 4) + ' ' + (-h / 2.6) + ' q4 ' + h / 2.6 + ' 0 ' + h / 1.3 + 'M0 ' + (-h / 2.6) + ' q4 ' + h / 2.6 + ' 0 ' + h / 1.3 + 'M' + (w / 4) + ' ' + (-h / 2.6) + ' q4 ' + h / 2.6 + ' 0 ' + h / 1.3 + '" stroke="' + shade(color, 0.35) + '" stroke-width="1.5" fill="none"/></g>';
      case 'egg': return '<path ' + tr + ' d="M' + (-s * 0.8) + ' 0 c0 ' + (-s * 0.6) + ' ' + s * 0.5 + ' ' + (-s * 0.7) + ' ' + s * 0.9 + ' ' + (-s * 0.4) + ' c' + s * 0.5 + ' ' + s * 0.3 + ' ' + s * 0.4 + ' ' + s * 0.8 + ' ' + (-s * 0.1) + ' ' + s * 0.8 + ' c' + (-s * 0.5) + ' 0 ' + (-s * 0.8) + ' ' + (-s * 0.1) + ' ' + (-s * 0.8) + ' ' + (-s * 0.4) + 'z" fill="' + color + '" stroke="' + d + '" stroke-width="1"/>';
      case 'curl': return '<path ' + tr + ' d="M' + s * 0.5 + ' ' + (-s * 0.2) + ' a' + s * 0.5 + ' ' + s * 0.5 + ' 0 1 0 0 ' + s * 0.5 + '" stroke="' + color + '" stroke-width="' + s * 0.35 + '" fill="none" stroke-linecap="round"/>';
      case 'wedge': return '<path ' + tr + ' d="M0 ' + (-s * 0.6) + ' L' + s * 0.55 + ' ' + s * 0.45 + ' L' + (-s * 0.55) + ' ' + s * 0.45 + 'z" fill="' + color + '" stroke="' + d + '" stroke-width="1" stroke-linejoin="round"/>';
      default: return '<circle ' + tr + ' r="' + s * 0.45 + '" fill="' + color + '"/>';
    }
  }
  // recipe.plate = {dish, items, shares, glaze, shape}
  function draw(recipe, lookOf) {
    var p = recipe.plate || {}; var R = rng(hash(recipe.key || recipe.name || 'x'));
    var dish = p.dish || 'plate';
    var items = (p.items || []).map(function (id) { var lk = lookOf(id); return lk ? { id: id, color: lk[0], shape: lk[1] } : null; }).filter(Boolean);
    var out = '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + (recipe.name || '') + 'のイメージ図">';
    var cx = 60, cy = 64, rx = 50, ry = 38, inner = 0.78;
    var glaze = p.glaze || '#d9b88a';
    if (dish === 'bowl') {
      var bowlC = (p.genre === '洋') ? '#f4f1ea' : '#7b2a1f';
      out += '<ellipse cx="60" cy="100" rx="26" ry="6" fill="rgba(0,0,0,.12)"/>';
      out += '<path d="M14 58 Q16 100 60 102 Q104 100 106 58z" fill="' + bowlC + '"/><ellipse cx="60" cy="58" rx="46" ry="16" fill="' + shade(bowlC, -0.2) + '"/>';
      out += '<ellipse cx="60" cy="59" rx="41" ry="13" fill="' + glaze + '"/>';
      cx = 60; cy = 58; rx = 34; ry = 9; inner = 1;
    } else if (dish === 'don' || dish === 'small') {
      var big = dish === 'don';
      var bc = big ? '#f2ede4' : '#ede3d4';
      out += '<ellipse cx="60" cy="104" rx="' + (big ? 30 : 24) + '" ry="5" fill="rgba(0,0,0,.12)"/>';
      out += '<path d="M' + (big ? 10 : 20) + ' 56 Q' + (big ? 14 : 24) + ' 104 60 104 Q' + (big ? 106 : 96) + ' 104 ' + (big ? 110 : 100) + ' 56z" fill="' + bc + '" stroke="#cbbfae" stroke-width="1"/>';
      out += '<ellipse cx="60" cy="56" rx="' + (big ? 50 : 40) + '" ry="' + (big ? 17 : 14) + '" fill="' + shade(bc, -0.08) + '" stroke="#cbbfae" stroke-width="1"/>';
      if (big) out += '<ellipse cx="60" cy="55" rx="44" ry="13" fill="#fbfaf4"/>';
      out += '<ellipse cx="60" cy="54" rx="' + (big ? 38 : 33) + '" ry="' + (big ? 10 : 10) + '" fill="' + glaze + '" opacity="' + (big ? 0.7 : 0.45) + '"/>';
      cx = 60; cy = 50; rx = big ? 32 : 28; ry = big ? 9 : 8; inner = 1;
    } else if (dish === 'curry') {
      out += '<ellipse cx="60" cy="68" rx="56" ry="40" fill="rgba(0,0,0,.08)"/><ellipse cx="60" cy="64" rx="56" ry="40" fill="#fbfaf6" stroke="#ddd3c6"/>';
      out += '<path d="M14 64 Q20 34 60 30 Q50 64 60 98 Q20 94 14 64z" fill="#fffdf6"/>';
      out += '<path d="M60 30 Q104 32 106 64 Q102 96 60 98 Q50 64 60 30z" fill="' + glaze + '"/>';
      cx = 82; cy = 64; rx = 16; ry = 24; inner = 1;
    } else {
      var deep = dish === 'deep';
      out += '<ellipse cx="60" cy="' + (cy + 6) + '" rx="' + rx + '" ry="' + ry + '" fill="rgba(0,0,0,.08)"/>';
      out += '<ellipse cx="60" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="#fbfaf6" stroke="#ddd3c6"/>';
      out += '<ellipse cx="60" cy="' + (cy + (deep ? 2 : 0)) + '" rx="' + rx * inner + '" ry="' + ry * inner + '" fill="' + (deep ? '#f1ebe0' : '#fffdf8') + '"/>';
      if (deep) out += '<ellipse cx="60" cy="' + (cy + 3) + '" rx="' + rx * 0.72 + '" ry="' + ry * 0.66 + '" fill="' + glaze + '" opacity=".55"/>';
    }
    // 具をならべる
    var n = Math.max(1, items.length);
    var shapeOverride = p.shape;
    var count = dish === 'bowl' ? 9 : dish === 'small' ? 10 : 16;
    var spots = [];
    for (var i = 0; i < count; i++) {
      var a = R() * Math.PI * 2, rr = Math.sqrt(R()) * 0.82;
      spots.push([cx + Math.cos(a) * rx * inner * rr, cy + Math.sin(a) * ry * inner * rr]);
    }
    spots.sort(function (a, b) { return a[1] - b[1]; });
    var size = dish === 'bowl' ? 9 : dish === 'small' ? 10 : 12;
    if (shapeOverride === 'patty') {
      out += '<ellipse cx="' + (cx - 6) + '" cy="' + (cy - 2) + '" rx="26" ry="16" fill="#7a4428" stroke="#5a2f1b"/><ellipse cx="' + (cx - 6) + '" cy="' + (cy - 5) + '" rx="20" ry="9" fill="' + glaze + '"/>';
      items = items.slice(1);
    } else if (shapeOverride === 'karaage') {
      for (var k = 0; k < 6; k++) { var sx = cx - 22 + (k % 3) * 20 + R() * 4, sy = cy - 10 + Math.floor(k / 3) * 16 + R() * 3; out += '<path d="M' + (sx - 9) + ' ' + sy + ' q2 -10 10 -9 q9 -1 9 8 q1 9 -9 9 q-10 1 -10 -8z" fill="#c07a35" stroke="#8a5022"/>'; }
      items = [];
    } else if (shapeOverride === 'roll') {
      for (var j = 0; j < 3; j++) out += '<rect x="' + (cx - 34 + j * 23) + '" y="' + (cy - 12) + '" width="21" height="24" rx="4" fill="#f5d35a" stroke="#d6a93a"/><path d="M' + (cx - 30 + j * 23) + ' ' + (cy - 6) + ' h13 M' + (cx - 30 + j * 23) + ' ' + (cy) + ' h13 M' + (cx - 30 + j * 23) + ' ' + (cy + 6) + ' h13" stroke="#e6b947" stroke-width="1.2"/>';
      items = [];
    } else if (shapeOverride === 'mash') {
      out += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx * 0.9 + '" ry="' + ry * 0.9 + '" fill="#f3e3a8"/>';
    }
    if (items.length) {
      var fish = items.filter(function (it) { return it.shape === 'fillet'; });
      var rest = items.filter(function (it) { return it.shape !== 'fillet'; });
      fish.forEach(function (it, idx) { out += piece('fillet', it.color, cx - 8 + idx * 14, cy - 2 + idx * 4, size * 1.1, R); });
      spots.forEach(function (sp, i2) {
        var it = rest.length ? rest[i2 % rest.length] : null; if (!it) return;
        var shp = shapeOverride === 'strips' ? 'strip' : it.shape;
        out += piece(shp, it.color, sp[0], sp[1], size * (0.85 + R() * 0.3), R);
      });
    }
    // たれのつや
    if (dish === 'plate' && glaze && !shapeOverride) out += '<ellipse cx="' + (cx - 10) + '" cy="' + (cy - 10) + '" rx="14" ry="5" fill="#fff" opacity=".25"/>';
    out += '</svg>';
    return out;
  }
  root.Plate = { draw: draw };
})(typeof self !== 'undefined' ? self : this);
