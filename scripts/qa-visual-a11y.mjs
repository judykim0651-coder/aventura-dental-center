// qa-visual-a11y.mjs — Phase 7 (Visual Accessibility: Scrims / Reduced-Motion /
// Target-Size / Badge-Contrast) CAPSTONE GATE.
//
// ONE rendered-browser gate that certifies all four Phase-7 success criteria in a
// REAL headless Chrome (playwright-core from the pinned LocalGrid install). This is
// the acceptance contract for A11Y-03/07/08/12 — the design system's visual a11y
// layer shipped broken precisely because it was built by READING CSS instead of
// RENDERING it (a dead comma-alpha scrim computes to rgba(0,0,0,0), a 44px dot
// reintroduces homepage overflow, a "fixed" badge still fails composited contrast).
// Grep cannot see any of that; this gate renders it.
//
// It reuses qa-mobile-conversion.mjs's vercel.json-aware resolveFile() +
// http.createServer() + sitemapPaths() block VERBATIM (do NOT fork the server) so
// all 54 clean-URL routes resolve exactly as they ship, and decodes screenshot
// pixels with `sharp` (the sibling LocalGrid install) for true rendered-pixel
// contrast.
//
// The FOUR checks (each negative-tested in 07-04 Task 2 — sabotage the specific fix,
// this gate must exit non-zero on the CORRECT check, then revert; per Execution
// Rule #4 no check may be a tautology):
//
//   CHECK A — A11Y-03 scrim contrast (homepage, 1440x900, RENDERED PIXELS). Both
//     scrims must PAINT (.hero__overlay + .nav-pill background-color != rgba(0,0,0,0)).
//     For each of the 3 hero slides (forced active via INLINE opacity so autoplay
//     cannot interfere): hide the glyphs+border of every measured element
//     (color/border-color -> transparent), screenshot each element's rect, decode to
//     raw RGB with sharp, and take the WORST-CASE (lowest-contrast) background pixel
//     vs that element's real text color. PASS iff every nav link (active + others)
//     >=4.5:1 AND the hero H1 >=3:1 on ALL 3 slides. (The audit skeptic's exact
//     method — hide glyphs, sample the background box, compute contrast.)
//
//   CHECK B — A11Y-07 reduced motion (homepage, NEW context reducedMotion:'reduce').
//     documentElement scroll-behavior computes 'auto'; the hero active-slide index is
//     unchanged after 12s (the Phase-6 carousel guard holds under reduce); no
//     long-running/looping animation remains after settle; the .stats-grid.scroll-animate
//     computes opacity:1 (not 0); and the three [data-stat-number] read the FINAL values
//     ['37+','17','15+'] (never a frozen '0'). (The 4th "1,000+ Happy Patients" stat was
//     removed and "Locations" relabeled "15+ Areas Serviced" per owner, 2026-07-19.)
//
//   CHECK C — A11Y-08 target size + no-overflow (homepage @375, chat opened). The
//     reviews .carousel-dot hit box is >=24x24 with an ~8px painted dot (content-box);
//     the .adc-tip dismiss button's EFFECTIVE target is >=44x44 (its 20x20 element rect
//     grown by the ::before inset -12px each side; cross-checked by elementFromPoint);
//     .adc-x is >=44x44; AND documentElement.scrollWidth === clientWidth on / at 320
//     AND 375 (the overflow trap guard — reused from qa-mobile-conversion CHECK A).
//     The universal-sweep of EVERY control is deliberately NOT run: the rendered
//     homepage carries ~39 pre-existing sub-24 controls (inline body/nav/footer links,
//     footer social icons, header tel bar, view-all) that A11Y-08 never touched and
//     that WCAG 2.5.8's inline/spacing exceptions cover — asserting each >=24 would
//     false-fail on out-of-scope controls. The gate proves exactly the three fixed
//     controls + the no-overflow invariant, which is what the phase changed.
//
//   CHECK D — A11Y-12 badge contrast (/, /about, /services). For each
//     .hours-card.is-closed .hours-card__time ('Closed' Sat+Sun, 2/page): resolve the
//     true painted background by walking the ancestor chain and alpha-compositing each
//     rgba background layer over an opaque white base (analytic — the pill is not over
//     a photo), then compute contrast(textColor, compositedBg) >= 4.5:1. Token-unchanged
//     proof: the card's border/background still resolve from --destructive
//     (rgba(239,67,67,0.5)/0.1) — the text fix did not restyle the card.
//
// Browser: playwright-core, system Chrome, { channel:'chrome', headless:true }.
// Screenshot pixel decode: sharp (LocalGrid install), raw RGB.
//
// Usage: node scripts/qa-visual-a11y.mjs
// Prints a JSON summary and exits 0 iff every check passes.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/Users/judykim/Desktop/JUDY_KIM/BUSINESS/projects/LocalGrid/node_modules/playwright-core/index.mjs';
import sharp from '/Users/judykim/Desktop/JUDY_KIM/BUSINESS/projects/LocalGrid/node_modules/sharp/lib/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

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

// Wait for same-origin images to finish loading so layout (overflow) is accurate.
async function settleImages(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const imgs = Array.from(document.images).filter((i) => !i.complete);
        if (imgs.length === 0) return resolve();
        let n = imgs.length;
        const done = () => { if (--n <= 0) resolve(); };
        imgs.forEach((i) => { i.addEventListener('load', done); i.addEventListener('error', done); });
        setTimeout(resolve, 5000);
      })
  );
}

// ════════════════════════════════════════════════════════════════════════════
// WCAG contrast primitives (from-scratch relative-luminance routine)
// ════════════════════════════════════════════════════════════════════════════
function parseColor(str) {
  const m = String(str).match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
  return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
}
function chan(c) { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); }
function relLuminance(r, g, b) { return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b); }
function contrast(a, b) {
  const L1 = relLuminance(a.r, a.g, a.b);
  const L2 = relLuminance(b.r, b.g, b.b);
  const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}
// Alpha-composite background layers (element-first) over an opaque white base.
function compositeBackground(layersElementFirst, base = { r: 255, g: 255, b: 255 }) {
  let out = { ...base };
  for (const layer of layersElementFirst.slice().reverse()) { // root -> element
    const a = layer.a;
    out = {
      r: layer.r * a + out.r * (1 - a),
      g: layer.g * a + out.g * (1 - a),
      b: layer.b * a + out.b * (1 - a),
    };
  }
  return { r: Math.round(out.r), g: Math.round(out.g), b: Math.round(out.b) };
}

// Worst-case (lowest) contrast between `textColor` and every pixel of a PNG buffer.
async function worstPixelContrast(pngBuffer, textColor) {
  const { data, info } = await sharp(pngBuffer).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  let worst = Infinity;
  let worstPx = null;
  for (let i = 0; i + 2 < data.length; i += ch) {
    if (ch === 4 && data[i + 3] === 0) continue; // skip fully transparent (shouldn't occur)
    const px = { r: data[i], g: data[i + 1], b: data[i + 2] };
    const c = contrast(textColor, px);
    if (c < worst) { worst = c; worstPx = px; }
  }
  return { worst, worstPx, sampled: (data.length / ch) | 0, dims: { w: info.width, h: info.height } };
}

// Clamp/inset an element rect to a valid, in-viewport screenshot clip.
function clampClip(rect, vw, vh) {
  let x = Math.max(0, Math.floor(rect.x) + 1);
  let y = Math.max(0, Math.floor(rect.y) + 1);
  let w = Math.floor(rect.w) - 2;
  let h = Math.floor(rect.h) - 2;
  if (x + w > vw) w = vw - x;
  if (y + h > vh) h = vh - y;
  w = Math.max(1, w); h = Math.max(1, h);
  return { x, y, width: w, height: h };
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK A — A11Y-03 scrim contrast (homepage, 1440x900, rendered pixels)
// ════════════════════════════════════════════════════════════════════════════
async function checkScrim(browser, port) {
  const VW = 1440, VH = 900;
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  const reasons = [];
  const measurements = [];
  try {
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle', timeout: 30000 });
    await settleImages(page);
    await page.evaluate(() => window.scrollTo(0, 0));

    // Both scrims must PAINT (a dead comma-alpha hsla computes to rgba(0,0,0,0)).
    const paint = await page.evaluate(() => {
      const o = document.querySelector('.hero__overlay');
      const n = document.querySelector('.nav-pill');
      return {
        overlay: o ? getComputedStyle(o).backgroundColor : 'MISSING',
        pill: n ? getComputedStyle(n).backgroundColor : 'MISSING',
      };
    });
    const dead = (c) => c === 'rgba(0, 0, 0, 0)' || c === 'transparent' || c === 'MISSING';
    if (dead(paint.overlay)) reasons.push(`hero__overlay scrim does not paint (${paint.overlay})`);
    if (dead(paint.pill)) reasons.push(`nav-pill scrim does not paint (${paint.pill})`);

    const slideCount = await page.evaluate(() => document.querySelectorAll('.hero__slide').length);
    if (slideCount !== 3) reasons.push(`expected 3 hero slides, found ${slideCount}`);

    // Per-element worst contrast, min across all 3 slides.
    const perElement = {}; // key -> { kind, threshold, color, worstBySlide[] }

    for (let si = 0; si < slideCount; si++) {
      // Force this slide visible via INLINE opacity — wins over the carousel's
      // .is-active class toggles, so autoplay cannot change the painted photo.
      await page.evaluate((s) => {
        const slides = [...document.querySelectorAll('.hero__slide')];
        slides.forEach((el, i) => { el.style.transition = 'none'; el.style.opacity = i === s ? '1' : '0'; });
      }, si);
      await page.waitForTimeout(350); // let backdrop-filter re-sample the forced slide

      // Tag measured elements, read their real text colors.
      const specs = await page.evaluate(() => {
        const links = [...document.querySelectorAll('.nav-pill__links a')];
        const h1 = document.querySelector('.hero h1');
        const items = [];
        links.forEach((a, i) => {
          a.setAttribute('data-qa-scrim', 'a' + i);
          items.push({
            key: 'a' + i,
            sel: '.nav-pill__links a[data-qa-scrim="a' + i + '"]',
            kind: a.classList.contains('is-active') ? 'active-nav-link' : 'nav-link',
            threshold: 4.5,
            color: getComputedStyle(a).color,
          });
        });
        if (h1) {
          h1.setAttribute('data-qa-scrim', 'h1');
          items.push({
            key: 'h1',
            sel: '.hero h1[data-qa-scrim="h1"]',
            kind: 'hero-h1',
            threshold: 3.0,
            color: getComputedStyle(h1).color,
          });
        }
        return items;
      });

      // Hide glyphs + border on ALL measured elements at once (no neighbour bleed).
      await page.evaluate(() => {
        window.__qaScrimSaved = [];
        document.querySelectorAll('[data-qa-scrim]').forEach((el) => {
          window.__qaScrimSaved.push([el.getAttribute('data-qa-scrim'), el.style.cssText]);
          el.style.setProperty('color', 'transparent', 'important');
          el.style.setProperty('border-color', 'transparent', 'important');
          el.style.setProperty('text-shadow', 'none', 'important');
        });
      });
      // CRITICAL: wait for the browser to actually REPAINT the transparent glyphs
      // before screenshotting, or the capture races the paint and samples a stale
      // glyph remnant (text-on-text) instead of the true background pixel.
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      await page.waitForTimeout(150);

      for (const spec of specs) {
        const rect = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height };
        }, spec.sel);
        const clip = clampClip(rect, VW, VH);
        const buf = await page.screenshot({ clip });
        const textColor = parseColor(spec.color);
        const { worst, worstPx } = await worstPixelContrast(buf, textColor);
        if (!perElement[spec.key]) {
          perElement[spec.key] = { kind: spec.kind, threshold: spec.threshold, color: spec.color, worstBySlide: [] };
        }
        perElement[spec.key].worstBySlide.push({ slide: si, worst: Number(worst.toFixed(2)), worstPx });
      }

      // Restore.
      await page.evaluate(() => {
        for (const [tag, css] of window.__qaScrimSaved) {
          const el = document.querySelector('[data-qa-scrim="' + tag + '"]');
          if (el) { el.style.cssText = css; el.removeAttribute('data-qa-scrim'); }
        }
      });
    }

    for (const [key, m] of Object.entries(perElement)) {
      const worstOverall = Math.min(...m.worstBySlide.map((s) => s.worst));
      measurements.push({ key, kind: m.kind, threshold: m.threshold, worstOverall, perSlide: m.worstBySlide.map((s) => s.worst) });
      if (worstOverall < m.threshold) {
        reasons.push(`${m.kind} (${key}) worst contrast ${worstOverall}:1 < ${m.threshold}:1 (per-slide ${m.worstBySlide.map((s) => s.worst).join('/')})`);
      }
    }
  } catch (e) {
    reasons.push(`error: ${e.message.split('\n')[0]}`);
  }
  await ctx.close();
  return { name: 'A_scrim', ok: reasons.length === 0, reasons, measurements };
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK B — A11Y-07 reduced motion (homepage, reducedMotion:'reduce')
// ════════════════════════════════════════════════════════════════════════════
async function checkReducedMotion(browser, port) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const reasons = [];
  const detail = {};
  try {
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle', timeout: 30000 });
    await settleImages(page);

    // 1. scroll-behavior computes 'auto'.
    const sb = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
    detail.scrollBehavior = sb;
    if (sb !== 'auto') reasons.push(`scroll-behavior computes '${sb}' (expected 'auto')`);

    // 2. Hero index unchanged after 12s (carousel guard holds under reduce).
    const idxBefore = await page.evaluate(() => {
      const s = [...document.querySelectorAll('.hero__slide')];
      return s.findIndex((el) => el.classList.contains('is-active'));
    });
    await page.waitForTimeout(12000);
    const idxAfter = await page.evaluate(() => {
      const s = [...document.querySelectorAll('.hero__slide')];
      return s.findIndex((el) => el.classList.contains('is-active'));
    });
    detail.heroIndex = { before: idxBefore, after: idxAfter };
    if (idxBefore !== idxAfter) reasons.push(`hero auto-advanced ${idxBefore}->${idxAfter} under reduced motion`);

    // 3. No long-running / looping animation remains after settle.
    const running = await page.evaluate(() => {
      return document.getAnimations().filter((a) => {
        const t = a.effect.getComputedTiming();
        const d = t.duration;
        return d > 1 && (t.iterations === Infinity || a.playState === 'running');
      }).length;
    });
    detail.runningAnimations = running;
    if (running !== 0) reasons.push(`${running} long-running/looping animation(s) still active under reduced motion`);

    // 4. .stats-grid.scroll-animate reveals (opacity 1, not 0).
    const statsOpacity = await page.evaluate(() => {
      const el = document.querySelector('.stats-grid.scroll-animate');
      return el ? getComputedStyle(el).opacity : 'MISSING';
    });
    detail.statsGridOpacity = statsOpacity;
    if (statsOpacity !== '1') reasons.push(`.stats-grid.scroll-animate opacity ${statsOpacity} (expected 1 — band hidden under reduce)`);

    // 5. Stats show FINAL values, never a frozen '0'.
    const statValues = await page.evaluate(() =>
      [...document.querySelectorAll('[data-stat-number]')].map((el) => (el.textContent || '').trim())
    );
    detail.statValues = statValues;
    const expected = ['37+', '17', '15+'];
    if (JSON.stringify(statValues) !== JSON.stringify(expected)) {
      reasons.push(`stats read ${JSON.stringify(statValues)} (expected ${JSON.stringify(expected)} — frozen '0' or count-up under reduce)`);
    }
  } catch (e) {
    reasons.push(`error: ${e.message.split('\n')[0]}`);
  }
  await ctx.close();
  return { name: 'B_reduced_motion', ok: reasons.length === 0, reasons, detail };
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK C — A11Y-08 target size + no-overflow (homepage)
// ════════════════════════════════════════════════════════════════════════════
async function checkTargetSize(browser, port) {
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3,
  });
  const reasons = [];
  const detail = {};
  try {
    // Target sizes @375 with the chat widget OPEN so .adc-x renders.
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle', timeout: 30000 });
    await settleImages(page);

    // Reviews dots: every hit box >=24x24 with an ~8px painted dot (content-box).
    const dots = await page.evaluate(() => {
      const els = [...document.querySelectorAll('.carousel-dot')];
      return {
        count: els.length,
        boxes: els.map((d) => {
          const r = d.getBoundingClientRect();
          return { w: Math.round(r.width), h: Math.round(r.height), paint: getComputedStyle(d).width };
        }),
      };
    });
    detail.dots = dots;
    if (dots.count < 3) reasons.push(`only ${dots.count} review dots (need >=3)`);
    for (const [i, b] of dots.boxes.entries()) {
      if (!(b.w >= 24 && b.h >= 24)) reasons.push(`carousel-dot[${i}] hit box ${b.w}x${b.h} < 24x24`);
      if (b.paint !== '8px') reasons.push(`carousel-dot[${i}] painted width ${b.paint} (expected 8px content-box paint)`);
    }

    // Reveal the proactive tip WITHOUT opening the chat panel — an OPEN .adc-panel
    // (bottom:0, 520px tall, higher stacking) would COVER the tip and make every
    // elementFromPoint hit the panel instead of the tip's ::before hit area. Measure
    // the tip first (panel closed), then open the panel below to measure .adc-x.
    await page.evaluate(() => {
      const tipEl = document.getElementById('adcTip');
      if (tipEl) tipEl.classList.add('adc-show'); // pointer-events:auto so elementFromPoint sees it
    });
    await page.waitForTimeout(200);

    // .adc-tip dismiss: EFFECTIVE target >=44x44 (element rect grown by ::before inset),
    // cross-checked with elementFromPoint at the 4 corners of a 42x42 box (±21, 1px
    // inside the 44x44 hit area to avoid edge ambiguity) — proving the hit area is
    // really live, far beyond the bare 20x20 element box (whose corners are only ±10).
    const tip = await page.evaluate(() => {
      const btn = document.querySelector('.adc-tip button');
      if (!btn) return { present: false };
      const r = btn.getBoundingClientRect();
      const before = getComputedStyle(btn, '::before');
      const insTop = parseFloat(before.top);
      const insLeft = parseFloat(before.left);
      const insRight = parseFloat(before.right);
      const insBottom = parseFloat(before.bottom);
      // Negative insets grow the box; treat any unreadable inset as 0.
      const growTop = Number.isFinite(insTop) ? -insTop : 0;
      const growLeft = Number.isFinite(insLeft) ? -insLeft : 0;
      const growRight = Number.isFinite(insRight) ? -insRight : 0;
      const growBottom = Number.isFinite(insBottom) ? -insBottom : 0;
      const effW = r.width + growLeft + growRight;
      const effH = r.height + growTop + growBottom;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const half = 21;
      const corners = [[cx - half, cy - half], [cx + half, cy - half], [cx - half, cy + half], [cx + half, cy + half]];
      const hits = corners.map(([px, py]) => {
        const el = document.elementFromPoint(px, py);
        return !!el && (el === btn || btn.contains(el) || (el.closest && el.closest('.adc-tip button') === btn));
      });
      return {
        present: true,
        elementBox: { w: Math.round(r.width), h: Math.round(r.height) },
        beforeInset: { top: insTop, left: insLeft, right: insRight, bottom: insBottom },
        effective: { w: Math.round(effW), h: Math.round(effH) },
        cornerHits: hits,
        cornerHitCount: hits.filter(Boolean).length,
      };
    });
    detail.adcTip = tip;
    if (!tip.present) reasons.push('.adc-tip button not present');
    else {
      if (!(tip.effective.w >= 44 && tip.effective.h >= 44)) {
        reasons.push(`.adc-tip button effective target ${tip.effective.w}x${tip.effective.h} < 44x44 (element ${tip.elementBox.w}x${tip.elementBox.h}, ::before inset ${JSON.stringify(tip.beforeInset)})`);
      }
      if (tip.cornerHitCount < 4) {
        reasons.push(`.adc-tip button elementFromPoint hit only ${tip.cornerHitCount}/4 corners of a 44x44 box (hit area not expanded)`);
      }
    }

    // Now OPEN the chat panel (removes its closed-state scale(.97) transform) and
    // measure .adc-x at its true rendered size.
    await page.evaluate(() => {
      const fab = document.getElementById('adcFab');
      if (fab) fab.click();
    });
    await page.waitForTimeout(300);

    // .adc-x panel close button: real element box >=44x44.
    const adcx = await page.evaluate(() => {
      const el = document.getElementById('adcClose');
      if (!el) return { present: false };
      const r = el.getBoundingClientRect();
      return { present: true, w: Math.round(r.width), h: Math.round(r.height) };
    });
    detail.adcClose = adcx;
    if (!adcx.present) reasons.push('#adcClose (.adc-x) not present');
    else if (!(adcx.w >= 44 && adcx.h >= 44)) reasons.push(`.adc-x box ${adcx.w}x${adcx.h} < 44x44`);
    await page.close();

    // No-overflow at 320 AND 375 on a FRESH page (the trap guard — a 44px dot row
    // would push documentElement.scrollWidth past clientWidth; reused from
    // qa-mobile-conversion CHECK A).
    const overflow = {};
    for (const w of [320, 375]) {
      const op = await ctx.newPage();
      await op.setViewportSize({ width: w, height: w === 320 ? 568 : 812 });
      await op.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle', timeout: 30000 });
      await settleImages(op);
      await op.waitForTimeout(150);
      const delta = await op.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      overflow[w] = delta;
      if (delta > 0) reasons.push(`homepage overflow@${w} +${delta}px (documentElement.scrollWidth > clientWidth)`);
      await op.close();
    }
    detail.overflow = overflow;
  } catch (e) {
    reasons.push(`error: ${e.message.split('\n')[0]}`);
  }
  await ctx.close();
  return { name: 'C_target_size', ok: reasons.length === 0, reasons, detail };
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK D — A11Y-12 badge contrast (/, /about, /services)
// ════════════════════════════════════════════════════════════════════════════
async function checkBadge(browser, port) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const reasons = [];
  const perPage = [];
  const PAGES = ['/', '/about', '/services'];
  try {
    for (const urlPath of PAGES) {
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${port}${urlPath}`, { waitUntil: 'networkidle', timeout: 30000 });
      const data = await page.evaluate(() => {
        function layers(el) {
          const out = [];
          let n = el;
          while (n && n.nodeType === 1) {
            const bg = getComputedStyle(n).backgroundColor;
            const m = String(bg).match(/rgba?\(([^)]+)\)/);
            if (m) {
              const p = m[1].split(',').map((s) => parseFloat(s.trim()));
              const a = p.length > 3 ? p[3] : 1;
              if (a > 0) out.push({ r: p[0], g: p[1], b: p[2], a });
            }
            n = n.parentElement;
          }
          return out; // element-first
        }
        const cells = [...document.querySelectorAll('.hours-card.is-closed .hours-card__time')];
        const card = document.querySelector('.hours-card.is-closed');
        return {
          count: cells.length,
          cells: cells.map((c) => ({ text: (c.textContent || '').trim(), color: getComputedStyle(c).color, layers: layers(c) })),
          cardBorder: card ? getComputedStyle(card).borderColor : 'MISSING',
          cardBg: card ? getComputedStyle(card).backgroundColor : 'MISSING',
        };
      });
      await page.close();

      const pageResult = { url: urlPath, count: data.count, badges: [], cardBorder: data.cardBorder, cardBg: data.cardBg };
      if (data.count !== 2) reasons.push(`${urlPath}: expected 2 Closed badges, found ${data.count}`);

      for (const [i, cell] of data.cells.entries()) {
        const textColor = parseColor(cell.color);
        const bg = compositeBackground(cell.layers.map((l) => ({ r: l.r, g: l.g, b: l.b, a: l.a })));
        const ratio = contrast(textColor, bg);
        pageResult.badges.push({
          i, text: cell.text, textColor: cell.color,
          compositedBg: `rgb(${bg.r}, ${bg.g}, ${bg.b})`,
          ratio: Number(ratio.toFixed(2)),
        });
        if (ratio < 4.5) reasons.push(`${urlPath} badge[${i}] "${cell.text}" contrast ${ratio.toFixed(2)}:1 < 4.5:1 (text ${cell.color} on ${`rgb(${bg.r}, ${bg.g}, ${bg.b})`})`);
      }

      // Token-unchanged proof: card border/background still resolve from --destructive.
      const border = parseColor(data.cardBorder);
      const cardBg = parseColor(data.cardBg);
      const isDestructive = (c, expectedAlpha) =>
        c && Math.abs(c.r - 239) <= 4 && Math.abs(c.g - 67) <= 6 && Math.abs(c.b - 67) <= 6 && Math.abs(c.a - expectedAlpha) <= 0.02;
      if (!isDestructive(border, 0.5)) reasons.push(`${urlPath}: .hours-card.is-closed border ${data.cardBorder} not --destructive/0.5 (card restyled)`);
      if (!isDestructive(cardBg, 0.1)) reasons.push(`${urlPath}: .hours-card.is-closed background ${data.cardBg} not --destructive/0.1 (card restyled)`);

      perPage.push(pageResult);
    }
  } catch (e) {
    reasons.push(`error: ${e.message.split('\n')[0]}`);
  }
  await ctx.close();
  return { name: 'D_badge', ok: reasons.length === 0, reasons, perPage };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  // Touch sitemapPaths() so the reused server enumeration is exercised (the gate's
  // homepage set is a subset of the 54 clean-URL routes it resolves).
  const allRoutes = sitemapPaths();

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  const A = await checkScrim(browser, port);
  const B = await checkReducedMotion(browser, port);
  const C = await checkTargetSize(browser, port);
  const D = await checkBadge(browser, port);

  await browser.close();
  await new Promise((resolve) => server.close(resolve));

  const checks = { A_scrim: A, B_reduced_motion: B, C_target_size: C, D_badge: D };
  const failed = Object.values(checks).filter((c) => !c.ok).length;
  const allOk = failed === 0;

  const summary = {
    gate: 'qa-visual-a11y (Phase 7 capstone)',
    result: allOk ? 'PASS' : 'FAIL',
    routesResolvable: allRoutes.length,
    checks: {
      A_scrim: { ok: A.ok, criterion: 'A11Y-03', measurements: A.measurements },
      B_reduced_motion: { ok: B.ok, criterion: 'A11Y-07', detail: B.detail },
      C_target_size: { ok: C.ok, criterion: 'A11Y-08', detail: C.detail },
      D_badge: { ok: D.ok, criterion: 'A11Y-12', perPage: D.perPage },
    },
    failures: {
      A_scrim: A.reasons,
      B_reduced_motion: B.reasons,
      C_target_size: C.reasons,
      D_badge: D.reasons,
    },
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(allOk ? 0 : 1);
}

run().catch((err) => {
  console.error(JSON.stringify({ error: err.message, stack: (err.stack || '').split('\n').slice(0, 4) }, null, 2));
  try { server.close(); } catch {}
  process.exit(1);
});
