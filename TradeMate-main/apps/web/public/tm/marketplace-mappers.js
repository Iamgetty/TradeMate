/* Pure API-to-view mapping for marketplace listings and enquiry conversations. */
(function(root){
  "use strict";
  function create(deps){
    var esc=deps.esc,fmt=deps.fmt,fmtT=deps.fmtT;
    var DIVISION_LABEL=deps.DIVISION_LABEL,CNAME=deps.CNAME,CSYM=deps.CSYM;
    function mapListing(t,e){
      var a=DIVISION_LABEL[t.division]||("b2b"===t.listing_type?"B2B":"Services"),
        r=t.currency_code,
        n=[["Type",a+" opportunity"],["Country",esc(CNAME[t.country_code]||t.country_code)]];
      return t.category_name&&n.unshift(["Category",esc(t.category_name)]),
        null!=t.quantity_available&&n.push(["Available",String(t.quantity_available)]),
        {id:t.id,srv:!0,n:t.title,m:a,p:(CSYM[r]||r)+" "+fmt(Number(t.price_minor_units)/100,2),c:null,k:a.charAt(0),h:e+1,seller:esc(t.seller_name),desc:t.description||"",det:n};
    }
    function dealFromEnq(t){
      var e="sent"===t.direction;
      return {id:t.id,eid:t.id,lid:t.listing_id,type:"chat",title:t.listing_title,market:"",
        sub:esc(e?t.seller_name:t.buyer_name||"Buyer"),
        amount:(CSYM[t.currency_code]||t.currency_code||"")+" "+fmt(Number(t.price_minor_units||0)/100,2),
        step:0,created:fmtT(t.created_at),at:t.last_message_at||t.updated_at||t.created_at,
        unread_count:Number(t.unread_count||0),msgs:[],loaded:!1};
    }
    function contractStatusLabel(t){
      return {proposed:"Awaiting response",accepted:"Accepted",rejected:"Declined",cancelled:"Cancelled",completed:"Completed",disputed:"Disputed"}[t]||t;
    }
    return {mapListing:mapListing,dealFromEnq:dealFromEnq,contractStatusLabel:contractStatusLabel};
  }
  root.TM_MARKETPLACE_MAPPERS=Object.freeze({create:create});
})(window);
