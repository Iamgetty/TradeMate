// One-off patch for the identity pass: flip, verify card, chips, list icons, avatar fit.
const fs = require('node:fs');
const file = process.argv[2];
let src = fs.readFileSync(file, 'utf8');
if (src.includes('data-idp-acc')) { console.log('Already patched.'); process.exit(0); }
function rep(oldStr, newStr) {
  const i = src.indexOf(oldStr);
  if (i === -1 || src.indexOf(oldStr, i + 1) !== -1) throw new Error('Marker not found exactly once: ' + oldStr.slice(0, 70));
  src = src.slice(0, i) + newStr + src.slice(i + oldStr.length);
}
// ---------- CSS ----------
rep(".idp-ok{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 14px;border-radius:999px;border:1px solid #1f6b4f;background:rgba(52,211,153,.12);color:#34d399;font:700 13px 'Hanken Grotesk',sans-serif;cursor:pointer}",
    ".idp-ok{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 10px;border-radius:999px;border:1px solid #1f6b4f;background:rgba(52,211,153,.12);color:#34d399;font:700 11.5px 'Hanken Grotesk',sans-serif;cursor:pointer}\n.idp-ok svg{width:14px;height:14px}");
rep(".idp-cta{display:block;width:100%;height:52px;border:0;border-radius:16px;background:var(--grad);color:var(--ongrad,#1b1006);font:800 15px 'Hanken Grotesk',sans-serif;cursor:pointer}",
    ".idp-cta{display:flex;align-items:center;justify-content:center;width:100%;height:52px;border:0;border-radius:16px;background:linear-gradient(120deg,#ffc24d,#ff6a4d);color:#1b1006;font:800 15px 'Hanken Grotesk',sans-serif;text-align:center;cursor:pointer;box-shadow:0 8px 24px rgba(255,106,77,.25)}");
rep('html[data-theme="light"] .idp-cta{color:#fff}', 'html[data-theme="light"] .idp-cta{background:var(--grad);color:#fff;box-shadow:none}');
rep("background:var(--grad);transform-origin:left;", "background:linear-gradient(90deg,#ffc24d,#ff6a4d);transform-origin:left;");
rep(".idp-ucl{display:grid;gap:12px;align-content:start}",
    ".idp-ucl{display:grid;gap:12px;align-content:start}\n.idp-list .lr .lic{background:var(--s2)!important;border:1px solid var(--line)!important;box-shadow:none!important}");
rep("transition:transform .7s cubic-bezier(.2,.8,.2,1);transform-style:preserve-3d}", "transition:transform .6s cubic-bezier(.4,0,.2,1);transform-style:preserve-3d}");
rep(".idp-cb{transform:rotateY(180deg)}",
    ".idp-cb{transform:rotateY(180deg)}\n.idp-cf,.idp-cb{transition:visibility 0s linear .3s}.idp-cb{visibility:hidden}.idp-c3.flip .idp-cf{visibility:hidden}.idp-c3.flip .idp-cb{visibility:visible}\n.idp-cf *,.idp-cb *{-webkit-backface-visibility:hidden;backface-visibility:hidden}");
rep(".idp-pav .big{width:100%!important;height:100%!important;border-radius:0!important;box-shadow:none}",
    ".idp-pav .big{position:relative;display:block!important;width:100%!important;height:100%!important;border-radius:0!important;box-shadow:none}\n.big.idp-ava svg{position:absolute;inset:0;width:100%;height:100%;display:block}");
rep(".idp-prev .big{width:100%!important;height:100%!important;border-radius:0!important;box-shadow:none}", ".idp-prev .big{position:relative;display:block!important;width:100%!important;height:100%!important;border-radius:0!important;box-shadow:none}");
rep(".idp-at{aspect-ratio:1;border-radius:22px;border:0;display:grid;place-items:center;", ".idp-at{aspect-ratio:1;border-radius:22px;border:0;position:relative;display:flex;align-items:center;justify-content:center;");
rep(".idp-at svg{width:100%;height:100%;display:block}.idp-at img{width:58%}", ".idp-at svg{position:absolute;inset:0;width:100%;height:100%;display:block}.idp-at img{position:relative;width:58%}");
rep(".idp-vm button{color:var(--am);font:700 13px 'Hanken Grotesk',sans-serif;padding:6px 0}",
    ".idp-vm button{color:var(--am);font:700 13px 'Hanken Grotesk',sans-serif;padding:6px 0;display:inline-flex;align-items:center;gap:4px}\n.idp-vm button svg{transform:rotate(90deg);transition:transform .3s}.idp-vm button[aria-expanded=\"true\"] svg{transform:rotate(-90deg)}\n.idp-acc{display:grid;grid-template-rows:0fr;transition:grid-template-rows .45s cubic-bezier(.2,.8,.2,1)}.idp-acc.open{grid-template-rows:1fr}.idp-acc>div{overflow:hidden}\n.idp-st{display:flex;align-items:center;gap:10px;padding:8px 0;font-size:13.5px;color:var(--mut)}.idp-st b{flex:1;font-weight:700}.idp-st em{font-style:normal;font-size:13px}\n.idp-st.d,.idp-st.n{color:var(--txt)}\n.idp-dot{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;flex:none;background:var(--s2);border:1px solid var(--line);color:#1b1006}\n.idp-st.d .idp-dot{background:linear-gradient(120deg,#ffc24d,#ff6a4d);border-color:transparent}\n.idp-st.n .idp-dot i{width:8px;height:8px;border-radius:50%;background:var(--am);animation:idps2 1.4s infinite}\n@keyframes idps2{50%{opacity:.35}}\n.idp-hint{margin:2px 0 6px;font-size:12px;color:var(--mut)}\n.idp-lnk{color:var(--am);font:700 13px 'Hanken Grotesk',sans-serif;padding:4px 0 10px}");
// ---------- JS ----------
rep("'<span class=\"big\" style=\"width:' + t + \"px;height:\"", "'<span class=\"big idp-ava\" style=\"position:relative;display:block;width:' + t + \"px;height:\"");
rep("return '<div class=\"idp-c3\"><div class=\"idp-ci\">' +", "return '<div class=\"idp-c3' + (flipped ? \" flip\" : \"\") + '\"><div class=\"idp-ci\">' +");
rep("data-pg=\"level\" style=\"height:36px\">' + (e ? \"Alpha\" : \"Clients\") + ic(\"chev\", \"width:14px;height:14px\")", "data-pg=\"level\" style=\"height:28px;padding:0 10px;font-size:11.5px\">' + (e ? \"Alpha\" : \"Clients\") + ic(\"chev\", \"width:12px;height:12px\")");
{
  const a = src.indexOf("'<div class=\"idp-vm\"><small>Verification: '");
  const endMark = "Verify now</button></div>';";
  const b = src.indexOf(endMark, a);
  if (a === -1 || b === -1) throw new Error('verify() block not found');
  const tick = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
  const repl =
"'<div class=\"idp-vm\"><small>Verification: ' + n + ' of 3 steps</small><button data-idp-acc aria-expanded=\"' + openAcc + '\">' + (e ? \"Alpha benefits\" : \"Trust & verification\") + ic(\"chev\", \"width:14px;height:14px\") + '</button></div>' +\n" +
"      '<div class=\"idp-acc' + (openAcc ? \" open\" : \"\") + '\"><div>' + [\"Personal Information\", \"Identity Document\", \"Live Selfie\"].map(function (nm, i) { var d = i < n, nx = i === n && n < 3; return '<div class=\"idp-st' + (d ? \" d\" : nx ? \" n\" : \"\") + '\"><span class=\"idp-dot\">' + (d ? '" + tick + "' : nx ? \"<i></i>\" : \"\") + \"</span><b>\" + nm + \"</b><em>\" + (d ? \"Done\" : nx ? \"Up next\" : \"Locked\") + \"</em></div>\"; }).join(\"\") + '<p class=\"idp-hint\">Tap Verify now to continue. Each step opens your verification flow.</p><button class=\"idp-lnk\" data-pg=\"level\">' + (e ? \"View Alpha benefits\" : \"View verification levels & benefits\") + ' \\u2192</button></div></div>' +\n" +
"      '<button class=\"idp-cta\" data-pc=\"kyc\">Verify now</button></div>';";
  src = src.slice(0, a) + repl + src.slice(b + endMark.length);
}
{
  const a = src.indexOf("  // Flip the identity pass (visual only; nothing re-renders).");
  const endMark = "  }, true);\n";
  const b = src.indexOf(endMark, a);
  if (a === -1 || b === -1) throw new Error('flip handler not found');
  const repl =
`  // Pass state lives here, not in the DOM, so a redraw cannot reset it.
  var flipped = false, openAcc = false, flipTimer = 0;
  function setFlip(v) {
    flipped = v;
    var all = document.querySelectorAll(".idp-c3");
    for (var i = 0; i < all.length; i++) all[i].classList.toggle("flip", v);
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
`;
  src = src.slice(0, a) + repl + src.slice(b + endMark.length);
}
fs.writeFileSync(file, src);
console.log('Patched.');
