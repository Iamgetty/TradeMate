/*
 * Category pages: turns the top card (title + "N listings") into a four-slide
 * ad banner for that category: Trending now, Top contract, Best seller,
 * Weekly trending. The listing counts are removed. NFTs get the banner too;
 * P2P has its own page and is not affected. Forex and Crypto keep their
 * plain card (live prices have no sellers or contracts) minus the counts.
 *
 * Runs as a DOM patch so app.js does not need to change.
 *  - Marketplace categories read /api/market/highlights?division=...
 *  - NFTs read /api/nft-collections (the same feed the NFT page uses).
 * A slide with no real activity shows an honest empty state, never made-up data.
 */
(function () {
  'use strict';

  // Page title (as shown in the header) -> API division, or 'nft'.
  var CATS = {
    'Professional Services': 'services',
    'Real Estate': 'real_estate',
    'Technology': 'software',
    'B2B': 'b2b',
    'Industrial & Trade': 'industrial_trade',
    'Agriculture': 'agriculture',
    'Finance & Investment': 'finance_investment',
    'Institution & Infrastructure': 'institution_infrastructure',
    'Sports Transfer': 'sports',
    'Entertainment': 'entertainment',
    'NFTs': 'nft'
  };
  var KINDS = [
    { key: 'trending', label: 'Trending now', icon: 'uprt' },
    { key: 'topContract', label: 'Top contract', icon: 'box' },
    { key: 'bestSeller', label: 'Best seller', icon: 'trophy' },
    { key: 'weeklyTrending', label: 'Weekly trending', icon: 'cal' }
  ];
  var EMPTY = {
    trending: ['Nothing trending yet', 'Listings with the most enquiries in the last 24 hours show up here.'],
    topContract: ['No top contract yet', 'The highest-value agreed contract in this category shows up here.'],
    bestSeller: ['No best seller yet', 'The seller with the most agreed deals shows up here.'],
    weeklyTrending: ['Nothing trending this week', 'The most-enquired listing of the past 7 days shows up here.']
  };
  var NFT_WEEKLY_EMPTY = ['Weekly data not available', 'The NFT feed only reports 24-hour activity right now.'];
  var ICONS = {
    uprt: '<path d="M7 17L17 7M8 7h9v9"/>',
    box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 01-8 0z"/><path d="M8 6H5v1a3 3 0 003 3M16 6h3v1a3 3 0 01-3 3M12 13v4M9 20h6M10 17h4"/>',
    cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>'
  };
  var TTL = 60000;
  var store = {};     // code -> { at, slides|null }
  var inflight = {};  // code -> Promise
  var index = {};     // code -> current slide, kept across redraws
  var pausedUntil = 0;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var css = document.createElement('style');
  css.id = 'tm-ads-css';
  css.textContent = [
    '.mk-hero-st b,.mk-hero-st small{display:none!important}',
    '.mk-hero.mk-ads{display:block!important;padding:0!important;grid-template-columns:none!important}',
    '.mk-ads-track{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain}',
    '.mk-ads-track::-webkit-scrollbar{display:none}',
    '.mk-ad{flex:0 0 100%;min-width:0;box-sizing:border-box;scroll-snap-align:start;scroll-snap-stop:always;display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:center;padding:16px 16px 32px;text-align:left;color:inherit;background:none;border:0}',
    '.mk-ad[role=button]{cursor:pointer}',
    ".mk-ad-k{display:block;margin-bottom:5px;font:700 10.5px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--am)}",
    '.mk-ad .mk-hero-tx h1,.mk-ad .mk-hero-tx p{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
    '.mk-ad.is-empty .mk-hero-tx h1{color:var(--mut)}',
    '.mk-ads-dots{position:absolute;left:0;right:0;bottom:11px;display:flex;justify-content:center;gap:6px}',
    '.mk-ads-dots button{width:6px;height:6px;padding:0;border:0;border-radius:99px;background:var(--line);transition:width .2s,background .2s}',
    '.mk-ads-dots button.on{width:18px;background:var(--am)}'
  ].join('\n');
  (document.head || document.documentElement).appendChild(css);

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function iconEl(name) {
    var s = el('span', 'mk-hero-ico');
    s.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>';
    return s;
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function money(minor, cur) {
    var n = Number(minor) / 100;
    if (!isFinite(n)) return '';
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(n); }
    catch (e) { return (cur ? cur + ' ' : '') + n.toFixed(2); }
  }
  function best(list, field) {
    var top = null;
    list.forEach(function (c) {
      var v = Number(c[field]);
      if (isFinite(v) && v > 0 && (!top || v > Number(top[field]))) top = c;
    });
    return top;
  }
  function nftSlides(list) {
    var name = function (c) { return c.name || c.slug || 'Collection'; };
    var trend = best(list, 'sales24h');
    var floor = best(list, 'floorPrice');
    var vol = best(list, 'volume24h');
    return {
      trending: trend ? { title: name(trend), sub: plural(Number(trend.sales24h), 'sale', 'sales') + ' in the last 24h', slug: trend.slug } : null,
      topContract: floor ? { title: name(floor), sub: 'Floor ' + Number(floor.floorPrice).toFixed(3) + ' ' + (floor.floorSymbol || 'ETH'), slug: floor.slug } : null,
      bestSeller: vol ? { title: name(vol), sub: Number(vol.volume24h).toFixed(1) + ' ' + (vol.volume24hSymbol || 'ETH') + ' volume in 24h', slug: vol.slug } : null,
      weeklyTrending: null
    };
  }

  function load(code) {
    var hit = store[code];
    if (hit && Date.now() - hit.at < TTL) return Promise.resolve(hit.slides);
    if (inflight[code]) return inflight[code];
    var url = code === 'nft'
      ? '/api/nft-collections?chain=ethereum&limit=48'
      : '/api/market/highlights?division=' + encodeURIComponent(code);
    inflight[code] = fetch(url, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('bad status'); return r.json(); })
      .then(function (d) {
        var slides = code === 'nft' ? nftSlides(Array.isArray(d.collections) ? d.collections : []) : (d.slides || {});
        store[code] = { at: Date.now(), slides: slides };
        return slides;
      })
      .catch(function () {
        store[code] = { at: Date.now() - TTL + 15000, slides: null }; // retry in ~15s
        return null;
      })
      .then(function (s) { inflight[code] = null; return s; });
    return inflight[code];
  }

  function describe(kind, code, d) {
    if (!d) {
      var e = (code === 'nft' && kind === 'weeklyTrending') ? NFT_WEEKLY_EMPTY : EMPTY[kind];
      return { title: e[0], sub: e[1] };
    }
    if (code === 'nft') return { title: d.title, sub: d.sub, nft: d.slug };
    if (kind === 'bestSeller') {
      return { title: d.seller, sub: plural(d.deals, 'deal', 'deals') + ' closed' + (d.listingTitle ? ' · ' + d.listingTitle : ''), open: d.listingTitle };
    }
    var l = d.listing;
    var parts = [money(l.priceMinorUnits, l.currency), l.seller];
    if (kind === 'trending') parts.push(plural(d.enquiries, 'enquiry', 'enquiries') + ' in 24h');
    if (kind === 'weeklyTrending') parts.push(plural(d.enquiries, 'enquiry', 'enquiries') + ' this week');
    if (kind === 'topContract') parts.push('Highest-value deal');
    return { title: l.title, sub: parts.filter(Boolean).join(' · '), open: l.title };
  }

  // Only link to a listing the page itself lists (the app opens it by title).
  function listed(title) {
    if (!title) return false;
    return !!document.querySelector('#app [data-open="' + String(title).replace(/["\\]/g, '\\$&') + '"]');
  }

  function setActive(ads, i) {
    var dots = ads.querySelectorAll('.mk-ads-dots button');
    for (var k = 0; k < dots.length; k++) dots[k].classList.toggle('on', k === i);
  }

  function fill(ads, code, state, slides) {
    var track = ads.querySelector('.mk-ads-track');
    var keep = track.scrollLeft;
    track.textContent = '';
    KINDS.forEach(function (k, i) {
      var d = state === 'ok' && slides ? slides[k.key] : null;
      var info;
      if (state === 'loading') info = { title: 'Loading highlights…', sub: '\u00a0' };
      else if (state === 'error') info = { title: 'Highlights unavailable', sub: 'Please try again in a moment.' };
      else info = describe(k.key, code, d);
      var tappable = !!(info.nft || listed(info.open));
      var s = el('div', 'mk-ad' + (d ? '' : ' is-empty'));
      if (tappable) {
        s.setAttribute('role', 'button');
        s.tabIndex = 0;
        if (info.nft) s.setAttribute('data-nft-collection', info.nft);
        else s.setAttribute('data-open', info.open);
      }
      s.setAttribute('aria-label', (i + 1) + ' of ' + KINDS.length + ': ' + k.label);
      s.appendChild(iconEl(k.icon));
      var tx = el('div', 'mk-hero-tx');
      tx.appendChild(el('small', 'mk-ad-k', k.label));
      tx.appendChild(el('h1', null, info.title));
      tx.appendChild(el('p', null, info.sub));
      s.appendChild(tx);
      track.appendChild(s);
    });
    track.scrollLeft = keep;
  }

  function make(code) {
    var ads = el('section', 'mk-hero mk-ads');
    ads.setAttribute('data-code', code);
    ads.setAttribute('aria-roledescription', 'carousel');
    ads.setAttribute('aria-label', 'Highlights');
    var track = el('div', 'mk-ads-track');
    ads.appendChild(track);
    var dots = el('div', 'mk-ads-dots');
    KINDS.forEach(function (k, i) {
      var b = el('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Show ' + k.label);
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        pausedUntil = Date.now() + 10000;
        track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
      });
      dots.appendChild(b);
    });
    ads.appendChild(dots);
    var raf = 0;
    track.addEventListener('scroll', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        if (!track.clientWidth) return;
        var i = Math.round(track.scrollLeft / track.clientWidth);
        index[code] = i;
        setActive(ads, i);
      });
    }, { passive: true });
    ['pointerdown', 'touchstart', 'wheel'].forEach(function (ev) {
      ads.addEventListener(ev, function () { pausedUntil = Date.now() + 10000; }, { passive: true });
    });
    return ads;
  }

  function begin(code, ads) {
    var hit = store[code];
    var fresh = hit && Date.now() - hit.at < TTL;
    fill(ads, code, fresh ? (hit.slides ? 'ok' : 'error') : 'loading', fresh ? hit.slides : null);
    var track = ads.querySelector('.mk-ads-track');
    var i = index[code] || 0;
    track.scrollLeft = i * track.clientWidth;
    setActive(ads, i);
    if (fresh) return;
    load(code).then(function (slides) {
      var target = ads.isConnected ? ads : document.querySelector('#app .mk-ads[data-code="' + code + '"]');
      if (target) fill(target, code, slides ? 'ok' : 'error', slides);
    });
  }

  function patch() {
    var app = document.getElementById('app');
    if (!app) return;
    var h = app.querySelector('header.ph h2');
    if (!h) return;
    var code = CATS[h.textContent.trim()];
    if (!code) return;
    var ads;
    if (code === 'nft') {
      var hub = app.querySelector('.nft-hub');
      if (!hub) return;
      var prev = hub.previousElementSibling;
      if (prev && prev.classList.contains('mk-ads')) return;
      ads = make(code);
      hub.parentNode.insertBefore(ads, hub);
    } else {
      var hero = app.querySelector('.mk-hero:not(.mk-ads)');
      if (!hero) return;
      ads = make(code);
      hero.parentNode.replaceChild(ads, hero);
    }
    begin(code, ads);
  }

  // Auto-advance every 5s; pauses while the person is interacting or the tab is hidden.
  setInterval(function () {
    if (reduced || document.hidden || Date.now() < pausedUntil) return;
    var ads = document.querySelector('#app .mk-ads');
    if (!ads) return;
    var track = ads.querySelector('.mk-ads-track');
    if (!track || !track.clientWidth) return;
    var next = ((index[ads.getAttribute('data-code')] || 0) + 1) % KINDS.length;
    track.scrollTo({ left: next * track.clientWidth, behavior: 'smooth' });
  }, 5000);

  function start() {
    patch();
    new MutationObserver(patch).observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
