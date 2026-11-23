// One-off patch for the identity pass: theme-aware colours, safe flip, bigger progress badge, bars alignment.
const fs = require('node:fs');
const file = process.argv[2];
let src = fs.readFileSync(file, 'utf8');
if (src.includes('idp-pg')) { console.log('Already patched.'); process.exit(0); }
function once(s) {
  const i = src.indexOf(s);
  if (i === -1 || src.indexOf(s, i + 1) !== -1) throw new Error('Marker not found exactly once: ' + s.slice(0, 70));
  return i;
}
function rep(oldStr, newStr) { const i = once(oldStr); src = src.slice(0, i) + newStr + src.slice(i + oldStr.length); }
// Replace one whole CSS rule, found by its selector (rule must start a line or follow another rule).
function setRule(sel, text) {
  const key = sel + '{';
  let idx = -1, n = 0, from = 0;
  for (;;) {
    const i = src.indexOf(key, from);
    if (i === -1) break;
    const p = i === 0 ? '\n' : src[i - 1];
    if (p === '\n' || p === '}') { idx = i; n++; }
    from = i + 1;
  }
  if (n !== 1) throw new Error('Rule not found exactly once (' + n + '): ' + sel);
  const end = src.indexOf('}', idx) + 1;
  src = src.slice(0, idx) + text + src.slice(end);
}
// ---------- flip: no 3D backface; one face exists at a time ----------
setRule('.idp-ci', '.idp-ci{position:relative;width:100%;height:100%}');
setRule('.idp-c3.flip .idp-ci', '');
rep('.idp-cb{transform:rotateY(180deg)}', '.idp-cb{display:none}');
rep('.idp-cf,.idp-cb{transition:visibility 0s linear .3s}.idp-cb{visibility:hidden}.idp-c3.flip .idp-cf{visibility:hidden}.idp-c3.flip .idp-cb{visibility:visible}\n.idp-cf *,.idp-cb *{-webkit-backface-visibility:hidden;backface-visibility:hidden}',
    '.idp-c3.flip .idp-cf{display:none}.idp-c3.flip .idp-cb{display:block}');
// ---------- theme-aware pass (dark, purple, light) ----------
setRule('.idp-c3', '.idp-c3{perspective:1200px;width:100%;max-width:440px;margin:0 auto;aspect-ratio:1.45}');
setRule('.idp-cf,.idp-cb', ".idp-cf,.idp-cb{position:absolute;inset:0;border-radius:26px;overflow:hidden;color:var(--txt);padding:20px 18px 14px;border:1px solid color-mix(in srgb,var(--am) 38%,var(--line));background:linear-gradient(145deg,var(--s2),var(--s1));box-shadow:0 24px 60px color-mix(in srgb,var(--am) 14%,transparent),0 10px 30px rgba(0,0,0,.16);box-sizing:border-box}");
setRule('.idp-cf:after', '.idp-cf:after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(120% 90% at 85% 0%,color-mix(in srgb,var(--am) 20%,transparent),transparent 55%),linear-gradient(115deg,transparent 40%,rgba(255,255,255,.07) 50%,transparent 60%)}');
setRule('.idp-cm', ".idp-cm{color:var(--mut);font:500 10.5px/1 'DM Mono',monospace;letter-spacing:.2em;text-transform:uppercase}");
setRule('.idp-ab', ".idp-ab{display:inline-block;background:var(--am);color:var(--ongrad,#1b1006);border-radius:6px;padding:3px 6px;font:800 9px 'DM Mono',monospace;letter-spacing:.1em;margin-left:8px}");
setRule('.idp-gl', ".idp-gl{height:34px;padding:0 12px;border-radius:999px;border:1px solid var(--line);background:var(--s2);color:var(--txt);font:700 12.5px 'Hanken Grotesk',sans-serif;cursor:pointer;display:inline-flex;align-items:center;gap:6px;position:relative;z-index:1}");
setRule('.idp-pav', '.idp-pav{width:76px;height:76px;border-radius:22px;border:0;padding:0;flex:none;overflow:hidden;cursor:pointer;outline:2px solid var(--am);outline-offset:3px;background:none;display:block}');
setRule('.idp-nm', ".idp-nm{font:800 28px 'Bricolage Grotesque','Hanken Grotesk',sans-serif;letter-spacing:-.02em;margin:0 0 6px;color:var(--txt);line-height:1.05;word-break:break-word}");
setRule('.idp-ok', ".idp-ok{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 10px;border-radius:999px;border:1px solid color-mix(in srgb,var(--up) 45%,transparent);background:color-mix(in srgb,var(--up) 14%,transparent);color:var(--up);font:700 11.5px 'Hanken Grotesk',sans-serif;cursor:pointer}");
setRule('.idp-sq', ".idp-sq{display:flex;align-items:center;gap:10px;min-height:62px;padding:0 12px;border-radius:16px;border:1px solid var(--line);background:var(--s2);color:var(--txt);font:700 13px 'Hanken Grotesk',sans-serif;cursor:pointer;text-align:left}");
setRule('.idp-sq svg', '.idp-sq svg{color:var(--am);flex:none}');
setRule('.idp-sq small', '.idp-sq small{display:block;color:var(--mut);font-weight:600;font-size:11px;margin-top:2px}');
// ---------- security line alignment ----------
setRule('.idp-sec>span:nth-child(2)', '.idp-sec>span:nth-child(2){flex:1;color:var(--mut);display:flex;align-items:center;gap:8px}\n.idp-sec svg{display:block;flex:none}');
// ---------- light theme: the app's light patch flattens gradients, so state the colours explicitly ----------
setRule('html[data-theme="light"] .idp-cta', '');
rep('@media(prefers-reduced-motion:reduce)',
`.idp-pg{width:78px;height:78px;border-radius:20px;background:var(--s2);border:1px solid var(--line);display:grid;place-items:center;flex:none;position:relative}
.idp-pg svg{display:block}
.idp-rg{fill:none;stroke:var(--s3);stroke-width:6;stroke-linecap:round}.idp-rg.on{stroke:var(--am)}
.idp-pt{fill:var(--txt);font:800 17px 'Hanken Grotesk',sans-serif;text-anchor:middle}.idp-ps{fill:var(--mut);font:700 8px 'Hanken Grotesk',sans-serif;text-anchor:middle;letter-spacing:.08em}
html[data-theme="purple"] .idp-cta{background:var(--grad);color:#fff;box-shadow:none}
html[data-theme="light"] .idp-cta:not(#a):not(#b){background:var(--am)!important;background-image:none!important;color:#fff!important;box-shadow:none!important}
html[data-theme="light"] .idp-ab{color:#fff}
html[data-theme="light"] .idp-cf:not(#a):not(#b):before,html[data-theme="light"] .idp-cb:not(#a):not(#b):before{background:var(--am)!important}
html[data-theme="light"] .idp-steps i.on:not(#a):not(#b):after{background:var(--am)!important}
html[data-theme="light"] .idp-list .lr .lic svg,html[data-theme="light"] .idp-list .lr .lic svg *{stroke:var(--am)!important;color:var(--am)!important}
@media(prefers-reduced-motion:reduce)`);
// ---------- JS: progress badge ----------
{
  const a = once('  function ring(n) {');
  const b = once('  var SH = [');
  src = src.slice(0, a) +
`  function ring(n) {
    var c = "";
    for (var i = 0; i < 3; i++) c += '<circle class="idp-rg' + (i < n ? " on" : "") + '" cx="32" cy="32" r="25" pathLength="300" stroke-dasharray="94 206" stroke-dashoffset="' + (-i * 100) + '" transform="rotate(-105 32 32)"/>';
    return '<div class="idp-pg" role="img" aria-label="Verification progress: ' + n + ' of 3 steps"><svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">' + c + '<text class="idp-pt" x="32" y="33">' + n + '/3</text><text class="idp-ps" x="32" y="45">STEPS</text></svg></div>';
  }
` + src.slice(b);
}
// ---------- JS: flip without 3D backfaces ----------
rep('  function setFlip(v) {',
`  function turn(c, v) {
    var ci = c.querySelector(".idp-ci"), calm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!ci || !ci.animate || calm || c.classList.contains("flip") === v) { c.classList.toggle("flip", v); return; }
    var a = ci.animate([{ transform: "rotateY(0deg)" }, { transform: "rotateY(90deg)" }], { duration: 200, easing: "ease-in" });
    a.onfinish = function () {
      c.classList.toggle("flip", v);
      ci.animate([{ transform: "rotateY(-90deg)" }, { transform: "rotateY(0deg)" }], { duration: 200, easing: "ease-out" });
    };
  }
  function setFlip(v) {`);
rep('all[i].classList.toggle("flip", v);', 'turn(all[i], v);');
fs.writeFileSync(file, src);
console.log('Patched.');
