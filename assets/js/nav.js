(function () {
  'use strict';

  var ctaHeader = document.getElementById('ctaHeader');
  var siteHeader = document.querySelector('.site-header');
  var mobileNav = document.getElementById('mobileNav');
  var mobileToggle = document.querySelector('.nav-mobile-toggle');
  var mobileClose = document.querySelector('.nav-mobile-overlay__close');
  var lastFocused = null;

  function onScroll() {
    var scrolled = window.scrollY > 20;
    if (ctaHeader) {
      ctaHeader.classList.toggle('is-hidden', scrolled);
    }
    if (siteHeader) {
      siteHeader.classList.toggle('nav-at-top', scrolled);
    }
  }

  function openMobileNav() {
    if (mobileNav) {
      lastFocused = document.activeElement;
      mobileNav.classList.add('is-open');
      mobileNav.setAttribute('aria-hidden', 'false');
    }
    if (mobileToggle) {
      mobileToggle.textContent = '✕';
      mobileToggle.setAttribute('aria-label', 'Close menu');
      mobileToggle.setAttribute('aria-expanded', 'true');
    }
    document.body.style.overflow = 'hidden';
    if (mobileNav) {
      var f = mobileNav.querySelectorAll('a[href]');
      if (f.length) f[0].focus();
    }
  }

  function closeMobileNav() {
    if (mobileNav) {
      mobileNav.classList.remove('is-open');
      mobileNav.setAttribute('aria-hidden', 'true');
    }
    if (mobileToggle) {
      mobileToggle.textContent = '☰';
      mobileToggle.setAttribute('aria-label', 'Open menu');
      mobileToggle.setAttribute('aria-expanded', 'false');
    }
    document.body.style.overflow = '';
    // Restore focus to the invariant trigger, not the captured activeElement: the drawer can
    // ONLY be opened by mobileToggle, and on Safari/Firefox a mouse click doesn't focus a
    // button (activeElement stays <body>), which would strand focus. (LOW-01, WCAG 2.4.3)
    if (mobileToggle) mobileToggle.focus();
  }

  function toggleMobileNav() {
    if (mobileNav && mobileNav.classList.contains('is-open')) {
      closeMobileNav();
    } else {
      openMobileNav();
    }
  }

  if (mobileToggle) {
    mobileToggle.setAttribute('aria-controls', 'mobileNav');
    mobileToggle.setAttribute('aria-expanded', 'false');
    mobileToggle.addEventListener('click', toggleMobileNav);
  }
  if (mobileClose) {
    mobileClose.addEventListener('click', closeMobileNav);
  }
  if (mobileNav) {
    mobileNav.addEventListener('click', function (e) {
      if (e.target === mobileNav) closeMobileNav();
    });
    mobileNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeMobileNav);
    });
  }

  document.addEventListener('keydown', function (e) {
    if (!mobileNav || !mobileNav.classList.contains('is-open')) return;
    if (e.key === 'Escape') { closeMobileNav(); return; }
    if (e.key === 'Tab') {
      var f = mobileNav.querySelectorAll('a[href]');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Scroll reveal */
  var animated = document.querySelectorAll('.scroll-animate');
  if (animated.length && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    animated.forEach(function (el) {
      if (el.getBoundingClientRect().height > window.innerHeight) {
        el.classList.add('is-visible');
      } else {
        observer.observe(el);
      }
    });
  } else {
    animated.forEach(function (el) { el.classList.add('is-visible'); });
  }
})();
