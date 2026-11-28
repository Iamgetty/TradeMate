/*
 * Home screen: replaces the single "Your promotion could appear here" card with
 * a swipeable slide of five cards in the same style as the Explore page slides
 * (.tbn): a tag, a headline with one highlighted word, a short line, and a row
 * of chips. There are no buttons. Each card covers two Contract categories and
 * shows real activity (live listing counts) as chips; tapping the card, or a
 * chip, opens that category through the app's existing [data-mm] handler.
 *
 * All styling comes from the app's own .tbn classes, so the cards match Explore
 * exactly and follow its light/dark themes. Nothing here is invented stats: a
 * category with no listings says so.
 *
 * The card's rendered height is remembered (localStorage "tm.slideH") so the
 * slide cards on the category and marketplace pages can be exactly this size.
 * Runs as a DOM patch so app.js does not need to change.
 */
(function () {
  'use strict';

  // key = the app's category key (what [data-mm] expects); div = API division.
  var SLIDES = [
    { tag: 'FEATURED', lead: '', em: '',
      sub: '',
      cats: [{ key: 'Services', label: 'Services', div: 'services' }, { key: 'B2B', label: 'B2B', div: 'b2b' }] },
    { tag: 'ACTIVITY \u00b7 REAL ESTATE & TECHNOLOGY', lead: 'Homes, land and ', em: 'software',
      sub: 'Property listings, apps and licences.',
      cats: [{ key: 'Real Estate', label: 'Real Estate', div: 'real_estate' }, { key: 'Software', label: 'Technology', div: 'software' }] },
    { tag: 'TRENDING \u00b7 INDUSTRIAL & AGRICULTURE', lead: 'Trade across ', em: 'industry',
      sub: 'Manufacturing, supply, produce and land.',
      cats: [{ key: 'Industrial & Trade', label: 'Industrial', div: 'industrial_trade' }, { key: 'Agriculture', label: 'Agriculture', div: 'agriculture' }] },
    { tag: 'PROMOTION \u00b7 FINANCE & INSTITUTION', lead: 'Zero contract ', em: 'fees',
      sub: 'Publish your first offer free this month.',
      cats: [{ key: 'Finance & Investment', label: 'Finance', div: 'finance_investment' }, { key: 'Institution & Infrastructure', label: 'Institution', div: 'institution_infrastructure' }] },
    { tag: 'ACTIVITY \u00b7 REAL ESTATE & TECHNOLOGY', lead: '', em: '',
      sub: '',
      cats: [{ key: 'Sports', label: 'Sports Transfer', div: 'sports' }, { key: 'Entertainment', label: 'Art', div: 'entertainment' }] }
  ];
  var TTL = 60000;
  var counts = null;        // { division: number } once the listings feed has loaded
  var countsAt = 0;
  var failedAt = 0;
  var inflight = null;
  var current = 0;
  var pausedUntil = 0;
  var resizeTimer = 0;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // ---- live activity: how many real listings each category has ----
  function loadCounts() {
    if (counts && Date.now() - countsAt < TTL) return Promise.resolve(counts);
    if (!counts && failedAt && Date.now() - failedAt < 15000) return Promise.resolve(null);
    if (inflight) return inflight;
    inflight = fetch('/api/market/listings?limit=50', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('bad status'); return r.json(); })
      .then(function (d) {
        var c = {};
        (d && d.data || []).forEach(function (l) { if (l && l.division) c[l.division] = (c[l.division] || 0) + 1; });
        counts = c; countsAt = Date.now(); failedAt = 0;
        return c;
      })
      .catch(function () { failedAt = Date.now(); return null; })
      .then(function (c) { inflight = null; return c; });
    return inflight;
  }

  function paintCounts(root) {
    var chips = root.querySelectorAll('.tbn-chip[data-div]');
    for (var i = 0; i < chips.length; i++) {
      var small = chips[i].querySelector('small');
      if (!small) continue;
      var n = counts ? (counts[chips[i].getAttribute('data-div')] || 0) : null;
      if (n === null) { small.textContent = ''; small.className = ''; continue; }
      small.textContent = n === 0 ? 'No listings yet' : (n >= 50 ? '50+' : n) + (n === 1 ? ' listing' : ' listings');
      small.className = n === 0 ? '' : 'up';
    }
  }

  // Remember how tall this card is so the category and marketplace pages can match it exactly.
  function recordHeight() {
    var slide = document.querySelector('#app .home-promo-tbn .tbn-s');
    if (!slide) return;
    var h = Math.round(slide.getBoundingClientRect().height);
    if (h < 120 || h > 420) return;
    try {
      if (localStorage.getItem('tm.slideH') !== String(h)) localStorage.setItem('tm.slideH', String(h));
    } catch (e) { /* storage unavailable: the category cards fall back to the app's own card size */ }
  }

  function setActive(root, i) {
    var dots = root.querySelectorAll('.tbn-dots i');
    for (var k = 0; k < dots.length; k++) dots[k].className = k === i ? 'on' : '';
  }

  function goTo(root, i, smooth) {
    var track = root.querySelector('.tbn-track');
    if (!track || !track.clientWidth) return;
    current = (i % SLIDES.length + SLIDES.length) % SLIDES.length;
    track.scrollTo({ left: current * track.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
    setActive(root, current);
  }

  function make() {
    var root = el('div', 'tbn home-promo-tbn');
    root.setAttribute('role', 'region');
    root.setAttribute('aria-roledescription', 'carousel');
    root.setAttribute('aria-label', 'Contract category activity and promotions');
    var track = el('div', 'tbn-track');
    SLIDES.forEach(function (s, i) {
      var slide = el('div', 'tbn-s');
      slide.setAttribute('data-mm', s.cats[0].key); // tapping the card opens the first category
      slide.setAttribute('aria-label', (i + 1) + ' of ' + SLIDES.length);
      var copy = el('div', 'tbn-copy');
      // Keep the original boxed .tbn-tag typography and styling; the title is
      // the only visible writing on each slide.
      copy.appendChild(el('span', 'tbn-tag', s.tag));
      slide.appendChild(copy);
      track.appendChild(slide);
    });
    root.appendChild(track);
    var dots = el('div', 'tbn-dots');
    SLIDES.forEach(function (s, i) {
      var d = el('i');
      d.setAttribute('role', 'button');
      d.setAttribute('aria-label', 'Slide ' + (i + 1));
      d.addEventListener('click', function (ev) {
        ev.stopPropagation();
        pausedUntil = Date.now() + 10000;
        goTo(root, i, true);
      });
      dots.appendChild(d);
    });
    root.appendChild(dots);

    var raf = 0;
    track.addEventListener('scroll', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        if (!track.clientWidth) return;
        current = Math.round(track.scrollLeft / track.clientWidth);
        setActive(root, current);
      });
    }, { passive: true });
    ['pointerdown', 'touchstart', 'wheel'].forEach(function (ev) {
      root.addEventListener(ev, function () { pausedUntil = Date.now() + 10000; }, { passive: true });
    });
    return root;
  }

  function patch() {
    var app = document.getElementById('app');
    if (!app) return;
    var old = app.querySelector('.view .banner');
    if (!old) return;
    // The home card is the one right below the Contract Scout button.
    var prev = old.previousElementSibling;
    if (!prev || !prev.classList.contains('sc-promo')) return;
    var root = make();
    old.parentNode.replaceChild(root, old);
    var track = root.querySelector('.tbn-track');
    track.scrollLeft = current * track.clientWidth;
    setActive(root, current);
    paintCounts(root);                    // instant if already loaded
    requestAnimationFrame(recordHeight);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(recordHeight);
    loadCounts().then(function () {
      var live = document.querySelector('#app .home-promo-tbn');
      if (live) { paintCounts(live); recordHeight(); }
    });
  }

  // Auto-advance every 5s; pauses while the person is interacting or the tab is hidden.
  setInterval(function () {
    if (reduced || document.hidden || Date.now() < pausedUntil) return;
    var root = document.querySelector('#app .home-promo-tbn');
    if (root) goTo(root, current + 1, true);
  }, 5000);

  // Install before the app runtime paints its first Home view. Observe the
  // document element so this also works when the script executes in <head>,
  // before document.body or #app exists.
  function start() {
    patch();
    new MutationObserver(patch).observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(recordHeight, 150);
    });
  }
  start();
})();
