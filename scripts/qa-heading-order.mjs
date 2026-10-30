// qa-heading-order.mjs — Phase 6 (A11Y-11) rendered heading-order gate.
//
// The acceptance gate for A11Y-11 (WCAG 1.3.1 heading structure): axe-core's
// `heading-order` rule must report ZERO violations across all 54 sitemap URLs,
// each rendered in a REAL headless browser (system Chrome via playwright-core).
//
// This is the SOURCE OF TRUTH for the fix, not a hardcoded page list. It walks
// every sitemap URL, injects axe-core, runs ONLY the heading-order rule, and
// enumerates each violating node's selector so Task 2 fixes exactly what axe
// flags — then re-runs to 0. On the pre-fix tree it exits 1 with an `offenders`
// list (the negative baseline that proves the gate bites); after the fixes it
// exits 0 with totalViolations === 0.
//
// Server: reuses qa-mobile-conversion.mjs's vercel.json-aware resolveFile() +
//   http.createServer() + sitemapPaths() block VERBATIM (handles /services/:slug,
//   /blog/:slug, /team/:slug, /locations/:city and the root pages, honoring the
//   clean-URL rewrites), bound to 127.0.0.1 on an ephemeral port, path-traversal
//   guard intact.
// Browser: playwright-core from the pinned LocalGrid install, system Chrome.
// axe-core: source read from the Hidalgo install and injected per page via
//   page.addScriptTag({ content: axeSource }); axe runs only in this ephemeral QA
//   page and is NEVER written into a served file (scripts/ is excluded from deploy).
//
// The bio page /team/dr-david-bistritz IS included in the scan (it is expected to
// PASS heading-order untouched — it is exempt only from the drawer/skip-link fixes,
// not from this axe scan).
//
// Usage: node scripts/qa-heading-order.mjs
// Prints a JSON summary and exits 0 iff totalViolations === 0.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/Users/judykim/Desktop/JUDY_KIM/BUSINESS/projects/LocalGrid/node_modules/playwright-core/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// axe-core source — read from the sibling Hidalgo install (read-only, injected
// into the ephemeral QA page only; never written into any served file).
const AXE_SOURCE_PATH = '/Users/judykim/Desktop/JUDY_KIM/BUSINESS/projects/Hidalgo/node_modules/axe-core/axe.min.js';
const axeSource = fs.readFileSync(AXE_SOURCE_PATH, 'utf8');

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

// ── Run axe heading-order against one URL ─────────────────────────────────────
async function checkUrl(context, port, urlPath) {
  const url = `http://127.0.0.1:${port}${urlPath}`;
  const page = await context.newPage();
  let status = 0;
  let violationCount = 0;
  let nodes = [];
  let error = null;

  try {
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    status = resp ? resp.status() : 0;

    await page.addScriptTag({ content: axeSource });

    const results = await page.evaluate(async () => {
      const r = await window.axe.run(document, {
        runOnly: { type: 'rule', values: ['heading-order'] },
      });
      return {
        violations: r.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            html: n.html,
          })),
        })),
      };
    });

    // heading-order emits ONE violation object whose `nodes` list holds every
    // offending heading; count the nodes so the offender summary is per-heading.
    for (const v of results.violations) {
      violationCount += v.nodes.length;
      for (const n of v.nodes) {
        nodes.push({ target: n.target, html: (n.html || '').slice(0, 160) });
      }
    }
  } catch (e) {
    error = e.message.split('\n')[0];
  }

  await page.close();
  return { url: urlPath, status, violationCount, nodes, error };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  const urls = sitemapPaths();

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();

  const results = [];
  for (const urlPath of urls) {
    results.push(await checkUrl(context, port, urlPath));
  }

  await browser.close();
  await new Promise((resolve) => server.close(resolve));

  let totalViolations = 0;
  const offenders = [];
  const navErrors = [];
  for (const r of results) {
    if (r.error) navErrors.push({ url: r.url, error: r.error });
    if (r.status !== 200) navErrors.push({ url: r.url, error: `http-status ${r.status}` });
    totalViolations += r.violationCount;
    if (r.violationCount > 0) {
      offenders.push({ url: r.url, count: r.violationCount, nodes: r.nodes });
    }
  }

  const summary = {
    pagesScanned: results.length,
    totalViolations,
    offenderCount: offenders.length,
    offenders,
    navErrors,
  };

  console.log(JSON.stringify(summary, null, 2));

  // A nav/scan error is a hard fail too — we cannot certify a page we could not scan.
  const ok = totalViolations === 0 && navErrors.length === 0;
  process.exit(ok ? 0 : 1);
}

run().catch((err) => {
  console.error(JSON.stringify({ error: err.message }, null, 2));
  try { server.close(); } catch {}
  process.exit(1);
});
