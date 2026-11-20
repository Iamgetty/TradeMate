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
  root.TM_NFT_ITEM_UTILS = Object.freeze({ normalizeItems: normalizeItems });
})(window);
