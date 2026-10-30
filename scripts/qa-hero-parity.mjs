// qa-hero-parity.mjs — Desktop hero-geometry baseline + regression gate (MOBI-01 guard).
//
// The MOBI-01 fix changes the 17 service-page hero <img> inline style from
// `max-width:800px` to `max-width:min(100%, 800px)`. That must fix mobile with
// ZERO change to the desktop render. This script proves the "zero desktop change"
// half: it captures the exact rendered geometry of every service hero at 1440x900
// BEFORE the edit (--baseline), and afterwards diffs against it (--check).
//
// Usage:
//   node scripts/qa-hero-parity.mjs --baseline   # writes hero-baseline.json, always exit 0
//   node scripts/qa-hero-parity.mjs --check      # diffs against the JSON, exit 1 on ANY delta
//
// Server: reuses qa-redirect-coverage.mjs's vercel.json-aware resolveFile() +
//   http.createServer() block verbatim, so the local server mirrors Vercel's
//   /services/:slug -> /SERVICES/:slug.html rewrite.
// Browser: playwright-core from the pinned LocalGrid install (no browser download),
//   launched { channel: 'chrome', headless: true } — same as qa-render.mjs.
//
// The hero is selected deterministically: the FIRST <img> inside <main> whose inline
// `style` attribute contains `max-width`. There must be exactly one per page; 0 or >1
// is a hard error naming the slug (never silently measure the wrong element).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/Users/judykim/Desktop/JUDY_KIM/BUSINESS/projects/LocalGrid/node_modules/playwright-core/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const BASELINE_PATH = path.join(
  REPO_ROOT,
  '.planning',
  'phases',
  '04-launch-gate-mobile-nav-recovery-the-void-page',
  'hero-baseline.json'
);

// ── CLI mode ────────────────────────────────────────────────────────────────
const MODE = process.argv.includes('--baseline')
  ? 'baseline'
  : process.argv.includes('--check')
  ? 'check'
  : null;
if (!MODE) {
  console.error('Usage: node scripts/qa-hero-parity.mjs --baseline | --check');
  process.exit(2);
}

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

// ── Enumerate the 17 service slugs from sitemap.xml ───────────────────────────
function serviceSlugs() {
  const xml = fs.readFileSync(path.join(REPO_ROOT, 'sitemap.xml'), 'utf8');
  const slugs = [];
  for (const m of xml.matchAll(/<loc>https?:\/\/[^/]+(\/[^<]+)<\/loc>/g)) {
    const p = m[1].replace(/\/$/, '');
    const svc = p.match(/^\/services\/([^/]+)$/);
    if (svc) slugs.push(svc[1]);
  }
  return slugs.sort();
}

// ── Measure the hero image on one service page (desktop context) ──────────────
async function measureHero(context, port, slug) {
  const page = await context.newPage();
  const url = `http://127.0.0.1:${port}/services/${slug}`;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    await page.close();
    return { error: `nav: ${e.message.split('\n')[0]}` };
  }

  const data = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('main img')).filter((im) => {
      const s = im.getAttribute('style') || '';
      return s.includes('max-width');
    });
    if (imgs.length !== 1) return { count: imgs.length };
    const img = imgs[0];
    const r = img.getBoundingClientRect();
    // Round to whole CSS pixels. Chrome accumulates sub-pixel error under the
    // max-width cap (e.g. 799.98 for a 1536px asset capped at 800px); that noise
    // is not a meaningful "desktop pixel" change, and the regression class this
    // gate defends against (620 -> 800 upscale = +180px, 800 -> 1152 growth = +352px)
    // is orders of magnitude above 1px. Rounding is deterministic per-render, so the
    // baseline-vs-recheck exact diff stays valid and non-flaky.
    return {
      renderedWidth: Math.round(r.width),
      renderedHeight: Math.round(r.height),
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      src: img.getAttribute('src'),
    };
  });

  await page.close();

  if (data.count !== undefined) {
    return { error: `expected exactly 1 <main> img with inline max-width, found ${data.count}` };
  }
  return data;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  const slugs = serviceSlugs();
  if (slugs.length !== 17) {
    console.error(JSON.stringify({ error: `expected 17 service slugs, found ${slugs.length}`, slugs }, null, 2));
    process.exit(1);
  }

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  // DESKTOP context only — plain 1440x900 viewport, no mobile emulation, no touch.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  const measured = {};
  const errors = [];
  for (const slug of slugs) {
    const m = await measureHero(context, port, slug);
    if (m.error) {
      errors.push({ slug, error: m.error });
    } else {
      measured[slug] = m;
    }
  }

  await browser.close();
  await new Promise((resolve) => server.close(resolve));

  if (errors.length) {
    console.error(JSON.stringify({ mode: MODE, errors }, null, 2));
    process.exit(1);
  }

  if (MODE === 'baseline') {
    const out = {
      capturedAt: new Date().toISOString(),
      viewport: '1440x900',
      pages: measured,
    };
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(out, null, 2) + '\n');
    console.log(JSON.stringify(
      { mode: 'baseline', wrote: path.relative(REPO_ROOT, BASELINE_PATH), pageCount: Object.keys(measured).length },
      null,
      2
    ));
    process.exit(0);
  }

  // MODE === 'check' — diff against the baseline.
  if (!fs.existsSync(BASELINE_PATH)) {
    console.error(JSON.stringify({ error: `baseline missing: ${path.relative(REPO_ROOT, BASELINE_PATH)}` }, null, 2));
    process.exit(1);
  }
  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  const rows = [];
  const deltas = [];

  const allSlugs = new Set([...Object.keys(baseline.pages), ...Object.keys(measured)]);
  for (const slug of [...allSlugs].sort()) {
    const b = baseline.pages[slug];
    const a = measured[slug];
    if (!b) {
      deltas.push({ slug, reason: 'not in baseline' });
      rows.push(`${slug}  MISSING-IN-BASELINE`);
      continue;
    }
    if (!a) {
      deltas.push({ slug, reason: 'not measured now' });
      rows.push(`${slug}  MISSING-NOW`);
      continue;
    }
    const wOK = a.renderedWidth === b.renderedWidth;
    const hOK = a.renderedHeight === b.renderedHeight;
    const nOK = a.naturalWidth === b.naturalWidth;
    if (wOK && hOK && nOK) {
      rows.push(`${slug}  ${b.renderedWidth}x${b.renderedHeight} -> ${a.renderedWidth}x${a.renderedHeight}  OK`);
    } else {
      rows.push(
        `${slug}  ${b.renderedWidth}x${b.renderedHeight} (nat ${b.naturalWidth}) -> ` +
        `${a.renderedWidth}x${a.renderedHeight} (nat ${a.naturalWidth})  DELTA`
      );
      deltas.push({
        slug,
        renderedWidth: `${b.renderedWidth} -> ${a.renderedWidth}`,
        renderedHeight: `${b.renderedHeight} -> ${a.renderedHeight}`,
        naturalWidth: `${b.naturalWidth} -> ${a.naturalWidth}`,
      });
    }
  }

  console.log('slug  before -> after  status');
  for (const r of rows) console.log('  ' + r);
  console.log(JSON.stringify(
    { mode: 'check', viewport: baseline.viewport, total: rows.length, deltas: deltas.length, deltaDetail: deltas },
    null,
    2
  ));

  process.exit(deltas.length === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error(JSON.stringify({ error: err.message }, null, 2));
  try { server.close(); } catch {}
  process.exit(1);
});
