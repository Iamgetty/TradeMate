/* ---- Post media, X-style: rounded grids, tap-to-view lightbox ---- */
(function(){var e=e=document.createElement("link");e.id="tm-feed-media";e.rel="stylesheet";e.href="/tm/runtime-tm-feed-media.css";document.head.appendChild(e);
var ic=function(d){return'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+d+'"/></svg>'};
function openLb(list,start){var cur=start,lb=document.createElement("div");lb.id="fd-lb";lb.setAttribute("role","dialog");lb.setAttribute("aria-modal","true");lb.setAttribute("aria-label","Image viewer");
lb.innerHTML='<button type="button" class="x" aria-label="Close">'+ic("M6 6l12 12M18 6L6 18")+"</button>"+(list.length>1?'<button type="button" class="p" aria-label="Previous image">'+ic("M15 6l-6 6 6 6")+'</button><button type="button" class="n" aria-label="Next image">'+ic("M9 6l6 6-6 6")+'</button><span class="c"></span>':"")+'<img alt="">';
var im=lb.querySelector("img"),ct=lb.querySelector(".c");function show(){im.src=list[cur];ct&&(ct.textContent=cur+1+" / "+list.length)}
function close(){document.removeEventListener("keydown",key,!0);lb.remove()}
function go(d){cur=(cur+d+list.length)%list.length;show()}
function key(ev){"Escape"===ev.key?(ev.stopPropagation(),close()):list.length>1&&"ArrowLeft"===ev.key?go(-1):list.length>1&&"ArrowRight"===ev.key&&go(1)}
lb.addEventListener("click",function(ev){var t=ev.target;t===lb||t===im&&!1?close():t.closest(".x")?close():t.closest(".p")?go(-1):t.closest(".n")&&go(1)});
document.addEventListener("keydown",key,!0);document.body.appendChild(lb);show()}
document.addEventListener("click",function(ev){var b=ev.target.closest&&ev.target.closest("[data-fd-open]");if(b){ev.preventDefault();var g=b.closest(".fd-media");if(g){var list=[].map.call(g.querySelectorAll(".fd-mi img"),function(i){return i.currentSrc||i.src});list.length&&openLb(list,+b.dataset.fdOpen||0)}}});
})();