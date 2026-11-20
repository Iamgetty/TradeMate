/* Pure display-formatting helpers shared by the legacy TradeMate runtime. */
(function(root){
  "use strict";
  function esc(value){return String(value==null?"":value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;")}
  function fmt(value,digits){return Number(value).toLocaleString(undefined,{maximumFractionDigits:digits==null?8:digits})}
  function fx2(value,digits){return Number(value).toLocaleString(undefined,{minimumFractionDigits:digits,maximumFractionDigits:digits})}
  root.TM_FORMAT_UTILS=Object.freeze({esc:esc,fmt:fmt,fx2:fx2});
})(window);
