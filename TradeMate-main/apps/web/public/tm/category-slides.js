/*
 * Category and marketplace pages: replaces the top card ("HIRE AND GET HIRED /
 * 0 listings") with an animated slide of three cards in the Explore (.tbn) style:
 *
 *   1. The category itself, with its trend line and statistics on the same card.
 *   2. Top activities.
 *   3. Promotions (the category's ad slot).
 *
 * Pages: every contract category plus Crypto, Forex and NFTs. P2P has its own
 * page and is not touched.
 *
 * Data is real, never invented:
 *  - Contract categories read /api/market/activity?division=... (14 days of new
 *    listings + enquiries + agreed deals, plus headline stats and top listings).
 *  - Crypto and Forex read the rows already on the page (24h change per asset).
 *  - NFTs read /api/nft-collections (24h volume and sales per collection).
 * With no activity the line stays flat and dashed and the card says so.
 *
 * Runs as a DOM patch so app.js does not need to change.
 */
(function () {
  'use strict';

  // Header title -> how to get its data.
  var PAGES = {
    'Professional Services': { kind: 'div', div: 'services' },
    'Real Estate': { kind: 'div', div: 'real_estate' },
    'Technology': { kind: 'div', div: 'software' },
    'B2B': { kind: 'div', div: 'b2b' },
    'Industrial & Trade': { kind: 'div', div: 'industrial_trade' },
    'Agriculture': { kind: 'div', div: 'agriculture' },
    'Finance & Investment': { kind: 'div', div: 'finance_investment' },
    'Institution & Infrastructure': { kind: 'div', div: 'institution_infrastructure' },
    'Sports Transfer': { kind: 'div', div: 'sports' },
    'Entertainment': { kind: 'div', div: 'entertainment' },
    'Crypto': { kind: 'rows', word: 'assets' },
    'Forex': { kind: 'rows', word: 'pairs' },
    'NFTs': { kind: 'nft' }
  };
  var NFT_COPY = { title: 'Discover NFT collections', sub: 'Live collections across chains.' };
  var TTL = 60000;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var insts = {};       // page title -> instance (kept across the app's redraws)
  var fetched = {};     // key -> { at, data }
  var inflight = {};
  var pausedUntil = 0;
  var gid = 0;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- styles ----------
  var css = document.createElement('style');
  css.id = 'tm-cs-css';
  css.textContent = [
    '.tm-cs{margin:0 16px 14px}',
    '.tm-cs .tbn-s{min-height:0;grid-template-columns:1fr;align-content:start;align-items:start;gap:12px;padding:16px}',
    '@media(min-width:700px){.tm-cs .tbn-s{padding:22px 28px;gap:14px}}',
    '.tm-cs .tbn-list{flex-wrap:wrap}',
    '.tm-cs .tbn-chip b{font-weight:800}',
    '.tm-cs-tagrow{display:flex;align-items:center;justify-content:space-between;gap:10px}',
    '.tm-cs-chart svg{display:block;width:100%;height:84px;overflow:visible}',
    '.tm-cs-cap{display:flex;justify-content:space-between;gap:10px;margin-top:4px;font:500 10px "DM Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}',
    '.tm-cs .gl{stroke:var(--line);stroke-width:1;stroke-dasharray:3 4}',
    '.tm-cs .ln{fill:none;stroke:var(--am);stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:var(--len);stroke-dashoffset:var(--len)}',
    '.tm-cs .ln.flat{stroke-dasharray:4 5;stroke-dashoffset:0;opacity:.55}',
    '.tm-cs .dot{fill:var(--am);opacity:0}',
    '.tm-cs .pulse{fill:none;stroke:var(--am);stroke-width:1.5;opacity:0;transform-box:fill-box;transform-origin:center}',
    '.tm-cs .ar{opacity:0}',
    '.tm-cs-s.live .ln:not(.flat){animation:tmcsDraw 1.3s cubic-bezier(.4,0,.2,1) forwards}',
    '.tm-cs-s.live .ar{animation:tmcsFade .9s .5s both}',
    '.tm-cs-s.live .dot{animation:tmcsFade .4s 1.2s both}',
    '.tm-cs-s.live .pulse{animation:tmcsFade .4s 1.2s both,tmcsPulse 1.9s 1.6s ease-out infinite}',
    '.tm-cs-s.live .tbn-copy>*,.tm-cs-s.live .tm-cs-chart,.tm-cs-s.live .tbn-list>*{animation:tmcsUp .55s both}',
    '.tm-cs-s.live .tbn-copy>*:nth-child(2){animation-delay:.08s}',
    '.tm-cs-s.live .tbn-copy>*:nth-child(3){animation-delay:.16s}',
    '.tm-cs-s.live .tm-cs-chart{animation-delay:.2s}',
    '.tm-cs-s.live .tbn-list>*{animation-delay:.3s}',
    '.tm-cs-s.live .tbn-list>*:nth-child(2){animation-delay:.38s}',
    '.tm-cs-s.live .tbn-list>*:nth-child(3){animation-delay:.46s}',
    '.tm-cs-s.live .tbn-list>*:nth-child(4){animation-delay:.54s}',
    /* a slide that has already played (or was rebuilt by a data refresh) shows its final state */
    '.tm-cs-s.done .ln{stroke-dashoffset:0;stroke-dasharray:none;animation:none}',
    '.tm-cs-s.done .ln.flat{stroke-dasharray:4 5}',
    '.tm-cs-s.done .ar,.tm-cs-s.done .dot{opacity:1;animation:none}',
    '.tm-cs-s.done .pulse{animation:tmcsPulse 1.9s ease-out infinite}',
    '.tm-cs-s.done .tbn-copy>*,.tm-cs-s.done .tm-cs-chart,.tm-cs-s.done .tbn-list>*{animation:none}',
    '@keyframes tmcsDraw{to{stroke-dashoffset:0}}',
    '@keyframes tmcsFade{from{opacity:0}to{opacity:1}}',
    '@keyframes tmcsUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
    '@keyframes tmcsPulse{0%{transform:scale(1);opacity:.6}100%{transform:scale(3.4);opacity:0}}',
    '@media(prefers-reduced-motion:reduce){.tm-cs *{animation:none!important}.tm-cs .ln:not(.flat){stroke-dashoffset:0;stroke-dasharray:none}.tm-cs .ar,.tm-cs .dot{opacity:1}}'
  ].join('\n');
  (document.head || document.documentElement).appendChild(css);

  // ---------- helpers ----------
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function sv(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function plural(n, one, many) { return n === 1 ? one : many; }
  function headline(text) {
    var h = el('h2');
    var words = String(text).trim().split(/\s+/);
    var last = words.pop() || '';
    if (words.length) h.appendChild(document.createTextNode(words.join(' ') + ' '));
    h.appendChild(el('em', null, last));
    return h;
  }
  function fmtNum(n, dec) {
    return Number(n).toLocaleString(undefined, { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 });
  }

  // ---------- the trend line ----------
  function smoothPath(pts) {
    var d = 'M' + pts[0][0].toFixed(1) + ',' + pts[0][1].toFixed(1);
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], mx = ((a[0] + b[0]) / 2).toFixed(1);
      d += ' C' + mx + ',' + a[1].toFixed(1) + ' ' + mx + ',' + b[1].toFixed(1) + ' ' + b[0].toFixed(1) + ',' + b[1].toFixed(1);
    }
    return d;
  }
  // values: numbers; fromZero: scale from 0 (activity counts) instead of min..max (changes)
  function chart(values, fromZero, captionL, captionR) {
    var W = 320, H = 84, T = 8, B = 6;
    var wrap = el('div', 'tm-cs-chart');
    var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    [0.25, 0.6, 0.95].forEach(function (f) {
      var y = (T + (H - T - B) * f).toFixed(1);
      svg.appendChild(sv('line', { x1: 0, x2: W, y1: y, y2: y, 'class': 'gl' }));
    });
    var n = values.length;
    var hi = n ? Math.max.apply(null, values) : 0;
    var lo = fromZero ? 0 : (n ? Math.min.apply(null, values) : 0);
    var flat = !n || !(hi > lo);
    var pts = [];
    if (n < 2) values = [0, 0];
    var m = values.length;
    for (var i = 0; i < m; i++) {
      var v = values[i];
      var y = flat ? (fromZero ? H - B : H / 2) : H - B - ((v - lo) / (hi - lo)) * (H - T - B);
      pts.push([(i * W) / (m - 1), y]);
    }
    var d = smoothPath(pts);
    var id = 'tmcs' + (++gid);
    var len = 0;
    for (var j = 1; j < pts.length; j++) len += Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]);
    len = Math.ceil(len * 1.2) + 12;
    if (!flat) {
      var defs = sv('defs', {});
      var g = sv('linearGradient', { id: id, x1: 0, y1: 0, x2: 0, y2: 1 });
      g.appendChild(sv('stop', { offset: '0%', 'stop-color': 'currentColor', 'stop-opacity': '0.32' }));
      g.appendChild(sv('stop', { offset: '100%', 'stop-color': 'currentColor', 'stop-opacity': '0' }));
      defs.appendChild(g);
      svg.appendChild(defs);
      var area = sv('path', { d: d + ' L' + W + ',' + H + ' L0,' + H + ' Z', 'class': 'ar', fill: 'url(#' + id + ')' });
      area.style.color = 'var(--am)';
      svg.appendChild(area);
    }
    var line = sv('path', { d: d, 'class': 'ln' + (flat ? ' flat' : '') });
    line.style.setProperty('--len', String(len));
    svg.appendChild(line);
    if (!flat) {
      var end = pts[pts.length - 1];
      svg.appendChild(sv('circle', { cx: end[0], cy: end[1], r: 5, 'class': 'pulse' }));
      svg.appendChild(sv('circle', { cx: end[0], cy: end[1], r: 3.5, 'class': 'dot' }));
    }
    wrap.appendChild(svg);
    var cap = el('div', 'tm-cs-cap');
    cap.appendChild(el('span', null, captionL));
    cap.appendChild(el('span', null, flat ? 'No activity yet' : captionR));
    wrap.appendChild(cap);
    return wrap;
  }

  // ---------- chips ----------
  function statChip(value, dec, suffix, sign) {
    var c = el('span', 'tbn-chip');
    var b = el('b', null, '0');
    b.setAttribute('data-count', String(value));
    b.setAttribute('data-dec', String(dec || 0));
    if (sign) b.setAttribute('data-sign', '1');
    c.appendChild(b);
    c.appendChild(el('small', null, suffix));
    return c;
  }
  function moveChip(name, pct, openAttr, openVal) {
    var c = el(openAttr ? 'button' : 'span', 'tbn-chip');
    if (openAttr) { c.type = 'button'; c.setAttribute(openAttr, openVal); }
    c.appendChild(el('b', null, name));
    if (pct != null) c.appendChild(el('small', pct >= 0 ? 'up' : 'dn', (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%'));
    return c;
  }
  function noteChip(text) {
    var c = el('span', 'tbn-chip');
    c.appendChild(el('small', null, text));
    return c;
  }
  function countUp(root) {
    if (reduced) { run(1); return; }
    var start = performance.now(), dur = 900;
    function run(p) {
      var nodes = root.querySelectorAll('[data-count]');
      for (var i = 0; i < nodes.length; i++) {
        var t = Number(nodes[i].getAttribute('data-count')) || 0;
        var dec = Number(nodes[i].getAttribute('data-dec')) || 0;
        var v = t * (1 - Math.pow(1 - p, 3));
        nodes[i].textContent = (nodes[i].hasAttribute('data-sign') && t > 0 ? '+' : '') + fmtNum(v, dec);
      }
    }
    (function step(now) {
      var p = Math.min(1, (now - start) / dur);
      run(p);
      if (p < 1) requestAnimationFrame(step);
    })(start);
  }

  // ---------- data ----------
  function getJson(key, url, shape) {
    var hit = fetched[key];
    if (hit && Date.now() - hit.at < TTL) return Promise.resolve(hit.data);
    if (inflight[key]) return inflight[key];
    inflight[key] = fetch(url, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('bad status'); return r.json(); })
      .then(function (d) { var out = shape(d); fetched[key] = { at: Date.now(), data: out }; return out; })
      .catch(function () { fetched[key] = { at: Date.now() - TTL + 15000, data: 'error' }; return 'error'; })
      .then(function (out) { inflight[key] = null; return out; });
    return inflight[key];
  }

  function readRows(host) {
    var rows = host.querySelectorAll('.row[data-open]');
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var name = rows[i].getAttribute('data-open');
      var badge = rows[i].querySelector('.badge');
      var m = badge && /(-|\u2212)?\d+(\.\d+)?%/.exec(badge.textContent || '');
      out.push({ name: name, pct: m ? parseFloat(m[0].replace('\u2212', '-')) : null });
    }
    return out;
  }

  // ---------- slide contents ----------
  function slideCategory(inst) {
    var s = el('div', 'tbn-s tm-cs-s');
    var copy = el('div', 'tbn-copy');
    var tagRow = el('div', 'tm-cs-tagrow');
    tagRow.appendChild(el('span', 'tbn-tag', inst.key.toUpperCase()));
    if (inst.cfg.kind === 'rows') {
      var live = el('span', 'mk-live');
      live.appendChild(el('i'));
      live.appendChild(document.createTextNode('Live'));
      inst.livePill = live;
      tagRow.appendChild(live);
    }
    copy.appendChild(tagRow);
    copy.appendChild(headline(inst.title));
    copy.appendChild(el('p', null, inst.sub));
    s.appendChild(copy);

    var d = inst.data;
    var values = [], capL = '', capR = '', chips = [];
    if (inst.cfg.kind === 'div') {
      if (d && d !== 'error') {
        values = d.days.map(function (_, i) { return d.series.listings[i] + d.series.enquiries[i] + d.series.deals[i]; });
        capL = 'Activity \u00b7 last ' + d.days.length + ' days';
        capR = 'Today';
        var st = d.stats;
        chips = [
          statChip(st.listings, 0, plural(st.listings, 'listing', 'listings')),
          statChip(st.newThisWeek, 0, 'new this week'),
          statChip(st.enquiries7d, 0, plural(st.enquiries7d, 'enquiry', 'enquiries') + ' \u00b7 7d'),
          statChip(st.deals7d, 0, plural(st.deals7d, 'deal', 'deals') + ' \u00b7 7d')
        ];
      } else capL = d === 'error' ? 'Activity unavailable' : 'Loading activity\u2026';
    } else if (inst.cfg.kind === 'rows') {
      var rows = (d && d !== 'error' ? d : []).filter(function (r) { return r.pct != null; });
      var sorted = rows.slice().sort(function (a, b) { return b.pct - a.pct; });
      values = sorted.slice(0, 14).map(function (r) { return r.pct; });
      capL = '24h change \u00b7 top ' + inst.cfg.word;
      capR = 'Highest to lowest';
      if (rows.length) {
        var up = rows.filter(function (r) { return r.pct >= 0; }).length;
        var avg = rows.reduce(function (t, r) { return t + r.pct; }, 0) / rows.length;
        chips = [
          statChip(rows.length, 0, inst.cfg.word),
          statChip(up, 0, 'up'),
          statChip(rows.length - up, 0, 'down'),
          statChip(Math.round(avg * 100) / 100, 2, 'avg 24h', true)
        ];
      } else capL = 'Waiting for prices\u2026';
    } else {
      if (d && d !== 'error') {
        var vols = d.collections.map(function (c) { return Number(c.volume24h) || 0; }).filter(function (v) { return v > 0; }).sort(function (a, b) { return b - a; });
        values = vols.slice(0, 14);
        capL = '24h volume \u00b7 top collections';
        capR = 'Highest to lowest';
        var totalVol = vols.reduce(function (t, v) { return t + v; }, 0);
        var totalSales = d.collections.reduce(function (t, c) { return t + (Number(c.sales24h) || 0); }, 0);
        chips = [
          statChip(d.collections.length, 0, plural(d.collections.length, 'collection', 'collections')),
          statChip(Math.round(totalVol * 10) / 10, 1, (d.symbol || 'ETH') + ' volume \u00b7 24h'),
          statChip(totalSales, 0, plural(totalSales, 'sale', 'sales') + ' \u00b7 24h')
        ];
      } else capL = d === 'error' ? 'Activity unavailable' : 'Loading activity\u2026';
    }
    s.appendChild(chart(values, inst.cfg.kind === 'div', capL, capR));
    if (chips.length) {
      var list = el('div', 'tbn-list');
      chips.forEach(function (c) { list.appendChild(c); });
      s.appendChild(list);
    }
    return s;
  }

  function listed(title) {
    return !!title && !!document.querySelector('.row[data-open="' + String(title).replace(/["\\]/g, '\\$&') + '"]');
  }

  function slideTop(inst) {
    var s = el('div', 'tbn-s tm-cs-s');
    var copy = el('div', 'tbn-copy');
    copy.appendChild(el('span', 'tbn-tag', 'TOP ACTIVITY \u00b7 ' + inst.key.toUpperCase()));
    copy.appendChild(headline('What\u2019s moving'));
    var d = inst.data, chips = [], sub;
    if (inst.cfg.kind === 'div') {
      if (d && d !== 'error' && d.top.length) {
        sub = 'Most-enquired listings in the past 7 days.';
        d.top.forEach(function (t) {
          var c = el(listed(t.title) ? 'button' : 'span', 'tbn-chip');
          if (c.tagName === 'BUTTON') { c.type = 'button'; c.setAttribute('data-open', t.title); }
          c.appendChild(el('b', null, t.title));
          c.appendChild(el('small', 'up', t.enquiries + ' ' + plural(t.enquiries, 'enquiry', 'enquiries')));
          chips.push(c);
        });
      } else if (d && d !== 'error' && d.recent.length) {
        sub = 'No enquiries this week yet. Newest listings:';
        d.recent.forEach(function (t) {
          var c = el(listed(t.title) ? 'button' : 'span', 'tbn-chip');
          if (c.tagName === 'BUTTON') { c.type = 'button'; c.setAttribute('data-open', t.title); }
          c.appendChild(el('b', null, t.title));
          c.appendChild(el('small', null, 'New'));
          chips.push(c);
        });
      } else {
        sub = d === 'error' ? 'Activity is unavailable right now.' : (d ? 'No activity yet. Be the first to publish here.' : 'Loading\u2026');
        chips.push(noteChip(d && d !== 'error' ? 'No activity yet' : '\u2026'));
      }
    } else if (inst.cfg.kind === 'rows') {
      var rows = (d && d !== 'error' ? d : []).filter(function (r) { return r.pct != null; })
        .sort(function (a, b) { return Math.abs(b.pct) - Math.abs(a.pct); }).slice(0, 3);
      sub = rows.length ? 'Biggest 24h moves right now.' : 'Waiting for prices\u2026';
      rows.forEach(function (r) { chips.push(moveChip(r.name, r.pct, 'data-open', r.name)); });
      if (!rows.length) chips.push(noteChip('\u2026'));
    } else {
      var cols = d && d !== 'error' ? d.collections.slice().sort(function (a, b) { return (Number(b.sales24h) || 0) - (Number(a.sales24h) || 0); }).filter(function (c) { return Number(c.sales24h) > 0; }).slice(0, 3) : [];
      sub = cols.length ? 'Most sales in the past 24 hours.' : (d === 'error' ? 'Activity is unavailable right now.' : 'No sales reported yet.');
      cols.forEach(function (c) {
        var chip = el(c.slug ? 'button' : 'span', 'tbn-chip');
        if (c.slug) { chip.type = 'button'; chip.setAttribute('data-nft-collection', c.slug); }
        chip.appendChild(el('b', null, c.name || c.slug || 'Collection'));
        chip.appendChild(el('small', 'up', c.sales24h + ' ' + plural(Number(c.sales24h), 'sale', 'sales')));
        chips.push(chip);
      });
      if (!cols.length) chips.push(noteChip('No sales yet'));
    }
    copy.appendChild(el('p', null, sub));
    s.appendChild(copy);
    var list = el('div', 'tbn-list');
    chips.forEach(function (c) { list.appendChild(c); });
    s.appendChild(list);
    return s;
  }

  function slidePromo(inst) {
    var s = el('div', 'tbn-s tm-cs-s');
    s.setAttribute('data-pg', 'advertise'); // tapping the card opens the Advertise page
    var copy = el('div', 'tbn-copy');
    copy.appendChild(el('span', 'tbn-tag', 'PROMOTION \u00b7 ' + inst.key.toUpperCase()));
    copy.appendChild(headline('Your promotion could appear here'));
    copy.appendChild(el('p', null, 'Reserved for ' + inst.key + ' contracts and announcements.'));
    s.appendChild(copy);
    var list = el('div', 'tbn-list');
    var c = el('span', 'tbn-chip');
    c.appendChild(el('b', null, 'Zero contract fees'));
    c.appendChild(el('small', 'up', 'first offer free this month'));
    list.appendChild(c);
    s.appendChild(list);
    return s;
  }

  // ---------- instance ----------
  function setActive(inst, i) {
    var dots = inst.root.querySelectorAll('.tbn-dots i');
    for (var k = 0; k < dots.length; k++) dots[k].className = k === i ? 'on' : '';
    var slides = inst.track.children;
    for (var s = 0; s < slides.length; s++) {
      if (s === i) {
        if (!slides[s].classList.contains('live')) {
          slides[s].classList.remove('done');
          void slides[s].offsetWidth; // restart the animations each time the slide comes into view
          slides[s].classList.add('live');
          countUp(slides[s]);
          (function (node) { setTimeout(function () { node.classList.add('done'); }, 2400); })(slides[s]);
        }
      } else slides[s].classList.remove('live');
    }
  }
  function goTo(inst, i, smooth) {
    if (!inst.track.clientWidth) return;
    inst.index = (i % 3 + 3) % 3;
    inst.track.scrollTo({ left: inst.index * inst.track.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
    setActive(inst, inst.index);
  }

  function render(inst, settled) {
    var keep = inst.track.scrollLeft;
    inst.track.textContent = '';
    [slideCategory(inst), slideTop(inst), slidePromo(inst)].forEach(function (s, i) {
      if (settled) { s.classList.add('done'); countFinal(s); }
      inst.track.appendChild(s);
    });
    inst.track.scrollLeft = keep;
    if (!settled) { inst.root.removeAttribute('data-ready'); }
  }
  function countFinal(slide) {
    var nodes = slide.querySelectorAll('[data-count]');
    for (var i = 0; i < nodes.length; i++) {
      var t = Number(nodes[i].getAttribute('data-count')) || 0;
      var dec = Number(nodes[i].getAttribute('data-dec')) || 0;
      nodes[i].textContent = (nodes[i].hasAttribute('data-sign') && t > 0 ? '+' : '') + fmtNum(t, dec);
    }
  }

  function create(key, cfg) {
    var inst = { key: key, cfg: cfg, title: key, sub: '', data: null, index: 0, sig: '' };
    var root = el('div', 'tbn tm-cs');
    root.setAttribute('role', 'region');
    root.setAttribute('aria-roledescription', 'carousel');
    root.setAttribute('aria-label', key + ' trends, top activity and promotions');
    inst.root = root;
    inst.track = el('div', 'tbn-track');
    root.appendChild(inst.track);
    var dots = el('div', 'tbn-dots');
    for (var i = 0; i < 3; i++) {
      (function (n) {
        var d = el('i');
        d.setAttribute('role', 'button');
        d.setAttribute('aria-label', 'Slide ' + (n + 1));
        d.addEventListener('click', function (ev) { ev.stopPropagation(); pausedUntil = Date.now() + 10000; goTo(inst, n, true); });
        dots.appendChild(d);
      })(i);
    }
    root.appendChild(dots);
    var raf = 0;
    inst.track.addEventListener('scroll', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        if (!inst.track.clientWidth) return;
        var i = Math.round(inst.track.scrollLeft / inst.track.clientWidth);
        if (i !== inst.index) { inst.index = i; setActive(inst, i); }
      });
    }, { passive: true });
    ['pointerdown', 'touchstart', 'wheel'].forEach(function (ev) {
      root.addEventListener(ev, function () { pausedUntil = Date.now() + 10000; }, { passive: true });
    });
    render(inst, false);
    load(inst);
    return inst;
  }

  function load(inst) {
    if (inst.cfg.kind === 'div') {
      getJson('div:' + inst.cfg.div, '/api/market/activity?division=' + encodeURIComponent(inst.cfg.div), function (d) {
        return { days: d.days || [], series: d.series || { listings: [], enquiries: [], deals: [] }, stats: d.stats || { listings: 0, newThisWeek: 0, enquiries7d: 0, deals7d: 0 }, top: d.top || [], recent: d.recent || [] };
      }).then(function (data) { apply(inst, data); });
    } else if (inst.cfg.kind === 'nft') {
      getJson('nft', '/api/nft-collections?chain=ethereum&limit=48', function (d) {
        var cols = Array.isArray(d.collections) ? d.collections : [];
        return { collections: cols, symbol: (cols[0] && cols[0].volume24hSymbol) || 'ETH' };
      }).then(function (data) { apply(inst, data); });
    }
  }
  function apply(inst, data) {
    inst.data = data;
    var settled = inst.root.getAttribute('data-ready') === '1';
    render(inst, settled);
    inst.root.setAttribute('data-ready', '1');
    if (inst.root.isConnected) { inst.track.scrollLeft = inst.index * inst.track.clientWidth; if (!settled) setActive(inst, inst.index); }
  }

  // ---------- mounting on the app's pages ----------
  function pageHost() {
    var h = document.querySelector('.pgs header.ph h2') || document.querySelector('header.ph h2');
    return h ? { title: h.textContent.trim(), host: h.closest('.pgs') || document } : null;
  }

  function patch() {
    var page = pageHost();
    if (!page) return;
    var cfg = PAGES[page.title];
    if (!cfg) return; // P2P and every other page are left alone
    var host = page.host;
    var hero = host.querySelector('.mk-hero:not(.tm-cs)');
    var inst = insts[page.title];
    var anchor, parent;
    if (cfg.kind === 'nft') {
      var hub = host.querySelector('.nft-hub');
      if (!hub) return;
      if (hub.previousElementSibling && hub.previousElementSibling.classList.contains('tm-cs')) return;
      anchor = hub; parent = hub.parentNode;
    } else {
      if (!hero) return;
      anchor = hero; parent = hero.parentNode;
    }
    if (!inst) {
      inst = insts[page.title] = create(page.title, cfg);
      if (cfg.kind === 'nft') { inst.title = NFT_COPY.title; inst.sub = NFT_COPY.sub; render(inst, false); }
    }
    if (hero) {
      var h1 = hero.querySelector('.mk-hero-tx h1'), p = hero.querySelector('.mk-hero-tx p');
      var title = h1 ? h1.textContent.trim() : '', sub = p ? p.textContent.trim() : '';
      if (title && (title !== inst.title || sub !== inst.sub)) { inst.title = title; inst.sub = sub; render(inst, inst.root.getAttribute('data-ready') === '1'); }
      var pill = hero.querySelector('.mk-live');
      if (pill && inst.livePill) { inst.livePill.className = pill.className; inst.livePill.lastChild.textContent = pill.textContent; }
    }
    parent.insertBefore(inst.root, anchor);
    if (hero) hero.remove();
    // a node that was detached by a redraw starts back at slide 1: put it where it was
    inst.track.scrollLeft = inst.index * inst.track.clientWidth;
    setActive(inst, inst.index);
    if (cfg.kind === 'rows') refreshRows(inst, host);
  }

  // Crypto and Forex have no API of their own here: read the rows on the page.
  function refreshRows(inst, host) {
    var rows = readRows(host);
    var sig = rows.map(function (r) { return r.name + ':' + r.pct; }).join('|');
    if (sig === inst.sig) return;
    inst.sig = sig;
    inst.data = rows;
    render(inst, inst.root.getAttribute('data-ready') === '1');
    inst.root.setAttribute('data-ready', '1');
    inst.track.scrollLeft = inst.index * inst.track.clientWidth;
  }

  // Auto-advance every 5s; pauses while the person is interacting or the tab is hidden.
  setInterval(function () {
    if (reduced || document.hidden || Date.now() < pausedUntil) return;
    var live = document.querySelector('.tm-cs');
    if (!live) return;
    for (var k in insts) if (insts[k].root === live) { goTo(insts[k], insts[k].index + 1, true); return; }
  }, 5000);

  function start() {
    patch();
    new MutationObserver(patch).observe(document.documentElement, { childList: true, subtree: true });
  }
  start();
})();
