/* TradeMate home redesign v2 (matches trademate-redesign-v10).
 * Layout: header (menu, logo, actions), search, slide banner, Contract Scout, Top Categories, Deals of the Day,
 * Favorites, floating pill bottom bar, Profile as a bottom sheet.
 * Palettes: Light and Purple follow v10 (solid colours). Dark keeps its own theme variables untouched.
 * Data: Deals of the Day uses the same backend call as the app (GET /api/market/listings).
 * Runs as a DOM/CSS patch after app.js; every existing button, data-* hook and handler is reused. */
(function () {
  'use strict';
  if (window.__tmHomeRedesign) return;
  window.__tmHomeRedesign = true;

  var H = 'html body #app .view:has(.home-market-shortcuts)';
  var PG = 'html body #pg .pgs[data-id="profile"]';
  var BAR = 'html body #mwbar:has(.tm-hb-l)';
  var css = [
    /* ---------- Palettes (v10). Dark is intentionally not listed. ---------- */
    'html[data-theme="light"]{--bg:#FFFFFF;--s1:#F8FAFC;--s2:#EEF2FF;--s3:#E2E8F0;--line:#E2E8F0;--txt:#0F172A;--txt2:#334155;--text:#0F172A;--mut:#586579;--dis:#94A3B8;--am:#4F46E5;--co:#4F46E5;--in:#4F46E5;--grad:#4F46E5;--grad2:#4F46E5;--navbg:#FFFFFF;--navsolid:#FFFFFF;--sbbg:#FFFFFF;--card:#FFFFFF;--ongrad:#FFFFFF;--scrim:#94A3B8;--up:#047857;--glow:#4F46E533}',
    'html[data-theme="purple"]{--bg:#0F0E15;--s1:#17161F;--s2:#232131;--s3:#2E2C3C;--line:#2E2C3C;--txt:#F3F2F8;--txt2:#D7D5E4;--text:#F3F2F8;--mut:#A8A5B8;--am:#A495F8;--co:#A495F8;--in:#A495F8;--grad:#A495F8;--grad2:#A495F8;--navbg:#0F0E15;--navsolid:#0F0E15;--sbbg:#0F0E15;--card:#17161F;--ongrad:#14111F;--scrim:#050409;--up:#34D399;--glow:#A495F833}',
    'html[data-theme="light"],html[data-theme="light"] body{background:#FFFFFF}',
    'html[data-theme="light"] body .tabs button.on:not(#tm-x){color:#4F46E5!important}',

    /* ---------- Header: menu | logo + name | actions (the existing #mwbar, restructured) ---------- */
    BAR + '{display:grid!important;grid-template-columns:1fr auto 1fr;align-items:center;padding-left:14px!important;padding-right:14px!important;gap:0!important;border-bottom:0!important;background:var(--bg)!important}',
    BAR + ' .tm-hb-l{display:flex;align-items:center;gap:2px;justify-self:start}',
    BAR + ' .tm-hb-c{display:flex;align-items:center;gap:7px}',
    BAR + ' .tm-hb-c img{width:26px;height:26px;border-radius:8px;object-fit:cover}',
    BAR + ' .tm-hb-c b{font:800 16px "Bricolage Grotesque","Hanken Grotesk",sans-serif;letter-spacing:-.015em;color:var(--txt)}',
    BAR + ' .tm-hb-r{display:flex;align-items:center;gap:2px;justify-self:end}',
    BAR + ' .hb,' + BAR + ' #mwmenu{position:relative;width:34px;height:34px;margin:0!important;padding:0;display:grid;place-items:center;background:none!important;border:0!important;border-radius:0!important;color:var(--txt);box-shadow:none!important}',
    BAR + ' .hb svg,' + BAR + ' #mwmenu svg{width:19px;height:19px}',
    BAR + ' .hb.tm-av{width:30px;height:30px;border-radius:50%!important;overflow:hidden}',

    /* ---------- Home: order and spacing ---------- */
    H + '{display:flex!important;flex-direction:column;padding-bottom:calc(120px + env(safe-area-inset-bottom,0px))!important}',
    H + '>*{order:30}',
    H + '>.top{order:0}',
    H + '>.tbn,' + H + '>.home-promo-tbn,' + H + '>.banner{order:1}',
    H + '>.sc-promo{order:2}',
    H + '>.tm-sec-cats{order:3}',
    H + '>.home-market-shortcuts{order:4}',
    H + '>.tm-sec-deals{order:5}',
    H + '>.tm-deals{order:6}',
    H + '>.tabs{order:7}',

    /* top row: when #mwbar carries the actions the row keeps only the search field */
    H + '>.top{display:block!important;padding:0 20px!important;margin:0!important;border:0!important;background:none!important}',
    H + '>.top[data-tm-bar]>:not(.srch){display:none!important}',
    H + '>.top:not([data-tm-bar]){display:grid!important;grid-template-columns:auto 1fr auto auto auto;grid-template-areas:"av br sc su bl" "se se se se se";align-items:center;column-gap:8px;padding:16px 20px 0!important}',
    H + '>.top:not([data-tm-bar]) .avb{grid-area:av}',
    H + '>.top:not([data-tm-bar]) .tm-brand{grid-area:br;display:flex;align-items:center;gap:8px;min-width:0}',
    H + '>.top:not([data-tm-bar]) .tm-brand img{width:26px;height:26px;border-radius:8px}',
    H + '>.top:not([data-tm-bar]) .tm-brand b{font:800 16px "Bricolage Grotesque","Hanken Grotesk",sans-serif;color:var(--txt)}',
    H + '>.top:not([data-tm-bar]) .ib[data-pg="scan"]{grid-area:sc}',
    H + '>.top:not([data-tm-bar]) .ib[data-pg="support"]{grid-area:su}',
    H + '>.top:not([data-tm-bar]) .ib[data-pg="notif"]{grid-area:bl}',
    H + '>.top .tm-brand{display:none}',
    H + '>.top:not([data-tm-bar]) .tm-brand{display:flex}',
    H + '>.top .srch{grid-area:se;display:flex!important;align-items:center;gap:10px;width:100%!important;height:38px!important;margin:30px 0 0!important;padding:0!important;background:none!important;border:0!important;box-shadow:none!important}',
    H + '>.top .srch .tm-sf{flex:1;min-width:0;height:38px;display:flex;align-items:center;gap:8px;padding:0 12px;border:1px solid var(--line);border-radius:12px;color:var(--mut);font-size:13px;overflow:hidden;text-align:left}',
    H + '>.top .srch .tm-sf svg{width:18px;height:18px;flex:none}',
    H + '>.top .srch .tm-go{flex:none;width:38px;height:38px;border-radius:12px;background:var(--am);color:var(--ongrad,#1b1006);display:grid;place-items:center}',
    H + '>.top .srch .tm-go svg{width:18px;height:18px;color:inherit!important;stroke:currentColor}',

    /* ---------- Slide banner (same slides, v10 look) ---------- */
    H + '>.tbn,' + H + '>.home-promo-tbn{position:relative;margin:38px 20px 0!important}',
    H + ' .tbn-track{border:1px solid var(--line)!important;border-radius:24px!important;background:var(--s1)!important;box-shadow:none!important}',
    H + ' .tbn-s{position:relative;display:block!important;grid-template-columns:none!important;padding:18px!important;min-height:168px!important;background:none!important;overflow:hidden}',
    H + ' .tbn-s:after{content:none!important}',
    H + ' .tbn-tag{font:500 9px "DM Mono",monospace!important;letter-spacing:.16em;padding:4px 8px!important;border-radius:6px!important;background:var(--bg)!important;border:0!important;color:var(--am)!important}',
    H + ' .tbn h2{margin:12px 0 0!important;max-width:190px;font:800 22px/1.15 "Bricolage Grotesque","Hanken Grotesk",sans-serif!important;letter-spacing:-.015em}',
    H + ' .tbn h2 em{color:var(--am)}',
    H + ' .tbn p{margin:5px 0 0!important;max-width:200px;font-size:13px!important;color:var(--mut)}',
    H + ' .tbn-list{position:absolute;left:18px;bottom:30px;display:flex;gap:10px;overflow:visible!important}',
    H + ' .tbn-chip{height:28px;padding:0 11px!important;border-radius:10px!important;background:var(--bg)!important;border:1px solid var(--line)!important;font-size:11px!important;font-weight:700;gap:6px}',
    H + ' .tbn-chip small{font-size:9.5px;font-weight:600;color:var(--up)}',
    H + ' .tbn-dots{position:absolute;left:0;right:0;bottom:16px;margin:0!important;display:flex;justify-content:center;gap:6px;pointer-events:none}',
    H + ' .tbn-dots i{width:6px!important;height:5px!important;border-radius:3px!important;background:var(--line)!important;pointer-events:auto}',
    H + ' .tbn-dots i.on{width:20px!important;background:var(--am)!important}',
    H + ' .tm-art{position:absolute;right:16px;top:18px;width:84px;height:84px;border-radius:22px;background:var(--s2);color:var(--am);display:grid;place-items:center}',
    H + ' .tm-art svg{width:34px;height:34px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}',

    /* ---------- Contract Scout (existing quick market overview button, v10 look) ---------- */
    H + '>.sc-promo{margin:10px 20px 0!important;height:54px;padding:0 14px!important;border-radius:18px!important;background:var(--s1)!important;border:1px solid var(--line)!important;box-shadow:none!important;display:flex!important;align-items:center;gap:12px;text-align:left}',
    H + '>.sc-promo>svg{width:20px;height:20px;flex:none;color:var(--am)!important}',
    H + '>.sc-promo>span:nth-child(2){min-width:0}',
    H + '>.sc-promo b{display:block;font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    H + '>.sc-promo small{display:block;font-size:12px;font-weight:500;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    H + '>.sc-promo .go{flex:none;width:32px;height:32px;border-radius:50%!important;background:var(--am)!important;color:var(--ongrad,#1b1006)!important;border:0!important;display:grid;place-items:center}',
    H + '>.sc-promo .go svg{width:16px;height:16px;color:inherit!important;stroke:currentColor}',

    /* ---------- Section headers ---------- */
    '.tm-sec{display:flex;justify-content:space-between;align-items:flex-end;margin:48px 20px 18px}',
    '.tm-sec b{display:block;font:800 17px "Bricolage Grotesque","Hanken Grotesk",sans-serif;letter-spacing:-.015em;color:var(--txt)}',
    '.tm-sec small{display:block;font-size:11px;font-weight:500;color:var(--mut);margin-top:2px}',
    '.tm-sec .tm-va{background:none;border:0;padding:0;cursor:pointer;font-weight:700;font-size:12.5px;color:var(--am)}',

    /* ---------- Top Categories ---------- */
    H + '>.home-market-shortcuts{display:flex!important;grid-template-columns:none!important;gap:10px!important;overflow-x:auto;scrollbar-width:none;margin:0!important;padding:0 20px 2px!important}',
    H + '>.home-market-shortcuts::-webkit-scrollbar{display:none}',
    H + '>.home-market-shortcuts .mk-card{flex:none!important;width:60px!important;min-width:0!important;height:auto!important;min-height:0!important;padding:0!important;display:flex!important;flex-direction:column!important;align-items:center!important;gap:7px!important;background:none!important;border:0!important;box-shadow:none!important}',
    H + '>.home-market-shortcuts .mk-ico{width:54px!important;height:54px!important;border-radius:50%!important;background:var(--s2)!important;color:var(--am)!important;display:grid!important;place-items:center!important;border:0!important;box-shadow:none!important}',
    H + '>.home-market-shortcuts .mk-ico svg{width:22px!important;height:22px!important}',
    H + '>.home-market-shortcuts .mk-name{font-size:11px!important;font-weight:600!important;line-height:1.15!important;text-align:center!important;white-space:normal!important;color:var(--txt)!important}',

    /* ---------- Deals of the Day (+ loading skeleton) ---------- */
    '.tm-deals{display:flex;gap:10px;overflow-x:auto;scrollbar-width:none;padding:0 20px 2px}',
    '.tm-deals::-webkit-scrollbar{display:none}',
    '.tm-deal{flex:none;width:calc((100% - 20px)/3);min-width:0;cursor:pointer;text-align:left;color:var(--txt);font-size:12px;font-weight:700}',
    '.tm-deal .im{position:relative;aspect-ratio:1/1;border-radius:16px;background:var(--s1);border:1px solid var(--line);display:grid;place-items:center;color:var(--am)}',
    '.tm-deal .im svg{width:30px;height:30px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}',
    '.tm-deal .bd{position:absolute;top:7px;right:7px;max-width:calc(100% - 14px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:var(--am);color:var(--ongrad,#1b1006);font-size:9px;font-weight:700;padding:2px 7px;border-radius:999px}',
    '.tm-deal .t{margin-top:12px;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
    '.tm-deal .p{margin-top:3px;font-size:13px}',
    '.tm-deal.sk{cursor:default}',
    '.tm-deal.sk .im,.tm-deal.sk .t,.tm-deal.sk .p{animation:tmsk 1.4s ease-in-out infinite}',
    '.tm-deal.sk .im{border-color:transparent}',
    '.tm-deal.sk .t{height:12px;width:90%;border-radius:6px}',
    '.tm-deal.sk .p{height:12px;width:55%;border-radius:6px}',
    '@keyframes tmsk{0%,100%{background:var(--s1)}50%{background:var(--s3)}}',
    '@media (prefers-reduced-motion:reduce){.tm-deal.sk .im,.tm-deal.sk .t,.tm-deal.sk .p{animation:none;background:var(--s2)}}',

    /* ---------- Favorites ---------- */
    H + '>.tabs{margin:48px 20px 18px!important;padding:0!important;border:0!important}',
    H + '>.tabs button{font:800 17px "Bricolage Grotesque","Hanken Grotesk",sans-serif!important;color:var(--txt)!important}',

    /* ---------- Floating pill bottom bar ---------- */
    'html:not(.tm-desktop) body:not(.tm-desktop) #nav{left:50%!important;right:auto!important;transform:translateX(-50%)!important;width:min(calc(100% - 36px),394px)!important;max-width:none!important;bottom:calc(16px + env(safe-area-inset-bottom,0px))!important;height:64px;border:1px solid var(--line)!important;border-radius:32px!important;padding:7px!important;background:var(--bg)!important}',
    'html:not(.tm-desktop) body:not(.tm-desktop) #nav button{display:grid!important;place-items:center;align-content:center;gap:2px;font-size:10px;font-weight:600;color:var(--mut)}',
    'html:not(.tm-desktop) body:not(.tm-desktop) #nav button.on:not(.plus){background:var(--s2)!important;color:var(--am)!important;border-radius:26px}',
    '#nav .tm-nl{font-size:10px;font-weight:600;line-height:1}',
    'html:not(.tm-desktop) body:not(.tm-desktop) #nav button.plus{color:var(--txt)}',

    /* ---------- Profile: bottom sheet, same hooks, v10 look ---------- */
    '#pg:has(.pgs[data-id="profile"])::before{content:"";position:fixed;inset:0;z-index:29;background:var(--scrim)}',
    PG + '{inset:auto 0 0 0!important;margin:0 auto!important;width:min(100%,560px)!important;height:min(92vh,860px)!important;border-radius:34px 34px 0 0!important;border:0!important;background:var(--bg)!important;z-index:30!important}',
    PG + '::before{content:"";display:block;width:46px;height:5px;border-radius:3px;background:var(--line);margin:12px auto 0}',
    PG + ' .ph{justify-content:flex-end;padding:12px 20px 0}',
    PG + ' .ph .bk2,' + PG + ' .rts .rt[data-pg="support"]{display:none!important}',
    PG + ' .rts .rt{width:40px;height:40px;border-radius:50%;background:var(--s2)!important;display:grid;place-items:center}',
    PG + ' .idp-grid{padding:8px 20px 18px!important;gap:24px!important}',
    PG + ' .idp-c3{width:min(354px,100%)!important;max-width:none!important;height:292px;aspect-ratio:auto!important;margin:8px auto 0!important}',
    PG + ' .idp-cf,' + PG + ' .idp-cb{border-radius:28px!important;padding:20px 20px 18px!important;border:1px solid var(--am)!important;background:var(--s2)!important;box-shadow:none!important}',
    PG + ' .idp-cf:before,' + PG + ' .idp-cb:before{height:5px!important;background:var(--am)!important}',
    PG + ' .idp-cf:after{content:none!important}',
    PG + ' .idp-cm{font-size:10.5px;letter-spacing:.2em}',
    PG + ' .idp-gl{height:34px;background:var(--bg)!important;border:1px solid var(--line)!important;font-size:12.5px}',
    PG + ' .idp-id{flex-direction:column!important;align-items:center!important;gap:12px!important;margin-top:20px!important;text-align:center}',
    PG + ' .idp-id>div{display:grid;justify-items:center;gap:12px}',
    PG + ' .idp-pav{width:88px!important;height:88px!important;border-radius:50%!important;outline:3px solid var(--am)!important;outline-offset:4px!important}',
    PG + ' .idp-pav .big,' + PG + ' .idp-pav .big svg{border-radius:0!important}',
    PG + ' .idp-nm{font:800 22px "Bricolage Grotesque","Hanken Grotesk",sans-serif!important;margin:4px 0 0!important;letter-spacing:-.015em}',
    PG + ' .idp-id .idp-gl{height:30px!important;font-size:12px}',
    PG + ' .idp-bt{position:static!important;margin-top:12px;justify-content:center!important}',
    PG + ' .idp-ok{height:30px;font-size:12px;background:var(--bg)!important}',
    PG + ' .idp-sqs{gap:12px!important;margin-top:22px!important}',
    PG + ' .idp-sq{height:68px;min-height:0!important;padding:0 14px!important;border-radius:18px!important;background:var(--bg)!important;font-size:12px!important}',
    PG + ' .idp-vc{position:relative;padding:20px!important;border-radius:24px!important;background:var(--s2)!important;border:1px solid var(--line)!important}',
    PG + ' .idp-vh{align-items:flex-start}',
    PG + ' .idp-sh{display:none!important}',
    PG + ' .idp-vh>div:before{content:"ACCOUNT TRUST";display:block;font:500 9px "DM Mono",monospace;letter-spacing:.16em;color:var(--am);margin-bottom:6px}',
    PG + ' .idp-vh h3{font-size:20px!important}',
    PG + ' .idp-vh p{font-size:13px!important}',
    PG + ' .idp-vm{position:absolute;top:20px;right:20px;margin:0!important}',
    PG + ' .idp-vm small{display:inline-flex;align-items:center;height:26px;padding:0 12px;border-radius:99px;border:1px solid var(--line);background:var(--bg);color:var(--am);font-size:11px;font-weight:700}',
    PG + ' .idp-cta{height:54px!important;margin-top:18px;border-radius:18px!important;background:var(--am)!important;background-image:none!important;color:var(--ongrad,#1b1006)!important;box-shadow:none!important;font-size:15px!important}',
    PG + ' .idp-r .sec{font:500 11px "DM Mono",monospace!important;letter-spacing:.2em;color:var(--mut)}',
    PG + ' .idp-chip{height:42px!important;border-radius:99px!important;background:var(--s1)!important}',
    PG + ' .idp-allbtn{height:46px!important;padding:0 34px!important;font-size:14px!important}',
    PG + ' .pfoot.idp-strip{margin:30px 20px 18px!important;height:52px!important;border-radius:18px!important;box-shadow:none!important;background:var(--s1)!important}'
  ].join('\n');

  var style = document.createElement('style');
  style.id = 'tm-home-redesign';
  style.textContent = css;
  document.head.appendChild(style);

  /* ---------- Light theme: re-tint the app's hard-coded blue rules to the v10 indigo ---------- */
  var MAP = [[/#2563eb/gi, '#4F46E5'], [/#1d4ed8/gi, '#4338CA'], [/#eff6ff/gi, '#EEF2FF'], [/#dbeafe/gi, '#E0E7FF'],
    [/#3b82f6/gi, '#4F46E5'], [/#f5f5f5/gi, '#F8FAFC'], [/rgba\(\s*37\s*,\s*99\s*,\s*235\s*,/gi, 'rgba(79,70,229,']];
  var BLUE = /#2563eb|#1d4ed8|#eff6ff|#dbeafe|#3b82f6|rgba\(\s*37\s*,\s*99\s*,\s*235/i;
  var tintEl = document.createElement('style');
  tintEl.id = 'tm-light-purple';
  document.head.insertBefore(tintEl, style);
  var tintTimer = 0;
  function tint(s) { MAP.forEach(function (m) { s = s.replace(m[0], m[1]); }); return s; }
  function collect(rules, out) {
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      try {
        if (r.type === 1) {
          if (/data-theme="light"|data-theme=light/.test(r.selectorText || '') && BLUE.test(r.cssText)) out.push(tint(r.cssText));
        } else if (r.cssRules && r.type !== 5 && r.type !== 7) {
          var inner = [];
          collect(r.cssRules, inner);
          if (inner.length) out.push(r.cssText.slice(0, r.cssText.indexOf('{')) + '{' + inner.join('') + '}');
        }
      } catch (e) { /* skip */ }
    }
  }
  function retintLight() {
    tintTimer = 0;
    if (document.documentElement.getAttribute('data-theme') !== 'light') { tintEl.textContent = ''; keepLast(); return; }
    var out = [];
    for (var i = 0; i < document.styleSheets.length; i++) {
      var sh = document.styleSheets[i], n = sh.ownerNode;
      if (n && (n.id === 'tm-light-purple' || n.id === 'tm-home-redesign')) continue;
      try { collect(sh.cssRules, out); } catch (e) { /* cross-origin sheet */ }
    }
    tintEl.textContent = out.join('\n');
    keepLast();
  }
  function keepLast() {
    var h = document.head;
    if (h.lastElementChild !== style) { h.appendChild(tintEl); h.appendChild(style); }
  }
  function scheduleTint() { if (!tintTimer) tintTimer = setTimeout(retintLight, 200); }
  try {
    new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++)
        for (var j = 0; j < list[i].addedNodes.length; j++) {
          var id = list[i].addedNodes[j].id;
          if (id !== 'tm-light-purple' && id !== 'tm-home-redesign') { scheduleTint(); return; }
        }
    }).observe(document.head, { childList: true });
    new MutationObserver(scheduleTint).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  } catch (e) { /* observers unavailable */ }
  scheduleTint(); setTimeout(scheduleTint, 900); setTimeout(scheduleTint, 2800); setTimeout(scheduleTint, 6000);

  /* ---------- Home enhancements ---------- */
  var LOGO = '/tm/img/logo.png';
  var CSYM = { NGN: '\u20A6', USD: '$', EUR: '\u20AC', GBP: '\u00A3', GHS: '\u20B5', KES: 'KSh' };
  var DIVL = { services: 'Services', b2b: 'B2B', real_estate: 'Real Estate', software: 'Technology', industrial_trade: 'Industrial',
    agriculture: 'Agriculture', finance_investment: 'Finance', institution_infrastructure: 'Institution', sports: 'Sports Transfer', entertainment: 'Art' };
  var DIVK = { services: 'Services', real_estate: 'Real Estate', software: 'Software', industrial_trade: 'Industrial & Trade',
    agriculture: 'Agriculture', sports: 'Sports', entertainment: 'Entertainment' };
  var P = { // v10 icon set, used where the category row has no matching icon
    b: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 13h18"/>',
    o: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9"/>',
    u: '<path d="M5 21V4h9v17M14 9h5v12M8 8h3M8 12h3M8 16h3"/>',
    x: '<path d="M3 17l5-5 4 4 8-9M3 21h18"/>',
    g: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    h: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'
  };
  var DIVP = { services: 'b', b2b: 'o', real_estate: 'h', software: 'g', industrial_trade: 'u', agriculture: 'g', finance_investment: 'x', institution_infrastructure: 'u', sports: 'g', entertainment: 'g' };
  var TTL = 60000, deals = null, dealsAt = 0, flight = null;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function svgEl(inner) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = inner;
    return s;
  }
  function head(cls, title, sub) {
    var d = el('div', 'tm-sec ' + cls), l = el('div');
    l.appendChild(el('b', null, title));
    if (sub) l.appendChild(el('small', null, sub));
    d.appendChild(l);
    var b = el('button', 'tm-va', 'View all');
    b.type = 'button';
    b.setAttribute('data-tab', 'Markets'); /* Explore contracts */
    d.appendChild(b);
    return d;
  }
  function price(l) {
    var n = Number(l.price_minor_units) / 100;
    if (!isFinite(n)) return '';
    return (CSYM[l.currency_code] || l.currency_code || '') + ' ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function build(list) {
    var seen = {};
    return list.filter(function (l) { return l && l.title; }).slice(0, 8).map(function (l) {
      var name = l.title, i = 2;
      while (seen[name]) name = l.title + ' (' + i++ + ')'; /* same de-duplication the app applies */
      seen[name] = 1;
      return { name: name, title: l.title, price: price(l), div: l.division || '' };
    });
  }
  function loadDeals() {
    if (deals && Date.now() - dealsAt < TTL) return;
    if (flight) return;
    flight = fetch('/api/market/listings?limit=50', { cache: 'no-store', credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('bad status'); return r.json(); })
      .then(function (d) { deals = build((d && d.data) || []); dealsAt = Date.now(); })
      .catch(function () { if (!deals) deals = []; dealsAt = Date.now() - TTL + 15000; })
      .then(function () { flight = null; enhance(); });
  }
  function icon(div, view) {
    var src = DIVK[div] && view.querySelector('.home-market-shortcuts .mk-card[data-mm="' + DIVK[div].replace(/"/g, '') + '"] .mk-ico svg');
    return src ? src.cloneNode(true) : svgEl(P[DIVP[div] || 'g']);
  }
  function dealCard(d, view) {
    var c = el('div', 'tm-deal');
    c.setAttribute('role', 'button'); c.tabIndex = 0;
    c.setAttribute('data-open', d.name);
    var im = el('div', 'im');
    if (DIVL[d.div]) im.appendChild(el('span', 'bd', DIVL[d.div]));
    im.appendChild(icon(d.div, view));
    c.appendChild(im);
    c.appendChild(el('div', 't', d.title));
    if (d.price) c.appendChild(el('div', 'p', d.price));
    return c;
  }
  function skeleton() {
    var out = [];
    for (var i = 0; i < 3; i++) {
      var c = el('div', 'tm-deal sk');
      c.setAttribute('aria-hidden', 'true');
      c.appendChild(el('div', 'im')); c.appendChild(el('div', 't')); c.appendChild(el('div', 'p'));
      out.push(c);
    }
    return out;
  }

  /* header: the existing #mwbar becomes menu | logo + name | actions */
  function syncBar(top) {
    var bar = document.getElementById('mwbar');
    if (!bar) return false;
    if (!bar.querySelector('.tm-hb-l')) {
      var menu = bar.querySelector('#mwmenu');
      if (!menu) return false;
      var img = bar.querySelector('img'), L = el('div', 'tm-hb-l'), C = el('div', 'tm-hb-c'), R = el('div', 'tm-hb-r');
      L.appendChild(menu);
      if (img) C.appendChild(img);
      C.appendChild(el('b', null, 'TradeMate'));
      bar.textContent = '';
      bar.appendChild(L); bar.appendChild(C); bar.appendChild(R);
    }
    var Lg = bar.querySelector('.tm-hb-l'), Rg = bar.querySelector('.tm-hb-r');
    var sig = '';
    var src = top ? [].slice.call(top.querySelectorAll('.avb,.ib[data-pg="scan"],.ib[data-pg="support"],.ib[data-pg="notif"]')) : [];
    src.forEach(function (b) { sig += b.outerHTML; });
    if (Rg.getAttribute('data-sig') === sig) return true;
    Rg.setAttribute('data-sig', sig);
    Rg.textContent = '';
    var oldAv = Lg.querySelector('.tm-av'); if (oldAv) oldAv.remove();
    src.forEach(function (b) {
      var c = el('button', 'hb'); c.type = 'button';
      ['data-pg', 'data-arg', 'data-act', 'aria-label'].forEach(function (a) { if (b.hasAttribute(a)) c.setAttribute(a, b.getAttribute(a)); });
      c.innerHTML = b.innerHTML;
      /* The redesigned header uses proxy buttons. Forward activation to the original
       * app button so its directly-bound handler and state logic remain intact. */
      c.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        /* Resolve the live source after app view changes; the old topbar node may
         * have been replaced while this persistent header proxy remains mounted. */
        var current = document.querySelector('#app .view .top .avb[data-pg="profile"]');
        (current || (b.isConnected ? b : null) || document.querySelector('#app .top .avb[data-pg="profile"]'))?.click();
      });
      if (b.classList.contains('avb')) { c.classList.add('tm-av'); Lg.appendChild(c); } else Rg.appendChild(c);
    });
    return true;
  }
  function clearBar() {
    var bar = document.getElementById('mwbar');
    if (!bar) return;
    var Rg = bar.querySelector('.tm-hb-r'), av = bar.querySelector('.tm-av');
    if (Rg && Rg.firstChild) { Rg.textContent = ''; Rg.removeAttribute('data-sig'); }
    if (av) av.remove();
  }
  function labelNav() {
    var nav = document.getElementById('nav');
    if (!nav) return;
    [].forEach.call(nav.querySelectorAll('button'), function (b) {
      if (b.querySelector('.tm-nl')) return;
      var l = b.dataset.tab || (b.dataset.pg === 'scout' ? 'Scout' : '') || b.getAttribute('aria-label') || '';
      if (l) b.appendChild(el('span', 'tm-nl', l));
    });
  }
  function artFor(slide, view) {
    if (slide.querySelector('.tm-art')) return;
    var chip = slide.querySelector('.tbn-chip'), label = chip ? chip.textContent.toLowerCase() : '', div = 'services';
    var hit = Object.keys(DIVL).filter(function (k) { return label.indexOf(DIVL[k].toLowerCase()) === 0; })[0];
    if (hit) div = hit;
    var a = el('div', 'tm-art'); a.setAttribute('aria-hidden', 'true'); a.appendChild(icon(div, view));
    slide.insertBefore(a, slide.firstChild);
  }
  function enhance() {
    labelNav();
    var v = document.querySelector('#app .view');
    var sc = v && v.querySelector('.home-market-shortcuts');
    var top = v && v.querySelector('.top');
    /* #mwbar is persistent across app views. Keep its Profile/action proxies
     * alive outside Home; clearBar here removed the only Profile entry and
     * stranded every flow that switches account mode from Profile. */
    if (top) syncBar(top);
    if (!sc) return;
    if (top) {
      var av = top.querySelector('.avb');
      if (av && !top.querySelector('.tm-brand')) {
        var br = el('div', 'tm-brand'), im = el('img'); im.src = LOGO; im.alt = '';
        im.onerror = function () { im.style.display = 'none'; };
        br.appendChild(im); br.appendChild(el('b', null, 'TradeMate'));
        top.insertBefore(br, av.nextSibling);
      }
      var s = top.querySelector('.srch');
      if (s && !s.querySelector('.tm-sf')) {
        var f = el('div', 'tm-sf'), g = el('span', 'tm-go'), ico = s.querySelector('svg');
        while (s.firstChild) f.appendChild(s.firstChild);
        g.setAttribute('aria-hidden', 'true');
        if (ico) g.appendChild(ico.cloneNode(true));
        s.appendChild(f); s.appendChild(g);
      }
      if (syncBar(top)) top.setAttribute('data-tm-bar', ''); else top.removeAttribute('data-tm-bar');
    }
    [].forEach.call(v.querySelectorAll('.tbn-s'), function (sl) { artFor(sl, v); });
    if (!v.querySelector('.tm-sec-cats')) v.insertBefore(head('tm-sec-cats', 'Top Categories'), sc);
    loadDeals();
    var have = v.querySelector('.tm-deals'), hd = v.querySelector('.tm-sec-deals');
    if (!hd) { hd = head('tm-sec-deals', 'Deals of the Day', 'Top trending on TradeMate'); sc.after(hd); }
    if (!have) { have = el('div', 'tm-deals'); hd.after(have); }
    var real = deals && deals.length;
    var key = real ? deals.map(function (d) { return d.name + '|' + d.price; }).join('~') : 'skeleton';
    if (have.getAttribute('data-key') !== key) {
      have.textContent = '';
      if (real) deals.forEach(function (d) { have.appendChild(dealCard(d, v)); });
      else skeleton().forEach(function (c) { have.appendChild(c); });
      have.setAttribute('data-key', key);
    }
  }

  var raf = 0;
  function schedule() { if (!raf) raf = requestAnimationFrame(function () { raf = 0; enhance(); }); }
  function start() {
    var app = document.getElementById('app');
    if (!app) { setTimeout(start, 200); return; }
    new MutationObserver(schedule).observe(app, { childList: true, subtree: true });
    var nav = document.getElementById('nav');
    if (nav) new MutationObserver(schedule).observe(nav, { childList: true, subtree: true });
    enhance();
  }
  start();

  /* keyboard activation for deal cards, and tap-outside to close the Profile sheet */
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if ((e.key === 'Enter' || e.key === ' ') && t && t.classList && t.classList.contains('tm-deal') && !t.classList.contains('sk')) { e.preventDefault(); t.click(); }
  });
  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'pg' && document.querySelector('#pg .pgs[data-id="profile"]')) {
      var b = document.querySelector('#pg .pgs[data-id="profile"] [data-back]');
      if (b) b.click();
    }
  });
})();
