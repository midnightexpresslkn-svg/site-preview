/**
 * Home-screen install tip for the booking page.
 * Android Chrome shows a button only after beforeinstallprompt.
 * iPhone Safari shows the Share instruction. Already-installed apps see nothing.
 */
(function () {
  "use strict";

  var tip = document.getElementById("add-home-tip");
  var button = document.getElementById("add-home-button");
  var iosNote = document.getElementById("add-home-ios");
  if (!tip || !button || !iosNote) return;

  function alreadyInstalled() {
    var standalone = false;
    try {
      standalone = window.matchMedia("(display-mode: standalone)").matches;
    } catch (err) {
      standalone = false;
    }
    return standalone || window.navigator.standalone === true;
  }

  function iosSafari() {
    var ua = navigator.userAgent || "";
    var iphone = /iPhone|iPad|iPod/.test(ua);
    var safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|Chrome|Android/.test(ua);
    return iphone && safari;
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  }

  if (alreadyInstalled()) return;

  if (iosSafari()) {
    iosNote.hidden = false;
    tip.hidden = false;
    return;
  }

  window.addEventListener("beforeinstallprompt", function (event) {
    if (!event || typeof event.preventDefault !== "function") return;
    event.preventDefault();
    if (typeof event.prompt !== "function") return;
    button.hidden = false;
    tip.hidden = false;
    button.addEventListener(
      "click",
      function () {
        button.hidden = true;
        tip.hidden = true;
        event.prompt();
      },
      { once: true },
    );
  });
})();
