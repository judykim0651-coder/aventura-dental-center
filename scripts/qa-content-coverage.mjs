// qa-content-coverage.mjs — CORD-04 / CORD-05 sitemap content-coverage gate.
//
// Proves, for EVERY one of the 54 URLs in sitemap.xml, visited at its SERVED CLEAN
// URL (e.g. /blog/modern-dental-fillings, never the on-disk file path):
//   (a) HTTP 200,
//   (b) a non-empty <h1> text node,
//   (c) a <main> content region within its page-family length band
//       (hard floor 500 chars AND >= 0.25 * family median), null-guarded so a page
//       with no <main> throws a clean failure instead of killing the whole run,
//   (d) every <img> actually loads — asserted AFTER forcing lazy images into the
//       viewport, so a below-the-fold loading="lazy" image that has simply not
//       loaded yet is never mistaken for a broken one.
//
// Two out-of-phase pages are DECLARED, size-asserted exemptions from the mainChars
// assertion ONLY (they still must pass 200 + non-empty h1 + the image gate):
//   /team/dr-david-bistritz — DSYS-01, Phase 8 — has NO <main> element at all.
//   /contact                — CORD-02, Phase 9 — GoHighLevel iframe text is not in
//                             the parent document's innerText (measures ~475 chars).
// A THIRD page losing its <main> or going thin FAILS the gate — it is not absorbed.
//
// Server: reuses qa-redirect-coverage.mjs's vercel.json-aware resolveFile() +
//   http.createServer() block verbatim (it applies the /blog/:slug rewrite, so the
//   clean URL resolves to the on-disk blog file). qa-render.mjs's server only knows
//   /services/:slug and would 404 every blog URL — do not use it here.
// Browser: system Chrome via playwright-core from the pinned LocalGrid install.
//
// EVERY in-page wait is bounded (see withTimeout + the constants below): a lazy image
// that never enters the viewport never settles, so an unbounded wait would wedge the
// gate forever. The run always terminates and always prints its JSON verdict.
//
// Usage: node scripts/qa-content-coverage.mjs
// Prints a JSON summary and exits 0 iff failed === 0.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/Users/judykim/Desktop/JUDY_KIM/BUSINESS/projects/LocalGrid/node_modules/playwright-core/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// ── Declared, size-asserted exemptions (mirror qa-mobile-nav.mjs's NO_TOGGLE_EXEMPT) ──
// Exempt from the mainChars assertion ONLY. Still must pass 200 + non-empty h1 + image gate.
const NO_MAIN_EXEMPT   = ['/team/dr-david-bistritz']; // DSYS-01, Phase 8 — page has NO <main> at all
const THIN_MAIN_EXEMPT = ['/contact'];                // CORD-02, Phase 9 — GHL iframe text is not in parent innerText

if (NO_MAIN_EXEMPT.length !== 1 || THIN_MAIN_EXEMPT.length !== 1) {
  console.error(JSON.stringify({ error: 'Exemption list grew — a 3rd page must NOT be waved through. Fix the page or split the phase.' }));
  process.exit(1);
}

// ── Content thresholds — MEASURED. Do not lower the floor globally to accommodate /contact. ──
const HARD_FLOOR      = 500;   // absolute minimum main chars for any non-exempt page
const RELATIVE_FACTOR = 0.25;  // and >= 0.25 * family median
const BLOG_POST_MIN   = 12000; // named assertion for the restored void page

// ── Timing constants — MEASURED against the live site. Do not lower. ──
const NAV_TIMEOUT_MS   = 20000;  // page.goto
const SCROLL_DWELL_MS  = 400;    // per step. 120ms measured INSUFFICIENT (re-defers lazy images).
const SCROLL_BUDGET_MS = 15000;  // hard cap on the forcing pass
const IMG_SETTLE_MS    = 15000;  // hard cap on the post-force settle poll
const EVAL_TIMEOUT_MS  = 30000;  // Node-side backstop: no page.evaluate may EVER hang

const withTimeout = (p, ms, label) => Promise.race([
  p,
  new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout:${label}`)), ms)),
]);

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

// ── Enumerate all 54 sitemap URLs, origin-stripped, at their SERVED clean URLs ─
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

// ── Page family from the URL path ─────────────────────────────────────────────
// blog / services / locations / team = 2-segment clean URLs; everything else = root.
function familyOf(p) {
  if (p === '/') return 'root';
  const seg = p.split('/').filter(Boolean);
  if (seg.length >= 2 && ['blog', 'services', 'locations', 'team'].includes(seg[0])) {
    return seg[0];
  }
  return 'root';
}

function median(nums) {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  const urls = sitemapPaths();

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  const failures = [];
  const fail = (url, reason, detail) => failures.push({ url, reason, detail });

  const records = [];              // { url, family, mainChars, preScrollUnloaded }
  let preScrollUnloadedTotal = 0;
  let brokenAfterForce = 0;

  for (const url of urls) {
    const page = await context.newPage();

    // Record REAL network failures so a genuine 404 is distinguished from a slow load.
    const netFailures = new Map();   // image url -> status | 'requestfailed'
    page.on('response', (r) => {
      if (r.request().resourceType() === 'image' && !r.ok()) netFailures.set(r.url(), r.status());
    });
    page.on('requestfailed', (r) => {
      if (r.resourceType() === 'image') netFailures.set(r.url(), 'requestfailed');
    });

    try {
      const resp = await page.goto(origin + url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
      const status = resp ? resp.status() : 0;
      if (status !== 200) { fail(url, 'bad-status', status); continue; }

      // (b) non-empty <h1> — asserted on ALL 54, no exemptions.
      const h1len = await withTimeout(page.evaluate(() => {
        const el = document.querySelector('h1');
        return el ? el.textContent.trim().length : 0;
      }), EVAL_TIMEOUT_MS, 'h1');
      if (!(h1len > 0)) fail(url, 'empty-h1', { h1len });

      // (c) main content length — null-guarded. NEVER call .innerText on a null element.
      const mainChars = await withTimeout(page.evaluate(() => {
        const mainEl = document.querySelector('main');
        return mainEl ? mainEl.innerText.replace(/\s+/g, ' ').trim().length : null;
      }), EVAL_TIMEOUT_MS, 'main');
      records.push({ url, family: familyOf(url), mainChars });

      // (d.1) anti-tautology evidence: what a NAIVE pre-scroll sweep would have claimed.
      const preScrollUnloaded = await withTimeout(page.evaluate(() =>
        [...document.images].filter((i) => !(i.complete && i.naturalWidth > 0)).length
      ), EVAL_TIMEOUT_MS, 'pre-scroll-count');
      preScrollUnloadedTotal += preScrollUnloaded;

      // (d.2) force lazy images: step-scroll DOWN only, 400ms dwell, self-deadlined.
      //       Settle at the bottom and stay there — returning to the top re-defers the
      //       very images the downward scroll just triggered near the fold.
      await withTimeout(page.evaluate(async ({ dwell, budget }) => {
        const deadline = Date.now() + budget;
        const step = window.innerHeight;
        for (let y = 0; y < document.body.scrollHeight && Date.now() < deadline; y += step) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, dwell));
        }
        window.scrollTo(0, document.body.scrollHeight);
      }, { dwell: SCROLL_DWELL_MS, budget: SCROLL_BUDGET_MS }), EVAL_TIMEOUT_MS, 'force-lazy');

      // (d.3) BOUNDED settle. Poll `complete` against a deadline. `complete` goes true
      //       when the browser is DONE trying: loaded (naturalWidth > 0) OR errored
      //       (naturalWidth === 0). A real 404 exits immediately; only a genuinely
      //       never-loading image burns the full budget.
      const broken = await withTimeout(page.evaluate(async (budget) => {
        const deadline = Date.now() + budget;
        while (Date.now() < deadline && [...document.images].some((i) => !i.complete)) {
          await new Promise((r) => setTimeout(r, 250));
        }
        return [...document.images]
          .filter((i) => !(i.complete && i.naturalWidth > 0))
          .map((i) => ({ src: i.currentSrc || i.src, lazy: i.loading === 'lazy', complete: i.complete }));
      }, IMG_SETTLE_MS), EVAL_TIMEOUT_MS, 'img-settle');

      // (d.4) classify. A recorded network status is definitive.
      for (const img of broken) {
        const status = netFailures.has(img.src)
          ? netFailures.get(img.src)
          : `unresolved-after-${IMG_SETTLE_MS}ms`;
        brokenAfterForce++;
        fail(url, 'broken-image', { src: img.src, lazy: img.lazy, status });
      }
    } catch (e) {
      fail(url, 'page-error', String(e.message));   // this URL fails; the RUN continues
    } finally {
      page.removeAllListeners('response');
      page.removeAllListeners('requestfailed');
      await page.close();
    }
  }

  await browser.close();
  await new Promise((resolve) => server.close(resolve));

  // ── Anti-tautology gate: the forcing pass must have had something to force. ──
  if (preScrollUnloadedTotal === 0) {
    fail('*', 'lazy-forcing-is-a-noop', { preScrollUnloadedTotal });
  }

  // ── Family medians, computed EXCLUDING the exempt URLs so /contact's 475 does not
  //    drag the root median down and mask a real regression elsewhere. ──
  const isExempt = (u) => NO_MAIN_EXEMPT.includes(u) || THIN_MAIN_EXEMPT.includes(u);
  const byFamily = {};
  for (const r of records) {
    if (r.mainChars === null || isExempt(r.url)) continue;
    (byFamily[r.family] ||= []).push(r.mainChars);
  }
  const familyMedians = {};
  for (const fam of Object.keys(byFamily)) familyMedians[fam] = median(byFamily[fam]);

  // ── mainChars assertions (skip the declared exemptions; a NEW offender still fails). ──
  for (const r of records) {
    if (NO_MAIN_EXEMPT.includes(r.url)) {
      // Must genuinely be the no-main page; if it regained a <main>, that is healthier, not a failure.
      continue;
    }
    if (r.mainChars === null) {
      // A page with no <main> that is NOT the declared exemption is a hard failure.
      fail(r.url, 'no-main', { mainChars: null });
      continue;
    }
    if (THIN_MAIN_EXEMPT.includes(r.url)) {
      // Measure + report only; do not fail (CORD-02 owns the fix in Phase 9).
      continue;
    }
    const med = familyMedians[r.family] || 0;
    const threshold = Math.round(RELATIVE_FACTOR * med);
    if (r.mainChars < HARD_FLOOR) {
      fail(r.url, 'thin-content', { mainChars: r.mainChars, floor: HARD_FLOOR, family: r.family, median: med });
    } else if (r.mainChars < threshold) {
      fail(r.url, 'thin-content', { mainChars: r.mainChars, threshold, family: r.family, median: med, ratio: +(r.mainChars / med).toFixed(3) });
    }
    // (e) named assertion for the restored void page.
    if (r.url === '/blog/modern-dental-fillings' && r.mainChars < BLOG_POST_MIN) {
      fail(r.url, 'thin-content', { mainChars: r.mainChars, blogPostMin: BLOG_POST_MIN });
    }
  }

  // ── Report the exempt pages' measured sizes so a future fix is visible. ──
  const exemptMeasured = {};
  for (const u of [...NO_MAIN_EXEMPT, ...THIN_MAIN_EXEMPT]) {
    const r = records.find((x) => x.url === u);
    exemptMeasured[u] = r ? r.mainChars : 'not-reached';
  }

  const passed = urls.length - new Set(failures.filter((f) => f.url !== '*').map((f) => f.url)).size;
  const failed = failures.length;

  const summary = {
    total: urls.length,
    passed,
    failed,
    exempt: { noMain: NO_MAIN_EXEMPT, thinMain: THIN_MAIN_EXEMPT },
    exemptMeasured,
    familyMedians,
    preScrollUnloadedTotal,
    brokenAfterForce,
    blogPostMainChars: (records.find((r) => r.url === '/blog/modern-dental-fillings') || {}).mainChars ?? null,
    failures,
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error(JSON.stringify({ error: err.message }, null, 2));
  try { server.close(); } catch {}
  process.exit(1);
});
