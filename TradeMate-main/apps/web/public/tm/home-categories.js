/*
 * Home screen: replaces the "services" grid (Learn, Rewards, Referral, ...)
 * with the eight marketplace shortcuts. Runs as a DOM patch so app.js does not
 * need to change. Taps use the app's existing [data-mm] handler, so they open
 * the same pages as the tiles on the Markets screen (P2P opens the P2P page).
 */
(function () {
  'use strict';
  var CATS = [
    ['Real Estate', 'Real Estate', 'estate'],
    ['Software', 'Technology', 'code'],
    ['Sports', 'Sports Transfer', 'sports'],
    ['Industrial & Trade', 'Industrial', 'factory'],
    ['Agriculture', 'Agriculture', 'sprout'],
    ['Entertainment', 'Art', 'film'],
    ['P2P', 'P2P', 'swap'],
    ['Services', 'Services', 'brief']
  ];
  var ICONS = {
    estate: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10M10 20v-6h4v6"/>',
    code: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',
    sports: '<path d="M8 4h8v5a4 4 0 01-8 0z"/><path d="M8 6H5v1a3 3 0 003 3M16 6h3v1a3 3 0 01-3 3M12 13v4M9 20h6M10 17h4"/>',
    factory: '<path d="M3 21V11l6 4v-4l6 4V5h4v16zM3 21h18"/>',
    sprout: '<path d="M12 21v-9"/><path d="M12 12C12 8 9 6 5 6c0 4 2 6 7 6zM12 14c0-3 2-5 6-5 0 3-2 5-6 5z"/>',
    film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
    swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
    brief: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 13h18"/>'
  };

  function applyFlatButtonStyles() {
    if (document.getElementById('tm-flat-home-buttons')) return;
    var style = document.createElement('style');
    style.id = 'tm-flat-home-buttons';
    style.textContent = [
      '#app .view>.grid .opt{background:transparent!important;border:0!important;box-shadow:none!important;border-radius:0!important;padding:0!important}',
      '#app .view>.grid .opt .tile{background:transparent!important;border:0!important;box-shadow:none!important;border-radius:0!important}',
      '#app .view>.grid .opt:hover .tile{transform:translateY(-2px)!important;box-shadow:none!important}',
      '#app .view .mk-grid .mk-card{background:transparent!important;border:0!important;box-shadow:none!important;border-radius:0!important}',
      '#app .view .mk-grid .mk-card:before{display:none!important}',
      '#app .view .mk-grid .mk-card:hover{transform:translateY(-2px)!important;box-shadow:none!important}',
      '#app .view .mk-grid .mk-card .mk-ico{background:transparent!important;border:0!important;box-shadow:none!important;border-radius:0!important}',
      '#app .view .mk-grid .mk-card:hover .mk-ico,#app .view .mk-grid .mk-card:focus-visible .mk-ico{background:transparent!important;transform:translateY(-2px)!important}',
      '#app .view>.grid .opt{height:68px!important;min-height:68px!important;gap:12px!important}',
      '#app .view>.grid .opt .tile{width:42px!important;height:42px!important;flex:none!important}',
      '#app .view>.grid .opt .tile svg{width:22px!important;height:22px!important}',
      '#app .view>.grid .opt .opt-label{font-size:15.5px!important;line-height:1.15!important}'
    ].join('');
    document.head.appendChild(style);
  }

  function build(grid) {
    var frag = document.createDocumentFragment();
    CATS.forEach(function (c) {
      var b = document.createElement('button');
      b.className = 'opt';
      b.setAttribute('data-mm', c[0]);
      b.setAttribute('aria-label', c[1]);
      var tile = document.createElement('span');
      tile.className = 'tile';
      tile.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[c[2]] + '</svg>';
      var label = document.createElement('span');
      label.className = 'opt-label';
      label.textContent = c[1];
      b.appendChild(tile);
      b.appendChild(label);
      frag.appendChild(b);
    });
    grid.textContent = '';
    grid.appendChild(frag);
    grid.setAttribute('data-home-cats', '1');
  }

  function patch() {
    var grids = document.querySelectorAll('#app .view>.grid');
    for (var i = 0; i < grids.length; i++) {
      var g = grids[i];
      if (g.getAttribute('data-home-cats')) continue;
      var next = g.nextElementSibling;
      // The home grid is the one directly followed by the Scout promo button.
      if (!next || !next.classList || !next.classList.contains('sc-promo')) continue;
      build(g);
    }
  }

  function start() {
    applyFlatButtonStyles();
    patch();
    new MutationObserver(patch).observe(document.body, { childList: true, subtree: true });
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
