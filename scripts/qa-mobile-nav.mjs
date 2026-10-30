// qa-mobile-nav.mjs — MOBI-01 mobile-navigation tap gate.
//
// Proves, under REAL mobile emulation (isMobile + hasTouch, 375x812, DSF 3), that a
// genuine touch tap on the hamburger opens the mobile drawer on every drawer-bearing
// sitemap URL — at scroll 0 AND from a scrolled position — and that no page scrolls
// horizontally at 320, 375, or 768. This is the direct guard for the milestone's one
// CRITICAL defect: the inline max-width:800px on the 17 service heroes widened the
// layout viewport, sized the position:fixed header to it, and pushed the hamburger
// off-screen (x=568 / x=748) where a fixed element cannot be panned back into view.
//
// Server: reuses qa-redirect-coverage.mjs's vercel.json-aware resolveFile() +
//   http.createServer() block verbatim (handles /services/:slug, /blog/:slug,
//   /team/:slug, /locations/:city and the root pages).
// Browser: playwright-core from the pinned LocalGrid install, system Chrome.
//
// Drawer contract (assets/js/nav.js): toggle = .nav-mobile-toggle (a <button>),
//   drawer = #mobileNav, open state = #mobileNav.classList.contains('is-open').
//
// There are no exemptions: every page — including the former design-system orphan
// /team/dr-david-bistritz, now rebuilt on the shared chrome (Phase 8 DSYS-01,02) and
// carrying the standard .nav-mobile-toggle — must expose the drawer toggle. The set of
// toggle-less pages must equal the (empty) exemption list exactly, so any page that
// falls out of the drawer system fails.
//
// Usage: node scripts/qa-mobile-nav.mjs
// Prints a JSON summary and exits 0 iff failed === 0.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/Users/judykim/Desktop/JUDY_KIM/BUSINESS/projects/LocalGrid/node_modules/playwright-core/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// No exemptions: the former orphan /team/dr-david-bistritz now rides the shared chrome
// (Phase 8 DSYS-01/02) and carries the standard .nav-mobile-toggle like every other page.
const NO_TOGGLE_EXEMPT = [];
if (NO_TOGGLE_EXEMPT.length !== 0) {
  console.error(JSON.stringify({ error: `NO_TOGGLE_EXEMPT must be empty, has ${NO_TOGGLE_EXEMPT.length}` }));
  process.exit(1);
}

// Pre-existing overflow that is OUT-OF-SCOPE for MOBI-01 (plan 04-01 owns only the 17
// /services/* hero pages). A single hard-coded, documented allowance — surfaced loudly in
// the JSON under `knownPreexistingOverflow`, NEVER silently skipped, and it does NOT mask a
// service-page regression (any overflow not listed here still fails the gate; see the Task 3
// negative test). Recorded in deferred-items.md.
//
//   /locations @320: its .location-hero-card grid uses 352px cards (+16px side margins = 368)
//   that do not shrink below a ~360px viewport, forcing scrollWidth to 369 at a 320px client.
//   This is a locations-hub layout defect, not the service-page hero defect, and is deferred to
//   the Phase 5 mobile-conversion hardening (MOBI-02..07). At 375 and 768 it is clean.
const OVERFLOW_KNOWN_PREEXISTING = {
  '/locations': [320],
};
function isKnownOverflow(urlPath, width) {
  return (OVERFLOW_KNOWN_PREEXISTING[urlPath] || []).includes(width);
}

// Overflow sweep widths — all three the phase success criteria name.
const OVERFLOW_WIDTHS = [
  { w: 320, h: 568 },
  { w: 375, h: 812 },
  { w: 768, h: 1024 },
];

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
  const isExempt = NO_TOGGLE_EXEMPT.includes(urlPath);
  const url = `http://127.0.0.1:${port}${urlPath}`;
  const page = await context.newPage();
  const reasons = [];
  const overflowByWidth = {};
  const knownOverflow = [];
  let status = 0;
  let hasToggle = false;

  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    status = resp ? resp.status() : 0;
  } catch (e) {
    reasons.push(`nav-error: ${e.message.split('\n')[0]}`);
  }

  if (status !== 200) reasons.push(`http-status ${status}`);

  await settleImages(page);

  // (b) Overflow sweep at 320/375/768.
  for (const { w, h } of OVERFLOW_WIDTHS) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(150);
    const delta = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    overflowByWidth[w] = delta;
    if (delta > 0) {
      if (isKnownOverflow(urlPath, w)) {
        knownOverflow.push({ url: urlPath, width: w, delta });
      } else {
        reasons.push(`overflow@${w} +${delta}`);
      }
    }
  }
  // Leave viewport at 375x812 for the tap assertions.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(100);

  // (c) Toggle presence.
  hasToggle = (await page.$('.nav-mobile-toggle')) !== null;

  if (!hasToggle) {
    if (!isExempt) {
      reasons.push('missing-toggle (not on the exemption list)');
    }
    // exempt + no toggle → correct; nothing more to assert.
  } else {
    if (isExempt) {
      // The exemption is now stale — this page regained a toggle. Surface it.
      reasons.push('exempt-page-now-has-toggle (remove from NO_TOGGLE_EXEMPT)');
    }

    // (d) Toggle on-screen at 375px — the direct MOBI-01 invariant.
    const rect = await page.evaluate(() => {
      const el = document.querySelector('.nav-mobile-toggle');
      const r = el.getBoundingClientRect();
      return { x: r.x, width: r.width, right: r.x + r.width };
    });
    const onScreen = rect.x >= 0 && rect.right <= 375;
    if (!onScreen) {
      reasons.push(`toggle-offscreen (x=${Math.round(rect.x)} right=${Math.round(rect.right)} > 375)`);
    }

    // (e) Real tap at scroll 0 opens the drawer.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(50);
    let openedAt0 = false;
    try {
      await page.tap('.nav-mobile-toggle', { timeout: 5000 });
      openedAt0 = await page.evaluate(
        () => !!document.getElementById('mobileNav') &&
              document.getElementById('mobileNav').classList.contains('is-open')
      );
    } catch (e) {
      reasons.push(`tap@0-failed: ${e.message.split('\n')[0]}`);
    }
    if (!openedAt0 && !reasons.some((r) => r.startsWith('tap@0-failed'))) {
      reasons.push('drawer-did-not-open@0 (#mobileNav lacks .is-open after tap)');
    }

    // Reset drawer state directly, then scroll mid-page and tap again.
    await page.evaluate(() => {
      const n = document.getElementById('mobileNav');
      if (n) n.classList.remove('is-open');
      document.body.style.overflow = '';
    });
    await page.evaluate(() => window.scrollTo(0, Math.round(document.body.scrollHeight / 2)));
    await page.waitForTimeout(100);
    let openedAtMid = false;
    try {
      await page.tap('.nav-mobile-toggle', { timeout: 5000 });
      openedAtMid = await page.evaluate(
        () => !!document.getElementById('mobileNav') &&
              document.getElementById('mobileNav').classList.contains('is-open')
      );
    } catch (e) {
      reasons.push(`tap@mid-failed: ${e.message.split('\n')[0]}`);
    }
    if (!openedAtMid && !reasons.some((r) => r.startsWith('tap@mid-failed'))) {
      reasons.push('drawer-did-not-open@mid (fixed toggle should still work after scroll)');
    }
  }

  await page.close();

  return { url: urlPath, isExempt, hasToggle, status, overflowByWidth, knownOverflow, reasons };
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

  // Hard-assert the toggle-less set equals the exemption list exactly.
  const missingToggle = results.filter((r) => !r.hasToggle).map((r) => r.url).sort();
  const exemptSorted = [...NO_TOGGLE_EXEMPT].sort();
  const setsEqual =
    missingToggle.length === exemptSorted.length &&
    missingToggle.every((u, i) => u === exemptSorted[i]);
  const setMismatch = setsEqual
    ? null
    : { missingToggle, expected: exemptSorted };

  // Overflow counts = IN-SCOPE (non-allowlisted) overflow failures per width.
  const overflow = { 320: 0, 375: 0, 768: 0 };
  const knownPreexistingOverflow = [];
  for (const r of results) {
    for (const e of r.knownOverflow) knownPreexistingOverflow.push(e);
    for (const wKey of Object.keys(overflow)) {
      const w = Number(wKey);
      const d = r.overflowByWidth[wKey];
      if (typeof d === 'number' && d > 0 && !isKnownOverflow(r.url, w)) overflow[wKey]++;
    }
  }

  const failures = [];
  let passed = 0;
  let exempt = 0;
  for (const r of results) {
    if (r.reasons.length === 0) {
      if (r.isExempt) exempt++;
      else passed++;
    } else {
      failures.push({
        url: r.url,
        reason: r.reasons.join('; '),
        detail: { status: r.status, overflow: r.overflowByWidth, exempt: r.isExempt },
      });
    }
  }
  const failed = failures.length;

  const summary = {
    total: results.length,
    passed,
    exempt,
    failed,
    exemptUrls: NO_TOGGLE_EXEMPT,
    setMismatch,
    overflow: { 320: overflow[320], 375: overflow[375], 768: overflow[768] },
    knownPreexistingOverflow,
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
