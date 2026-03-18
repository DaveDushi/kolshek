// ── Theme toggle (click to cycle: dark → light → dark) ──────
var THEME_KEY = "kolshek-theme";

function getCurrentTheme() {
  var stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
}

function cycleTheme() {
  setTheme(getCurrentTheme() === "dark" ? "light" : "dark");
}

document.querySelectorAll(".theme-cycle-btn").forEach(function (btn) {
  btn.addEventListener("click", cycleTheme);
});

// ── Mobile sidebar toggle ────────────────────────────────────
var sidebarToggle = document.getElementById("docs-menu-toggle");
var sidebar = document.getElementById("docs-sidebar");

if (sidebarToggle && sidebar) {
  sidebarToggle.addEventListener("click", function () {
    sidebar.classList.toggle("open");
  });

  // Close sidebar when a link is clicked (mobile)
  sidebar.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      sidebar.classList.remove("open");
    });
  });

  // Close on outside click
  document.addEventListener("click", function (e) {
    if (
      sidebar.classList.contains("open") &&
      !sidebar.contains(e.target) &&
      !sidebarToggle.contains(e.target)
    ) {
      sidebar.classList.remove("open");
    }
  });
}

// ── Active sidebar link tracking ─────────────────────────────
var docsSections = document.querySelectorAll(".docs-section[id]");
var sidebarLinks = document.querySelectorAll(".docs-sidebar-link");

var docsObserver = new IntersectionObserver(
  function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        var id = entry.target.getAttribute("id");
        sidebarLinks.forEach(function (link) {
          link.classList.toggle(
            "active",
            link.getAttribute("href") === "#" + id
          );
        });
      }
    });
  },
  { threshold: 0.1, rootMargin: "-80px 0px -60% 0px" }
);

docsSections.forEach(function (section) {
  docsObserver.observe(section);
});

// ── Fetch latest release version ─────────────────────────────
(function () {
  var REPO = "DaveDushi/kolshek";
  var CACHE_KEY = "kolshek-release";
  var CACHE_TTL = 1000 * 60 * 30;

  function applyVersion(tag) {
    var footerEl = document.getElementById("footer-version");
    if (footerEl) footerEl.textContent = "KolShek " + tag;
  }

  try {
    var cached = JSON.parse(sessionStorage.getItem(CACHE_KEY));
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      applyVersion(cached.tag);
      return;
    }
  } catch (e) {}

  fetch("https://api.github.com/repos/" + REPO + "/releases/latest")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.tag_name) {
        applyVersion(data.tag_name);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ tag: data.tag_name, ts: Date.now() }));
        } catch (e) {}
      }
    })
    .catch(function () {});
})();
