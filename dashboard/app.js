// Token Radar's dashboard. It reads window.RADAR (written beside dashboard/
// by main.ts) and renders the ranked board, a filterable table, and a
// per-protocol detail view with the model's own inputs and the farm plan.
// No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  var app = document.getElementById('app');
  var dialog = document.getElementById('detail');
  if (!DATA || !app) return;

  var state = { q: '', category: 'all', chain: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) { return (Math.round(n * 10000) / 10000).toFixed(4); }

  // The model, recomputed in the page from the same snapshot figures, so the
  // detail view can check the number board.json carries.
  function impliedOf(row, model) {
    var g = row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d;
    g = Math.min(model.growth_cap, Math.max(model.growth_floor, g));
    var growth = 1 + model.growth_weight * Math.tanh(g / 100);
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var logAge = Math.log1p(Math.max(age, 0)) / Math.log1p(model.maturity_days);
    var maturity = Math.min(model.maturity_cap, model.maturity_floor + model.maturity_range * logAge);
    var breadth = model.breadth_floor + model.breadth_step * Math.min((row.chains || []).length, model.breadth_max_chains);
    return Math.max(1, Math.round(row.tvl_usd * model.base_multiple * growth * maturity * breadth));
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var p = new URLSearchParams(hash);
    if (p.get('q')) state.q = p.get('q');
    if (p.get('category')) state.category = p.get('category');
    if (p.get('chain')) state.chain = p.get('chain');
    if (p.get('tab')) state.tab = p.get('tab');
    if (p.get('p')) state.selected = p.get('p');
  }
  function writeHash() {
    var p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.category !== 'all') p.set('category', state.category);
    if (state.chain !== 'all') p.set('chain', state.chain);
    if (state.tab !== 'pre-token') p.set('tab', state.tab);
    if (state.selected) p.set('p', state.selected);
    var next = p.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortValue(r, key) {
    if (key === 'name') return r.name.toLowerCase();
    if (key === 'tvl') return r.tvl_usd;
    if (key === 'growth') return r.change_7d === null ? -Infinity : r.change_7d;
    if (key === 'age') return r.age_days === null ? Infinity : r.age_days;
    return r.implied_value_usd;
  }
  function sortedRows(list) {
    var key = state.sort, dir = state.dir;
    return list.slice().sort(function (a, b) {
      var av = sortValue(a, key), bv = sortValue(b, key);
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function sortBtn(key, label) {
    var arrow = state.sort === key ? (state.dir < 0 ? ' &#9660;' : ' &#9650;') : '';
    return '<th scope="col"><button type="button" data-sort="' + key + '">' + label + arrow + '</button></th>';
  }

  function boardRowsHtml(list) {
    var max = 1;
    list.forEach(function (r) { if (r.implied_value_usd > max) max = r.implied_value_usd; });
    return list.map(function (r) {
      var g = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var gCls = r.change_7d === null ? '' : r.change_7d >= 0 ? 'up' : 'down';
      var chains = (r.chains || []).slice(0, 2).join(', ') || 'an unnamed chain';
      var pct = Math.max(3, Math.round((r.implied_value_usd / max) * 100));
      return '<tr data-slug="' + esc(r.slug) + '" data-selected="' + (state.selected === r.slug) + '" tabindex="0">' +
        '<td class="num">' + r.rank + '</td>' +
        '<td><span class="pname"><b>' + esc(r.name) + '</b><span>' + esc(r.category || 'Other') + ' on ' + esc(chains) + '</span></span></td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="num ' + gCls + '">' + g + '</td>' +
        '<td class="num">' + fmtAge(r.age_days) + '</td>' +
        '<td><span class="ival"><span class="vbar" aria-hidden="true"><i style="width:' + pct + '%"></i></span><span class="num">' + fmtUsd(r.implied_value_usd) + '</span></span></td>' +
        '<td><span class="pill">records no token</span></td></tr>';
    }).join('');
  }

  function boardTableHtml() {
    var list = sortedRows(filteredRows());
    if (list.length === 0) {
      return '<div class="card"><div class="empty"><h2>No protocol matches that filter</h2>' +
        '<p>Clear the search or pick another category to see the board again.</p>' +
        '<button class="btn primary" type="button" data-clear="1">Clear filters</button></div></div>';
    }
    return '<div class="card"><div class="scroll"><table>' +
      '<caption>Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.</caption>' +
      '<thead><tr>' + sortBtn('implied', 'Rank') + sortBtn('name', 'Protocol') + sortBtn('tvl', 'TVL') +
      sortBtn('growth', '7d') + sortBtn('age', 'Age') + sortBtn('implied', 'Implied value') +
      '<th scope="col">Token</th></tr></thead>' +
      '<tbody>' + boardRowsHtml(list) + '</tbody></table></div></div>';
  }

  function liveTableHtml() {
    var rows = DATA.live.map(function (r) {
      var g = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var gCls = r.change_7d !== null && r.change_7d >= 0 ? 'up' : 'down';
      var chains = (r.chains || []).slice(0, 2).join(', ') || 'an unnamed chain';
      return '<tr><td class="num">live</td>' +
        '<td><span class="pname"><b>' + esc(r.name) + '</b><span>' + esc(r.category || 'Other') + ' on ' + esc(chains) + '</span></span></td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="num ' + gCls + '">' + g + '</td>' +
        '<td class="num">' + fmtUsd(r.mcap_usd) + '</td>' +
        '<td><span class="pill live">already trades</span></td></tr>';
    }).join('');
    return '<div class="card"><div class="scroll"><table>' +
      '<caption>Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.</caption>' +
      '<thead><tr><th scope="col">Status</th><th scope="col">Protocol</th><th scope="col">TVL</th>' +
      '<th scope="col">7d</th><th scope="col">Market cap</th><th scope="col">Token</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div></div>';
  }

  function modelHtml() {
    var m = DATA.model;
    return '<section class="card model"><h2>How implied value is computed</h2>' +
      '<p>Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.</p>' +
      '<div class="formula">implied = round( tvl_usd x <b>' + m.base_multiple + '</b> x (1 + <b>' + m.growth_weight + '</b> x tanh(clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100)) x min(<b>' + m.maturity_cap + '</b>, <b>' + m.maturity_floor + '</b> + <b>' + m.maturity_range + '</b> x ln(1 + age_days) / ln(1 + ' + m.maturity_days + ')) x (<b>' + m.breadth_floor + '</b> + <b>' + m.breadth_step + '</b> x min(chains, ' + m.breadth_max_chains + ')) )</div>' +
      '<p>Growth saturates: a week of extreme inflow is usually a low base or one large deposit, so the first tens of per cent matter most and an extreme week cannot crown a protocol on its own. Maturity is logarithmic: the first year a protocol survives with no token on record is the informative part, and later years add evidence more slowly. Breadth counts chains: a protocol live on several chains has spread its distribution and is less hostage to one chain. Age is the time since the protocol was first listed; an unlisted age uses ' + m.unknown_age_days + ' days.</p></section>';
  }

  function render() {
    var cats = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var catOpts = '<option value="all">All categories</option>' + cats.map(function (c) {
      return '<option value="' + esc(c) + '"' + (c === state.category ? ' selected' : '') + '>' + esc(c) + '</option>';
    }).join('');
    var chainOpts = '<option value="all">All chains</option>' + chains.map(function (c) {
      return '<option value="' + esc(c) + '"' + (c === state.chain ? ' selected' : '') + '>' + esc(c) + '</option>';
    }).join('');
    var shown = state.tab === 'pre-token' ? filteredRows().length : DATA.live.length;

    app.innerHTML =
      '<div class="wrap">' +
      '<header class="mast"><div class="brand"><span class="dot"></span><span class="brand-name">Token Radar</span></div>' +
      '<div class="meta"><span>Snapshot <b>' + esc(DATA.as_of) + '</b></span><span>DefiLlama protocol index</span><span><b>' + esc(DATA.model_version) + '</b> model</span></div></header>' +
      '<section class="intro"><div><h1>' + DATA.watchlist_size + ' watchlist protocols, ranked by implied value</h1>' +
      '<p>The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL that records no token. The early radar adds ' + DATA.early_size + ' pre-token protocols the list leaves out, below the floor and above it. Implied value is a model, not a promise — and a protocol on this board records no token; it is never claimed to have none.</p></div>' +
      '<div class="stats">' +
      '<div class="stat"><span>Watchlist covered</span><b>' + DATA.watchlist_size + ' / ' + DATA.watchlist_size + '</b></div>' +
      '<div class="stat"><span>Pre-token rows scored</span><b>' + DATA.board_size + '</b></div>' +
      '<div class="stat"><span>Early rows beyond the watchlist</span><b>' + DATA.early_size + '</b></div>' +
      '<div class="stat"><span>Live-token protocols set aside</span><b>' + DATA.live_size + '</b></div>' +
      '</div></section>' +
      '<div class="controls">' +
      '<div class="field"><label for="q">Search</label><input type="search" id="q" placeholder="Search name, category or chain" value="' + esc(state.q) + '" aria-label="Search the board"></div>' +
      '<div class="field"><label for="category">Category</label><select id="category" aria-label="Filter by category">' + catOpts + '</select></div>' +
      '<div class="field"><label for="chain">Chain</label><select id="chain" aria-label="Filter by chain">' + chainOpts + '</select></div>' +
      '<div class="field"><label>Token status</label><div class="tabs">' +
      '<button type="button" data-tab="pre-token" aria-pressed="' + (state.tab === 'pre-token') + '">Pre-token</button>' +
      '<button type="button" data-tab="live" aria-pressed="' + (state.tab === 'live') + '">Live token</button>' +
      '</div></div>' +
      '<span class="showing">' + shown + (state.tab === 'pre-token' ? ' rows shown' : ' live-token protocols') + '</span>' +
      '</div>' +
      (state.tab === 'pre-token' ? boardTableHtml() : liveTableHtml()) +
      (state.tab === 'pre-token' ? modelHtml() : '') +
      '<p class="note">Data: the sealed snapshot as of ' + esc(DATA.as_of) + '. Implied values are this entry\u2019s own claim, derived only from the snapshot\u2019s figures; they are not a prediction that a token will be issued, or when.</p>' +
      '</div>';

    var q = document.getElementById('q');
    if (q) q.addEventListener('input', function () { state.q = q.value; writeHash(); render(); });
    var cat = document.getElementById('category');
    if (cat) cat.addEventListener('change', function () { state.category = cat.value; writeHash(); render(); });
    var ch = document.getElementById('chain');
    if (ch) ch.addEventListener('change', function () { state.chain = ch.value; writeHash(); render(); });
    if (state.selected) openDetail(state.selected, false);
  }

  function openDetail(slug, focus) {
    var row = null;
    DATA.rows.forEach(function (r) { if (r.slug === slug) row = r; });
    if (!row) return;
    state.selected = slug;
    writeHash();
    var recomputed = impliedOf(row, DATA.model);
    var agrees = recomputed === row.implied_value_usd;
    var steps = (row.farm_steps || []).map(function (s) {
      var at = s.indexOf(' Cost: ');
      var action = at >= 0 ? s.slice(0, at) : s;
      var tail = at >= 0 ? s.slice(at + 1) : '';
      return '<li><b>' + esc(action) + '</b><span class="cost">' + esc(tail) + '</span></li>';
    }).join('');
    dialog.innerHTML =
      '<div class="dhead"><div><span class="rankline">Rank ' + row.rank + ' of ' + DATA.board_size + '</span>' +
      '<h2 id="detail-title">' + esc(row.name) + '</h2>' +
      '<p class="sub">' + esc(row.category || 'Other') + ' on ' + esc((row.chains || []).join(', ') || 'an unnamed chain') + '</p></div>' +
      '<button class="close" type="button" data-close="1" aria-label="Close details">Close</button></div>' +
      '<section class="dsec"><h3>Implied value</h3><div class="kv">' +
      '<div><span>TVL</span><b>' + fmtUsd(row.tvl_usd) + '</b></div>' +
      '<div><span>Seven-day growth</span><b>' + fmtPct(row.change_7d) + '</b></div>' +
      '<div><span>Age with no token on record</span><b>' + fmtAge(row.age_days) + '</b></div>' +
      '<div><span>Chains</span><b>' + (row.chains || []).length + '</b></div>' +
      '<div><span>Growth multiplier</span><b>' + fmtMult(row.growth_multiplier) + '</b></div>' +
      '<div><span>Maturity multiplier</span><b>' + fmtMult(row.maturity_multiplier) + '</b></div>' +
      '<div><span>Breadth multiplier</span><b>' + fmtMult(row.breadth_multiplier) + '</b></div>' +
      '<div><span>Implied value</span><b>' + fmtUsd(row.implied_value_usd) + '</b></div>' +
      '</div><p class="check">Model ' + esc(DATA.model_version) + ': the page recomputes this row as ' + fmtUsd(recomputed) +
      (agrees ? ', the same number the board carries.' : ', which differs from the board: the data would be stale.') +
      ' This is an estimate, not a price.</p></section>' +
      '<section class="dsec"><h3>Farm plan</h3><ol class="steps">' + steps + '</ol></section>';
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    if (focus !== false) {
      var btn = dialog.querySelector('[data-close]');
      if (btn) btn.focus();
    }
  }

  function closeDetail() {
    state.selected = null;
    writeHash();
    if (dialog.open) dialog.close();
    render();
  }

  app.addEventListener('click', function (e) {
    var sortBtnEl = e.target.closest('[data-sort]');
    if (sortBtnEl) {
      var key = sortBtnEl.getAttribute('data-sort');
      if (state.sort === key) state.dir = -state.dir;
      else { state.sort = key; state.dir = -1; }
      render();
      return;
    }
    var tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) { state.tab = tabBtn.getAttribute('data-tab'); render(); return; }
    var clearBtn = e.target.closest('[data-clear]');
    if (clearBtn) { state.q = ''; state.category = 'all'; state.chain = 'all'; writeHash(); render(); return; }
    var tr = e.target.closest('tr[data-slug]');
    if (tr) openDetail(tr.getAttribute('data-slug'));
  });
  app.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr[data-slug]')) {
      e.preventDefault();
      openDetail(e.target.getAttribute('data-slug'));
    }
  });
  dialog.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) closeDetail();
  });
  dialog.addEventListener('close', function () {
    if (state.selected !== null) { state.selected = null; writeHash(); }
  });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) closeDetail();
  });

  readHash();
  render();
})();
