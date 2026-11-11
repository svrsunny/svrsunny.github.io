(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Small seeded random generator so the drawings look the same on every visit.
  function seeded(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp01(value) { return Math.max(0, Math.min(1, value)); }

  function onVisible(el, callback, threshold) {
    if (!("IntersectionObserver" in window)) { callback(); return; }
    var observer = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      observer.disconnect();
      callback();
    }, { threshold: threshold || 0.3 });
    observer.observe(el);
  }

  /* ---------- Entrance: wait for the display font so the headline doesn't jump ---------- */

  var readied = false;
  function ready() {
    if (readied) return;
    readied = true;
    root.classList.add("is-ready");
  }
  if (document.fonts && document.fonts.load) {
    document.fonts.load('1em "Instrument Serif"').then(ready, ready);
  }
  setTimeout(ready, 900);

  /* ---------- Theme ---------- */

  var themeButton = document.querySelector(".theme-toggle");
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  var themeListeners = [];

  function isLight() { return root.dataset.theme === "light"; }

  function syncThemeUi() {
    themeButton.setAttribute("aria-label", isLight() ? "Switch to dark theme" : "Switch to light theme");
    themeMeta.setAttribute("content", isLight() ? "#f4f2ed" : "#08090c");
    themeListeners.forEach(function (fn) { fn(); });
  }

  themeButton.addEventListener("click", function () {
    if (isLight()) delete root.dataset.theme;
    else root.dataset.theme = "light";
    try { localStorage.setItem("theme", isLight() ? "light" : "dark"); } catch (e) {}
    syncThemeUi();
  });

  /* ---------- Mobile menu ---------- */

  var menuButton = document.querySelector(".menu-toggle");
  var nav = document.getElementById("site-nav");

  function setMenu(open) {
    menuButton.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
  }

  menuButton.addEventListener("click", function () {
    setMenu(menuButton.getAttribute("aria-expanded") !== "true");
  });
  nav.addEventListener("click", function (event) {
    if (event.target.closest("a")) setMenu(false);
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && nav.classList.contains("is-open")) {
      setMenu(false);
      menuButton.focus();
    }
  });
  document.addEventListener("click", function (event) {
    if (nav.classList.contains("is-open") && !event.target.closest(".site-header")) setMenu(false);
  });
  window.matchMedia("(min-width: 960px)").addEventListener("change", function (event) {
    if (event.matches) setMenu(false);
  });

  /* ---------- Statement: split into words that light up as you scroll ---------- */

  var statement = document.getElementById("statement");
  var statementWords = [];
  if (statement) {
    var keyWords = { one: true, signal: true };
    var words = statement.textContent.trim().split(/\s+/);
    statement.textContent = "";
    words.forEach(function (word, i) {
      var span = document.createElement("span");
      span.className = "w" + (keyWords[word.toLowerCase().replace(/[^a-z]/g, "")] ? " is-key" : "");
      span.textContent = word;
      statement.appendChild(span);
      if (i < words.length - 1) statement.appendChild(document.createTextNode(" "));
      statementWords.push(span);
    });
    if (reduceMotion) statementWords.forEach(function (span) { span.classList.add("is-lit"); });
  }

  /* ---------- Scroll: progress, header, active link, statement, parallax ---------- */

  var header = document.querySelector(".site-header");
  var progress = document.querySelector(".scroll-progress");
  var navLinks = Array.prototype.slice.call(nav.querySelectorAll("a"));
  var sections = navLinks.map(function (link) { return document.querySelector(link.getAttribute("href")); });
  var portrait = document.querySelector(".portrait-frame img");
  var phoneShot = document.querySelector(".shot-phone");
  var scrollQueued = false;

  function onScroll() {
    scrollQueued = false;
    var scrollY = window.scrollY;
    var viewH = window.innerHeight;
    var max = root.scrollHeight - viewH;
    progress.style.setProperty("--progress", max > 0 ? clamp01(scrollY / max).toFixed(4) : 0);
    header.classList.toggle("is-scrolled", scrollY > 8);

    var marker = scrollY + viewH * 0.4;
    var active = -1;
    sections.forEach(function (section, i) {
      if (section && section.offsetTop <= marker) active = i;
    });
    navLinks.forEach(function (link, i) {
      if (i === active) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });

    if (reduceMotion) return;

    if (statementWords.length) {
      var rect = statement.getBoundingClientRect();
      var lit = clamp01((viewH * 0.82 - rect.top) / (rect.height + viewH * 0.3)) * statementWords.length;
      statementWords.forEach(function (span, i) { span.classList.toggle("is-lit", i < lit); });
    }
    if (portrait) portrait.style.setProperty("--parallax", clamp01(scrollY / viewH).toFixed(3));
    if (phoneShot) {
      var shot = phoneShot.parentElement.getBoundingClientRect();
      phoneShot.style.setProperty("--parallax", clamp01((viewH - shot.top) / (viewH + shot.height)).toFixed(3));
    }
  }

  window.addEventListener("scroll", function () {
    if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();

  /* ---------- Reveal on scroll ---------- */

  var revealEls = document.querySelectorAll("[data-reveal]");
  revealEls.forEach(function (el) {
    var siblings = Array.prototype.filter.call(el.parentElement.children, function (child) {
      return child.hasAttribute("data-reveal");
    });
    el.style.setProperty("--i", Math.min(siblings.indexOf(el), 5));
  });

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.08 });
    revealEls.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ---------- Count-up numbers ---------- */

  function formatCount(value, format) {
    if (format === "k") return Math.round(value / 1000) + "K";
    return String(Math.round(value));
  }

  if (!reduceMotion) {
    document.querySelectorAll("[data-count]").forEach(function (el) {
      var target = Number(el.dataset.count);
      var format = el.dataset.format;
      el.textContent = formatCount(0, format);
      onVisible(el, function () {
        var start = performance.now();
        var duration = 1800;
        (function step(now) {
          var t = clamp01((now - start) / duration);
          el.textContent = formatCount(target * (1 - Math.pow(1 - t, 4)), format);
          if (t < 1) requestAnimationFrame(step);
        })(start);
      }, 0.6);
    });
  }

  /* ---------- Hero field: a quiet field of noise with one signal in it ---------- */

  var fieldCanvas = document.getElementById("hero-field");
  if (fieldCanvas && fieldCanvas.getContext) {
    var ctx = fieldCanvas.getContext("2d");
    var fieldRand = seeded(11);
    var GAP = 36;
    var dots = [];
    var colors = {};
    var width = 0;
    var height = 0;
    var cols = 0;
    var rows = 0;
    var signal = { col: 0, row: 0, born: 0 };
    var pointer = { x: -999, y: -999 };
    var running = false;
    var lastFrame = 0;

    function readColors() {
      var style = getComputedStyle(root);
      colors.ink = style.getPropertyValue("--ink").trim();
      colors.signal = style.getPropertyValue("--signal").trim();
    }

    function placeSignal(now) {
      // Keep the signal on the right-hand side, clear of the headline on wide screens.
      var minCol = width >= 960 ? Math.floor(cols * 0.55) : Math.floor(cols * 0.2);
      signal.col = minCol + Math.floor(Math.random() * Math.max(1, cols - minCol - 1));
      signal.row = 1 + Math.floor(Math.random() * Math.max(1, Math.min(rows - 2, 7)));
      signal.born = now;
    }

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = fieldCanvas.clientWidth;
      height = fieldCanvas.clientHeight;
      fieldCanvas.width = Math.round(width * dpr);
      fieldCanvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(width / GAP) + 1;
      rows = Math.ceil(height / GAP) + 1;
      dots = [];
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          dots.push({ x: c * GAP + 8, y: r * GAP + 8, phase: fieldRand() * 6.283, speed: 0.4 + fieldRand() * 0.9 });
        }
      }
      placeSignal(performance.now());
    }

    function draw(now) {
      var t = now / 1000;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = colors.ink;
      for (var i = 0; i < dots.length; i++) {
        var d = dots[i];
        var alpha = 0.07 + 0.07 * Math.sin(t * d.speed + d.phase);
        var dx = d.x - pointer.x;
        var dy = d.y - pointer.y;
        var near = dx * dx + dy * dy;
        if (near < 19600) alpha += 0.32 * (1 - near / 19600);
        ctx.globalAlpha = alpha;
        ctx.fillRect(d.x - 0.75, d.y - 0.75, 1.5, 1.5);
      }

      var age = (now - signal.born) / 1000;
      var life = 7;
      var fade = Math.min(1, age / 0.8) * clamp01((life - age) / 0.8);
      var sx = signal.col * GAP + 8;
      var sy = signal.row * GAP + 8;
      ctx.fillStyle = colors.signal;
      ctx.strokeStyle = colors.signal;
      ctx.globalAlpha = fade;
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, 6.283);
      ctx.fill();
      var ring = (age % 2.2) / 2.2;
      ctx.globalAlpha = fade * (1 - ring) * 0.7;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx, sy, 3 + ring * 26, 0, 6.283);
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (age > life) placeSignal(now);
    }

    function frame(now) {
      if (!running) return;
      if (now - lastFrame > 32) { lastFrame = now; draw(now); }
      requestAnimationFrame(frame);
    }
    function start() { if (!running && !reduceMotion) { running = true; requestAnimationFrame(frame); } }
    function stop() { running = false; }

    readColors();
    resize();
    if (reduceMotion) {
      signal.born = performance.now() - 2000;
      draw(performance.now());
    } else {
      var fieldVisible = true;
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
          fieldVisible = entries[0].isIntersecting;
          if (fieldVisible && !document.hidden) start(); else stop();
        }).observe(fieldCanvas);
      } else {
        start();
      }
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) stop(); else if (fieldVisible) start();
      });
      if (window.matchMedia("(hover: hover)").matches) {
        var hero = fieldCanvas.parentElement;
        hero.addEventListener("pointermove", function (event) {
          var rect = fieldCanvas.getBoundingClientRect();
          pointer.x = event.clientX - rect.left;
          pointer.y = event.clientY - rect.top;
        }, { passive: true });
        hero.addEventListener("pointerleave", function () { pointer.x = pointer.y = -999; });
      }
    }

    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (fieldCanvas.clientWidth === width && fieldCanvas.clientHeight === height) return;
        resize();
        if (!running) draw(performance.now());
      }, 150);
    });
    themeListeners.push(function () {
      readColors();
      if (!running) draw(performance.now());
    });
  }

  /* ---------- Alert tuning: noise fades, signal stays ---------- */

  var field = document.getElementById("noise-field");
  var stageButtons = document.querySelectorAll(".segmented button");
  var readout = document.getElementById("noise-readout");
  var countEl = document.getElementById("noise-count");
  var labelEl = document.getElementById("noise-label");
  var noiseStages = [
    { count: "500–700+", label: "alerts per client, per shift, at onboarding" },
    { count: "Under 100", label: "alerts per client, per shift, after six months" },
    { count: "Under 70", label: "alerts per client, per shift, after one year" }
  ];
  var cells = [];

  if (field) {
    // 640 alerts. "keep" is the last stage an alert survives to:
    // 68 survive a year of tuning, 95 survive six months, the rest are noise.
    var specs = [];
    var addSpecs = function (n, sev, keep) {
      for (var i = 0; i < n; i++) specs.push({ sev: sev, keep: keep });
    };
    addSpecs(30, "high", 2);
    addSpecs(33, "med", 2);
    addSpecs(5, "low", 2);
    addSpecs(17, "med", 1);
    addSpecs(10, "low", 1);
    addSpecs(20, "med", 0);
    addSpecs(525, "low", 0);

    var noiseRand = seeded(7);
    for (var i = specs.length - 1; i > 0; i--) {
      var j = Math.floor(noiseRand() * (i + 1));
      var tmp = specs[i]; specs[i] = specs[j]; specs[j] = tmp;
    }

    var fragment = document.createDocumentFragment();
    specs.forEach(function (spec) {
      var cell = document.createElement("i");
      cell.dataset.sev = spec.sev;
      cell.className = "on";
      cell.style.setProperty("--d", Math.round(noiseRand() * 700) + "ms");
      cell._keep = spec.keep;
      cells.push(cell);
      fragment.appendChild(cell);
    });
    field.appendChild(fragment);
  }

  function setNoiseStage(stage) {
    cells.forEach(function (cell) { cell.classList.toggle("on", cell._keep >= stage); });
    countEl.textContent = noiseStages[stage].count;
    labelEl.textContent = noiseStages[stage].label;
    stageButtons.forEach(function (button) {
      button.setAttribute("aria-pressed", String(Number(button.dataset.stage) === stage));
    });
  }

  var noiseTimers = [];
  stageButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      noiseTimers.forEach(clearTimeout);
      noiseTimers = [];
      // Announce changes only once the visitor drives the chart themselves.
      readout.setAttribute("aria-live", "polite");
      setNoiseStage(Number(button.dataset.stage));
    });
  });

  // Play the tuning story once, the first time the chart is on screen.
  if (field && !reduceMotion) {
    onVisible(field, function () {
      noiseTimers.push(setTimeout(function () { setNoiseStage(1); }, 1300));
      noiseTimers.push(setTimeout(function () { setNoiseStage(2); }, 3300));
    }, 0.5);
  }

  /* ---------- Film: poster first, YouTube loads on play ---------- */

  var filmLink = document.querySelector(".film-play");
  if (filmLink) {
    var tallQuery = window.matchMedia("(max-width: 767px) and (orientation: portrait)");
    filmLink.addEventListener("click", function (event) {
      event.preventDefault();
      var tall = tallQuery.matches;
      var id = tall ? filmLink.dataset.tallId : filmLink.dataset.wideId;
      var film = filmLink.closest(".film");
      var frame = filmLink.parentElement;
      var iframe = document.createElement("iframe");
      iframe.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0&playsinline=1";
      iframe.title = "Sanjeev Varma Ragula: my work in two minutes";
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      // Keep the frame shape that matches the chosen cut, even if the phone rotates later.
      film.classList.add(tall ? "is-tall" : "is-wide");
      frame.replaceChild(iframe, filmLink);
      iframe.focus();
    });
  }

  /* ---------- Toolkit marquee ---------- */

  var track = document.querySelector(".marquee-track");
  if (track && !reduceMotion) {
    // A second copy makes the loop seamless.
    Array.prototype.slice.call(track.children).forEach(function (item) {
      track.appendChild(item.cloneNode(true));
    });
  }

  /* ---------- Shift Roster preview ---------- */

  var roster = document.getElementById("roster");
  if (roster) {
    var rosterRand = seeded(26);
    var html = "";
    for (var row = 0; row < 11; row++) {
      var offStart = (row * 2) % 7;
      for (var day = 0; day < 31; day++) {
        var week = Math.floor((day + row) / 7);
        var dow = (day + row * 3) % 7;
        var shift = (week + row) % 2 === 0 ? "m" : "e";
        if (dow === offStart || dow === (offStart + 1) % 7) shift = "o";
        var roll = rosterRand();
        if (roll < 0.035) shift = "l";
        else if (roll < 0.06) shift = "c";
        html += '<i data-s="' + shift + '"></i>';
      }
    }
    roster.innerHTML = html;
  }

  /* ---------- Copy email ---------- */

  var copyButton = document.getElementById("copy-email");
  var copyStatus = document.getElementById("copy-status");
  var statusTimer;

  function showStatus(text) {
    copyStatus.textContent = text;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { copyStatus.textContent = ""; }, 4000);
  }

  function legacyCopy(text) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(area);
    return ok;
  }

  copyButton.addEventListener("click", function () {
    var email = copyButton.dataset.email;
    var failed = "Couldn't copy automatically. The address is " + email + ".";
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(email).then(
        function () { showStatus("Email address copied."); },
        function () { showStatus(legacyCopy(email) ? "Email address copied." : failed); }
      );
    } else {
      showStatus(legacyCopy(email) ? "Email address copied." : failed);
    }
  });

  syncThemeUi();
})();
