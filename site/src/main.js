// ── Scroll animations (IntersectionObserver) ──────────────────
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
);

document.querySelectorAll(".fade-up").forEach((el) => observer.observe(el));

// ── Hero demo tab switcher ───────────────────────────────────
document.querySelectorAll(".hero-demo-tab").forEach(function (tab) {
  tab.addEventListener("click", function () {
    var demo = tab.dataset.demo;
    document.querySelectorAll(".hero-demo-tab").forEach(function (t) {
      t.classList.toggle("active", t.dataset.demo === demo);
    });
    document.querySelectorAll(".hero-demo-panel").forEach(function (p) {
      p.classList.toggle("active", p.id === "demo-" + demo);
    });
  });
});

// ── Chat auto-scroll on message appear ───────────────────────
// Messages start display:none so scrollHeight grows as each appears.
// JS reveals them at their --chat-delay, then scrolls the small delta.
(function () {
  var chatBody = document.querySelector("#demo-chat .chat-body");
  if (!chatBody) return;

  chatBody.querySelectorAll(".chat-anim-trigger").forEach(function (msg) {
    var delayStr = msg.style.getPropertyValue("--chat-delay") || "0s";
    var delayMs = parseFloat(delayStr) * 1000;

    setTimeout(function () {
      msg.style.display = "flex";
      msg.style.animation = "chat-appear 0.4s ease forwards";

      // Fix typing dots: their CSS delay includes --chat-delay which already elapsed
      var typing = msg.querySelector(".chat-typing");
      if (typing) typing.style.animationDelay = "1.2s";

      // After paint, scroll to show the new message (distance is small — just one msg)
      requestAnimationFrame(function () {
        var bottom = chatBody.scrollHeight - chatBody.clientHeight;
        if (bottom > chatBody.scrollTop) {
          chatBody.scrollTo({ top: bottom, behavior: "smooth" });
        }
      });
    }, delayMs);
  });
})();

// ── Nav scroll effect ─────────────────────────────────────────
const nav = document.getElementById("nav");
let lastScroll = 0;

window.addEventListener(
  "scroll",
  () => {
    const scrollY = window.scrollY;
    if (scrollY > 50) {
      nav.classList.add("scrolled");
    } else {
      nav.classList.remove("scrolled");
    }
    lastScroll = scrollY;
  },
  { passive: true },
);

// ── Mobile menu ───────────────────────────────────────────────
const hamburger = document.getElementById("hamburger");
const mobileMenu = document.getElementById("mobile-menu");

hamburger.addEventListener("click", () => {
  const isOpen = mobileMenu.classList.toggle("open");
  hamburger.classList.toggle("open", isOpen);
  hamburger.setAttribute("aria-expanded", isOpen);
});

// Close menu on link click
mobileMenu.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    mobileMenu.classList.remove("open");
    hamburger.classList.remove("open");
    hamburger.setAttribute("aria-expanded", "false");
  });
});

// Close menu on outside click
document.addEventListener("click", (e) => {
  if (
    mobileMenu.classList.contains("open") &&
    !mobileMenu.contains(e.target) &&
    !hamburger.contains(e.target)
  ) {
    mobileMenu.classList.remove("open");
    hamburger.classList.remove("open");
    hamburger.setAttribute("aria-expanded", "false");
  }
});

// Close menu on Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && mobileMenu.classList.contains("open")) {
    mobileMenu.classList.remove("open");
    hamburger.classList.remove("open");
    hamburger.setAttribute("aria-expanded", "false");
  }
});

// ── Copy to clipboard ─────────────────────────────────────────
window.copyText = function (button, text) {
  navigator.clipboard.writeText(text).then(() => {
    const copyIcon = button.querySelector(".copy-icon");
    const checkIcon = button.querySelector(".check-icon");
    if (copyIcon && checkIcon) {
      copyIcon.classList.add("hidden");
      checkIcon.classList.remove("hidden");
      button.classList.add("copied");
      setTimeout(() => {
        copyIcon.classList.remove("hidden");
        checkIcon.classList.add("hidden");
        button.classList.remove("copied");
      }, 2000);
    }
  });
};

// ── Plugin picker ────────────────────────────────────────────
document.querySelectorAll(".gs-plugin-pill").forEach(function (pill) {
  pill.addEventListener("click", function () {
    document.querySelectorAll(".gs-plugin-pill").forEach(function (p) {
      p.classList.remove("active");
    });
    pill.classList.add("active");
    var cmd = "kolshek plugin install " + pill.dataset.plugin;
    var cmdEl = document.getElementById("gs-plugin-cmd");
    if (cmdEl) cmdEl.textContent = cmd;
    // Reset copy button state
    var copyBtn = document.getElementById("gs-plugin-copy");
    if (copyBtn) {
      copyBtn.onclick = function () {
        window.copyText(copyBtn, cmd);
      };
      var copyIcon = copyBtn.querySelector(".copy-icon");
      var checkIcon = copyBtn.querySelector(".check-icon");
      if (copyIcon) copyIcon.classList.remove("hidden");
      if (checkIcon) checkIcon.classList.add("hidden");
    }
  });
});

// ── Setup command selector ────────────────────────────────────
function updateCmdCount() {
  var checked = document.querySelectorAll("#setup-commands input:checked");
  var countEl = document.getElementById("cmd-count");
  if (countEl) {
    var n = checked.length;
    countEl.textContent =
      n === 0
        ? "none selected"
        : n + " command" + (n > 1 ? "s" : "") + " selected";
  }
}

document.querySelectorAll("#setup-commands input").forEach(function (cb) {
  cb.addEventListener("change", updateCmdCount);
});

window.copySelectedCommands = function () {
  var checked = document.querySelectorAll("#setup-commands input:checked");
  var cmds = [];
  checked.forEach(function (cb) {
    cmds.push(cb.dataset.cmd);
  });
  if (cmds.length === 0) {
    showToast("No commands selected", "error");
    return;
  }
  var text = cmds.join("\n");
  navigator.clipboard.writeText(text).then(function () {
    showToast(
      "Copied " + cmds.length + " command" + (cmds.length > 1 ? "s" : ""),
      "success",
    );
  });
};

// ── Toast notifications ───────────────────────────────────────
function showToast(message, type) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = "toast show toast-" + type;
  setTimeout(() => {
    toast.classList.remove("show");
  }, 4000);
}

// ── Feedback form ─────────────────────────────────────────────
const WORKER_URL = "https://api.kolshek.com";
const fbSubmitLabel =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Submit Feedback';

// Character counter
var fbDetails = document.getElementById("fb-details");
var fbCharCount = document.getElementById("fb-char-count");
if (fbDetails && fbCharCount) {
  fbDetails.addEventListener("input", function () {
    var len = fbDetails.value.length;
    fbCharCount.textContent = len.toLocaleString() + " / 2,000";
  });
}

window.submitFeedback = async function (event) {
  event.preventDefault();

  var form = event.target;
  var submitBtn = document.getElementById("fb-submit");
  var statusEl = document.getElementById("fb-status");

  var checkedRadio = form.querySelector('[name="type"]:checked');
  var type = checkedRadio ? checkedRadio.value : "other";
  var title = form.querySelector('[name="title"]').value.trim();
  var details = form.querySelector('[name="details"]').value.trim();

  if (!title || !details) return;

  submitBtn.disabled = true;
  submitBtn.innerHTML = "Submitting...";

  try {
    var res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: type, title: title, details: details }),
    });

    if (!res.ok) throw new Error("Failed to submit");

    var data = await res.json();
    showToast("Feedback submitted! Thank you.", "success");
    form.reset();
    if (fbCharCount) fbCharCount.textContent = "0 / 2,000";

    if (data.url) {
      statusEl.innerHTML =
        'Issue created: <a href="' +
        data.url +
        '" target="_blank" rel="noopener" class="text-primary-400 underline underline-offset-2">' +
        data.url +
        "</a>";
      statusEl.className = "text-sm text-body mt-4";
      statusEl.classList.remove("hidden");
    }
  } catch (err) {
    var labels =
      type === "bug"
        ? "bug,feedback"
        : type === "feature"
          ? "enhancement,feedback"
          : "feedback";

    var body =
      "## Type\n" +
      type +
      "\n\n## Details\n" +
      details +
      "\n\n---\n*Submitted via kolshek.dev feedback form*";

    var url =
      "https://github.com/DaveDushi/kolshek/issues/new" +
      "?title=" +
      encodeURIComponent("[Feedback] " + title) +
      "&body=" +
      encodeURIComponent(body) +
      "&labels=" +
      encodeURIComponent(labels);

    window.open(url, "_blank");
    showToast("Redirected to GitHub to complete submission.", "success");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = fbSubmitLabel;
  }
};

// ── Active nav pill tracking ──────────────────────────────────
const sections = document.querySelectorAll("section[id]");
const navPills = document.querySelectorAll(".nav-pill");

const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute("id");
        navPills.forEach((pill) => {
          pill.classList.toggle(
            "active",
            pill.getAttribute("href") === "#" + id,
          );
        });
      }
    });
  },
  { threshold: 0.3, rootMargin: "-80px 0px -50% 0px" },
);

sections.forEach((section) => sectionObserver.observe(section));

// ── Theme toggle (click to cycle: dark → light → dark) ──────
const THEME_KEY = "kolshek-theme";

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
  var current = getCurrentTheme();
  setTheme(current === "dark" ? "light" : "dark");
}

// Attach click handlers to all cycle buttons
document.querySelectorAll("#theme-cycle, .theme-cycle-mobile").forEach(function (btn) {
  btn.addEventListener("click", cycleTheme);
});

// ── OS auto-detection for download button ────────────────────
(function () {
  var ua = navigator.userAgent || "";
  var plat = navigator.platform || "";
  var btn = document.getElementById("dl-auto");
  var label = document.getElementById("dl-auto-label");
  var base = "https://github.com/DaveDushi/kolshek/releases/latest/download/";

  if (/Mac/i.test(plat)) {
    // Check for Apple Silicon via WebGL renderer or default to arm64
    var isArm =
      /arm/i.test(ua) ||
      (navigator.userAgentData &&
        navigator.userAgentData.architecture === "arm");
    if (btn)
      btn.href = base + (isArm ? "kolshek-macos-arm64" : "kolshek-macos-x64");
    if (label) label.textContent = "Download for macOS";
  } else if (/Linux/i.test(plat)) {
    if (btn) btn.href = base + "kolshek-linux-x64";
    if (label) label.textContent = "Download for Linux";
  }
  // Windows is the default, no change needed
})();

// ── Footer year ──────────────────────────────────────────────
var yearEl = document.getElementById("footer-year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ── Fetch latest release version from GitHub ─────────────────
(function () {
  var REPO = "DaveDushi/kolshek";
  var CACHE_KEY = "kolshek-release";
  var CACHE_TTL = 1000 * 60 * 30;

  function applyVersion(tag) {
    var heroEl = document.getElementById("hero-version");
    var metaEl = document.getElementById("dl-auto-meta");
    var footerEl = document.getElementById("footer-version");
    if (heroEl) heroEl.textContent = tag;
    if (metaEl) metaEl.textContent = tag;
    if (footerEl) footerEl.textContent = "KolShek " + tag;
  }

  function applyDownloads(count) {
    var el = document.getElementById("hero-downloads");
    if (el) el.textContent = count >= 1000 ? (count / 1000).toFixed(1) + "k" : String(count);
  }

  function applyStars(count) {
    var el = document.getElementById("gh-stars");
    if (el) el.textContent = count >= 1000 ? (count / 1000).toFixed(1) + "k" : String(count);
  }

  try {
    var cached = JSON.parse(sessionStorage.getItem(CACHE_KEY));
    if (cached && cached.stars != null && Date.now() - cached.ts < CACHE_TTL) {
      applyVersion(cached.tag);
      if (cached.downloads != null) applyDownloads(cached.downloads);
      if (cached.stars != null) applyStars(cached.stars);
      return;
    }
  } catch (e) {}

  // Fetch releases + repo info in parallel
  Promise.all([
    fetch("https://api.github.com/repos/" + REPO + "/releases").then(function (r) { return r.json(); }),
    fetch("https://api.github.com/repos/" + REPO).then(function (r) { return r.json(); })
  ])
    .then(function (results) {
      var releases = results[0];
      var repo = results[1];
      var stars = repo.stargazers_count || 0;
      applyStars(stars);
      if (!Array.isArray(releases) || !releases.length) return;
      var latest = releases[0];
      if (latest.tag_name) applyVersion(latest.tag_name);
      var total = 0;
      releases.forEach(function (rel) {
        if (rel.assets) rel.assets.forEach(function (a) { total += a.download_count || 0; });
      });
      applyDownloads(total);
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ tag: latest.tag_name, downloads: total, stars: stars, ts: Date.now() }));
      } catch (e) {}
    })
    .catch(function () {});
})();
