/*
 * Preference tab: removes the "Default market" setting row completely.
 * The row is a <label class="lr"> wrapping <select data-pref="market">.
 *
 * Settings pages are drawn into the #pg overlay, which is NOT inside #app, so
 * this looks across the whole document. A CSS rule hides the row the instant it
 * is drawn (no flash) and the observer then removes it from the DOM.
 * Runs as a DOM patch so app.js does not need to change.
 */
(function () {
  'use strict';

  var css = document.createElement('style');
  css.id = 'tm-no-default-market-css';
  css.textContent = 'label.lr:has(select[data-pref="market"]){display:none!important}';
  (document.head || document.documentElement).appendChild(css);

  function patch() {
    var selects = document.querySelectorAll('select[data-pref="market"]');
    for (var i = 0; i < selects.length; i++) {
      var row = selects[i].closest('label.lr') || selects[i].closest('.lr');
      if (row && row.parentNode) row.parentNode.removeChild(row);
    }
  }

  function start() {
    patch();
    new MutationObserver(patch).observe(document.documentElement, { childList: true, subtree: true });
  }
  start();
})();
