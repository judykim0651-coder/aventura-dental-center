(function () {
  'use strict';

  function formatValue(num, prefix, suffix) {
    var formatted;
    if (num % 1 !== 0) {
      formatted = num.toFixed(1);
    } else {
      var n = Math.floor(num);
      formatted = n >= 1000 ? n.toLocaleString() : String(n);
    }
    return (prefix || '') + formatted + (suffix || '');
  }

  document.querySelectorAll('[data-stat-number]').forEach(function (el, index) {
    var target = parseFloat(el.getAttribute('data-stat-number'));
    var prefix = el.getAttribute('data-stat-prefix') || '';
    var suffix = el.getAttribute('data-stat-suffix') || '';
    var animated = false;

    // Reduced motion (A11Y-07): users who asked motion to stop should see the
    // FINAL numbers, not the "0" shipped in the HTML. SET the final formatted
    // value and skip the count-up — NOT a bare return (which would leave "0").
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = formatValue(target, prefix, suffix);
      return;
    }

    // The HTML now ships the REAL final number as a no-JS / crawler fallback
    // (so bots and AI assistants don't read "0 Years Experience"). For motion
    // users, reset to the start value here so the count-up still animates from 0.
    el.textContent = formatValue(0, prefix, suffix);

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || animated) return;
        animated = true;

        var duration = 1500;
        var startTime = Date.now();

        function animate() {
          var elapsed = Date.now() - startTime;
          var progress = Math.min(elapsed / duration, 1);
          var easeOut = 1 - Math.pow(1 - progress, 3);
          el.textContent = formatValue(target * easeOut, prefix, suffix);
          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            el.textContent = formatValue(target, prefix, suffix);
          }
        }

        setTimeout(function () { requestAnimationFrame(animate); }, index * 80);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.3, rootMargin: '0px 0px -50px 0px' });

    observer.observe(el);
  });
})();
