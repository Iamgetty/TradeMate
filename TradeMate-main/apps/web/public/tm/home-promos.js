/*
 * Home screen: replaces the single "Your promotion could appear here" card with
 * a swipeable slide of five large cards that cover the ten Contract categories
 * (two per card). Each card has a tappable pill per category; tapping the rest
 * of the card opens the first category. Sizing is the large carousel card.
 * Copy is condensed from each category's own description in the app; nothing
 * here is invented stats.
 * Runs as a DOM patch so app.js does not need to change. Taps use the app's
 * existing [data-mm] handler (the same one the category tiles use).
 */
(function () {
  'use strict';

  var ICONS = {
    brief: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 13h18"/>',
    estate: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10M10 20v-6h4v6"/>',
    factory: '<path d="M3 21V11l6 4v-4l6 4V5h4v16zM3 21h18"/>',
    uprt: '<path d="M7 17L17 7M8 7h9v9"/>',
    sports: '<path d="M8 4h8v5a4 4 0 01-8 0z"/><path d="M8 6H5v1a3 3 0 003 3M16 6h3v1a3 3 0 01-3 3M12 13v4M9 20h6M10 17h4"/>'
  };
  // key = the app's category key (what [data-mm] expects); label = what people see.
  var SLIDES = [
    { title: 'Services & B2B', sub: 'Skilled pros, suppliers & partners', icon: 'brief',
      cats: [{ key: 'Services', label: 'Services' }, { key: 'B2B', label: 'B2B' }] },
    { title: 'Real Estate & Technology', sub: 'Homes, land, apps & licences', icon: 'estate',
      cats: [{ key: 'Real Estate', label: 'Real Estate' }, { key: 'Software', label: 'Technology' }] },
    { title: 'Industrial & Agriculture', sub: 'Manufacturing, supply, produce & land', icon: 'factory',
      cats: [{ key: 'Industrial & Trade', label: 'Industrial' }, { key: 'Agriculture', label: 'Agriculture' }] },
    { title: 'Finance & Institution', sub: 'Funding, investment & public projects', icon: 'uprt',
      cats: [{ key: 'Finance & Investment', label: 'Finance' }, { key: 'Institution & Infrastructure', label: 'Institution' }] },
    { title: 'Sports Transfer & Art', sub: 'Transfers, signings, talent & film', icon: 'sports',
      cats: [{ key: 'Sports', label: 'Sports' }, { key: 'Entertainment', label: 'Art' }] }
  ];
  var current = 0;
  var pausedUntil = 0;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var css = document.createElement('style');
  css.id = 'tm-promo-css';
  css.textContent = [
    '.banner.promo-slides{padding:0;min-height:184px;height:184px;margin:14px 16px 16px;border-radius:20px}',
    '.promo-track{display:flex;height:100%;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain}',
    '.promo-track::-webkit-scrollbar{display:none}',
    '.promo-slide{flex:0 0 100%;min-width:0;box-sizing:border-box;scroll-snap-align:start;scroll-snap-stop:always;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:20px;align-items:center;padding:24px 28px 34px;color:inherit;text-align:left;cursor:pointer}',
    '.promo-ic{width:60px;height:60px;border-radius:18px;display:grid;place-items:center;background:color-mix(in srgb,var(--am) 16%,transparent);color:var(--am)}',
    '.promo-ic svg{width:30px;height:30px}',
    '.banner .promo-tx{min-width:0}',
    '.banner .promo-tx .chip{display:block;line-height:1;font-size:11px;letter-spacing:.08em}',
    '.banner .promo-tx h3{margin:10px 0 7px;font-size:20px;line-height:1.25;max-width:none;white-space:normal;overflow:visible;text-overflow:clip}',
    '.banner .promo-tx p{margin:0;max-width:none;font-size:14px;line-height:1.5;white-space:normal;overflow:visible;text-overflow:clip}',
    '.promo-pills{display:flex;flex-direction:column;gap:8px;align-items:stretch}',
    '.promo-pill{flex:none;padding:11px 18px;border-radius:99px;font-size:13px;font-weight:700;line-height:1;white-space:nowrap;text-align:center;background:var(--am);color:#1b1006;cursor:pointer}',
    'html[data-theme="light"] .promo-pill{color:#fff}',
    '.promo-dots{position:absolute;left:0;right:0;bottom:7px;display:flex;justify-content:center;gap:6px;pointer-events:none}',
    '.promo-dots i{width:7px;height:7px;border-radius:99px;background:var(--line);transition:width .2s,background .2s}',
    '@media(max-width:600px){.banner.promo-slides{min-height:196px;height:196px;margin:12px 12px 14px}.promo-slide{grid-template-columns:48px minmax(0,1fr);gap:14px;padding:20px 18px 36px;align-content:center}.promo-ic{width:48px;height:48px;border-radius:15px}.promo-ic svg{width:25px;height:25px}.banner .promo-tx h3{font-size:18px;white-space:normal}.banner .promo-tx p{font-size:13px;white-space:normal}.promo-pills{grid-column:2;flex-direction:row;flex-wrap:wrap;justify-self:start;gap:8px;margin-top:2px}.promo-pill{padding:9px 14px;font-size:12.5px}}',
    '.promo-dots i.on{width:16px;background:var(--am)}'
  ].join('\n');
  (document.head || document.documentElement).appendChild(css);

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function setActive(banner, i) {
    var dots = banner.querySelectorAll('.promo-dots i');
    for (var k = 0; k < dots.length; k++) dots[k].classList.toggle('on', k === i);
  }

  function make() {
    var banner = el('div', 'banner promo-slides');
    banner.setAttribute('aria-roledescription', 'carousel');
    banner.setAttribute('aria-label', 'Contract categories');
    var track = el('div', 'promo-track');
    SLIDES.forEach(function (s, i) {
      var slide = el('div', 'promo-slide');
      slide.setAttribute('role', 'button');
      slide.tabIndex = 0;
      slide.setAttribute('data-mm', s.cats[0].key);
      slide.setAttribute('aria-label', (i + 1) + ' of ' + SLIDES.length + ': ' + s.title);
      var ic = el('span', 'promo-ic');
      ic.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[s.icon] + '</svg>';
      var tx = el('div', 'promo-tx');
      tx.appendChild(el('span', 'chip', 'CONTRACT CATEGORIES'));
      tx.appendChild(el('h3', null, s.title));
      tx.appendChild(el('p', null, s.sub));
      var pills = el('div', 'promo-pills');
      s.cats.forEach(function (c) {
        var p = el('span', 'promo-pill', c.label);
        p.setAttribute('role', 'button');
        p.tabIndex = 0;
        p.setAttribute('data-mm', c.key);
        pills.appendChild(p);
      });
      slide.appendChild(ic);
      slide.appendChild(tx);
      slide.appendChild(pills);
      track.appendChild(slide);
    });
    banner.appendChild(track);
    var dots = el('div', 'promo-dots');
    SLIDES.forEach(function () { dots.appendChild(el('i')); });
    banner.appendChild(dots);

    var raf = 0;
    track.addEventListener('scroll', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        if (!track.clientWidth) return;
        current = Math.round(track.scrollLeft / track.clientWidth);
        setActive(banner, current);
      });
    }, { passive: true });
    ['pointerdown', 'touchstart', 'wheel'].forEach(function (ev) {
      banner.addEventListener(ev, function () { pausedUntil = Date.now() + 10000; }, { passive: true });
    });
    return banner;
  }

  function patch() {
    var app = document.getElementById('app');
    if (!app) return;
    var old = app.querySelector('.view .banner:not(.promo-slides)');
    if (!old) return;
    // The home card is the one right below the Contract Scout button.
    var prev = old.previousElementSibling;
    if (!prev || !prev.classList.contains('sc-promo')) return;
    var banner = make();
    old.parentNode.replaceChild(banner, old);
    var track = banner.querySelector('.promo-track');
    track.scrollLeft = current * track.clientWidth;
    setActive(banner, current);
  }

  // Auto-advance every 5s; pauses while the person is interacting or the tab is hidden.
  setInterval(function () {
    if (reduced || document.hidden || Date.now() < pausedUntil) return;
    var banner = document.querySelector('#app .promo-slides');
    if (!banner) return;
    var track = banner.querySelector('.promo-track');
    if (!track || !track.clientWidth) return;
    track.scrollTo({ left: ((current + 1) % SLIDES.length) * track.clientWidth, behavior: 'smooth' });
  }, 5000);

  // Install before the app runtime paints its first Home view. Observe the
  // document element so this also works when the script executes in <head>,
  // before document.body or #app exists.
  function start() {
    patch();
    new MutationObserver(patch).observe(document.documentElement, { childList: true, subtree: true });
  }
  start();
})();
