/* Identity pass redesign: Profile, User Center and Profile picture.
 * Runs after app.js. Keeps every existing data-* hook, so handlers, routes and
 * state (st, act(), idvDone(), the photo preview module) behave as before. */
(function () {
  "use strict";
  if (window.__tmIdp) return;
  if (typeof PG === "undefined" || typeof st === "undefined" || !PG.profile || !PG.uc || !PG.avatar) return;
  window.__tmIdp = 1;

  var AV = [
    '<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true"><path d="M10 100c0-25 18-35 40-35s40 10 40 35z" fill="#27324a"/><rect x="43" y="55" width="14" height="14" rx="6" fill="#e3a47a"/><ellipse cx="33" cy="44" rx="3" ry="4.5" fill="#e3a47a"/><ellipse cx="67" cy="44" rx="3" ry="4.5" fill="#e3a47a"/><ellipse cx="50" cy="42" rx="17" ry="19" fill="#f1b98f"/><path d="M31 42c-4-18 7-27 19-27s23 9 19 27c-3-9-8-13-19-13s-16 4-19 13z" fill="#2a1d16"/><circle cx="43" cy="45" r="1.9" fill="#1b1006"/><circle cx="57" cy="45" r="1.9" fill="#1b1006"/><path d="M44 53q6 5 12 0" stroke="#1b1006" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
    '<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true"><path d="M24 48c-2-24 10-35 26-35s28 11 26 35c0 15 3 26 6 34H18c3-8 6-19 6-34z" fill="#5a2d1d"/><path d="M12 100c0-24 17-33 38-33s38 9 38 33z" fill="#3b2a5c"/><rect x="43" y="56" width="14" height="14" rx="6" fill="#e8ad88"/><ellipse cx="50" cy="43" rx="16" ry="18" fill="#f6c3a1"/><path d="M33 40c3-11 11-16 20-14 8 1 13 7 14 15-5-7-13-9-21-7-5 1-9 3-13 6z" fill="#5a2d1d"/><circle cx="44" cy="45" r="1.8" fill="#1b1006"/><circle cx="56" cy="45" r="1.8" fill="#1b1006"/><path d="M39.5 40q4.5-3 8-1M60.5 40q-4.5-3-8-1" stroke="#5a2d1d" stroke-width="1.4" fill="none" stroke-linecap="round"/><path d="M45 53q5 4 10 0" stroke="#c2415a" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="34" cy="50" r="1.8" fill="#ffc24d"/><circle cx="66" cy="50" r="1.8" fill="#ffc24d"/></svg>',
    '<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true"><path d="M24 46L28 14 47 33z" fill="#f0a24a"/><path d="M76 46L72 14 53 33z" fill="#f0a24a"/><path d="M30 38L32 23 41 33z" fill="#f7b3a0"/><path d="M70 38L68 23 59 33z" fill="#f7b3a0"/><ellipse cx="50" cy="58" rx="29" ry="25" fill="#f0a24a"/><path d="M50 34v8M43 36l2 7M57 36l-2 7" stroke="#c9741f" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="50" cy="66" rx="13" ry="9" fill="#f9d9a8"/><ellipse cx="39" cy="55" rx="4" ry="5" fill="#1b1006"/><ellipse cx="61" cy="55" rx="4" ry="5" fill="#1b1006"/><circle cx="40.2" cy="53.4" r="1.4" fill="#fff"/><circle cx="62.2" cy="53.4" r="1.4" fill="#fff"/><path d="M46 62h8l-4 4.5z" fill="#e0707f"/><path d="M50 66.5q-3 4-7 2.5M50 66.5q3 4 7 2.5" stroke="#1b1006" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M30 63l-12-2M30 67l-12 3M70 63l12-2M70 67l12 3" stroke="#fff" stroke-opacity=".85" stroke-width="1.3" stroke-linecap="round"/></svg>',
    '<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true"><path d="M10 100c0-25 18-35 40-35s40 10 40 35z" fill="#6b4f3a"/><path d="M40 66l10 14 10-14z" fill="#f4f1ea"/><rect x="43" y="55" width="14" height="14" rx="6" fill="#dca07b"/><path d="M32 46c-5-11 0-22 8-28-5 6-6 16-5 27zM68 46c5-11 0-22-8-28 5 6 6 16 5 27z" fill="#e8ecf2"/><ellipse cx="33" cy="46" rx="3" ry="4.5" fill="#dca07b"/><ellipse cx="67" cy="46" rx="3" ry="4.5" fill="#dca07b"/><ellipse cx="50" cy="43" rx="17" ry="19" fill="#eab08a"/><path d="M37 27c7-7 19-7 26 0-9-3-17-3-26 0z" fill="#e8ecf2"/><circle cx="43" cy="45" r="6.5" fill="none" stroke="#3a2a1e" stroke-width="1.6"/><circle cx="57" cy="45" r="6.5" fill="none" stroke="#3a2a1e" stroke-width="1.6"/><path d="M49.5 45h1" stroke="#3a2a1e" stroke-width="1.6"/><circle cx="43" cy="45" r="1.6" fill="#1b1006"/><circle cx="57" cy="45" r="1.6" fill="#1b1006"/><path d="M38 38l9-1.5M62 38l-9-1.5" stroke="#e8ecf2" stroke-width="2.2" stroke-linecap="round"/><path d="M40 54q5-4 10-1 5-3 10 1-5 5-10 3-5 2-10-3z" fill="#e8ecf2"/><path d="M45 59q5 3 10 0" stroke="#7a4a35" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>'
  ];
  var BG = ["linear-gradient(135deg,#7aa2f7,#8a7bf6)", "linear-gradient(135deg,#f0829a,#d97bb8)", "linear-gradient(135deg,#f4b95a,#ec7a55)", "linear-gradient(135deg,#6fd1c2,#4aa3e3)"];
  var NM = ["Guy", "Lady", "Cat", "Elderly man"];

  var CSS = `
.idp-cq{container-type:inline-size}
.idp-grid,.idp-ucg{display:grid;gap:14px;padding:10px 16px 18px}
@container (min-width:760px){.idp-grid,.idp-ucg{grid-template-columns:minmax(0,420px) minmax(0,1fr);gap:24px;align-items:start}}
.idp-c3{perspective:1200px;width:100%;max-width:440px;margin:0 auto;aspect-ratio:1.45}
.idp-ci{position:relative;width:100%;height:100%}
.idp-cf,.idp-cb{position:absolute;inset:0;border-radius:26px;overflow:hidden;color:var(--txt);padding:20px 18px 14px;border:1px solid color-mix(in srgb,var(--am) 38%,var(--line));background:linear-gradient(145deg,var(--s2),var(--s1));box-shadow:0 24px 60px color-mix(in srgb,var(--am) 14%,transparent),0 10px 30px rgba(0,0,0,.16);box-sizing:border-box}
.idp-cb{display:none}
.idp-c3.flip .idp-cf{display:none}.idp-c3.flip .idp-cb{display:block}
.idp-cf:before,.idp-cb:before{content:"";position:absolute;left:0;right:0;top:0;height:5px;background:linear-gradient(90deg,#ffc24d,#ff6a4d,#e0407f,#8a7bf6,#4aa3e3)}
.idp-cf:after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(120% 90% at 85% 0%,color-mix(in srgb,var(--am) 20%,transparent),transparent 55%),linear-gradient(115deg,transparent 40%,rgba(255,255,255,.07) 50%,transparent 60%)}
.idp-cm{color:var(--mut);font:500 10.5px/1 'DM Mono',monospace;letter-spacing:.2em;text-transform:uppercase}
.idp-ab{display:inline-block;background:var(--am);color:var(--ongrad,#1b1006);border-radius:6px;padding:3px 6px;font:800 9px 'DM Mono',monospace;letter-spacing:.1em;margin-left:8px}
.idp-top{display:flex;justify-content:space-between;align-items:center;gap:8px;position:relative;z-index:1}
.idp-gl{height:34px;padding:0 12px;border-radius:999px;border:1px solid var(--line);background:var(--s2);color:var(--txt);font:700 12.5px 'Hanken Grotesk',sans-serif;cursor:pointer;display:inline-flex;align-items:center;gap:6px;position:relative;z-index:1}
.idp-id{display:flex;gap:14px;align-items:center;margin-top:14px;position:relative;z-index:1}
.idp-pav{width:76px;height:76px;border-radius:22px;border:0;padding:0;flex:none;overflow:hidden;cursor:pointer;outline:2px solid var(--am);outline-offset:3px;background:none;display:block}
.idp-pav .big{position:relative;display:grid!important;place-items:center;margin:0!important;width:100%!important;height:100%!important;border-radius:0!important;box-shadow:none}
.big.idp-ava svg{position:absolute;inset:0;width:100%;height:100%;display:block}
.idp-nm{font:800 28px 'Bricolage Grotesque','Hanken Grotesk',sans-serif;letter-spacing:-.02em;margin:0 0 6px;color:var(--txt);line-height:1.05;word-break:break-word}
.idp-bt{position:absolute;left:18px;right:18px;bottom:14px;display:flex;align-items:flex-end;justify-content:space-between;z-index:1}
.idp-bt>div{display:flex;gap:8px;flex-wrap:wrap}
.idp-ok{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 10px;border-radius:999px;border:1px solid color-mix(in srgb,var(--up) 45%,transparent);background:color-mix(in srgb,var(--up) 14%,transparent);color:var(--up);font:700 11.5px 'Hanken Grotesk',sans-serif;cursor:pointer}
.idp-ok svg{width:14px;height:14px}.idp-ok.pending{border-color:color-mix(in srgb,var(--dn) 45%,transparent);background:color-mix(in srgb,var(--dn) 12%,transparent);color:var(--dn)}
.idp-sq{display:flex;align-items:center;gap:10px;min-height:62px;padding:0 12px;border-radius:16px;border:1px solid var(--line);background:var(--s2);color:var(--txt);font:700 13px 'Hanken Grotesk',sans-serif;cursor:pointer;text-align:left}
.idp-sq svg{color:var(--am);flex:none}.idp-sq small{display:block;color:var(--mut);font-weight:600;font-size:11px;margin-top:2px}
.idp-sqs{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px;position:relative;z-index:1}
.idp-vc{background:var(--s1);border:1px solid var(--line);border-radius:24px;padding:16px}
.idp-vh{display:flex;gap:12px;align-items:center}
.idp-vh h3{font:800 17px 'Bricolage Grotesque','Hanken Grotesk',sans-serif;margin:0}
.idp-vh p{margin:3px 0 0;color:var(--mut);font-size:13px;font-weight:500}
.idp-sh{flex:none;display:grid;place-items:center;width:44px;height:44px}
.idp-steps{display:flex;gap:6px;margin:14px 0 8px}
.idp-steps i{flex:1;height:8px;border-radius:9px;background:var(--s3);position:relative;overflow:hidden}
.idp-steps i.on:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,#ffc24d,#ff6a4d);transform-origin:left;animation:idpf .9s cubic-bezier(.2,.8,.2,1)}
.idp-steps i.now:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--am) 55%,transparent),transparent);animation:idps 1.6s infinite}
@keyframes idpf{from{transform:scaleX(0)}}@keyframes idps{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
.idp-vm{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:var(--mut);margin-bottom:12px}
.idp-vm button{color:var(--am);font:700 13px 'Hanken Grotesk',sans-serif;padding:6px 0;display:inline-flex;align-items:center;gap:4px}
.idp-vm button svg{transform:rotate(90deg);transition:transform .3s}.idp-vm button[aria-expanded="true"] svg{transform:rotate(-90deg)}
.idp-acc{display:grid;grid-template-rows:0fr;transition:grid-template-rows .45s cubic-bezier(.2,.8,.2,1)}.idp-acc.open{grid-template-rows:1fr}.idp-acc>div{overflow:hidden}
.idp-st{display:flex;align-items:center;gap:10px;padding:8px 0;font-size:13.5px;color:var(--mut)}.idp-st b{flex:1;font-weight:700}.idp-st em{font-style:normal;font-size:13px}
.idp-st.d,.idp-st.n{color:var(--txt)}
.idp-dot{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;flex:none;background:var(--s2);border:1px solid var(--line);color:#1b1006}
.idp-st.d .idp-dot{background:linear-gradient(120deg,#ffc24d,#ff6a4d);border-color:transparent}
.idp-st.n .idp-dot i{width:8px;height:8px;border-radius:50%;background:var(--am);animation:idps2 1.4s infinite}
@keyframes idps2{50%{opacity:.35}}
.idp-hint{margin:2px 0 6px;font-size:12px;color:var(--mut)}
.idp-lnk{color:var(--am);font:700 13px 'Hanken Grotesk',sans-serif;padding:4px 0 10px}
.idp-cta{display:flex;align-items:center;justify-content:center;width:100%;height:52px;border:0;border-radius:16px;background:linear-gradient(120deg,#ffc24d,#ff6a4d);color:#1b1006;font:800 15px 'Hanken Grotesk',sans-serif;text-align:center;cursor:pointer;box-shadow:0 8px 24px rgba(255,106,77,.25)}
.idp-rc{display:flex;gap:8px;flex-wrap:wrap}
.idp-chip{display:inline-flex;align-items:center;gap:7px;height:40px;padding:0 14px;border-radius:999px;border:1px solid var(--line);background:var(--s2);color:var(--txt);font:600 13px 'Hanken Grotesk',sans-serif;cursor:pointer}
.idp-chip svg{color:var(--am)}
.idp-all{text-align:center;margin-top:16px}
.idp-allbtn,.idp-donebtn.btn.wide{display:inline-flex;align-items:center;justify-content:center;width:auto;height:42px;padding:0 30px;border-radius:999px;font:700 14px 'Hanken Grotesk',sans-serif;cursor:pointer}
.idp-allbtn{border:1.5px solid var(--am);background:none;color:var(--am)}
.pfoot.idp-strip{margin:0 16px calc(10px + env(safe-area-inset-bottom,0px));padding:0;height:46px;border:1px solid var(--line);border-radius:16px;overflow:hidden;background:var(--s1);box-shadow:0 10px 30px rgba(0,0,0,.28)}
.idp-sz{flex:1 1 0;display:flex;align-items:center;justify-content:center;gap:8px;padding:0 12px;color:var(--txt);font:700 13px 'Hanken Grotesk',sans-serif;cursor:pointer;min-width:0}
.idp-sz:first-child{flex:1.5;justify-content:flex-start}
.idp-sz .idp-ic{width:26px;height:26px;border-radius:9px;background:var(--s2);color:var(--am);display:grid;place-items:center;flex:none}
.idp-sz .idp-ic svg{width:16px;height:16px}
.idp-sz em{font-style:normal;margin-left:auto;display:block}
.idp-sw{width:40px;height:24px;border-radius:99px;border:1px solid var(--line);background:var(--s3);position:relative;flex:none;transition:background .3s,border-color .3s}
.idp-sw:after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:var(--mut);transition:transform .3s cubic-bezier(.2,.8,.2,1),background .3s}
.idp-sw.on{background:color-mix(in srgb,var(--am) 24%,transparent);border-color:var(--am)}.idp-sw.on:after{transform:translateX(16px);background:var(--am)}
.idp-dv{width:1px;background:var(--line);margin:10px 0}
.idp-sec{display:flex;align-items:center;gap:12px;width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:20px;background:var(--s1);color:var(--txt);font:600 14px 'Hanken Grotesk',sans-serif;text-align:left;cursor:pointer}
.idp-sec b{font-weight:800}.idp-sl{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;color:var(--mut)}
.idp-sl1{display:flex;align-items:center;gap:8px;white-space:nowrap;font-weight:600}
.idp-sl1 b{color:var(--lv,var(--am))}
.idp-sl3{font-size:12.5px;font-weight:600;color:var(--mut)}
.idp-sl2{font-size:11.5px;font-weight:700;line-height:1.3;color:var(--am)}
.idp-bars{display:inline-flex;align-items:flex-end;gap:3px;height:15px;flex:none}
.idp-bars i{display:block;width:4px;border-radius:2px;background:color-mix(in srgb,var(--mut) 38%,transparent)}
.idp-bars i:nth-child(1){height:6px}.idp-bars i:nth-child(2){height:10px}.idp-bars i:nth-child(3){height:15px}
.idp-bars i.on{background:var(--lv,var(--am))}
.idp-sec svg{display:block;flex:none}.idp-sec em{font-style:normal;color:var(--mut);font-size:13px}
.idp-ico{width:38px;height:38px;border-radius:12px;background:var(--s2);color:var(--am);display:grid;place-items:center;flex:none}
.idp-ucl{display:grid;gap:12px;align-content:start}
.idp-list .lr .lic{background:var(--s2)!important;border:1px solid var(--line)!important;box-shadow:none!important}
.idp-ucr .uc-tabs{margin:0 0 12px;padding-left:0;padding-right:0}
.uc-hd:has(+ .uc-tabs button[data-arg="My info"].on) h2{display:none}
.idp-list{background:var(--s1);border:1px solid var(--line);border-radius:22px;overflow:hidden}
.idp-list .lr{border-bottom:1px solid var(--line);padding:0 14px;min-height:56px}
.idp-list .sec{padding:16px 14px 8px;border-bottom:1px solid var(--line)}
.idp-list>:last-child{border-bottom:0}
.idp-ucr>div:last-child{padding:14px 0 6px!important}
.idp-avp{display:grid;justify-items:center;gap:14px;padding:22px 16px 18px}
.idp-prev{width:112px;height:112px;border-radius:50%;overflow:hidden;outline:3px solid var(--am);outline-offset:4px;margin:6px 0}
.idp-prev .big{position:relative;display:grid!important;place-items:center;margin:0!important;width:100%!important;height:100%!important;border-radius:0!important;box-shadow:none}
.idp-ag{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;width:100%;max-width:480px;padding:0 2px}
.idp-at{aspect-ratio:1;border-radius:22px;border:0;position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;overflow:hidden;outline:1px solid var(--line);outline-offset:2px}
.idp-at.on{outline:3px solid var(--am)}.idp-at svg{position:absolute;inset:0;width:100%;height:100%;display:block}.idp-at img{position:relative;width:58%}
.idp-avp .sec{justify-self:stretch;padding:8px 2px 0}
.idp-rg{fill:none;stroke:var(--s3);stroke-width:6;stroke-linecap:round}.idp-rg.on{stroke:var(--am)}
.idp-pt{fill:var(--txt);stroke:none;font:700 14px 'Hanken Grotesk',sans-serif;text-anchor:middle}
.idp-rs{width:54px!important;height:54px!important;display:block;flex:none}
html[data-theme="purple"] .idp-cta{background:var(--grad);color:#fff;box-shadow:none}
html[data-theme="light"] .idp-cta:not(#a):not(#b){background:var(--am)!important;background-image:none!important;color:#fff!important;box-shadow:none!important}
html[data-theme="light"] .idp-ab{color:#fff}
html[data-theme="light"] .idp-cf:not(#a):not(#b):before,html[data-theme="light"] .idp-cb:not(#a):not(#b):before{background:var(--am)!important}
html[data-theme="light"] .idp-steps i.on:not(#a):not(#b):after{background:var(--am)!important}
html[data-theme="light"] .idp-list .lr .lic svg,html[data-theme="light"] .idp-list .lr .lic svg *{stroke:var(--am)!important;color:var(--am)!important}
html[data-theme="purple"] .idp-steps i.on:after,html[data-theme="purple"] .idp-st.d .idp-dot{background:var(--grad)}
html[data-theme="purple"] .idp-cf:before,html[data-theme="purple"] .idp-cb:before{background:var(--grad)}
.pgs .sp-hero{background:var(--s1)!important;border:1px solid var(--line)!important}
.pgs .sp-qi{background:var(--s1)!important;border:1px solid var(--line)!important;border-radius:18px!important;min-height:96px;padding:14px 10px;gap:8px;box-shadow:none}
.pgs .sp-qi svg{box-sizing:content-box;width:20px;height:20px;padding:9px;border-radius:12px;background:var(--s2);color:var(--am)}
.pgs .sp-ri{background:var(--s2)!important}
.pgs .sp-cta{background:var(--grad)!important;color:var(--ongrad,#1b1006)!important}
.pgs .sp-qi:hover,.pgs .sp-row:hover{border-color:color-mix(in srgb,var(--am) 40%,var(--line))!important}
@media(prefers-reduced-motion:reduce){.idp-ci,.idp-steps i:after,.idp-sw,.idp-sw:after{animation:none!important;transition:none!important}}
.idp-verify{border:1px solid color-mix(in srgb,var(--am) 28%,var(--line));border-radius:22px;padding:20px;background:linear-gradient(145deg,var(--s2),var(--s1));box-shadow:0 18px 42px rgba(0,0,0,.16);position:relative;overflow:hidden}
.idp-verify:before{content:"";position:absolute;right:-65px;top:-95px;width:230px;height:230px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--am) 12%,transparent),transparent 70%);pointer-events:none}
.idp-vtop{display:flex;align-items:flex-start;gap:12px;position:relative}
.idp-vbadge{display:grid;place-items:center;width:42px;height:42px;border-radius:13px;background:color-mix(in srgb,var(--am) 13%,var(--s2));color:var(--am);flex:none}
.idp-vheading{min-width:0;flex:1}
.idp-veyebrow{font:700 10px 'DM Mono',monospace;letter-spacing:.15em;color:var(--am);margin:0 0 5px}
.idp-vheading h3{font:800 19px 'Bricolage Grotesque','Hanken Grotesk',sans-serif;margin:0;color:var(--txt)}
.idp-vheading p{font-size:13px;color:var(--mut);line-height:1.45;margin:5px 0 0}
.idp-vstatus{font:700 11px 'Hanken Grotesk',sans-serif;border-radius:999px;padding:7px 10px;white-space:nowrap;background:color-mix(in srgb,var(--am) 13%,var(--s2));color:var(--am);border:1px solid color-mix(in srgb,var(--am) 24%,var(--line))}
.idp-vstatus.success{color:var(--up);background:color-mix(in srgb,var(--up) 12%,var(--s2));border-color:color-mix(in srgb,var(--up) 28%,var(--line))}
.idp-vstatus.warning{color:var(--dn);background:color-mix(in srgb,var(--dn) 10%,var(--s2));border-color:color-mix(in srgb,var(--dn) 28%,var(--line))}
.idp-vsteps{display:flex;align-items:stretch;gap:7px;margin:20px 0 18px;position:relative}
.idp-vstep{display:flex;flex:1;min-width:0;flex-direction:column;gap:5px;align-items:center;text-align:center}
.idp-vstep-icon{width:38px;height:38px;border:1px solid var(--line);border-radius:50%;display:grid;place-items:center;color:var(--am);background:var(--s1)}
.idp-vstep-icon svg{width:18px;height:18px}
.idp-vstep b{font-size:12px;color:var(--txt)}
.idp-vstep small{font-size:10.5px;line-height:1.35;color:var(--mut)}
.idp-vconnector{height:1px;flex:0 0 9%;margin-top:19px;background:linear-gradient(90deg,var(--line),color-mix(in srgb,var(--am) 50%,var(--line)))}
.idp-vfoot{display:grid;gap:12px}
.idp-verify .idp-cta{min-height:48px;display:flex;align-items:center;justify-content:center;gap:10px}
.idp-verify .idp-cta.idp-verified{background:color-mix(in srgb,var(--up) 15%,var(--s2));color:var(--up);box-shadow:none;border:1px solid color-mix(in srgb,var(--up) 25%,var(--line))}
.idp-vprivacy{display:flex;justify-content:center;align-items:center;gap:8px;text-align:left;color:var(--mut);font-size:11px;line-height:1.45}
.idp-vprivacy svg{color:var(--am);flex:none}
.idp-vprivacy small{font-size:10px;color:var(--mut)}
@media(max-width:420px){.idp-verify{padding:15px;border-radius:18px}.idp-vstatus{font-size:10px;padding:6px 8px}.idp-vstep-icon{width:34px;height:34px}.idp-vconnector{margin-top:17px;flex-basis:5%}.idp-vstep small{font-size:10px}}
`;

var s = document.createElement("style");
  s.id = "tm-idpass-css";
  s.textContent = CSS;
  document.head.appendChild(s);

  // Own avatar everywhere the app draws it: illustrated avatars 0-3; photo, logo (7) and legacy ones unchanged.
  var _av = avHTML;
  avHTML = function (t, e) {
    var a = st.me.av;
    if (st.me.photo || a === 7 || !(a >= 0 && a <= 3)) return _av(t, e);
    t = t || 68; e = e || 22;
    return '<span class="big idp-ava" style="position:relative;display:block;width:' + t + "px;height:" + t + "px;border-radius:" + e + "px;background:" + BG[a] + ';overflow:hidden;box-shadow:none;padding:0">' + AV[a] + "</span>";
  };

  function ring(n) {
    var c = "";
    for (var i = 0; i < 3; i++) c += '<circle class="idp-rg' + (i < n ? " on" : "") + '" cx="34" cy="34" r="28" pathLength="300" stroke-dasharray="94 206" stroke-dashoffset="' + (-i * 100) + '" transform="rotate(-105 34 34)"/>';
    return '<svg class="idp-rs" viewBox="0 0 68 68" role="img" aria-label="Verification progress: ' + n + ' of 3 steps">' + c + '<text class="idp-pt" x="34" y="41">' + n + '/3</text></svg>';
  }
  var SH = [["Card", "TradeMate Card", "Join waitlist", "card"], ["Rewards", "Rewards Hub", "Check now", "gift"], ["Contracts", "Contracts", "View all", "box"], ["Referral", "Invite Friends", "Invite now", "users"]];
  function flip(label) { return '<button class="idp-gl" data-idp-flip aria-label="Flip the pass">' + label + ic("swap", "width:15px;height:15px") + "</button>"; }
  function pass() {
    var t = st.me, verified = typeof idvVerified === "function" && idvVerified();
    return '<div class="idp-c3' + (flipped ? " flip" : "") + '"><div class="idp-ci">' +
      '<div class="idp-cf"><div class="idp-top"><span class="idp-cm">TradeMate · Identity pass</span>' + flip("Flip ") + "</div>" +
      '<div class="idp-id"><button class="idp-pav" data-pg="avatar" aria-label="Change profile picture">' + avHTML(76, 22) + '</button><div style="min-width:0"><h1 class="idp-nm">' + esc(t.nick) + '</h1><button class="idp-gl" data-act="copy" data-arg="' + t.uid + '" aria-label="Copy UID" style="height:30px">UID ' + t.uid + ic("copy", "width:14px;height:14px") + "</button></div></div>" +
      '<div class="idp-bt"><span class="idp-ok' + (verified ? "" : " pending") + '" data-pg="kycinfo">' + PT_SHIELD_G + (verified ? "Verified" : "Not verified") + "</span></div></div>" +
      '<div class="idp-cb"><div class="idp-top"><span class="idp-cm">Shortcuts</span>' + flip("Flip ") + '</div><div class="idp-sqs">' +
      SH.map(function (x) { return '<button class="idp-sq" data-f="' + x[0] + '">' + ic(x[3]) + "<span>" + x[1] + "<small>" + x[2] + "</small></span></button>"; }).join("") +
      "</div></div></div></div>";
  }
  function verify() {
    var verified = typeof idvVerified === "function" && idvVerified();
    var status = window.__tmPersonaStatus || { status: "not_started", verified: false };
    var active = ["pending","in_progress","submitted","review"].indexOf(status.status) >= 0;
    var failed = ["failed","rejected","needs_retry","action_required"].indexOf(status.status) >= 0;
    var label = verified || status.verified ? "Verified" : active ? "In review" : failed ? "Action required" : "Not verified";
    var intro = verified || status.verified ? "Your identity is confirmed. You're all set." : active ? "Your submission is being reviewed. We'll update your status here." : failed ? "A little more information is needed to complete verification." : "A secure, guided process to help build trust on TradeMate.";
    var cta = verified || status.verified
      ? '<button class="idp-cta idp-verified" type="button" disabled>' + ic("check") + ' Identity verified</button>'
      : '<button class="idp-cta" type="button" data-persona-start>' + (active ? "Check verification status" : failed ? "Retry verification" : "Start verification") + ic("right", "width:18px;height:18px") + '</button>';
    var steps = [["person","Personal details","Confirm your basic information"],["id","Identity document","Scan a valid government ID"],["cam","Selfie check","Match your face to your ID"]];
    return '<section class="idp-verify"><div class="idp-vtop"><div class="idp-vbadge">' + PT_SHIELD + '</div><div class="idp-vheading"><div class="idp-veyebrow">ACCOUNT TRUST</div><h3>Identity verification</h3><p>' + intro + '</p></div><span class="idp-vstatus' + (verified || status.verified ? " success" : failed ? " warning" : active ? " progress" : "") + '">' + label + '</span></div>' +
      '<div class="idp-vsteps">' + steps.map(function(x,i){return '<div class="idp-vstep"><span class="idp-vstep-icon">' + ic(x[0]) + '</span><b>' + x[1] + '</b><small>' + x[2] + '</small></div>'+(i<2?'<span class="idp-vconnector"></span>':'');}).join("") + '</div>' +
      '<div class="idp-vfoot">' + cta + '<div class="idp-vprivacy">' + ic("lock", "width:15px;height:15px") + '<span>Secure verification powered by Persona<br><small>Your details are handled securely and used for verification.</small></span></div></div></section>';
  }
  function strip(e) {
    return '<div class="pfoot idp-strip"><button class="idp-sz" data-act="mode" role="switch" aria-checked="' + e + '"><span class="idp-ic">' + ic("swap") + '</span><span>Alpha mode</span><i class="idp-sw' + (e ? " on" : "") + '"></i></button><span class="idp-dv"></span><button class="idp-sz" data-pg="about"><span>About us</span><em>' + ic("chev", "width:16px;height:16px") + "</em></button></div>";
  }

  PG.profile = function () {
    var e = "Seller" === st.mode;
    var chips = st.recent.filter(function (x) { return "More" !== x && (e || "Add Contract" !== x); }).map(function (x) {
      var f = FG.reduce(function (a, b) { return a.concat(b[1]); }, []).filter(function (y) { return y[0] === x; })[0] || ["", "more"];
      return '<button class="idp-chip" data-f="' + x + '" style="--h:' + HUE[x] + '">' + ic(f[1], "width:16px;height:16px") + x + "</button>";
    }).join("");
    return '<header class="ph"><button class="bk2" data-back aria-label="Back">' + ic("left") + '</button><span style="flex:1"></span><div class="rts"><button class="rt" data-pg="support" aria-label="Support">' + ic("headset") + '</button><button class="rt" data-act="uc" data-arg="My info" aria-label="User Center">' + ic("settings") + "</button></div></header>" +
      '<div class="pbody"><div class="idp-cq"><div class="idp-grid"><div class="idp-l" style="display:grid;gap:14px;align-content:start">' + pass() + verify() + '</div><div class="idp-r"><div class="sec" style="padding-left:2px">RECENTLY USED</div><div class="idp-rc">' + chips + '</div><div class="idp-all"><button class="idp-allbtn" data-f="More">All Services</button></div></div></div></div></div>' + strip(e);
  };

  // Security level comes from the account's real setup: password (always), authenticator 2FA, verified identity.
  var secAsked = "", secBusy = false;
  function secLoad() {
    var id = st.me && st.me.uid;
    if (!CONNECTED || st.twofaStatus || secAsked === id || typeof loadAccountTwoFactor !== "function") return;
    secAsked = id; secBusy = true;
    loadAccountTwoFactor().then(function () { secBusy = false; try { if (topPage() === "uc") drawPage(); } catch (x) {} }, function () { secBusy = false; });
  }
  function secRow() {
    var tf = st.twofaStatus, on = !!(tf && tf.enabled), kyc = idvDone() >= 3, n = 1 + (on ? 1 : 0) + (kyc ? 1 : 0);
    var lv = n >= 3 ? ["High", "--up"] : n === 2 ? ["Medium", "--am"] : ["Low", "--dn"];
    var hint = "";
    var wait = secBusy;
    var name = wait ? "Checking…" : lv[0];
    return '<button class="idp-sec" data-pg="security" style="--lv:' + (wait ? "var(--mut)" : "var(--" + lv[1].slice(2) + ")") + '" aria-label="Security level: ' + name + '"><span class="idp-ico">' + ic("shield") + '</span><span class="idp-sl"><span class="idp-sl1">Security level: <b>' + name + '</b></span><span class="idp-sl3">Region: Global</span></span>' + ic("chev", "width:18px;height:18px;color:var(--mut)") + "</button>";
  }

  // User Center: same rows, handlers and content as before, regrouped into one card per tab under the pass.
  var _uc = PG.uc;
  PG.uc = function () {
    secLoad();
    var h = _uc();
    try {
      var a = h.indexOf('<div class="uc-tabs">');
      if (a < 0) return h;
      var te = h.indexOf("</div>", a) + 6, end = '<div class="uc-card">', rg = "Region: Global</div></div></div>", re = te;
      if (h.indexOf(end, te) === te) { var k = h.indexOf("</div></div>", te); if (k < 0) return h; re = k + 12; }
      var lo = h.indexOf('<div style="padding:22px 16px"><button class="btn o wide" data-pg="logout">', re);
      if (lo < 0) return h;
      var sec = secRow();
      return h.slice(0, a) + '<div class="idp-cq"><div class="idp-ucg"><div class="idp-ucl">' + pass() + sec + '</div><div class="idp-ucr">' + h.slice(a, te) + '<div class="idp-list">' + h.slice(re, lo) + "</div>" + h.slice(lo) + "</div></div></div>";
    } catch (x) { return h; }
  };

  PG.avatar = function () {
    var a = st.me.av, ph = st.me.photo;
    var tiles = [0, 1, 2, 3].map(function (i) {
      return '<button class="idp-at' + (!ph && a === i ? " on" : "") + '" data-act="avatar" data-arg="' + i + '" style="background:' + BG[i] + '" aria-label="' + NM[i] + '">' + AV[i] + "</button>";
    }).join("") + '<button class="idp-at' + (!ph && a === 7 ? " on" : "") + '" data-act="avatar" data-arg="7" style="background:#0d1319" aria-label="TradeMate logo"><img src="' + LOGO + '" alt=""></button>';
    return hdr("Profile picture") + '<div class="idp-avp"><div style="display:grid;justify-items:center;gap:14px"><div class="idp-prev">' + avHTML(112, 56) + '</div><div style="display:flex;gap:10px"><label class="btn sm" style="position:relative;cursor:pointer;overflow:hidden">' + ic("upload", "width:16px;height:16px") + (ph ? "Change photo" : "Upload photo") + '<input id="photoin" type="file" accept="image/*" aria-label="Upload profile photo" style="position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;font-size:0"></label>' + (ph ? '<button class="btn sm o" data-act="rmphoto">Remove</button>' : "") + "</div></div>" +
      '<div class="sec">OR PICK AN AVATAR</div><div class="idp-ag">' + tiles + '</div><div style="padding:8px 0"><button class="btn wide idp-donebtn" data-back>Done</button></div><p class="fine">Your photo is cropped to a square and kept on this device in the preview.</p></div>';
  };

  // Pass state lives here, not in the DOM, so a redraw cannot reset it.
  var flipped = false, openAcc = false, flipTimer = 0;
  function turn(c, v) {
    var ci = c.querySelector(".idp-ci"), calm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!ci || !ci.animate || calm || c.classList.contains("flip") === v) { c.classList.toggle("flip", v); return; }
    var a = ci.animate([{ transform: "rotateY(0deg)" }, { transform: "rotateY(90deg)" }], { duration: 200, easing: "ease-in" });
    a.onfinish = function () {
      c.classList.toggle("flip", v);
      ci.animate([{ transform: "rotateY(-90deg)" }, { transform: "rotateY(0deg)" }], { duration: 200, easing: "ease-out" });
    };
  }
  function setFlip(v) {
    flipped = v;
    var all = document.querySelectorAll(".idp-c3");
    for (var i = 0; i < all.length; i++) turn(all[i], v);
    clearTimeout(flipTimer);
    if (v) flipTimer = setTimeout(function () { setFlip(false); }, 20000);
  }
  document.addEventListener("click", function (ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    if (t.closest("[data-idp-flip]")) { setFlip(!flipped); return; }
    var a = t.closest("[data-idp-acc]");
    if (a) {
      openAcc = !openAcc;
      a.setAttribute("aria-expanded", openAcc);
      var card = a.closest(".idp-vc"), box = card && card.querySelector(".idp-acc");
      if (box) box.classList.toggle("open", openAcc);
    }
  }, true);
  // 20 seconds without any activity brings the pass back to its front.
  ["pointerdown", "keydown", "scroll", "touchstart"].forEach(function (n) {
    document.addEventListener(n, function () {
      if (!flipped) return;
      clearTimeout(flipTimer);
      flipTimer = setTimeout(function () { setFlip(false); }, 20000);
    }, { capture: true, passive: true });
  });

  try { drawPage(); } catch (x) {}

  function loadPersonaStatus() {
    fetch('/api/integrations/persona/status', { credentials: 'include', cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('status'); return r.json(); })
      .then(function (data) { window.__tmPersonaStatus = data; if (typeof drawPage === 'function') drawPage(); })
      .catch(function () { window.__tmPersonaStatus = { status: 'not_started', verified: false }; });
  }
  document.addEventListener('click', function (event) {
    var button = event.target && event.target.closest ? event.target.closest('[data-persona-start]') : null;
    if (!button) return;
    var priorError = button.parentNode && button.parentNode.querySelector('.idp-inline-error');
    if (priorError) priorError.remove();
    button.disabled = true;
    button.textContent = 'Connecting to Persona…';
    fetch('/api/integrations/persona/inquiry', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: '{}' })
      .then(function (response) {
        return response.text().then(function (text) {
          var data = {};
          try { data = JSON.parse(text); } catch (_) {}
          if (!response.ok || !data.url) {
            throw new Error('Verification could not be started (HTTP ' + response.status + '). Please try again or contact support.');
          }
          return data;
        });
      })
      .then(function (data) {
        if (typeof data.url !== 'string' || !data.url) throw new Error('Persona did not return a verification link.');
        var target;
        try { target = new URL(data.url); } catch (_) { throw new Error('Persona returned an invalid verification link.'); }
        if (target.protocol !== 'https:' || ['inquiry.withpersona.com', 'withpersona.com', 'go.perso.na'].indexOf(target.hostname) < 0) {
          throw new Error('Persona returned an unsafe verification link. Please contact support.');
        }
        window.location.assign(target.href);
      })
      .catch(function (error) {
        button.disabled = false;
        button.textContent = 'Start verification';
        var message = error && error.message ? error.message : 'Could not start verification. Please try again.';
        var host = button.parentNode;
        if (host) {
          var notice = host.querySelector('.idp-inline-error');
          if (!notice) {
            notice = document.createElement('p');
            notice.className = 'idp-inline-error';
            notice.setAttribute('role', 'alert');
            notice.style.cssText = 'margin:0;padding:10px 12px;border-radius:10px;background:color-mix(in srgb,var(--dn) 10%,var(--s2));color:var(--dn);font-size:12px;line-height:1.45';
            host.appendChild(notice);
          }
          notice.textContent = message;
        }
      });
  });
  loadPersonaStatus();
})();
