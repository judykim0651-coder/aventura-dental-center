(function () {
  'use strict';

  var carousel = document.querySelector('[data-hero-carousel]');
  if (!carousel) return;

  var slides = carousel.querySelectorAll('.hero__slide');
  if (slides.length <= 1) {
    if (slides[0]) slides[0].classList.add('is-active');
    return;
  }

  var index = 0;
  var interval = 5000;
  var timer;

  function showSlide(i) {
    slides.forEach(function (slide, idx) {
      slide.classList.toggle('is-active', idx === i);
    });
    index = i;
  }

  function nextSlide() {
    showSlide((index + 1) % slides.length);
  }

  function startAutoplay() {
    timer = setInterval(nextSlide, interval);
  }

  function resetAutoplay() {
    clearInterval(timer);
    startAutoplay();
  }

  showSlide(0);

  // Carousel-local reduced-motion guard: under reduced motion the hero paints
  // slide 0 and never autoplays (no pause button needed — nothing moves).
  // Site-wide prefers-reduced-motion CSS layer stays Phase 7 / A11Y-07.
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { return; }

  // Container semantics
  carousel.setAttribute('aria-roledescription', 'carousel');
  carousel.setAttribute('aria-live', 'off'); /* auto-rotating */
  if (getComputedStyle(carousel).position === 'static') carousel.style.position = 'relative';

  // Pause/play control — position:absolute; z-index:3 escapes the .hero__overlay
  // (z-index:1) / .hero__content (z-index:2) stacking that made hover-pause dead
  // (audit: naive button = RECEIVES_CLICK:false; z-index:3 = RECEIVES_CLICK:true).
  // >=44x44 so Phase 7's target-size pass needs no re-touch (D-04).
  var paused = false;
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'hero__pause';
  btn.setAttribute('aria-label', 'Pause slideshow');
  btn.textContent = '⏸'; // ⏸
  // bottom-LEFT so the 44px pause target never overlaps the right-aligned .hero__social icons
  // (WCAG 2.5.8 target-size — a bottom-right pause collided with the Instagram icon).
  btn.style.cssText = 'position:absolute;left:16px;bottom:16px;z-index:3;width:44px;height:44px;'
    + 'display:flex;align-items:center;justify-content:center;border:0;border-radius:9999px;'
    + 'background:rgba(0,0,0,.55);color:#fff;font-size:18px;line-height:1;cursor:pointer;';
  carousel.appendChild(btn);

  function pauseShow() { clearInterval(timer); paused = true; btn.textContent = '▶'; btn.setAttribute('aria-label', 'Play slideshow'); carousel.setAttribute('aria-live', 'polite'); }
  function playShow() { resetAutoplay(); paused = false; btn.textContent = '⏸'; btn.setAttribute('aria-label', 'Pause slideshow'); carousel.setAttribute('aria-live', 'off'); }
  btn.addEventListener('click', function () { if (paused) playShow(); else pauseShow(); });

  // Pause on keyboard focus entering the hero (replaces the dead hover-pause
  // handlers, which never fired because of the same stacking bug). Guard against
  // the pause button itself: focusing btn (via keyboard Tab or the focus a mouse
  // click delivers on mousedown) must NOT auto-pause, or the very next click/Enter
  // handler — which reads `paused` — would flip straight back to Play, leaving the
  // carousel auto-advancing (the pre-capstone double-toggle: the button appeared to
  // do nothing). Only focus landing elsewhere in the hero auto-pauses; the button's
  // explicit activation is the single source of truth for its own toggle.
  carousel.addEventListener('focusin', function (e) { if (e.target !== btn && !paused) pauseShow(); });

  startAutoplay();
})();
