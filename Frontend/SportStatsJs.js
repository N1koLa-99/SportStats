(() => {
  // ===== Helpers
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ===== Year
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ===== Theme toggle (persist)
  const themeToggle = $("#themeToggle");
  const root = document.documentElement;

  const savedTheme = localStorage.getItem("ss_theme");
  if (savedTheme === "light" || savedTheme === "dark") {
    root.setAttribute("data-theme", savedTheme);
  }

  themeToggle?.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem("ss_theme", next);
  });

  // ===== Dropdown (desktop)
  const dropdown = $("[data-dropdown]");
  if (dropdown) {
    const btn = $(".nav__link--btn", dropdown);

    const closeDropdown = () => {
      dropdown.dataset.open = "false";
      btn?.setAttribute("aria-expanded", "false");
    };

    btn?.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = dropdown.dataset.open === "true";
      dropdown.dataset.open = isOpen ? "false" : "true";
      btn.setAttribute("aria-expanded", (!isOpen).toString());
    });

    document.addEventListener("click", closeDropdown);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDropdown();
    });
  }

  // ===== Mobile drawer
  const burger = $("#burger");
  const drawer = $("#drawer");
  const drawerClose = $("#drawerClose");
  const drawerBackdrop = $("#drawerBackdrop");

  const openDrawer = () => {
    if (!drawer) return;
    drawer.dataset.open = "true";
    drawer.setAttribute("aria-hidden", "false");
    burger?.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  };

  const closeDrawer = () => {
    if (!drawer) return;
    drawer.dataset.open = "false";
    drawer.setAttribute("aria-hidden", "true");
    burger?.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  };

  burger?.addEventListener("click", openDrawer);
  drawerClose?.addEventListener("click", closeDrawer);
  drawerBackdrop?.addEventListener("click", closeDrawer);

  $$(".drawer__link").forEach(a => a.addEventListener("click", closeDrawer));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });

  // ===== Smooth scroll
  const scrollToTarget = (hash) => {
    const el = $(hash);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const href = a.getAttribute("href");
    if (!href || href.length < 2) return;
    const target = $(href);
    if (!target) return;

    e.preventDefault();
    closeDrawer();
    scrollToTarget(href);
    history.pushState(null, "", href);
  });

  const hint = $("[data-scroll]");
  hint?.addEventListener("click", () => {
    const sel = hint.getAttribute("data-scroll");
    if (sel) scrollToTarget(sel);
  });

  // ===== HERO VIDEO ROTATOR (crossfade between 2 layers)
  const videoA = $("#heroVideoA");
  const videoB = $("#heroVideoB");
  if (!videoA || !videoB) return;

  // IMPORTANT: filenames from your screenshot. Put these mp4 files next to the HTML.
  const playlist = [
    "3125907-uhd_3840_2160_25fps.mp4",
    "5012392-uhd_3840_2160_25fps.mp4",
    "6540493-uhd_2560_1440_25fps.mp4",
    "8685906-hd_1920_1080_30fps.mp4",
  ];

  const ROTATE_MS = 9500;   // time per clip before switching
  const FADE_MS = 900;      // must match CSS transition

  // Layer state
  let active = videoA;
  let idle = videoB;
  let idx = 0;
  let timer = null;

  const setVideoSource = (vid, src) => {
    // Replace content safely
    vid.pause();
    vid.removeAttribute("src");
    vid.load();
    vid.src = src;
    vid.loop = true;
    vid.muted = true;
    vid.playsInline = true;
    vid.preload = "auto";
  };

  const tryPlay = async (vid) => {
    try {
      await vid.play();
    } catch {
      // Autoplay may be blocked until user interaction; keep silent.
    }
  };

  const swapLayers = () => {
    active.classList.remove("is-active");
    idle.classList.add("is-active");

    const oldActive = active;
    active = idle;
    idle = oldActive;

    // After fade, pause the idle (now hidden) to save CPU
    setTimeout(() => {
      idle.pause();
    }, FADE_MS + 80);
  };

  const preloadAndFadeTo = async (nextSrc) => {
    setVideoSource(idle, nextSrc);

    // Wait until it can render a frame
    await new Promise((resolve) => {
      const onReady = () => {
        idle.removeEventListener("canplay", onReady);
        resolve();
      };
      idle.addEventListener("canplay", onReady, { once: true });

      // Fallback in case event doesn't fire quickly
      setTimeout(resolve, 1200);
    });

    await tryPlay(idle);
    swapLayers();
  };

  const next = async () => {
    idx = (idx + 1) % playlist.length;
    await preloadAndFadeTo(playlist[idx]);
  };

  const start = async () => {
    // init active
    setVideoSource(active, playlist[idx]);
    active.classList.add("is-active");
    await tryPlay(active);

    // preload idle with next clip
    const nextIdx = (idx + 1) % playlist.length;
    setVideoSource(idle, playlist[nextIdx]);
    await tryPlay(idle);
    idle.pause(); // keep preloaded but not playing

    // rotate
    timer = setInterval(() => { next(); }, ROTATE_MS);
  };

  // Start when page is visible; pause when hidden
  const onVisibility = () => {
    if (document.hidden) {
      clearInterval(timer);
      timer = null;
      active.pause();
      idle.pause();
    } else {
      if (!timer) {
        tryPlay(active);
        timer = setInterval(() => { next(); }, ROTATE_MS);
      }
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  // User interaction can unlock autoplay on some browsers
  const unlock = () => {
    tryPlay(active);
    document.removeEventListener("pointerdown", unlock);
    document.removeEventListener("keydown", unlock);
  };
  document.addEventListener("pointerdown", unlock, { once: true });
  document.addEventListener("keydown", unlock, { once: true });

  start();
})();