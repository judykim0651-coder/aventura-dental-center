/* Contact form — validates client-side, then submits.
   Primary path: Web3Forms (free, no backend) delivers each submission straight to
   the practice inbox and the visitor sees an inline "thank you" without leaving the page.
   Fallback: if no Web3Forms key is set yet, or the request fails, it opens the visitor's
   email app addressed to the practice (mailto) so an inquiry is never lost. */
(function () {
  'use strict';
  var RECIPIENT = 'info@aventuradentalcenter.com';

  // GO-LIVE: paste the practice's free Web3Forms access key below, then redeploy.
  // Get one in ~1 min at https://web3forms.com by entering info@aventuradentalcenter.com —
  // the key is emailed instantly and every submission then lands in that inbox.
  // Until a real key is set, the form gracefully falls back to mailto (still works).
  var WEB3FORMS_KEY = 'ed0898b3-cad9-4758-a522-9b1ce16a8726';
  var KEY_SET = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(WEB3FORMS_KEY);

  var form = document.getElementById('contactForm');
  if (!form) return;
  var status = document.getElementById('cf-status');
  var submitBtn = form.querySelector('.contact-form__submit');

  var REQUIRED = [
    { id: 'cf-first', label: 'first name' },
    { id: 'cf-last', label: 'last name' },
    { id: 'cf-phone', label: 'phone number' },
    { id: 'cf-email', label: 'email' }
  ];

  function field(id) { return form.querySelector('#' + id); }
  function errorSlot(id) { return form.querySelector('[data-error-for="' + id + '"]'); }
  function val(id) { return (field(id).value || '').trim(); }
  function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
  function firstName() { return val('cf-first') || 'there'; }

  function setError(id, message) {
    var el = field(id);
    var slot = errorSlot(id);
    var invalid = !!message;
    el.classList.toggle('is-invalid', invalid);
    el.setAttribute('aria-invalid', invalid ? 'true' : 'false');
    if (slot) slot.textContent = message || '';
  }

  function setStatus(text, ok) {
    status.textContent = text;
    status.classList.toggle('contact-form__status--ok', !!ok);
  }

  function validate() {
    var firstInvalid = null;
    REQUIRED.forEach(function (f) {
      var v = val(f.id);
      var message = '';
      if (!v) {
        message = 'Please enter your ' + f.label + '.';
      } else if (f.id === 'cf-email' && !isEmail(v)) {
        message = 'Please enter a valid email address.';
      }
      setError(f.id, message);
      if (message && !firstInvalid) firstInvalid = field(f.id);
    });
    return firstInvalid;
  }

  function fields() {
    return {
      name: (val('cf-first') + ' ' + val('cf-last')).trim(),
      phone: val('cf-phone'),
      email: val('cf-email'),
      message: val('cf-message') || '(none provided)'
    };
  }

  // Fallback: open the visitor's email client, pre-addressed to the practice.
  function sendViaMailto(prefixNote) {
    var f = fields();
    var body = [
      'Name: ' + f.name, 'Phone: ' + f.phone, 'Email: ' + f.email, '', 'Message:', f.message
    ].join('\n');
    window.location.href = 'mailto:' + RECIPIENT +
      '?subject=' + encodeURIComponent('Website inquiry from ' + f.name) +
      '&body=' + encodeURIComponent(body);
    setStatus((prefixNote ? prefixNote + ' ' : '') +
      'Opening your email app… if nothing opens, email us directly at ' + RECIPIENT + '.', false);
  }

  // Primary: submit to Web3Forms, show an inline thank-you, no page reload.
  function sendViaWeb3Forms() {
    var f = fields();
    if (submitBtn) submitBtn.disabled = true;
    setStatus('Sending…', false);
    fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        access_key: WEB3FORMS_KEY,
        subject: 'New website inquiry from ' + f.name,
        from_name: 'Aventura Dental Center Website',
        name: f.name, phone: f.phone, email: f.email, message: f.message, replyto: f.email
      })
    }).then(function (r) { return r.json(); }).then(function (data) {
      if (submitBtn) submitBtn.disabled = false;
      if (data && data.success) {
        form.reset();
        setStatus('Thank you, ' + firstName() + '! Your message has been sent — our team will get back to you shortly.', true);
      } else {
        sendViaMailto('We couldn’t send that automatically —');
      }
    }).catch(function () {
      if (submitBtn) submitBtn.disabled = false;
      sendViaMailto('We couldn’t reach the server —');
    });
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var firstInvalid = validate();
    if (firstInvalid) {
      setStatus('Please fix the highlighted fields and try again.', false);
      firstInvalid.focus();
      return;
    }
    if (KEY_SET) sendViaWeb3Forms();
    else sendViaMailto('');
  });

  // Clear a field's error as soon as the visitor corrects it.
  form.querySelectorAll('input, textarea').forEach(function (el) {
    el.addEventListener('input', function () { setError(el.id, ''); });
  });
})();
