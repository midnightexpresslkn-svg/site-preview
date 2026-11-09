/* Hero carousel. Slides are the .hero-slide elements in index.html.
   Side view is first. Front and rear slot in as more .hero-slide blocks.
   Interior and airport figures are separate sections; this file does not
   touch the booking form. */
(function () {
  var header = document.querySelector("header.hero");
  var nav = document.querySelector(".navbar-fixed-top");
  var narrow = window.matchMedia("(max-width: 767px)");

  function fitHeroUnderNav() {
    if (!header || !nav) return;
    header.style.marginTop = narrow.matches ? nav.offsetHeight + "px" : "";
  }

  fitHeroUnderNav();
  window.addEventListener("resize", fitHeroUnderNav);
  if (typeof narrow.addEventListener === "function") {
    narrow.addEventListener("change", fitHeroUnderNav);
  }

  var root = document.querySelector(".hero-carousel");
  if (!root) return;

  var slides = Array.prototype.slice.call(root.querySelectorAll(".hero-slide"));
  var count = slides.length;
  root.setAttribute("data-slides", String(count));
  if (!count) return;

  var index = 0;
  var timer = null;
  var paused = false;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var hoverMQ = window.matchMedia("(hover: hover)");
  var dotsWrap = root.querySelector(".hero-dots");
  var viewport = root.querySelector(".hero-viewport") || root;

  function show(next) {
    index = (next + count) % count;
    slides.forEach(function (slide, i) {
      var on = i === index;
      slide.classList.toggle("is-active", on);
      slide.setAttribute("aria-hidden", on ? "false" : "true");
      slide.setAttribute("aria-label", i + 1 + " of " + count);
    });
    if (dotsWrap) {
      var dots = dotsWrap.querySelectorAll(".hero-dot");
      Array.prototype.forEach.call(dots, function (dot, i) {
        var on = i === index;
        dot.setAttribute("aria-selected", on ? "true" : "false");
        dot.tabIndex = on ? 0 : -1;
      });
    }
  }

  function stop() {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  function play() {
    if (count < 2 || reduce.matches || paused || document.hidden) return;
    stop();
    timer = window.setInterval(function () {
      show(index + 1);
    }, 5500);
  }

  function pause() {
    paused = true;
    stop();
  }

  function resume() {
    paused = false;
    play();
  }

  if (dotsWrap) {
    slides.forEach(function (slide, i) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "hero-dot";
      button.setAttribute("role", "tab");
      button.setAttribute("aria-label", "Photo " + (i + 1) + " of " + count);
      button.addEventListener("click", function () {
        show(i);
        resume();
      });
      dotsWrap.appendChild(button);
    });
  }

  var prev = root.querySelector(".hero-prev");
  var next = root.querySelector(".hero-next");
  if (prev) {
    prev.addEventListener("click", function () {
      show(index - 1);
      resume();
    });
  }
  if (next) {
    next.addEventListener("click", function () {
      show(index + 1);
      resume();
    });
  }

  root.addEventListener("keydown", function (event) {
    if (event.key === "ArrowLeft") {
      show(index - 1);
      resume();
    } else if (event.key === "ArrowRight") {
      show(index + 1);
      resume();
    }
  });

  var startX = 0;
  var startY = 0;
  var tracking = false;
  viewport.addEventListener("pointerdown", function (event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    tracking = true;
    startX = event.clientX;
    startY = event.clientY;
  });
  viewport.addEventListener("pointerup", function (event) {
    if (!tracking) return;
    tracking = false;
    var dx = event.clientX - startX;
    var dy = event.clientY - startY;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    show(dx < 0 ? index + 1 : index - 1);
    resume();
  });
  viewport.addEventListener("pointercancel", function () {
    tracking = false;
  });

  if (hoverMQ.matches) {
    root.addEventListener("mouseenter", pause);
    root.addEventListener("mouseleave", resume);
  }
  root.addEventListener("focusin", pause);
  root.addEventListener("focusout", function (event) {
    if (!root.contains(event.relatedTarget)) resume();
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else play();
  });
  if (typeof reduce.addEventListener === "function") {
    reduce.addEventListener("change", function () {
      if (reduce.matches) stop();
      else play();
    });
  }

  show(0);
  play();
})();
