// analytics.js — GA4 loader (shared, loaded on every page).
//
// GO-LIVE: replace the placeholder value on the ID line below with the client's real
// GA4 Measurement ID (e.g. 'G-A1B2C3D4E5'), then redeploy. That is the only edit needed.
//
// The guard below deliberately does NOT compare against the literal placeholder string.
// It tests the placeholder's *shape* (G- followed by nothing but X's), so a global
// find/replace of the placeholder cannot accidentally rewrite the guard and leave a
// condition that is always true — which would silently disable analytics site-wide.
(function () {
  var GA_MEASUREMENT_ID = 'G-TF2C6Q7K2S';

  // Inert until a real ID is set: bail while the value is still a placeholder.
  if (!GA_MEASUREMENT_ID || /^G-X+$/i.test(GA_MEASUREMENT_ID)) return;

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID, { anonymize_ip: true });
})();
