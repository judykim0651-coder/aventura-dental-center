/* Aventura Dental Center — self-contained "Chat with us" bubble.
   Injects its own styles + DOM so it works on every page regardless of that
   page's CSS. Answers common questions and drives booking. No external deps. */
(function () {
  'use strict';
  if (window.__adcChat) return;
  window.__adcChat = true;

  var BOOK = 'https://www.patientsreach.com/schedule/Aventura-Dental-Center/patient_types/';
  var TEL = 'tel:+13059332501';
  var MAP = 'https://www.google.com/maps/search/?api=1&query=Aventura+Dental+Center,+18171+Biscayne+Blvd,+Aventura,+FL+33160';

  var QUICK = [
    { label: 'Book an appointment', icon: '📅',
      answer: 'You can book online anytime — tap <strong>Book an Appointment</strong> below, or call us at <a href="' + TEL + '">(305) 933-2501</a>. We’ll find a time that works for you!' },
    { label: 'Office hours', icon: '🕒',
      answer: 'We’re open <strong>Monday–Thursday 8:00 AM–6:00 PM</strong> and <strong>Friday 8:00 AM–1:00 PM</strong>. We’re closed on weekends.' },
    { label: 'Location & directions', icon: '📍',
      answer: 'We’re located at <strong>18171 Biscayne Blvd, Aventura, FL 33160</strong>. <a href="' + MAP + '" target="_blank" rel="noopener">Get directions →</a>' },
    { label: 'Insurance & payment', icon: '💳',
      answer: 'We accept most dental insurance plans plus cash and major credit cards, with flexible payment options. No insurance? We offer clear, reasonable pricing — just call us and we’ll go over your options.' },
    { label: 'Our services', icon: '🦷',
      answer: 'We offer preventive, cosmetic, and restorative dentistry — cleanings, dental implants, veneers, Invisalign, crowns, teeth whitening, and emergency care. <a href="/services.html">See all services →</a>' },
    { label: 'New patients', icon: '✨',
      answer: 'Yes — we’d love to welcome you! We see new patients of all ages. Book online or call <a href="' + TEL + '">(305) 933-2501</a> to get started.' },
    { label: 'More questions', icon: '❓',
      answer: 'You’ll find detailed answers on our <a href="/faq.html">FAQ page →</a> — or email us at <a href="mailto:info@aventuradentalcenter.com">info@aventuradentalcenter.com</a>.' }
  ];

  var css = ''
    + '.adc-chat *{box-sizing:border-box}'
    + '.adc-chat{position:fixed;right:20px;bottom:20px;z-index:990;font-family:"Rubik",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}'
    + '@media (max-width:1023px){.adc-chat{bottom:72px}}'
    + '.adc-fab{display:flex;align-items:center;gap:9px;border:0;cursor:pointer;background:#007399;color:#fff;'
    + 'padding:13px 20px;border-radius:9999px;box-shadow:0 8px 24px rgba(0,0,0,.22);font-size:15px;font-weight:600;'
    + 'font-family:inherit;transition:transform .18s ease,background .18s ease}'
    + '.adc-fab:hover{background:#005b7a;transform:translateY(-2px)}'
    + '.adc-fab svg{width:22px;height:22px;flex-shrink:0}'
    + '.adc-fab.adc-hide{opacity:0;pointer-events:none;transform:scale(.85)}'
    + '@media(max-width:480px){.adc-fab__t{display:none}.adc-fab{padding:14px}}'
    + '.adc-tip{position:absolute;right:0;bottom:64px;background:#fff;color:#1a2b33;padding:11px 14px;border-radius:14px 14px 4px 14px;'
    + 'box-shadow:0 8px 24px rgba(0,0,0,.16);font-size:13.5px;max-width:210px;line-height:1.4;opacity:0;transform:translateY(6px);'
    + 'transition:opacity .25s,transform .25s;pointer-events:none}'
    + '.adc-tip.adc-show{opacity:1;transform:translateY(0);pointer-events:auto}'
    + '.adc-tip button{position:absolute;top:-8px;right:-8px;width:20px;height:20px;border-radius:50%;border:0;background:#1a2b33;color:#fff;cursor:pointer;font-size:12px;line-height:1}'
    + '.adc-tip button::before{content:"";position:absolute;inset:-12px}'
    + '.adc-panel{position:absolute;right:0;bottom:0;width:350px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 110px);'
    + 'background:#fff;border-radius:18px;box-shadow:0 18px 50px rgba(0,0,0,.28);display:flex;flex-direction:column;overflow:hidden;'
    + 'opacity:0;transform:translateY(14px) scale(.97);pointer-events:none;visibility:hidden;transition:opacity .2s ease,transform .2s ease,visibility 0s linear .2s}'
    + '.adc-panel.adc-open{opacity:1;transform:none;pointer-events:auto;visibility:visible;transition-delay:0s}'
    + '.adc-head{background:#007399;color:#fff;padding:16px 18px;display:flex;align-items:center;justify-content:space-between;gap:10px}'
    + '.adc-head strong{display:block;font-size:15px;font-weight:600}'
    + '.adc-head span{display:block;font-size:12px;margin-top:2px}'
    + '.adc-head__av{display:flex;align-items:center;gap:10px}'
    + '.adc-dot{width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0}'
    + '.adc-dot svg{width:18px;height:18px}'
    + '.adc-x{background:none;border:0;color:#fff;font-size:22px;line-height:1;cursor:pointer;opacity:.9;min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;padding:0}'
    + '.adc-x:hover{opacity:1}'
    + '.adc-body{flex:1;overflow-y:auto;padding:16px;background:#f6f9fb;display:flex;flex-direction:column;gap:10px}'
    + '.adc-msg{max-width:88%;padding:11px 14px;font-size:13.5px;line-height:1.5;border-radius:14px}'
    + '.adc-msg a{color:#0077a3;font-weight:500}'
    + '.adc-bot{align-self:flex-start;background:#fff;color:#1a2b33;border:1px solid #e5ebef;border-bottom-left-radius:4px}'
    + '.adc-user{align-self:flex-end;background:#007399;color:#fff;border-bottom-right-radius:4px}'
    + '.adc-quick{padding:10px 12px;display:flex;flex-wrap:wrap;gap:7px;border-top:1px solid #eef2f5;background:#fff}'
    + '.adc-chip{border:1px solid rgba(0,153,204,.35);background:#fff;color:#0077a3;border-radius:9999px;padding:7px 12px;'
    + 'font-size:12.5px;font-weight:500;cursor:pointer;font-family:inherit;transition:background .15s,color .15s}'
    + '.adc-chip:hover{background:#007399;color:#fff;border-color:#007399}'
    + '.adc-foot{padding:11px 14px;border-top:1px solid #eef2f5;background:#fff}'
    + '.adc-book{display:block;text-align:center;background:#007399;color:#fff;text-decoration:none;font-weight:600;'
    + 'padding:12px;border-radius:10px;font-size:14px;transition:background .15s}'
    + '.adc-book:hover{background:#005b7a}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var root = document.createElement('div');
  root.className = 'adc-chat';
  var chatIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
  root.innerHTML =
    '<div class="adc-tip" id="adcTip">👋 Have a question? Chat with us!<button type="button" aria-label="Dismiss">×</button></div>'
    + '<button class="adc-fab" id="adcFab" aria-label="Open chat" aria-expanded="false">' + chatIcon + '<span class="adc-fab__t">Chat with us</span></button>'
    + '<div class="adc-panel" id="adcPanel" role="dialog" aria-label="Chat with Aventura Dental Center" aria-modal="false">'
    +   '<div class="adc-head"><div class="adc-head__av"><span class="adc-dot">' + chatIcon + '</span>'
    +     '<div><strong>Aventura Dental Center</strong><span>We’re here to help • replies fast</span></div></div>'
    +     '<button class="adc-x" id="adcClose" aria-label="Close chat">×</button></div>'
    +   '<div class="adc-body" id="adcBody"></div>'
    +   '<div class="adc-quick" id="adcQuick"></div>'
    +   '<div class="adc-foot"><a class="adc-book" href="' + BOOK + '" target="_blank" rel="noopener">Book an Appointment</a></div>'
    + '</div>';
  document.body.appendChild(root);

  var fab = document.getElementById('adcFab');
  var panel = document.getElementById('adcPanel');
  panel.inert = true;
  var body = document.getElementById('adcBody');
  var quick = document.getElementById('adcQuick');
  var tip = document.getElementById('adcTip');

  function scrollDown() { body.scrollTop = body.scrollHeight; }
  function addMsg(html, who) {
    var m = document.createElement('div');
    m.className = 'adc-msg ' + (who === 'user' ? 'adc-user' : 'adc-bot');
    m.innerHTML = html;
    body.appendChild(m);
    scrollDown();
  }

  QUICK.forEach(function (q) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'adc-chip';
    b.textContent = q.label;
    b.addEventListener('click', function () {
      addMsg(q.label, 'user');
      setTimeout(function () { addMsg(q.answer, 'bot'); }, 260);
    });
    quick.appendChild(b);
  });

  var greeted = false;
  function open() {
    panel.classList.add('adc-open');
    panel.inert = false;
    fab.classList.add('adc-hide');
    fab.inert = true;              // visually-hidden FAB must also leave the tab order (LOW-02)
    fab.setAttribute('aria-expanded', 'true');
    hideTip();
    if (!greeted) {
      greeted = true;
      addMsg('👋 Hi there! How can we help you today? Pick a topic below, or call us at <a href="' + TEL + '">(305) 933-2501</a>.', 'bot');
    }
    document.getElementById('adcClose').focus();   // move keyboard focus into the dialog (mirrors close()'s restore)
  }
  function close() {
    panel.classList.remove('adc-open');
    panel.inert = true;
    fab.classList.remove('adc-hide');
    fab.inert = false;            // re-enable the FAB BEFORE focusing it — an inert element
                                  // silently rejects .focus() (LOW-02 must precede MD-01)
    fab.setAttribute('aria-expanded', 'false');
    fab.focus();                 // return focus to the trigger (WCAG 2.4.3) — matches the nav-drawer restore (MD-01)
  }
  function hideTip() { tip.classList.remove('adc-show'); }

  fab.addEventListener('click', open);
  document.getElementById('adcClose').addEventListener('click', close);
  tip.querySelector('button').addEventListener('click', function (e) { e.stopPropagation(); hideTip(); try { sessionStorage.setItem('adcTip', '1'); } catch (e2) {} });
  tip.addEventListener('click', open);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panel.classList.contains('adc-open')) close(); });

  // one-time greeting tooltip
  var seen = false;
  try { seen = sessionStorage.getItem('adcTip') === '1'; } catch (e) {}
  if (!seen) {
    setTimeout(function () { if (!panel.classList.contains('adc-open')) tip.classList.add('adc-show'); }, 2800);
    setTimeout(hideTip, 12000);
  }
})();
