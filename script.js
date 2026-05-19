/**
 * Journey Trades — script.js  v2
 * Production-safe vanilla JS
 *
 * FIXES v2:
 *  - initNavbar: backdrop div injected via JS (no HTML change required),
 *    wired to toggleMenu so outside-tap closes the menu on mobile.
 *  - toggleMenu now manages backdrop visibility + aria states in one place.
 *  - Module-level _closeNav exposes toggleMenu(false) to sibling closures
 *    without a global variable or tight coupling.
 *  - initSmoothScroll: replaced duplicated manual close logic with _closeNav()
 *    so backdrop + scroll-lock are always cleaned up together.
 *  - initHeroSlideshow: guard against rapid visibilitychange re-entrancy.
 *
 * Modules:
 *  1. Navbar (transparent → solid on scroll, mobile toggle + backdrop)
 *  2. Hero Slideshow (robust image loading, production-safe)
 *  3. Scroll Reveal (IntersectionObserver with stagger)
 *  4. Active Nav Link
 *  5. Smooth Scroll
 *  6. Contact Form (validation + async submission + bot protection)
 */

'use strict';

// Track page load time for bot-detection timing check
const PAGE_LOAD_TIME = Date.now();

/*
 * Module-level shared close function.
 * Set by initNavbar once it runs. Used by initSmoothScroll so both modules
 * share the same close path without accessing each other's inner scope.
 */
let _closeNav = null;


/* ═══════════════════════════════════════════════════════════
   1. NAVBAR
═══════════════════════════════════════════════════════════ */
(function initNavbar() {
  const nav       = document.getElementById('main-nav');
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobile-nav');

  if (!nav || !hamburger || !mobileNav) return;

  // ── Create and inject the backdrop overlay ──────────────
  // We create it in JS so the HTML doesn't need a new element.
  // Backdrop sits between nav (z:100) and mobile-nav (z:99).
  const backdrop = document.createElement('div');
  backdrop.id        = 'nav-backdrop';
  backdrop.className = 'nav-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  // Insert right before mobile-nav in the DOM so stacking order is correct
  mobileNav.parentNode.insertBefore(backdrop, mobileNav);

  // ── Initial state: transparent over hero ────────────────
  nav.classList.add('nav-transparent');

  // ── Scroll: transparent ↔ solid ─────────────────────────
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
  onScroll();

  // ── Saved scroll Y for iOS-safe scroll lock ──────────────
  let _lockY = 0;

  // ── Core toggle function ─────────────────────────────────
  // Single source of truth for all open/close actions.
  function toggleMenu(open) {
    // Hamburger icon animation
    hamburger.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', String(open));

    // Mobile nav panel
    mobileNav.classList.toggle('open', open);
    mobileNav.setAttribute('aria-hidden', String(!open));

    // Backdrop — fade in/out
    backdrop.classList.toggle('open', open);

    if (open) {
      /*
       * iOS SAFARI SCROLL LOCK
       * body.overflow:hidden alone does NOT stop scroll on iOS Safari —
       * it makes the body a scroll container which mis-positions fixed
       * elements. Correct pattern: save Y → body fixed at -Y → restore.
       */
      _lockY = window.scrollY;
      document.body.style.overflow  = 'hidden';
      document.body.style.position  = 'fixed';
      document.body.style.top       = '-' + _lockY + 'px';
      document.body.style.width     = '100%';
    } else {
      document.body.style.overflow  = '';
      document.body.style.position  = '';
      document.body.style.top       = '';
      document.body.style.width     = '';
      window.scrollTo(0, _lockY);
    }
  }

  // Expose close function to sibling closures
  _closeNav = () => toggleMenu(false);

  // ── Event wiring ─────────────────────────────────────────

  // Hamburger button — stopPropagation prevents the document click
  // handler below from immediately closing the menu on the same event.
  hamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu(!hamburger.classList.contains('open'));
  });

  // Backdrop tap — closes menu (primary UX fix)
  backdrop.addEventListener('click', () => toggleMenu(false));

  // Links inside mobile nav
  mobileNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => toggleMenu(false));
  });

  // Outside click (desktop safety net — backdrop already handles mobile)
  document.addEventListener('click', (e) => {
    if (
      hamburger.classList.contains('open') &&
      !nav.contains(e.target) &&
      !mobileNav.contains(e.target)
    ) {
      toggleMenu(false);
    }
  });

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && hamburger.classList.contains('open')) {
      toggleMenu(false);
      hamburger.focus(); // return focus to trigger for a11y
    }
  });
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
  const DURATION  = 5000;
  const PRELOADED = [];

  function preload(src) {
    return new Promise((resolve) => {
      if (!src) { resolve(null); return; }
      const img   = new Image();
      img.onload  = () => resolve(src);
      img.onerror = () => resolve(null);
      img.src     = src;
    });
  }

  function applyBackground(slideEl, src) {
    if (src) slideEl.style.backgroundImage = 'url("' + src + '")';
  }

  function goToSlide(idx) {
    slides[current].classList.remove('active');
    current = (idx + slides.length) % slides.length;
    slides[current].classList.add('active');
  }

  function nextSlide() { goToSlide(current + 1); }

  function startTimer() {
    if (!timer && slides.length > 1) {
      timer = setInterval(nextSlide, DURATION);
    }
  }

  function stopTimer() {
    clearInterval(timer);
    timer = null;
  }

  async function bootstrap() {
    const loadPromises = slides.map((slideEl, i) => {
      const src = slideEl.getAttribute('data-src') || '';
      return preload(src).then(resolved => {
        applyBackground(slideEl, resolved);
        PRELOADED[i] = !!resolved;
      });
    });

    await loadPromises[0];
    slides[0].classList.add('active');

    if (slides.length > 1) {
      Promise.all(loadPromises.slice(1));
      startTimer();
    }
  }

  bootstrap();

  // Pause when tab is hidden — prevents battery drain and
  // guards against re-entrancy if visibilitychange fires rapidly
  document.addEventListener('visibilitychange', () => {
    document.hidden ? stopTimer() : startTimer();
  });
})();


/* ═══════════════════════════════════════════════════════════
   3. SCROLL REVEAL
═══════════════════════════════════════════════════════════ */
(function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;

  if (!('IntersectionObserver' in window)) {
    els.forEach(el => el.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      const el       = entry.target;
      const siblings = el.parentElement
        ? Array.from(el.parentElement.querySelectorAll('.reveal:not(.visible)'))
        : [];
      const delay = Math.min(siblings.indexOf(el) * 80, 320);

      setTimeout(() => el.classList.add('visible'), delay);
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

      /*
       * FIX: use _closeNav() instead of manually removing classes.
       * This ensures the backdrop, body scroll-lock, and all aria
       * attributes are cleaned up via the single toggleMenu(false) path.
       */
      if (_closeNav) _closeNav();

      // Small delay lets iOS finish the body position:fixed restore
      // before we attempt scrollTo, preventing a jump artefact.
      setTimeout(() => {
        const top = target.getBoundingClientRect().top + window.scrollY - navH();
        window.scrollTo({ top, behavior: 'smooth' });
      }, 10);
    });
  });
})();


/* ═══════════════════════════════════════════════════════════
   6. CONTACT FORM — Validation + async submission
═══════════════════════════════════════════════════════════ */
(function initContactForm() {
  const form      = document.getElementById('enquiry-form');
  const submitBtn = document.getElementById('form-submit-btn');
  const successEl = document.getElementById('form-success');

  if (!form) return;

  // Live validation: clear error as user types
  form.querySelectorAll('input, select, textarea').forEach(field => {
    field.addEventListener('input',  () => clearError(field));
    field.addEventListener('change', () => clearError(field));
  });

  // Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Bot protection: reject submissions faster than 3 seconds
    if (Date.now() - PAGE_LOAD_TIME < 3000) return;

    if (!validateForm()) return;

    setLoading(true);

    try {
      const res = await fetch(form.action, {
        method:  'POST',
        body:    new FormData(form),
        headers: { 'Accept': 'application/json' }
      });

      if (res.ok) {
        showSuccess();
      } else {
        form.submit(); // FormSubmit redirect fallback
      }
    } catch (_err) {
      console.warn('[Journey Trades] Async submit failed — falling back to native.', _err);
      form.submit();
    } finally {
      setLoading(false);
    }
  });

  // ── Helpers ──────────────────────────────────────────────

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
