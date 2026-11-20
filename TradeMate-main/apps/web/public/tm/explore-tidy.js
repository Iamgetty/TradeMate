/*
 * Explore page tidy-up (Contracts + Marketplaces sections):
 *  - "Contract categories" is renamed "Contracts".
 *  - Every "Tap to explore" caption is removed.
 *  - The two section titles get a smaller, distinctive style: small mono capitals
 *    with an amber diamond and a fading rule.
 *  - Tile rows sit closer together (about 20% less row distance).
 * The Home shortcuts grid (.home-market-shortcuts) is not touched.
 * Runs as a DOM patch so app.js does not need to change.
 */
(function () {
  'use strict';

  var css = document.createElement('style');
  css.id = 'tm-explore-tidy-css';
  css.textContent = [
    /* closer rows: tile height 104px -> 82px and row gap 10px -> 8px (Explore tiles only) */
    'html #app .view .mk-grid:not(.home-market-shortcuts){row-gap:8px!important}',
    'html #app .view .mk-grid:not(.home-market-shortcuts) .mk-card{min-height:82px!important;padding:10px 6px!important}',
    '@media(min-width:900px){html #app .view .mk-grid:not(.home-market-shortcuts) .mk-card{min-height:92px!important;padding:12px 8px!important}}',
    /* section titles: smaller and distinctive */
    'html #app .view .tm-sec-title{justify-content:flex-start;align-items:center;gap:12px;padding:12px 16px 8px}',
    "html #app .view .tm-sec-title h2{display:flex;align-items:center;gap:9px;margin:0;font:600 11.5px/1 'DM Mono',monospace;letter-spacing:.24em;text-transform:uppercase;color:var(--txt)}",
    'html #app .view .tm-sec-title h2:before{content:"";width:6px;height:6px;border-radius:1.5px;background:var(--am);transform:rotate(45deg);flex:none}',
    'html #app .view .tm-sec-title:after{content:"";flex:1;height:1px;background:linear-gradient(90deg,color-mix(in srgb,var(--am) 45%,var(--line)),transparent)}'
  ].join('\n');
  (document.head || document.documentElement).appendChild(css);

  function tidy() {
    var app = document.getElementById('app');
    if (!app) return;
    var notes = app.querySelectorAll('small');
    for (var i = 0; i < notes.length; i++) {
      if (notes[i].textContent.trim() === 'Tap to explore') notes[i].remove();
    }
    var secs = app.querySelectorAll('.view .mk-sec');
    for (var k = 0; k < secs.length; k++) {
      var next = secs[k].nextElementSibling;
      if (!next || !next.classList.contains('mk-grid') || next.classList.contains('home-market-shortcuts')) continue;
      var h = secs[k].querySelector('h2');
      if (h && h.textContent.trim() === 'Contract categories') h.textContent = 'Contracts';
      secs[k].classList.add('tm-sec-title');
    }
  }

  function start() {
    tidy();
    new MutationObserver(tidy).observe(document.documentElement, { childList: true, subtree: true });
  }
  start();
})();
