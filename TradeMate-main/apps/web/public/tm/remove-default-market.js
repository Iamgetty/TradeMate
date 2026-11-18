/*
 * Preference tab: removes the "Default market" setting row completely.
 * The row is a <label class="lr"> wrapping <select data-pref="market">.
 * Runs as a DOM patch so app.js does not need to change.
 */
(function () {
  'use strict';

  function patch() {
    var selects = document.querySelectorAll('#app select[data-pref="market"]');
    for (var i = 0; i < selects.length; i++) {
      var row = selects[i].closest('label.lr') || selects[i].closest('.lr');
      if (row && row.parentNode) row.parentNode.removeChild(row);
    }
  }

  function start() {
    patch();
    new MutationObserver(patch).observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
