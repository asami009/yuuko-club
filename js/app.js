/* ユウコクラブ 画面の動き */
(function () {
  'use strict';
  var KEY = 'yuuhan.v1';
  var FILES = ['ingredients', 'seasonings', 'sauces', 'classics', 'help'];
  var S = null;           // 保存するデータ
  var memoryOnly = false; // ブラウザに保存できないとき
  var V = { tab: 'home', editPeople: false, results: null, alts: {}, detail: null, cook: null, timers: [], recipeFilter: 'all', recipeQuery: '' };
  var app = document.getElementById('app');
  var layer = document.getElementById('layer');
  var nav = document.getElementById('nav');
  var E = window.Engine;

  // ---------- 小さな道具 ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dateLabel(str) { var d = str ? new Date(str + 'T00:00:00') : new Date(); return (d.getMonth() + 1) + '月' + d.getDate() + '日（' + '日月火水木金土'.charAt(d.getDay()) + '）'; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function short(name) { return String(name).replace(/（.*?）/g, ''); }
  function toast(msg, ms) {
    var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, ms || 2200);
  }
  function copyText(text) {
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '-1000px'; document.body.appendChild(ta);
      ta.select(); ta.setSelectionRange(0, text.length); var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; } ta.remove(); return ok;
    }
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallback(); });
    return Promise.resolve(fallback());
  }
  var ICON = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.5 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
    starOn: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.5 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
    flame: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2c1 3.5 5 6 5 11a5 5 0 0 1-10 0c0-2.4 1.2-4 2.5-5.3C9.7 10 10.5 11.5 12 12c-.5-3 .3-6.6 0-10z"/></svg>'
  };

  // ---------- 保存 ----------
  function defaults() {
    var pantry = E.allSeasonings().filter(function (s) { return s.pantry; }).map(function (s) { return s.id; });
    return {
      v: 1, setupDone: false,
      people: { adult: 2, kid: 2, toddler: 0 },
      prefs: {
        avoid: ['pakuchi', 'myoga'], kidAvoid: ['eggplant'],
        avoidWords: [],
        tastes: { sour: true, vinegar: true, ponzu: true, tomatoMain: true, tomatoAll: false, amakaraLimit: true, kidMild: true },
        pantry: pantry, saltLevel: 'normal'
      },
      mode: 'fridge', style: 'full', maxMin: null,
      fridge: { items: [], starred: [], unknown: [], amounts: {} },
      history: [], favorites: [], userRecipes: [], last: null
    };
  }
  function merge(base, o) {
    if (!o || typeof o !== 'object') return base;
    Object.keys(o).forEach(function (k) {
      if (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) base[k] = merge(base[k], o[k]);
      else base[k] = o[k];
    });
    return base;
  }
  function load() {
    try { var t = localStorage.getItem(KEY); if (t) return merge(defaults(), JSON.parse(t)); }
    catch (e) { memoryOnly = true; }
    return defaults();
  }
  function save() {
    if (memoryOnly) return;
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { memoryOnly = true; toast('このブラウザでは保存できないため、閉じると設定が消えます', 4000); }
  }
  function ctx(extra) {
    var amounts = {}; S.fridge.items.forEach(function (id) { amounts[id] = amountOf(id); });
    var c = {
      amounts: amounts,
      people: S.people, prefs: S.prefs, inventory: S.fridge.items, starred: S.fridge.starred, unknown: S.fridge.unknown,
      mode: S.mode, style: S.style, maxMin: S.maxMin, history: S.history, userRecipes: S.userRecipes, today: todayStr(), seed: Math.floor(Math.random() * 1e6)
    };
    Object.keys(extra || {}).forEach(function (k) { c[k] = extra[k]; });
    return c;
  }
  function amountOf(id) { var a = S.fridge.amounts || {}; return a[id] != null ? a[id] : E.defaultAmount(id); }
  function lookOf(id) { var it = E.ing(id); return it ? it.look : null; }
  function plate(recipe) { return window.Plate.draw(recipe, lookOf); }
  function lastRating(key) { for (var i = S.history.length - 1; i >= 0; i--) if (S.history[i].key === key && S.history[i].rating) return S.history[i].rating; return null; }
  function isFav(key) { return S.favorites.some(function (f) { return f.key === key; }); }
  function peopleText(p) { var a = ['大人' + p.adult]; if (p.kid) a.push('子ども' + p.kid); if (p.toddler) a.push('小さい子' + p.toddler); return a.join('・'); }
  function labelTags(r) {
    var t = '';
    if (r.kind === 'classic') t += '<span class="tag">定番の作り方</span>';
    else if (r.kind === 'combo') t += '<span class="tag combo">組み合わせ提案</span>';
    else t += '<span class="tag good">わが家のレシピ</span>';
    if (lastRating(r.key) === 'good') t += '<span class="tag good">わが家で好評</span>';
    return t;
  }
  var SLOT = { main: '主菜', side: '副菜', soup: '汁物' };

  // ---------- 画面の切り替え ----------
  function setTab(tab) {
    V.tab = tab;
    Array.prototype.forEach.call(nav.querySelectorAll('button'), function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === tab); });
    render(); window.scrollTo(0, 0);
  }
  function render() {
    if (V.tab === 'home') app.innerHTML = renderHome();
    else if (V.tab === 'recipes') app.innerHTML = renderRecipes();
    else if (V.tab === 'log') app.innerHTML = renderLog();
    else app.innerHTML = renderSettings();
  }

  // ---------- つくる ----------
  function peopleStepper(p, scope) {
    function one(key, label) {
      return '<div class="stepper"><div class="lbl">' + label + '</div><div class="ctl"><button data-act="pp" data-scope="' + scope + '" data-k="' + key + '" data-d="-1" aria-label="' + label + 'を減らす">−</button><span class="num">' + p[key] + '</span><button data-act="pp" data-scope="' + scope + '" data-k="' + key + '" data-d="1" aria-label="' + label.replace(/<.*/, '') + 'を増やす">＋</button></div></div>';
    }
    return '<div class="people">' + one('adult', '大人<small>中学生以上</small>') + one('kid', '子ども<small>小学生くらい</small>') + one('toddler', '小さい子<small>幼児</small>') + '</div>';
  }
  var CATS = [['meat', '肉'], ['fish', '魚'], ['soy', '豆腐・卵'], ['veg', '野菜'], ['mushroom', 'きのこ'], ['extra', 'その他']];
  function catOf(it) { if (it.cat === 'egg') return 'soy'; if (it.cat === 'item') return 'extra'; return it.cat; }
  function renderHome() {
    var h = '<header class="top wrap"><h1>ユウコクラブ</h1><div class="date">' + dateLabel() + '・今日の夕飯どうする？</div></header><main class="wrap">';
    if (!S.setupDone) {
      h += '<div class="card"><h2>はじめに</h2><p class="small">人数と苦手な食材は「せってい」でいつでも変えられます。最初から、苦手な食材と味（酸味・ポン酢・パクチー・ミョウガ・子どものナス など）を入れてあります。</p><div class="row"><button class="btn primary" data-act="goSettings">人数と苦手を確認する</button><button class="btn ghost" data-act="setupDone">このまま使う</button></div></div>';
    }
    h += '<div class="peoplebar"><div><b>' + esc(peopleText(S.people)) + '</b> <span class="muted">で作る</span></div><button class="btn small" data-act="editPeople">' + (V.editPeople ? '閉じる' : '人数を変える') + '</button></div>';
    if (V.editPeople) h += '<div class="card">' + peopleStepper(S.people, 'home') + '</div>';
    h += '<div class="seg" role="tablist"><button data-act="mode" data-v="fridge" class="' + (S.mode === 'fridge' ? 'on' : '') + '">冷蔵庫の食材から</button><button data-act="mode" data-v="omakase" class="' + (S.mode === 'omakase' ? 'on' : '') + '">おまかせ</button></div>';
    if (S.mode === 'fridge') h += renderFridge();
    else h += '<div class="card"><p class="small" style="margin:0">食材を決めずに、献立を3案出します。人数・好み・最近作った料理に合わせて選びます。</p></div>';
    h += '<div class="card"><h2>献立の形</h2><div class="chips">' +
      [['full', '主菜＋副菜＋汁物'], ['main_side', '主菜＋副菜'], ['main_soup', '主菜＋汁物'], ['main', '主菜だけ']].map(function (o) { return '<button class="pick ' + (S.style === o[0] ? 'on' : '') + '" data-act="style" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') +
      '</div><h3>調理時間（1品あたり）</h3><div class="chips">' +
      [[null, 'こだわらない'], [20, '20分以内'], [30, '30分以内'], [45, '45分以内']].map(function (o) { return '<button class="pick ' + (S.maxMin === o[0] ? 'on' : '') + '" data-act="maxMin" data-v="' + (o[0] || '') + '">' + o[1] + '</button>'; }).join('') + '</div></div>';
    h += '<button class="btn primary big" data-act="suggest">献立を考える</button>';
    h += '<div id="results">' + renderResults() + '</div>';
    h += '<div class="card"><h2>もっと自由に考えたいとき</h2><p class="small">このアプリはAIを使わずに、食材・調理法・味付けを組み合わせて考えています。もっと自由な献立にしたい日は、条件をまとめた文を無料版のChatGPTなどに貼って使えます（送るのは料理の条件だけで、名前などは入りません）。</p><button class="btn" data-act="aiPrompt">条件をまとめた文を作る</button><p class="muted">ChatGPTの答えは「レシピ」タブの「レシピを登録」から貼り付けて保存できます。</p></div>';
    h += '</main>';
    return h;
  }
  function renderFridge() {
    var f = S.fridge;
    var h = '<div class="card"><h2>冷蔵庫にあるもの</h2>';
    h += '<div class="row"><input id="ingIn" class="input grow" placeholder="例：豚こま 300g、キャベツ 半分、卵" enterkeyhint="done" autocomplete="off"><button class="btn primary" data-act="addIng">追加</button></div><div class="sugg" id="sugg"></div>';
    if (f.items.length || f.unknown.length) {
      h += '<div class="chips" style="margin-top:12px">' + f.items.map(function (id) {
        var it = E.ing(id); var st = f.starred.indexOf(id) >= 0;
        return '<span class="chip ' + (st ? 'star' : '') + '">' + esc(short(it.name)) + '<button class="amt" data-act="amt" data-id="' + id + '" aria-label="残りの量を直す">' + esc(E.amountText(id, amountOf(id))) + '</button><button class="' + (st ? 'on' : '') + '" data-act="star" data-id="' + id + '" aria-label="使い切りたい">' + (st ? '★' : '☆') + '</button><button data-act="rmIng" data-id="' + id + '" aria-label="外す">×</button></span>';
      }).join('') + f.unknown.map(function (w, i) {
        return '<span class="chip unknown">' + esc(w) + '<button data-act="rmUnknown" data-i="' + i + '" aria-label="外す">×</button></span>';
      }).join('') + '</div>';
      h += '<p class="muted" style="margin:8px 0 0">量は「キャベツ 半分」「豚こま 300g」のように書けます（書かないと1パック分とみなします）。量を押すと直せます。「作った！」を押すと、使った分を自動で引きます。☆は「使い切りたい」で、優先して使います。</p>';
      if (f.unknown.length) h += '<p class="muted" style="margin:4px 0 0">点線の食材は辞書にないため、組み合わせには使えません（ChatGPTに貼る文には入ります）。</p>';
      h += '<div class="row end" style="margin-top:6px"><button class="btn small ghost" data-act="clearFridge">ぜんぶ外す</button></div>';
    } else {
      h += '<p class="muted">食材の名前を入れるか、下の一覧から選んでください。少しでも大丈夫です。</p>';
    }
    h += '<details class="acc" ' + (f.items.length ? '' : 'open') + '><summary>一覧から選ぶ</summary>';
    var all = E.allIngredients().filter(function (it) { return it.role !== 'none' && it.id !== 'curry_roux' && it.id !== 'rice'; });
    CATS.forEach(function (c) {
      var list = all.filter(function (it) { return catOf(it) === c[0]; });
      if (!list.length) return;
      h += '<h3>' + c[1] + '</h3><div class="chips">' + list.map(function (it) {
        var on = f.items.indexOf(it.id) >= 0;
        var ng = S.prefs.avoid.indexOf(it.id) >= 0;
        return '<button class="pick ' + (on ? 'on' : '') + (ng ? ' off' : '') + '" data-act="toggleIng" data-id="' + it.id + '">' + esc(short(it.name)) + '</button>';
      }).join('') + '</div>';
    });
    h += '</details></div>';
    return h;
  }
  function renderResults() {
    var R = V.results;
    if (!R) return '';
    var h = '';
    if (R.message) h += '<div class="note">' + esc(R.message) + '</div>';
    R.menus.forEach(function (m, mi) {
      var longest = Math.max.apply(null, m.dishes.map(function (d) { return d.minutes || 0; }));
      h += '<div class="card menu"><div class="head"><b>案' + (mi + 1) + '</b><span class="muted">いちばん長い料理で約' + longest + '分</span></div>';
      m.dishes.forEach(function (d, di) {
        h += '<div class="dish"><div class="thumb" data-act="open" data-m="' + mi + '" data-d="' + di + '">' + plate(d) + '</div><div><div class="slot">' + SLOT[d.slot] + '</div><button class="name" data-act="open" data-m="' + mi + '" data-d="' + di + '">' + esc(d.name) + '</button><div class="meta">約' + d.minutes + '分 ' + labelTags(d) + (d.buys && d.buys.length ? '<span class="tag buy">買い足しあり</span>' : '') + (d.ingredients.some(function (i) { return i.short; }) ? '<span class="tag buy">量が少し足りない</span>' : '') + '</div>';
        h += '<div class="acts"><button class="btn small ghost" data-act="alt" data-m="' + mi + '" data-d="' + di + '">別の案にする</button></div>';
        var ak = mi + ':' + di;
        if (V.alts[ak]) {
          h += '<div class="alts">' + (V.alts[ak].length ? V.alts[ak].map(function (a, ai) { return '<button data-act="pickAlt" data-m="' + mi + '" data-d="' + di + '" data-a="' + ai + '">' + esc(a.name) + ' <span class="muted">約' + a.minutes + '分</span></button>'; }).join('') : '<div class="muted">ほかの案が見つかりませんでした</div>') + '<button data-act="closeAlt" data-m="' + mi + '" data-d="' + di + '" class="muted" style="text-align:center;font-weight:400">閉じる</button></div>';
        }
        h += '</div></div>';
      });
      var names = function (ids) { return ids.map(function (id) { return short(E.ing(id).name); }).join('・'); };
      h += '<div class="summary">';
      if (S.mode === 'fridge' && S.fridge.items.length) {
        h += '<div><b>使う食材：</b>' + (m.used.length ? esc(names(m.used)) : 'なし') + '</div>';
        h += '<div><b>残る食材：</b>' + (m.unused.length ? esc(names(m.unused)) : 'なし（全部使えます）') + '</div>';
      }
      if (m.shortTotals && m.shortTotals.length) h += '<div style="color:var(--warn)"><b>量に注意：</b>' + esc(m.shortTotals.join('／')) + '</div>';
      h += '<div><b>' + (S.mode === 'omakase' ? '用意するもの：' : '買い足すもの：') + '</b>' + esc(S.mode === 'omakase' ? shoppingList(m).join('・') : (m.buys.length ? m.buys.map(short).join('・') : 'なし')) + '</div>';
      h += '</div><div class="row" style="margin-top:10px"><button class="btn small" data-act="madeMenu" data-m="' + mi + '">この献立を作った！</button>' + ((S.mode === 'omakase' || m.buys.length) ? '<button class="btn small ghost" data-act="copyShop" data-m="' + mi + '">買い物リストをコピー</button>' : '') + '</div></div>';
    });
    if (R.menus.length) h += '<div class="row end"><button class="btn small" data-act="suggest">ほかの案を出す</button></div>';
    return h;
  }
  function shoppingList(m) {
    var out = [];
    m.dishes.forEach(function (d) { d.ingredients.forEach(function (i) { if (i.staple || i.raw) return; var n = short(i.name); if (out.indexOf(n) < 0) out.push(n); }); });
    return out;
  }
  function recompute(m) {
    var inv = S.fridge.items;
    var used = []; var buys = [];
    m.dishes.forEach(function (d) { (d.uses || []).forEach(function (id) { if (used.indexOf(id) < 0) used.push(id); }); (d.buys || []).forEach(function (b) { if (buys.indexOf(b) < 0) buys.push(b); }); });
    m.used = used; m.unused = inv.filter(function (id) { return used.indexOf(id) < 0; }); m.buys = buys;
    m.shortTotals = E.menuShort(m.dishes, ctx());
  }
  function saveLast() {
    if (!V.results) { S.last = null; save(); return; }
    S.last = { date: todayStr(), message: V.results.message, menus: V.results.menus.map(function (m) { return m.dishes.map(function (d) { return d.key; }); }) };
    save();
  }
  function restoreLast() {
    if (!S.last || !S.last.menus) return;
    var c = ctx();
    var menus = S.last.menus.map(function (keys) {
      var m = { dishes: keys.map(function (k) { return E.build(k, c); }).filter(Boolean) }; recompute(m); return m;
    }).filter(function (m) { return m.dishes.length; });
    if (menus.length) V.results = { menus: menus, message: S.last.message || '' };
  }
  function doSuggest() {
    var c = ctx();
    var res = E.suggest(c);
    V.results = res; V.alts = {};
    saveLast();
    var r = $('#results'); if (r) { r.innerHTML = renderResults(); r.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }
  function splitItems(text) {
    var out = [];
    String(text || '').split(/[、,，\n]+/).forEach(function (chunk) {
      chunk.split(/[\s　]+/).filter(Boolean).forEach(function (w) {
        if (out.length && /^([0-9０-９]|約|半分|はんぶん|少し|すこし|ちょっと|大さじ|小さじ)/.test(w)) out[out.length - 1] += ' ' + w;
        else out.push(w);
      });
    });
    return out;
  }
  function addIngredients(text) {
    var parts = splitItems(text);
    var added = 0, msgs = [];
    S.fridge.amounts = S.fridge.amounts || {};
    parts.forEach(function (w) {
      var id = E.match(w);
      if (id && E.ing(id).role !== 'none') {
        var g = E.parseAmount(w, id);
        if (S.fridge.items.indexOf(id) < 0) { S.fridge.items.push(id); S.fridge.amounts[id] = g != null ? g : E.defaultAmount(id); added++; }
        else if (g != null) S.fridge.amounts[id] = amountOf(id) + g;
        if (S.prefs.avoid.indexOf(id) >= 0) msgs.push(short(E.ing(id).name) + 'は苦手な食材に入っているので、提案には使いません');
      } else if (id && E.ing(id).role === 'none') {
        msgs.push(short(E.ing(id).name) + 'は苦手な食材として登録されています');
      } else { var word = w.replace(/\s.*$/, ''); if (S.fridge.unknown.indexOf(word) < 0) { S.fridge.unknown.push(word); added++; } }
    });
    save();
    if (msgs.length) toast(msgs[0], 3000);
    return added;
  }
  // 「作った！」で、使った分を冷蔵庫から引く
  function consume(recipes) {
    var before = JSON.parse(JSON.stringify(S.fridge));
    S.fridge.amounts = S.fridge.amounts || {};
    var gone = [], left = [];
    recipes.forEach(function (r) {
      var lines = (r.ingredients || []).concat((r.seasonings || []).filter(function (x) { return E.ing(x.id); }));
      lines.forEach(function (i) {
        if (!i.id || S.fridge.items.indexOf(i.id) < 0 || !i.g) return;
        var rest = amountOf(i.id) - i.g;
        if (rest < Math.max(15, E.defaultAmount(i.id) * 0.08)) {
          S.fridge.items = S.fridge.items.filter(function (x) { return x !== i.id; });
          S.fridge.starred = S.fridge.starred.filter(function (x) { return x !== i.id; });
          delete S.fridge.amounts[i.id];
          if (gone.indexOf(i.id) < 0) gone.push(i.id);
        } else { S.fridge.amounts[i.id] = rest; if (left.indexOf(i.id) < 0) left.push(i.id); }
      });
    });
    if (!gone.length && !left.length) return;
    save();
    var msg = '冷蔵庫を更新しました。' + (gone.length ? gone.map(function (id) { return short(E.ing(id).name); }).join('・') + 'は使い切り。' : '') + (left.length ? left.filter(function (id) { return gone.indexOf(id) < 0; }).map(function (id) { return short(E.ing(id).name) + '残り約' + E.amountText(id, amountOf(id)); }).join('・') : '');
    actionToast(msg, '元に戻す', function () { S.fridge = before; save(); render(); toast('冷蔵庫を元に戻しました'); });
    if (V.tab === 'home' && !V.detail) render();
  }
  function actionToast(msg, label, fn) {
    var old = document.getElementById('atoast'); if (old) old.remove();
    var t = document.createElement('div'); t.className = 'toast'; t.id = 'atoast'; t.style.borderRadius = '16px'; t.style.textAlign = 'left';
    t.innerHTML = '<div>' + esc(msg) + '</div><div style="text-align:right;margin-top:6px"><button class="btn small" style="min-height:36px;background:transparent;color:inherit;border-color:currentColor">' + esc(label) + '</button></div>';
    t.querySelector('button').addEventListener('click', function () { t.remove(); fn(); });
    document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.remove(); }, 8000);
  }
  function openAmount(id) {
    var it = E.ing(id); var u = it.unit; var cur = amountOf(id);
    var opts = [];
    if (u && u.frac) [[0.25, '1/4'], [0.5, '1/2'], [0.75, '3/4'], [1, '1'], [2, '2']].forEach(function (f) { opts.push([f[0] * u.g, f[1] + u.n]); });
    else if (u && u.cm) [5, 10, 15, 20, 30].forEach(function (n) { opts.push([n * u.g, n + 'cm']); });
    else if (u && u.piece) (it.cat === 'fish' ? [1, 2, 3, 4] : u.g <= 20 ? [2, 4, 6, 8, 10] : [1, 2, 3, 4, 6, 10]).forEach(function (n) { opts.push([n * u.g, n + u.n]); });
    else if (u && u.spoon) [10, 20, 30, 50].forEach(function (g) { opts.push([g, g + 'g']); });
    else [100, 200, 300, 400, 500].forEach(function (g) { opts.push([g, g + 'g']); });
    var h = '<div class="modal" id="modal" data-act="modalBg"><div class="box"><h2>' + esc(short(it.name)) + 'の残り</h2><p class="small">いまは約' + esc(E.amountText(id, cur)) + 'として計算しています。近いものを押してください。</p><div class="chips">' +
      opts.map(function (o) { return '<button class="pick" data-act="setAmt" data-id="' + id + '" data-g="' + o[0] + '">' + esc(o[1]) + '</button>'; }).join('') +
      '</div><div class="row" style="margin-top:10px"><input class="input grow" id="amtIn" type="number" inputmode="decimal" placeholder="グラムで入れる（例：250）"><button class="btn" data-act="setAmtG" data-id="' + id + '">決める</button></div><div class="row" style="margin-top:10px"><button class="btn danger" data-act="rmIng" data-id="' + id + '">もう無い（一覧から外す）</button><button class="btn ghost" data-act="closeModal">閉じる</button></div></div></div>';
    layer.insertAdjacentHTML('beforeend', h);
  }

  // ---------- レシピ一覧 ----------
  function renderRecipes() {
    var c = ctx({ maxMin: null });
    var q = V.recipeQuery, f = V.recipeFilter;
    var h = '<header class="top wrap"><h1>レシピ</h1></header><main class="wrap">';
    h += '<input class="input" id="recipeSearch" placeholder="料理名でさがす" value="' + esc(q) + '" autocomplete="off">';
    h += '<div class="chips" style="margin:10px 0">' + [['all', 'すべて'], ['main', '主菜'], ['side', '副菜'], ['soup', '汁物']].map(function (o) { return '<button class="pick ' + (f === o[0] ? 'on' : '') + '" data-act="rFilter" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>';
    var match = function (r) { return (f === 'all' || r.slot === f) && (!q || E.norm(r.name).indexOf(E.norm(q)) >= 0); };
    // わが家のレシピ
    h += '<div class="card"><div class="row"><h2 class="grow" style="margin:0">わが家のレシピ</h2><button class="btn small primary" data-act="register">＋ レシピを登録</button></div>';
    var mine = S.userRecipes.map(function (u) { return E.buildUser(u, c); }).filter(match);
    h += mine.length ? '<ul class="list">' + mine.map(function (r) { return '<li><button class="name" style="border:0;background:none;padding:0;text-align:left;font-weight:600" data-act="openKey" data-key="' + esc(r.key) + '">' + esc(r.name) + '</button><span class="muted">' + SLOT[r.slot] + '</span></li>'; }).join('') + '</ul>' : '<p class="muted">まだありません。家の定番や、ChatGPTに考えてもらったレシピを登録すると、献立の候補に入ります。</p>';
    h += '</div>';
    // お気に入り
    var favs = S.favorites.map(function (fv) { var r = E.build(fv.key, c); return r; }).filter(Boolean).filter(match);
    h += '<div class="card"><h2>お気に入り</h2>' + (favs.length ? '<ul class="list">' + favs.map(function (r) { return '<li><button style="border:0;background:none;padding:0;text-align:left;font-weight:600" data-act="openKey" data-key="' + esc(r.key) + '">' + esc(r.name) + '</button><span class="muted">' + SLOT[r.slot] + '</span></li>'; }).join('') + '</ul>' : '<p class="muted">レシピの☆を押すと、ここに入ります。</p>') + '</div>';
    // 定番
    var cls = E.allClassics().map(function (cl) { return E.buildClassic(cl.id, c); }).filter(match);
    h += '<div class="card"><h2>定番の作り方（' + cls.length + '品）</h2><p class="muted">家庭でよく作られている配合のレシピです。人数に合わせて分量を計算します。</p><ul class="list">' + cls.map(function (r) {
      var why = E.excludedReason(r, c);
      return '<li style="' + (why ? 'opacity:.55' : '') + '"><span><button style="border:0;background:none;padding:0;text-align:left;font-weight:600" data-act="openKey" data-key="' + esc(r.key) + '">' + esc(r.name) + '</button>' + (why ? '<span class="sub">設定で外れています：' + esc(why) + '</span>' : '') + '</span><span class="muted">' + SLOT[r.slot] + '</span></li>';
    }).join('') + '</ul></div>';
    h += '<p class="muted">このほかに、冷蔵庫の食材から「組み合わせ提案」でその日のレシピを作ります。</p></main>';
    return h;
  }

  // ---------- きろく ----------
  function renderLog() {
    var h = '<header class="top wrap"><h1>きろく</h1></header><main class="wrap">';
    h += '<div class="card"><h2>最近作った料理</h2><p class="muted">7日以内に作った料理と似たものは、提案に出にくくなります。「好みではなかった」を押した料理は出なくなり、似た味付けも出にくくなります。</p>';
    if (!S.history.length) h += '<div class="empty">まだ記録がありません。レシピの「作った！」を押すと記録されます。</div>';
    else {
      var items = S.history.map(function (x, i) { return { x: x, i: i }; }).reverse().slice(0, 60);
      var lastDate = '';
      items.forEach(function (o) {
        var x = o.x;
        if (x.date !== lastDate) { h += '<h3>' + dateLabel(x.date) + '</h3>'; lastDate = x.date; }
        h += '<div class="toggle" style="align-items:flex-start"><div class="grow"><button style="border:0;background:none;padding:0;text-align:left;font-weight:600" data-act="openKey" data-key="' + esc(x.key) + '">' + esc(x.name) + '</button> <span class="muted">' + (SLOT[x.slot] || '') + '</span>' + rateButtons(o.i, x.rating) + '</div><button class="iconbtn" data-act="rmHist" data-i="' + o.i + '" aria-label="記録を消す" style="width:40px;height:40px;font-size:16px">' + ICON.close + '</button></div>';
      });
    }
    h += '</div></main>';
    return h;
  }
  function rateButtons(i, cur) {
    return '<div class="rate">' + [['good', 'おいしかった'], ['ok', '普通'], ['bad', '好みではなかった']].map(function (o) {
      return '<button class="' + (cur === o[0] ? 'on' : '') + (o[0] === 'bad' ? ' bad' : '') + '" data-act="rate" data-i="' + i + '" data-v="' + o[0] + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }
  function addHistory(r) {
    var today = todayStr();
    var exist = -1; V.lastAddNew = false;
    S.history.forEach(function (x, i) { if (x.key === r.key && x.date === today) exist = i; });
    if (exist < 0) {
      S.history.push({ key: r.key, name: r.name, slot: r.slot, date: today, rating: null, mainId: r.mainId, base: r.base, amakara: !!r.amakara, genre: r.genre });
      if (S.history.length > 400) S.history = S.history.slice(-400);
      exist = S.history.length - 1; V.lastAddNew = true;
    }
    save();
    return exist;
  }

  // ---------- せってい ----------
  function renderSettings() {
    var p = S.prefs, t = p.tastes;
    var h = '<header class="top wrap"><h1>せってい</h1></header><main class="wrap">';
    h += '<div class="card"><h2>人数</h2>' + peopleStepper(S.people, 'settings') + '<p class="muted">子どもは大人の7割、小さい子は5割の量で計算します。</p></div>';
    h += '<div class="card"><h2>苦手な食材（使わない）</h2>' + avoidChips('avoid') + '<div class="row" style="margin-top:8px"><input class="input grow" id="avoidIn" placeholder="食材を追加" autocomplete="off"><button class="btn" data-act="addAvoid" data-list="avoid">追加</button></div></div>';
    h += '<div class="card"><h2>子どもが食べない食材</h2><p class="muted">子どもの人数が1人以上のときだけ使わないようにします。</p>' + avoidChips('kidAvoid') + '<div class="row" style="margin-top:8px"><input class="input grow" id="kidAvoidIn" placeholder="食材を追加" autocomplete="off"><button class="btn" data-act="addAvoid" data-list="kidAvoid">追加</button></div></div>';
    h += '<div class="card"><h2>味の好み</h2>' + Object.keys(E.tasteText).map(function (k) {
      return '<label class="toggle"><span>' + esc(E.tasteText[k]) + '</span><span class="sw"><input type="checkbox" data-act="taste" data-k="' + k + '" ' + (t[k] ? 'checked' : '') + '><span></span></span></label>';
    }).join('') + '<h3>味の濃さ</h3><div class="chips">' + [['normal', 'ふつう'], ['light', 'うすめ']].map(function (o) { return '<button class="pick ' + (p.saltLevel === o[0] ? 'on' : '') + '" data-act="salt" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div></div>';
    h += '<div class="card"><h2>家にある調味料</h2><p class="muted">チェックがないものを使うレシピには「家にない」と代わりのものを出します。</p><div class="checks">' + E.allSeasonings().filter(function (s) { return !s.hidden; }).map(function (s) {
      return '<label><input type="checkbox" data-act="pantry" data-id="' + s.id + '" ' + (p.pantry.indexOf(s.id) >= 0 ? 'checked' : '') + '>' + esc(short(s.name)) + '</label>';
    }).join('') + '</div></div>';
    var gk = lsGet(GKEY);
    h += '<div class="card"><h2>調理中の質問にGeminiを使う（使わなくてもOK）</h2>';
    h += '<p class="small">GoogleのGemini（AI）の無料キーを入れると、調理モードの「困った？」で、自由な質問にその場で答えが返ってきます。入れなくても、アプリのほかの機能はすべて使えます。</p>';
    h += '<details class="acc"><summary>使う前に知っておくこと</summary><ul class="bul small"><li>無料で使えます。ただし無料の使い方では、送った質問と答えをGoogleがサービス改善に使い、人が読むこともあります（Googleの規約）。名前や住所などは書かないでください。このアプリが送るのは、料理名・材料・いまの手順・質問だけです。</li><li>1日に使える回数に上限があります。上限に達してもアプリのほかの機能は止まりません。</li><li>Googleの規約で、キーを作って使えるのは18歳以上です。</li><li>インターネットにつながっているときだけ使えます。</li><li>キーはこのスマホの中だけに保存され、データの書き出しには入りません。</li><li>使われるのは、キーを作った人のGoogleアカウントの無料の回数です（ほかの人のキーを借りて貼った場合は、その人の回数が減ります）。</li></ul></details>';
    h += '<details class="acc"><summary>キーの作り方（5分くらい）</summary><ol class="bul small"><li><a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio のキーのページ</a>を開き、自分のGoogleアカウントでログインする</li><li>「APIキーを作成」を押す（はじめての人は、利用規約に同意する画面が出ます）</li><li>表示されたキー（AIza…で始まる長い文字）をコピーする</li><li>下の欄に貼り付けて「保存」を押し、「つながるか試す」で確認する</li></ol><p class="muted">料金の設定（お支払い方法の登録）はしないでください。登録しなければ無料の範囲だけで使われます。</p></details>';
    h += '<div class="row" style="margin-top:8px"><input class="input grow" id="gkeyIn" type="password" autocomplete="off" placeholder="' + (gk ? '保存済み（変えるときだけ入力）' : 'ここにキーを貼り付け') + '"><button class="btn" data-act="saveGkey">保存</button></div>';
    h += '<div class="row" style="margin-top:8px">' + (gk ? '<span class="tag good">キー保存済み</span><button class="btn small" data-act="testGkey">つながるか試す</button><button class="btn small danger" data-act="delGkey">キーを消す</button>' : '<span class="muted">キーは入っていません</span>') + '</div></div>';
    h += '<div class="card"><h2>データの保存</h2><p class="small">記録・お気に入り・登録したレシピ・設定は、このスマホのブラウザの中だけに保存されます。機種変更やブラウザのデータ削除で消えるので、ときどき書き出しておくと安心です。' + (memoryOnly ? '<br><b>※いまはこのブラウザに保存できない状態です（プライベートブラウズなど）。</b>' : '') + '</p><div class="row"><button class="btn" data-act="export">書き出す（ファイル）</button><button class="btn" data-act="exportCopy">書き出す（コピー）</button><button class="btn" data-act="import">読み込む</button></div><input type="file" id="importFile" accept="application/json,.json" class="hidden"></div>';
    h += '<div class="card"><h2>このアプリについて</h2><ul class="bul small">' +
      '<li>「組み合わせ提案」は、このアプリが食材・調理法・味付けを組み合わせて作った案です。調味料は一般的な配合と塩分の目安（炒め物は食材の重さの約0.9%など）から計算していますが、実際に作って確かめたものではありません。</li>' +
      '<li>「定番の作り方」は、家庭でよく作られている一般的な配合です。</li>' +
      '<li>作った料理を「おいしかった」と記録すると「わが家で好評」の印がつき、次の提案に出やすくなります。</li>' +
      '<li>調理中の「困った？」のボタンの答えはAIではなく、よくある困りごとへの答えです。Geminiのキーを入れた場合だけ、文字で聞いた質問をGeminiに送ります。答えられないときはChatGPTに聞く文も作れます。</li>' +
      '<li>有料のサービスは使っていません。献立とレシピを考える部分はAIを使わず、一度開いたあとは電波がなくても使えます。</li></ul></div>';
    h += '<div class="card"><h2>リセット</h2><button class="btn danger" data-act="resetAll">データをすべて消す</button></div>';
    h += '</main>';
    return h;
  }
  function avoidChips(list) {
    var ids = S.prefs[list];
    var words = list === 'avoid' ? (S.prefs.avoidWords || []) : [];
    if (!ids.length && !words.length) return '<p class="muted">なし</p>';
    return '<div class="chips">' + ids.map(function (id) { var it = E.ing(id); return '<span class="chip">' + esc(it ? short(it.name) : id) + '<button data-act="rmAvoid" data-list="' + list + '" data-id="' + id + '" aria-label="外す">×</button></span>'; }).join('') +
      words.map(function (w, i) { return '<span class="chip unknown">' + esc(w) + '<button data-act="rmAvoidWord" data-i="' + i + '" aria-label="外す">×</button></span>'; }).join('') + '</div>';
  }

  // ---------- レシピ詳細 ----------
  function openRecipe(recipe) {
    V.detail = { key: recipe.key, people: { adult: S.people.adult, kid: S.people.kid, toddler: S.people.toddler }, recipe: recipe, madeIdx: null };
    renderDetail();
    var sh = $('#sheet'); if (sh) sh.scrollTop = 0;
  }
  function rebuildDetail() {
    var d = V.detail; var r = E.build(d.key, ctx({ people: d.people }));
    if (r) d.recipe = r;
  }
  function renderDetail() {
    var d = V.detail; if (!d) { closeSheet(); return; }
    var r = d.recipe;
    var keepScroll = $('#sheet') ? $('#sheet').scrollTop : 0;
    var h = '<div class="sheet" id="sheet"><div class="bar"><button class="iconbtn" data-act="closeSheet" aria-label="戻る">' + ICON.back + '</button><div class="title">' + esc(r.name) + '</div><button class="iconbtn" data-act="fav" aria-label="お気に入り" style="color:var(--accent)">' + (isFav(r.key) ? ICON.starOn : ICON.star) + '</button></div><div class="body">';
    h += '<h1 class="rtitle">' + esc(r.name) + '</h1><div>' + labelTags(r) + '<span class="tag">' + SLOT[r.slot] + '</span></div>';
    h += '<div class="hero">' + plate(r) + '<div class="desc">' + esc(r.desc || '') + '<div class="muted">イメージ図です（写真ではありません）</div></div></div>';
    h += '<div class="facts">' + (r.minutes ? '<span class="fact">約' + r.minutes + '分</span>' : '') + (r.saltPerAdult != null ? '<span class="fact">塩分 大人1人分 約' + r.saltPerAdult.toFixed(1) + 'g</span>' : '') + '</div>';
    if (r.kind === 'combo') h += '<div class="note">このアプリが食材と味付けを組み合わせて作った案です。調味料は一般的な配合と塩分の目安から計算していますが、実際に作って確かめたものではありません。最後に味見をして調整してください。作ったら評価をつけると、次の提案に生かされます。</div>';
    if (r.note) h += '<div class="note">' + esc(r.note) + '</div>';
    h += '<div class="card"><h2>人数</h2>' + peopleStepper(d.people, 'detail') + '<p class="muted">ここで変えた人数は、このレシピの分量だけに使います。</p></div>';
    // 材料
    h += '<div class="card"><h2>材料（' + esc(peopleText(d.people)) + '）</h2><ul class="list">' + r.ingredients.map(function (i) {
      return '<li><span>' + esc(i.raw ? i.name : i.name) + (i.buy ? ' <span class="tag buy">買い足し</span>' : '') + (i.note ? '<span class="sub">' + esc(i.note) + '</span>' : '') + '</span><span class="amt">' + esc(i.amount || '') + '</span></li>';
    }).join('') + '</ul></div>';
    if (r.seasonings.length) {
      h += '<div class="card"><h2>調味料</h2><ul class="list">' + r.seasonings.map(function (s) {
        var sub = [];
        if (s.label) sub.push(s.label);
        if (s.group === 'A') sub.push('合わせ調味料A');
        if (s.group === 'B') sub.push(r.mix && r.mix.B && r.mix.B.indexOf('katakuri') >= 0 ? '水溶き片栗粉B' : '合わせ調味料B');
        if (s.missing) sub.push('家にない調味料');
        return '<li><span>' + (s.group ? '<span class="grp">' + s.group + '</span>' : '') + esc(short(s.name)) + (sub.length ? '<span class="sub">' + esc(sub.join('・')) + '</span>' : '') + '</span><span class="amt">' + esc(s.amount) + '</span></li>';
      }).join('') + '</ul><p class="muted">大さじ1＝15ml、小さじ1＝5ml。最後に味見をして調整してください。</p></div>';
    }
    if ((r.prep && r.prep.length) || (r.cuts && r.cuts.length)) {
      h += '<div class="card">';
      if (r.cuts && r.cuts.length) h += '<h2>切り方と大きさ</h2><ul class="list">' + r.cuts.map(function (c) { return '<li><span><b>' + esc(short(c.name)) + '</b><span class="sub">' + esc(c.how) + '</span></span></li>'; }).join('') + '</ul>';
      if (r.prep && r.prep.length) h += '<h2 style="margin-top:14px">下ごしらえ</h2><ul class="bul">' + r.prep.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
      h += '</div>';
    }
    h += '<div class="card"><h2>作り方</h2><ol class="steps">' + r.steps.map(function (s) {
      return '<li>' + (s.heat ? '<span class="heat">' + ICON.flame + esc(s.heat) + '</span>' : '') + (s.min ? '<span class="heat cold">' + esc(E.fmtMin(s.min)) + '</span>' : '') + '<div>' + esc(s.t) + '</div>' + ((s.cues || []).length ? '<div class="cues">' + s.cues.map(function (c) { return '<div>' + esc(c) + '</div>'; }).join('') + '</div>' : '') + '</li>';
    }).join('') + '</ol></div>';
    var sec = function (title, arr) { return arr && arr.length ? '<h2 style="margin-top:6px">' + title + '</h2><ul class="bul">' + arr.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : ''; };
    var tips = sec('失敗しやすいポイント', r.pit) + sec('おいしく仕上げるコツ', r.tip);
    if (tips) h += '<div class="card">' + tips + '</div>';
    if (r.kid && r.kid.length) h += '<div class="card">' + sec('子ども向けの取り分け', r.kid) + '</div>';
    if (r.subs && r.subs.length) h += '<div class="card"><h2>代用できる食材</h2><ul class="list">' + r.subs.map(function (x) { return '<li><span><b>' + esc(short(x.from)) + '</b><span class="sub">' + esc(x.to) + '</span></span></li>'; }).join('') + '</ul></div>';
    if (r.kind === 'user') h += '<div class="row"><button class="btn" data-act="editUser" data-id="' + esc(r.userId) + '">編集する</button><button class="btn danger" data-act="delUser" data-id="' + esc(r.userId) + '">削除する</button></div>';
    if (d.madeIdx != null && S.history[d.madeIdx]) h += '<div class="card"><h2>どうでしたか？</h2><p class="muted">次の提案に生かします。あとで「きろく」からも付けられます。</p>' + rateButtons(d.madeIdx, S.history[d.madeIdx].rating) + '</div>';
    h += '</div><div class="foot"><div class="in"><button class="btn" data-act="made">作った！</button><button class="btn primary" data-act="cook">調理モード</button></div></div></div>';
    layer.innerHTML = h;
    document.body.style.overflow = 'hidden';
    var sh = $('#sheet'); if (sh) sh.scrollTop = keepScroll;
  }
  function closeSheet() { V.detail = null; layer.innerHTML = ''; document.body.style.overflow = ''; if (V.results) V.results.menus.forEach(recompute); render(); }

  // ---------- 調理モード ----------
  var wakeLock = null;
  function requestWake() {
    if (!('wakeLock' in navigator)) { V.wake = 'none'; return; }
    navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; V.wake = 'on'; var w = $('#wake'); if (w) w.textContent = '調理中は画面が暗くならないようにしています'; l.addEventListener('release', function () { wakeLock = null; }); }, function () { V.wake = 'fail'; });
  }
  function releaseWake() { if (wakeLock) { try { wakeLock.release(); } catch (e) { /* なにもしない */ } wakeLock = null; } }
  function openCook() {
    V.cook = { recipe: V.detail.recipe, i: 0 };
    requestWake();
    renderCook();
  }
  function renderCook() {
    var c = V.cook; var r = c.recipe; var s = r.steps[c.i] || {};
    var hh = E.stepHeat(r, c.i); var hi = hh ? E.heatInfo(hh.heat) : null;
    var old = $('#cooksheet'); if (old) old.remove();
    var h = '<div class="sheet" id="cooksheet" style="z-index:50"><div class="bar"><button class="iconbtn" data-act="closeCook" aria-label="調理モードを閉じる">' + ICON.close + '</button><div class="title">' + esc(r.name) + '</div><button class="btn small ghost" data-act="cookIng">材料を見る</button></div><div class="body cook">';
    h += '<div class="count">手順 ' + (c.i + 1) + ' / ' + r.steps.length + '</div>';
    h += '<div class="bigstep">' + esc(s.t) + '</div>';
    if (hh) h += '<div class="panel fire"><div class="h">' + ICON.flame + ' ' + esc(hh.heat) + (hh.inherited ? '<span class="small" style="font-weight:600">（前の手順のまま）</span>' : '') + '</div>' + (hi ? '<div class="l">' + esc(hi.look) + '</div>' + (hi.ih ? '<div class="ih">' + esc(hi.ih) + '。' + esc(E.heatNote) + '</div>' : '') : '') + '</div>';
    else h += '<div class="panel fire" style="background:var(--chip)"><div class="l">この手順は火を使いません</div></div>';
    if (s.min) h += '<div class="panel time"><div><div class="h">' + (s.wait ? '待つ時間' : '時間の目安') + '</div><div class="t">' + esc(E.fmtMin(s.min)) + '</div></div><button class="btn primary" data-act="timer">タイマー開始</button></div><div class="muted" style="margin:-4px 2px 6px">iPhoneはマナーモード中だと、タイマーの音が鳴らないことがあります</div>';
    var cues = s.cues || [];
    h += '<div class="panel look"><div class="h">見た目の目安</div>' + (cues.length ? cues.map(function (x) { return '<div class="c">' + esc(x) + '</div>'; }).join('') : '<div class="c">書いてある状態になったら、次の手順へ進みます</div>') + '</div>';
    if (c.i === r.steps.length - 1) h += '<div class="note">' + (s.wait ? '時間がたったら完成です。器に盛りつけましょう。' : 'これで完成です。器に盛りつけましょう。') + '</div>';
    h += '<button class="btn helpbtn" data-act="help">困った？（水分・焦げ・味など）</button>';
    h += '<div class="wake" id="wake">' + (V.wake === 'on' ? '調理中は画面が暗くならないようにしています' : V.wake === 'none' || V.wake === 'fail' ? 'このブラウザでは画面の自動消灯を止められません。消えたら画面をタップしてください' : '') + '</div>';
    h += '</div><div class="foot"><div class="in cooknav"><button class="btn" data-act="prev" ' + (c.i === 0 ? 'disabled' : '') + '>← 前へ</button>' + (c.i < r.steps.length - 1 ? '<button class="btn primary" data-act="next">次へ →</button>' : '<button class="btn primary" data-act="cookDone">できた！記録する</button>') + '</div></div></div>';
    layer.insertAdjacentHTML('beforeend', h);
  }
  function closeCook() { V.cook = null; releaseWake(); var cs = $('#cooksheet'); if (cs) cs.remove(); }

  // ---------- タイマー ----------
  var audioCtx = null;
  function beep() {
    try {
      if (!audioCtx) return;
      var t0 = audioCtx.currentTime;
      for (var i = 0; i < 3; i++) {
        var o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
        g.gain.setValueAtTime(0.0001, t0 + i * 0.5); g.gain.exponentialRampToValueAtTime(0.3, t0 + i * 0.5 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.5 + 0.35);
        o.start(t0 + i * 0.5); o.stop(t0 + i * 0.5 + 0.4);
      }
    } catch (e) { /* 音が出せない環境 */ }
    if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
  }
  function startTimer(label, min) {
    try { if (!audioCtx) { var AC = window.AudioContext || window.webkitAudioContext; if (AC) audioCtx = new AC(); } if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) { audioCtx = null; }
    V.timers.push({ id: uid(), label: label, end: Date.now() + Math.round(min * 60000), done: false });
    renderTimers(); tick();
  }
  var ticking = null;
  function tick() {
    if (ticking) return;
    ticking = setInterval(function () {
      var now = Date.now(), any = false;
      V.timers.forEach(function (t) { if (!t.done && now >= t.end) { t.done = true; beep(); } if (!t.done) any = true; });
      renderTimers();
      if (!any && !V.timers.some(function (t) { return t.done; })) { clearInterval(ticking); ticking = null; }
    }, 1000);
  }
  function renderTimers() {
    var box = document.getElementById('timers');
    box.innerHTML = V.timers.map(function (t) {
      var left = Math.max(0, Math.round((t.end - Date.now()) / 1000));
      var tm = t.done ? '時間です' : Math.floor(left / 60) + ':' + pad(left % 60);
      return '<div class="timer ' + (t.done ? 'done' : '') + '"><span class="lab">' + esc(t.label) + '</span><span class="tm">' + tm + '</span><button data-act="stopTimer" data-id="' + t.id + '">' + (t.done ? 'OK' : '止める') + '</button></div>';
    }).join('');
  }

  // ---------- 困った？ ----------
  function openHelp() {
    var c = V.cook;
    var h = '<div class="modal" id="modal" data-act="modalBg"><div class="box"><h2>困ったとき（手順' + (c.i + 1) + '）</h2>';
    h += '<div class="chips">' + E.helpItems().filter(function (x) { return x.id !== 'heat' && x.id !== 'time'; }).map(function (x) { return '<button class="pick" data-act="helpQ" data-id="' + x.id + '">' + esc(x.q) + '</button>'; }).join('') + '</div>';
    h += '<div class="row" style="margin-top:10px"><input class="input grow" id="helpIn" placeholder="例：けっこう水分出てるけどこんなもん？" autocomplete="off"><button class="btn primary" data-act="helpAsk">' + (hasGemini() ? 'Geminiに聞く' : '聞く') + '</button></div>';
    h += '<div id="helpAns"></div><div id="geminiAns"></div>';
    h += '<p class="muted">上のボタンの答えはAIではなく、よくある困りごとへの答えです（いまの手順と調理法に合わせて出しています）。' + (hasGemini() ? '文字で聞いた質問は、いまの手順をつけてGeminiに送ります。名前などは書かないでください。' : '「せってい」でGeminiのキーを入れると、ここで自由に質問できます。') + '</p>';
    h += '<div class="row"><button class="btn" data-act="askGpt">ChatGPTに聞く（いまの手順つき）</button><button class="btn ghost" data-act="closeModal">閉じる</button></div></div></div>';
    layer.insertAdjacentHTML('beforeend', h);
  }
  function showHelp(q) {
    var c = V.cook; var a = E.helpAnswer(c.recipe, c.i, q);
    var box = $('#helpAns'); if (!box) return;
    if (!a) box.innerHTML = '<div class="answer"><p>うまく答えられませんでした。下の「ChatGPTに聞く」なら、いまの手順をつけて質問できます。</p></div>';
    else box.innerHTML = '<div class="answer"><b>' + esc(a.q) + '</b>' + a.lines.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('') + '</div>';
  }
  function askHelpText(q) {
    var c = V.cook;
    if (!hasGemini()) { showHelp(q); return; }
    var local = E.helpAnswer(c.recipe, c.i, q);
    var hb = $('#helpAns'); if (hb) hb.innerHTML = local ? '<div class="answer"><b>' + esc(local.q) + '（よくある答え）</b>' + local.lines.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('') + '</div>' : '';
    var box = $('#geminiAns'); if (!box) return;
    box.innerHTML = '<div class="answer"><p class="muted">Geminiに聞いています…</p></div>';
    var prompt = E.askPrompt(c.recipe, c.i, q, ctx({ people: V.detail ? V.detail.people : S.people }));
    geminiAsk(prompt).then(function (res) {
      var b2 = $('#geminiAns'); if (b2) b2.innerHTML = '<div class="answer"><b>Geminiの答え</b><p>' + plainAnswer(res.text) + '</p><p class="muted">AIの答えなので、間違うことがあります。安全に関わることは、手順と見た目の目安も確かめてください。</p></div>';
    }, function (e) {
      var b3 = $('#geminiAns'); if (b3) b3.innerHTML = '<div class="answer"><p>' + esc(geminiError(e)) + '</p></div>';
    });
  }
  function closeModal() { var m = $('#modal'); if (m) m.remove(); }
  function showPromptModal(title, text, note) {
    var url = 'https://chatgpt.com/?q=' + encodeURIComponent(text);
    copyText(text).then(function (ok) {
      closeModal();
      var h = '<div class="modal" id="modal" data-act="modalBg"><div class="box"><h2>' + esc(title) + '</h2>';
      h += '<p class="small">' + (ok ? '下の文をコピーしました。' : 'コピーできなかったので、下の文を長押ししてコピーしてください。') + 'ChatGPTを開いて、質問欄に入っていなければ貼り付けてください。' + (note ? esc(note) : '') + '</p>';
      h += '<pre class="prompt">' + esc(text) + '</pre>';
      h += '<div class="row"><a class="btn primary" href="' + esc(url) + '" target="_blank" rel="noopener">ChatGPTを開く</a><button class="btn" data-act="copyAgain">もう一度コピー</button><button class="btn ghost" data-act="closeModal">閉じる</button></div>';
      h += '<p class="muted">送られるのは料理の情報（食材・好み・人数・手順）だけです。ChatGPTは無料版でも使えます。</p></div></div>';
      layer.insertAdjacentHTML('beforeend', h);
      V.lastPrompt = text;
    });
  }

  // ---------- Gemini（任意・使う人自身の無料キー） ----------
  var GKEY = 'yuuhan.gkey', GMODEL = 'yuuhan.gmodel';
  // 無料枠で使えるモデル（2026年11月に公式の料金ページで確認）。軽いものから順に試し、なければ次へ
  var GEMINI_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-2.5-flash-lite'];
  var GEMINI_SYSTEM = 'あなたは家庭料理にくわしいアシスタントです。料理中の人からの質問に、日本語で短く（3〜6行）具体的に答えてください。火加減・時間・見た目の目安を入れてください。生焼け・油の発火・アレルギーなど安全に関わることは、はっきり伝えてください。わからないことは断定しないでください。根拠のない「絶対おいしい」などの表現は使わないでください。';
  function lsGet(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return (V.mem && V.mem[k]) || ''; } }
  function lsSet(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { V.mem = V.mem || {}; V.mem[k] = v; } }
  function hasGemini() { return !!lsGet(GKEY); }
  function geminiAsk(prompt) {
    var key = lsGet(GKEY);
    if (!key) return Promise.reject({ code: 'nokey' });
    if (navigator.onLine === false) return Promise.reject({ code: 'offline' });
    var saved = lsGet(GMODEL);
    var models = saved ? [saved].concat(GEMINI_MODELS.filter(function (m) { return m !== saved; })) : GEMINI_MODELS.slice();
    function tryModel(i) {
      if (i >= models.length) return Promise.reject({ code: 'nomodel' });
      return fetch('https://generativelanguage.googleapis.com/v1beta/models/' + models[i] + ':generateContent', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: GEMINI_SYSTEM }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 1024 } })
      }).then(function (r) { return r.json().then(function (j) { return { r: r, j: j }; }, function () { return { r: r, j: {} }; }); }, function () { return Promise.reject({ code: 'network' }); })
        .then(function (o) {
          if (o.r.ok) {
            var parts = (((o.j.candidates || [])[0] || {}).content || {}).parts || [];
            var text = parts.map(function (x) { return x.text || ''; }).join('').trim();
            if (!text) return Promise.reject({ code: 'empty' });
            lsSet(GMODEL, models[i]);
            return { text: text, model: models[i] };
          }
          var msg = JSON.stringify(o.j || {});
          if (o.r.status === 404) return tryModel(i + 1);
          if (o.r.status === 429 && /limit:\s*0\b/.test(msg)) return tryModel(i + 1);
          if (o.r.status === 429) return Promise.reject({ code: 'limit' });
          if (o.r.status === 400 && /API key|API_KEY/i.test(msg)) return Promise.reject({ code: 'key' });
          if (o.r.status === 401 || o.r.status === 403) return Promise.reject({ code: 'key' });
          if (o.r.status === 400 && /model/i.test(msg)) return tryModel(i + 1);
          return Promise.reject({ code: 'other', status: o.r.status });
        });
    }
    return tryModel(0);
  }
  function geminiError(e) {
    return {
      nokey: '設定でGeminiのキーが入っていません。',
      offline: 'インターネットにつながっていないため、Geminiに聞けません。',
      network: 'Geminiにつながりませんでした。電波のよいところでもう一度試してください。',
      limit: '無料で使える回数の上限に達したようです。しばらく（翌日まで）たってから試すか、下の「ChatGPTに聞く」を使ってください。',
      key: 'キーが正しくないか、使えない状態のようです。「せってい」でキーを確かめてください。',
      nomodel: '無料で使えるモデルが見つかりませんでした。Googleの仕組みが変わった可能性があります。アプリを作った人に「Geminiのモデル名の更新」を頼んでください。それまでは下の「ChatGPTに聞く」を使ってください。',
      empty: '答えが空でした。質問を少し変えて、もう一度試してください。'
    }[e && e.code] || 'うまくいきませんでした（' + ((e && e.status) || '不明') + '）。もう一度試してください。';
  }
  function plainAnswer(t) { return esc(String(t).replace(/\*\*/g, '').replace(/^#+\s*/gm, '')).replace(/\n/g, '<br>'); }

  // ---------- レシピ登録 ----------
  function openRegister(u) {
    var x = u || { id: '', name: '', slot: 'main', serves: 2, minutes: '', ingredients: [], steps: [], memo: '' };
    var h = '<div class="sheet" id="regsheet" style="z-index:55"><div class="bar"><button class="iconbtn" data-act="closeReg" aria-label="閉じる">' + ICON.close + '</button><div class="title">' + (u ? 'レシピを編集' : 'レシピを登録') + '</div></div><div class="body">';
    h += '<details class="acc"><summary>ChatGPTなどの答えを貼り付けて読み込む</summary><textarea class="input" id="pasteIn" placeholder="答えをここに貼り付け"></textarea><div class="row" style="margin:8px 0"><button class="btn" data-act="parsePaste">読み込む</button></div><p class="muted">「材料」「作り方」の見出しを目印に、下の欄に分けて入れます。読み込んだあと、内容を確認してから保存してください。</p></details>';
    h += '<label class="field">料理名</label><input class="input" id="rName" value="' + esc(x.name) + '" placeholder="例：うちの肉じゃが">';
    h += '<label class="field">種類</label><div class="chips">' + ['main', 'side', 'soup'].map(function (k) { return '<button class="pick ' + (x.slot === k ? 'on' : '') + '" data-act="rSlot" data-v="' + k + '">' + SLOT[k] + '</button>'; }).join('') + '</div><input type="hidden" id="rSlot" value="' + x.slot + '">';
    h += '<label class="field">何人分の分量で書く？（大人の人数で）</label><div class="row"><input class="input" id="rServes" type="number" min="1" max="12" inputmode="numeric" value="' + esc(x.serves) + '" style="width:110px"><span class="muted">人分</span></div>';
    h += '<label class="field">調理時間（分・わかれば）</label><input class="input" id="rMin" type="number" min="0" inputmode="numeric" value="' + esc(x.minutes || '') + '" style="width:110px">';
    h += '<label class="field">材料（1行に1つ）</label><textarea class="input" id="rIng" placeholder="豚こま切れ肉 200g&#10;じゃがいも 2個&#10;しょうゆ 大さじ2">' + esc((x.ingredients || []).join('\n')) + '</textarea><p class="muted">「200g」「大さじ2」のように書くと、人数に合わせて計算し直します。</p>';
    h += '<label class="field">作り方（1行に1手順）</label><textarea class="input" id="rSteps" placeholder="鍋に油を熱して肉を炒める（中火・2分）">' + esc((x.steps || []).join('\n')) + '</textarea><p class="muted">「中火」「3分」と書くと、調理モードで火加減とタイマーが出ます。</p>';
    h += '<label class="field">メモ（コツなど）</label><textarea class="input" id="rMemo" style="min-height:80px">' + esc(x.memo || '') + '</textarea>';
    h += '<input type="hidden" id="rId" value="' + esc(x.id) + '">';
    h += '</div><div class="foot"><div class="in"><button class="btn primary" data-act="saveReg">保存する</button></div></div></div>';
    layer.insertAdjacentHTML('beforeend', h);
  }
  function closeReg() { var r = $('#regsheet'); if (r) r.remove(); }
  function lines(id) { return ($('#' + id).value || '').split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean); }

  // ---------- 書き出し・読み込み ----------
  function exportData(asFile) {
    var text = JSON.stringify({ app: 'yuuhan', exported: new Date().toISOString(), data: S }, null, 1);
    if (!asFile) { copyText(text).then(function (ok) { toast(ok ? 'コピーしました。メモアプリなどに貼って保存してください' : 'コピーできませんでした', 3500); }); return; }
    try {
      var blob = new Blob([text], { type: 'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'yuuhan-backup-' + todayStr() + '.json';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      toast('ファイルを保存しました（「ファイル」アプリのダウンロードに入ります）', 3500);
    } catch (e) { exportData(false); }
  }
  function importText(text) {
    try {
      var o = JSON.parse(text); var d = o && o.data ? o.data : o;
      if (!d || !d.prefs || !d.people) throw new Error('形式が違います');
      if (!confirm('いまのデータを、読み込んだデータで置きかえます。よろしいですか？')) return;
      S = merge(defaults(), d); save(); V.results = null; restoreLast(); render(); toast('読み込みました');
    } catch (e) { alert('読み込めませんでした。このアプリで書き出したファイルか確認してください。'); }
  }

  // ---------- 操作 ----------
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act],[data-tab]');
    if (!el) return;
    if (el.hasAttribute('data-tab')) { setTab(el.getAttribute('data-tab')); return; }
    var act = el.getAttribute('data-act');
    var A = el.dataset;
    switch (act) {
      case 'goSettings': S.setupDone = true; save(); setTab('settings'); break;
      case 'setupDone': S.setupDone = true; save(); render(); break;
      case 'editPeople': V.editPeople = !V.editPeople; render(); break;
      case 'pp': {
        var tgt = A.scope === 'detail' ? V.detail.people : S.people;
        var k = A.k, min = k === 'adult' ? 1 : 0;
        tgt[k] = Math.max(min, Math.min(12, (tgt[k] || 0) + parseInt(A.d, 10)));
        if (A.scope === 'detail') { rebuildDetail(); renderDetail(); }
        else {
          save();
          if (V.results) { var c0 = ctx(); V.results.menus.forEach(function (m) { m.dishes = m.dishes.map(function (d) { return E.build(d.key, c0) || d; }); recompute(m); }); }
          render();
        }
        break;
      }
      case 'mode': S.mode = A.v; save(); V.results = null; render(); break;
      case 'style': S.style = A.v; save(); render(); break;
      case 'maxMin': S.maxMin = A.v ? parseInt(A.v, 10) : null; save(); render(); break;
      case 'addIng': { var inp = $('#ingIn'); if (inp && inp.value.trim()) { addIngredients(inp.value); render(); var i2 = $('#ingIn'); if (i2) i2.focus(); } break; }
      case 'sugg': {
        var id0 = A.id; var inp0 = $('#ingIn');
        var rest0 = inp0 ? splitItems(inp0.value) : []; var lastW = rest0.length ? rest0[rest0.length - 1] : '';
        if (S.fridge.items.indexOf(id0) < 0) { S.fridge.items.push(id0); S.fridge.amounts = S.fridge.amounts || {}; var g0 = E.parseAmount(lastW, id0); S.fridge.amounts[id0] = g0 != null ? g0 : E.defaultAmount(id0); }
        save(); render(); var i3 = $('#ingIn'); if (i3) i3.focus(); break;
      }
      case 'toggleIng': { var id1 = A.id, ix = S.fridge.items.indexOf(id1); S.fridge.amounts = S.fridge.amounts || {}; if (ix >= 0) { S.fridge.items.splice(ix, 1); S.fridge.starred = S.fridge.starred.filter(function (x) { return x !== id1; }); delete S.fridge.amounts[id1]; } else { S.fridge.items.push(id1); S.fridge.amounts[id1] = E.defaultAmount(id1); } save(); var y = window.scrollY; render(); window.scrollTo(0, y); break; }
      case 'amt': openAmount(A.id); break;
      case 'setAmt': S.fridge.amounts[A.id] = parseFloat(A.g); save(); closeModal(); render(); break;
      case 'setAmtG': { var gv = parseFloat(($('#amtIn') || {}).value); if (!(gv > 0)) { toast('グラムを数字で入れてください'); break; } S.fridge.amounts[A.id] = gv; save(); closeModal(); render(); break; }
      case 'star': { var id2 = A.id, sx = S.fridge.starred.indexOf(id2); if (sx >= 0) S.fridge.starred.splice(sx, 1); else S.fridge.starred.push(id2); save(); var y2 = window.scrollY; render(); window.scrollTo(0, y2); break; }
      case 'rmIng': { S.fridge.items = S.fridge.items.filter(function (x) { return x !== A.id; }); S.fridge.starred = S.fridge.starred.filter(function (x) { return x !== A.id; }); if (S.fridge.amounts) delete S.fridge.amounts[A.id]; closeModal(); save(); var y3 = window.scrollY; render(); window.scrollTo(0, y3); break; }
      case 'rmUnknown': S.fridge.unknown.splice(parseInt(A.i, 10), 1); save(); render(); break;
      case 'clearFridge': S.fridge = { items: [], starred: [], unknown: [], amounts: {} }; save(); render(); break;
      case 'suggest': doSuggest(); break;
      case 'open': { var m = V.results.menus[+A.m]; openRecipe(m.dishes[+A.d]); break; }
      case 'openKey': { var r = E.build(A.key, ctx()); if (r) openRecipe(r); else toast('このレシピは見つかりませんでした'); break; }
      case 'alt': {
        var mm = V.results.menus[+A.m]; var dd = mm.dishes[+A.d];
        var exclude = []; V.results.menus.forEach(function (x) { x.dishes.forEach(function (z) { exclude.push(z.key); }); });
        V.alts[A.m + ':' + A.d] = E.alternatives(ctx(), dd.slot, exclude, 4);
        $('#results').innerHTML = renderResults(); break;
      }
      case 'pickAlt': { var ml = V.results.menus[+A.m]; var ak = A.m + ':' + A.d; ml.dishes[+A.d] = V.alts[ak][+A.a]; delete V.alts[ak]; recompute(ml); saveLast(); $('#results').innerHTML = renderResults(); break; }
      case 'closeAlt': delete V.alts[A.m + ':' + A.d]; $('#results').innerHTML = renderResults(); break;
      case 'madeMenu': { var newOnes = []; V.results.menus[+A.m].dishes.forEach(function (d) { addHistory(d); if (V.lastAddNew) newOnes.push(d); }); if (newOnes.length && S.mode === 'fridge') consume(newOnes); else toast('「きろく」に入れました。あとで評価をつけてください', 3000); break; }
      case 'copyShop': { var ms = V.results.menus[+A.m]; var list = S.mode === 'omakase' ? shoppingList(ms) : ms.buys.map(short); copyText('買い物リスト\n' + list.map(function (x) { return '・' + x; }).join('\n')).then(function (ok) { toast(ok ? '買い物リストをコピーしました' : 'コピーできませんでした'); }); break; }
      case 'aiPrompt': showPromptModal('ChatGPTに貼る文', E.aiPrompt(ctx())); break;
      case 'copyAgain': if (V.lastPrompt) copyText(V.lastPrompt).then(function (ok) { toast(ok ? 'コピーしました' : 'コピーできませんでした'); }); break;
      case 'closeSheet': closeSheet(); break;
      case 'fav': {
        var key = V.detail.key, fi = -1; S.favorites.forEach(function (f, i) { if (f.key === key) fi = i; });
        if (fi >= 0) { S.favorites.splice(fi, 1); toast('お気に入りから外しました'); } else { S.favorites.push({ key: key, name: V.detail.recipe.name, slot: V.detail.recipe.slot, added: todayStr() }); toast('お気に入りに入れました'); }
        save(); renderDetail(); break;
      }
      case 'made': { V.detail.madeIdx = addHistory(V.detail.recipe); var isNew = V.lastAddNew; renderDetail(); if (isNew) consume([V.detail.recipe]); if (!isNew || !document.getElementById('atoast')) toast('「きろく」に入れました'); setTimeout(function () { var sh = $('#sheet'); if (sh) sh.scrollTop = sh.scrollHeight; }, 50); break; }
      case 'rate': {
        var hi = +A.i; var setOn = false; if (S.history[hi]) { setOn = S.history[hi].rating !== A.v; S.history[hi].rating = setOn ? A.v : null; save(); }
        if (V.detail && $('#sheet')) renderDetail(); else render();
        if (A.v === 'bad' && setOn) toast('この料理は次から出なくなります（似た味付けも出にくくなります）', 3000);
        break;
      }
      case 'rmHist': if (confirm('この記録を消しますか？')) { S.history.splice(+A.i, 1); save(); render(); } break;
      case 'cook': openCook(); break;
      case 'closeCook': closeCook(); break;
      case 'prev': if (V.cook.i > 0) { V.cook.i--; renderCook(); } break;
      case 'next': if (V.cook.i < V.cook.recipe.steps.length - 1) { V.cook.i++; renderCook(); } break;
      case 'cookDone': { var idx = addHistory(V.cook.recipe); var isNew2 = V.lastAddNew; var cr = V.cook.recipe; closeCook(); if (isNew2) consume([cr]); if (V.detail) { V.detail.madeIdx = idx; renderDetail(); var sh2 = $('#sheet'); if (sh2) sh2.scrollTop = sh2.scrollHeight; } if (!document.getElementById('atoast')) toast('おつかれさまでした。「きろく」に入れました', 3000); break; }
      case 'timer': { var st = V.cook.recipe.steps[V.cook.i]; startTimer('手順' + (V.cook.i + 1) + '：' + st.t.slice(0, 18), st.min); toast(E.fmtMin(st.min) + 'のタイマーを開始しました'); break; }
      case 'stopTimer': V.timers = V.timers.filter(function (t) { return t.id !== A.id; }); renderTimers(); break;
      case 'cookIng': {
        var rc = V.cook.recipe;
        var h = '<div class="modal" id="modal" data-act="modalBg"><div class="box"><h2>材料と調味料</h2><ul class="list">' + rc.ingredients.map(function (i) { return '<li><span>' + esc(i.name) + '</span><span class="amt">' + esc(i.amount || '') + '</span></li>'; }).join('') + rc.seasonings.map(function (s) { return '<li><span>' + (s.group ? '<span class="grp">' + s.group + '</span>' : '') + esc(short(s.name)) + (s.label ? '<span class="sub">' + esc(s.label) + '</span>' : '') + '</span><span class="amt">' + esc(s.amount) + '</span></li>'; }).join('') + '</ul><button class="btn" data-act="closeModal" style="width:100%;margin-top:10px">閉じる</button></div></div>';
        layer.insertAdjacentHTML('beforeend', h); break;
      }
      case 'help': openHelp(); break;
      case 'helpQ': showHelp(A.id); break;
      case 'helpAsk': { var q = ($('#helpIn') || {}).value || ''; if (q.trim()) askHelpText(q); break; }
      case 'askGpt': { var q2 = (($('#helpIn') || {}).value || '').trim(); showPromptModal('ChatGPTに聞く', E.askPrompt(V.cook.recipe, V.cook.i, q2 || '（ここに質問を書いてください）', ctx({ people: V.detail ? V.detail.people : S.people })), q2 ? '' : '最後の【質問】のところに、聞きたいことを書き足してください。'); break; }
      case 'closeModal': closeModal(); break;
      case 'modalBg': if (ev.target === el) closeModal(); break;
      case 'register': openRegister(null); break;
      case 'closeReg': closeReg(); break;
      case 'rSlot': { $('#rSlot').value = A.v; Array.prototype.forEach.call(document.querySelectorAll('[data-act="rSlot"]'), function (b) { b.classList.toggle('on', b.getAttribute('data-v') === A.v); }); break; }
      case 'parsePaste': {
        var p = E.parsePasted($('#pasteIn').value);
        if (!p.ingredients.length && !p.steps.length) { toast('材料や作り方が見つかりませんでした。「材料」「作り方」の見出しがあるか確認してください', 4000); break; }
        if (p.name) $('#rName').value = p.name;
        $('#rIng').value = p.ingredients.join('\n'); $('#rSteps').value = p.steps.join('\n'); if (p.memo) $('#rMemo').value = p.memo; $('#rServes').value = p.serves;
        toast('読み込みました。内容を確認して保存してください', 3000); break;
      }
      case 'saveReg': {
        var name = $('#rName').value.trim();
        if (!name) { toast('料理名を入れてください'); break; }
        var ing = lines('rIng'), stp = lines('rSteps');
        if (!ing.length || !stp.length) { toast('材料と作り方を1行以上入れてください'); break; }
        var rid = $('#rId').value || uid();
        var rec = { id: rid, name: name, slot: $('#rSlot').value || 'main', serves: Math.max(1, parseInt($('#rServes').value, 10) || 2), minutes: parseInt($('#rMin').value, 10) || 0, ingredients: ing, steps: stp, memo: $('#rMemo').value.trim(), updated: todayStr() };
        var ex = -1; S.userRecipes.forEach(function (u, i) { if (u.id === rid) ex = i; });
        if (ex >= 0) S.userRecipes[ex] = rec; else S.userRecipes.push(rec);
        save(); closeReg(); toast('保存しました。献立の候補にも入ります', 3000);
        if (V.detail && V.detail.key === 'user|' + rid) { rebuildDetail(); renderDetail(); } else render();
        break;
      }
      case 'editUser': { var u = S.userRecipes.filter(function (x) { return x.id === A.id; })[0]; if (u) openRegister(u); break; }
      case 'delUser': if (confirm('このレシピを削除しますか？（元に戻せません）')) { S.userRecipes = S.userRecipes.filter(function (x) { return x.id !== A.id; }); S.favorites = S.favorites.filter(function (f) { return f.key !== 'user|' + A.id; }); save(); closeSheet(); toast('削除しました'); } break;
      case 'rFilter': V.recipeFilter = A.v; render(); break;
      case 'addAvoid': {
        var list = A.list, inEl = $('#' + list + 'In'); var w = inEl ? inEl.value.trim() : '';
        if (!w) break;
        var aid = E.match(w);
        if (!aid) { S.prefs.avoidWords = S.prefs.avoidWords || []; if (S.prefs.avoidWords.indexOf(w) < 0) S.prefs.avoidWords.push(w); save(); render(); toast('「' + w + '」を苦手に入れました（辞書にない食材なので、登録したレシピとChatGPTに貼る文で使います）', 4000); break; }
        if (S.prefs[list].indexOf(aid) < 0) S.prefs[list].push(aid);
        save(); render(); break;
      }
      case 'rmAvoidWord': S.prefs.avoidWords.splice(+A.i, 1); save(); render(); break;
      case 'rmAvoid': S.prefs[A.list] = S.prefs[A.list].filter(function (x) { return x !== A.id; }); save(); render(); break;
      case 'salt': S.prefs.saltLevel = A.v; save(); render(); break;
      case 'export': exportData(true); break;
      case 'exportCopy': exportData(false); break;
      case 'import': {
        var hh = '<div class="modal" id="modal" data-act="modalBg"><div class="box"><h2>データを読み込む</h2><p class="small">書き出したファイルを選ぶか、コピーした文字を貼り付けてください。</p><div class="row"><button class="btn" data-act="pickFile">ファイルを選ぶ</button></div><textarea class="input" id="importText" placeholder="ここに貼り付け" style="margin-top:10px"></textarea><div class="row" style="margin-top:8px"><button class="btn primary" data-act="importPaste">貼り付けた内容を読み込む</button><button class="btn ghost" data-act="closeModal">閉じる</button></div></div></div>';
        layer.insertAdjacentHTML('beforeend', hh); break;
      }
      case 'pickFile': { var fileEl = $('#importFile'); if (fileEl) fileEl.click(); break; }
      case 'importPaste': { var tx = ($('#importText') || {}).value || ''; closeModal(); if (tx.trim()) importText(tx); break; }
      case 'saveGkey': { var kv = (($('#gkeyIn') || {}).value || '').trim(); if (!kv) { toast('キーを貼り付けてください'); break; } if (!/^[A-Za-z0-9_\-]{20,}$/.test(kv)) { toast('キーの形が違うようです。コピーし直してください', 3000); break; } lsSet(GKEY, kv); lsSet(GMODEL, ''); render(); toast('保存しました。「つながるか試す」で確認してください', 3000); break; }
      case 'delGkey': if (confirm('Geminiのキーをこのスマホから消しますか？')) { lsSet(GKEY, ''); lsSet(GMODEL, ''); render(); toast('キーを消しました'); } break;
      case 'testGkey': toast('確認しています…'); geminiAsk('動作確認です。「つながりました」とだけ返してください。').then(function (res) { toast('つながりました（' + res.model + '）', 3500); }, function (e) { alert(geminiError(e)); }); break;
      case 'resetAll': if (confirm('記録・お気に入り・登録したレシピ・設定をすべて消します。元に戻せません。よろしいですか？')) { try { localStorage.removeItem(KEY); localStorage.removeItem(GKEY); localStorage.removeItem(GMODEL); } catch (e) { /* なにもしない */ } S = defaults(); V.results = null; save(); setTab('home'); toast('すべて消しました'); } break;
    }
  });
  document.addEventListener('change', function (ev) {
    var el = ev.target;
    if (el.id === 'importFile' && el.files && el.files[0]) { var fr = new FileReader(); fr.onload = function () { closeModal(); importText(fr.result); }; fr.readAsText(el.files[0]); el.value = ''; return; }
    var act = el.getAttribute('data-act');
    if (act === 'taste') { S.prefs.tastes[el.getAttribute('data-k')] = el.checked; save(); }
    if (act === 'pantry') { var id = el.getAttribute('data-id'); var p = S.prefs.pantry; var i = p.indexOf(id); if (el.checked && i < 0) p.push(id); if (!el.checked && i >= 0) p.splice(i, 1); save(); }
  });
  document.addEventListener('input', function (ev) {
    var el = ev.target;
    if (el.id === 'ingIn') {
      var words = el.value.split(/[、,，\s　]+/); var last = words[words.length - 1];
      var box = $('#sugg'); if (!box) return;
      var ids = last ? E.suggestNames(last, 8) : [];
      box.innerHTML = ids.map(function (id) { return '<button class="pick" data-act="sugg" data-id="' + id + '">' + esc(short(E.ing(id).name)) + '</button>'; }).join('');
    }
    if (el.id === 'recipeSearch') { V.recipeQuery = el.value; var pos = el.selectionStart; render(); var s2 = $('#recipeSearch'); if (s2) { s2.focus(); try { s2.setSelectionRange(pos, pos); } catch (e) { /* なにもしない */ } } }
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' || ev.isComposing) return;
    var el = ev.target;
    if (el.id === 'ingIn' && el.value.trim()) { ev.preventDefault(); addIngredients(el.value); render(); var i2 = $('#ingIn'); if (i2) i2.focus(); }
    if (el.id === 'helpIn' && el.value.trim()) { ev.preventDefault(); askHelpText(el.value); }
    if ((el.id === 'avoidIn' || el.id === 'kidAvoidIn') && el.value.trim()) { ev.preventDefault(); var b = el.parentNode.querySelector('[data-act="addAvoid"]'); if (b) b.click(); }
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') { if (V.cook && !wakeLock) requestWake(); renderTimers(); }
  });

  // ---------- 起動 ----------
  function start(data) {
    E.init(data);
    S = load();
    restoreLast();
    nav.classList.remove('hidden');
    render();
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* オフライン機能なしで動く */ });
    }
  }
  Promise.all(FILES.map(function (f) { return fetch('data/' + f + '.json').then(function (r) { if (!r.ok) throw new Error(f); return r.json(); }); }))
    .then(function (arr) { var d = {}; FILES.forEach(function (f, i) { d[f] = arr[i]; }); start(d); })
    .catch(function () { app.innerHTML = '<div class="loading">データを読み込めませんでした。<br>インターネットにつながっているか確認して、もう一度開いてください。</div>'; });
  window.__yuuhan = { state: function () { return S; }, view: V };
})();
