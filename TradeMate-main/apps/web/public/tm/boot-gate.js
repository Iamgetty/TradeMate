/*
 * Refresh flash guard.
 *
 * app.js already hides the app (#tm-auth-gate) until /auth/me confirms the
 * session, but it inserts ~70 stylesheets dynamically and does NOT wait for
 * them. If the session check returns first, Home paints once with the old,
 * default styling (cards, old spacing) and then restyles as the CSS arrives:
 * the "old screen flash" on refresh.
 *
 * This keeps the same elements hidden until (a) the app has drawn, (b) the
 * session gate is gone and (c) every stylesheet in <head> has loaded, then
 * reveals after two animation frames. A 4 s cap guarantees the app can never
 * stay hidden (for example if one stylesheet fails to load or the person is
 * signed out, where app.js keeps its own gate and shows the landing overlay).
 * It never touches app.js or its own gate.
 */
(function () {
  'use strict';
  if (window.__tmBootGate) return;
  window.__tmBootGate = true;

  var style = document.createElement('style');
  style.id = 'tm-css-gate';
  style.textContent = '#app,#nav,#nav *,#pg,#sbar,#sscrim,#shandle,#mwbar{visibility:hidden!important}';
  (document.head || document.documentElement).appendChild(style);

  var started = Date.now();
  var MAX_WAIT = 4000;
  var timer = 0;

  function release() {
    clearInterval(timer);
    if (style.parentNode) style.parentNode.removeChild(style);
  }

  function sheetsReady() {
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < links.length; i++) {
      if (!links[i].sheet) return false; // still loading (or failed; the cap covers that)
    }
    return true;
  }

  timer = setInterval(function () {
    if (Date.now() - started >= MAX_WAIT) { release(); return; }
    var app = document.getElementById('app');
    if (!app || !app.querySelector('.view')) return;        // app has not drawn yet
    if (document.getElementById('tm-auth-gate')) return;    // session still being verified
    if (!sheetsReady()) return;                             // styles still arriving
    requestAnimationFrame(function () { requestAnimationFrame(release); });
  }, 40);
})();
