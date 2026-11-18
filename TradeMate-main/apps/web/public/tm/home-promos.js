/*
 * Home screen: replaces the single "Your promotion could appear here" card with
 * a compact, swipeable slide of five promo cards covering the platform
 * (advertise slot, P2P, zero-fee offers, NFTs, Alpha spotlight). The card is
 * a more readable, medium-height carousel card. Copy comes from text already shown in the
 * app (Promotions page, market descriptions); nothing here is invented stats.
 * Runs as a DOM patch so app.js does not need to change. Taps use the app's
 * existing [data-pg] / [data-mm] / [data-f] handlers.
 */
(function () {
  'use strict';

  var ICONS = {
    horn: '<path d="M4 10v4h4l7 4V6L8 10zM18 9a4 4 0 010 6"/>',
    swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
    plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    nft: '<path d="M12 3l8 6-8 12L4 9zM4 9h16M9 9l3 12M15 9l-3 12"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.2"/>'
  };
  var SLIDES = [
    { chip: 'FEATURED', title: 'Your promotion could appear here', sub: 'Reserved for contracts and announcements.', cta: 'Advertise', attr: ['data-pg', 'promos'], icon: 'horn' },
    { chip: 'P2P', title: 'Trade crypto peer-to-peer', sub: 'Buy and sell crypto directly with people.', cta: 'Open P2P', attr: ['data-mm', 'P2P'], icon: 'swap' },
    { chip: 'PROMOTION', title: 'Zero contract fees', sub: 'Publish your first offer free this month.', cta: 'Add Contract', attr: ['data-f', 'Add Contract'], icon: 'plus' },
    { chip: 'NFTS', title: 'Explore live NFT collections', sub: 'Live collections across chains.', cta: 'Explore', attr: ['data-mm', 'NFTs'], icon: 'nft' },
    { chip: 'PROMOTION', title: 'Verified Alpha spotlight', sub: 'Verified Alpha members may receive featured placement.', cta: 'View offers', attr: ['data-pg', 'promos'], icon: 'tag' }
  ];
  var current = 0;
  var pausedUntil = 0;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var css = document.createElement('style');
  css.id = 'tm-promo-css';
  css.textContent = [
    '.banner.promo-slides{padding:0;min-height:124px;height:124px;margin:12px 16px 14px}',
    '.promo-track{display:flex;height:100%;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain}',
    '.promo-track::-webkit-scrollbar{display:none}',
    '.promo-slide{flex:0 0 100%;min-width:0;box-sizing:border-box;scroll-snap-align:start;scroll-snap-stop:always;display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;padding:14px 16px 22px;color:inherit;text-align:left;cursor:pointer}',
    '.promo-ic{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;background:color-mix(in srgb,var(--am) 16%,transparent);color:var(--am)}',
    '.promo-ic svg{width:24px;height:24px}',
    '.banner .promo-tx{min-width:0}',
    '.banner .promo-tx .chip{display:block;line-height:1}',
    '.banner .promo-tx h3{margin:6px 0 3px;font-size:16px;line-height:1.25;max-width:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.banner .promo-tx p{margin:0;max-width:none;font-size:12px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.promo-cta{flex:none;padding:9px 14px;border-radius:99px;font-size:12.5px;font-weight:700;line-height:1;white-space:nowrap;background:var(--am);color:#1b1006}',
    'html[data-theme="light"] .promo-cta{color:#fff}',
    '.promo-dots{position:absolute;left:0;right:0;bottom:7px;display:flex;justify-content:center;gap:6px;pointer-events:none}',
    '.promo-dots i{width:6px;height:6px;border-radius:99px;background:var(--line);transition:width .2s,background .2s}',
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
    banner.setAttribute('aria-label', 'Promotions');
    var track = el('div', 'promo-track');
    SLIDES.forEach(function (s, i) {
      var slide = el('div', 'promo-slide');
      slide.setAttribute('role', 'button');
      slide.tabIndex = 0;
      slide.setAttribute(s.attr[0], s.attr[1]);
      slide.setAttribute('aria-label', (i + 1) + ' of ' + SLIDES.length + ': ' + s.title);
      var ic = el('span', 'promo-ic');
      ic.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[s.icon] + '</svg>';
      var tx = el('div', 'promo-tx');
      tx.appendChild(el('span', 'chip', s.chip));
      tx.appendChild(el('h3', null, s.title));
      tx.appendChild(el('p', null, s.sub));
      slide.appendChild(ic);
      slide.appendChild(tx);
      slide.appendChild(el('span', 'promo-cta', s.cta));
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

  function start() {
    patch();
    new MutationObserver(patch).observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
