// qa-mobile-conversion.mjs — Phase 5 (Mobile Conversion Path) rendered gate.
//
// The phase-wide guard for the mobile conversion path, proven in a REAL rendered
// browser (system Chrome via playwright-core, isMobile + hasTouch, DSF 3). Plan 05-01
// stands up THREE checks; 05-02 and 05-03 EXTEND this same file (do not fork it):
//
//   CHECK A — MOBI-02 no-horizontal-overflow invariant (ALL 54 URLs @ 320/375/768).
//     ZERO overflow exemptions. documentElement.scrollWidth === clientWidth on every
//     URL at every width. This is the invariant the whole phase is re-measured against:
//     every position:fixed element 05-02+ adds (sticky bar, un-hidden badge) must keep
//     it green. Deliberately does NOT carry qa-mobile-nav.mjs's per-width overflow
//     allowlist — that masked exactly the /locations@320 defect MOBI-02 fixes, and would
//     make this gate's own negative test a tautology.
//
//   CHECK B — MOBI-03 utility-bar phone (pages WITH .cta-header @ 320/360/375/390/414).
//     The tel: link renders ONE unwrapped line (<=28px) inside the 48px bar (top>=-2,
//     bottom<=50), and no .cta-header element's right edge passes the viewport (the check
//     that fails if nowrap-only had shoved the email to 385px). Post-Phase-8 there are NO
//     cta-header exemptions — the bio page (/team/dr-david-bistritz) was rebuilt on the shared
//     chrome and now carries the cta-header like every page, so ALL 54 must have one.
//
//   CHECK C — MOBI-06 homepage rating badge (ONLY /).
//     .hero__rating has a non-zero box at 375px, its innerText carries 4.8 and 706, and
//     those equal the same-page AggregateRating JSON-LD (ratingValue 4.8 / reviewCount 706).
//     A fabricated/mismatched rating fails loudly — that mismatch IS the MOBI-06 defect.
//
//   CHECK D — MOBI-04 Call + Book visible + tappable after scroll (ALL 54 URLs @ 375px).
//     Added by 05-02. After scrolling to the bottom AND the mid of each page, the fixed
//     .adc-cta-bar presents a tel: Call and a patientsreach Book, each with a non-zero box
//     fully inside the 375px viewport and un-covered (elementFromPoint at its centre
//     resolves to the anchor). No exemption — the bio page passes on its self-contained
//     bar. This is the T-05-06 mitigation (no visible call/book after scroll).
//
//   CHECK E — MOBI-05 footer address is a directions anchor (ALL 54 URLs).
//     Added by 05-02. The footer address is an <a href*="google.com/maps/dir"> whose text
//     carries "18171 Biscayne". No exemption — the bio page passes too.
//
//   CHECK F — MOBI-07 blog-post closing Book/Call band (14 /blog/<slug> URLs @ 375px).
//     Added by 05-03 (the FINAL extension). Each blog post's LAST <section> inside <main>
//     (its closing content band, before <footer>) carries at least one clickable anchor whose
//     href is the PatientsReach Book URL OR starts with tel:, each with a non-zero rendered box.
//     SCOPED TO <main>: the header/nav chrome (before <main>) AND the fixed .adc-cta-bar sticky
//     control (after </main>) are BOTH excluded — so this proves the in-article band, not the
//     chrome. This is the T-05-12 DoS mitigation: 13/14 posts closed with unclickable
//     "contact us today" text and nothing to tap. Applies to /blog/<slug> only (not the /blog
//     listing). After this extension, ONE run proves MOBI-02..07 on all 54 URLs.
//
// Server: reuses qa-redirect-coverage.mjs's vercel.json-aware resolveFile() +
//   http.createServer() block verbatim (handles /services/:slug, /blog/:slug,
//   /team/:slug, /locations/:city and the root pages), bound to 127.0.0.1 on an
//   ephemeral port, with the path-traversal guard intact.
// Browser: playwright-core from the pinned LocalGrid install, system Chrome.
//
// Usage: node scripts/qa-mobile-conversion.mjs
// Prints a JSON summary and exits 0 iff failed === 0 (and the exemption set matches).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/Users/judykim/Desktop/JUDY_KIM/BUSINESS/projects/LocalGrid/node_modules/playwright-core/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// The ONE declared, size-asserted phone-bar exemption: the design-system orphan bio
// page carries no .cta-header at all (rebuilt in Phase 8 / DSYS-01,02). It is NOT skipped
// silently — the set of cta-header-less pages must equal this list exactly, so any OTHER
// page that loses its .cta-header fails. This is the ONLY size-asserted exemption in the
// gate; CHECK A (overflow) has NO exemptions of any kind.
const NO_CTA_HEADER_EXEMPT = [];
if (NO_CTA_HEADER_EXEMPT.length !== 0) {
  console.error(JSON.stringify({ error: `NO_CTA_HEADER_EXEMPT must be empty post-Phase-8 (bio page now carries the shared cta-header), has ${NO_CTA_HEADER_EXEMPT.length}` }));
  process.exit(1);
}

// CHECK A overflow sweep — the three widths the phase success criteria name. NO ALLOWLIST.
const OVERFLOW_WIDTHS = [
  { w: 320, h: 568 },
  { w: 375, h: 812 },
  { w: 768, h: 1024 },
];

// CHECK B phone-bar sweep widths (all <=480, so the email is display:none across the set).
const PHONE_BAR_WIDTHS = [320, 360, 375, 390, 414];

// ── Load vercel.json (for the copied resolveFile/server block) ────────────────
const vercelConfig = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'vercel.json'), 'utf8')
);
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

// ── Pattern matcher (verbatim from qa-redirect-coverage.mjs) ──────────────────
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
    if (rx.test(pathname)) {
      return rule.destination;
    }
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
        dest = dest
          .replace(/:([a-zA-Z]+)\*/g, m[1])
          .replace(/:([a-zA-Z]+)/g, m[1]);
      }
      return dest;
    }
  }
  return null;
}

// ── File resolver (verbatim from qa-redirect-coverage.mjs) ────────────────────
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

// ── HTTP server (verbatim from qa-redirect-coverage.mjs) ──────────────────────
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

// ── Enumerate all 54 sitemap URLs, origin-stripped ────────────────────────────
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

// Wait for same-origin images to finish loading so layout (overflow) is accurate,
// without hanging on cross-origin iframes (Google Maps) that never fire load here.
async function settleImages(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const imgs = Array.from(document.images).filter((i) => !i.complete);
        if (imgs.length === 0) return resolve();
        let n = imgs.length;
        const done = () => { if (--n <= 0) resolve(); };
        imgs.forEach((i) => {
          i.addEventListener('load', done);
          i.addEventListener('error', done);
        });
        setTimeout(resolve, 5000);
      })
  );
}

// ── Check one URL ─────────────────────────────────────────────────────────────
async function checkUrl(context, port, urlPath) {
  const isCtaExempt = NO_CTA_HEADER_EXEMPT.includes(urlPath);
  const url = `http://127.0.0.1:${port}${urlPath}`;
  const page = await context.newPage();
  const reasons = [];
  const overflowByWidth = {};
  let status = 0;
  let hasCtaHeader = false;
  let mobi04Fail = false; // CHECK D — Call/Book not visible+tappable after scroll
  let mobi05Fail = false; // CHECK E — footer address not a maps/dir anchor
  let mobi07Applies = false; // CHECK F — only /blog/<slug> posts
  let mobi07Fail = false; // CHECK F — blog post's closing in-<main> section lacks a Book/Call anchor

  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    status = resp ? resp.status() : 0;
  } catch (e) {
    reasons.push(`nav-error: ${e.message.split('\n')[0]}`);
  }

  if (status !== 200) reasons.push(`http-status ${status}`);

  await settleImages(page);

  // ── CHECK A — MOBI-02 overflow invariant (320/375/768). NO exemptions. ──────
  for (const { w, h } of OVERFLOW_WIDTHS) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(150);
    const delta = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    overflowByWidth[w] = delta;
    if (delta > 0) reasons.push(`overflow@${w} +${delta}`);
  }

  // Detect the utility bar presence.
  hasCtaHeader = (await page.$('.cta-header')) !== null;

  // ── CHECK B — MOBI-03 phone bar (320/360/375/390/414). ──────────────────────
  if (!hasCtaHeader) {
    if (!isCtaExempt) {
      reasons.push('missing-cta-header (not on the exemption list)');
    }
    // exempt + no cta-header → correct; nothing more to assert.
  } else {
    if (isCtaExempt) {
      // The exemption is now stale — this page regained a .cta-header. Surface it.
      reasons.push('exempt-page-now-has-cta-header (remove from NO_CTA_HEADER_EXEMPT)');
    }
    for (const w of PHONE_BAR_WIDTHS) {
      await page.setViewportSize({ width: w, height: 812 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(120);
      const m = await page.evaluate(() => {
        const tel = document.querySelector('.cta-header a[href^="tel"]');
        const els = Array.from(document.querySelectorAll('.cta-header *'));
        let maxRight = 0;
        for (const el of els) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && r.right > maxRight) maxRight = r.right;
        }
        const t = tel ? tel.getBoundingClientRect() : null;
        return {
          tel: t ? { top: t.top, bottom: t.bottom, height: t.height, right: t.right } : null,
          maxRight,
        };
      });
      if (!m.tel) {
        reasons.push(`no-tel-link@${w}`);
        continue;
      }
      // ONE unwrapped line (2-3 wrapped lines measured ~44-67px today).
      if (m.tel.height > 28) {
        reasons.push(`phone-wrapped@${w} (tel height ${Math.round(m.tel.height)}px > 28)`);
      }
      // Inside the 48px bar.
      if (!(m.tel.top >= -2 && m.tel.bottom <= 50)) {
        reasons.push(`phone-outside-bar@${w} (top ${Math.round(m.tel.top)} bottom ${Math.round(m.tel.bottom)})`);
      }
      // No .cta-header element overhangs the viewport (the nowrap-only-regression guard).
      if (m.maxRight > w + 1) {
        reasons.push(`cta-overhang@${w} (right ${Math.round(m.maxRight)} > ${w})`);
      }
    }
  }

  // ── CHECK C — MOBI-06 homepage rating badge (only /). ───────────────────────
  if (urlPath === '/') {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(120);
    const badge = await page.evaluate(() => {
      const el = document.querySelector('.hero__rating');
      if (!el) return { present: false };
      const r = el.getBoundingClientRect();
      const text = el.innerText || '';
      let agg = null;
      for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          const data = JSON.parse(s.textContent);
          const nodes = Array.isArray(data) ? data : [data];
          for (const n of nodes) {
            if (n && n.aggregateRating) { agg = n.aggregateRating; break; }
          }
          if (agg) break;
        } catch { /* ignore non-JSON blocks */ }
      }
      return { present: true, width: r.width, height: r.height, text, agg };
    });

    if (!badge.present) {
      reasons.push('badge-missing (.hero__rating not found)');
    } else {
      if (!(badge.width > 0 && badge.height > 0)) {
        reasons.push(`badge-zero-box@375 (w=${Math.round(badge.width)} h=${Math.round(badge.height)})`);
      }
      const shownRating = (badge.text.match(/(\d\.\d)/) || [])[1] || null;
      const shownCount = (badge.text.match(/(\d{2,4})\s+Google reviews/) || [])[1] || null;
      if (!badge.agg) {
        reasons.push('no-aggregateRating-json-ld (nothing to compare the badge to)');
      } else {
        if (shownRating !== badge.agg.ratingValue) {
          reasons.push(`badge-rating-mismatch (shown ${shownRating} != json-ld ratingValue ${badge.agg.ratingValue})`);
        }
        if (shownCount !== badge.agg.reviewCount) {
          reasons.push(`badge-count-mismatch (shown ${shownCount} != json-ld reviewCount ${badge.agg.reviewCount})`);
        }
      }
    }
  }

  // ── CHECK D — MOBI-04 Call + Book visible + tappable after scroll (ALL 54 @375). ──
  // 05-02 extension. The fixed self-contained sticky bar must present a one-tap Call
  // AND a one-tap Book, each with a non-zero box FULLY inside the 375px viewport, and
  // each un-covered (elementFromPoint at its centre resolves to the anchor or a
  // descendant), at any scroll depth (bottom + mid). This is the T-05-06 DoS mitigation:
  // "no visible call/book after scroll" is the exact defect. NO exemption — the bio page
  // must pass too (it carries the self-contained bar + its own <style>, so it renders
  // with no project CSS). This check also proves the FAB/footer do not overlap the bar.
  await page.setViewportSize({ width: 375, height: 812 });
  for (const depth of ['bottom', 'mid']) {
    await page.evaluate((d) => {
      const y = d === 'bottom'
        ? document.body.scrollHeight
        : Math.floor(document.body.scrollHeight / 2);
      window.scrollTo(0, y);
    }, depth);
    await page.waitForTimeout(150);
    const cta = await page.evaluate(() => {
      const VW = 375, VH = 812;
      function probe(sel) {
        const a = document.querySelector(sel);
        if (!a) return { found: false };
        const r = a.getBoundingClientRect();
        const inViewport =
          r.width > 0 && r.height > 0 &&
          r.left >= 0 && r.right <= VW && r.top >= 0 && r.bottom <= VH;
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const hit = document.elementFromPoint(cx, cy);
        const tappable = !!hit && (hit === a || a.contains(hit));
        return {
          found: true, inViewport, tappable,
          rect: {
            w: Math.round(r.width), h: Math.round(r.height),
            left: Math.round(r.left), right: Math.round(r.right),
            top: Math.round(r.top), bottom: Math.round(r.bottom),
          },
          hit: hit ? (hit.tagName + (hit.className && typeof hit.className === 'string' ? '.' + hit.className.split(' ')[0] : '')) : null,
        };
      }
      return {
        call: probe('.adc-cta-bar a[href^="tel:"]'),
        book: probe('.adc-cta-bar a[href*="patientsreach"]'),
      };
    });
    for (const [name, c] of [['call', cta.call], ['book', cta.book]]) {
      if (!c.found) {
        reasons.push(`${name}-missing-in-bar@${depth}`);
        mobi04Fail = true;
      } else {
        if (!c.inViewport) {
          reasons.push(`${name}-not-in-viewport@${depth} (${JSON.stringify(c.rect)})`);
          mobi04Fail = true;
        }
        if (!c.tappable) {
          reasons.push(`${name}-not-tappable@${depth} (covered by ${c.hit})`);
          mobi04Fail = true;
        }
      }
    }
  }

  // ── CHECK E — MOBI-05 footer address is a maps/dir anchor (ALL 54). ─────────────
  // 05-02 extension. The footer address must be an <a> whose href points at Google Maps
  // directions and whose text carries the street address. NO exemption — the bio page
  // must pass too.
  const addr = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href*="google.com/maps/dir"]'));
    const matches = anchors.filter((a) => (a.textContent || '').includes('18171 Biscayne'));
    return { anchors: anchors.length, matches: matches.length };
  });
  if (addr.matches < 1) {
    reasons.push('no-maps-dir-address-anchor (footer address is not a directions link)');
    mobi05Fail = true;
  }

  // ── CHECK F — MOBI-07 blog-post closing Book/Call band (14 /blog/<slug> @375). ──
  // 05-03 extension (FINAL). The blog post's LAST <section> inside <main> — its closing
  // content band, before <footer> — must carry at least one clickable Book (PatientsReach)
  // OR Call (tel:) anchor with a non-zero rendered box. SCOPED TO <main> so it proves the
  // in-article band, NOT the fixed .adc-cta-bar sticky control (which lives after </main>,
  // i.e. outside <main>) nor the header/nav chrome (before <main>). Applies to /blog/<slug>
  // posts only — the /blog listing is skipped. T-05-12 DoS mitigation (dead-end blog close).
  if (urlPath.startsWith('/blog/')) {
    mobi07Applies = true;
    await page.setViewportSize({ width: 375, height: 812 });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(120);
    const blog = await page.evaluate(() => {
      const main = document.querySelector('main');
      if (!main) return { hasMain: false };
      const SEL = 'a[href*="patientsreach.com/schedule"], a[href^="tel:"]';
      const visible = (a) => { const r = a.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const sections = Array.from(main.querySelectorAll('section'));
      const last = sections.length ? sections[sections.length - 1] : null;
      const lastCta = last ? Array.from(last.querySelectorAll(SEL)).filter(visible) : [];
      const book = lastCta.filter((a) => /patientsreach/.test(a.getAttribute('href') || '')).length;
      const call = lastCta.filter((a) => (a.getAttribute('href') || '').startsWith('tel:')).length;
      const inMainCta = Array.from(main.querySelectorAll(SEL)).filter(visible).length;
      return { hasMain: true, hasLastSection: !!last, lastSectionCtaCount: lastCta.length, book, call, inMainCta };
    });
    if (!blog.hasMain) {
      reasons.push('blog-no-main (cannot scope the closing CTA band)');
      mobi07Fail = true;
    } else if (!blog.hasLastSection) {
      reasons.push('blog-no-section-in-main (no <section> to close the article)');
      mobi07Fail = true;
    } else if (blog.lastSectionCtaCount < 1) {
      reasons.push('blog-no-cta-in-closing-section (no clickable Book/Call anchor inside <main> at the post close)');
      mobi07Fail = true;
    }
  }

  await page.close();

  return { url: urlPath, isCtaExempt, hasCtaHeader, status, overflowByWidth, reasons, mobi04Fail, mobi05Fail, mobi07Applies, mobi07Fail };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  const urls = sitemapPaths();

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });

  const results = [];
  for (const urlPath of urls) {
    results.push(await checkUrl(context, port, urlPath));
  }

  await browser.close();
  await new Promise((resolve) => server.close(resolve));

  // Hard-assert the cta-header-less set equals the exemption list exactly.
  const missingCtaHeader = results.filter((r) => !r.hasCtaHeader).map((r) => r.url).sort();
  const exemptSorted = [...NO_CTA_HEADER_EXEMPT].sort();
  const setsEqual =
    missingCtaHeader.length === exemptSorted.length &&
    missingCtaHeader.every((u, i) => u === exemptSorted[i]);
  const setMismatch = setsEqual ? null : { missingCtaHeader, expected: exemptSorted };

  // CHECK A overflow counts per width — exemption-free. Re-measured now that a
  // position:fixed sticky bar exists on all 54 (Specific Trap #5): a bar off by a
  // pixel would reintroduce the exact /locations overflow defect MOBI-02 closed.
  const overflow = { 320: 0, 375: 0, 768: 0 };
  for (const r of results) {
    for (const wKey of Object.keys(overflow)) {
      const d = r.overflowByWidth[wKey];
      if (typeof d === 'number' && d > 0) overflow[wKey]++;
    }
  }

  // CHECK D / CHECK E pass counts (05-02 extension) — no exemptions.
  let mobi04Pass = 0;
  let mobi05Pass = 0;
  for (const r of results) {
    if (!r.mobi04Fail) mobi04Pass++;
    if (!r.mobi05Fail) mobi05Pass++;
  }

  // CHECK F pass count (05-03 extension) — scoped to the 14 /blog/<slug> posts only.
  let mobi07Pass = 0;
  let mobi07Total = 0;
  for (const r of results) {
    if (r.mobi07Applies) { mobi07Total++; if (!r.mobi07Fail) mobi07Pass++; }
  }

  const failures = [];
  let passed = 0;
  let exempt = 0;
  for (const r of results) {
    if (r.isCtaExempt) exempt++;
    if (r.reasons.length === 0) {
      passed++;
    } else {
      failures.push({
        url: r.url,
        reason: r.reasons.join('; '),
        detail: { status: r.status, overflow: r.overflowByWidth, ctaExempt: r.isCtaExempt },
      });
    }
  }
  const failed = failures.length;

  const summary = {
    total: results.length,
    passed,
    failed,
    exempt,
    exemptUrls: NO_CTA_HEADER_EXEMPT,
    setMismatch,
    overflow: { 320: overflow[320], 375: overflow[375], 768: overflow[768] },
    mobi04: { callBookVisibleAfterScroll: mobi04Pass, total: results.length },
    mobi05: { footerAddressAnchor: mobi05Pass, total: results.length },
    mobi07: { blogCtaInMain: mobi07Pass, total: mobi07Total },
    failures,
  };

  console.log(JSON.stringify(summary, null, 2));

  const ok = failed === 0 && setsEqual;
  process.exit(ok ? 0 : 1);
}

run().catch((err) => {
  console.error(JSON.stringify({ error: err.message }, null, 2));
  try { server.close(); } catch {}
  process.exit(1);
});
