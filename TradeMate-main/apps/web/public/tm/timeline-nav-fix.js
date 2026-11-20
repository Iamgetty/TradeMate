/* Extracted from app.js: Timeline navigation click behavior. */
/* Desktop: clicking the sidebar/nav while the Timeline is open closes it and goes straight to the chosen page */
!function(){if(window.__tlNavFix)return;window.__tlNavFix=1;document.addEventListener("click",function(e){var t=e.target;if(!t||!t.closest)return;var v=document.getElementById("tlView");if(!v||v.contains(t))return;if(t.closest(".sbar,#sbar,#nav,.nav")){v.remove();document.body.classList.remove("tm-timeline-open")}},!0)}();
