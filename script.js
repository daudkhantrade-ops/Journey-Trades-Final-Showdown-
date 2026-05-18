/**
 * Journey Trades — script.js
 * Production-safe vanilla JS
 *
 * Modules:
 *  1. Navbar (transparent → solid on scroll, mobile toggle)
 *  2. Hero Slideshow (robust image loading, production-safe)
 *  3. Scroll Reveal (IntersectionObserver with stagger)
 *  4. Active Nav Link
 *  5. Smooth Scroll
 *  6. Contact Form (validation + async submission + bot protection)
 */

'use strict';

// Track page load time for bot-detection timing check
const PAGE_LOAD_TIME = Date.now();

/* ═══════════════════════════════════════════════════════════
   1. NAVBAR
═══════════════════════════════════════════════════════════ */
(function initNavbar() {
  const nav        = document.getElementById('main-nav');
  const hamburger  = document.getElementById('hamburger');
  const mobileNav  = document.getElementById('mobile-nav');

  if (!nav || !hamburger || !mobileNav) return;

  // Initial state: transparent (overlaid on hero)
  nav.classList.add('nav-transparent');

  // Scroll: swap transparent ↔ solid
  let ticking = false;

  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const solid = window.scrollY > 80;
        nav.classList.toggle('nav-transparent', !solid);
        nav.classList.toggle('nav-solid', solid);
        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // run once on load

  // Hamburger toggle
  // stopPropagation prevents the click from bubbling to the document
  // outside-click handler which would immediately close the menu.
  hamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = hamburger.classList.contains('open');
    toggleMenu(!open);
  });

  // Close on mobile nav link click
  mobileNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => toggleMenu(false));
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target) && !mobileNav.contains(e.target)) {
      toggleMenu(false);
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') toggleMenu(false);
  });

  // Saved scroll position for iOS-safe scroll lock/unlock.
  let _lockY = 0;

  function toggleMenu(open) {
    hamburger.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', String(open));
    mobileNav.classList.toggle('open', open);
    mobileNav.setAttribute('aria-hidden', String(!open));

    if (open) {
      /*
       * iOS SAFARI SCROLL LOCK
       * body.overflow = 'hidden' alone does NOT prevent scroll on iOS Safari.
       * Worse: it makes iOS treat body as a new scroll container, which causes
       * position:fixed elements (our mobile-nav) to be positioned relative to
       * the body container instead of the viewport — so the drawer renders at
       * the wrong coordinates or appears to show links "outside" the menu box.
       *
       * The correct pattern:
       *   1. Save current scroll position.
       *   2. Set body to position:fixed + top: -scrollY (freezes the layout).
       *   3. On close, remove fixed and restore scrollTo(0, savedY).
       */
      _lockY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top      = '-' + _lockY + 'px';
      document.body.style.width    = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top      = '';
      document.body.style.width    = '';
      window.scrollTo(0, _lockY);
    }
  }
})();


/* ═══════════════════════════════════════════════════════════
   2. HERO SLIDESHOW
   Production-safe: uses data-src, pre-loads images, then
   applies background-image only after each image has loaded.
   Falls back gracefully if images 404.
═══════════════════════════════════════════════════════════ */
(function initHeroSlideshow() {
  const slides = Array.from(document.querySelectorAll('.hero-slide'));
  if (slides.length === 0) return;

  let current  = 0;
  let timer    = null;
  const DURATION = 5000;   // ms between transitions
  const PRELOADED = [];    // tracks which indices have loaded

  /**
   * Pre-load an image by src.
   * Resolves with the src string regardless of success/failure.
   */
  function preload(src) {
    return new Promise((resolve) => {
      if (!src) { resolve(null); return; }
      const img = new Image();
      img.onload  = () => resolve(src);
      img.onerror = () => resolve(null); // fail silently, slide stays blank
      img.src = src;
    });
  }

  /**
   * Apply the loaded src as a background-image on the slide element.
   * Uses a very deliberate setAttribute pattern so it works identically
   * on Vercel, GitHub Pages, and local dev regardless of base path.
   */
  function applyBackground(slideEl, src) {
    if (src) {
      slideEl.style.backgroundImage = 'url("' + src + '")';
    }
  }

  /**
   * Activate a slide by index.
   */
  function goToSlide(idx) {
    slides[current].classList.remove('active');
    current = (idx + slides.length) % slides.length;
    slides[current].classList.add('active');
  }

  /**
   * Advance to the next slide.
   */
  function nextSlide() {
    goToSlide(current + 1);
  }

  /**
   * Bootstrap: load all slide images up front, then start the rotation.
   */
  async function bootstrap() {
    // Kick off all pre-loads in parallel
    const loadPromises = slides.map((slideEl, i) => {
      const src = slideEl.getAttribute('data-src') || '';
      return preload(src).then(resolved => {
        applyBackground(slideEl, resolved);
        PRELOADED[i] = !!resolved;
      });
    });

    // Wait for slide 0 specifically before showing anything,
    // then don't block the rest — they'll be ready before the timer fires.
    await loadPromises[0]; // ensures first slide has its image set

    // Mark first slide active
    slides[0].classList.add('active');

    // Start rotation only if there's more than one slide
    if (slides.length > 1) {
      // Finish loading the rest asynchronously
      Promise.all(loadPromises.slice(1)); // no await intentional
      timer = setInterval(nextSlide, DURATION);
    }
  }

  bootstrap();

  // Pause slideshow when tab is not visible (battery / performance)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(timer);
    } else if (slides.length > 1) {
      timer = setInterval(nextSlide, DURATION);
    }
  });
})();


/* ═══════════════════════════════════════════════════════════
   3. SCROLL REVEAL
═══════════════════════════════════════════════════════════ */
(function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;

  // Instant fallback for browsers without IntersectionObserver
  if (!('IntersectionObserver' in window)) {
    els.forEach(el => el.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      const el      = entry.target;
      const parent  = el.parentElement;

      // Calculate stagger index among sibling .reveal elements
      const siblings = parent
        ? Array.from(parent.querySelectorAll('.reveal:not(.visible)'))
        : [];
      const staggerIdx = siblings.indexOf(el);
      const delay = Math.min(staggerIdx * 80, 320); // cap at 320ms

      setTimeout(() => {
        el.classList.add('visible');
      }, delay);

      observer.unobserve(el);
    });
  }, {
    threshold: 0.07,
    rootMargin: '0px 0px -50px 0px'
  });

  els.forEach(el => observer.observe(el));
})();


/* ═══════════════════════════════════════════════════════════
   4. ACTIVE NAV LINK on scroll
═══════════════════════════════════════════════════════════ */
(function initActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');

  if (!sections.length || !navLinks.length) return;

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === '#' + id);
        });
      }
    });
  }, { rootMargin: '-25% 0px -65% 0px' });

  sections.forEach(sec => sectionObserver.observe(sec));
})();


/* ═══════════════════════════════════════════════════════════
   5. SMOOTH SCROLL + MOBILE MENU CLOSE
═══════════════════════════════════════════════════════════ */
(function initSmoothScroll() {
  const navH = () => parseInt(
    getComputedStyle(document.documentElement).getPropertyValue('--nav-h') || '68',
    10
  );

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;

      const target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();

      // Close mobile menu if open
      const hamburger = document.getElementById('hamburger');
      const mobileNav = document.getElementById('mobile-nav');
      if (hamburger && mobileNav && hamburger.classList.contains('open')) {
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        mobileNav.classList.remove('open');
        mobileNav.setAttribute('aria-hidden', 'true');
        // Restore body from iOS-safe fixed lock before scrolling.
        // We read body.style.top to recover the saved scroll position
        // because the smoothScroll module runs in a different closure
        // and doesn't have direct access to the navbar module's _lockY.
        const savedTop = parseInt(document.body.style.top || '0', 10);
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top      = '';
        document.body.style.width    = '';
        if (savedTop !== 0) {
          window.scrollTo(0, -savedTop);
        }
      }

      const top = target.getBoundingClientRect().top + window.scrollY - navH();
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
})();


/* ═══════════════════════════════════════════════════════════
   6. CONTACT FORM — Validation + async submission
═══════════════════════════════════════════════════════════ */
(function initContactForm() {
  const form       = document.getElementById('enquiry-form');
  const submitBtn  = document.getElementById('form-submit-btn');
  const successEl  = document.getElementById('form-success');

  if (!form) return;

  // ── Live validation: clear error as user types ──
  form.querySelectorAll('input, select, textarea').forEach(field => {
    field.addEventListener('input',  () => clearError(field));
    field.addEventListener('change', () => clearError(field));
  });

  // ── Submit ──
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Bot protection: reject submissions under 3 seconds (bots are instant)
    if (Date.now() - PAGE_LOAD_TIME < 3000) {
      return;
    }

    if (!validateForm()) return;

    setLoading(true);

    const formData = new FormData(form);

    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'application/json' }
      });

      if (res.ok) {
        showSuccess();
      } else {
        // FormSubmit may not return JSON — fall back to native submit
        form.submit();
      }
    } catch (_err) {
      // Network failure: fall back to native redirect-based submit
      console.warn('[Journey Trades] Async submit failed — falling back to native.', _err);
      form.submit();
    } finally {
      setLoading(false);
    }
  });

  // ── Helpers ──

  function validateForm() {
    let valid = true;

    form.querySelectorAll('[required]').forEach(field => {
      clearError(field);
      const val = field.value.trim();

      if (!val) {
        showError(field, 'This field is required.');
        valid = false;
      } else if (field.type === 'email' && !isEmail(val)) {
        showError(field, 'Please enter a valid email address.');
        valid = false;
      }
    });

    return valid;
  }

  function showError(field, msg) {
    field.classList.add('invalid');
    const errEl = field.closest('.form-group')?.querySelector('.form-error');
    if (errEl) errEl.textContent = msg;
  }

  function clearError(field) {
    field.classList.remove('invalid');
    const errEl = field.closest('.form-group')?.querySelector('.form-error');
    if (errEl) errEl.textContent = '';
  }

  function setLoading(state) {
    submitBtn.disabled = state;
    submitBtn.classList.toggle('loading', state);
  }

  function showSuccess() {
    form.style.display = 'none';
    if (successEl) {
      successEl.classList.add('visible');
      successEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function isEmail(val) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  }
})();
