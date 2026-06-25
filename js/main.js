/* ============================================================
   HORNIÐ — interactions
   Lenis (smooth scroll) + GSAP ScrollTrigger
   ============================================================ */
(function () {
  "use strict";

  // always start at the very top on load / refresh
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.scrollTo(0, 0);
  // belt-and-suspenders: re-assert top once the browser has finished loading
  // (overrides any scroll the browser tries to restore on refresh)
  window.addEventListener("load", () => {
    const toTop = () => {
      window.scrollTo(0, 0);
      if (window.__lenis) window.__lenis.scrollTo(0, { immediate: true });
    };
    toTop();
    requestAnimationFrame(toTop);
    setTimeout(toTop, 80);
  });

  const html = document.documentElement;
  const body = document.body;
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const hasGSAP = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  const hasLenis = typeof window.Lenis !== "undefined";

  /* ---- Graceful fallback: if no animation libs, reveal everything ---- */
  if (!hasGSAP || prefersReduced) {
    html.classList.add("anim-off");
  }

  /* =========================================================
     i18n  (IS default, EN via [data-en]) — innerHTML swap
     ========================================================= */
  const I18N = {
    current: "is",
    init() {
      document.querySelectorAll("[data-en]").forEach((el) => { el.dataset.is = el.innerHTML; });
      let saved = "is";
      try { saved = localStorage.getItem("hornid-lang") || "is"; } catch (e) {}
      this.apply(saved);
      document.querySelectorAll("[data-lang-btn]").forEach((b) => {
        b.addEventListener("click", () => this.toggle());
      });
    },
    apply(lang) {
      this.current = lang;
      document.querySelectorAll("[data-en]").forEach((el) => {
        el.innerHTML = lang === "en" ? el.dataset.en : el.dataset.is;
      });
      html.lang = lang;
      document.querySelectorAll("[data-lang-btn]").forEach((b) => { b.textContent = lang === "en" ? "IS" : "EN"; });
      try { localStorage.setItem("hornid-lang", lang); } catch (e) {}
    },
    toggle() {
      this.apply(this.current === "en" ? "is" : "en");
      if (window.__refreshMenuTag) window.__refreshMenuTag();
      if (hasGSAP && window.ScrollTrigger) window.ScrollTrigger.refresh();
    },
  };

  /* =========================================================
     PRELOADER
     ========================================================= */
  const loader = document.getElementById("loader");
  const loaderFill = document.getElementById("loaderFill");

  function finishLoader(then) {
    if (!loader) { then && then(); return; }
    loader.classList.add("loader--done");
    if (hasGSAP && !prefersReduced) {
      window.gsap.to(loader, {
        yPercent: -100, duration: 1.0, ease: "expo.inOut",
        onComplete: () => {
          loader.style.display = "none"; then && then();
          if (window.__hardRefresh) window.__hardRefresh();
        }
      });
    } else {
      loader.style.display = "none";
      then && then();
      if (window.__hardRefresh) window.__hardRefresh();
    }
  }

  /* =========================================================
     LENIS smooth scroll
     ========================================================= */
  let lenis = null;
  function initLenis() {
    if (!hasLenis || prefersReduced) return;
    lenis = new window.Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      lerp: 0.09,
    });
    window.__lenis = lenis;
    lenis.scrollTo(0, { immediate: true });

    if (hasGSAP) {
      lenis.on("scroll", window.ScrollTrigger.update);
      window.gsap.ticker.add((time) => lenis.raf(time * 1000));
      window.gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }

  function scrollTo(target) {
    if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.3 });
    else {
      const el = typeof target === "string" ? document.querySelector(target) : target;
      el && el.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth" });
    }
  }

  /* =========================================================
     HEADER state + nav
     ========================================================= */
  function initHeader() {
    const header = document.getElementById("header");
    const hero = document.getElementById("hero");
    const burger = document.getElementById("burger");

    // solid header after hero
    const setSolid = () => {
      header.classList.toggle("header--solid", window.scrollY > window.innerHeight * 0.92);
    };
    setSolid();
    window.addEventListener("scroll", setSolid, { passive: true });

    // mobile menu
    function closeNav() {
      body.classList.remove("nav-open");
      burger.setAttribute("aria-expanded", "false");
      if (lenis) lenis.start();
    }
    burger && burger.addEventListener("click", () => {
      const open = body.classList.toggle("nav-open");
      burger.setAttribute("aria-expanded", String(open));
      if (lenis) open ? lenis.stop() : lenis.start();
    });

    // smooth-scroll links
    document.querySelectorAll("[data-link]").forEach((a) => {
      a.addEventListener("click", (e) => {
        const id = a.getAttribute("href");
        if (id && id.startsWith("#")) {
          e.preventDefault();
          if (body.classList.contains("nav-open")) closeNav();
          // wait a tick so overlay can begin closing
          setTimeout(() => scrollTo(id), body.classList.contains("nav-open") ? 0 : 0);
        }
      });
    });
  }

  /* =========================================================
     GSAP animations
     ========================================================= */
  function initAnimations() {
    if (!hasGSAP || prefersReduced) return;
    const gsap = window.gsap;
    const ST = window.ScrollTrigger;
    gsap.registerPlugin(ST);

    /* ---- HERO intro (paused; played when loader lifts) ---- */
    const heroTl = gsap.timeline({ paused: true });
    heroTl
      .to(".hero__eyebrow span", { y: 0, opacity: 1, duration: 0.9, ease: "expo.out" })
      .to(".hero__title .line > span", { y: 0, duration: 1.15, ease: "expo.out", stagger: 0.12 }, "-=0.6")
      .fromTo(".hero__sub span", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: "expo.out" }, "-=0.7")
      .fromTo(".hero__cta", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: "expo.out" }, "-=0.7");

    // expose so loader can trigger
    window.__heroTl = heroTl;

    /* ---- generic line reveals on scroll ---- */
    gsap.utils.toArray(".section__title .line > span, .about__title .line > span, .book__title .line > span")
      .forEach((el) => {
        gsap.to(el, {
          y: 0, duration: 1.1, ease: "expo.out",
          scrollTrigger: { trigger: el, start: "top 88%" },
        });
      });

    /* ---- eyebrows + .reveal fade-up ---- */
    gsap.utils.toArray(".eyebrow span").forEach((el) => {
      gsap.fromTo(el, { y: 24 }, {
        y: 0, duration: 0.9, ease: "expo.out",
        scrollTrigger: { trigger: el, start: "top 92%" },
      });
    });
    gsap.utils.toArray(".reveal").forEach((el) => {
      gsap.fromTo(el, { y: 28, opacity: 0 }, {
        y: 0, opacity: 1, duration: 1, ease: "expo.out",
        scrollTrigger: { trigger: el, start: "top 90%" },
      });
    });
    gsap.utils.toArray(".about__p span").forEach((el) => {
      gsap.fromTo(el, { y: 26, opacity: 0 }, {
        y: 0, opacity: 1, duration: 1, ease: "expo.out",
        scrollTrigger: { trigger: el, start: "top 90%" },
      });
    });

    /* ---- menu items stagger per category ---- */
    gsap.utils.toArray(".menu__cat").forEach((cat) => {
      gsap.to(cat.querySelectorAll(".menu__item"), {
        y: 0, opacity: 1, duration: 0.8, ease: "expo.out", stagger: 0.08,
        scrollTrigger: { trigger: cat, start: "top 85%" },
      });
    });

    /* ---- menu sticky image swap (category -> photo) ---- */
    const visualImgs = gsap.utils.toArray(".menu__img");
    const visualTag = document.getElementById("menuVisualTag");
    const CAT_IMG = {
      supur: "h-21381", forrettir: "h-21092", salot: "salad",
      pizza: "h-21405", pasta: "h-21223", fiskur: "fish",
      kjot: "meat", eftir: "dessert", barna: "h-21223", drykkir: "h-21892",
    };
    let activeCatEl = null;
    function setActiveCat(catEl) {
      activeCatEl = catEl;
      const key = CAT_IMG[catEl.dataset.cat] || "h-21092";
      visualImgs.forEach((img) => img.classList.toggle("is-active", img.dataset.img === key));
      const title = catEl.querySelector(".menu__cat-title");
      if (visualTag && title) visualTag.textContent = title.textContent;
    }
    // keep the floating tag label in sync when language changes
    window.__refreshMenuTag = () => {
      if (visualTag && activeCatEl) {
        const t = activeCatEl.querySelector(".menu__cat-title");
        if (t) visualTag.textContent = t.textContent;
      }
    };
    gsap.utils.toArray(".menu__cat").forEach((cat) => {
      ST.create({
        trigger: cat, start: "top center", end: "bottom center",
        onEnter: () => setActiveCat(cat),
        onEnterBack: () => setActiveCat(cat),
      });
    });

    /* ---- parallax media ---- */
    gsap.utils.toArray("[data-parallax]").forEach((el) => {
      const amt = parseFloat(el.dataset.parallax) || 0.15;
      gsap.fromTo(el, { yPercent: -amt * 60 }, {
        yPercent: amt * 60, ease: "none",
        scrollTrigger: { trigger: el.closest("section") || el, start: "top bottom", end: "bottom top", scrub: true },
      });
    });

    /* ---- HERO: scroll-scrubbed video (fly-in), then menu pops up ---- */
    const heroVideo = document.getElementById("heroVideo");
    const heroEl = document.querySelector(".hero");
    if (heroVideo && heroEl) {
      let vidDur = 0, wantTime = 0, seeking = false;
      const readDur = () => { vidDur = heroVideo.duration || 10; };
      if (heroVideo.readyState >= 1) readDur();
      heroVideo.addEventListener("loadedmetadata", readDur);
      heroVideo.pause();

      // iOS needs one play/pause to render seeked frames
      let primed = false;
      const prime = () => {
        if (primed) return; primed = true;
        const p = heroVideo.play();
        if (p && p.then) p.then(() => heroVideo.pause()).catch(() => {});
      };
      ["touchstart", "wheel", "pointerdown"].forEach((ev) =>
        window.addEventListener(ev, prime, { once: true, passive: true }));

      // Seek toward the latest target, one seek at a time; re-pump on 'seeked'
      // so the final position is never dropped (smooth + never stacks seeks).
      function pumpVideo() {
        if (seeking || !vidDur) return;
        if (Math.abs(wantTime - heroVideo.currentTime) < 0.033) return;
        seeking = true;
        try { heroVideo.currentTime = wantTime; } catch (e) { seeking = false; }
      }
      heroVideo.addEventListener("seeked", () => { seeking = false; pumpVideo(); });

      // Drive the hero directly from scroll position (robust — no ScrollTrigger
      // measurement needed; hero is a fixed 300vh, so progress = scrollY / range).
      const heroContent = document.querySelector(".hero__content");
      const heroCue = document.querySelector(".hero__scroll");
      const heroVeil = document.querySelector(".hero__veil");
      function onHeroScroll() {
        const vh = window.innerHeight;
        const range = heroEl.offsetHeight - vh;
        if (range <= 0) return;
        const p = Math.max(0, Math.min(window.scrollY / range, 1));
        // video finishes right as the menu begins rising over the hero
        const vEnd = Math.max(0.35, 1 - vh / range);
        wantTime = Math.min(p / vEnd, 1) * (vidDur || 10);
        pumpVideo();
        const fade = Math.min(p / 0.2, 1);
        if (heroContent) {
          heroContent.style.opacity = String(1 - fade);
          heroContent.style.transform = "translateY(" + (-40 * fade) + "px)";
        }
        if (heroCue) heroCue.style.opacity = String(1 - fade);
        if (heroVeil) heroVeil.style.opacity = String(1 - Math.min(p / 0.32, 1) * 0.8);
      }
      if (window.__lenis) window.__lenis.on("scroll", onHeroScroll);
      window.addEventListener("scroll", onHeroScroll, { passive: true });
      onHeroScroll();
    }

    /* ---- about big number drift + reveal image ---- */
    gsap.to(".about__bignum .reveal-num", {
      xPercent: -8, ease: "none",
      scrollTrigger: { trigger: ".about", start: "top bottom", end: "bottom top", scrub: true },
    });
    gsap.utils.toArray(".reveal-img").forEach((el) => {
      gsap.to(el, {
        clipPath: "inset(0% 0 0 0)", duration: 1.3, ease: "expo.out",
        scrollTrigger: { trigger: el, start: "top 80%" },
      });
    });

    /* ---- GALLERY horizontal pin ---- */
    const track = document.getElementById("galleryTrack");
    const pin = document.getElementById("galleryPin");
    const progress = document.getElementById("galleryProgress");
    if (track && pin) {
      const getScrollDist = () => track.scrollWidth - window.innerWidth + 80;
      let dist = getScrollDist();
      gsap.to(track, {
        x: () => -getScrollDist(),
        ease: "none",
        scrollTrigger: {
          trigger: ".gallery",
          start: "top top",
          end: () => "+=" + getScrollDist(),
          scrub: 1,
          pin: pin,
          invalidateOnRefresh: true,
          onUpdate: (self) => { if (progress) progress.style.width = (self.progress * 100) + "%"; },
        },
      });
    }

    /* ---- MARQUEE infinite + velocity ---- */
    const marquee = document.getElementById("marquee");
    if (marquee) {
      const mq = gsap.to(marquee, { xPercent: -50, duration: 28, ease: "none", repeat: -1 });
      if (lenis) {
        let to;
        lenis.on("scroll", ({ velocity }) => {
          const v = Math.min(Math.abs(velocity) / 8, 6);
          mq.timeScale(1 + v);
          clearTimeout(to);
          to = setTimeout(() => mq.timeScale(1), 120);
        });
      }
    }

    // Refresh measurements after layout settles (fonts, images, 300vh hero,
    // loader lift). Created triggers can mis-measure if computed too early.
    const hardRefresh = () => {
      try { if (window.__lenis) window.__lenis.resize(); } catch (e) {}
      ST.refresh();
    };
    window.__hardRefresh = hardRefresh;
    hardRefresh();
    window.addEventListener("load", hardRefresh);
    [500, 1200, 2200, 3200].forEach((t) => setTimeout(hardRefresh, t));
    // first real interaction settles any remaining mis-measured triggers
    ["wheel", "touchmove", "keydown"].forEach((ev) =>
      window.addEventListener(ev, hardRefresh, { once: true, passive: true }));
  }

  /* =========================================================
     BOOKING form (front-end only)
     ========================================================= */
  function initForm() {
    const form = document.getElementById("bookForm");
    const note = document.getElementById("bookNote");
    if (!form) return;
    const btn = form.querySelector('button[type="submit"]');
    // FormSubmit.co forwards the booking straight to the inbox — no backend, no mail app.
    const ENDPOINT = "https://formsubmit.co/ajax/hornid@hornid.is";

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const name = (data.get("name") || "").toString().trim();
      const phone = (data.get("phone") || "").toString().trim();
      const en = I18N.current === "en";
      if (!name || !phone) {
        note.style.color = "var(--terracotta)";
        note.textContent = en ? "Please enter your name and phone number." : "Vinsamlegast fylltu út nafn og símanúmer.";
        return;
      }
      const payload = {
        _subject: (en ? "Table booking — " : "Borðabókun — ") + name,
        _template: "table",
        _captcha: "false",
        Nafn: name,
        Sími: phone,
        Dagsetning: data.get("date") || "—",
        Tími: data.get("time") || "—",
        Fjöldi: data.get("guests") || "—",
      };
      note.style.color = "var(--ink)";
      note.textContent = en ? "Sending…" : "Sendi bókun…";
      if (btn) btn.disabled = true;
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || String(json.success) !== "true") throw new Error(json.message || "status " + res.status);
        note.style.color = "var(--ink)";
        note.textContent = en
          ? `Thank you ${name}! Your booking has been sent — we'll confirm by phone (${phone}).`
          : `Takk ${name}! Bókunin þín hefur verið send — við staðfestum símleiðis (${phone}).`;
        form.reset();
        const t = form.querySelector("#bf-time"); if (t) t.value = "19:00";
      } catch (err) {
        note.style.color = "var(--terracotta)";
        note.textContent = en
          ? "Couldn't send right now — please call us at +354 551 3340."
          : "Tókst ekki að senda í augnablikinu — vinsamlegast hringdu í +354 551 3340.";
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }

  /* =========================================================
     BOOT
     ========================================================= */
  function boot() {
    window.scrollTo(0, 0);
    I18N.init();
    initLenis();
    initHeader();
    initForm();
    initAnimations();
  }

  // run loader fill, then boot/reveal
  window.addEventListener("load", () => {
    if (loaderFill && hasGSAP && !prefersReduced) {
      window.gsap.fromTo(loaderFill, { width: "0%" }, {
        width: "100%", duration: 0.9, ease: "power2.inOut",
        onComplete: () => finishLoader(() => { window.__heroTl && window.__heroTl.play(0); }),
      });
    } else {
      finishLoader();
    }
  });

  // boot immediately (animations are paused/scroll-driven; hero tl auto-plays with delay)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // safety: if window load never fires within 2.5s, force-hide loader + play hero
  setTimeout(() => {
    if (loader && loader.style.display !== "none") {
      finishLoader(() => { window.__heroTl && window.__heroTl.play(0); });
    }
  }, 2500);
})();
