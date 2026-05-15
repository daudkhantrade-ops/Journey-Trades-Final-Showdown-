/**
 * Journey Trades — script.js
 * Handles: navbar, mobile menu, hero slideshow,
 *          scroll reveal, form validation + submission
 */

'use strict';

/* ─── NAVBAR ────────────────────────────────────────────── */
const mainNav  = document.getElementById('main-nav');
const hamburger = document.getElementById('hamburger');
const mobileNav = document.getElementById('mobile-nav');

// Sticky shadow on scroll
window.addEventListener('scroll', () => {
  mainNav.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

// Hamburger toggle
hamburger.addEventListener('click', () => {
  const isOpen = mobileNav.classList.contains('open');
  toggleMobileNav(!isOpen);
});

// Close on link click inside mobile nav
mobileNav.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => toggleMobileNav(false));
});

// Close on outside click
document.addEventListener('click', (e) => {
  if (!mainNav.contains(e.target) && !mobileNav.contains(e.target)) {
    toggleMobileNav(false);
  }
});

// Close on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') toggleMobileNav(false);
});

function toggleMobileNav(open) {
  mobileNav.classList.toggle('open', open);
  hamburger.classList.toggle('open', open);
  hamburger.setAttribute('aria-expanded', open);
  mobileNav.setAttribute('aria-hidden', !open);
  // Prevent body scroll when nav is open on mobile
  document.body.style.overflow = open ? 'hidden' : '';
}


/* ─── HERO SLIDESHOW ────────────────────────────────────── */
const slides = document.querySelectorAll('.hero-slide');

if (slides.length > 1) {
  let current = 0;

  function nextSlide() {
    slides[current].classList.remove('active');
    current = (current + 1) % slides.length;
    slides[current].classList.add('active');
  }

  // Start rotation
  setInterval(nextSlide, 4500);
}


/* ─── SCROLL REVEAL ─────────────────────────────────────── */
const revealEls = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window && revealEls.length) {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        // Stagger cards inside the same container
        const siblings = entry.target.parentElement
          ? Array.from(entry.target.parentElement.querySelectorAll('.reveal:not(.visible)'))
          : [];
        const delay = siblings.indexOf(entry.target);
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, Math.min(delay * 70, 280));

        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.08,
    rootMargin: '0px 0px -40px 0px'
  });

  revealEls.forEach(el => revealObserver.observe(el));
} else {
  // Fallback: show all immediately if IntersectionObserver not supported
  revealEls.forEach(el => el.classList.add('visible'));
}


/* ─── FORM HANDLING ─────────────────────────────────────── */
const enquiryForm   = document.getElementById('enquiry-form');
const submitBtn     = document.getElementById('form-submit-btn');
const successMsg    = document.getElementById('form-success');

if (enquiryForm) {
  enquiryForm.addEventListener('submit', handleFormSubmit);
}

async function handleFormSubmit(e) {
  e.preventDefault();

  // Validate
  const isValid = validateForm();
  if (!isValid) return;

  // Loading state
  setSubmitting(true);

  try {
    const formData = new FormData(enquiryForm);

    // Remove the honeypot field from submission to keep it clean
    // (FormSubmit.co handles it server-side but we pass it along)

    const response = await fetch(enquiryForm.action, {
      method: 'POST',
      body: formData,
      headers: { 'Accept': 'application/json' }
    });

    if (response.ok) {
      showSuccess();
    } else {
      // Non-2xx: still show success (FormSubmit may redirect on HTML submit)
      // Fallback: try the redirect method
      enquiryForm.submit();
    }
  } catch (err) {
    // Network error fallback: submit normally and let FormSubmit handle it
    console.warn('Fetch submit failed, falling back to native submit.', err);
    enquiryForm.submit();
  } finally {
    setSubmitting(false);
  }
}

function validateForm() {
  const requiredFields = enquiryForm.querySelectorAll('[required]');
  let valid = true;

  requiredFields.forEach(field => {
    clearError(field);

    if (!field.value.trim()) {
      showError(field, 'This field is required.');
      valid = false;
    } else if (field.type === 'email' && !isValidEmail(field.value)) {
      showError(field, 'Please enter a valid email address.');
      valid = false;
    }
  });

  return valid;
}

function showError(field, message) {
  field.classList.add('invalid');
  const errEl = field.closest('.form-group')?.querySelector('.form-error');
  if (errEl) errEl.textContent = message;
}

function clearError(field) {
  field.classList.remove('invalid');
  const errEl = field.closest('.form-group')?.querySelector('.form-error');
  if (errEl) errEl.textContent = '';
}

// Clear errors on input
enquiryForm?.querySelectorAll('input, select, textarea').forEach(field => {
  field.addEventListener('input', () => clearError(field));
  field.addEventListener('change', () => clearError(field));
});

function setSubmitting(state) {
  submitBtn.disabled = state;
  submitBtn.classList.toggle('loading', state);
}

function showSuccess() {
  enquiryForm.style.display = 'none';
  successMsg.classList.add('visible');
  successMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}


/* ─── ACTIVE NAV LINK on scroll ─────────────────────────── */
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a');

if (sections.length && navLinks.length) {
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        navLinks.forEach(link => {
          link.classList.toggle(
            'active',
            link.getAttribute('href') === `#${id}`
          );
        });
      }
    });
  }, {
    rootMargin: '-30% 0px -60% 0px'
  });

  sections.forEach(sec => sectionObserver.observe(sec));
}


/* ─── SMOOTH SCROLL POLYFILL ────────────────────────────── */
// Already handled by CSS scroll-behavior: smooth
// But ensure nav links close mobile menu
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const targetId = this.getAttribute('href');
    if (targetId === '#') return;

    const target = document.querySelector(targetId);
    if (target) {
      e.preventDefault();
      toggleMobileNav(false);
      const offset = parseInt(getComputedStyle(document.documentElement)
        .getPropertyValue('--nav-h') || 64);
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});
