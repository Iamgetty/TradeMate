/* TradeMate FX reference-rate snapshot helpers.
 * Preserve the legacy storage key, payload shape, expiry and item mutation rules.
 */
(function(root){
  "use strict";
  var KEY="tm.fx.reference.snapshot.v1";
  var MAX_AGE=12096e5;
  function createFxSnapshotStore(options){
    var items=options.items;
    function apply(rates,mode,timestamp,savedAt){
      if(!rates||"object"!==typeof rates)return false;
      var quoteTime=timestamp||(new Date).toISOString(),changed=false;
      items.filter(function(item){return "Forex"===item.m&&!item.assetClass&&item.n.indexOf("/")>0;})
        .forEach(function(item){
          var pair=item.n.split("/"),base=pair[0],quote=pair[1];
          var baseRate="USD"===base?1:Number(rates[base]);
          var quoteRate="USD"===quote?1:Number(rates[quote]);
          if(baseRate>0&&quoteRate>0&&Number.isFinite(quoteRate/baseRate)){
            item.p=quoteRate/baseRate;
            item.quoteTime=quoteTime;
            if("cached"===mode){item.quoteStatus="cached";item.snapshotAt=savedAt||Date.now();}
            else{delete item.quoteStatus;delete item.snapshotAt;}
            changed=true;
          }
        });
      return changed;
    }
    function restore(){
      try{
        var raw=localStorage.getItem(KEY);
        if(!raw)return false;
        var saved=JSON.parse(raw),data=saved&&saved.data;
        return !(!(data&&data.rates&&saved.savedAt)||Date.now()-Number(saved.savedAt)>MAX_AGE)&&
          apply(data.rates,"cached",data.rateTimestamp,Number(saved.savedAt));
      }catch(error){return false;}
    }
    function save(payload){
      try{
        if(!payload||!payload.rates||"object"!==typeof payload.rates)return;
        localStorage.setItem(KEY,JSON.stringify({savedAt:Date.now(),data:{
          rates:payload.rates,
          rateTimestamp:payload.time_last_update_utc||(new Date).toISOString()
        }}));
      }catch(error){}
    }
    return Object.freeze({apply:apply,restore:restore,save:save});
  }
  root.TM_FX_SNAPSHOT_UTILS=Object.freeze({createFxSnapshotStore:createFxSnapshotStore});
})(window);
