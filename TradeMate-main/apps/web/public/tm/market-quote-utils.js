/* TradeMate market quote utilities. Pure helpers shared with the legacy runtime. */
/* Keep these implementations behavior-identical to the former inline helpers. */
(function (root) {
  "use strict";
  var MT5_PUBLIC_QUOTE_MAX_AGE_MS = 15e3;
  var MT5_CATEGORY_BY_TYPE = {
    forex: "Currency Pairs", metal: "Commodities", index_cfd: "Stock Indices",
    equity_cfd: "Equities", commodity_cfd: "Commodities",
    bond_cfd: "Bonds & Treasuries", crypto_cfd: "Crypto CFDs"
  };
  var MT5_DISPLAY_NAMES = {
    US500: "S&P 500", USTEC: "Nasdaq Composite", US30: "Dow Jones",
    DE30: "DAX 40", UK100: "FTSE 100", JP225: "Nikkei 225",
    HK50: "Hang Seng", FR40: "CAC 40", STOXX50: "Euro Stoxx 50",
    XAUUSD: "Gold", XAGUSD: "Silver", USOIL: "WTI Crude Oil",
    UKOIL: "Brent Crude Oil", XNGUSD: "Natural Gas", HG: "Copper",
    US3M: "13-Week US Treasury", US5Y: "5-Year US Treasury",
    US10Y: "10-Year US Treasury", US30Y: "30-Year US Treasury"
  };
  function quoteTimestampMs(t){var e=String(null==t?"":t),a="number"==typeof t?t:/^\\d{10,13}$/.test(e)?Number(e):Date.parse(t);return Number.isFinite(a)&&a>0&&a<1e12&&(a*=1e3),a}
  function mt5SymbolKey(t) { return String(t || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
  function mt5QuoteIsFresh(t) {
    var e = t && Date.parse(t.quoteTime || t.timestamp);
    return !!(t && Number.isFinite(e) && Date.now() - e >= -5e3 && Date.now() - e <= MT5_PUBLIC_QUOTE_MAX_AGE_MS);
  }
  function mt5QuotePrice(t) {
    var e = Number(t && t.bid), a = Number(t && t.ask), r = Number(t && t.last);
    return e > 0 && a > 0 && a >= e ? (e + a) / 2 : r > 0 ? r : e > 0 ? e : a > 0 ? a : null;
  }
  function mt5NameForQuote(t) {
    var e = mt5SymbolKey(t.symbol), a = MT5_DISPLAY_NAMES[e];
    return a || ("forex" === t.instrumentType && 6 === e.length ? e.slice(0, 3) + "/" + e.slice(3) :
      "crypto_cfd" === t.instrumentType && e.length > 3 ? e.slice(0, -3) + "/" + e.slice(-3) + " (CFD)" :
      String(t.symbol || "MT5 instrument"));
  }
  function selectMarketQuoteItems(items, assetClass, isMt5QuoteFresh) {
    return (Array.isArray(items) ? items : []).filter(function (item) {
      return item.assetClass === assetClass && item.providerSymbol &&
        "Twelve Data Basic" !== item.quoteProvider &&
        !("Exness MT5" === item.quoteProvider && "live" === item.quoteStatus &&
          typeof isMt5QuoteFresh === "function" && isMt5QuoteFresh(item));
    });
  }
  function marketQuoteRequestKey(assetClass, items) {
    return assetClass + ":" + (Array.isArray(items) ? items : [])
      .map(function (item) { return item.providerSymbol; }).join(",");
  }
  root.TM_MARKET_QUOTE_UTILS = Object.freeze({
    MT5_PUBLIC_QUOTE_MAX_AGE_MS: MT5_PUBLIC_QUOTE_MAX_AGE_MS,
    MT5_CATEGORY_BY_TYPE: MT5_CATEGORY_BY_TYPE,
    MT5_DISPLAY_NAMES: MT5_DISPLAY_NAMES,
    quoteTimestampMs: quoteTimestampMs,
    mt5SymbolKey: mt5SymbolKey,
    mt5QuoteIsFresh: mt5QuoteIsFresh,
    mt5QuotePrice: mt5QuotePrice,
    mt5NameForQuote: mt5NameForQuote,
    selectMarketQuoteItems: selectMarketQuoteItems,
    marketQuoteRequestKey: marketQuoteRequestKey
  });
})(window);
