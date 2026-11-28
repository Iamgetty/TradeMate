/* TradeMate Pick page module. Loaded as a classic script; no app internals are accessed implicitly. */
(function (global) {
  'use strict';

  function create(deps) {
    if (!deps || typeof deps.isConnected !== 'function' ||
        typeof deps.getItems !== 'function' ||
        typeof deps.getSelectedOffer !== 'function' ||
        typeof deps.resolveOffer !== 'function' ||
        typeof deps.renderProposal !== 'function') {
      throw new TypeError('TradeMate Pick page module received an invalid dependency contract');
    }

    return {
      render: function () {
        var connected = deps.isConnected();
        var allItems = deps.getItems();
        var eligible = connected && Array.isArray(allItems)
          ? allItems.filter(function (item) { return !!(item && item.srv); })
          : [];
        var selected = connected ? deps.resolveOffer(deps.getSelectedOffer()) : null;
        var offer = selected && selected.srv ? selected : (eligible[0] || null);
        return deps.renderProposal(offer, true, eligible);
      }
    };
  }

  global.TM_PICK_PAGE_MODULE = Object.freeze({ create: create });
})(window);

/* Home redesign loader: loads the home-redesign patch after the other runtime patches. */
(function () {
  var s = document.createElement('script');
  s.src = '/tm/tm-home-redesign.js?v=2';
  s.async = false;
  document.body.appendChild(s);
})();
