// qa-redirect-coverage.mjs — Zero-404 redirect-coverage checker (MIG-01).
//
// Proves that every URL in the old-site inventory follows its redirect chain
// to a final 200 on the rebuild. Models qa-render.mjs exactly:
//  - playwright-core imported from the pinned LocalGrid install (no browser download)
//    launched with { channel: 'chrome', headless: true } — reuses system Chrome.
//  - Falls back to native node:http redirect-following when Chrome is unavailable
//    (e.g. CI environments without a display server) so the script is useful
//    regardless of context.
//  - node:http static server rooted at REPO_ROOT
//  - resolveFile() applies vercel.json rewrites so the local server mirrors Vercel
//  - In-process redirect resolver applies vercel.json redirects[] (returns 301)
//  - Records final response status per URL; anything != 200 is a failure
//  - Prints machine-readable JSON: { total, passed, failedCount, failures }
//  - process.exit(failedCount === 0 ? 0 : 1)
//
// Inventory source (in priority order):
//  1. argv[2] — path to a JSON file (bare array, or { urls: [...] })
//  2. scripts/old-urls.json — the AUTHORITATIVE old-site inventory (347 URLs), captured
//     from https://aventuradentalcenter.com/sitemap.xml on 2026-07-14 while the domain
//     still served the previous-dev site. This is the real set of indexed + backlinked
//     URLs MIG-01 exists to protect. Preferred whenever present.
//  3. Derived fallback: concrete redirect sources + new sitemap.xml locs + wildcard
//     examples. WEAKER evidence — it can only confirm URLs someone already mapped, so it
//     cannot prove coverage of an old URL family nobody thought of. Used only if (2) is absent.
//
// The reported `inventorySource` in the JSON output says which one actually ran, so a
// passing result can never be mistaken for stronger evidence than it is.
//
// Usage:
//   node scripts/qa-redirect-coverage.mjs                 # uses scripts/old-urls.json
//   node scripts/qa-redirect-coverage.mjs some-list.json  # custom JSON list
//   node scripts/qa-redirect-coverage.mjs --http          # force native-http mode (no Chrome)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/Users/judykim/Desktop/JUDY_KIM/BUSINESS/projects/LocalGrid/node_modules/playwright-core/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// ── CLI flags ─────────────────────────────────────────────────────────────────
const forceHttp = process.argv.includes('--http');
const customArg = process.argv.find((a, i) => i >= 2 && !a.startsWith('--'));

// ── Load vercel.json ──────────────────────────────────────────────────────────
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

// ── Pattern matcher ───────────────────────────────────────────────────────────
// Converts a Vercel route pattern to a RegExp.
// Supports :slug, :rest*, :path*, :page* (Vercel wildcard segments).
function patternToRegex(source) {
  let rx = source
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // escape regex special chars
    .replace(/:([a-zA-Z]+)\*/g, '(.*)') // :rest* :path* :page* -> (.*)
    .replace(/:([a-zA-Z]+)/g, '([^/]+)'); // :slug -> ([^/]+)
  return new RegExp('^' + rx + '$');
}

// Try to match pathname against redirects[]; return destination string or null.
function matchRedirect(pathname) {
  for (const rule of REDIRECTS) {
    const rx = patternToRegex(rule.source);
    if (rx.test(pathname)) {
      return rule.destination;
    }
  }
  return null;
}

// Try to match pathname against rewrites[]; return the rewritten path or null.
function matchRewrite(pathname) {
  for (const rule of REWRITES) {
    const rx = patternToRegex(rule.source);
    const m = pathname.match(rx);
    if (m) {
      let dest = rule.destination;
      // Substitute first capture group (e.g. :slug) into destination
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

// ── File resolver ─────────────────────────────────────────────────────────────
function resolveFile(pathname) {
  let p = decodeURIComponent(pathname.split('?')[0]);
  if (p === '/' || p === '') p = '/index.html';

  // Apply rewrites first
  const rewritten = matchRewrite(p);
  if (rewritten) {
    const rel = rewritten.replace(/^\/+/, '');
    const abs = path.join(REPO_ROOT, rel);
    if (!abs.startsWith(REPO_ROOT)) return null;
    return abs;
  }

  // Direct file mapping
  const rel = p.replace(/^\/+/, '');
  const abs = path.join(REPO_ROOT, rel);
  if (!abs.startsWith(REPO_ROOT)) return null;
  return abs;
}

// ── HTTP server ───────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const pathname = (req.url || '/').split('?')[0];

  // Check for redirect first (mirrors Vercel: redirects evaluated before rewrites)
  const redirectDest = matchRedirect(pathname);
  if (redirectDest) {
    res.writeHead(301, { 'Location': redirectDest });
    res.end();
    return;
  }

  // Otherwise serve file (applies rewrites via resolveFile)
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

// ── Build default inventory ───────────────────────────────────────────────────
function buildDefaultInventory() {
  const urls = new Set();

  // 1. All concrete (non-wildcard) redirect sources in vercel.json.
  //    Each must follow its chain to a final 200.
  for (const rule of REDIRECTS) {
    if (!rule.source.includes(':')) {
      urls.add(rule.source);
    }
  }

  // 2. All new-site <loc> paths from sitemap.xml (must return 200 directly).
  const sitemapPath = path.join(REPO_ROOT, 'sitemap.xml');
  if (fs.existsSync(sitemapPath)) {
    const xml = fs.readFileSync(sitemapPath, 'utf8');
    for (const m of xml.matchAll(/<loc>https?:\/\/[^/]+([^<]+)<\/loc>/g)) {
      const p = m[1].replace(/\/$/, '') || '/';
      urls.add(p);
    }
    // Homepage <loc> might be just the domain with no path — add / explicitly
    urls.add('/');
  }

  // 3. Concrete examples for wildcard redirect families.
  //    These represent the ~307 /locations/florida/<city>/... doorway URLs
  //    and other wildcard-covered patterns.
  const wildcardExamples = [
    '/locations/florida/aventura/dental-implants',
    '/locations/florida/aventura/invisalign',
    '/locations/florida/hallandale-beach/dental-cleaning',
    '/locations/florida/north-miami-beach/teeth-whitening',
    '/locations/florida/sunny-isles-beach/emergency-dentist',
    '/locations/florida/golden-beach/dental-crowns',
    '/locations/florida/hollywood/root-canal',
    '/locations/florida/miami-gardens/dental-implants',
    '/locations/florida/pembroke-park/veneers',
    '/locations/florida/ives-estates/invisalign',
    '/locations/florida/coral-gables/dentist',
    '/locations/florida',
    '/blog/page/2',
    '/blog/page/3',
    '/author/dr-david-bistritz',
  ];
  for (const u of wildcardExamples) {
    urls.add(u);
  }

  return Array.from(urls).sort();
}

// ── Load inventory ────────────────────────────────────────────────────────────
// Accepts either a bare JSON array of paths, or { urls: [...] } with metadata.
function coerceUrlList(parsed, sourceLabel) {
  const list = Array.isArray(parsed) ? parsed : parsed && parsed.urls;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error(`inventory at ${sourceLabel} is not a non-empty array of URL paths`);
  }
  return list;
}

function loadInventory() {
  // 1. Explicit path passed on the command line wins.
  if (customArg) {
    const abs = path.isAbsolute(customArg) ? customArg : path.join(REPO_ROOT, customArg);
    return {
      urls: coerceUrlList(JSON.parse(fs.readFileSync(abs, 'utf8')), customArg),
      source: customArg,
    };
  }

  // 2. The authoritative OLD-site inventory, captured from the previous site's live
  //    sitemap before the DNS switch. This is the real set of indexed/backlinked URLs
  //    MIG-01 must protect, so it is preferred over any derived approximation.
  const oldUrlsPath = path.join(REPO_ROOT, 'scripts', 'old-urls.json');
  if (fs.existsSync(oldUrlsPath)) {
    return {
      urls: coerceUrlList(JSON.parse(fs.readFileSync(oldUrlsPath, 'utf8')), 'scripts/old-urls.json'),
      source: 'scripts/old-urls.json (authoritative old-site sitemap)',
    };
  }

  // 3. Fallback only: a derived inventory (new sitemap + existing redirect sources).
  //    Weaker evidence — it cannot prove coverage of old URLs nobody mapped.
  return { urls: buildDefaultInventory(), source: 'derived fallback (NOT the real old sitemap)' };
}

// ── Native-http redirect follower (no browser required) ───────────────────────
// Follows up to maxRedirects 301/302 hops, returns final status code.
async function httpGetFinalStatus(baseUrl, urlPath, maxRedirects = 10) {
  let currentPath = urlPath;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const result = await new Promise((resolve, reject) => {
      const fullUrl = `${baseUrl}${currentPath}`;
      const parsed = new URL(fullUrl);
      const options = {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + (parsed.search || ''),
        method: 'GET',
      };
      const req = http.request(options, (res) => {
        // Drain the response body so the connection closes cleanly
        res.resume();
        resolve({ status: res.statusCode, location: res.headers['location'] });
      });
      req.on('error', reject);
      req.end();
    });

    if (result.status === 301 || result.status === 302) {
      if (!result.location) return result.status; // broken redirect
      // Handle absolute vs relative Location headers
      if (result.location.startsWith('http')) {
        // External redirect — treat as final (not expected on our local server)
        return result.status;
      }
      currentPath = result.location;
      continue;
    }

    return result.status;
  }
  return 0; // too many redirects
}

// ── Playwright-based checker ──────────────────────────────────────────────────
async function runWithPlaywright(inventory, port) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();

  const failures = [];
  let passed = 0;

  for (const urlPath of inventory) {
    const fullUrl = `http://127.0.0.1:${port}${urlPath}`;
    const page = await context.newPage();

    let finalStatus = null;

    page.on('response', (response) => {
      const status = response.status();
      if (status !== 301 && status !== 302) {
        finalStatus = status;
      }
    });

    let navError = null;
    try {
      const response = await page.goto(fullUrl, { waitUntil: 'commit', timeout: 15000 });
      if (finalStatus === null && response) {
        finalStatus = response.status();
      }
    } catch (e) {
      navError = e.message.split('\n')[0];
      finalStatus = finalStatus ?? 0;
    }

    await page.close();

    if (finalStatus === 200) {
      passed++;
    } else {
      failures.push({ url: urlPath, finalStatus, navError: navError || undefined });
    }
  }

  await browser.close();
  return { passed, failures };
}

// ── Native-http-based checker ─────────────────────────────────────────────────
async function runWithHttp(inventory, port) {
  const baseUrl = `http://127.0.0.1:${port}`;
  const failures = [];
  let passed = 0;

  for (const urlPath of inventory) {
    let finalStatus = null;
    try {
      finalStatus = await httpGetFinalStatus(baseUrl, urlPath);
    } catch (e) {
      finalStatus = 0;
      failures.push({ url: urlPath, finalStatus, error: e.message });
      continue;
    }

    if (finalStatus === 200) {
      passed++;
    } else {
      failures.push({ url: urlPath, finalStatus });
    }
  }

  return { passed, failures };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  const { urls: inventory, source } = loadInventory();

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  let result;
  let mode;

  if (forceHttp) {
    // Explicit --http flag: use native http, skip browser entirely
    mode = 'native-http';
    result = await runWithHttp(inventory, port);
  } else {
    // Try Playwright first; fall back to native http if Chrome won't launch.
    // Both paths exercise the same in-process vercel.json redirect+rewrite resolver,
    // so a pass means the same thing either way.
    try {
      mode = 'playwright';
      result = await runWithPlaywright(inventory, port);
    } catch (browserErr) {
      mode = 'native-http-fallback';
      result = await runWithHttp(inventory, port);
    }
  }

  const summary = {
    mode,
    inventorySource: source,
    total: inventory.length,
    passed: result.passed,
    failedCount: result.failures.length,
    failures: result.failures,
  };

  console.log(JSON.stringify(summary, null, 2));

  await new Promise((resolve) => server.close(resolve));

  process.exit(summary.failedCount === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error(JSON.stringify({ error: err.message }, null, 2));
  try { server.close(); } catch {}
  process.exit(1);
});
