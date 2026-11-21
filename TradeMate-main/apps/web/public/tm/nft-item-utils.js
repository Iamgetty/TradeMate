/* TradeMate NFT item normalization helpers. Pure mapping; no app state or network side effects. */
(function (root) {
  "use strict";
  function normalizeItems(items, chain, color) {
    return (Array.isArray(items) ? items : []).map(function (item) {
      return {
        n: item.name,
        m: "NFTs",
        p: typeof item.price === "number" ? item.price : null,
        c: null,
        k: "NFT",
        h: 0,
        col: color || "#8b7bff",
        image: item.image,
        collection: item.collection,
        collectionSlug: item.collectionSlug,
        contract: item.contract,
        tokenId: item.tokenId,
        currency: item.currency,
        marketplaceUrl: item.marketplaceUrl,
        chain: item.chain || chain,
        sales24h: item.sales24h,
        volume24h: item.volume24h,
        volume24hSymbol: item.volume24hSymbol
      };
    });
  }
  function interleaveItems(groups) {
    groups = Array.isArray(groups) ? groups : [];
    var result = [], maxLength = 0;
    groups.forEach(function (group) {
      maxLength = Math.max(maxLength, Array.isArray(group) ? group.length : 0);
    });
    for (var index = 0; index < maxLength; index++) {
      for (var groupIndex = 0; groupIndex < groups.length; groupIndex++) {
        var item = Array.isArray(groups[groupIndex]) ? groups[groupIndex][index] : null;
        if (item) result.push(item);
      }
    }
    return result;
  }
  function sortItems(items, sort) {
    var result = Array.isArray(items) ? items.slice() : [];
    function numeric(value, fallback) {
      return typeof value === "number" ? value : fallback;
    }
    if (sort === "price") {
      result.sort(function (left, right) {
        return numeric(left.p, 1e18) - numeric(right.p, 1e18);
      });
    } else if (sort === "sales") {
      result.sort(function (left, right) {
        return numeric(right.sales24h, -1) - numeric(left.sales24h, -1);
      });
    }
    return result;
  }
  function favoriteKey(item) {
    item = item || {};
    return String(item.collectionSlug || item.collection || "") + ":" +
      String(item.tokenId || item.n || "");
  }
  root.TM_NFT_ITEM_UTILS = Object.freeze({
    normalizeItems: normalizeItems,
    interleaveItems: interleaveItems,
    sortItems: sortItems,
    favoriteKey: favoriteKey
  });
})(window);
