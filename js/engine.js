/* ユウコクラブ レシピを組み立てる仕組み（ブラウザでもNode.jsでも動く）
 * - 外部のAIやAPIは使わない。data/ のJSONだけで動く
 * - 調味料は「食材の重さ（煮物・汁物は水分も）に対する塩分◯%」で計算する
 */
(function (root) {
  'use strict';

  var E = {};
  var HELP = [];
  var ING = {}, SEA = {}, SAUCE = {}, SAUCES = [], CLASSIC = {}, CLASSICS = [], ALIAS = [];

  // ---------- 定数 ----------
  var SALT_PCT = { itame: 0.009, mushiyaki: 0.009, yaki: 0.010, ni: 0.008, ae: 0.009, sitame: 0.009, nibitashi: 0.006, fukume: 0.007 };
  var VEG_Q = { itame: 100, ni: 120, mushiyaki: 120, yaki: 50 };           // 主菜の野菜 大人1人分(g)
  var SIDE_Q = 70;                                                       // 副菜の野菜 大人1人分(g)
  var SOUP_SOLID = 45;                                                   // 汁物の具 大人1人分(g)
  var KID = 0.7, TODDLER = 0.5;                                          // 子ども・幼児の量（大人を1として）
  var WF = { cabbage: 1.4, hakusai: 1.4, moyashi: 1.3, lettuce: 1.0, onion: 1.0, potato: 1.2, daikon: 1.1, kabocha: 1.2, satsumaimo: 1.1, kabu: 1.0,
    carrot: 0.6, piman: 0.6, paprika: 0.7, nira: 0.5, negi: 0.6, aonegi: 0.2, shimeji: 0.8, enoki: 0.8, maitake: 0.8, eringi: 0.8, shiitake: 0.6,
    broccoli: 0.9, spinach: 1.0, komatsuna: 1.0, chingensai: 0.9, mizuna: 0.8, eggplant: 1.0, tomato: 0.8, cucumber: 0.8, asparagus: 0.6, ingen: 0.6,
    okra: 0.5, gobo: 0.7, renkon: 0.8, konnyaku: 0.7, zucchini: 0.9 };
  var SHORT = { pork_koma: '豚こま', pork_bara: '豚バラ', pork_loin: '豚ロース', pork_mince: '豚ひき肉', mince_mix: 'ひき肉', chicken_momo: '鶏もも',
    chicken_mune: '鶏むね', sasami: 'ささみ', chicken_mince: '鶏ひき肉', beef_koma: '牛肉', wiener: 'ウインナー', bacon: 'ベーコン', salmon: '鮭',
    saba: 'さば', buri: 'ぶり', tara: 'たら', shrimp: 'えび', tuna_can: 'ツナ', tofu_momen: '豆腐', tofu_kinu: '豆腐', atsuage: '厚揚げ',
    aburaage: '油揚げ', egg: '卵', aonegi: '小ねぎ', wakame: 'わかめ', corn: 'コーン', enoki: 'えのき', curry_roux: 'カレールウ' };
  var COMMON_PROT = ['pork_koma', 'chicken_momo', 'chicken_mune', 'salmon', 'tofu_momen', 'pork_bara', 'atsuage', 'egg', 'tara', 'beef_koma', 'wiener', 'saba'];
  var COMMON_VEG = ['onion', 'cabbage', 'carrot', 'moyashi', 'negi', 'shimeji', 'piman', 'broccoli', 'hakusai', 'potato', 'komatsuna', 'daikon', 'eringi', 'spinach', 'ingen', 'paprika', 'kabocha', 'chingensai'];
  var SEA_SUBS = { oyster: 'しょうゆ＋砂糖少し', tobanjan: '一味とうがらし少々（大人の分だけ）', ichimi: 'なしでもOK', shiokombu: '塩少々＋かつお節', cheese: 'なしでもOK',
    katsuobushi: '白すりごま', curry: 'なし（そのときは塩こしょう味に）', ponzu: 'しょうゆ', surigoma: '白いりごまを指でつぶす', sesame: 'なしでもOK', torigara: '塩少々',
    consomme: '塩少々', dashi: 'なしでもOK（そのときはしょうゆを少し足す）', mayo: 'なし（オリーブ油と塩で和える）', ketchup: 'なし', chuno: 'しょうゆ少し',
    ginger: 'なしでもOK', garlic: 'なしでもOK', salt: 'しょうゆ（塩小さじ1/4がしょうゆ小さじ1くらい）', shoyu: '塩少々（香りは弱くなります）', sake: '水（風味は少し落ちます）',
    mirin: '砂糖（みりん小さじ1が砂糖小さじ1/3くらい）', sugar: 'みりん（砂糖小さじ1がみりん小さじ3くらい）', katakuri: '小麦粉（とろみは弱めになります）', flour: '片栗粉',
    butter: 'サラダ油（香りは弱くなります）', sesame_oil: 'サラダ油', oil: 'ごま油', miso: 'しょうゆ（香りは変わります）', milk: '豆乳（より弱火で）', panko: '食パンをちぎったもの' };
  var HEAT_ORDER = ['強火', '強めの中火', '中火', '弱めの中火', '弱火'];

  // ---------- 小さな道具 ----------
  function round(x, step) { return Math.round(x / step) * step; }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function uniq(a) { var s = {}, o = []; for (var i = 0; i < a.length; i++) { if (!s[a[i]]) { s[a[i]] = 1; o.push(a[i]); } } return o; }
  function rng(seed) { var t = seed >>> 0; return function () { t += 0x6D2B79F5; var r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function short(id) { if (SHORT[id]) return SHORT[id]; var it = ING[id]; return it ? it.name.replace(/（.*?）/g, '') : id; }
  function factor(p) { p = p || {}; var f = (p.adult || 0) + KID * (p.kid || 0) + TODDLER * (p.toddler || 0); return Math.max(1, f); }
  E.factor = factor;
  function hasKids(p) { return p && ((p.kid || 0) + (p.toddler || 0)) > 0; }
  function adultShare(p) { var f = factor(p); return clamp((p.adult || 1) / f, 0.2, 1); }
  function fmtMin(m) { if (m <= 0) return ''; var s = Math.round(m * 60); var mm = Math.floor(s / 60), ss = s % 60; ss = Math.round(ss / 10) * 10; if (ss === 60) { mm++; ss = 0; } return (mm ? mm + '分' : '') + (ss ? ss + '秒' : ''); }
  E.fmtMin = fmtMin;

  // 文字のゆれをそろえる（カタカナ→ひらがな・全角半角・空白）
  function norm(s) {
    s = String(s || '');
    if (s.normalize) s = s.normalize('NFKC');
    s = s.replace(/[\s　・,、。.]/g, '').toLowerCase();
    s = s.replace(/[ァ-ヶ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); });
    return s;
  }
  // 分量の部分だけ消す（「豚こま」の「こ」などは消さない）
  function stripQty(s) {
    return s.replace(/[0-9]+([./][0-9]+)?(kg|g|ml|cc|個|本|枚|ぱっく|パック|袋|束|株|切れ|丁|cm|つ|玉|房|缶|節|こ|ほん|まい)?/g, '')
      .replace(/(はんぶん|半分|すこし|少し|ちょっと|くらい|ぐらい|ほど|ずつ|のこり|残り|だけ)/g, '')
      .replace(/^(大さじ|小さじ)/, '');
  }
  E.norm = norm;

  // ---------- 初期化 ----------
  E.init = function (data) {
    ING = {}; SEA = {}; SAUCE = {}; CLASSIC = {}; ALIAS = [];
    data.ingredients.items.forEach(function (it) { ING[it.id] = it; });
    data.seasonings.items.forEach(function (it) { SEA[it.id] = it; });
    SAUCES = data.sauces.items;
    SAUCES.forEach(function (s) {
      SAUCE[s.id] = s;
      var tags = (s.tags || []).slice();
      (s.parts || []).forEach(function (p) { var se = SEA[p.id]; if (se && se.tags) tags = tags.concat(se.tags); });
      s._tags = uniq(tags);
    });
    HELP = (data.help && data.help.items) || [];
    CLASSICS = data.classics.items;
    CLASSICS.forEach(function (c) { CLASSIC[c.id] = c; });
    Object.keys(ING).forEach(function (id) {
      var it = ING[id];
      [it.name].concat(it.al || []).forEach(function (a) { var n = norm(a).replace(/（.*?）|\(.*?\)/g, ''); if (n) ALIAS.push({ a: n, id: id }); });
      var n2 = norm(it.name.replace(/（.*?）/g, '')); if (n2) ALIAS.push({ a: n2, id: id });
    });
    ALIAS.sort(function (x, y) { return y.a.length - x.a.length; });
    var vn = Object.keys(ING).filter(function (id) { return ING[id].role === 'veg'; }).map(function (id) { return ING[id].name.replace(/（.*?）/g, ''); });
    vn = vn.concat(['ねぎ', 'きのこ', '野菜']);
    VEG_RE = new RegExp(vn.map(function (x) { return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|'));
    return E;
  };
  E.ing = function (id) { return ING[id]; };
  E.sea = function (id) { return SEA[id]; };
  E.sauce = function (id) { return SAUCE[id]; };
  E.classic = function (id) { return CLASSIC[id]; };
  E.allIngredients = function () { return Object.keys(ING).map(function (k) { return ING[k]; }); };
  E.allSeasonings = function () { return Object.keys(SEA).map(function (k) { return SEA[k]; }); };
  E.allClassics = function () { return CLASSICS.slice(); };

  // 入力された言葉 → 食材ID（見つからなければ null）
  E.match = function (text) {
    var n0 = norm(text);
    for (var z = 0; z < ALIAS.length; z++) if (ALIAS[z].a === n0) return ALIAS[z].id;
    var n = stripQty(n0);
    if (!n) return null;
    for (var i = 0; i < ALIAS.length; i++) if (ALIAS[i].a === n) return ALIAS[i].id;
    // 缶詰・水煮・冷凍・できあいの物は、名前が似ていても生の食材とは扱わない（辞書にない食材にする）
    if (/缶|水煮|冷凍|はんばーぐ|ふらい|ふりかけ|ちくわ|かまぼこ|漬け|づけ|ぺーすと|そーす/.test(n)) return null;
    for (var j = 0; j < ALIAS.length; j++) { var a = ALIAS[j].a; if (a.length >= 2 && n.indexOf(a) >= 0) return ALIAS[j].id; }
    return null;
  };
  // 入力途中の候補
  E.suggestNames = function (text, limit) {
    var n = norm(text); if (!n) return [];
    var out = [], seen = {};
    ALIAS.forEach(function (x) { if (out.length < (limit || 8) && !seen[x.id] && x.a.indexOf(n) >= 0 && ING[x.id].role !== 'item') { seen[x.id] = 1; out.push(x.id); } });
    return out;
  };

  // ---------- 量の表示 ----------
  // 小さじの数 → 「大さじ1と1/2」など
  function spoonText(tsp, sea) {
    var q = tsp;
    if (sea && sea.id === 'salt') {
      var g = q * 6;
      if (g < 0.6) return { t: '少々', q: 0.08 };
      if (g < 1.15) return { t: 'ひとつまみ（約1g）', q: 1 / 6 };
    }
    if (q < 0.12) return { t: '少々', q: 0.08 };
    if (q < 0.875) {
      var grid = [[0.25, '1/4'], [1 / 3, '1/3'], [0.5, '1/2'], [2 / 3, '2/3'], [0.75, '3/4']];
      var bg = grid[0]; grid.forEach(function (g) { if (Math.abs(g[0] - q) < Math.abs(bg[0] - q)) bg = g; });
      return { t: '小さじ' + bg[1], q: bg[0] };
    }
    if (q < 2.75) { var r2 = round(q, 0.5); return { t: '小さじ' + halfText(r2), q: r2 }; }
    if (q < 12) {
      var best = null;
      [1, 2, 3].forEach(function (a) { [0, 1.5, 1, 2].forEach(function (b, bi) { var v = 3 * a + b; var d = Math.abs(v - q) + bi * 0.01; if (!best || d < best.d) best = { d: d, a: a, b: b, v: v }; }); });
      var t = best.b === 0 ? '大さじ' + best.a : best.b === 1.5 ? '大さじ' + best.a + 'と1/2' : '大さじ' + best.a + 'と小さじ' + best.b;
      return { t: t, q: best.v };
    }
    var tb = round(q / 3, 0.5);
    return { t: '大さじ' + halfText(tb), q: tb * 3 };
  }
  function halfText(x) { var i = Math.floor(x + 1e-9), h = x - i > 0.25; return (i ? String(i) : '') + (h ? (i ? 'と1/2' : '1/2') : ''); }
  E.spoonText = spoonText;

  // 調味料の量 → {text, g, salt}
  function seaAmount(id, tsp, opts) {
    var se = SEA[id]; opts = opts || {};
    if (!se) return { text: '', g: 0, salt: 0, tsp: 0 };
    if (opts.pinch || se.display === 'pinch') return { text: '少々', g: 0.3, salt: 0, tsp: 0.1 };
    var r, g;
    if (se.display === 'g') {
      g = tsp * se.tspG;
      var step = g >= 20 ? 5 : g >= 4 ? (se.id === 'butter' ? 5 : 1) : 0.5;
      if (se.id === 'butter') g = Math.max(5, round(g, 5)); else g = Math.max(0.5, round(g, step));
      return { text: g + 'g', g: g, salt: g * (se.salt || 0), tsp: g / se.tspG };
    }
    if (se.display === 'ml') {
      var ml = tsp * 5;
      if (ml >= 50) { ml = round(ml, ml >= 200 ? 10 : 10); return { text: ml + 'ml', g: ml * se.tspG / 5, salt: ml * se.tspG / 5 * (se.salt || 0), tsp: ml / 5 }; }
      r = spoonText(tsp, se); return { text: r.t, g: r.q * se.tspG, salt: r.q * se.tspG * (se.salt || 0), tsp: r.q };
    }
    if (tsp >= 30 && /sake|mirin|shoyu|water/.test(se.id)) { var ml2 = round(tsp * 5, 10); return { text: ml2 + 'ml', g: ml2 / 5 * se.tspG, salt: ml2 / 5 * se.tspG * (se.salt || 0), tsp: ml2 / 5 }; }
    r = spoonText(tsp, se);
    return { text: r.t, g: r.q * se.tspG, salt: r.q * se.tspG * (se.salt || 0), tsp: r.q };
  }
  E.seaAmount = seaAmount;

  var FRACS = [[1, 8], [1, 6], [1, 5], [1, 4], [1, 3], [1, 2], [2, 3], [3, 4], [1, 1], [3, 2], [2, 1], [3, 1]];
  function fracText(x) {
    var best = null;
    FRACS.forEach(function (f) { var v = f[0] / f[1]; var d = Math.abs(v - x) / v; if (!best || d < best.d) best = { d: d, f: f, v: v }; });
    var f = best.f, t;
    if (f[1] === 1) t = String(f[0]); else if (f[0] > f[1]) t = Math.floor(f[0] / f[1]) + 'と' + (f[0] % f[1]) + '/' + f[1]; else t = f[0] + '/' + f[1];
    return { t: t, d: best.d };
  }
  function gramRound(g) { return g < 30 ? Math.max(5, round(g, 5)) : round(g, 10); }
  // 食材の量 → 表示
  function ingAmount(id, g) {
    var it = ING[id]; var u = it && it.unit;
    if (!u) return { text: gramRound(g) + 'g', g: gramRound(g) };
    if (u.spoon) { if (g / u.g > 6) return { text: gramRound(g) + 'g', g: gramRound(g) }; var sp = spoonText(g / u.g * 3, null); return { text: sp.t, g: g }; }
    if (u.n === 'ml') { var mlv = g >= 50 ? round(g, 10) : Math.max(5, round(g, 5)); return { text: mlv + 'ml', g: mlv }; }
    if (u.piece) {
      var n = g / u.g;
      if (it.cat === 'fish' && u.n === '切れ') n = Math.max(1, Math.round(n));
      else n = Math.max(1, Math.round(n * 2) / 2);
      if (u.g < 25) n = Math.max(1, Math.round(n));
      var nt = halfText(n) || '1';
      return { text: nt + u.n + (u.g >= 60 && it.cat !== 'fish' && it.cat !== 'egg' ? '（' + gramRound(n * u.g) + 'g）' : ''), g: n * u.g, n: n };
    }
    if (u.cm) { var cm = Math.max(1, Math.round(g / u.g)); return { text: cm + 'cm（' + gramRound(g) + 'g）', g: gramRound(g) }; }
    if (u.frac) {
      var x = g / u.g; var fr = fracText(x);
      if (fr.d < 0.18) return { text: fr.t + u.n + '（' + gramRound(g) + 'g）', g: gramRound(g) };
      return { text: gramRound(g) + 'g（約' + fr.t + u.n + '）', g: gramRound(g) };
    }
    var x2 = g / u.g; var f2 = fracText(x2);
    if (u.n === '皿分') { var dish = Math.max(1, Math.round(x2)); return { text: dish + '皿分（約' + gramRound(dish * u.g) + 'g）', g: dish * u.g }; }
    if (u.n === '杯') { var cup = Math.max(1, Math.round(x2 * 2) / 2); return { text: halfText(cup) + '杯分（' + gramRound(g) + 'g）', g: g }; }
    if (f2.d < 0.15 && x2 >= 0.4) return { text: f2.t + u.n + '（' + gramRound(g) + 'g）', g: gramRound(g) };
    return { text: gramRound(g) + 'g', g: gramRound(g) };
  }
  E.ingAmount = ingAmount;

  // ---------- 冷蔵庫の残りの量 ----------
  // 量を書かなかったときの「よくある1パック分」(g)
  var PACK = { pork_koma: 300, pork_bara: 250, pork_loin: 250, pork_mince: 250, mince_mix: 250, chicken_momo: 300, chicken_mune: 300, sasami: 200, chicken_mince: 250,
    beef_koma: 250, wiener: 120, bacon: 70, ham: 40, shrimp: 150, tuna_can: 70, tofu_momen: 300, tofu_kinu: 300, atsuage: 300, aburaage: 60, egg: 550,
    cabbage: 1000, hakusai: 500, onion: 400, carrot: 300, potato: 450, daikon: 500, spinach: 200, komatsuna: 250, moyashi: 200, piman: 140, paprika: 150,
    broccoli: 250, eggplant: 240, tomato: 300, cucumber: 200, negi: 200, aonegi: 100, shimeji: 100, enoki: 100, shiitake: 60, maitake: 100, eringi: 100,
    kabocha: 300, renkon: 200, gobo: 150, satsumaimo: 250, asparagus: 100, ingen: 100, chingensai: 200, nira: 100, mizuna: 200, lettuce: 300, okra: 80,
    konnyaku: 250, zucchini: 200, kabu: 240, wakame: 30, corn: 120, milk: 1000, rice: 2000, curry_roux: 160 };
  E.defaultAmount = function (id) {
    if (PACK[id]) return PACK[id];
    var it = ING[id]; if (!it) return 100;
    if (it.cat === 'fish' && it.unit) return it.unit.g * 2;
    if (it.unit) return it.unit.g * (it.unit.piece ? 3 : 1);
    return (it.portion || 100) * 3;
  };
  function wholeOf(id) { var it = ING[id], u = it && it.unit; if (u && u.frac) return u.g; if (u && u.cm) return 1000; return E.defaultAmount(id); }
  // 「300g」「6個」「半分」「1/4」などから量(g)を読む。読めなければ null
  E.parseAmount = function (text, id) {
    var it = ING[id]; var u = it && it.unit;
    var t = String(text || '').replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).replace(/／/g, '/').replace(/ｇ/g, 'g');
    var m;
    if ((m = t.match(/([0-9]+(?:\.[0-9]+)?)\s*(kg|キロ)/))) return parseFloat(m[1]) * 1000;
    if ((m = t.match(/([0-9]+(?:\.[0-9]+)?)\s*(g|グラム|ml|cc|ミリ)/))) return parseFloat(m[1]);
    if ((m = t.match(/([0-9]+(?:\.[0-9]+)?)\s*(cm|センチ)/))) return parseFloat(m[1]) * (u && u.cm ? u.g : 35);
    if ((m = t.match(/([0-9]+)\s*\/\s*([0-9]+)/))) return parseFloat(m[1]) / parseFloat(m[2]) * wholeOf(id);
    var each = /ミニトマト|プチトマト/.test(t) ? 15 : (u ? u.g : 100);
    if ((m = t.match(/([0-9]+(?:\.[0-9]+)?)\s*(個|本|枚|切れ|丁|束|袋|パック|株|玉|こ|ほん|まい|缶|節)/))) {
      var x = parseFloat(m[1]), word = m[2];
      if (u && u.n === word) return x * each;
      if (/パック|袋|缶/.test(word) || (word === '本' && u && u.n === 'ml')) return x * E.defaultAmount(id);
      if (u && (u.piece || u.frac)) return x * each;
      return x * (u ? u.g : 100);
    }
    // 単位のない数字：小さい数は「個数」、大きい数はグラムとみなす
    if ((m = t.match(/(^|[^0-9.])([0-9]+(?:\.[0-9]+)?)\s*$/))) {
      var y = parseFloat(m[2]);
      if (y >= 30 || !u) return y;
      if (u.cm) return y * u.g;
      return y * each;
    }
    if (/半分|はんぶん/.test(t)) return wholeOf(id) * 0.5;
    if (/少し|ちょっと|すこし/.test(t)) return wholeOf(id) * 0.25;
    return null;
  };
  E.amountText = function (id, g) { return ingAmount(id, g).text.replace(/（.*?）/g, '').replace(/^約/, ''); };
  function haveNote(ctx, id, needG) {
    var am = ctx.amounts; if (!am || am[id] == null || !needG) return '';
    if (am[id] < needG * 0.5) return '足りません（手持ちは約' + E.amountText(id, am[id]) + 'で、必要な量の半分もありません。買い足すか、ほかの料理にしてください）';
    if (am[id] < needG * 0.7) return '手持ちは約' + E.amountText(id, am[id]) + '。少し足りません（ある分で作るか、買い足してください）';
    return '';
  }

  // ---------- 好み・苦手で外す ----------
  // recipe か spec の情報（ids, tags, mainVeg, amakara）で判断する
  function excludedReason(info, ctx) {
    var pr = ctx.prefs || {}; var t = pr.tastes || {};
    var avoid = pr.avoid || [];
    for (var i = 0; i < info.ids.length; i++) {
      if (avoid.indexOf(info.ids[i]) >= 0) return short(info.ids[i]) + 'を使うため（苦手な食材）';
      if (hasKids(ctx.people) && (pr.kidAvoid || []).indexOf(info.ids[i]) >= 0) return short(info.ids[i]) + 'を使うため（子どもが食べない食材）';
    }
    var tags = info.tags || [];
    if (t.sour && tags.indexOf('sour') >= 0) return '酸味が強いため';
    if (t.vinegar && tags.indexOf('vinegar') >= 0) return 'お酢を使うため';
    if (t.ponzu && tags.indexOf('ponzu') >= 0) return 'ポン酢を使うため';
    if (t.tomatoMain && (info.mainVeg === 'tomato' || tags.indexOf('tomatoMain') >= 0)) return 'トマトが主役のため';
    if (t.tomatoMain && info.ids.indexOf('tomato') >= 0 && (info.slot === 'soup' || info.method === 'yaki')) return 'トマトが目立つため';
    var words = pr.avoidWords || [];
    for (var w = 0; w < words.length; w++) if (words[w] && info.text && info.text.indexOf(words[w]) >= 0) return words[w] + 'を使うため（苦手な食材）';
    if (t.tomatoAll && tags.indexOf('tomato') >= 0) return 'トマト味のため';
    if (ctx.maxMin && info.minutes && info.minutes > ctx.maxMin) return '調理時間が' + ctx.maxMin + '分をこえるため';
    return null;
  }
  E.excludedReason = function (recipe, ctx) { return excludedReason(recipeInfo(recipe), ctx); };
  function recipeInfo(r) {
    return { ids: r.ids || [], tags: r.tags || [], mainVeg: r.mainVeg, amakara: r.amakara, minutes: r.minutes, slot: r.slot, method: r.method, text: r.text || (r.name + ' ' + (r.ingredients || []).map(function (i) { return i.name; }).join(' ')) };
  }

  // ---------- 組み合わせレシピを作る ----------
  // spec = {slot, sauce, method, prot, veg:[ids], extra:[ids]}
  E.specKey = function (s) { return ['combo', s.slot, s.sauce, s.method, s.prot || '-', (s.veg || []).join(','), (s.extra || []).join(',')].join('|'); };
  E.parseKey = function (key) {
    var p = key.split('|');
    if (p[0] === 'combo') return { kind: 'combo', spec: { slot: p[1], sauce: p[2], method: p[3], prot: p[4] === '-' ? null : p[4], veg: p[5] ? p[5].split(',') : [], extra: p[6] ? p[6].split(',') : [] } };
    if (p[0] === 'classic') return { kind: 'classic', id: p[1] };
    if (p[0] === 'user') return { kind: 'user', id: p[1] };
    return null;
  };

  function methodData(id, method) {
    var it = ING[id]; if (!it || !it.m) return null;
    if (it.m[method]) return it.m[method];
    if (method === 'sitame' && it.m.itame) { var d = it.m.itame; return { cut: d.cut, min: Array.isArray(d.min) ? d.min[0] : d.min }; }
    if (method === 'nibitashi' && it.m.ni) return it.m.ni;
    return null;
  }

  function protGrams(id, F, slot) {
    var it = ING[id]; var u = it.unit;
    if (slot === 'soup') {
      if (id === 'egg') return Math.max(1, Math.round(F / 2)) * 55;
      if (it.cat === 'soy') return 35 * F;
      if (id === 'wiener') return Math.max(1, Math.round(F)) * 20;
      return 25 * F;
    }
    if (id === 'egg') return Math.max(2, Math.round(1.6 * F)) * 55;
    if (u && u.piece && it.cat === 'fish') return Math.max(1, Math.ceil(F - 0.25)) * u.g;
    if (u && u.piece) return Math.max(1, Math.round(it.portion * F / u.g)) * u.g;
    return it.portion * F;
  }
  function extraGrams(id, F, slot) {
    var it = ING[id];
    if (id === 'egg') return Math.max(2, Math.round(F)) * 55; // 卵とじ
    if (id === 'wakame') return (slot === 'soup' ? 1 : 2) * F;
    if (id === 'aburaage') return (slot === 'soup' ? 5 : 8) * F;
    if (id === 'aonegi') return 3 * F;
    if (id === 'corn') return 12 * F;
    if (id === 'sasami') return 25 * F;
    return (it.portion || 15) * F;
  }
  // 野菜ごとの上限（大人1人分・主菜）。にんじんやピーマンだけで量を埋めないため
  var CAP = { carrot: 40, piman: 40, paprika: 50, nira: 35, negi: 50, shiitake: 30, asparagus: 40, ingen: 40, gobo: 40, konnyaku: 60, okra: 30, renkon: 60, aonegi: 5 };
  var SIDEKICK = { carrot: 1, gobo: 1, konnyaku: 1, okra: 1 }; // 主菜の野菜が1つだけのとき、主役にしない
  function splitVeg(ids, total, F, slot) {
    var capF = slot === 'soup' ? 0.5 : slot === 'side' ? 1.1 : 1;
    var out = ids.map(function () { return 0; });
    var free = ids.map(function (id, i) { return i; });
    var left = total;
    for (var loop = 0; loop < 4 && free.length && left > 1; loop++) {
      var sum = 0; free.forEach(function (i) { sum += (WF[ids[i]] || 1); });
      var next = [], used = 0;
      free.forEach(function (i) {
        var want = left * (WF[ids[i]] || 1) / sum;
        var cap = CAP[ids[i]] ? CAP[ids[i]] * capF * F - out[i] : Infinity;
        var g = Math.min(want, cap); out[i] += g; used += g;
        if (g >= want - 0.01) next.push(i);
      });
      left -= used; free = next.length < free.length ? next : [];
    }
    return out;
  }

  // 味付けの量を計算する
  function calcSauce(S, W, liquidMl, saltTarget, ctx, opts) {
    opts = opts || {};
    var out = []; var byId = {}; var fixedSalt = 0;
    var parts = S.parts || [];
    var arom = function (per100) { return per100 * 4 * Math.pow(Math.max(W, 50) / 400, 0.85); };
    // 1) 量が決まっているもの
    parts.forEach(function (p) {
      var tsp = null;
      if (p.per100 != null) tsp = p.aroma ? arom(p.per100) : p.per100 * W / 100;
      else if (p.perL != null) tsp = p.perL * liquidMl / 100;
      else if (p.fixed != null) tsp = p.fixed * Math.pow(factor(ctx.people) / 2, 0.5);
      if (tsp != null) { byId[p.id] = { p: p, tsp: tsp }; fixedSalt += tsp * (SEA[p.id].tspG) * (SEA[p.id].salt || 0); }
    });
    // 2) 塩分を分担するもの
    var rem = Math.max(0, saltTarget - fixedSalt - (opts.otherSalt || 0));
    parts.forEach(function (p) {
      if (p.share != null) { var se = SEA[p.id]; var g = rem * p.share / (se.salt || 1); byId[p.id] = { p: p, tsp: g / se.tspG }; }
    });
    // 3) 比率で決まるもの
    parts.forEach(function (p) {
      if (p.rel != null) { var base = byId[p.to]; var tsp = base ? base.tsp * p.rel * (SEA[p.to].tspG / SEA[p.to].tspG) : 0; byId[p.id] = { p: p, tsp: tsp }; }
      if (p.pinch) byId[p.id] = { p: p, tsp: 0, pinch: true };
    });
    parts.forEach(function (p) { if (byId[p.id]) out.push(byId[p.id]); });
    return out;
  }

  // 組み合わせの基本情報（候補選び用・軽い）
  function specInfo(spec, ctx) {
    var S = SAUCE[spec.sauce];
    var ids = [].concat(spec.prot ? [spec.prot] : [], spec.veg || [], spec.extra || []);
    var veg = spec.veg || [];
    var mainVeg = null, mx = -1; veg.forEach(function (v) { if ((WF[v] || 1) > mx) { mx = WF[v] || 1; mainVeg = v; } });
    if (spec.method === 'yaki') mainVeg = null; // 焼き物の野菜は付け合わせなので主役ではない
    var tags = S._tags.slice();
    if (S.spicy) tags.push('spicy');
    var minutes = estimateMinutes(spec);
    var missingSea = [];
    var pantry = (ctx.prefs && ctx.prefs.pantry) || null;
    (S.parts || []).forEach(function (p) { if (!p.pinch && pantry && pantry.indexOf(p.id) < 0 && !p.adult) missingSea.push(p.id); });
    return { ids: ids, tags: tags, mainVeg: mainVeg, amakara: !!S.amakara, minutes: minutes, base: S.base, genre: S.genre, missingSea: missingSea, slot: spec.slot, method: spec.method, text: ids.map(function (id) { return ING[id].name; }).join(' ') };
  }
  E._estimate = function (spec) { return estimateMinutes(spec); };
  function estimateMinutes(spec) {
    var m = spec.method, P = spec.prot ? ING[spec.prot] : null, d = P ? methodData(spec.prot, m) : null;
    var vegMax = 0; (spec.veg || []).forEach(function (v) { var vd = methodData(v, m); if (vd) vegMax = Math.max(vegMax, Array.isArray(vd.min) ? vd.min[0] : vd.min || 0); });
    var preS = SAUCE[spec.sauce] && (SAUCE[spec.sauce].parts || []).some(function (p) { return p.pre; });
    var prep = 6 + 2 * (spec.veg || []).length + ((d && d.preSalt) || preS ? 10 : 0) + (spec.prot === 'tofu_momen' && m !== 'soup' && m !== 'ni' ? 5 : 0);
    var cook = 0;
    if (m === 'itame') cook = (d ? (d.min[0] + d.min[1]) : 0) + vegMax + 2;
    else if (m === 'yaki') cook = (d ? d.min[0] + d.min[1] : 0) + 3 + (spec.veg && spec.veg.length ? 2 : 0);
    else if (m === 'ni') cook = 3 + Math.max(vegMax, d ? d.min : 0, 3) + 2 + (P && P.cat === 'fish' ? 1 : 0) + (/dashi_ni|amakara_ni|miso_ni/.test(spec.sauce) && (spec.extra || []).indexOf('egg') < 0 && !(P && P.cat === 'fish') ? 5 : 0) + (d && d.when === 'first' ? 2 : 0) + (spec.sauce === 'cream' ? 4 : 0);
    else if (m === 'mushiyaki') cook = 3 + Math.max(vegMax, d ? d.min : 0);
    else if (m === 'soup') cook = 4 + Math.max(vegMax, d ? d.min : 0) + 1;
    else if (m === 'ae') cook = 4 + vegMax * 2;
    else if (m === 'sitame') cook = vegMax + 3;
    else if (m === 'nibitashi') cook = 3 + vegMax;
    else if (m === 'fukume') cook = 4 + vegMax;
    return Math.max(10, Math.round((prep + cook) / 5) * 5);
  }

  function buildCombo(spec, ctx) {
    var S = SAUCE[spec.sauce]; if (!S) return null;
    var F = factor(ctx.people); var people = ctx.people || { adult: 2 };
    var inv = toSet(ctx.inventory); var omakase = ctx.mode === 'omakase';
    var pantry = (ctx.prefs && ctx.prefs.pantry) || null;
    var kids = hasKids(people); var pr = ctx.prefs || {}; var tastes = pr.tastes || {};
    var saltAdj = (pr.saltLevel === 'light' ? 0.85 : 1) * (kids && tastes.kidMild !== false ? 0.93 : 1);
    var m = spec.method, slot = spec.slot;
    var P = spec.prot ? ING[spec.prot] : null;
    var pd = P ? methodData(spec.prot, m) : null;
    var items = []; // {id, g, role}
    var vegIds = (spec.veg || []).slice();

    if (P) items.push({ id: P.id, g: protGrams(P.id, F, slot) * ((spec.extra || []).indexOf('egg') >= 0 ? 0.75 : 1), role: 'prot' });
    var vegTotal = slot === 'main' ? VEG_Q[m] * F : slot === 'side' ? SIDE_Q * F : SOUP_SOLID * F * (P ? 0.6 : 1);
    var shares = splitVeg(vegIds, vegTotal, F, slot);
    vegIds.forEach(function (v, i) { items.push({ id: v, g: shares[i], role: 'veg' }); });
    (spec.extra || []).forEach(function (x) { items.push({ id: x, g: extraGrams(x, F, slot), role: 'extra' }); });

    var W = 0; items.forEach(function (x) { W += x.g; });
    var protW = P ? items[0].g : 0;
    var seas = []; // {id, tsp, label, adult, pinch, group}
    function addSea(id, tsp, o) { o = o || {}; seas.push({ id: id, tsp: tsp, label: o.label || '', adult: !!o.adult, pinch: !!o.pinch, group: o.group || '', note: o.note || '' }); }

    var k = (S.k || 1) * saltAdj;
    var liquid = 0, liquidEnd = 0, liquidId = S.liquid || 'water';
    var preSaltRetained = 0;
    // 魚の下味の塩
    var fishPre = P && pd && pd.preSalt && !(S.parts || []).some(function (p) { return p.pre; });
    if (fishPre) { var ps = protW * 0.008 / 6; addSea('salt', ps, { label: '下ごしらえ用' }); preSaltRetained = protW * 0.008 * 0.5; }
    // 塩もみする野菜
    var rawSaltRetained = 0;
    if (m === 'ae') items.forEach(function (x) { var d = methodData(x.id, 'ae'); if (d && d.cook === 'rawsalt') { addSea('salt', x.g * 0.01 / 6, { label: '塩もみ用' }); rawSaltRetained += x.g * 0.01 * 0.3; } });

    var saltTarget;
    if (slot === 'soup') {
      liquidEnd = (160 * (people.adult || 0) + 130 * (people.kid || 0) + 100 * (people.toddler || 0)) || 160;
      liquid = round(liquidEnd + 40, 10);
      saltTarget = (S.c || 0.7) * liquidEnd / 100 * saltAdj;
    } else if (m === 'ni' || m === 'nibitashi' || m === 'fukume') {
      if (S.lp) { liquid = S.lp * 4 * Math.pow(W / 400, 0.8); }
      else { liquid = 100 + 0.25 * W; }
      items.forEach(function (x) { var d = methodData(x.id, m); if (d && d.release) liquid -= 0.3 * x.g; });
      liquid = Math.max(m === 'nibitashi' ? 60 : 100, round(liquid, 10));
      var keep = liquidId === 'milk' ? 0.85 : S.id === 'ankake' ? 0.9 : 0.7;
      liquidEnd = liquid * keep;
      // 煮物は「具の重さ」に対する塩分で考える（煮汁は全部は食べないため）。汁ごと食べるスープ煮・クリーム煮だけ汁も入れる
      var BROTH = { consomme_ni: 0.0058, cream: 0.0052 };
      if (BROTH[S.id]) saltTarget = BROTH[S.id] * (W + liquidEnd) * saltAdj;
      else if (m === 'ni') saltTarget = 0.0075 * W * k;
      else saltTarget = (SALT_PCT[m] || 0.008) * (W + liquidEnd) * k;
    } else if (m === 'yaki') {
      saltTarget = SALT_PCT.yaki * protW * k;
    } else {
      saltTarget = (SALT_PCT[m] || 0.009) * W * k;
    }
    if (S.id === 'ankake' && m === 'itame') { liquid = round(S.lp * 4 * Math.pow(W / 400, 0.8), 10); saltTarget = 0.0085 * (W + liquid * 0.9) * saltAdj; }

    var parts = calcSauce(S, W, liquid, saltTarget, ctx, { otherSalt: preSaltRetained + rawSaltRetained });
    var adultOnly = kids;
    parts.forEach(function (x) {
      var p = x.p;
      if (p.adult) addSea(p.id, adultOnly ? x.tsp * adultShare(people) : x.tsp, { adult: adultOnly, pinch: x.pinch, label: adultOnly ? '大人の分だけ' : '' });
      else if (p.thick) addSea(p.id, x.tsp, { group: 'B' });
      else addSea(p.id, x.tsp, { pinch: x.pinch, label: p.pre ? '下味' : '' });
    });

    // 調理に使う油・粉
    var oilId = S.oil || 'oil';
    var coatTsp = 0;
    if ((m === 'itame') && pd && pd.coat) coatTsp = pd.coat * protW / 100;
    if (m === 'yaki' && pd && (pd.flour || pd.katakuri) && S.id !== 'shioyaki') coatTsp = 1.5 * protW / 100;
    var preSake = 0;
    if (pd && pd.pre && /酒（100gに小さじ(\d+(?:\.\d+)?)）/.test(pd.pre)) preSake = parseFloat(RegExp.$1) * protW / 100;

    var oilTsp = 0;
    if (m === 'itame') oilTsp = Math.max(1, 2 * Math.pow(W / 400, 0.5)) * (spec.prot === 'pork_bara' ? 0.5 : 1);
    if (m === 'yaki') oilTsp = Math.max(1, 1.5 * Math.pow(Math.max(protW, 100) / 250, 0.5));
    if (m === 'sitame') oilTsp = Math.max(1, 1.5 * Math.pow(W / 150, 0.5));
    if (m === 'ni' && pd && pd.when === 'first') oilTsp = 1;
    if (S.id === 'cream') { oilTsp = 0; }
    if (oilTsp && oilId !== 'butter') addSea(oilId, oilTsp, { label: '焼き油' });
    if (coatTsp) addSea(pd.katakuri ? 'katakuri' : (m === 'yaki' ? 'flour' : 'katakuri'), coatTsp, { label: 'まぶす用' });
    if (preSake) addSea('sake', preSake, { label: '下味' });
    if (S.id === 'ankake') addSea('water', ((parts.filter(function (x) { return x.p.thick; })[0] || {}).tsp || 1) * 2, { group: 'B', label: '水溶き片栗粉用' });
    if (m === 'mushiyaki') {
      var hasLiquid = (S.parts || []).some(function (p) { return p.id === 'sake'; });
      var lq = 6 * Math.pow(W / 400, 0.5);
      addSea(hasLiquid ? 'water' : 'sake', hasLiquid ? lq * 0.5 : lq, { label: '蒸し焼き用' });
    }
    if (m === 'yaki') {
      var panG = items.filter(function (x) { return x.role === 'veg' && !ING[x.id].raw; });
      if (panG.length) addSea('salt', 0.08, { label: '付け合わせ用', pinch: true });
    }
    if (liquid && slot !== 'soup' && liquidId === 'water' && S.id !== 'ankake') addSea('water', liquid / 5, { label: m === 'ni' || m === 'fukume' || m === 'nibitashi' ? '煮汁' : '' });
    if (liquid && liquidId === 'milk') addSea('milk', liquid / 5, {});
    if (slot === 'soup') addSea('water', liquid / 5, {});
    if (S.id === 'ankake' && m === 'ni') { /* 水は煮汁として上で追加済み */ }
    if (S.id === 'ankake' && m === 'itame') addSea('water', liquid / 5, { label: 'あん用' });

    // 合わせ調味料（A）
    var mixIds = [];
    if (m === 'itame' || (m === 'yaki' && S.id !== 'shioyaki' && S.id !== 'muniel') || m === 'mushiyaki' || m === 'sitame' || m === 'ae') {
      var inA = function (s) {
        if (s.label || s.group || s.adult) return false;
        if (s.pinch) return m === 'ae';
        if (s.id === 'butter' && m !== 'ae') return false;      // バターは別に入れる
        if (m === 'sitame' && s.id === 'sesame') return false;   // いりごまは最後にふる
        if (S.id === 'ankake' && s.id === 'sesame_oil') return false; // 仕上げに回しかける
        if (s.id === 'water' || s.id === 'milk') return false;
        return true;
      };
      seas.forEach(function (s) { if (inA(s)) s.group = 'A'; });
      if (S.id === 'ankake' && m === 'itame') seas.forEach(function (s) { if (s.id === 'water' && s.label === 'あん用') s.group = 'A'; });
    }
    seas.forEach(function (s) { if (s.group === 'A') mixIds.push(s.id); });

    // 表示用に丸める
    var seaOut = []; var totalSalt = 0; var saltAdults = 0;
    seas.forEach(function (s) {
      var a = seaAmount(s.id, s.tsp, { pinch: s.pinch });
      var se = SEA[s.id];
      var missing = !!(pantry && pantry.indexOf(s.id) < 0 && se && !se.hidden);
      var retained = s.label === '下ごしらえ用' ? 0.5 : s.label === '塩もみ用' ? 0.3 : 1;
      if (s.adult) saltAdults += a.salt; else totalSalt += a.salt * retained;
      seaOut.push({ id: s.id, name: se ? se.name : s.id, amount: a.text, g: a.g, tsp: a.tsp, label: s.label, adult: s.adult, group: s.group, missing: missing && !s.adult, optional: s.adult });
    });
    var protNote = (spec.prot === 'wiener' || spec.prot === 'bacon' || (spec.extra || []).indexOf('bacon') >= 0) ? 0.3 * F : 0;
    var saltPerAdult = (totalSalt / F) + (saltAdults / Math.max(1, people.adult || 1)) + protNote / F;

    // 材料
    var ingOut = items.map(function (x) {
      var a = ingAmount(x.id, x.g);
      var buy = !omakase && !inv[x.id];
      var hn = !omakase && inv[x.id] ? haveNote(ctx, x.id, a.g) : '';
      return { id: x.id, name: ING[x.id].name, amount: a.text, g: a.g, buy: buy, role: x.role, note: hn, short: !!hn };
    });

    // 切り方
    var cuts = items.map(function (x) {
      var d = methodData(x.id, m === 'yaki' && x.role === 'veg' ? (ING[x.id].raw ? null : 'itame') : m);
      var how = d ? d.cut : (ING[x.id].raw ? ING[x.id].raw : (x.id === 'egg' && x.role === 'extra' ? 'ボウルに割りほぐす' : ''));
      if (x.role === 'extra' && !d) { var dd = methodData(x.id, 'soup') || methodData(x.id, 'ni') || methodData(x.id, 'ae'); if (dd) how = dd.cut; }
      return { id: x.id, name: ING[x.id].name, how: how };
    }).filter(function (c) { return c.how; });

    var built = steps(spec, S, P, pd, items, seaOut, { F: F, people: people, kids: kids, liquid: liquid, oilId: oilId, coatTsp: coatTsp, W: W });
    addCues(built.steps, { prot: P ? P.id : null });

    var vegNames = vegIds.map(short);
    var name = makeName(spec, S, P, vegIds);
    var tags = specInfo(spec, ctx).tags;
    var mainVeg = specInfo(spec, ctx).mainVeg;

    var pit = [], tip = [], kid = [], subs = [];
    if (pd && P.pit) pit.push(P.pit);
    var wet = vegIds.filter(function (v) { return ING[v].water === 'high'; })[0];
    if (wet && (m === 'itame' || m === 'sitame') && ING[wet].pit) pit.push(ING[wet].pit);
    if (S.pit) pit.push(S.pit);
    if ((m === 'itame' || m === 'sitame') && W > 650) pit.push('量が多いので、フライパンに入りきらないときは2回に分けて炒めます。詰めこむと蒸れて水っぽくなります');
    if (m === 'yaki' && ingOut[0] && (ingOut[0].g || 0) > 600) pit.push('フライパンに並べきれないときは、2回に分けて焼きます');
    if (S.tip) tip.push(S.tip);
    if (P && P.tip) tip.push(P.tip);
    var vt = vegIds.map(function (v) { return ING[v].tip; }).filter(Boolean)[0]; if (vt) tip.push(vt);
    if (mixIds.length >= 2) tip.push('合わせ調味料は火にかける前に混ぜておくと、慌てずに仕上がります');
    if (kids) {
      if (S.spicy || seaOut.some(function (s) { return s.adult; })) kid.push(S.kid);
      if (saltAdj < 1) kid.push('子どもに合わせて少し薄めの味にしています。大人の分は、取り分けたあとにしょうゆ（または塩）を少し足してください');
      if ((people.toddler || 0) > 0) kid.push('小さい子の分は、さらに1cm角くらいに小さく切ります');
      if (P && P.kid) kid.push(P.kid);
      if (!S.spicy && S.kid) kid.push(S.kid);
      var vk = vegIds.map(function (v) { return ING[v].kid; }).filter(Boolean)[0]; if (vk) kid.push(vk);
      if (seaOut.some(function (s) { return s.id === 'garlic'; }) && !/にんにく/.test(S.kid || '')) kid.push('にんにくは、子どもが苦手なら半分にしても大丈夫です');
    } else {
      kid.push('子どもがいるときは、ひと口大より小さめに切って取り分けます');
    }
    if (P && P.subs && P.subs.length) subs.push({ from: P.name, to: P.subs.map(function (s) { return ING[s] ? ING[s].name : s; }).join('・') });
    vegIds.forEach(function (v) { var it = ING[v]; if (it.subs && it.subs.length) subs.push({ from: it.name, to: it.subs.map(function (s) { return ING[s] ? ING[s].name : s; }).join('・') }); });
    seaOut.forEach(function (s) { if (s.missing && SEA_SUBS[s.id]) subs.push({ from: s.name, to: SEA_SUBS[s.id] }); });

    var fits = function (t) {
      if (!t) return false;
      if (m !== 'itame' && m !== 'sitame' && /炒め/.test(t)) return false;
      if (['yaki', 'itame', 'sitame'].indexOf(m) < 0 && /焼き|焼く|焼いて|焼き色/.test(t)) return false;
      if ((m === 'soup' || m === 'ni') && /水切り/.test(t)) return false;
      if (P && P.cat !== 'meat' && /肉が|肉を|肉や/.test(t)) return false;
      if (/卵/.test(t) && !items.some(function (x) { return x.id === 'egg'; })) return false;
      if (/5分おく/.test(t) && !built.steps.some(function (x) { return /5分おく/.test(x.t); })) return false;
      return true;
    };
    pit = pit.filter(fits); tip = tip.filter(fits);
    if (m === 'ni' && P && !pit.some(function (x) { return /強く煮立て/.test(x); })) pit.push(P.cat === 'meat' ? '煮立ったら弱めの中火にします。強く煮立てたままだと、肉がかたくなります' : P.cat === 'fish' ? '煮立ったら弱めの中火にします。強く煮立てると、魚の身が崩れます' : '煮立ったら弱めの中火にします。強く煮立てると、煮汁がにごります');
    kid = kid.filter(fits).slice(0, 4);
    var minutes = Math.max(10, Math.round((built.prepMin + built.cookMin) / 5) * 5);
    var plate = { dish: slot === 'soup' ? 'bowl' : slot === 'side' ? 'small' : (m === 'ni' ? 'deep' : 'plate'), items: items.map(function (x) { return x.id; }), shares: items.map(function (x) { return x.g; }), glaze: S.look ? S.look[0] : '#ccc', genre: S.genre };
    return {
      key: E.specKey(spec), kind: 'combo', spec: spec, slot: slot, method: m, name: name,
      label: '組み合わせ提案', genre: S.genre, base: S.base, amakara: !!S.amakara, spicy: !!S.spicy,
      minutes: minutes, desc: describe(S, m, P, vegIds, spec), plate: plate,
      ingredients: ingOut, seasonings: seaOut, mix: mixIds.length ? { A: mixIds } : {},
      prep: built.prep, cuts: cuts, steps: built.steps, pit: uniq(pit), tip: uniq(tip), kid: uniq(kid), subs: subs,
      saltPerAdult: saltPerAdult, ids: items.map(function (x) { return x.id; }), tags: tags, mainVeg: mainVeg,
      mainId: P ? P.id : vegIds[0], uses: items.filter(function (x) { return inv[x.id]; }).map(function (x) { return x.id; }).concat(seaOut.some(function (s) { return s.id === 'milk'; }) && inv.milk ? ['milk'] : []),
      buys: omakase ? [] : ingOut.filter(function (x) { return x.buy; }).map(function (x) { return x.name; })
    };
  }
  E.buildCombo = buildCombo;

  function makeName(spec, S, P, vegIds) {
    var m = spec.method, tpl = (S.title && S.title[m]) || '{p}と{v}の' + S.name;
    var p = P ? short(P.id) : '';
    var mains = vegIds.slice();
    var v = mains.length ? short(mains.slice().sort(function (a, b) { return (WF[b] || 1) - (WF[a] || 1); })[0]) : '';
    if (spec.slot !== 'main') {
      var list = [];
      if (spec.slot === 'soup' && P && P.id !== 'egg') list.push(short(P.id));
      var maxN = (spec.slot === 'soup' && P && P.id === 'egg') ? 1 : 2;
      mains.slice().sort(function (a, b) { return (WF[b] || 1) - (WF[a] || 1); }).forEach(function (x) { if (list.length < maxN) list.push(short(x)); });
      (spec.extra || []).forEach(function (x) { if (list.length < maxN && x !== 'aonegi') list.push(short(x)); });
      v = list.join('と') || short((spec.extra || [])[0] || '');
    }
    if (P && P.cat === 'fish' && S.titleFish) tpl = S.titleFish;
    if (spec.slot === 'side' && S.titleMash && vegIds.some(function (x) { var d = methodData(x, 'ae'); return d && d.mash; })) tpl = S.titleMash;
    if (spec.slot === 'soup' && P && P.id === 'egg' && S.titleEgg) { tpl = S.titleEgg; if (!v) tpl = tpl.replace('{v}の', '').replace('{v}と', ''); }
    if (spec.slot === 'soup' && S.id === 'miso_soup' && P && /^pork/.test(P.id)) { var vv = mains.slice(0, 2).map(short).join('と'); return vv ? vv + 'の豚汁' : '豚汁'; }
    if (spec.slot === 'main' && S.id === 'dashi_ni' && (spec.extra || []).indexOf('egg') >= 0) tpl = '{p}と{v}の卵とじ';
    if (!v) tpl = tpl.replace('と{v}', '').replace('{v}と', '').replace('{v}の', '');
    if (p === v) tpl = tpl.replace('{p}と', '');
    return tpl.replace('{p}', p).replace('{v}', v);
  }

  function describe(S, m, P, vegIds, spec) {
    var names = vegIds.map(short);
    var who = (P ? short(P.id) : '') + (P && names.length ? 'と' : '') + names.slice(0, 2).join('・');
    var phrase = { itame: 'を炒め合わせたひと皿', yaki: 'を焼いたひと皿', ni: 'を煮て、煮汁ごと盛る一品', mushiyaki: 'を蒸し焼きにした、ふっくらした一品', ae: 'の和え物', sitame: 'の炒め物', nibitashi: 'の煮びたし', fukume: 'の煮物', soup: 'の汁物' }[m] || '';
    if (m === 'yaki' && names.length) who = short(P.id) + 'に' + names.slice(0, 2).join('・') + 'を添えた';
    if (m === 'yaki' && names.length) phrase = 'ひと皿';
    return (S.look ? S.look[1] + '。' : '') + who + phrase;
  }

  // ---------- 手順の文章を作る ----------
  function steps(spec, S, P, pd, items, seaOut, o) {
    var m = spec.method;
    var prep = [], st = [];
    var name = function (id) { return short(id); };
    var amt = function (id, label) {
      var s = seaOut.filter(function (x) { return x.id === id && (label == null || x.label === label); })[0];
      return s ? s.name.replace(/（.*?）/g, '') + s.amount : '';
    };
    var hasA = seaOut.some(function (s) { return s.group === 'A'; });
    var hasB = seaOut.some(function (s) { return s.group === 'B'; });
    var oil = amt(o.oilId, '焼き油') || amt('oil', '焼き油');
    var vegs = items.filter(function (x) { return x.role === 'veg'; });
    var extras = items.filter(function (x) { return x.role === 'extra'; });
    var cookMin = 0, prepMin = 6 + vegs.length * 2;
    var push = function (t, heat, min, extra) { st.push({ t: t, heat: heat || '', min: min || 0, wait: extra && extra.wait }); cookMin += (min || 0); };
    var adultPart = seaOut.filter(function (s) { return s.adult; })[0];

    // 下ごしらえ
    if (P && pd) {
      if (pd.preSalt && !(S.parts || []).some(function (p) { return p.pre; })) { prep.push(name(P.id) + 'に' + amt('salt', '下ごしらえ用') + 'をふって10分おき、出た水分をキッチンペーパーでふく（臭みが抜けます。甘塩の切り身なら塩はふりません）'); prepMin += 10; }
      if (S.parts && S.parts.some(function (p) { return p.pre; })) { var pre = seaOut.filter(function (s) { return s.label === '下味' && s.id === 'salt'; })[0]; if (pre) { prep.push(name(P.id) + 'に塩' + pre.amount + 'をふって10分おき、出た水分をキッチンペーパーでふく'); prepMin += 10; } }
      if (S.id === 'shioyaki' && amt('sake')) prep.push('焼く直前に、' + name(P.id) + 'に' + amt('sake') + 'をふる（ふっくら焼けます）');
      if (pd.pre) { prep.push(name(P.id) + '：' + pd.pre.replace(/酒（100gに小さじ(\d+(?:\.\d+)?)）/, amt('sake', '下味') || '酒少々')); if (/水切り/.test(pd.pre)) prepMin += 5; }
      if (m === 'itame' && pd.coat && o.coatTsp) prep.push(name(P.id) + 'に' + amt('katakuri', 'まぶす用') + 'を薄くまぶす');
    }
    vegs.forEach(function (x) { var d = methodData(x.id, m === 'yaki' ? 'itame' : m); if (d && /水に5分さらす/.test(d.cut)) prepMin = Math.max(prepMin, 8); });
    if (hasA) prep.push('合わせ調味料A：' + seaOut.filter(function (s) { return s.group === 'A'; }).map(function (s) { return s.name.replace(/（.*?）/g, '') + s.amount; }).join('・') + 'を混ぜておく');
    if (hasB) prep.push('水溶き片栗粉B：' + seaOut.filter(function (s) { return s.group === 'B'; }).map(function (s) { return s.name.replace(/（.*?）/g, '') + s.amount; }).join('・') + 'を混ぜておく');

    var vegByTime = function (method) {
      var arr = vegs.map(function (x) { var d = methodData(x.id, method) || {}; return { id: x.id, min: Array.isArray(d.min) ? d.min[0] : (d.min || 1), leafy: d.leafy }; });
      arr.sort(function (a, b) { return b.min - a.min; });
      var groups = [];
      arr.forEach(function (v) { var g = groups[groups.length - 1]; if (g && Math.abs(g.min - v.min) < 1) g.ids.push(v.id); else groups.push({ min: v.min, ids: [v.id], leafy: v.leafy }); });
      return groups;
    };
    var join = function (ids) { return ids.map(name).join('・'); };
    var kidStep = function () {
      if (adultPart && o.kids) push('子どもの分を取り分けてから、大人の分に' + adultPart.name.replace(/（.*?）/g, '') + adultPart.amount + 'を加えて、30秒ほど炒め合わせる', '中火', 0.5);
    };
    var tasteStep = function (what) { st.push({ t: '味見をして、薄ければ' + (what || 'しょうゆ') + 'を小さじ1/4ずつ足す', heat: '', min: 0 }); };

    if (m === 'itame') {
      var pm = pd ? pd.min : [2, 1];
      if (P.id === 'egg') push('フライパンに' + oil + 'を入れて強めの中火で熱し、卵を流し入れる。大きく混ぜて半熟になったら、いったん取り出す', '強めの中火', 1);
      else if (/mince/.test(P.id)) push('フライパンに' + oil + 'を入れて中火で熱し、' + name(P.id) + 'を広げて入れる。焼き色がつくまで触らずに2分焼き、ほぐしながら1分炒めて、いったん取り出す', '中火', 3);
      else if (P.cat === 'soy') push('フライパンに' + oil + 'を入れて中火で熱し、' + name(P.id) + 'を並べて、焼き色がつくまで' + fmtMin(pm[0]) + '焼き、いったん取り出す', '中火', pm[0]);
      else push('フライパンに' + oil + 'を入れて中火で熱し、' + name(P.id) + 'を' + (pd && pd.skin ? '皮目を下にして' : '') + '広げて入れる。' + fmtMin(pm[0]) + 'ほど焼いて焼き色がついたら返し、' + (pm[1] ? 'さらに' + fmtMin(pm[1]) + '焼く。' : '') + '色が変わったら、いったん取り出す（こうすると、かたくなりにくい）', '中火', pm[0] + pm[1]);
      var groups = vegByTime('itame');
      groups.forEach(function (g, i) {
        var hi = g.ids.some(function (id) { return ING[id].water === 'high'; });
        var t = (i === 0 ? '同じフライパンに（油が足りなければ小さじ1足して）' : '') + join(g.ids) + 'を' + (i === 0 ? '入れて' : '加えて') + fmtMin(Math.max(0.5, g.min - (groups[i + 1] ? groups[i + 1].min : 0))) + '炒める';
        push(t, hi ? '強めの中火' : '中火', Math.max(0.5, g.min - (groups[i + 1] ? groups[i + 1].min : 0)));
      });
      extras.forEach(function (x) { if (x.id === 'bacon') st.splice(0, 0, { t: 'フライパンでベーコンを1分半炒めて脂を出す', heat: '中火', min: 1.5 }); });
      var thick = S.id === 'ankake';
      var finish = '';
      if (seaOut.some(function (s) { return s.id === 'butter' && !s.label; })) finish += '。最後に' + amt('butter') + 'を加えて溶かし、全体に絡める';
      if (seaOut.some(function (s) { return s.id === 'pepper'; })) finish += '。こしょう少々をふる';
      push(name(P.id) + 'を戻し入れ、' + (hasA ? '合わせ調味料A' : '調味料') + 'を' + (thick ? '加えて煮立てる' : '回し入れて、強めの中火で30秒〜1分、全体に絡める' + finish), thick ? '中火' : '強めの中火', 1);
      if (thick) { push('火を弱めて、水溶き片栗粉Bをもう一度混ぜてから少しずつ回し入れ、混ぜながらとろみをつける', '弱火', 1); push('中火にして1分しっかり煮立て、とろみを安定させる' + (seaOut.some(function (s) { return s.id === 'sesame_oil'; }) ? '。ごま油を回しかける' : ''), '中火', 1); }
      if (S.id === 'shio' || S.id === 'pirikara') { /* ごま油は合わせ調味料に入っている */ }
      tasteStep(S.base === 'salt' ? '塩' : S.base === 'miso' ? 'みそ' : 'しょうゆ');
      kidStep();
    } else if (m === 'yaki') {
      var garnish = vegs.filter(function (x) { return !ING[x.id].raw; });
      var raw = vegs.filter(function (x) { return ING[x.id].raw; });
      var ym = pd ? pd.min : [3, 3];
      if (garnish.length) push('フライパンに' + oil + 'の半量を入れて中火で熱し、' + join(garnish.map(function (x) { return x.id; })) + 'を焼く。しんなりしたら塩少々をふって取り出す', '中火', Math.max.apply(null, garnish.map(function (x) { var d = methodData(x.id, 'itame') || {}; return Array.isArray(d.min) ? d.min[0] : d.min || 2; })));
      if (pd && (pd.flour || pd.katakuri) && o.coatTsp) push(name(P.id) + 'に' + (S.id === 'muniel' && seaOut.some(function (s) { return s.id === 'pepper'; }) ? 'こしょう少々をふり、' : '') + (amt('flour', 'まぶす用') || amt('katakuri', 'まぶす用')) + 'を薄くまぶし、余分な粉をはたく（焼く直前に）');
      var face = pd && pd.skin ? '皮目を下にして' : (P.cat === 'fish' ? '盛り付けるときに上になる面を下にして' : '');
      push((garnish.length ? '残りの油を足し、' : 'フライパンに' + oil + 'を入れて中火で熱し、') + name(P.id) + 'を' + face + '入れて、触らずに' + fmtMin(ym[0]) + '焼く。焼き色がついたら返す', '中火', ym[0]);
      if (pd && pd.lid) push('蓋をして、弱めの中火で' + fmtMin(ym[1]) + '蒸し焼きにする', '弱めの中火', ym[1]);
      else push('さらに' + fmtMin(ym[1]) + '焼く', '中火', ym[1]);
      if (S.id === 'muniel') push('余分な油をペーパーでふき取り、' + amt('butter') + 'と' + amt('shoyu') + 'を加える。バターが溶けたら、スプーンでかけながら30秒焼く', '中火', 0.5);
      else if (S.id === 'shioyaki') { /* 酒は下ごしらえでふる */ }
      else push('出た脂をキッチンペーパーでふき取り、' + (hasA ? '合わせ調味料A' : '調味料') + 'を加えて中火にし、スプーンでかけながら1〜2分煮絡める' + (seaOut.some(function (s) { return s.id === 'butter' && !s.label; }) ? '。最後に' + amt('butter') + 'を加えて溶かす' : '') + (seaOut.some(function (s) { return s.id === 'pepper'; }) ? '。こしょう少々をふる' : ''), '中火', 1.5);
      push('中まで火が通ったかを確かめる（いちばん厚いところを切って、' + (P.cat === 'fish' ? '身が白く不透明になっていればOK' : P.cat === 'soy' ? '中まで温まっていればOK' : '赤い汁が出なければOK') + '）');
      kidStep();
      if (raw.length) push('器に盛り、' + raw.map(function (x) { return name(x.id) + '（' + ING[x.id].raw + '）'; }).join('・') + 'と焼いた付け合わせを添える');
      else if (garnish.length) push('器に盛り、焼いた付け合わせを添える');
    } else if (m === 'ni') {
      var groupsN = vegByTime('ni');
      var hard = groupsN.filter(function (g) { return g.min >= 7; });
      var mid = groupsN.filter(function (g) { return g.min < 7 && !g.leafy; });
      var leafy = groupsN.filter(function (g) { return g.leafy; });
      var liquidTxt = S.liquid === 'milk' ? '' : amt('water', '煮汁');
      var lateMiso = S.id === 'miso_ni';
      var seasonList = seaOut.filter(function (s) { return !s.label && !s.group && !s.adult && !s.pinch && s.id !== 'milk' && s.id !== 'flour' && s.id !== 'butter' && !(lateMiso && s.id === 'miso'); }).map(function (s) { return s.name.replace(/（.*?）/g, '') + s.amount; });
      if (S.id === 'cream') {
        push('フライパンに' + amt('butter') + 'を入れて中火で溶かし、' + name(P.id) + 'を入れて' + (P.cat === 'fish' ? '両面を2分ずつ焼き、いったん取り出す' : '色が変わるまで3分焼く'), '中火', P.cat === 'fish' ? 4 : 3);
        var allV = vegs.filter(function (x) { return !(methodData(x.id, 'ni') || {}).leafy && x.id !== 'broccoli'; });
        if (allV.length) push(join(allV.map(function (x) { return x.id; })) + 'を加えて、しんなりするまで' + fmtMin(Math.min(4, Math.max(2, Math.max.apply(null, allV.map(function (x) { return (methodData(x.id, 'ni') || {}).min || 2; })) / 3))) + '炒める', '中火', 3);
        push('弱火にして' + amt('flour') + 'をふり入れ、粉っぽさがなくなるまで1分炒める', '弱火', 1);
        push(amt('milk') + 'を3回に分けて加え、そのつどよく混ぜてなめらかにする。' + seasonList.join('・') + 'を加える', '弱めの中火', 2);
        var hardMin = Math.max(5, Math.max.apply(null, [0].concat(vegs.map(function (x) { return (methodData(x.id, 'ni') || {}).min || 0; }))) - 3);
        push('ときどき底から混ぜながら、弱めの中火で' + fmtMin(Math.min(hardMin, 12)) + '、とろみがつくまで煮る（煮立たせない）' + (P.cat === 'fish' ? '。最後に' + name(P.id) + 'を戻して温める' : ''), '弱めの中火', Math.min(hardMin, 12));
        var lastV = vegs.filter(function (x) { return (methodData(x.id, 'ni') || {}).leafy || x.id === 'broccoli'; });
        if (lastV.length) push(join(lastV.map(function (x) { return x.id; })) + 'を加えて、' + fmtMin(2) + '煮る', '弱めの中火', 2);
        push('こしょうをふり、味見をして薄ければ塩をひとつまみずつ足す');
      } else {
        var fish = P && P.cat === 'fish';
        var first = pd && pd.when === 'first';
        var liqSeason = liquidTxt + (seasonList.length ? '・' + seasonList.join('・') : '');
        if (first) push('鍋に' + (amt('oil', '焼き油') || 'サラダ油小さじ1') + 'を入れて中火で熱し、' + name(P.id) + 'を' + (pd.skin !== false ? '皮目から' : '') + '入れて2分焼き付ける', '中火', 2);
        var isEgg = extras.some(function (x) { return x.id === 'egg'; });
        var tasteWhat = S.base === 'miso' ? 'みそ' : S.base === 'western' ? '塩' : 'しょうゆ';
        if (fish) {
          var nmin = function (x) { return (methodData(x.id, 'ni') || {}).min || 0; };
          var hardF = vegs.filter(function (x) { return nmin(x) > pd.min; });
          var softF = vegs.filter(function (x) { return hardF.indexOf(x) < 0; });
          var preF = hardF.length ? Math.max.apply(null, hardF.map(nmin)) - pd.min : 0;
          push('鍋に' + liqSeason + 'を入れ' + (hardF.length ? '、' + join(hardF.map(function (x) { return x.id; })) + 'も入れて' : 'て') + '中火にかける', '中火', 3);
          if (preF >= 1) push('煮立ったら落とし蓋をして、弱めの中火で' + fmtMin(preF) + '煮る（' + join(hardF.map(function (x) { return x.id; })) + 'を先にやわらかくしておく）', '弱めの中火', preF);
          var skinless = /皮を取/.test((methodData(P.id, 'ni') || {}).cut || '');
          push((preF >= 1 ? '' : '煮立ったら、') + name(P.id) + (skinless ? 'を' : 'を皮を上にして') + '重ならないように入れ' + (softF.length ? '、' + join(softF.map(function (x) { return x.id; })) + 'も加える' : 'る') + '。スプーンで煮汁をかける', '中火', 1);
          if (lateMiso) {
            var h1 = Math.max(2, Math.round(pd.min / 2));
            push('落とし蓋をして、弱めの中火で' + fmtMin(h1) + '煮る（裏返さない）', '弱めの中火', h1);
            push(amt('miso') + 'をお玉に取り、煮汁で溶いてから加える。落とし蓋をして、さらに' + fmtMin(Math.max(1, pd.min - h1)) + '煮る', '弱めの中火', Math.max(1, pd.min - h1));
          } else push('落とし蓋をして、弱めの中火で' + fmtMin(pd.min) + '煮る（裏返さない）', '弱めの中火', pd.min);
          var roots = hardF.filter(function (x) { return nmin(x) >= 8; });
          push('落とし蓋を取り、煮汁をスプーンでかけながら2分、とろみがつくまで煮詰める' + (roots.length ? '。' + join(roots.map(function (x) { return x.id; })) + 'に竹串がすっと通ればOK' : ''), '中火', 2);
          tasteStep(tasteWhat);
        } else {
          // 時間割：長く煮るものから入れて、全部が同時に煮上がるようにする
          var protMin = pd ? pd.min : 0;
          var T = Math.max(protMin, groupsN.length ? groupsN[0].min : 0, 3);
          var ev = [];
          groupsN.forEach(function (g) { ev.push({ at: Math.max(0, T - g.min), ids: g.ids, kind: 'veg' }); });
          if (P && !first) ev.push({ at: Math.max(0, T - protMin), ids: [P.id], kind: 'prot' });
          if (extras.some(function (x) { return x.id === 'aburaage'; })) ev.push({ at: Math.max(0, T - 3), ids: ['aburaage'], kind: 'veg' });
          if (lateMiso) ev.push({ at: Math.max(1, Math.round(T / 2)), ids: [], kind: 'miso' });
          ev.sort(function (a, b) { return a.at - b.at || (a.kind === 'veg' ? -1 : 1); });
          var startV = ev.filter(function (e) { return e.at < 1 && e.kind === 'veg'; });
          var later = ev.filter(function (e) { return !(e.at < 1 && e.kind === 'veg'); });
          later.sort(function (a, b) { return a.at - b.at; });
          var startIds = [].concat.apply([], startV.map(function (e) { return e.ids; }));
          push((first ? '' : '鍋に') + liqSeason + 'を' + (first ? '加え' : '入れ') + (startIds.length ? '、' + join(startIds) + 'も入れて' : 'て') + '中火にかける', '中火', 3);
          var t = 0;
          later.forEach(function (e) {
            var wait = Math.round((e.at - t) * 2) / 2;
            if (wait >= 1) { push((t < 1 ? '煮立ったら' : '') + '落とし蓋をして、弱めの中火で' + fmtMin(wait) + '煮る', '弱めの中火', wait); t = e.at; }
            if (e.kind === 'prot') {
              var how = /mince/.test(P.id) ? 'を少しずつ入れて菜箸でほぐす' : P.cat === 'meat' ? 'を1枚ずつ広げながら入れる' : P.cat === 'soy' ? 'をそっと入れる' : 'を入れる';
              push((t < 1 ? '煮立ったら、' : '') + name(P.id) + how + (P.cat === 'meat' ? '。アクが出たら取る' : ''), '中火', 1);
            } else if (e.kind === 'miso') push(amt('miso') + 'をお玉に取り、煮汁で溶いてから加える');
            else push(join(e.ids) + 'を加える');
          });
          var remain = Math.round((T - t) * 2) / 2;
          var cue = groupsN.some(function (g) { return g.min >= 8; }) ? '（根菜に竹串がすっと通ればOK）' : (P && P.cat === 'meat' ? '（肉の色が変わればOK）' : '');
          if (remain >= 0.5) push('落とし蓋をして、弱めの中火で' + fmtMin(remain) + '煮る' + cue, '弱めの中火', remain);
          if (S.id === 'ankake') { push('火を弱めて、水溶き片栗粉Bをもう一度混ぜてから少しずつ回し入れ、混ぜながらとろみをつける', '弱火', 1); push('中火にして1分しっかり煮立て、とろみを安定させる' + (seaOut.some(function (s) { return s.id === 'sesame_oil'; }) ? '。ごま油を回しかける' : ''), '中火', 1); }
          if (seaOut.some(function (s) { return s.id === 'pepper'; })) push('こしょう少々をふる');
          tasteStep(tasteWhat);
          if (isEgg) push('溶き卵を回し入れ、蓋をして弱火で1分、卵が半熟になったら火を止める' + (o.kids ? '（小さい子の分は、もう1分加熱して卵にしっかり火を通す）' : ''), '弱火', 1);
          else if (S.id === 'dashi_ni' || S.id === 'amakara_ni' || S.id === 'miso_ni') push('火を止めて5分おくと、味がしみる', '', 5, { wait: true });
        }
      }
    } else if (m === 'mushiyaki') {
      var lqTxt = amt('water', '蒸し焼き用') || amt('sake', '蒸し焼き用');
      push('フライパンに' + join(vegs.map(function (x) { return x.id; })) + 'を広げて敷き、その上に' + name(P.id) + 'を並べる');
      push((hasA ? '合わせ調味料A' : '調味料') + 'を全体にかけ、' + lqTxt + 'を回し入れる' + (seaOut.some(function (s) { return s.id === 'butter' && !s.label; }) ? '。' + amt('butter') + 'を' + name(P.id) + 'の上にのせる' : '') + (seaOut.some(function (s) { return s.id === 'pepper'; }) ? '。こしょう少々をふる' : ''));
      var mt = Math.max(pd ? pd.min : 6, Math.max.apply(null, [0].concat(vegs.map(function (x) { return (methodData(x.id, 'mushiyaki') || {}).min || 0; }))));
      push('蓋をして中火にかけ、湯気が出てきたら弱めの中火にして' + fmtMin(mt) + '蒸し焼きにする', '弱めの中火', mt + 2);
      push('蓋を取り、' + (P.cat === 'fish' ? '身が白く不透明になっていれば火が通っています' : '肉の色が変わっていれば火が通っています') + '。汁気が多ければ中火で30秒ほど飛ばす', '中火', 0.5);
      tasteStep(S.base === 'salt' ? '塩' : 'しょうゆ');
      kidStep();
    } else if (m === 'ae') {
      var boil = vegs.filter(function (x) { return (methodData(x.id, 'ae') || {}).cook === 'boil'; });
      var micro = vegs.filter(function (x) { return (methodData(x.id, 'ae') || {}).cook === 'micro'; });
      var rs = vegs.filter(function (x) { return (methodData(x.id, 'ae') || {}).cook === 'rawsalt'; });
      var rw = vegs.filter(function (x) { return (methodData(x.id, 'ae') || {}).cook === 'raw'; });
      if (boil.length) {
        push('鍋にたっぷりの湯を沸かし、塩少々を入れる', '強火', 0);
        boil.forEach(function (x) { var d = methodData(x.id, 'ae'); push(name(x.id) + 'を入れて' + fmtMin(d.min) + 'ゆでる' + (d.cold ? '。冷水にとって冷ます' : '。ざるに上げて冷ます'), '強火', d.min); if (d.squeeze) push(name(x.id) + 'の水気をしっかりしぼり、' + (/4cm/.test(d.cut) ? '4cm長さに切る' : '食べやすく切る')); });
      }
      micro.forEach(function (x) {
        var d = methodData(x.id, 'ae'); var t = d.min * x.g / 100; t = Math.max(0.5, Math.round(t * 6) / 6);
        push(name(x.id) + 'を耐熱容器に入れてふんわりラップをし、600Wで' + fmtMin(t) + '加熱する（500Wなら1.2倍の時間）', 'レンジ600W', t);
        if (d.mash) push('熱いうちにフォークでつぶして、冷ます');
        else if (d.shred) push('粗熱がとれたら、手で細かくほぐす');
        else if (d.squeeze) push('粗熱がとれたら、水気をしっかりしぼる（水っぽくなるのを防ぎます）');
        else push('広げて冷まし、出た水分は捨てる');
      });
      rs.forEach(function (x) { push(name(x.id) + 'に' + amt('salt', '塩もみ用') + 'をふって軽くもみ、5分おいて水気をしぼる', '', 5, { wait: true }); });
      rw.forEach(function (x) { var d = methodData(x.id, 'ae'); if (d && d.cut) push(name(x.id) + '：' + d.cut); });
      extras.forEach(function (x) { var d = methodData(x.id, 'ae'); if (d && d.cook === 'micro') push(name(x.id) + 'に酒少々をふってラップをし、600Wで' + fmtMin(Math.max(0.5, d.min * x.g / 100)) + '加熱し、手でほぐす', 'レンジ600W', 1); else if (d) push(name(x.id) + '：' + d.cut); });
      push('ボウルに合わせ調味料Aを混ぜ、' + join(vegs.map(function (x) { return x.id; }).concat(extras.map(function (x) { return x.id; }))) + 'を加えて和える（食べる直前に和えると水っぽくなりません）');
      tasteStep(S.base === 'mayo' ? 'しょうゆ' : S.base === 'sesame_oil' ? '塩' : 'しょうゆ');
    } else if (m === 'sitame') {
      var g2 = vegByTime('sitame');
      var oilT = S.oil === 'butter' ? amt('butter') : amt(S.oil || 'oil', '焼き油');
      if (extras.some(function (x) { return x.id === 'bacon'; })) push('フライパンに' + oilT + 'を入れて中火で熱し、ベーコンを1分炒める', '中火', 1);
      g2.forEach(function (g, i) {
        var mm = Math.max(0.5, g.min - (g2[i + 1] ? g2[i + 1].min : 0));
        push((i === 0 && !extras.some(function (x) { return x.id === 'bacon'; }) ? 'フライパンに' + oilT + 'を入れて' + (S.id === 'shio_itame' ? '強めの中火' : '中火') + 'で熱し、' : '') + join(g.ids) + 'を' + (i === 0 ? '入れて' : '加えて') + fmtMin(mm) + '炒める', S.id === 'shio_itame' ? '強めの中火' : '中火', mm);
      });
      extras.forEach(function (x) { if (x.id === 'corn') push('コーンを加えて30秒炒める', '中火', 0.5); });
      if (S.id === 'kinpira') push('合わせ調味料Aを加え、汁気がなくなるまで2分炒め煮にする。' + amt('sesame') + 'をふる', '中火', 2);
      else if (S.id === 'butter_side') push('しょうゆをフライパンのふちから回し入れ、さっと絡める。こしょうをふる', '中火', 0.5);
      else push('合わせ調味料Aを加えて、さっと絡める。こしょうをふる', '強めの中火', 0.5);
      tasteStep(S.base === 'salt' ? '塩' : 'しょうゆ');
      if (S.id === 'kinpira' && o.kids) push('子どもの分を取り分けてから、大人の分に一味とうがらしをふる');
      else if (S.id === 'kinpira') push('お好みで一味とうがらしをふる');
    } else if (m === 'nibitashi') {
      var sl = seaOut.filter(function (s) { return !s.label && !s.group; }).map(function (s) { return s.name.replace(/（.*?）/g, '') + s.amount; });
      push('鍋に' + amt('water', '煮汁') + '・' + sl.join('・') + 'を入れて中火で煮立てる', '中火', 2);
      if (extras.some(function (x) { return x.id === 'aburaage'; })) push('油揚げを入れて1分煮る', '中火', 1);
      var gN = vegByTime('nibitashi');
      gN.forEach(function (g, i) { var mm = Math.max(1, g.min - (gN[i + 1] ? gN[i + 1].min : 0)); push(join(g.ids) + 'を' + (i ? '加えて' : '入れて') + fmtMin(mm) + '煮る（茎のある葉物は、茎を先に入れる）', '中火', mm); });
      push('火を止めて、そのまま5分おいて味をなじませる', '', 5, { wait: true });
    } else if (m === 'fukume') {
      var sl2 = seaOut.filter(function (s) { return !s.label && !s.group; }).map(function (s) { return s.name.replace(/（.*?）/g, '') + s.amount; });
      var fm = Math.max.apply(null, vegs.map(function (x) { return (methodData(x.id, 'fukume') || {}).min || 10; }));
      push('鍋に' + join(vegs.map(function (x) { return x.id; })) + (vegs.some(function (x) { return x.id === 'kabocha'; }) ? '（皮を下にして）' : '') + 'を並べ、' + amt('water', '煮汁') + '・' + sl2.join('・') + 'を入れて中火にかける', '中火', 3);
      push('煮立ったら落とし蓋をして、弱めの中火で' + fmtMin(fm) + '煮る。竹串がすっと通ればOK', '弱めの中火', fm);
      push('火を止めて、そのまま冷ますと味がしみる', '', 5, { wait: true });
    } else if (m === 'soup') {
      var solids = items.filter(function (x) { return x.role !== 'extra' || x.id === 'aburaage'; });
      var getMin = function (x) { var d = methodData(x.id, 'soup') || {}; return d.min || 1; };
      var hardS = solids.filter(function (x) { return getMin(x) >= 4 && x.id !== 'egg'; });
      var softS = solids.filter(function (x) { return getMin(x) < 4 && x.id !== 'egg'; });
      var meat = P && (P.cat === 'meat');
      var base = seaOut.filter(function (s) { return (s.id === 'dashi' || s.id === 'torigara' || s.id === 'consomme') && !s.label; })[0];
      if (meat && /^pork|chicken/.test(P.id)) {
        push('鍋に' + amt('water') + 'を入れて中火にかけ、' + (hardS.filter(function (x) { return x.id !== P.id; }).length ? join(hardS.filter(function (x) { return x.id !== P.id; }).map(function (x) { return x.id; })) + 'を入れる' : '沸かす'), '中火', 3);
        push('煮立ったら' + name(P.id) + 'を入れてほぐし、アクを取る。' + (base ? base.name.replace(/（.*?）/g, '') + base.amount + 'を加え、' : '') + '弱めの中火で' + fmtMin(Math.max(4, Math.max.apply(null, [0].concat(hardS.map(getMin))))) + '煮る', '弱めの中火', Math.max(4, Math.max.apply(null, [0].concat(hardS.map(getMin)))));
      } else {
        push('鍋に' + amt('water') + (hardS.length ? 'と' + join(hardS.map(function (x) { return x.id; })) : '') + 'を入れて中火にかける' + (base ? '。煮立ったら' + base.name.replace(/（.*?）/g, '') + base.amount + 'を加える' : ''), '中火', 3);
        if (hardS.length) push('弱めの中火にして、' + join(hardS.map(function (x) { return x.id; })) + 'がやわらかくなるまで' + fmtMin(Math.max.apply(null, hardS.map(getMin))) + '煮る', '弱めの中火', Math.max.apply(null, hardS.map(getMin)));
      }
      var soft2 = softS.filter(function (x) { return !(meat && x.id === P.id); });
      var wak = extras.filter(function (x) { return x.id === 'wakame' || x.id === 'corn'; });
      if (soft2.length || wak.length) push(join(soft2.map(function (x) { return x.id; }).concat(wak.map(function (x) { return x.id; }))) + 'を加えて、' + fmtMin(Math.max(1, Math.max.apply(null, [0].concat(soft2.map(getMin))))) + '煮る', '弱めの中火', Math.max(1, Math.max.apply(null, [0].concat(soft2.map(getMin)))));
      var last = seaOut.filter(function (s) { return !s.label && !s.group && s.id !== 'water' && s.id !== 'dashi' && s.id !== 'torigara' && s.id !== 'consomme' && !(s.id === 'sesame_oil'); }).map(function (s) { return s.name.replace(/（.*?）/g, '') + s.amount; });
      if (S.id === 'miso_soup') push('火を弱めて、' + amt('miso') + 'を溶き入れる。みそを入れたら煮立たせない（香りが飛びます）', '弱火', 1);
      else push(last.join('・') + 'で味をととのえる', '弱めの中火', 0.5);
      if (P && P.id === 'egg') push('溶き卵を細く回し入れ、ふわっと浮いてきたら軽く混ぜて火を止める（入れてすぐ混ぜると、汁がにごります）', '中火', 0.5);
      if (S.id === 'chuka_soup') push('ごま油を回し入れる');
      if (extras.some(function (x) { return x.id === 'aonegi'; })) push('器に盛り、小ねぎを散らす');
    }
    return { prep: prep, steps: st, cookMin: cookMin, prepMin: prepMin };
  }

  // ---------- 火加減の説明・見た目の目安（調理中にいつも表示する） ----------
  var HEAT_INFO = {
    '強火': { look: '炎が鍋底全体に勢いよく当たる（横にはみ出さない）', ih: 'IHなら「強」〜8くらい' },
    '強めの中火': { look: '炎が鍋底全体にしっかり当たるくらい', ih: 'IHなら6〜7くらい' },
    '中火': { look: '炎の先が鍋底にちょうど当たるくらい', ih: 'IHなら5くらい' },
    '弱めの中火': { look: '炎の先が鍋底に当たるか当たらないかくらい', ih: 'IHなら3〜4くらい' },
    '弱火': { look: '炎の先と鍋底のあいだに1cmくらいすき間がある', ih: 'IHなら2くらい' },
    '火を止める': { look: '火は止めて、余熱で仕上げる', ih: '' },
    'レンジ600W': { look: '電子レンジ600W（500Wなら1.2倍の時間）', ih: '' }
  };
  E.heatInfo = function (h) { return HEAT_INFO[h] || null; };
  E.heatNote = '※IHの数字はメーカーで違います。初めは様子を見ながら調整してください';
  var VEG_RE = null;
  var LEAFY_RE = /ほうれん草|小松菜|チンゲン菜|にら|水菜|春菊/;
  var GREEN_RE = /オクラ|アスパラ|いんげん|ブロッコリー/;
  // 手順の文と主役の食材から、見た目の目安を最大2つ選ぶ
  function cueFor(t, c) {
    c = c || {};
    var out = [];
    var add = function (x) { if (out.length < 2 && out.indexOf(x) < 0) out.push(x); };
    var P = c.prot ? ING[c.prot] : null;
    if (/透明な肉汁/.test(t)) add('竹串を刺したところから、透明な汁が出てくればOK（赤い汁ならまだ）');
    else if (/竹串/.test(t)) add('竹串を刺して、力を入れずにすっと通ればOK');
    if (/焼き色|きつね色|こんがり/.test(t)) add('裏をのぞいて、こんがりきつね色になっていたら返す合図');
    if (/色が変わ/.test(t)) {
      var shrimpCue = '全体が赤っぽいピンク色になり、身がくるっと丸まったら';
      if (P && P.id === 'shrimp') add(shrimpCue);
      else if (/えび/.test(t) && P && P.cat === 'meat') { add('肉のピンク色の部分がなくなり、全体の色が変わったら'); add(shrimpCue); }
      else if (/えび/.test(t)) add(shrimpCue);
      else if (P && P.cat === 'fish') add('表面が白っぽく、不透明になったら');
      else if (P && (P.id === 'wiener' || P.id === 'bacon')) add('表面に焼き色がついて、ふっくらしたら');
      else add('ピンク色の部分がなくなり、全体の色が変わったら');
    }
    if (/照り/.test(t)) add('たれが細かく泡立って、とろりとつやが出たら');
    if (/汁気がなくなる/.test(t)) add('フライパンの底に汁がほとんど残っていないくらい');
    if (/とろみ/.test(t)) add('混ぜたとき、へらの跡が一瞬残るくらいのとろみ');
    if (/粉っぽさ/.test(t)) add('粉が見えなくなって、バターとなじんでぽってりしたら');
    if (/溶き卵を細く回し入れ/.test(t)) add('卵がふわっと浮いて、白っぽく固まったら火を止める');
    else if (/卵.{0,8}回し入れ/.test(t)) add('卵のふちが固まって、真ん中がまだとろっとしているくらい');
    else if (/半熟/.test(t)) add('ふちが固まって、表面がまだとろっとしているくらい');
    if (/みそ.{0,20}溶き入れ/.test(t)) add('小さな泡がふつふつ出るくらいで火を弱め、ぐらぐら煮立たせない');
    else if (/煮立たせ|煮立てない|煮立てず/.test(t)) add('ふつふつと小さな泡が出るくらいを保ち、ぐらぐら煮立たせない');
    else if (/煮立/.test(t)) add('鍋のふちから大きな泡がぐつぐつ出てきたら「煮立った」合図');
    if (/アク/.test(t)) add('表面に浮いてくる灰色の泡を、お玉ですくって捨てる');
    if (/しんなり/.test(t)) add('かさが減って、少しやわらかくなったら');
    if (/香りが出る/.test(t)) add('にんにく・しょうがのいい香りがしてきたら（焦がさない）');
    if (/蒸し焼き/.test(t)) add('蓋のすき間から湯気が出ていれば、ちゃんと蒸せています');
    if (/ゆで/.test(t)) { if (LEAFY_RE.test(t)) add('葉の色が鮮やかな緑になったらOK'); else if (GREEN_RE.test(t)) add('色が鮮やかな緑になり、少しやわらかくなったらOK'); }
    if (/水気をしっかりしぼ|水気をしぼ/.test(t)) add('両手でぎゅっと握って、水がほとんど落ちなくなるまで');
    if (/絡める|絡め、|炒め合わせ/.test(t)) add('たれが全体に行きわたって、つやが出たら火を止める合図');
    else if (/炒め/.test(t) && VEG_RE && VEG_RE.test(t)) add('野菜の色が鮮やかになって、少ししんなりしたら次へ');
    if (/味見/.test(t)) add('スプーンで少し取り、ふーっと冷ましてから味をみる（熱いままだと薄く感じます）');
    if (/600Wで/.test(t)) add('竹串や箸がすっと通ればOK。ラップは蒸気でやけどしないよう、奥側から外す');
    if (/卵液を少し落として/.test(t)) add('卵液が「ジュッ」と音を立ててすぐ固まれば、ちょうどいい温度');
    else if (/ジュッ/.test(t)) add('「ジュッ」と音がすれば、ちょうどいい温度');
    return out;
  }
  function addCues(steps, c) { steps.forEach(function (st) { if (!st.cues || !st.cues.length) st.cues = cueFor(st.t, c); }); return steps; }
  E.cueFor = cueFor;

  // ---------- 定番レシピを作る ----------
  var NAME_ALT = { c_kinpira: { renkon: 'れんこんのきんぴら' }, c_chinjao: { beef_koma: 'チンジャオロース（牛肉）' } };
  var EXP = { food: 1, season: 0.95, ni: 0.9, liq: 0.75, liq2: 0.9, soupliq: 0.95, aroma: 0.85, oil: 0.5, coat: 1, fry: 0.3, count: 1 };
  function buildClassic(C, ctx) {
    var F = factor(ctx.people); var people = ctx.people || { adult: 2 };
    var baseF = C.baseF || 2; var r = F / baseF;
    var inv = toSet(ctx.inventory); var omakase = ctx.mode === 'omakase';
    var pantry = (ctx.prefs && ctx.prefs.pantry) || null;
    var kids = hasKids(people);
    var pr = ctx.prefs || {}; var tastes = pr.tastes || {};
    var saltAdj = (pr.saltLevel === 'light' ? 0.85 : 1) * (kids && tastes.kidMild !== false ? 0.93 : 1);
    var tokens = {}; var names = {};
    var ingOut = [], uses = [], buys = [], ids = [];
    var extraSalt = 0;
    C.ing.forEach(function (line) {
      var id = line.id, swapped = false;
      if (!omakase && !inv[id] && line.alt) { for (var i = 0; i < line.alt.length; i++) if (inv[line.alt[i]]) { id = line.alt[i]; swapped = true; break; } }
      var it = ING[id];
      var g = line.g * r;
      if (line.k === 'count' || (it.unit && it.unit.piece && it.cat !== 'fish')) { var n = Math.max(1, Math.round(g / it.unit.g)); g = n * it.unit.g; }
      if (it.cat === 'fish' && it.unit) g = Math.max(1, Math.ceil(F * (line.g / it.unit.g) / baseF - 0.25)) * it.unit.g;
      var a = ingAmount(id, g);
      var have = !!inv[id];
      var buy = !omakase && !have && !line.opt && !line.staple;
      if (have) uses.push(id);
      if (buy) buys.push(it.name);
      if (it.salt) extraSalt += a.g * it.salt;
      if (id === 'ham' || id === 'wiener' || id === 'bacon') extraSalt += a.g * 0.025;
      ids.push(id);
      names[line.id] = it.name; // 切り方の表示名（代わりの食材ならその名前）
      var note = line.note || '';
      if (swapped) note = (note ? note + '・' : '') + '元のレシピは' + ING[line.id].name;
      if (line.opt && !omakase && !have) note = (note ? note + '・' : '') + 'あれば';
      if (line.staple) note = (note ? note + '・' : '') + '家にあるもの';
      var hn2 = !omakase && have ? haveNote(ctx, id, a.g) : '';
      if (hn2) note = (note ? note + '・' : '') + hn2;
      tokens[line.id] = it.name.replace(/（.*?）/g, '') + a.text;
      ingOut.push({ id: id, name: it.name, amount: a.text, g: a.g, buy: buy, opt: !!line.opt, note: note, staple: !!line.staple, short: !!hn2 });
    });
    var seaOut = []; var salt = 0, saltAdult = 0;
    C.sea.forEach(function (line) {
      var sid = line.ref || line.id; var se = SEA[sid];
      var k = line.k || 'season';
      var tsp = line.tsp != null ? line.tsp * Math.pow(r, EXP[k] == null ? 0.95 : EXP[k]) : 0;
      if (k !== 'oil' && k !== 'fry' && k !== 'liq' && k !== 'liq2' && k !== 'soupliq' && k !== 'food' && (se.salt || 0) > 0) tsp *= saltAdj;
      var adult = line.adult && kids;
      if (adult) tsp *= adultShare(people);
      var a = seaAmount(sid, tsp, { pinch: line.pinch });
      if (adult) saltAdult += a.salt; else salt += a.salt * (line.keep != null ? line.keep : 1);
      var missing = !!(pantry && pantry.indexOf(sid) < 0 && !se.hidden);
      var label = adult ? '大人の分だけ' : (line.opt ? 'お好みで' : '');
      tokens[line.id] = se.name.replace(/（.*?）/g, '') + a.text + (adult ? '（大人の分だけ）' : '');
      seaOut.push({ id: sid, name: se.name, amount: a.text, g: a.g, tsp: a.tsp, label: label, adult: !!adult, missing: missing && !line.opt && !line.adult, optional: !!(line.opt || line.adult), group: '' });
    });
    var mix = {};
    Object.keys(C.mix || {}).forEach(function (gk) {
      mix[gk] = C.mix[gk].map(function (lid) { var l = C.sea.filter(function (x) { return x.id === lid; })[0]; return l ? (l.ref || l.id) : lid; });
      tokens[gk] = gk === 'B' && C.mix[gk].indexOf('katakuri') >= 0 ? '水溶き片栗粉B' : '合わせ調味料' + gk;
      C.mix[gk].forEach(function (lid) { var idx = C.sea.map(function (x) { return x.id; }).indexOf(lid); if (idx >= 0) seaOut[idx].group = gk; });
    });
    var swaps = [], swapMap = {};
    var GENERIC = { pork: '豚肉', chicken: '鶏肉', beef: '牛肉' };
    C.ing.forEach(function (line, i) {
      var used = ingOut[i].id; if (used === line.id) return;
      swapMap[line.id] = used;
      swaps.push([ING[line.id].name.replace(/（.*?）/g, ''), short(used)], [short(line.id), short(used)]);
      var fo = family(line.id), fu = family(used);
      if (fo !== fu && GENERIC[fo]) swaps.push([GENERIC[fo], GENERIC[fu] || short(used)]);
    });
    var esc = function (x) { return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
    var RISKY = { 'たら': 1, 'さば': 1, 'ぶり': 1, 'かぶ': 1, 'なす': 1 }; // ほかの言葉の一部になりやすい名前
    var swapText = function (t) {
      if (!t) return t;
      swaps.forEach(function (sw) {
        if (!sw[0] || sw[0] === sw[1]) return;
        if (RISKY[sw[0]]) t = t.replace(new RegExp('(^|[^ぁ-ゖ]|[にをとのはでがもへた])' + esc(sw[0]) + '(?=[にをのとはがも・、）でへ]|$)', 'g'), '$1' + sw[1]);
        else t = t.split(sw[0]).join(sw[1]);
      });
      return t;
    };
    var fill = function (t) { return swapText(t.replace(/\{([^}]+)\}/g, function (all, k) { if (k === 'min') return all; return tokens[k] != null ? tokens[k] : ''; })); };
    var prep = (C.prep || []).map(fill);
    Object.keys(C.mix || {}).forEach(function (gk) {
      var txt = C.mix[gk].map(function (lid) { return tokens[lid]; }).join('・');
      prep.push((tokens[gk]) + '：' + txt + 'を混ぜておく');
    });
    var cuts = (C.cuts || []).map(function (c) {
      var idx = C.ing.map(function (x) { return x.id; }).indexOf(c.id); var used = idx >= 0 ? ingOut[idx].id : c.id;
      var how = fill(c.how);
      if (used !== c.id && c.alt && c.alt[used]) how = fill(c.alt[used]);
      else if (used !== c.id && !/\{/.test(c.how) && ING[c.id].role !== 'protein') {
        // 野菜を差し替えたときは、その野菜に合った切り方にする（材料にない粉の話は消す）
        var d = methodData(used, C.method === 'sitame' ? 'sitame' : C.method) || methodData(used, 'itame');
        if (d && d.cut) how = d.cut.replace(/(にして)?、?片栗粉を薄くまぶす/, '');
      }
      return { id: used, name: names[c.id] || (ING[c.id] && ING[c.id].name) || c.id, how: how };
    });
    var usedIds = ingOut.map(function (x) { return x.id; });
    var skinless = Object.keys(swapMap).some(function (k) { var nu = swapMap[k]; var cut = (C.cuts || []).filter(function (c) { return c.id === k; })[0]; var how = cut && cut.alt && cut.alt[nu] ? cut.alt[nu] : ''; return /皮を取/.test(how); });
    var st = C.steps.map(function (s0) {
      var s = s0;
      if (s0.alt) Object.keys(s0.alt).forEach(function (k) { if (usedIds.indexOf(k) >= 0 && Object.keys(swapMap).some(function (o) { return swapMap[o] === k; })) { s = {}; Object.keys(s0).forEach(function (kk) { s[kk] = s0[kk]; }); Object.keys(s0.alt[k]).forEach(function (kk) { s[kk] = s0.alt[k][kk]; }); } });
      var min = s.min || 0;
      if (s.minK === 'micro') min = Math.max(1, Math.round(min * r * 2) / 2);
      var t = fill(s.t).replace('{min}', fmtMin(min));
      if (s.minK === 'micro' && min > 8) t += '。量が多いときは2回に分けて、1回あたり約' + fmtMin(Math.round(min / 2 * 2) / 2) + 'ずつ加熱します';
      if (skinless) t = t.replace(/皮を広げて皮目から/g, '').replace(/皮目を下にして/g, '').replace(/皮目から/g, '');
      return { t: t, heat: s.heat || '', min: min, wait: !!s.wait, cues: s.cue ? [s.cue] : null };
    });
    if (kids === false) st = st.filter(function (s) { return !/子どもの分を(器に)?取り分け/.test(s.t) || /大人の分/.test(s.t); }).map(function (s) { return { t: s.t.replace(/子どもの分を(器に)?取り分ける。大人の分はフライパンに残して/, '').replace(/子どもの分を取り分ける。大人の分に/, '').replace(/子どもの分を取り分けてから、大人の分に/, ''), heat: s.heat, min: s.min, wait: s.wait }; });
    var pit = (C.pit || []).map(swapText);
    if (r > 2.2 && (C.method === 'itame' || C.method === 'yaki')) pit.push('量が多いので、フライパンに入りきらないときは2回に分けて焼きます');
    var kidL = (C.kid || []).slice();
    if (kids && saltAdj < 1) kidL.push('子どもに合わせて調味料を少し控えめにしています。大人の分は、取り分けたあとに少し足してください');
    var tags = [];
    seaOut.forEach(function (s) { var se = SEA[s.id]; if (se.tags && !s.optional) tags = tags.concat(se.tags); });
    if (C.spicy) tags.push('spicy');
    var subs = (C.subs || []).slice();
    seaOut.forEach(function (s) { if (s.missing && SEA_SUBS[s.id] && !subs.some(function (x) { return x.from.indexOf(s.name.replace(/（.*?）/g, '')) >= 0; })) subs.push({ from: s.name, to: SEA_SUBS[s.id] }); });
    var mainVeg = null;
    // 牛乳など、調味料の欄にあるけれど冷蔵庫に入っているもの
    C.sea.forEach(function (line) { var sid = line.ref || line.id; if (ING[sid] && inv[sid] && uses.indexOf(sid) < 0) uses.push(sid); });
    // 主役を代わりの食材にしたら、料理名も合わせる
    var dishName = C.name;
    var firstLine = C.ing[0], firstUsed = ingOut[0] && ingOut[0].id;
    if (firstUsed && firstUsed !== firstLine.id) {
      var ov = (NAME_ALT[C.id] || {})[firstUsed];
      if (ov) dishName = ov;
      else {
        var from = [ING[firstLine.id].name.replace(/（.*?）/g, ''), short(firstLine.id)];
        for (var fi = 0; fi < from.length; fi++) if (dishName.indexOf(from[fi]) >= 0) { dishName = dishName.replace(from[fi], short(firstUsed)); break; }
      }
    }
    return {
      key: 'classic|' + C.id, kind: 'classic', classicId: C.id, slot: C.slot, method: C.method, name: dishName, label: '定番の作り方',
      genre: C.genre, base: C.base, amakara: !!C.amakara, spicy: !!C.spicy, don: !!C.don, minutes: C.minutes,
      desc: (function () { var alt = null; Object.keys(swapMap).forEach(function (k) { if (C.descAlt && C.descAlt[swapMap[k]]) alt = C.descAlt[swapMap[k]]; }); return alt || swapText(C.desc); })(),
      plate: { dish: C.plate.dish, items: C.plate.items.map(function (id) { return swapMap[id] || id; }), glaze: C.plate.glaze, shape: C.plate.shape, genre: C.genre },
      ingredients: ingOut, seasonings: seaOut, mix: mix, prep: prep, cuts: cuts, steps: addCues(st, { prot: ingOut[0] && ingOut[0].id }), pit: pit, tip: (C.tip || []).map(swapText), kid: kidL.map(swapText), subs: subs, desc2: null,
      saltPerAdult: (salt + extraSalt) / F + saltAdult / Math.max(1, people.adult || 1), ids: ids, tags: uniq(tags), mainVeg: mainVeg,
      mainId: C.ing[0].id, uses: uses, buys: buys
    };
  }
  E.buildClassic = function (id, ctx) { return CLASSIC[id] ? buildClassic(CLASSIC[id], ctx) : null; };

  // ---------- わが家のレシピ（登録したもの） ----------
  function parseNum(s) {
    if (/と/.test(s)) { var p = s.split('と'); return parseNum(p[0]) + parseNum(p[1]); }
    if (/\//.test(s)) { var q = s.split('/'); return parseFloat(q[0]) / parseFloat(q[1]); }
    return parseFloat(s);
  }
  // 1行の中の分量をすべて人数に合わせて直す（「1枚（250g）」なら両方）
  function scaleLine(text, r) {
    var t = String(text || '').replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).replace(/／/g, '/').replace(/．/g, '.')
      .replace(/[ｇｍｌｃｋ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
    if (Math.abs(r - 1) < 0.01) return { text: t, scaled: false };
    var isEgg = /卵|たまご|玉子/.test(t);
    var any = false;
    t = t.replace(/(大さじ|小さじ)\s*([0-9]+と[0-9]+\/[0-9]+|[0-9]+\/[0-9]+|[0-9]+(?:\.[0-9]+)?)/g, function (all, u, num) {
      any = true; var tsp = parseNum(num) * (u === '大さじ' ? 3 : 1) * Math.pow(r, 0.95);
      return spoonText(tsp, null).t + '​';
    });
    t = t.replace(/([0-9]+と[0-9]+\/[0-9]+|[0-9]+\/[0-9]+|[0-9]+(?:\.[0-9]+)?)\s*(g|グラム|kg|ml|cc|個|本|枚|切れ|丁|束|袋|パック|かけ|株|房|カップ|合|cm)(?!​)/g, function (all, num, u) {
      any = true; var n = parseNum(num) * r, nt;
      if (/^(g|グラム|ml|cc)$/.test(u)) nt = String(n >= 30 ? round(n, 10) : Math.max(5, round(n, 5)));
      else if (u === 'kg') nt = String(Math.round(n * 10) / 10);
      else if (isEgg && u === '個') nt = String(Math.max(1, Math.round(n)));
      else nt = halfText(Math.max(0.5, Math.round(n * 2) / 2)) || '1/2';
      return nt + u;
    });
    return { text: t.replace(/​/g, ''), scaled: any };
  }
  E.scaleLine = scaleLine;
  function detectTags(text) {
    var tags = [];
    if (/ポン酢|ぽん酢|ぽんず/.test(text)) tags.push('ponzu', 'sour');
    if (/(^|[^ぽポ])酢|ビネガー|甘酢|すし酢/.test(text)) tags.push('vinegar', 'sour');
    if (/豆板醤|一味|七味|唐辛子|とうがらし|ラー油|コチュジャン/.test(text)) tags.push('spicy');
    if (/トマト缶|ホールトマト|トマトソース/.test(text)) tags.push('tomatoMain', 'tomato');
    if (/ケチャップ/.test(text)) tags.push('tomato');
    return uniq(tags);
  }
  function buildUser(U, ctx) {
    var F = factor(ctx.people); var r = F / (U.serves || 2);
    var inv = toSet(ctx.inventory); var omakase = ctx.mode === 'omakase';
    var ids = [];
    var ingOut = (U.ingredients || []).filter(function (l) { return String(l).trim(); }).map(function (l) {
      var id = E.match(String(l).split(/[\s　:：]/)[0]) || E.match(l);
      if (id) ids.push(id);
      var sc = scaleLine(l, r);
      return { id: id, name: sc.text, amount: '', buy: !omakase && id && ING[id] && ING[id].role !== 'item' && !inv[id] && ING[id].cat !== 'item', raw: true };
    });
    var all = (U.ingredients || []).join(' ') + ' ' + (U.steps || []).join(' ');
    var tags = detectTags(all);
    var anyScaled = Math.abs(r - 1) > 0.01;
    return {
      key: 'user|' + U.id, kind: 'user', userId: U.id, slot: U.slot || 'main', method: 'user', name: U.name, label: 'わが家のレシピ',
      genre: U.genre || '', base: 'user_' + U.id, amakara: false, spicy: tags.indexOf('spicy') >= 0, minutes: U.minutes || 0, desc: '', text: all,
      plate: { dish: U.slot === 'soup' ? 'bowl' : U.slot === 'side' ? 'small' : 'plate', items: ids, glaze: '#c9a26b' },
      ingredients: ingOut, seasonings: [], mix: {}, prep: [], cuts: [],
      steps: (U.steps || []).filter(function (s) { return String(s).trim(); }).map(function (s) { var mm = String(s).match(/([0-9]+(?:\.[0-9]+)?)\s*分/); return { t: s, heat: (String(s).match(/強めの中火|弱めの中火|中火|弱火|強火/) || [''])[0], min: mm ? parseFloat(mm[1]) : 0 }; }),
      pit: [], tip: U.memo ? [U.memo] : [], kid: [], subs: [],
      note: anyScaled ? '材料の分量は、登録したときの' + (U.serves || 2) + '人分から計算し直しています。手順の中に書いた分量は登録したときのままです' : '',
      saltPerAdult: null, ids: uniq(ids), tags: tags, mainVeg: null, mainId: ids[0] || null,
      uses: uniq(ids.filter(function (id) { return inv[id]; })), buys: []
    };
  }
  E.buildUser = function (U, ctx) { return buildUser(U, ctx); };

  // ChatGPTなどの答えを貼り付けたときに、材料と手順を取り出す
  E.parsePasted = function (text) {
    var lines = String(text || '').split(/\r?\n/).map(function (l) { return l.replace(/^[\s・\-*●○◯■□#\d.)）]+/, '').replace(/\*\*/g, '').trim(); });
    var raw = String(text || '').split(/\r?\n/);
    var name = '', ing = [], st = [], memo = [], mode = '';
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i]; var r0 = raw[i];
      if (!l) continue;
      if (/^(材料|食材)/.test(l)) { mode = 'ing'; continue; }
      if (/^(調味料|合わせ調味料|たれ|A[：:]?$)/.test(l)) { mode = 'ing'; continue; }
      if (/^(作り方|手順|調理手順|つくり方)/.test(l)) { mode = 'step'; continue; }
      if (/^(コツ|ポイント|失敗しやすい|おいしく|子ども|代用|完成イメージ|下ごしらえ|切り方)/.test(l)) { mode = 'memo'; memo.push(l); continue; }
      if (!name && /^(料理名|【|#)/.test(r0.trim())) { name = l.replace(/^料理名[：:]\s*/, '').replace(/[【】]/g, '').replace(/[（(][0-9０-９]+\s*人分[）)]/g, '').trim(); continue; }
      if (!name && !mode && l.length <= 30) { name = l.replace(/[（(][0-9０-９]+\s*人分[）)]/g, '').trim(); continue; }
      if (mode === 'ing') ing.push(l);
      else if (mode === 'step') st.push(l);
      else if (mode === 'memo') memo.push(l);
    }
    var serves = 2; var sm = String(text).match(/([0-9]+)\s*人分/); if (sm) serves = parseInt(sm[1], 10);
    return { name: name, ingredients: ing, steps: st, memo: memo.join('\n'), serves: serves };
  };

  // ---------- 献立を考える ----------
  function family(id) {
    if (!id) return null;
    if (/^pork|^mince/.test(id)) return 'pork';
    if (/^chicken|sasami/.test(id)) return 'chicken';
    if (/^tofu|atsuage/.test(id)) return 'tofu';
    if (ING[id] && ING[id].cat === 'fish') return 'fish';
    if (id === 'egg') return 'egg';
    if (id === 'beef_koma') return 'beef';
    if (id === 'wiener' || id === 'bacon') return 'processed';
    return null;
  }
  function toSet(arr) { var s = {}; (arr || []).forEach(function (x) { s[x] = 1; }); return s; }
  function subsets(arr, maxK) {
    var out = [];
    var n = Math.min(arr.length, 10);
    for (var mask = 1; mask < (1 << n); mask++) {
      var c = []; for (var i = 0; i < n; i++) if (mask & (1 << i)) c.push(arr[i]);
      if (c.length <= maxK) out.push(c);
    }
    return out;
  }
  function daysAgo(dateStr, today) { var a = new Date(dateStr + 'T00:00:00'), b = new Date(today + 'T00:00:00'); return Math.round((b - a) / 86400000); }

  function historyScore(info, key, ctx) {
    var h = ctx.history || []; var today = ctx.today || new Date().toISOString().slice(0, 10);
    var s = 0, block = false;
    h.forEach(function (x0) {
      var x = x0;
      if (x0.manual && x0.mainId && info.mainId && x0.mainId !== info.mainId && family(x0.mainId) && family(x0.mainId) === family(info.mainId)) { x = {}; Object.keys(x0).forEach(function (k) { x[k] = x0[k]; }); x.mainId = info.mainId; }
      var d = daysAgo(x.date, today); if (d < 0) d = 0;
      if (x.manual) x = (function () { var y = {}; Object.keys(x).forEach(function (k) { y[k] = x[k]; }); y.rating = null; return y; })();
      if (x.rating === 'bad') { if (x.key === key) block = true; if (x.base && x.base === info.base) s -= 4; if (x.mainId && x.mainId === info.mainId && x.base === info.base) s -= 10; }
      if (x.rating === 'good') { if (x.key === key) s += 10; else if (x.base === info.base) s += 2; }
      if (x.rating === 'ok' && x.key === key) s += 1;
      if (d <= 7) {
        if (x.key === key) s -= 40;
        if (x.mainId && x.mainId === info.mainId && x.base === info.base) s -= 25;
        if (d <= 3 && x.base === info.base) s -= 8;
        if (d <= 3 && x.base === 'fried' && info.fried) s -= 8;
        if (d <= 3 && x.mainId && x.mainId === info.mainId) s -= 6;
        if (d <= 3 && info.amakara && x.amakara && (ctx.prefs && ctx.prefs.tastes && ctx.prefs.tastes.amakaraLimit)) s -= 6;
      }
    });
    return { s: s, block: block };
  }

  function candidates(slot, ctx, R) {
    var inv = ctx.inventory || []; var invSet = toSet(inv); var star = toSet(ctx.starred || []);
    var omakase = ctx.mode === 'omakase';
    var pantry = (ctx.prefs && ctx.prefs.pantry) || null;
    var out = [];
    var invProt = inv.filter(function (id) { return ING[id] && ING[id].role === 'protein'; });
    var invVeg = inv.filter(function (id) { return ING[id] && ING[id].role === 'veg'; });
    var invExtra = inv.filter(function (id) { return ING[id] && (ING[id].role === 'extra'); });
    var protPool, vegPool;
    if (omakase) {
      protPool = COMMON_PROT.slice(); vegPool = COMMON_VEG.slice();
      // 毎回同じにならないよう、野菜の候補を絞って混ぜる
      vegPool.sort(function () { return R() - 0.5; }); vegPool = vegPool.slice(0, 9);
    } else {
      protPool = invProt.length ? invProt.slice() : [];
      vegPool = invVeg.slice();
    }
    var buyProt = omakase ? [] : COMMON_PROT.slice(0, 7).filter(function (p) { return !invSet[p]; });
    var buyVeg = omakase ? [] : ['onion', 'cabbage', 'moyashi', 'negi', 'carrot', 'shimeji'].filter(function (v) { return !invSet[v]; });
    var buySide = omakase ? [] : ['spinach', 'komatsuna', 'broccoli', 'cabbage', 'moyashi', 'carrot', 'cucumber'].filter(function (v) { return !invSet[v]; });

    var exactCache = {};
    function scoreSpec(spec) {
      var info = specInfo(spec, ctx);
      info.mainId = spec.prot || (spec.veg || [])[0];
      // 時間で絞るときは、境目あたりの料理だけ実際に組み立てて時間を確かめる
      if (ctx.maxMin && info.minutes >= ctx.maxMin - 5 && info.minutes <= ctx.maxMin + 10) {
        var kk = E.specKey(spec);
        if (exactCache[kk] == null) { var bb = buildCombo(spec, ctx); exactCache[kk] = bb ? bb.minutes : info.minutes; }
        info.minutes = exactCache[kk];
      }
      var reason = excludedReason(info, ctx); if (reason) return null;
      var key = E.specKey(spec);
      var hs = historyScore(info, key, ctx); if (hs.block) return null;
      var s = 0, used = [], buys = [];
      var Fp = factor(ctx.people);
      var needOf = function (id) {
        if (id === spec.prot) return protGrams(id, Fp, spec.slot);
        if ((spec.extra || []).indexOf(id) >= 0) return extraGrams(id, Fp, spec.slot);
        var tot = spec.slot === 'main' ? (VEG_Q[spec.method] || 100) * Fp : spec.slot === 'side' ? SIDE_Q * Fp : SOUP_SOLID * Fp * 0.6;
        return tot / Math.max(1, (spec.veg || []).length);
      };
      info.ids.forEach(function (id) {
        if (invSet[id]) {
          used.push(id);
          var have = ctx.amounts && ctx.amounts[id];
          var low = have != null && have < needOf(id) * 0.5; // 手持ちが必要量の半分もないときは、加点を小さく
          s += (low ? 3 : 12) + (star[id] ? 10 : 0) - (low ? 4 : 0);
        } else if (!omakase) { buys.push(id); s -= (ING[id].role === 'protein' ? 14 : 9); }
      });
      s -= info.missingSea.length * 3;
      if (spec.slot === 'soup' && info.ids.filter(function (id) { return id !== 'aonegi'; }).length >= 2) s += 3;
      s += hs.s;
      s += R() * 6;
      return { kind: 'combo', spec: spec, key: key, s: s, used: used, buys: buys, info: info };
    }

    SAUCES.forEach(function (S) {
      if (S.slot !== slot) return;
      S.methods.forEach(function (m) {
        if (slot === 'main') {
          var prots = (protPool.length ? protPool : buyProt).filter(function (p) { return S.prot.indexOf(p) >= 0 && methodData(p, m); });
          prots.forEach(function (p) {
            var vegOk;
            if (m === 'yaki') vegOk = vegPool.filter(function (v) { return (ING[v].raw && ['cabbage', 'lettuce', 'mizuna', 'tomato', 'cucumber'].indexOf(v) >= 0) || ['piman', 'paprika', 'negi', 'shiitake', 'eringi', 'maitake', 'shimeji', 'asparagus', 'ingen', 'broccoli', 'zucchini', 'kabocha', 'eggplant', 'onion'].indexOf(v) >= 0; });
            else vegOk = vegPool.filter(function (v) { return (S.veg || []).indexOf(v) >= 0 && methodData(v, m); });
            var sets;
            if (m === 'yaki') { sets = [[]].concat(subsets(vegOk, 2)); }
            else if (vegOk.length) sets = subsets(vegOk, 3);
            else sets = buyVeg.filter(function (v) { return (S.veg || []).indexOf(v) >= 0 && methodData(v, m); }).slice(0, 2).map(function (v) { return [v]; });
            if (omakase) sets = sets.filter(function (x) { return x.length <= 2; }).sort(function () { return R() - 0.5; }).slice(0, 4);
            sets = sets.filter(function (vs) { return m === 'yaki' || !(vs.length === 1 && SIDEKICK[vs[0]]) && !vs.every(function (v) { return SIDEKICK[v]; }); });
            sets.forEach(function (vs) {
              var extra = [];
              if (m === 'ni' && S.id === 'dashi_ni' && p !== 'egg' && invSet.egg && !omakase) extra.push('egg');
              if ((S.extra || []).indexOf('aburaage') >= 0 && invSet.aburaage && m === 'ni') extra.push('aburaage');
              var c = scoreSpec({ slot: 'main', sauce: S.id, method: m, prot: p, veg: vs, extra: extra });
              if (c) out.push(c);
              if (extra.length) { var c2 = scoreSpec({ slot: 'main', sauce: S.id, method: m, prot: p, veg: vs, extra: [] }); if (c2) out.push(c2); }
            });
          });
        } else if (slot === 'side') {
          var pool = omakase ? COMMON_VEG.slice() : invVeg;
          var vOk = pool.filter(function (v) { return (S.veg || []).indexOf(v) >= 0 && methodData(v, m); });
          var sets2 = vOk.length ? subsets(vOk, 2) : buySide.filter(function (v) { return (S.veg || []).indexOf(v) >= 0 && methodData(v, m); }).slice(0, 2).map(function (v) { return [v]; });
          if (omakase) sets2 = sets2.sort(function () { return R() - 0.5; }).slice(0, 4);
          var ex = (S.extra || []).filter(function (x) { return invSet[x] && methodData(x, m === 'nibitashi' ? 'nibitashi' : m === 'sitame' ? 'sitame' : 'ae'); });
          sets2.forEach(function (vs) {
            var c = scoreSpec({ slot: 'side', sauce: S.id, method: m, prot: null, veg: vs, extra: [] }); if (c) out.push(c);
            ex.forEach(function (x) { var c3 = scoreSpec({ slot: 'side', sauce: S.id, method: m, prot: null, veg: vs, extra: [x] }); if (c3) out.push(c3); });
          });
        } else if (slot === 'soup') {
          var sp = (omakase ? ['tofu_kinu', 'tofu_momen', 'egg', 'wiener'] : invProt).filter(function (p) { return (S.prot || []).indexOf(p) >= 0; });
          var sv = (omakase ? COMMON_VEG.slice().concat(['negi', 'enoki']) : invVeg).filter(function (v) { return (S.veg || []).indexOf(v) >= 0 && methodData(v, 'soup'); });
          var sx = (omakase ? ['wakame', 'aonegi', 'aburaage', 'corn'] : invExtra).filter(function (x) { return (S.extra || []).indexOf(x) >= 0; });
          var setsV = [[]].concat(subsets(sv, 2));
          var protOpts = [null].concat(sp);
          var tries = [];
          protOpts.forEach(function (p) { setsV.forEach(function (vs) { if (!p && !vs.length && !sx.length) return; tries.push({ p: p, vs: vs }); }); });
          if (!tries.length && !omakase) {
            var fallback = { miso_soup: { p: 'tofu_momen', vs: ['negi'] }, sumashi: { p: 'egg', vs: [] }, chuka_soup: { p: 'egg', vs: ['negi'] }, consomme_soup: { p: null, vs: ['onion'] } }[S.id];
            if (fallback) tries.push(fallback);
          }
          if (omakase) tries = tries.sort(function () { return R() - 0.5; }).slice(0, 6);
          tries = tries.filter(function (t) { return !(t.p && ING[t.p].cat === 'meat' && !t.vs.length); });
          tries.forEach(function (t) {
            var ex2 = sx.filter(function (x) { return !(x === 'aonegi' && t.vs.indexOf('negi') >= 0); }).slice(0, 2);
            if (t.p === 'egg') ex2 = ex2.filter(function (x) { return x !== 'aburaage'; });
            var c = scoreSpec({ slot: 'soup', sauce: S.id, method: 'soup', prot: t.p, veg: t.vs, extra: ex2 }); if (c) out.push(c);
          });
        }
      });
    });

    // 定番
    CLASSICS.forEach(function (C) {
      if (C.slot !== slot) return;
      var rc = buildClassic(C, ctx);
      var info = recipeInfo(rc); info.base = rc.base; info.mainId = rc.mainId; info.genre = rc.genre; info.fried = !!C.fried;
      if (excludedReason(info, ctx)) return;
      var hs = historyScore(info, rc.key, ctx); if (hs.block) return;
      var s = 0;
      rc.uses.forEach(function (id) { s += 12 + (star[id] ? 10 : 0); });
      rc.ingredients.forEach(function (i) {
        var have = ctx.amounts && i.id && ctx.amounts[i.id];
        if (have == null || !i.g) return;
        if (have < i.g * 0.5) s -= 13; else if (have < i.g * 0.7) s -= 4; // 組み合わせ提案と同じ考え方
      });
      s -= rc.buys.length * 11;
      s -= rc.seasonings.filter(function (x) { return x.missing; }).length * 3;
      s += omakase ? 4 : 4;
      if (!omakase && rc.uses.length === 0) s -= 30;
      s += hs.s + R() * 6;
      out.push({ kind: 'classic', key: rc.key, s: s, used: rc.uses, buys: rc.buys, info: info, recipe: rc });
    });
    // わが家のレシピ
    (ctx.userRecipes || []).forEach(function (U) {
      if ((U.slot || 'main') !== slot) return;
      var ru = buildUser(U, ctx);
      var info = recipeInfo(ru); info.base = ru.base; info.mainId = ru.mainId; info.genre = ru.genre;
      if (excludedReason(info, ctx)) return;
      var hs = historyScore(info, ru.key, ctx); if (hs.block) return;
      var s = 6;
      ru.uses.forEach(function (id) { s += 12 + (star[id] ? 10 : 0); });
      if (!omakase && ru.uses.length === 0) s -= 30;
      s += hs.s + R() * 6;
      out.push({ kind: 'user', key: ru.key, s: s, used: ru.uses, buys: [], info: info, recipe: ru });
    });
    out.sort(function (a, b) { return b.s - a.s; });
    return out;
  }

  function materialize(c, ctx) {
    if (c.recipe) return c.recipe;
    return buildCombo(c.spec, ctx);
  }

  // 献立を3案まで返す
  E.suggest = function (ctx) {
    ctx = ctx || {};
    var R = rng(ctx.seed != null ? ctx.seed : Date.now());
    var style = ctx.style || 'full';
    var mains = candidates('main', ctx, R);
    var sides = style === 'full' || style === 'main_side' ? candidates('side', ctx, R) : [];
    var soups = style === 'full' || style === 'main_soup' ? candidates('soup', ctx, R) : [];
    var amLimit = ctx.prefs && ctx.prefs.tastes && ctx.prefs.tastes.amakaraLimit;
    var topMains = mains.slice(0, 40);
    var usedKeys = {}, usedProt = {}, usedSauce = {}, usedVeg = {};
    var sauceOf = function (c) { return c.kind === 'combo' ? c.spec.sauce : c.key; };
    var vegMain = function (c) { return c.info.mainVeg || ((c.info.ids || []).filter(function (id) { return ING[id] && ING[id].role === 'veg'; })[0]); };
    var picked = [];
    // 1案ずつ決める。前の案で使った副菜・汁物・主役はなるべく使わない
    for (var round3 = 0; round3 < 3; round3++) {
      var bestMenu = null;
      topMains.forEach(function (mc) {
        if (usedKeys[mc.key]) return;
        var usedSet = toSet(mc.used);
        var menu = { s: mc.s - (usedProt[family(mc.info.mainId) || mc.info.mainId] ? 15 : 0) - (usedVeg[vegMain(mc)] ? 10 : 0) - (usedSauce[sauceOf(mc)] ? 8 : 0), main: mc, side: null, soup: null };
        var pick = function (list, other) {
          var b = null;
          for (var i = 0; i < list.length && i < 300; i++) {
            var c = list[i]; var s = c.s;
            var newUse = c.used.filter(function (id) { return !usedSet[id]; }).length;
            s -= (c.used.length - newUse) * 12; // すでに使った食材の分は加点しない
            // 同じ野菜が何品にも入ると飽きるので、主菜・副菜・汁物で重なる野菜は少し減点
            var vegOf = function (x) { return (x.info.ids || []).filter(function (id) { return ING[id] && ING[id].role === 'veg'; }); };
            var cv = vegOf(c); [mc].concat(other).forEach(function (o) { if (!o) return; var ov = vegOf(o); cv.forEach(function (id) { if (ov.indexOf(id) >= 0) s -= 8; }); });
            if (usedKeys[c.key]) s -= 18;
            if (usedSauce[sauceOf(c)]) s -= 8;
            if (c.info.base === mc.info.base) s -= 12;
            other.forEach(function (o) { if (o && o.info.base === c.info.base) s -= 8; });
            if (amLimit && c.info.amakara && (mc.info.amakara || other.some(function (o) { return o && o.info.amakara; }))) s -= 25;
            [mc].concat(other).forEach(function (o) {
              if (!o) return;
              if (c.info.mainId && o.info.mainId && c.info.mainId === o.info.mainId) s -= 20;
              if (family(c.info.mainId) && family(c.info.mainId) === family(o.info.mainId)) s -= 15;
            });
            if (list === soups) {
              var g = mc.info.genre, sg = c.info.genre;
              if (g === sg) s += 4; else if ((g === '和' && sg === '洋') || (g === '洋' && sg === '和')) s -= 4;
              if (mc.recipe && mc.recipe.classicId === 'c_curry' && c.info.base === 'miso') s -= 6;
            }
            if (!b || s > b.s) b = { s: s, c: c };
          }
          return b;
        };
        if (sides.length) { var bs = pick(sides, []); if (bs) { menu.side = bs.c; menu.s += bs.s; bs.c.used.forEach(function (id) { usedSet[id] = 1; }); } }
        if (soups.length) { var bp = pick(soups, [menu.side]); if (bp) { menu.soup = bp.c; menu.s += bp.s; } }
        if (!bestMenu || menu.s > bestMenu.s) bestMenu = menu;
      });
      if (!bestMenu) break;
      picked.push(bestMenu);
      [bestMenu.main, bestMenu.side, bestMenu.soup].forEach(function (c) { if (c) usedKeys[c.key] = 1; });
      usedProt[family(bestMenu.main.info.mainId) || bestMenu.main.info.mainId] = 1;
      [bestMenu.main, bestMenu.side, bestMenu.soup].forEach(function (c) { if (c) usedSauce[sauceOf(c)] = 1; });
      if (vegMain(bestMenu.main)) usedVeg[vegMain(bestMenu.main)] = 1;
    }
    var inv = ctx.inventory || [];
    var result = picked.map(function (mm) {
      var dishes = [mm.main, mm.side, mm.soup].filter(Boolean).map(function (c) { return materialize(c, ctx); });
      var used = uniq([].concat.apply([], dishes.map(function (d) { return d.uses; })));
      var buys = uniq([].concat.apply([], dishes.map(function (d) { return d.buys; })));
      return { dishes: dishes, used: used, unused: inv.filter(function (id) { return used.indexOf(id) < 0; }), buys: buys, shortTotals: E.menuShort(dishes, ctx) };
    });
    var message = '';
    if (!result.length) message = '条件に合う料理が見つかりませんでした。苦手な食材や調理時間の設定をゆるめるか、食材を1つ足してみてください';
    else if (ctx.mode !== 'omakase' && inv.length && result[0].used.length === 0) message = '手持ちの食材だけで作れる料理が見つからなかったので、買い足しが少ない順に出しています';
    else if (ctx.mode !== 'omakase' && inv.length && result[0].dishes[0].buys.length) message = '主菜は買い足しが必要です（手持ちに主菜になる食材が少ないため）';
    return { menus: result, message: message };
  };

  // 献立全体で使う量が手持ちを超える食材（1品ずつでは足りていても）
  E.menuShort = function (dishes, ctx) {
    var am = ctx.amounts || {}; var tot = {}, flagged = {};
    dishes.forEach(function (d) { (d.ingredients || []).forEach(function (i) { if (i.id && am[i.id] != null && i.g) { tot[i.id] = (tot[i.id] || 0) + i.g; if (i.short) flagged[i.id] = 1; } }); });
    return Object.keys(tot).filter(function (id) { return tot[id] > am[id] * 1.15 && !flagged[id]; })
      .map(function (id) { return short(id) + 'は献立全体で約' + E.amountText(id, tot[id]) + '使います（手持ちは約' + E.amountText(id, am[id]) + '）'; });
  };

  // 1品だけ別の案に替える
  E.alternatives = function (ctx, slot, excludeKeys, limit) {
    var R = rng(ctx.seed != null ? ctx.seed : Date.now());
    var list = candidates(slot, ctx, R).filter(function (c) { return (excludeKeys || []).indexOf(c.key) < 0; });
    return list.slice(0, limit || 5).map(function (c) { return materialize(c, ctx); });
  };

  // 1品をキーから作り直す（お気に入り・履歴から開くとき）
  E.build = function (key, ctx) {
    var k = E.parseKey(key); if (!k) return null;
    if (k.kind === 'combo') { if (!SAUCE[k.spec.sauce]) return null; return buildCombo(k.spec, ctx); }
    if (k.kind === 'classic') return E.buildClassic(k.id, ctx);
    if (k.kind === 'user') { var U = (ctx.userRecipes || []).filter(function (u) { return u.id === k.id; })[0]; return U ? buildUser(U, ctx) : null; }
    return null;
  };

  // ---------- アプリ以外で作った料理の記録 ----------
  var BASES = [['salt', '塩味'], ['shoyu', 'しょうゆ'], ['shoyu_sweet', '甘辛しょうゆ'], ['miso', 'みそ'], ['chinese', '中華'], ['western', 'コンソメ・洋風'],
    ['cream', 'クリーム'], ['curry', 'カレー'], ['tomato', 'ケチャップ・トマト'], ['butter', 'バター'], ['spicy', 'ピリ辛'], ['sour', 'さっぱり（酢・ポン酢）'],
    ['dashi', 'だし・和風'], ['fried', '揚げ物'], ['other', 'その他']];
  var MAINS = [['pork_koma', '豚肉'], ['chicken_momo', '鶏肉'], ['beef_koma', '牛肉'], ['mince_mix', 'ひき肉'], ['salmon', '魚'], ['shrimp', 'えび'],
    ['tofu_momen', '豆腐・厚揚げ'], ['egg', '卵'], ['wiener', 'ウインナー・ハム'], ['', '野菜だけ・ほか']];
  E.baseList = function () { return BASES.slice(); };
  E.mainList = function () { return MAINS.slice(); };
  E.baseLabel = function (b) { var f = BASES.filter(function (x) { return x[0] === b; })[0]; return f ? f[1] : 'その他'; };
  E.mainLabel = function (id) {
    if (!id) return '野菜だけ・ほか';
    var ex = MAINS.filter(function (x) { return x[0] === id; })[0]; if (ex) return ex[1];
    if (/mince/.test(id)) return 'ひき肉';
    var fam = family(id); var f = MAINS.filter(function (x) { return x[0] && family(x[0]) === fam; })[0]; return f ? f[1] : short(id);
  };
  E.mainChip = function (id) { if (!id) return ''; if (MAINS.some(function (x) { return x[0] === id; })) return id; if (/mince/.test(id)) return 'mince_mix'; var fam = family(id); var f = MAINS.filter(function (x) { return x[0] && family(x[0]) === fam; })[0]; return f ? f[0] : ''; };
  // 料理名の言葉 → 味付け（上から順に見て、最初に当たったもの）
  var FISH_RE = /シーフード|さんま|サンマ|秋刀魚|あじ|アジ|鯵|いわし|イワシ|鰯|ほっけ|ホッケ|かれい|カレイ|鰈|まぐろ|マグロ|鮪|かつお|カツオ|鰹|ししゃも|シシャモ|さわら|サワラ|鰆|たい|タイ|鯛|白身魚|魚介|海鮮|いか|イカ|たこ|タコ|あさり|しじみ|ほたて|ホタテ|帆立|かに|カニ|蟹|うなぎ|ウナギ|鰻|魚|刺身|焼き魚|煮付/;
  var BASE_WORDS = [
    ['other', /焼きそば|焼そば|焼きうどん|お好み焼|たこ焼|ソース/],
    ['sour', /ぽん酢|ポン酢|南蛮|酢豚|甘酢|マリネ|酢の物|さっぱり煮|黒酢|酢じょうゆ|梅煮|梅/],
    ['spicy', /麻婆|マーボー|まーぼー|ピリ辛|キムチ|担々|坦々|チゲ|エビチリ|えびチリ|豆板醤|ヤンニョム/],
    ['curry', /カレー|かれー|タンドリー/],
    ['cream', /クリーム|シチュー|グラタン|カルボナーラ|ドリア/],
    ['tomato', /ケチャップ|ハンバーグ|オムライス|ナポリタン|ミートソース|トマト煮|ポークチャップ|チキンライス|ピザ|トマト/],
    ['salt', /塩焼|塩だれ|ねぎ塩|塩味|塩こしょう|塩麹|[（(]塩[)）]/],
    ['miso', /みそ|味噌|ちゃんちゃん|回鍋肉|ホイコーロー|豚汁|田楽/],
    ['shoyu_sweet', /照り焼|照焼|生姜焼|しょうが焼|甘辛|煮付|すき焼|肉じゃが|親子丼|牛丼|他人丼|きんぴら|角煮|筑前煮|蒲焼|かば焼|佃煮|そぼろ|照り|焼き鳥|焼鳥|うな丼|うな重/],
    ['chinese', /八宝菜|中華|オイスター|チンジャオ|青椒肉絲|あんかけ|餃子|ぎょうざ|ギョウザ|焼売|シュウマイ|春巻|炒飯|チャーハン|ラーメン|鶏ガラ|中華丼/],
    ['butter', /バター|ムニエル|ソテー/],
    ['western', /コンソメ|ポトフ|スープ煮|ロールキャベツ|ポタージュ|洋風/],
    ['fried', /唐揚|からあげ|から揚|竜田|天ぷら|天麩羅|フライ|とんかつ|トンカツ|コロッケ|カツ(?!オ)|揚げ(?!浸)/],
    ['salt', /焼き魚|塩/],
    ['shoyu', /たたき|しょうゆ|醤油|ガーリック|ステーキ|焼肉|焼き肉|刺身|ポークソテー|しょう油|丼/],
    ['dashi', /鍋|おでん|煮びたし|揚げ浸し|お吸い物|すまし汁|うどん|そば|雑炊|おひたし|和風|だし/]
  ];
  var MAIN_WORDS = [
    ['mince_mix', /ひき肉|挽き肉|挽肉|ミンチ|ハンバーグ|餃子|ぎょうざ|ギョウザ|そぼろ|ミートソース|焼売|シュウマイ|麻婆|マーボー|タコライス|タコス/],
    ['shrimp', /えび|エビ|海老/],
    ['salmon', /鮭|さけ|サケ|しゃけ|サーモン/], ['saba', /さば|サバ|鯖/], ['buri', /ぶり|ブリ|鰤/], ['tara', /たら(?!こ)|タラ(?!コ)|鱈(?!子)/],
    ['salmon', FISH_RE],
    ['tofu_momen', /豆腐|厚揚げ|あつあげ|油揚げ/],
    ['chicken_momo', /鶏|鳥|とり肉|チキン|親子|唐揚|からあげ|から揚|竜田|ささみ|焼き鳥|焼鳥|手羽/],
    ['beef_koma', /牛(?!乳)|ビーフ|すき焼|ステーキ|焼肉|焼き肉/],
    ['wiener', /ウインナー|ウィンナー|ソーセージ|ハム|ベーコン/],
    ['pork_koma', /豚|ぶた|ポーク|とんかつ|トンカツ|カツ(?!オ)|生姜焼|しょうが焼|角煮|回鍋肉|酢豚/],
    ['egg', /卵|たまご|玉子|オムライス|オムレツ|親子/]
  ];
  // 料理名から、味付け・主役・同じ定番レシピを推し量る
  E.guessDish = function (name) {
    var t = String(name || '');
    var n = norm(t);
    var hit = null;
    CLASSICS.forEach(function (C) { var cn = norm(C.name.replace(/（.*?）/g, '')); if (!hit && cn && cn.length >= 3 && n.indexOf(cn) >= 0) hit = C; });
    if (hit) return { base: hit.base, mainId: hit.ing[0].id, classicKey: 'classic|' + hit.id, genre: hit.genre, amakara: !!hit.amakara, slot: hit.slot, guessed: true };
    var base = 'other', mainId = '';
    for (var i = 0; i < BASE_WORDS.length; i++) if (BASE_WORDS[i][1].test(t)) { base = BASE_WORDS[i][0]; break; }
    for (var j = 0; j < MAIN_WORDS.length; j++) if (MAIN_WORDS[j][1].test(t)) { mainId = MAIN_WORDS[j][0]; break; }
    var genre = { chinese: '中', spicy: '中', western: '洋', cream: '洋', tomato: '洋', curry: '洋', butter: '洋' }[base] || '和';
    return { base: base, mainId: mainId, classicKey: null, genre: genre, amakara: base === 'shoyu_sweet', slot: 'main', guessed: base !== 'other' || !!mainId };
  };

  // ---------- ChatGPTに貼る文 ----------
  var TASTE_TEXT = { sour: '酸味が苦手', vinegar: 'お酢を多く使わない', ponzu: 'ポン酢はなるべく使わない', tomatoMain: 'トマトが主役の料理は避ける', tomatoAll: 'トマト味（ケチャップ含む）も控える', amakaraLimit: '甘辛い味付けに偏らない', kidMild: '子ども向けには辛味を避け、薄めの味付けにする' };
  E.tasteText = TASTE_TEXT;
  E.aiPrompt = function (ctx) {
    var p = ctx.people || {}; var pr = ctx.prefs || {};
    var who = ['大人' + (p.adult || 0) + '人'];
    if (p.kid) who.push('子ども' + p.kid + '人（小学生くらい）');
    if (p.toddler) who.push('小さい子' + p.toddler + '人（幼児）');
    var inv = (ctx.inventory || []).map(function (id) { return (ctx.starred || []).indexOf(id) >= 0 ? '★' + ING[id].name : ING[id].name; }).concat(ctx.unknown || []);
    var styleText = { full: '主菜・副菜・汁物', main_side: '主菜・副菜', main_soup: '主菜・汁物', main: '主菜1品' }[ctx.style || 'full'];
    var tastes = Object.keys(pr.tastes || {}).filter(function (k) { return pr.tastes[k] && TASTE_TEXT[k]; }).map(function (k) { return TASTE_TEXT[k]; });
    var avoid = (pr.avoid || []).map(function (id) { return ING[id] ? ING[id].name : id; }).concat(pr.avoidWords || []);
    var kidAvoid = (pr.kidAvoid || []).map(function (id) { return ING[id] ? ING[id].name : id; });
    var pantry = (pr.pantry || []).map(function (id) { return SEA[id] ? SEA[id].name.replace(/（.*?）/g, '') : id; }).filter(function (n) { return n !== '水'; });
    var today = ctx.today || new Date().toISOString().slice(0, 10);
    var recent = (ctx.history || []).filter(function (h) { return daysAgo(h.date, today) <= 7; }).map(function (h) { return h.name; });
    var L = [];
    L.push('あなたは家庭料理にくわしい料理研究家です。次の条件で、今夜の夕食の献立を考えてください。');
    L.push('');
    L.push('【人数】' + who.join('・'));
    L.push('【冷蔵庫にある食材】' + (inv.length ? inv.join('、') + (inv.some(function (x) { return x.charAt(0) === '★'; }) ? '（★はできれば使い切りたい）' : '') : '指定なし（おまかせ）'));
    if (pantry.length) L.push('【家にある調味料】' + pantry.join('、'));
    if (avoid.length || kidAvoid.length) L.push('【使わない食材】' + avoid.join('、') + (kidAvoid.length ? (avoid.length ? '／' : '') + '子どもが食べない：' + kidAvoid.join('、') : ''));
    if (tastes.length) L.push('【味の好み】' + tastes.join('／'));
    if (recent.length) L.push('【最近作った料理（似たものは避けてください）】' + uniq(recent).join('、'));
    if (ctx.maxMin) L.push('【調理時間】' + ctx.maxMin + '分以内');
    L.push('【献立の形】' + styleText);
    L.push('');
    L.push('【お願い】');
    L.push('・冷蔵庫の食材をできるだけ使い切ってください。足りない食材は「買い足すもの」としてはっきり書いてください');
    L.push('・各料理に、料理名／完成イメージ／材料と分量（人数分）／調味料の分量／下ごしらえ／食材の切り方と大きさ／手順（火加減と加熱時間つき）／失敗しやすいポイント／おいしく仕上げるコツ／子ども向けの取り分け方法／代用できる食材 を書いてください');
    L.push('・調味料は大さじ・小さじで、人数に合わせて計算してください。単純な倍量にせず、煮汁や水分の量、加熱による縮みも考えてください');
    L.push('・実際によく作られている一般的な配合をもとにしてください。必要ならネットで調べて参考にしてください');
    L.push('・根拠のない「絶対おいしい」などの表現はしないでください');
    L.push('・材料は「材料」、手順は「作り方」という見出しの下に、1行に1つずつ書いてください');
    return L.join('\n');
  };

  // ---------- 調理中の「困った？」 ----------
  E.helpItems = function () { return HELP.map(function (h) { return { id: h.id, q: h.q }; }); };
  // 手順の火加減：書いていなければ前の手順の火加減
  function stepHeat(recipe, idx) {
    for (var i = idx; i >= 0; i--) { var h = recipe.steps[i] && recipe.steps[i].heat; if (h) return { heat: h, inherited: i !== idx }; }
    return null;
  }
  E.stepHeat = stepHeat;
  E.helpAnswer = function (recipe, idx, query) {
    var item = HELP.filter(function (h) { return h.id === query; })[0];
    if (!item) {
      var n = norm(query);
      var best = null, bestLen = 0;
      HELP.forEach(function (h) { h.kw.forEach(function (k) { var kk = norm(k); if (kk && n.indexOf(kk) >= 0 && kk.length > bestLen) { best = h; bestLen = kk.length; } }); });
      item = best;
    }
    if (!item) return null;
    var st = recipe.steps[idx] || {};
    var m = recipe.method || 'default';
    var lines = (item.a[m] || item.a['default'] || []).slice();
    if (item.id === 'missing') {
      // 調味料の名前が入っていたら、その代わりを答える
      var nq = norm(query || '');
      var hitSea = (recipe.seasonings || []).filter(function (s2) { var nm = norm(s2.name.replace(/（.*?）/g, '').replace(/^おろし/, '')); return nm && nq.indexOf(nm) >= 0; })[0];
      var hitIng = (recipe.subs || []).filter(function (x) { var nm = norm(x.from.replace(/（.*?）/g, '')); return nm && nq.indexOf(nm) >= 0; })[0];
      if (hitSea) lines = [hitSea.name.replace(/（.*?）/g, '') + 'がないとき：' + (SEA_SUBS[hitSea.id] || 'なしで作って、最後に味見をして塩かしょうゆで調整します')];
      else if (hitIng) lines = [hitIng.from + 'の代わり：' + hitIng.to];
      else {
        var seaSubs = (recipe.seasonings || []).filter(function (s2) { return SEA_SUBS[s2.id]; }).slice(0, 6).map(function (s2) { return s2.name.replace(/（.*?）/g, '') + '→' + SEA_SUBS[s2.id]; });
        lines = ['食材の代わり：' + ((recipe.subs || []).length ? recipe.subs.map(function (x) { return x.from + '→' + x.to; }).join('／') : '登録がありません')];
        if (seaSubs.length) lines.push('調味料の代わり：' + seaSubs.join('／'));
      }
      return { id: item.id, q: item.q, lines: lines };
    }
    var hh = stepHeat(recipe, idx);
    var hi = hh ? HEAT_INFO[hh.heat] : null;
    var map = {
      heat: hh ? hh.heat + (hh.inherited ? '（前の手順のまま）' : '') : '火は使いません',
      heatLook: hi ? hi.look : 'この手順は火を使いません',
      ih: hi && hi.ih ? '（' + hi.ih + '）' : '',
      min: st.min ? fmtMin(st.min) : '特に決まっていません',
      cues: (st.cues && st.cues.length) ? st.cues.join('／') : '手順に書いてある状態になったら次へ',
      subs: (recipe.subs || []).length ? recipe.subs.map(function (x) { return x.from + '→' + x.to; }).join('／') : 'このレシピでは登録がありません',
      kid: (recipe.kid || []).length ? recipe.kid.join('／') : '小さめに切って取り分けます'
    };
    lines = lines.map(function (l) { return l.replace(/\{(\w+)\}/g, function (a, k) { return map[k] != null ? map[k] : a; }); });
    return { id: item.id, q: item.q, lines: lines };
  };
  // ChatGPTに聞くときの文（料理の情報だけ。名前などは入れない）
  E.askPrompt = function (recipe, idx, question, ctx) {
    var p = (ctx && ctx.people) || {};
    var st = recipe.steps[idx] || {};
    var hh = stepHeat(recipe, idx);
    var L = [];
    L.push('いま夕食を作っています。料理中の質問に、短く具体的に答えてください。');
    L.push('【料理】' + recipe.name + '（大人' + (p.adult || 0) + '人' + (p.kid ? '・子ども' + p.kid + '人' : '') + (p.toddler ? '・幼児' + p.toddler + '人' : '') + '分）');
    L.push('【材料】' + recipe.ingredients.map(function (i) { return i.name + (i.amount ? ' ' + i.amount : ''); }).join('、'));
    if (recipe.seasonings.length) L.push('【調味料】' + recipe.seasonings.map(function (s2) { return s2.name.replace(/（.*?）/g, '') + ' ' + s2.amount; }).join('、'));
    L.push('【いまの手順】' + (idx + 1) + '/' + recipe.steps.length + '：' + (st.t || ''));
    if (hh) L.push('【火加減】' + hh.heat);
    if (st.min) L.push('【この手順の時間の目安】' + fmtMin(st.min));
    L.push('【質問】' + (question || ''));
    return L.join('\n');
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = E;
  else root.Engine = E;
})(typeof self !== 'undefined' ? self : this);
