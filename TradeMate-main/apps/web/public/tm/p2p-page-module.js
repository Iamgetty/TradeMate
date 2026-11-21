(function (root) {
  "use strict";

  function create(deps) {
    var required = [
      "getState", "getCache", "loadP2P", "header", "formatFiat",
      "formatAmount", "formatTime", "escapeHtml", "emptyState", "icon"
    ];
    if (!deps || required.some(function (key) { return typeof deps[key] !== "function"; })) {
      throw new TypeError("P2P page module requires the complete explicit dependency contract");
    }

    function render() {
      deps.loadP2P();
      var state = deps.getState();
      var cache = deps.getCache();
      var fiatSymbols = { NGN: "₦", USD: "$", EUR: "€", GBP: "£", GHS: "₵", KES: "KSh" };
      var side = state.side === "Buy" ? "sell" : "buy";
      var offers = (cache.book || []).filter(function (offer) { return offer.side === side; });
      var amount = Number(state.amt);
      if (amount > 0) {
        offers = offers.filter(function (offer) {
          return Number(offer.min_fiat_amount) <= amount && amount <= Number(offer.max_fiat_amount);
        });
      }
      function fiat(value) {
        return (fiatSymbols[state.fiat] || state.fiat + " ") + deps.formatAmount(Number(value) || 0, 2);
      }

      var body;
      if (cache.loading) {
        body = '<div class="mk-skl" role="status" aria-busy="true"><div class="mk-sk"></div><div class="mk-sk"></div><div class="mk-sk"></div><p class="fine">Loading TradeMate P2P records…</p></div>';
      } else if (cache.error) {
        body = deps.emptyState("info", "P2P records unavailable", deps.escapeHtml(cache.error), '<button class="btn sm" data-act="p2pretry">Retry</button>');
      } else if (offers.length) {
        body = '<div class="mk-count"><b>' + offers.length + "</b> offer" + (offers.length === 1 ? "" : "s") +
          " to " + state.side.toLowerCase() + " " + deps.escapeHtml(state.coin) + " · " + deps.escapeHtml(state.fiat) + "</div>" +
          offers.map(function (offer) {
            return '<button class="ad" style="text-align:left" data-pc="viewad" data-arg="' + deps.escapeHtml(offer.id) +
              '"><div class="who"><b><span class="ad-side ' + (offer.side === "sell" ? "sell" : "buy") + '">' +
              offer.side.toUpperCase() + "</span>" + deps.escapeHtml(offer.asset_code) + "/" + deps.escapeHtml(offer.fiat_code) +
              "</b><small>" + deps.formatTime(offer.created_at) + '</small></div><div class="pr"><small>' +
              (fiatSymbols[offer.fiat_code] || "") + "</small>" + deps.formatAmount(Number(offer.price), 2) +
              "<em>per " + deps.escapeHtml(offer.asset_code) + '</em></div><div class="kv"><span><small>Limits</small><b>' +
              fiat(offer.min_fiat_amount) + " – " + fiat(offer.max_fiat_amount) + '</b></span><span><small>Available</small><b>' +
              deps.formatAmount(Number(offer.quantity), 6) + " " + deps.escapeHtml(offer.asset_code) +
              '</b></span></div><div class="fine" style="margin-top:8px">Payment options: ' +
              (Array.isArray(offer.payment_methods) && offer.payment_methods.length ?
                offer.payment_methods.map(function (method) { return deps.escapeHtml(method); }).join(" · ") : "Not specified") +
              '</div><span class="fine">View offer and place order<i>→</i></span></button>';
          }).join("");
      } else {
        body = deps.emptyState(
          "swap",
          "No offers to " + state.side.toLowerCase() + " " + deps.escapeHtml(state.coin) + " yet",
          "There are no open ads for " + deps.escapeHtml(state.coin) + "/" + deps.escapeHtml(state.fiat) +
            (amount > 0 ? " that fit that amount" : "") +
            " right now. Only real TradeMate records are shown — no sample activity.",
          '<button class="btn sm" data-pg="myads">Post your own ad</button>'
        );
      }

      return deps.header("P2P Marketplace") +
        '<div class="ptabs"><button class="t" data-pg="orders">Orders</button><button class="t on">P2P</button>' +
        '<button class="t" data-pg="myads">My ads</button><select class="cur" id="fiat" aria-label="Fiat currency">' +
        ["NGN", "USD", "EUR", "GBP", "GHS", "KES"].map(function (currency) {
          return "<option" + (currency === state.fiat ? " selected" : "") + ">" + currency + "</option>";
        }).join("") +
        '</select></div><div class="notice">' + deps.icon("horn", "width:18px;height:18px") +
        '<div class="mq"><div class="mq-t"><span>Trade only through verified TradeMate flows. Never share passwords or payment credentials.</span></div></div></div>' +
        '<div class="bsw"><div class="bsp">' + ["Buy", "Sell"].map(function (sideName) {
          return '<button class="' + (state.side === sideName ? "on" : "") + '" data-side="' + sideName + '">' + sideName + "</button>";
        }).join("") +
        '</div></div><div class="filt"><label><select id="coin" aria-label="Asset">' + ["USDT", "BTC", "ETH"].map(function (coin) {
          return "<option" + (coin === state.coin ? " selected" : "") + ">" + coin + "</option>";
        }).join("") +
        '</select></label><label><input id="amt" inputmode="decimal" placeholder="Fiat amount" value="' +
        deps.escapeHtml(state.amt) + '"></label><button class="fi" data-act="resetf" aria-label="Reset filters">' +
        deps.icon("fun", "width:19px;height:19px") + "</button></div>" + body +
        '<p class="fine">Source: TradeMate database · ' +
        (cache.updated ? "Updated " + deps.formatTime(new Date(cache.updated).toISOString()) : "Awaiting first successful sync") +
        ". Completed transactions are shown in Trade &gt; Trade.</p>";
    }

    return { render: render };
  }

  root.TM_P2P_PAGE_MODULE = { create: create };
})(typeof window !== "undefined" ? window : this);
