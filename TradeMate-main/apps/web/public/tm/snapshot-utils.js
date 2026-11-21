/* TradeMate snapshot storage helpers. Storage formats and expiry rules match the legacy runtime. */
(function(root){
  "use strict";
  function createNftSnapshotStore(options){
    var prefix=options.prefix,getChain=options.getChain;
    function key(term){return prefix+getChain()+"."+encodeURIComponent(String(term).toLowerCase())}
    function save(term,items){try{localStorage.setItem(key(term),JSON.stringify({savedAt:Date.now(),items:items}))}catch(e){}}
    function load(term){try{var value=JSON.parse(localStorage.getItem(key(term))||"null");if(value&&value.items&&value.items.length&&Date.now()-value.savedAt<6048e5)return value.items}catch(e){}return null}
    return Object.freeze({key:key,save:save,load:load});
  }
  function createMarketQuoteSnapshotStore(options){
    var prefix=options.prefix,items=options.items;
    function key(item){return prefix+encodeURIComponent(String(item.m||"market"))+"."+encodeURIComponent(String(item.n||"instrument"))}
    function save(item,quote){try{if(!(item&&quote&&Number(quote.price)>0))return;var data={price:Number(quote.price),changePercent:Number.isFinite(Number(quote.changePercent))?Number(quote.changePercent):null,currency:quote.currency||item.quoteCurrency||item.unit||"USD",marketTime:quote.marketTime||item.quoteTime||null,exchange:quote.exchange||null};localStorage.setItem(key(item),JSON.stringify({savedAt:Date.now(),data:data}))}catch(e){}}
    function restore(item){try{if(!item)return false;var raw=localStorage.getItem(key(item));if(!raw)return false;var saved=JSON.parse(raw),data=saved&&saved.data,maxAge="Forex"!==item.m||item.assetClass?2592e6:12096e5;return !(!(data&&Number(data.price)>0&&saved.savedAt)||Date.now()-Number(saved.savedAt)>maxAge)&&(item.p=Number(data.price),item.c=Number.isFinite(Number(data.changePercent))?Number(data.changePercent):item.c,item.quoteStatus="cached",item.quoteTime=data.marketTime||null,item.quoteCurrency=data.currency||item.unit||"USD",item.snapshotAt=Number(saved.savedAt),true)}catch(e){return false}}
    function restoreAll(){try{items.forEach(function(item){"Forex"!==item.m||!item.providerSymbol||item.quoteStatus&&"unavailable"!==item.quoteStatus||restore(item)})}catch(e){}}
    return Object.freeze({key:key,save:save,restore:restore,restoreAll:restoreAll});
  }
  root.TM_SNAPSHOT_UTILS=Object.freeze({createNftSnapshotStore:createNftSnapshotStore,createMarketQuoteSnapshotStore:createMarketQuoteSnapshotStore});
})(window);
