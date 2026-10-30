(function () {
  'use strict';

  var carousel = document.querySelector('[data-reviews-carousel]');
  if (!carousel) return;

  var track = carousel.querySelector('.reviews-carousel__track');
  var slides = carousel.querySelectorAll('.reviews-carousel__slide');
  var dotsContainer = carousel.querySelector('.carousel-dots');
  var prevBtn = carousel.querySelector('.carousel-arrow--prev');
  var nextBtn = carousel.querySelector('.carousel-arrow--next');

  if (!track || !slides.length) return;

  var index = 0;
  var perView;   // seeded by recalc() before first use (was a dead pre-recalc init — LOW-03)
  var maxIndex;  // seeded by recalc() before first use (was a dead pre-recalc init — LOW-03)
  var dots = []; // built once; updateDots() toggles class only (never rebuilds)

  function getPerView() {
    return window.innerWidth >= 768 ? 2 : 1;
  }

  // Build the dot buttons ONCE. Rebuilt only when the page count actually changes
  // (recalc on resize) — never on a per-navigation path, so the dot the user just
  // activated is never destroyed (A11Y-09 / WCAG 2.4.3, audit-verified).
  function buildDots() {
    if (!dotsContainer) return;
    while (dotsContainer.firstChild) { dotsContainer.removeChild(dotsContainer.firstChild); }
    dots = [];
    var pages = maxIndex + 1;
    for (var i = 0; i < pages; i++) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'carousel-dot';
      dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
      dot.addEventListener('click', function (j) {
        return function () { goTo(j); };
      }(i));
      dotsContainer.appendChild(dot);
      dots.push(dot);
    }
    updateDots();
  }

  // Toggle the active class ONLY — never rebuild the dots. The activated dot
  // survives and keeps focus (document.activeElement stays on it, not <body>).
  function updateDots() {
    dots.forEach(function (d, i) { d.classList.toggle('is-active', i === index); });
  }

  function goTo(i) {
    index = Math.max(0, Math.min(i, maxIndex));
    var slideWidth = slides[0].getBoundingClientRect().width;
    track.style.transform = 'translateX(-' + (index * slideWidth) + 'px)';
    // Non-focus-stealing arrows: reflect the boundary state via ARIA, not the hard
    // `disabled` property, so a boundary press never blurs the arrow being pressed.
    if (prevBtn) prevBtn.setAttribute('aria-disabled', String(index === 0));
    if (nextBtn) nextBtn.setAttribute('aria-disabled', String(index >= maxIndex));
    updateDots();
  }

  function recalc() {
    perView = getPerView();
    var newMax = Math.max(0, slides.length - perView);
    var countChanged = newMax !== maxIndex;
    maxIndex = newMax;
    if (index > maxIndex) index = maxIndex;
    if (countChanged || !dots.length) buildDots();
    goTo(index);
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', function () { if (index === 0) return; goTo(index - 1); });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', function () { if (index >= maxIndex) return; goTo(index + 1); });
  }

  // Debounce resize to one recalc per animation frame: a drag across the 768px breakpoint
  // fires dozens of resize events, and buildDots() (the only path that can destroy a focused
  // dot) should run at most once per settle, not per pixel. (LOW-03)
  var resizeRaf = null;
  window.addEventListener('resize', function () {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(function () { resizeRaf = null; recalc(); });
  });
  recalc();
})();
