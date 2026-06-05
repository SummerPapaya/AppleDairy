/* =========================================================================
   An Apple A Day — embeddable widget loader.

   Drop this on any page:

     <div id="apple-a-day"></div>
     <script src="https://YOUR-HOST/embed.js"
             data-target="#apple-a-day"
             data-mode="calendar"
             data-height="640"></script>

   It mounts the viewer in a responsive, sandboxed <iframe> pointing back at
   the host that served this script — so it works cross-origin on your site.
   ========================================================================= */
(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) {
    var all = document.getElementsByTagName("script");
    for (var i = all.length - 1; i >= 0; i--) {
      if (/embed\.js(\?|$)/.test(all[i].src)) { script = all[i]; break; }
    }
  }
  if (!script) return;

  // Host = origin that served embed.js
  var host = script.src.replace(/\/embed\.js(\?.*)?$/, "");
  var mode = script.getAttribute("data-mode") || "calendar";
  var height = script.getAttribute("data-height") || "640";
  var targetSel = script.getAttribute("data-target");

  var target = targetSel ? document.querySelector(targetSel) : null;

  var iframe = document.createElement("iframe");
  iframe.src = host + "/?mode=" + encodeURIComponent(mode) + "&api=" + encodeURIComponent(host);
  iframe.title = "An Apple A Day";
  iframe.loading = "lazy";
  iframe.setAttribute("scrolling", "yes");
  iframe.style.cssText =
    "width:100%;border:0;display:block;border-radius:18px;" +
    "height:" + (/^\d+$/.test(height) ? height + "px" : height) + ";";
  iframe.setAttribute(
    "sandbox",
    "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
  );

  if (target) {
    target.appendChild(iframe);
  } else {
    script.parentNode.insertBefore(iframe, script.nextSibling);
  }
})();
