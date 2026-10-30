// qa-render.mjs — Playwright headless render + failed-request reporter for a
// service page served at its /services/<slug> clean URL.
//
// Usage:  node scripts/qa-render.mjs <slug>
// e.g.    node scripts/qa-render.mjs dental-implants
//
// It spins up a tiny static file server rooted at the repo dir that honors the
// vercel.json rewrite `/services/:slug -> /SERVICES/:slug.html`, opens the page
// in headless Chrome, records every network response + requestfailed event, and
// prints a machine-readable JSON summary:
//   { slug, url, failedRequests:[{url,status}], failedCount, hasMainCss, chatWidgetLoaded }
// Exit code 0 ONLY if: failedCount === 0 AND main.css returned 200 AND
// /assets/js/chat-widget.js returned 200. JSON is printed to stdout regardless.
//
// Dependency-free except playwright-core (imported from the LocalGrid install).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/Users/judykim/Desktop/JUDY_KIM/BUSINESS/projects/LocalGrid/node_modules/playwright-core/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Repo root = parent of scripts/
const REPO_ROOT = path.resolve(__dirname, '..');

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node scripts/qa-render.mjs <slug>');
  process.exit(2);
}

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

// Map an incoming request pathname to an absolute file on disk, honoring the
// vercel.json rewrite for service clean URLs. Returns null if nothing maps.
function resolveFile(pathname) {
  // Decode + strip query string, normalize away any `..` traversal.
  let p = decodeURIComponent(pathname.split('?')[0]);
  if (p === '/' || p === '') p = '/index.html';

  // /services/<slug>  ->  SERVICES/<slug>.html   (vercel.json rewrite)
  const svc = p.match(/^\/services\/([^/]+)\/?$/);
  if (svc) {
    return path.join(REPO_ROOT, 'SERVICES', `${svc[1]}.html`);
  }

  // Everything else maps 1:1 from repo root (/assets/*, /img/*, /*.html, etc.).
  const rel = p.replace(/^\/+/, '');
  const abs = path.join(REPO_ROOT, rel);

  // Prevent escaping the repo root.
  if (!abs.startsWith(REPO_ROOT)) return null;
  return abs;
}

const server = http.createServer((req, res) => {
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

async function run() {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/services/${slug}`;

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const failedRequests = [];
  const statusByUrl = new Map();

  page.on('response', (response) => {
    const u = response.url();
    const status = response.status();
    statusByUrl.set(u, status);
    if (status >= 400) failedRequests.push({ url: u, status });
  });
  page.on('requestfailed', (request) => {
    const u = request.url();
    const status = request.failure()?.errorText || 'requestfailed';
    failedRequests.push({ url: u, status });
  });

  let navError = null;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    navError = e.message;
  }

  const statusFor = (needle) => {
    for (const [u, s] of statusByUrl.entries()) {
      if (u.includes(needle)) return s;
    }
    return null;
  };

  const mainCssStatus = statusFor('/assets/css/main.css');
  const chatWidgetStatus = statusFor('/assets/js/chat-widget.js');

  const hasMainCss = mainCssStatus === 200;
  const chatWidgetLoaded = chatWidgetStatus === 200;

  const summary = {
    slug,
    url,
    navError,
    failedRequests,
    failedCount: failedRequests.length,
    hasMainCss,
    chatWidgetLoaded,
  };

  console.log(JSON.stringify(summary, null, 2));

  await browser.close();
  await new Promise((resolve) => server.close(resolve));

  const ok = summary.failedCount === 0 && hasMainCss && chatWidgetLoaded && !navError;
  process.exit(ok ? 0 : 1);
}

run().catch((err) => {
  console.error(JSON.stringify({ slug, error: err.message }, null, 2));
  try { server.close(); } catch {}
  process.exit(1);
});
