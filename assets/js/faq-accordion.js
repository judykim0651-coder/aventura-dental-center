(function () {
  'use strict';

  var accordion = document.querySelector('[data-faq-accordion]');
  if (!accordion) return;

  var items = accordion.querySelectorAll('.faq-item');

  items.forEach(function (item, idx) {
    var trigger = item.querySelector('.faq-trigger');
    if (!trigger) return;

    if (idx === 0) { item.classList.add('is-open'); trigger.setAttribute('aria-expanded', 'true'); }
    else { trigger.setAttribute('aria-expanded', 'false'); }

    trigger.addEventListener('click', function () {
      var wasOpen = item.classList.contains('is-open');
      items.forEach(function (other) {
        other.classList.remove('is-open');
        var ot = other.querySelector('.faq-trigger');
        if (ot) ot.setAttribute('aria-expanded', 'false');   // null guard the finder omitted
      });
      if (!wasOpen) { item.classList.add('is-open'); trigger.setAttribute('aria-expanded', 'true'); }
    });
  });
})();
