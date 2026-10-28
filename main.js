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

  function onVisible(el, callback, threshold) {
    if (!("IntersectionObserver" in window)) { callback(); return; }
    var observer = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      observer.disconnect();
      callback();
    }, { threshold: threshold || 0.3 });
    observer.observe(el);
  }

  /* ---------- Theme ---------- */

  var themeButton = document.querySelector(".theme-toggle");
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  var themeListeners = [];

  function isLight() { return root.dataset.theme === "light"; }

  function syncThemeUi() {
    themeButton.setAttribute("aria-label", isLight() ? "Switch to dark theme" : "Switch to light theme");
    themeMeta.setAttribute("content", isLight() ? "#f5f7fb" : "#070b11");
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
  window.matchMedia("(min-width: 1024px)").addEventListener("change", function (event) {
    if (event.matches) setMenu(false);
  });

  /* ---------- Scroll: progress bar, active nav link, SOC trace ---------- */

  var progress = document.querySelector(".scroll-progress");
  var navLinks = Array.prototype.slice.call(nav.querySelectorAll("a"));
  var sections = navLinks.map(function (link) { return document.querySelector(link.getAttribute("href")); });
  var traceList = document.querySelector(".work-list");
  var scrollQueued = false;

  function onScroll() {
    scrollQueued = false;
    var scrollY = window.scrollY;
    var viewH = window.innerHeight;
    var max = root.scrollHeight - viewH;
    progress.style.setProperty("--progress", max > 0 ? Math.min(1, scrollY / max).toFixed(4) : 0);

    var marker = scrollY + viewH * 0.35;
    var active = -1;
    sections.forEach(function (section, i) {
      if (section && section.offsetTop <= marker) active = i;
    });
    navLinks.forEach(function (link, i) {
      if (i === active) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });

    if (traceList && !reduceMotion) {
      var rect = traceList.getBoundingClientRect();
      var drawn = (viewH * 0.7 - rect.top) / rect.height;
      traceList.style.setProperty("--trace", Math.max(0, Math.min(1, drawn)).toFixed(4));
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
    el.style.setProperty("--i", Math.min(siblings.indexOf(el), 6));
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
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
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
        var duration = 1600;
        (function step(now) {
          var t = Math.min(1, (now - start) / duration);
          var eased = 1 - Math.pow(1 - t, 3);
          el.textContent = formatCount(target * eased, format);
          if (t < 1) requestAnimationFrame(step);
        })(start);
      }, 0.6);
    });
  }

  /* ---------- Pointer spotlight on cards ---------- */

  if (window.matchMedia("(hover: hover)").matches) {
    document.addEventListener("pointermove", function (event) {
      var card = event.target.closest && event.target.closest(".spotlight");
      if (!card) return;
      var rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", (event.clientX - rect.left) + "px");
      card.style.setProperty("--my", (event.clientY - rect.top) + "px");
    }, { passive: true });
  }

  /* ---------- Detection pipeline simulation ---------- */

  var canvas = document.getElementById("pipeline-canvas");
  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext("2d");
    var counts = {
      events: document.getElementById("count-events"),
      alerts: document.getElementById("count-alerts"),
      incidents: document.getElementById("count-incidents")
    };
    var total = { events: 0, alerts: 0, incidents: 0 };
    var rand = Math.random;
    var colors = {};
    var particles = [];
    var cases = [];
    var width = 0;
    var height = 0;
    var dpr = 1;
    var spawnDebt = 0;
    var running = false;
    var lastTime = 0;
    var lastCounterUpdate = 0;
    var clock = 0;

    function readColors() {
      var style = getComputedStyle(root);
      colors.raw = style.getPropertyValue("--ink-3").trim();
      colors.alert = style.getPropertyValue("--sev-med").trim();
      colors.incident = style.getPropertyValue("--sev-high").trim();
      colors.accent = style.getPropertyValue("--accent").trim();
      colors.line = style.getPropertyValue("--line-strong").trim();
      colors.label = style.getPropertyValue("--ink-2").trim();
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function geometry() {
      return {
        det: width * 0.36,
        tri: width * 0.62,
        inc: width * 0.84,
        top: 40,
        bottom: height - 16
      };
    }

    function spawn(g) {
      var speed = (55 + rand() * 55) * Math.max(0.7, width / 640);
      particles.push({
        x: -4,
        y: g.top + rand() * (g.bottom - g.top),
        vx: speed,
        phase: rand() * Math.PI * 2,
        state: "raw",
        alpha: 0.55 + rand() * 0.35,
        size: 1.4 + rand() * 1.1,
        fading: false
      });
      total.events++;
    }

    function update(dt) {
      var g = geometry();
      clock += dt;
      spawnDebt += dt * 46 * Math.max(0.6, width / 640);
      while (spawnDebt >= 1 && particles.length < 280) { spawn(g); spawnDebt -= 1; }
      if (spawnDebt > 1) spawnDebt = 0;

      for (var i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.x += p.vx * dt;
        p.y += Math.sin(clock * 2 + p.phase) * 6 * dt;

        if (p.state === "raw" && !p.fading && p.x >= g.det) {
          if (rand() < 0.1) {
            p.state = "alert";
            p.size = 2.8;
            p.alpha = 1;
            p.vx *= 0.8;
            total.alerts++;
          } else {
            p.fading = true;
            p.vx *= 0.45;
          }
        } else if (p.state === "alert" && !p.fading && p.x >= g.tri) {
          if (rand() < 0.15) {
            p.state = "incident";
            p.size = 3.6;
            p.targetY = height * 0.5 + (rand() - 0.5) * (height * 0.35);
            p.vx *= 0.7;
          } else {
            p.fading = true;
            p.vx *= 0.5;
          }
        } else if (p.state === "incident") {
          p.y += (p.targetY - p.y) * Math.min(1, dt * 3);
          if (p.x >= g.inc) {
            cases.push({ x: p.x, y: p.y, age: 0 });
            total.incidents++;
            particles.splice(i, 1);
            continue;
          }
        }

        if (p.fading) p.alpha -= dt * 1.6;
        if (p.alpha <= 0 || p.x > width + 10) particles.splice(i, 1);
      }

      for (var j = cases.length - 1; j >= 0; j--) {
        cases[j].age += dt;
        if (cases[j].age > 5) cases.splice(j, 1);
      }
    }

    function draw() {
      var g = geometry();
      ctx.clearRect(0, 0, width, height);

      // Detection and triage gates
      [g.det, g.tri].forEach(function (x, i) {
        var band = ctx.createLinearGradient(x - 28, 0, x + 4, 0);
        band.addColorStop(0, "transparent");
        band.addColorStop(1, i === 0 ? colors.accent : colors.alert);
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = band;
        ctx.fillRect(x - 28, g.top - 8, 32, g.bottom - g.top + 8);
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = colors.line;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(x + 0.5, g.top - 8);
        ctx.lineTo(x + 0.5, g.bottom);
        ctx.stroke();
      });
      ctx.setLineDash([]);

      // Stage labels
      var small = width < 420;
      ctx.globalAlpha = 1;
      ctx.fillStyle = colors.label;
      ctx.font = (small ? "500 10px " : "500 11px ") + '"Geist Mono", ui-monospace, monospace';
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText("Telemetry", 14, 20);
      ctx.fillText("Detection", g.det + 8, 20);
      ctx.fillText("Triage", g.tri + 8, 20);
      ctx.textAlign = "right";
      ctx.fillText("Incident", width - 12, 20);
      ctx.textAlign = "left";

      // Particles
      particles.forEach(function (p) {
        var color = p.state === "raw" ? colors.raw : p.state === "alert" ? colors.alert : colors.incident;
        ctx.globalAlpha = Math.max(0, p.alpha) * (p.state === "raw" ? 0.75 : 1);
        ctx.strokeStyle = color;
        ctx.lineWidth = p.size;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx * (p.state === "raw" ? 0.05 : 0.08), p.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        if (p.state === "incident") {
          ctx.shadowColor = colors.incident;
          ctx.shadowBlur = 14;
          ctx.fillStyle = colors.incident;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      // Escalated incidents pulse, then fade
      cases.forEach(function (c) {
        var life = c.age / 5;
        ctx.globalAlpha = 1 - life;
        ctx.fillStyle = colors.incident;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
        ctx.fill();
        var ring = (c.age % 1.2) / 1.2;
        ctx.globalAlpha = (1 - ring) * (1 - life) * 0.8;
        ctx.strokeStyle = colors.incident;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 4 + ring * 16, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }

    function renderCounts() {
      counts.events.textContent = total.events.toLocaleString("en-US");
      counts.alerts.textContent = total.alerts.toLocaleString("en-US");
      counts.incidents.textContent = total.incidents.toLocaleString("en-US");
    }

    function frame(now) {
      if (!running) return;
      var dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      update(dt);
      draw();
      if (now - lastCounterUpdate > 120) { renderCounts(); lastCounterUpdate = now; }
      requestAnimationFrame(frame);
    }

    function start() {
      if (running || reduceMotion) return;
      if (canvas.clientWidth !== width) resize();
      running = true;
      lastTime = performance.now();
      requestAnimationFrame(frame);
    }
    function stop() { running = false; }

    readColors();
    resize();

    if (reduceMotion) {
      // A still frame of a pipeline already in motion.
      for (var s = 0; s < 400; s++) update(1 / 30);
      draw();
      renderCounts();
    } else {
      // Warm up so the first frame already shows a full pipeline.
      for (var w = 0; w < 160; w++) update(1 / 30);
      var canvasVisible = true;
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
          canvasVisible = entries[0].isIntersecting;
          if (canvasVisible && !document.hidden) start(); else stop();
        }).observe(canvas);
      } else {
        start();
      }
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) stop(); else if (canvasVisible) start();
      });
    }

    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        resize();
        if (!running) draw();
      }, 120);
    });

    themeListeners.push(function () {
      readColors();
      if (!running) draw();
    });
  }

  /* ---------- Alert-noise chart ---------- */

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
      cell.style.setProperty("--d", Math.round(noiseRand() * 600) + "ms");
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
      noiseTimers.push(setTimeout(function () { setNoiseStage(1); }, 1200));
      noiseTimers.push(setTimeout(function () { setNoiseStage(2); }, 3000));
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
