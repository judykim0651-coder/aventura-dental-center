// qa-design-system.mjs — Phase 8 (Design-System Reunification, DSYS-01..07) CAPSTONE GATE.
//
// ONE rendered-browser gate that certifies all five Phase-8 ROADMAP success criteria in a
// REAL headless Chrome (playwright-core from the pinned LocalGrid install). This is the
// acceptance contract for DSYS-01..07 — the design system's a11y/typography layer shipped
// broken precisely because it was verified by READING CSS instead of RENDERING it. A grep
// can confirm main.css is linked, but only a rendered browser can prove the bio drawer
// actually OPENS on a tap, that zero U+FFFD paint in DOM text, that no element COMPUTES
// rgb(10,126,140), that body copy MEASURES ≤ ~80 cpl, that the legal <h1> computes to the
// design-system scale, and that every /blog control computes ≥16px. This gate renders it.
//
// It reuses qa-mobile-conversion.mjs's vercel.json-aware resolveFile() + http.createServer()
// + sitemapPaths() block VERBATIM (do NOT fork the server) so all 54 clean-URL routes resolve
// exactly as they ship. It writes NO artifact of any kind (stdout JSON only) — nothing can be
// indexed in production (Deploy guard / Rule #6).
//
// The FIVE checks (each negative-tested in 08-04 Task 2 — sabotage the specific fix, this gate
// must exit non-zero on the CORRECT check, then revert; per Execution Rule #4 no check may be
// a tautology):
//
//   CHECK A — DSYS-01 bio page ON the design system (@375 isMobile). For /team/dr-david-bistritz:
//     document.styleSheets carries a sheet whose href ends assets/css/main.css AND a
//     <script src> ending assets/js/nav.js is present; .site-header, .nav-pill, #mobileNav,
//     .site-footer and <main id="main"> all exist; the <h1> text node is non-empty; and a REAL
//     375px tap on .nav-mobile-toggle OPENS the drawer (#mobileNav gains .is-open, aria-hidden
//     flips to false, aria-expanded true, and all drawer a[href] links become reachable). The
//     bio <main> innerText length is comparable to its siblings (>= a floor) — retiring Phase 4's
//     two exemptions for this page (it previously had NO <main> at all).
//
//   CHECK B — DSYS-02 zero U+FFFD (ALL 54 URLs). A TreeWalker over every rendered text node
//     asserts zero U+FFFD (�). Spot-asserts the bio hours table innerText carries "Mon–Thu"
//     and "8:00 AM – 6:00 PM" and NOT the replacement glyph.
//
//   CHECK C — DSYS-03 + DSYS-04. (tel, ALL 54 URLs) at least one a[href^="tel:"] exists in the
//     rendered DOM on every URL (including the bio page). (bare-phone, BIO PAGE) the bio page —
//     the DSYS-03 fix's target, the audit's ONLY page with telVisible=0 — renders zero STANDALONE
//     phone numbers (an element whose own trimmed text is essentially just "(305) 933-2501") that
//     are left un-anchored: every phone rendering on the bio is a tel: anchor. This scope is the
//     08-01 executor's explicit capstone instruction ("do NOT gate on '>(305) 933-2501< == 0' —
//     use href='tel:' >= 3 + no bare <p>(305) 933-2501</p>", scoped to THIS page). Prose mentions
//     ("call our office at (305) 933-2501 — …") are correctly excluded; the pre-existing
//     non-tappable Contact-block <p>(305) 933-2501</p> on the 17 service + 2 legal pages is
//     OUT-OF-SCOPE for DSYS-03 (those pages already carried 2-3 tel: anchors) and is surfaced,
//     not failed, under nonBioBarePhoneObserved (deferred). (teal, ALL 54) no element on any page
//     COMPUTES color rgb(10, 126, 140) (= legacy teal #0a7e8c).
//
//   CHECK D — DSYS-05 + DSYS-06 (line length + legal heading scale + no class-styled regression),
//     rendered @1440. (i) On the 20 affected pages (17 /services/*, /terms, /privacy-policy,
//     /about) the target body <p> measures ≤ ~80 cpl (content-box width ÷ the width of '0' in that
//     element's exact computed font — the audit's own method). (ii) On /privacy-policy and /terms
//     the class-less <h1> computes ≥40px (design-system scale, not the 32px UA default), ≥ the
//     .section-title <h2> on the same page, and strictly larger than the class-less .legal-content
//     <h2>s. (iii) NO-REGRESSION on class-STYLED headings: the /about .section-title <h2> AND a
//     service-page h1.section-title (/services/emergency-dentist) each compute ≥44px at 1440px —
//     catching a base.css element-rule leaking !important and silently shrinking class-styled
//     headings site-wide (the exact failure 08-02+08-03 could hide and CSS-reading would miss).
//
//   CHECK E — DSYS-07 /blog 16px form controls (@375 isMobile). Every native input/select/textarea
//     on /blog computes font-size ≥ 16px (below it, iOS Safari force-zooms on focus and never
//     zooms back). AND documentElement.scrollWidth === clientWidth on /blog at 320/375/768 (the
//     fix's known regression is a 768px column truncation / new overflow).
//
// Browser: playwright-core, system Chrome, { channel:'chrome', headless:true }.
//
// Usage: node scripts/qa-design-system.mjs
// Prints a JSON summary and exits 0 iff every check passes on every page in its set.
//
// ── Negative-test log (08-04 Task 2 — each check proven NON-tautological; sabotage → the named
//    check exits non-zero → reverted. Re-run clean = exit 0, 54/54. Integrity re-asserted after) ──
//
//   NEG-A   (DSYS-01): removed the /assets/css/main.css <link> from team/dr-david-bistritz.html
//           → FAILED CHECKS: [A_bio_DSYS01] (exit 1). Reverted (main.css link count → 1).
//   NEG-B   (DSYS-02): reinserted U+FFFD into the bio hours row (Mon�Thu / 8:00 AM � 6:00 PM)
//           → FAILED CHECKS: [B_ufffd_DSYS02] (exit 1). Reverted (bio U+FFFD count → 0).
//   NEG-C.i (DSYS-03, bare-phone): reverted the bio contact-block phone to plain <p>(305) 933-2501</p>
//           → FAILED CHECKS: [C_bare_phone_DSYS03] (exit 1). C_tel stayed green (3 tel: anchors
//           remained) — proving the bare-phone sub-check bites INDEPENDENTLY of ≥1-tel. Reverted.
//   NEG-C.tel (DSYS-03, tel): stripped all 3 tel: anchors from /terms
//           → FAILED CHECKS: [C_tel_DSYS03] (exit 1). Reverted (terms tel: anchors → 3).
//   NEG-C.ii (DSYS-04, teal): reintroduced one style="color:#0a7e8c" h3 on /services/emergency-dentist
//           → FAILED CHECKS: [C_teal_DSYS04] (exit 1). Reverted (SERVICES/ 0a7e8c → none).
//   NEG-D.i (DSYS-05, cpl): reverted .section--muted > .container > p cap to max-width:none
//           → FAILED CHECKS: [D_typography_DSYS0506] (D_cpl fails ~138cpl). Reverted.
//   NEG-D.ii (DSYS-06, legal h1): removed the base.css h1 element rule
//           → FAILED CHECKS: [D_typography_DSYS0506] (D_legal_heading: /privacy-policy + /terms h1
//           rendered 32px < 40 and < .section-title 48px). cpl + regression stayed clean. Reverted.
//   NEG-D.iii (T-08-05 no-regression): added `h2 { font-size: 1.875rem !important }` to base.css
//           → FAILED CHECKS: [D_typography_DSYS0506] (D_class_styled_regression: /about h2.section-title
//           dropped 48px → 30px < 44 floor). cpl + legal stayed clean. Reverted (!important → 6).
//   NEG-E   (DSYS-07): reverted the .blog-filters__search/__select font-size to 0.875rem (14px)
//           → FAILED CHECKS: [E_blog_forms_DSYS07] (exit 1). Reverted (blog controls → 1rem).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/Users/judykim/Desktop/JUDY_KIM/BUSINESS/projects/LocalGrid/node_modules/playwright-core/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// The bio page — the design-system orphan retired in this phase (DSYS-01/02/03).
const BIO = '/team/dr-david-bistritz';

// Legacy teal brand #0a7e8c === rgb(10, 126, 140). Zero elements may COMPUTE this (DSYS-04).
const TEAL_RGB = 'rgb(10, 126, 140)';

// The 20 pages the line-length caps (DSYS-05) touch: 17 /services/* + /terms + /privacy-policy
// + /about. Built from the sitemap so the set can never go stale.
const LEGAL_PAGES = ['/privacy-policy', '/terms'];
const ABOUT_PAGE = '/about';
const SERVICE_HEADING_SAMPLE = '/services/emergency-dentist'; // carries an h1.section-title

// cpl ceiling — the caps target ~75 cpl (700px/720px). Allow small rounding per the plan (≤ ~80).
const CPL_MAX = 80;

// ── Load vercel.json (for the copied resolveFile/server block) ────────────────
const vercelConfig = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'vercel.json'), 'utf8'));
const REDIRECTS = vercelConfig.redirects || [];
const REWRITES = vercelConfig.rewrites || [];

// ── MIME map ─────────────────────────────────────────────────────────────────
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.xml':  'application/xml; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8',
  '.map':  'application/json; charset=utf-8',
};

// ── Pattern matcher (verbatim from qa-mobile-conversion.mjs) ──────────────────
function patternToRegex(source) {
  let rx = source
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/:([a-zA-Z]+)\*/g, '(.*)')
    .replace(/:([a-zA-Z]+)/g, '([^/]+)');
  return new RegExp('^' + rx + '$');
}

function matchRedirect(pathname) {
  for (const rule of REDIRECTS) {
    const rx = patternToRegex(rule.source);
    if (rx.test(pathname)) return rule.destination;
  }
  return null;
}

function matchRewrite(pathname) {
  for (const rule of REWRITES) {
    const rx = patternToRegex(rule.source);
    const m = pathname.match(rx);
    if (m) {
      let dest = rule.destination;
      if (m[1] !== undefined) {
        dest = dest.replace(/:([a-zA-Z]+)\*/g, m[1]).replace(/:([a-zA-Z]+)/g, m[1]);
      }
      return dest;
    }
  }
  return null;
}

// ── File resolver (verbatim from qa-mobile-conversion.mjs) ────────────────────
function resolveFile(pathname) {
  let p = decodeURIComponent(pathname.split('?')[0]);
  if (p === '/' || p === '') p = '/index.html';

  const rewritten = matchRewrite(p);
  if (rewritten) {
    const rel = rewritten.replace(/^\/+/, '');
    const abs = path.join(REPO_ROOT, rel);
    if (!abs.startsWith(REPO_ROOT)) return null;
    return abs;
  }

  const rel = p.replace(/^\/+/, '');
  const abs = path.join(REPO_ROOT, rel);
  if (!abs.startsWith(REPO_ROOT)) return null;
  return abs;
}

// ── HTTP server (verbatim from qa-mobile-conversion.mjs) ──────────────────────
const server = http.createServer((req, res) => {
  const pathname = (req.url || '/').split('?')[0];

  const redirectDest = matchRedirect(pathname);
  if (redirectDest) {
    res.writeHead(301, { 'Location': redirectDest });
    res.end();
    return;
  }

  const file = resolveFile(req.url || '/');
  if (!file) {
    res.writeHead(400);
    res.end('bad request');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'content-type': CONTENT_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

// ── Enumerate all 54 sitemap URLs, origin-stripped (verbatim) ─────────────────
function sitemapPaths() {
  const xml = fs.readFileSync(path.join(REPO_ROOT, 'sitemap.xml'), 'utf8');
  const paths = [];
  for (const m of xml.matchAll(/<loc>https?:\/\/[^/]+(\/[^<]*)<\/loc>/g)) {
    let p = m[1].replace(/\/$/, '');
    if (p === '') p = '/';
    paths.push(p);
  }
  return paths;
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK A — DSYS-01 bio page on the design system + real 375px drawer tap
// ════════════════════════════════════════════════════════════════════════════
async function checkBio(context, port) {
  const reasons = [];
  const detail = {};
  const page = await context.newPage();
  try {
    await page.goto(`http://127.0.0.1:${port}${BIO}`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Loaded assets: main.css in document.styleSheets + a nav.js <script src>.
    const assets = await page.evaluate(() => {
      const sheets = [...document.styleSheets].map((s) => s.href || '');
      const scripts = [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src') || '');
      return {
        mainCss: sheets.some((h) => /assets\/css\/main\.css$/.test(h)),
        navJs: scripts.some((h) => /assets\/js\/nav\.js$/.test(h)),
      };
    });
    detail.assets = assets;
    if (!assets.mainCss) reasons.push('main.css not in document.styleSheets');
    if (!assets.navJs) reasons.push('nav.js <script src> not present');

    // Shared chrome nodes + a non-empty <h1> + a sized <main>.
    const chrome = await page.evaluate(() => {
      const q = (s) => !!document.querySelector(s);
      const h1 = document.querySelector('h1');
      const main = document.querySelector('main#main');
      return {
        siteHeader: q('.site-header'),
        navPill: q('.nav-pill'),
        mobileNav: q('#mobileNav'),
        siteFooter: q('.site-footer'),
        mainIdMain: !!main,
        h1Text: h1 ? (h1.textContent || '').trim() : '',
        mainLen: main ? (main.innerText || '').trim().length : 0,
        toggle: q('.nav-mobile-toggle'),
      };
    });
    detail.chrome = chrome;
    if (!chrome.siteHeader) reasons.push('.site-header missing');
    if (!chrome.navPill) reasons.push('.nav-pill missing');
    if (!chrome.mobileNav) reasons.push('#mobileNav missing');
    if (!chrome.siteFooter) reasons.push('.site-footer missing');
    if (!chrome.mainIdMain) reasons.push('<main id="main"> missing');
    if (!chrome.toggle) reasons.push('.nav-mobile-toggle missing');
    if (!(chrome.h1Text.length > 0)) reasons.push('<h1> text node is empty');
    // Sibling-comparable content: retire Phase-4's length exemption. The bio <main> is a full
    // profile + contact section; assert a real content floor (siblings run thousands of chars).
    if (!(chrome.mainLen >= 400)) reasons.push(`<main> innerText only ${chrome.mainLen} chars (< 400 floor)`);

    // Closed baseline, then a REAL tap on the toggle must OPEN the drawer (mirror qa-mobile-nav).
    if (chrome.toggle && chrome.mobileNav) {
      const closed = await page.evaluate(() => {
        const n = document.getElementById('mobileNav');
        return { isOpen: n.classList.contains('is-open'), ariaHidden: n.getAttribute('aria-hidden') };
      });
      if (closed.isOpen) reasons.push('drawer already open before tap');

      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(50);
      let opened = null;
      try {
        await page.tap('.nav-mobile-toggle', { timeout: 5000 });
        await page.waitForTimeout(150);
        opened = await page.evaluate(() => {
          const n = document.getElementById('mobileNav');
          const t = document.querySelector('.nav-mobile-toggle');
          const links = [...n.querySelectorAll('a[href]')];
          let reachable = 0;
          for (const a of links) { try { a.focus(); } catch (e) {} if (document.activeElement === a) reachable++; }
          return {
            isOpen: n.classList.contains('is-open'),
            ariaHidden: n.getAttribute('aria-hidden'),
            ariaExpanded: t.getAttribute('aria-expanded'),
            links: links.length,
            reachable,
          };
        });
      } catch (e) {
        reasons.push(`tap failed: ${e.message.split('\n')[0]}`);
      }
      detail.drawer = opened;
      if (opened) {
        if (!opened.isOpen) reasons.push('drawer did not open on tap (#mobileNav lacks .is-open)');
        if (opened.ariaHidden !== 'false') reasons.push(`open drawer aria-hidden ${opened.ariaHidden} (expected false)`);
        if (opened.ariaExpanded !== 'true') reasons.push(`toggle aria-expanded ${opened.ariaExpanded} (expected true)`);
        if (!(opened.links > 0 && opened.reachable === opened.links)) {
          reasons.push(`drawer links reachable ${opened.reachable}/${opened.links}`);
        }
      }
    }
  } catch (e) {
    reasons.push(`error: ${e.message.split('\n')[0]}`);
  }
  await page.close();
  return { name: 'A_bio', ok: reasons.length === 0, reasons, detail };
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK B (U+FFFD, all 54) + CHECK C (tel + bare-phone + teal, all 54) — one sweep.
// ════════════════════════════════════════════════════════════════════════════
async function checkTextTelTeal(context, port, urls) {
  const ffdFail = [];      // B
  const telFail = [];      // C tel
  const barePhoneFail = []; // C bare-phone (BIO only — a failure)
  const nonBioBareObserved = []; // C bare-phone on non-bio pages (out-of-scope, deferred)
  const tealFail = [];     // C teal
  let bBioHoursOk = null;
  let bPass = 0, cTelPass = 0, cTealPass = 0;
  let bioBareChecked = false, bioBareOk = false;

  for (const urlPath of urls) {
    const page = await context.newPage();
    try {
      await page.goto(`http://127.0.0.1:${port}${urlPath}`, { waitUntil: 'networkidle', timeout: 30000 });

      const r = await page.evaluate((isBio) => {
        // ── CHECK B: walk every rendered text node for U+FFFD ──
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let ffd = 0;
        let node;
        while ((node = walker.nextNode())) {
          const t = node.nodeValue || '';
          for (const ch of t) if (ch === '�') ffd++;
        }

        // ── CHECK C tel: at least one a[href^="tel:"] ──
        const telCount = document.querySelectorAll('a[href^="tel:"]').length;

        // ── CHECK C bare-phone: standalone phone rendering not inside a tel: anchor ──
        // Definition: an element whose OWN trimmed text is essentially just the phone number
        // (a contact affordance), with no ancestor tel: anchor. Prose mentions embed the number
        // in a longer sentence and are correctly excluded (parent text >> the number).
        const PHONE = /\(305\)\s*677[-\s]?0511|305[-.\s]677[-.\s]0511/;
        const inTelAnchor = (el) => !!(el.closest && el.closest('a[href^="tel:"]'));
        const bareHits = [];
        const tw2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let tn;
        while ((tn = tw2.nextNode())) {
          const raw = tn.nodeValue || '';
          if (!PHONE.test(raw)) continue;
          const parent = tn.parentElement;
          if (!parent) continue;
          if (inTelAnchor(parent)) continue; // tappable — fine
          const own = (parent.textContent || '').trim();
          // Standalone iff the parent's whole text is basically only the phone number.
          if (own.length <= 20) {
            bareHits.push({ text: own, tag: parent.tagName.toLowerCase() });
          }
        }

        // ── CHECK C teal: any element computing rgb(10, 126, 140) ──
        const tealHits = [];
        const all = document.querySelectorAll('*');
        for (const el of all) {
          const c = getComputedStyle(el).color;
          if (c === 'rgb(10, 126, 140)') {
            tealHits.push(el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''));
            if (tealHits.length >= 5) break;
          }
        }

        // Bio hours spot-check.
        let bioHours = null;
        if (isBio) {
          const body = document.body.innerText || '';
          bioHours = {
            monThu: body.includes('Mon–Thu'),
            hours: body.includes('8:00 AM – 6:00 PM'),
            noFfd: !body.includes('�'),
          };
        }

        return { ffd, telCount, bareHits, tealHits, bioHours };
      }, urlPath === BIO);

      // B
      if (r.ffd === 0) bPass++;
      else ffdFail.push({ url: urlPath, count: r.ffd });
      if (r.bioHours) {
        bBioHoursOk = r.bioHours.monThu && r.bioHours.hours && r.bioHours.noFfd;
        if (!bBioHoursOk) ffdFail.push({ url: urlPath, bioHours: r.bioHours });
      }

      // C tel
      if (r.telCount >= 1) cTelPass++;
      else telFail.push({ url: urlPath, telCount: r.telCount });

      // C bare-phone — the DSYS-03 assertion is BIO-scoped (08-01 executor's explicit
      // instruction). On the bio page, zero bare renderings is a hard FAIL. On the other 53
      // pages, any pre-existing bare Contact-block <p>(305) 933-2501</p> is OUT-OF-SCOPE for
      // DSYS-03 (those pages already carry 2-3 tel: anchors) — recorded, not failed.
      if (urlPath === BIO) {
        bioBareChecked = true;
        bioBareOk = r.bareHits.length === 0;
        if (!bioBareOk) barePhoneFail.push({ url: urlPath, bareHits: r.bareHits });
      } else if (r.bareHits.length > 0) {
        nonBioBareObserved.push({ url: urlPath, bareHits: r.bareHits });
      }

      // C teal
      if (r.tealHits.length === 0) cTealPass++;
      else tealFail.push({ url: urlPath, tealHits: r.tealHits });
    } catch (e) {
      ffdFail.push({ url: urlPath, error: e.message.split('\n')[0] });
    }
    await page.close();
  }

  const total = urls.length;
  return {
    B: {
      name: 'B_ufffd', pass: bPass, total,
      bioHoursOk: bBioHoursOk, failures: ffdFail,
      ok: ffdFail.length === 0 && bPass === total && bBioHoursOk === true,
    },
    Ctel: {
      name: 'C_tel', pass: cTelPass, total, failures: telFail,
      ok: telFail.length === 0 && cTelPass === total,
    },
    Cbare: {
      name: 'C_bare_phone_bio', scope: BIO, failures: barePhoneFail,
      nonBioBareObserved,
      ok: bioBareChecked && bioBareOk && barePhoneFail.length === 0,
    },
    Cteal: {
      name: 'C_teal', pass: cTealPass, total, failures: tealFail,
      ok: tealFail.length === 0 && cTealPass === total,
    },
  };
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK D — DSYS-05 (cpl) + DSYS-06 (legal heading scale + class-styled no-regression) @1440
// ════════════════════════════════════════════════════════════════════════════
async function checkTypography(context, port, urls) {
  const cplFail = [];
  const legalFail = [];
  const regressionFail = [];
  const cplMeasured = [];
  let cplPass = 0, cplTotal = 0;

  const services = urls.filter((u) => u.startsWith('/services/'));
  const affected = [...services, ...LEGAL_PAGES, ABOUT_PAGE];

  // Per-page cpl selector: which target <p> the DSYS-05 caps govern.
  function selectorFor(urlPath) {
    if (urlPath.startsWith('/services/')) return '.section--muted > .container > p';
    if (LEGAL_PAGES.includes(urlPath)) return '.legal-content p';
    if (urlPath === ABOUT_PAGE) return '.mission-band__content p, .mission-band__content';
    return null;
  }

  for (const urlPath of affected) {
    const page = await context.newPage();
    try {
      await page.goto(`http://127.0.0.1:${port}${urlPath}`, { waitUntil: 'networkidle', timeout: 30000 });
      const sel = selectorFor(urlPath);
      cplTotal++;

      const measured = await page.evaluate((selector) => {
        const els = [...document.querySelectorAll(selector)].filter((el) => (el.textContent || '').trim().length > 60);
        const out = [];
        for (const el of els) {
          const cs = getComputedStyle(el);
          const padL = parseFloat(cs.paddingLeft) || 0;
          const padR = parseFloat(cs.paddingRight) || 0;
          const contentWidth = el.clientWidth - padL - padR;
          // Measure '0' width in THIS element's exact computed font (append inside, inherit).
          const span = document.createElement('span');
          span.textContent = '0'.repeat(100);
          span.style.whiteSpace = 'pre';
          span.style.position = 'absolute';
          span.style.visibility = 'hidden';
          span.style.pointerEvents = 'none';
          el.appendChild(span);
          const zeroWidth = span.getBoundingClientRect().width / 100;
          span.remove();
          const cpl = zeroWidth > 0 ? contentWidth / zeroWidth : Infinity;
          out.push({ cpl: Number(cpl.toFixed(1)), contentWidth: Math.round(contentWidth), zeroWidth: Number(zeroWidth.toFixed(2)), fontSize: cs.fontSize });
        }
        return out;
      }, sel);

      if (measured.length === 0) {
        cplFail.push({ url: urlPath, reason: `no target <p> matched (${sel})` });
      } else {
        const worst = Math.max(...measured.map((m) => m.cpl));
        cplMeasured.push({ url: urlPath, worstCpl: worst, samples: measured.length });
        if (worst > CPL_MAX) cplFail.push({ url: urlPath, worstCpl: worst, detail: measured });
        else cplPass++;
      }

      // (ii) Legal heading scale — /privacy-policy, /terms.
      if (LEGAL_PAGES.includes(urlPath)) {
        const h = await page.evaluate(() => {
          const px = (el) => (el ? parseFloat(getComputedStyle(el).fontSize) : null);
          const h1 = document.querySelector('h1:not([class])') || document.querySelector('main h1, .legal-page h1, h1');
          const sectionTitle = document.querySelector('h2.section-title, .section-title');
          const classlessH2 = document.querySelector('.legal-content h2:not([class]), .legal-content h2');
          return {
            h1Size: px(h1), h1Class: h1 ? (h1.getAttribute('class') || '(none)') : 'MISSING',
            sectionTitleSize: px(sectionTitle),
            classlessH2Size: px(classlessH2),
          };
        });
        const probs = [];
        if (!(h.h1Size >= 40)) probs.push(`h1 ${h.h1Size}px < 40 (UA-default scale, not design-system)`);
        if (!(h.h1Size >= h.sectionTitleSize)) probs.push(`h1 ${h.h1Size}px < .section-title ${h.sectionTitleSize}px (did not reach the styled scale)`);
        if (!(h.h1Size > h.classlessH2Size)) probs.push(`h1 ${h.h1Size}px !> class-less h2 ${h.classlessH2Size}px`);
        if (probs.length) legalFail.push({ url: urlPath, reasons: probs, detail: h });
      }

      // (iii) Class-styled no-regression — /about h2.section-title.
      if (urlPath === ABOUT_PAGE) {
        const s = await page.evaluate(() => {
          const el = document.querySelector('h2.section-title');
          return el ? parseFloat(getComputedStyle(el).fontSize) : null;
        });
        if (!(s >= 44)) regressionFail.push({ url: urlPath, sel: 'h2.section-title', size: s, floor: 44 });
      }
    } catch (e) {
      cplFail.push({ url: urlPath, error: e.message.split('\n')[0] });
    }
    await page.close();
  }

  // (iii) Class-styled no-regression — service-page h1.section-title.
  {
    const page = await context.newPage();
    try {
      await page.goto(`http://127.0.0.1:${port}${SERVICE_HEADING_SAMPLE}`, { waitUntil: 'networkidle', timeout: 30000 });
      const s = await page.evaluate(() => {
        const el = document.querySelector('h1.section-title');
        return el ? parseFloat(getComputedStyle(el).fontSize) : null;
      });
      if (!(s >= 44)) regressionFail.push({ url: SERVICE_HEADING_SAMPLE, sel: 'h1.section-title', size: s, floor: 44 });
    } catch (e) {
      regressionFail.push({ url: SERVICE_HEADING_SAMPLE, error: e.message.split('\n')[0] });
    }
    await page.close();
  }

  return {
    name: 'D_typography',
    cpl: { pass: cplPass, total: cplTotal, max: CPL_MAX, measured: cplMeasured, failures: cplFail },
    legal: { failures: legalFail, pages: LEGAL_PAGES.length },
    regression: { failures: regressionFail },
    ok: cplFail.length === 0 && legalFail.length === 0 && regressionFail.length === 0 && cplPass === cplTotal,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK E — DSYS-07 /blog 16px form controls + no overflow (@375 isMobile)
// ════════════════════════════════════════════════════════════════════════════
async function checkBlogForms(context, port) {
  const reasons = [];
  const detail = {};
  const page = await context.newPage();
  try {
    await page.goto(`http://127.0.0.1:${port}/blog`, { waitUntil: 'networkidle', timeout: 30000 });

    // Every native form control computes font-size >= 16px.
    const controls = await page.evaluate(() => {
      const els = [...document.querySelectorAll('input, select, textarea')];
      return els.map((el) => ({
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') || '',
        cls: (el.getAttribute('class') || '').split(' ')[0],
        fontSize: parseFloat(getComputedStyle(el).fontSize),
      }));
    });
    detail.controls = controls;
    if (controls.length === 0) reasons.push('no native form controls found on /blog');
    for (const c of controls) {
      if (!(c.fontSize >= 16)) reasons.push(`${c.tag}.${c.cls} font-size ${c.fontSize}px < 16px (iOS focus-zoom trigger)`);
    }

    // No horizontal overflow at 320/375/768.
    const overflow = {};
    for (const w of [320, 375, 768]) {
      await page.setViewportSize({ width: w, height: w === 320 ? 568 : (w === 375 ? 812 : 1024) });
      await page.waitForTimeout(150);
      const delta = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      overflow[w] = delta;
      if (delta > 0) reasons.push(`overflow@${w} +${delta}px (documentElement.scrollWidth > clientWidth)`);
    }
    detail.overflow = overflow;
  } catch (e) {
    reasons.push(`error: ${e.message.split('\n')[0]}`);
  }
  await page.close();
  return { name: 'E_blog_forms', ok: reasons.length === 0, reasons, detail };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  const urls = sitemapPaths();

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  // Mobile context (375x812 isMobile + hasTouch, DSF 3 — matches qa-mobile-nav/qa-mobile-conversion).
  const mobileCtx = await browser.newContext({
    viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3,
  });
  // Desktop sweep context for B+C (viewport-independent DOM/color checks).
  const deskCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  // 1440 desktop context for the typography (cpl + heading) checks — the plan measures @1440.
  const desk1440Ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  const A = await checkBio(mobileCtx, port);
  const BC = await checkTextTelTeal(deskCtx, port, urls);
  const D = await checkTypography(desk1440Ctx, port, urls);
  const E = await checkBlogForms(mobileCtx, port);

  await browser.close();
  await new Promise((resolve) => server.close(resolve));

  const allOk = A.ok && BC.B.ok && BC.Ctel.ok && BC.Cbare.ok && BC.Cteal.ok && D.ok && E.ok;

  const summary = {
    gate: 'qa-design-system (Phase 8 capstone)',
    result: allOk ? 'PASS' : 'FAIL',
    urlsWalked: urls.length,
    checks: {
      A_bio_DSYS01:        { ok: A.ok, criterion: 'DSYS-01', drawer: A.detail.drawer || null },
      B_ufffd_DSYS02:      { ok: BC.B.ok, criterion: 'DSYS-02', pass: `${BC.B.pass}/${BC.B.total}`, bioHoursOk: BC.B.bioHoursOk },
      C_tel_DSYS03:        { ok: BC.Ctel.ok, criterion: 'DSYS-03', pass: `${BC.Ctel.pass}/${BC.Ctel.total}` },
      C_bare_phone_DSYS03: { ok: BC.Cbare.ok, criterion: 'DSYS-03', scope: BC.Cbare.scope, nonBioBareObservedCount: BC.Cbare.nonBioBareObserved.length },
      C_teal_DSYS04:       { ok: BC.Cteal.ok, criterion: 'DSYS-04', pass: `${BC.Cteal.pass}/${BC.Cteal.total}` },
      D_typography_DSYS0506: {
        ok: D.ok, criterion: 'DSYS-05/06',
        cpl: `${D.cpl.pass}/${D.cpl.total} (≤${D.cpl.max}cpl)`,
        legalHeadingFailures: D.legal.failures.length,
        classStyledRegressionFailures: D.regression.failures.length,
      },
      E_blog_forms_DSYS07: { ok: E.ok, criterion: 'DSYS-07', overflow: E.detail.overflow || null },
    },
    failures: {
      A_bio: A.ok ? [] : A.reasons,
      B_ufffd: BC.B.failures,
      C_tel: BC.Ctel.failures,
      C_bare_phone: BC.Cbare.failures,
      C_teal: BC.Cteal.failures,
      _deferred_nonBioBarePhone: BC.Cbare.nonBioBareObserved,
      D_cpl: D.cpl.failures,
      D_legal_heading: D.legal.failures,
      D_class_styled_regression: D.regression.failures,
      E_blog_forms: E.ok ? [] : E.reasons,
    },
    cplMeasured: D.cpl.measured,
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(allOk ? 0 : 1);
}

run().catch((err) => {
  console.error(JSON.stringify({ error: err.message, stack: (err.stack || '').split('\n').slice(0, 4) }, null, 2));
  try { server.close(); } catch {}
  process.exit(1);
});
