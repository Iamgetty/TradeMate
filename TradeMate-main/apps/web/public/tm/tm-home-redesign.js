/* TradeMate home redesign (layout + Light and Purple theme palettes).
 * - Home order: header, search, slide banner, quick market overview, Top Categories, Deals of the Day, Favorites.
 * - Floating pill bottom bar (same five buttons), Profile as a bottom sheet with a centred hero.
 * - Light theme: pure white background with an indigo accent. Purple theme: graphite base with a violet accent.
 * - Dark theme is NOT touched: nothing below sets any colour for html[data-theme="dark"]; every layout colour
 *   comes from the theme variables (var(--am), var(--s1) ...).
 * - "Deals of the Day" is read from the same backend call the app already uses: GET /api/market/listings.
 * Runs as a DOM/CSS patch so app.js does not need to change. */
(function () {
  'use strict';
  if (window.__tmHomeRedesign) return;
  window.__tmHomeRedesign = true;

  var H = 'html body #app .view:has(.home-market-shortcuts)';
  var PG = 'html body #pg .pgs[data-id="profile"]';
  var css = [
    /* ---------- Light theme: pure white + indigo (vars only; blue rules are re-tinted by retintLight) ---------- */
    'html[data-theme="light"]{--bg:#FFFFFF;--s1:#F8FAFC;--s2:#EEF2FF;--s3:#E2E8F0;--line:#E2E8F0;--txt:#0F172A;--txt2:#334155;--text:#0F172A;--mut:#586579;--dis:#94A3B8;--am:#4F46E5;--co:#4338CA;--in:#4F46E5;--grad:#4F46E5;--grad2:#4F46E5;--navbg:#FFFFFF;--navsolid:#FFFFFF;--sbbg:#FFFFFF;--card:#FFFFFF;--ongrad:#FFFFFF;--glow:#4F46E533;--scrim:#94A3B8}',
    'html[data-theme="light"],html[data-theme="light"] body{background:#FFFFFF}',
    'html[data-theme="light"] body .tabs button.on:not(#tm-x){color:#4338CA!important}',

    /* ---------- Purple theme: graphite base + violet accent ---------- */
    'html[data-theme="purple"]{--bg:#0F0E15;--s1:#17161F;--s2:#232131;--s3:#2E2C3C;--line:#2E2C3C;--txt:#F3F2F8;--txt2:#D9D6E6;--text:#F3F2F8;--mut:#A8A5B8;--dis:#6F6C80;--am:#A495F8;--co:#8F7EF0;--in:#A495F8;--grad:#A495F8;--grad2:#A495F8;--navbg:#0F0E15;--navsolid:#0F0E15;--sbbg:#0F0E15;--card:#17161F;--ongrad:#14111F;--glow:#A495F833;--scrim:#050409}',
    'html[data-theme="purple"],html[data-theme="purple"] body{background:#0F0E15}',

    /* ---------- Home: order and spacing ---------- */
    H + '{display:flex!important;flex-direction:column;padding-bottom:calc(112px + env(safe-area-inset-bottom,0px))!important}',
    H + '>*{order:30}',
    H + '>.top{order:0}',
    H + '>.home-promo-tbn,' + H + '>.banner{order:1;margin-top:24px!important}',
    H + '>.sc-promo{order:2;margin-top:12px!important;margin-bottom:0!important}',
    H + '>.tm-sec-cats{order:3}',
    H + '>.home-market-shortcuts{order:4}',
    H + '>.tm-sec-deals{order:5}',
    H + '>.tm-deals{order:6}',
    H + '>.tabs{order:7;margin-top:40px!important}',

    /* header: avatar, brand, scan, support, bell on row 1; search on row 2 */
    H + '>.top{display:grid!important;grid-template-columns:auto 1fr auto auto auto;grid-template-areas:"av br sc su bl" "se se se se se";align-items:center;column-gap:8px;row-gap:22px;padding:16px 16px 0!important;border-bottom:0!important}',
    H + '>.top .avb{grid-area:av}',
    H + '>.top .tm-brand{grid-area:br;display:flex;align-items:center;gap:8px;min-width:0}',
    H + '>.top .tm-brand img{width:32px;height:32px;border-radius:10px;object-fit:cover}',
    H + '>.top .tm-brand b{font:800 20px "Bricolage Grotesque","Hanken Grotesk",sans-serif;letter-spacing:-.02em;color:var(--txt)}',
    H + '>.top .ib[data-pg="scan"]{grid-area:sc}',
    H + '>.top .ib[data-pg="support"]{grid-area:su}',
    H + '>.top .ib[data-pg="notif"]{grid-area:bl}',
    H + '>.top .ib{width:44px!important;height:44px!important;border-radius:50%!important;background:var(--s2)!important;display:grid;place-items:center;position:relative}',
    H + '>.top .srch{grid-area:se;display:flex!important;align-items:center;gap:10px;width:100%!important;height:48px!important;border-radius:14px!important;background:transparent!important;border:1px solid var(--line)!important;padding:0 4px 0 14px!important}',
    H + '>.top .srch .tm-go{margin-left:auto;flex:none;width:40px;height:40px;border-radius:12px;background:var(--am);color:var(--ongrad,#1b1006);display:grid;place-items:center}',
    H + '>.top .srch .tm-go svg{width:20px;height:20px;color:inherit!important;stroke:currentColor}',

    /* section headers */
    '.tm-sec{display:flex;justify-content:space-between;align-items:flex-end;margin:40px 16px 16px}',
    '.tm-sec b{display:block;font:800 18px "Bricolage Grotesque","Hanken Grotesk",sans-serif;color:var(--txt)}',
    '.tm-sec small{display:block;font-size:11.5px;font-weight:500;color:var(--mut);margin-top:2px}',
    '.tm-sec .tm-va{background:none;border:0;padding:0;cursor:pointer;font-weight:700;font-size:13px;color:var(--am)}',

    /* Top Categories: the existing contract category buttons as one round-icon row */
    H + '>.home-market-shortcuts{display:flex!important;grid-template-columns:none!important;gap:14px!important;overflow-x:auto;scrollbar-width:none;margin:0!important;padding:0 16px 2px!important}',
    H + '>.home-market-shortcuts::-webkit-scrollbar{display:none}',
    H + '>.home-market-shortcuts .mk-card{flex:none!important;width:68px!important;min-width:0!important;height:auto!important;min-height:0!important;padding:0!important;display:flex!important;flex-direction:column!important;align-items:center!important;gap:7px!important;background:none!important;border:0!important;box-shadow:none!important}',
    H + '>.home-market-shortcuts .mk-ico{width:64px!important;height:64px!important;border-radius:50%!important;background:var(--s2)!important;color:var(--am)!important;display:grid!important;place-items:center!important;border:0!important;box-shadow:none!important}',
    H + '>.home-market-shortcuts .mk-ico svg{width:26px!important;height:26px!important}',
    H + '>.home-market-shortcuts .mk-name{font-size:11px!important;font-weight:600!important;line-height:1.15!important;text-align:center!important;white-space:normal!important;color:var(--txt)!important}',

    /* Deals of the Day */
    '.tm-deals{display:flex;gap:12px;overflow-x:auto;scrollbar-width:none;padding:0 16px 2px}',
    '.tm-deals::-webkit-scrollbar{display:none}',
    '.tm-deal{flex:none;width:150px;cursor:pointer;text-align:left;color:var(--txt)}',
    '.tm-deal .im{position:relative;height:132px;border-radius:16px;background:var(--s1);border:1px solid var(--line);display:grid;place-items:center;color:var(--am)}',
    '.tm-deal .im svg{width:40px;height:40px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}',
    '.tm-deal .bd{position:absolute;top:8px;right:8px;max-width:calc(100% - 16px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:var(--am);color:var(--ongrad,#1b1006);font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px}',
    '.tm-deal .t{font-size:13px;font-weight:600;margin-top:8px;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
    '.tm-deal .p{font-size:14px;font-weight:700;margin-top:2px}',

    /* floating pill bottom bar: same five buttons, same raised centre button */
    'html:not(.tm-desktop) body:not(.tm-desktop) #nav{left:16px!important;right:16px!important;width:auto!important;max-width:none!important;transform:none!important;bottom:calc(16px + env(safe-area-inset-bottom,0px))!important;border:1px solid var(--line)!important;border-radius:34px!important;padding:6px!important;background:var(--navbg)!important}',
    'html:not(.tm-desktop) body:not(.tm-desktop) #nav button.on:not(.plus){background:var(--s2)!important;border-radius:24px}',

    /* Profile as a bottom sheet (content unchanged, hero centred, settings stays top right) */
    '#pg:has(.pgs[data-id="profile"]){pointer-events:none!important}',
    '#pg:has(.pgs[data-id="profile"])::before{content:"";position:fixed;inset:0;z-index:29;background:var(--scrim,#000a);pointer-events:none}',
    PG + '{pointer-events:auto!important;inset:auto 0 0 0!important;margin:0 auto!important;width:min(100%,560px)!important;height:min(88vh,780px)!important;border-radius:32px 32px 0 0!important;border:1px solid var(--line)!important;border-bottom:0!important;z-index:30!important}',
    PG + '::before{content:"";display:block;width:44px;height:5px;border-radius:3px;background:var(--s3);margin:10px auto 0}',
    PG + ' .pt-hero{display:flex!important;flex-direction:column!important;align-items:center!important;text-align:center!important;gap:14px!important}',
    PG + ' .pt-av{width:112px!important;height:112px!important;flex:none}',
    PG + ' .pt-id{display:flex;flex-direction:column;align-items:center;text-align:center}',
    PG + ' .pt-uid,' + PG + ' .pt-pills{justify-content:center}',
    PG + ' .rts .rt{width:44px;height:44px;border-radius:50%;background:var(--s2)}'
  ].join('\n');

  var style = document.createElement('style');
  style.id = 'tm-home-redesign';
  style.textContent = css;
  document.head.appendChild(style);

  /* ---------- Light theme: re-tint the app's hard-coded blue rules to the indigo accent ---------- */
  var MAP = [[/#2563eb/gi, '#4F46E5'], [/#1d4ed8/gi, '#4338CA'], [/#eff6ff/gi, '#EEF2FF'], [/#dbeafe/gi, '#E0E7FF'],
    [/#3b82f6/gi, '#4F46E5'], [/#f5f5f5/gi, '#F8FAFC'], [/rgba\(\s*37\s*,\s*99\s*,\s*235\s*,/gi, 'rgba(79,70,229,']];
  var BLUE = /#2563eb|#1d4ed8|#eff6ff|#dbeafe|#3b82f6|rgba\(\s*37\s*,\s*99\s*,\s*235/i;
  var tintEl = document.createElement('style');
  tintEl.id = 'tm-light-purple';
  document.head.insertBefore(tintEl, style);
  var tintTimer = 0;

  function tint(s) { MAP.forEach(function (m) { s = s.replace(m[0], m[1]); }); return s; }
  function collect(rules, out) {
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      try {
        if (r.type === 1) {
          if (/data-theme="light"|data-theme=light/.test(r.selectorText || '') && BLUE.test(r.cssText)) out.push(tint(r.cssText));
        } else if (r.cssRules && r.type !== 5 && r.type !== 7) {
          var inner = [];
          collect(r.cssRules, inner);
          if (inner.length) out.push(r.cssText.slice(0, r.cssText.indexOf('{')) + '{' + inner.join('') + '}');
        }
      } catch (e) { /* skip */ }
    }
  }
  function retintLight() {
    tintTimer = 0;
    if (document.documentElement.getAttribute('data-theme') !== 'light') { tintEl.textContent = ''; keepLast(); return; }
    var out = [];
    for (var i = 0; i < document.styleSheets.length; i++) {
      var sh = document.styleSheets[i], n = sh.ownerNode;
      if (n && (n.id === 'tm-light-purple' || n.id === 'tm-home-redesign')) continue;
      try { collect(sh.cssRules, out); } catch (e) { /* cross-origin sheet */ }
    }
    tintEl.textContent = out.join('\n');
    keepLast();
  }
  function keepLast() {
    var h = document.head;
    if (h.lastElementChild !== style) { h.appendChild(tintEl); h.appendChild(style); }
  }
  function scheduleTint() { if (!tintTimer) tintTimer = setTimeout(retintLight, 200); }
  try {
    new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++)
        for (var j = 0; j < list[i].addedNodes.length; j++) {
          var id = list[i].addedNodes[j].id;
          if (id !== 'tm-light-purple' && id !== 'tm-home-redesign') { scheduleTint(); return; }
        }
    }).observe(document.head, { childList: true });
    new MutationObserver(scheduleTint).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  } catch (e) { /* observers unavailable */ }
  scheduleTint(); setTimeout(scheduleTint, 900); setTimeout(scheduleTint, 2800); setTimeout(scheduleTint, 6000);

  /* ---------- Home enhancements ---------- */
  var LOGO = '/tm/img/logo.png';
  var CSYM = { NGN: '\u20A6', USD: '$', EUR: '\u20AC', GBP: '\u00A3', GHS: '\u20B5', KES: 'KSh' };
  var DIVL = { services: 'Services', b2b: 'B2B', real_estate: 'Real Estate', software: 'Technology', industrial_trade: 'Industrial',
    agriculture: 'Agriculture', finance_investment: 'Finance', institution_infrastructure: 'Institution', sports: 'Sports Transfer', entertainment: 'Art' };
  var DIVK = { services: 'Services', real_estate: 'Real Estate', software: 'Software', industrial_trade: 'Industrial & Trade',
    agriculture: 'Agriculture', sports: 'Sports', entertainment: 'Entertainment' };
  var FALLBACK_ICON = '<path d="M3 12l9-9h8v8l-9 9z"/><circle cx="15.5" cy="8.5" r="1.2"/>';
  var TTL = 60000, deals = null, dealsAt = 0, flight = null;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function head(cls, title, sub) {
    var d = el('div', 'tm-sec ' + cls), l = el('div');
    l.appendChild(el('b', null, title));
    if (sub) l.appendChild(el('small', null, sub));
    d.appendChild(l);
    var b = el('button', 'tm-va', 'View all');
    b.type = 'button';
    b.setAttribute('data-tab', 'Markets'); /* Explore contracts */
    d.appendChild(b);
    return d;
  }
  function price(l) {
    var n = Number(l.price_minor_units) / 100;
    if (!isFinite(n)) return '';
    return (CSYM[l.currency_code] || l.currency_code || '') + ' ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function build(list) {
    var seen = {};
    return list.filter(function (l) { return l && l.title; }).slice(0, 8).map(function (l) {
      var name = l.title, i = 2;
      while (seen[name]) name = l.title + ' (' + i++ + ')'; /* same de-duplication the app applies */
      seen[name] = 1;
      return { name: name, title: l.title, price: price(l), div: l.division || '' };
    });
  }
  function loadDeals() {
    if (deals && Date.now() - dealsAt < TTL) return;
    if (flight) return;
    flight = fetch('/api/market/listings?limit=50', { cache: 'no-store', credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('bad status'); return r.json(); })
      .then(function (d) { deals = build((d && d.data) || []); dealsAt = Date.now(); })
      .catch(function () { if (!deals) deals = []; dealsAt = Date.now() - TTL + 15000; })
      .then(function () { flight = null; enhance(); });
  }
  function dealCard(d, view) {
    var c = el('div', 'tm-deal');
    c.setAttribute('role', 'button'); c.tabIndex = 0;
    c.setAttribute('data-open', d.name);
    var im = el('div', 'im');
    var bd = DIVL[d.div];
    if (bd) im.appendChild(el('span', 'bd', bd));
    var src = DIVK[d.div] && view.querySelector('.home-market-shortcuts .mk-card[data-mm="' + DIVK[d.div].replace(/"/g, '') + '"] .mk-ico svg');
    if (src) im.appendChild(src.cloneNode(true));
    else { var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.innerHTML = FALLBACK_ICON; im.appendChild(s); }
    c.appendChild(im);
    c.appendChild(el('div', 't', d.title));
    if (d.price) c.appendChild(el('div', 'p', d.price));
    return c;
  }
  function enhance() {
    var v = document.querySelector('#app .view');
    var sc = v && v.querySelector('.home-market-shortcuts');
    if (!sc) return;
    var top = v.querySelector('.top');
    if (top) {
      var av = top.querySelector('.avb');
      if (av && !top.querySelector('.tm-brand')) {
        var br = el('div', 'tm-brand'), im = el('img'); im.src = LOGO; im.alt = '';
        im.onerror = function () { im.style.display = 'none'; };
        br.appendChild(im); br.appendChild(el('b', null, 'TradeMate'));
        top.insertBefore(br, av.nextSibling);
      }
      var s = top.querySelector('.srch');
      if (s && !s.querySelector('.tm-go')) {
        var g = el('span', 'tm-go'), ico = s.querySelector('svg');
        g.setAttribute('aria-hidden', 'true');
        if (ico) g.appendChild(ico.cloneNode(true));
        s.appendChild(g);
      }
    }
    if (!v.querySelector('.tm-sec-cats')) v.insertBefore(head('tm-sec-cats', 'Top Categories'), sc);
    loadDeals();
    var have = v.querySelector('.tm-deals'), hd = v.querySelector('.tm-sec-deals');
    if (!deals || !deals.length) { if (have) have.remove(); if (hd) hd.remove(); return; }
    if (!hd) { hd = head('tm-sec-deals', 'Deals of the Day', 'Top trending on TradeMate'); sc.after(hd); }
    if (!have) { have = el('div', 'tm-deals'); hd.after(have); }
    var key = deals.map(function (d) { return d.name + '|' + d.price; }).join('~');
    if (have.getAttribute('data-key') !== key) {
      have.textContent = '';
      deals.forEach(function (d) { have.appendChild(dealCard(d, v)); });
      have.setAttribute('data-key', key);
    }
  }

  var raf = 0;
  function schedule() { if (!raf) raf = requestAnimationFrame(function () { raf = 0; enhance(); }); }
  function start() {
    var app = document.getElementById('app');
    if (!app) { setTimeout(start, 200); return; }
    new MutationObserver(schedule).observe(app, { childList: true, subtree: true });
    enhance();
  }
  start();

  /* keyboard activation for deal cards, and tap-outside to close the Profile sheet */
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if ((e.key === 'Enter' || e.key === ' ') && t && t.classList && t.classList.contains('tm-deal')) { e.preventDefault(); t.click(); }
  });
  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'pg' && document.querySelector('#pg .pgs[data-id="profile"]')) {
      var b = document.querySelector('#pg .pgs[data-id="profile"] [data-back]');
      if (b) b.click();
    }
  });
})();
