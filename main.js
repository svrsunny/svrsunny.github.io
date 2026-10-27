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

  /* ---------- Theme toggle ---------- */

  var themeButton = document.querySelector(".theme-toggle");
  var darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

  function currentTheme() {
    return root.dataset.theme || (darkQuery.matches ? "dark" : "light");
  }

  function labelThemeButton() {
    var next = currentTheme() === "dark" ? "light" : "dark";
    themeButton.setAttribute("aria-label", "Switch to " + next + " theme");
  }

  if (themeButton) {
    labelThemeButton();
    darkQuery.addEventListener("change", labelThemeButton);
    themeButton.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      root.dataset.theme = next;
      try { localStorage.setItem("theme", next); } catch (e) {}
      labelThemeButton();
    });
  }

  /* ---------- Mobile menu ---------- */

  var menuButton = document.querySelector(".menu-toggle");
  var nav = document.getElementById("site-nav");

  function setMenu(open) {
    menuButton.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
  }

  if (menuButton && nav) {
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
    window.matchMedia("(min-width: 961px)").addEventListener("change", function (event) {
      if (event.matches) setMenu(false);
    });
  }

  /* ---------- Alert-noise panel ---------- */

  var field = document.getElementById("noise-field");
  var stageButtons = document.querySelectorAll(".segmented button");
  var readout = document.getElementById("noise-readout");
  var countEl = document.getElementById("noise-count");
  var labelEl = document.getElementById("noise-label");

  var stages = [
    { count: "500–700+", label: "alerts per client, per shift, at onboarding" },
    { count: "Under 100", label: "alerts per client, per shift, after six months" },
    { count: "Under 70", label: "alerts per client, per shift, after one year" }
  ];

  var cells = [];

  if (field) {
    // 640 alerts. "keep" is the last stage an alert survives to:
    // 68 survive a year of tuning, 95 survive six months, the rest are noise.
    var specs = [];
    function add(n, sev, keep) {
      for (var i = 0; i < n; i++) specs.push({ sev: sev, keep: keep });
    }
    add(30, "high", 2);
    add(33, "med", 2);
    add(5, "low", 2);
    add(17, "med", 1);
    add(10, "low", 1);
    add(20, "med", 0);
    add(525, "low", 0);

    var rand = seeded(7);
    for (var i = specs.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var tmp = specs[i]; specs[i] = specs[j]; specs[j] = tmp;
    }

    var fragment = document.createDocumentFragment();
    specs.forEach(function (spec) {
      var cell = document.createElement("i");
      cell.dataset.sev = spec.sev;
      cell.className = "on";
      cell.style.setProperty("--d", Math.round(rand() * 520) + "ms");
      cell._keep = spec.keep;
      cells.push(cell);
      fragment.appendChild(cell);
    });
    field.appendChild(fragment);
  }

  function setStage(stage) {
    cells.forEach(function (cell) {
      cell.classList.toggle("on", cell._keep >= stage);
    });
    countEl.textContent = stages[stage].count;
    labelEl.textContent = stages[stage].label;
    stageButtons.forEach(function (button) {
      button.setAttribute("aria-pressed", String(Number(button.dataset.stage) === stage));
    });
  }

  var autoplayTimers = [];
  function stopAutoplay() {
    autoplayTimers.forEach(clearTimeout);
    autoplayTimers = [];
  }

  stageButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      stopAutoplay();
      // Announce changes only once the visitor drives the panel themselves.
      readout.setAttribute("aria-live", "polite");
      setStage(Number(button.dataset.stage));
    });
  });

  // Play the tuning story once, the first time the panel is on screen.
  if (field && !reduceMotion && "IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      observer.disconnect();
      autoplayTimers.push(setTimeout(function () { setStage(1); }, 1100));
      autoplayTimers.push(setTimeout(function () { setStage(2); }, 2900));
    }, { threshold: 0.5 });
    observer.observe(field);
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

  if (copyButton) {
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
  }
})();
