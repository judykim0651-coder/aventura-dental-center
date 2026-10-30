// qa-a11y.mjs — Phase 6 (Assistive-Tech Operability, WCAG A/AA) CAPSTONE GATE.
//
// ONE rendered-browser gate that certifies all five Phase-6 success criteria in a
// REAL headless Chrome (playwright-core from the pinned LocalGrid install), using the
// Chrome DevTools Protocol accessibility tree for the drawer proof and axe-core
// (injected read-only from the Hidalgo sibling install) for heading-order. It reuses
// qa-mobile-conversion.mjs's vercel.json-aware resolveFile() + http.createServer() +
// sitemapPaths() block VERBATIM (do NOT fork the server) so all 54 clean-URL routes
// resolve exactly as they ship.
//
// The SIX checks (each is negative-tested in 06-06 Task 3 — sabotage the specific fix,
// this gate must exit non-zero on the CORRECT check, then revert; per Execution Rule #4
// no check may be a tautology):
//
//   CHECK A — Drawer AX (A11Y-04): 54 drawer pages @375x812 isMobile. CDP
//     Accessibility.getFullAXTree exposes the 8 drawer links (Home, About, Services,
//     Locations, Contact, Blog, Team, Book an Appointment) — SCOPED by backendDOMNodeId
//     to the anchors INSIDE #mobileNav so the desktop pill / sticky bar / chat "Book"
//     links can never inflate the count — as non-ignored link nodes when OPEN, 0 when
//     CLOSED; toggle aria-expanded tracks state; Escape closes; Tab from the last drawer
//     link wraps to the first (focus trap); focus returns to the toggle on close. Post-Phase-8
//     there are NO exemptions — the bio page /team/dr-david-bistritz joined the shared chrome,
//     so the drawerless set must be EMPTY (every one of the 54 pages carries the drawer).
//
//   CHECK B — FAQ ARIA (A11Y-05): 20 accordion pages. Every .faq-trigger's aria-expanded
//     equals its aria-controls panel's rendered display, on load AND across a real toggle
//     sequence (open 1 -> open 2 -> collapse 2 -> open 0). On /faq the first trigger's
//     computed font-weight is >=600 and font-size >=16px (the 06-03 h3>button reorder did
//     not blow the styling back to a UA-default heading).
//
//   CHECK C — Chat tab-stops + close focus-return (A11Y-06 + MD-01): all 54 pages. The
//     closed #adcPanel is visibility:hidden AND inert, and contributes 0 reachable focus
//     stops (every descendant focusable rejects .focus()). Pre-fix it contributed 9. Then,
//     after that closed-state proof, a focus-return sub-assertion opens the panel, focuses an
//     in-panel control (#adcClose), invokes close(), and asserts focus lands back on the chat
//     FAB (#adcFab) — the WCAG 2.4.3 restore that pre-fix orphaned focus to <body>.
//
//   CHECK D — Hero pause (A11Y-01 + A11Y-09 hero, / only): the pause control is visible
//     and RECEIVES_CLICK (elementFromPoint at its centre === the button — the z-index:3
//     stacking proof), and BOTH a real mouse click AND a keyboard activation (focus +
//     Enter) stop auto-advance (slide index unchanged after 12s) with focus remaining on
//     the control (not <body>).
//
//   CHECK E — Reviews focus retention (A11Y-09 reviews, / only): after keyboard-activating
//     dot[2], document.body.contains(dot) === true AND document.activeElement === that same
//     dot (aria-label "Go to slide 3", .is-active), NOT <body>.
//
//   CHECK F — Skip-link + active-nav + heading-order (A11Y-10 + A11Y-11): the first Tab
//     focuses the visible skip link (computed top 8px, in-viewport) on all 54 main-bearing
//     pages (no exemptions post-Phase-8: the mainless set must be EMPTY);
//     aria-current="page" is present in BOTH the desktop pill AND the matching-text mobile
//     drawer link on the 51 nav-destination pages (faq/privacy-policy/terms carry no
//     destination); axe-core heading-order == 0 violations across all 54 URLs.
//
// Browser: playwright-core, system Chrome, { channel:'chrome', headless:true }.
// axe-core: read from the Hidalgo install, injected per page (never written to a served file).
//
// Usage: node scripts/qa-a11y.mjs
// Prints a JSON summary and exits 0 iff every check passes on every page in its set.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/Users/judykim/Desktop/JUDY_KIM/BUSINESS/projects/LocalGrid/node_modules/playwright-core/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// axe-core source — read from the sibling Hidalgo install (read-only, injected into the
// ephemeral QA page only; never written into any served file — scripts/ is .vercelignore'd).
const AXE_SOURCE_PATH = '/Users/judykim/Desktop/JUDY_KIM/BUSINESS/projects/Hidalgo/node_modules/axe-core/axe.min.js';
const axeSource = fs.readFileSync(AXE_SOURCE_PATH, 'utf8');

// Exemptions retired in Phase 8 (DSYS-01,02): the bio page /team/dr-david-bistritz was the
// single declared, size-asserted exemption because it carried no #mobileNav drawer and no
// <main>. Phase 8 rebuilt it on the shared chrome, so ALL 54 pages must now carry a drawer
// and a <main> — the drawerless set AND the mainless set must each be EMPTY. Any page that
// loses its drawer / <main> (including the bio page regressing) now fails the gate.
const DRAWER_EXEMPT = [];
if (DRAWER_EXEMPT.length !== 0) {
  console.error(JSON.stringify({ error: `DRAWER_EXEMPT must be empty post-Phase-8, has ${DRAWER_EXEMPT.length}` }));
  process.exit(1);
}

// The 8 drawer link accessible names (CHECK A).
const DRAWER_LABELS = ['Home', 'About', 'Services', 'Locations', 'Contact', 'Blog', 'Team', 'Book an Appointment'];

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

function setsEqual(a, b) {
  const x = [...a].sort(), y = [...b].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK A — Drawer AX (54 drawer pages @375x812 isMobile, CDP getFullAXTree)
// ════════════════════════════════════════════════════════════════════════════
async function checkDrawer(context, port, urls) {
  const drawerless = [];
  const perPage = [];
  let pass = 0;

  for (const urlPath of urls) {
    const page = await context.newPage();
    const reasons = [];
    try {
      await page.goto(`http://127.0.0.1:${port}${urlPath}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const hasDrawer = await page.evaluate(() => !!document.getElementById('mobileNav'));
      if (!hasDrawer) {
        drawerless.push(urlPath);
        await page.close();
        continue; // bio: asserted against DRAWER_EXEMPT after the loop
      }

      const client = await page.context().newCDPSession(page);
      await client.send('Accessibility.enable');
      await client.send('DOM.enable');

      // backendDOMNodeIds of the 8 anchors INSIDE #mobileNav (stable across class toggles).
      const doc = await client.send('DOM.getDocument', { depth: -1 });
      const nav = await client.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#mobileNav' });
      const anchorSel = await client.send('DOM.querySelectorAll', { nodeId: nav.nodeId, selector: 'a[href]' });
      const backendIds = [];
      for (const nid of anchorSel.nodeIds) {
        const d = await client.send('DOM.describeNode', { nodeId: nid });
        backendIds.push(d.node.backendNodeId);
      }
      if (backendIds.length !== 8) reasons.push(`drawer-anchor-count ${backendIds.length} (expected 8)`);

      async function exposedDrawerLinks() {
        const { nodes } = await client.send('Accessibility.getFullAXTree');
        const names = [];
        for (const n of nodes) {
          if (n.ignored) continue;
          if (!n.role || n.role.value !== 'link') continue;
          if (!backendIds.includes(n.backendDOMNodeId)) continue;
          names.push(n.name ? n.name.value : '');
        }
        return names;
      }

      // Closed baseline.
      const closedNames = await exposedDrawerLinks();
      if (closedNames.length !== 0) reasons.push(`closed-exposes-${closedNames.length}-links (expected 0)`);
      const closedExpanded = await page.evaluate(() => document.querySelector('.nav-mobile-toggle').getAttribute('aria-expanded'));
      if (closedExpanded !== 'false') reasons.push(`closed-aria-expanded ${closedExpanded} (expected false)`);

      // Open (focus the toggle first so lastFocused === toggle for the focus-restore check).
      await page.evaluate(() => { const t = document.querySelector('.nav-mobile-toggle'); t.focus(); t.click(); });
      await page.waitForTimeout(120);
      const openNames = await exposedDrawerLinks();
      // Accessible names carry the drawer's CSS text-transform:uppercase, so compare
      // case-insensitively against the 8 labels (the exposure/count is the real proof).
      const normOpen = openNames.map((s) => s.trim().toUpperCase());
      const normLabels = DRAWER_LABELS.map((s) => s.toUpperCase());
      if (!(openNames.length === 8 && setsEqual(normOpen, normLabels))) {
        reasons.push(`open-exposes ${openNames.length}/8 [${openNames.join('|')}]`);
      }
      const openState = await page.evaluate(() => ({
        ariaHidden: document.getElementById('mobileNav').getAttribute('aria-hidden'),
        expanded: document.querySelector('.nav-mobile-toggle').getAttribute('aria-expanded'),
        isOpen: document.getElementById('mobileNav').classList.contains('is-open'),
      }));
      if (openState.ariaHidden !== 'false') reasons.push(`open-aria-hidden ${openState.ariaHidden} (expected false)`);
      if (openState.expanded !== 'true') reasons.push(`open-aria-expanded ${openState.expanded} (expected true)`);
      if (!openState.isOpen) reasons.push('open-missing-is-open-class');

      // Focus trap: Tab from the last drawer anchor wraps to the first. (The overlay's own
      // close button is display:none — the ✕ lives on the toggle — so it's not in the trap.)
      await page.evaluate(() => { const f = document.querySelectorAll('#mobileNav a[href]'); f[f.length - 1].focus(); });
      await page.keyboard.press('Tab');
      const trapped = await page.evaluate(() => {
        const f = document.querySelectorAll('#mobileNav a[href]');
        return document.activeElement === f[0];
      });
      if (!trapped) reasons.push('focus-trap-broken (Tab from last did not wrap to first)');

      // Escape closes + restores focus to the toggle.
      await page.keyboard.press('Escape');
      await page.waitForTimeout(60);
      const closedState = await page.evaluate(() => {
        const nav = document.getElementById('mobileNav');
        const t = document.querySelector('.nav-mobile-toggle');
        return {
          isOpen: nav.classList.contains('is-open'),
          ariaHidden: nav.getAttribute('aria-hidden'),
          focusOnToggle: document.activeElement === t,
        };
      });
      if (closedState.isOpen) reasons.push('escape-did-not-close (.is-open still present)');
      if (closedState.ariaHidden !== 'true') reasons.push(`escape-aria-hidden ${closedState.ariaHidden} (expected true)`);
      if (!closedState.focusOnToggle) reasons.push('focus-not-restored-to-toggle');

      await client.detach().catch(() => {});
    } catch (e) {
      reasons.push(`error: ${e.message.split('\n')[0]}`);
    }
    if (reasons.length === 0) pass++;
    else perPage.push({ url: urlPath, reasons });
    await page.close();
  }

  const exemptOk = setsEqual(drawerless, DRAWER_EXEMPT);
  return {
    name: 'A_drawer',
    pass, total: urls.length - DRAWER_EXEMPT.length,
    drawerless, exemptOk,
    failures: perPage,
    ok: exemptOk && perPage.length === 0 && pass === (urls.length - DRAWER_EXEMPT.length),
  };
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK B — FAQ ARIA (20 accordion pages)
// ════════════════════════════════════════════════════════════════════════════
async function checkFaq(context, port, urls) {
  const perPage = [];
  let processed = 0, pass = 0;

  async function mismatches(page) {
    return page.evaluate(() => {
      const trigs = [...document.querySelectorAll('.faq-trigger')];
      let bad = 0; const detail = [];
      trigs.forEach((t, i) => {
        const exp = t.getAttribute('aria-expanded') === 'true';
        const pid = t.getAttribute('aria-controls');
        const panel = pid ? document.getElementById(pid) : null;
        const disp = panel ? getComputedStyle(panel).display : 'NO-PANEL';
        const open = disp === 'block';
        if (exp !== open) { bad++; detail.push({ i, exp, disp }); }
      });
      return { bad, count: trigs.length, detail };
    });
  }

  for (const urlPath of urls) {
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}${urlPath}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const isFaqPage = await page.evaluate(() => !!document.querySelector('[data-faq-accordion]'));
    if (!isFaqPage) { await page.close(); continue; }
    processed++;
    const reasons = [];

    const onLoad = await mismatches(page);
    if (onLoad.bad !== 0) reasons.push(`on-load ${onLoad.bad}/${onLoad.count} mismatches ${JSON.stringify(onLoad.detail)}`);

    // Real toggle sequence: open item1 -> open item2 -> collapse item2 -> open item0.
    const seq = [1, 2, 2, 0];
    for (const idx of seq) {
      const clicked = await page.evaluate((i) => {
        const trigs = document.querySelectorAll('.faq-trigger');
        if (i >= trigs.length) return false;
        trigs[i].click();
        return true;
      }, idx);
      if (!clicked) continue;
      await page.waitForTimeout(30);
      const after = await mismatches(page);
      if (after.bad !== 0) reasons.push(`after-click-${idx} ${after.bad} mismatches ${JSON.stringify(after.detail)}`);
    }

    // /faq styling guard: first trigger keeps design-system weight/size (no UA h3 blowout).
    if (urlPath === '/faq') {
      const st = await page.evaluate(() => {
        const t = document.querySelector('.faq-trigger');
        const cs = getComputedStyle(t);
        return { fw: cs.fontWeight, fs: parseFloat(cs.fontSize) };
      });
      if (!(Number(st.fw) >= 600)) reasons.push(`faq-trigger font-weight ${st.fw} (<600)`);
      if (!(st.fs >= 16)) reasons.push(`faq-trigger font-size ${st.fs}px (<16)`);
    }

    if (reasons.length === 0) pass++;
    else perPage.push({ url: urlPath, reasons });
    await page.close();
  }

  return {
    name: 'B_faq',
    pass, total: processed,
    failures: perPage,
    ok: perPage.length === 0 && processed === 20 && pass === 20,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK C (chat tab-stops) + CHECK F (skip-link, active-nav, heading-order), all 54.
// One sweep, one load per URL. Order per page: fresh-load Tab test FIRST, then active-nav,
// then chat probe (which calls .focus() on panel descendants), then axe heading-order.
// ════════════════════════════════════════════════════════════════════════════
async function checkChatSkipNavHeading(context, port, urls) {
  const chatFail = [];
  const skipFail = [];
  const navFail = [];
  const headingOffenders = [];
  const mainless = [];
  let chatPass = 0;
  let skipPass = 0;      // over the 54 main-bearing pages
  let navPass = 0;       // over the 51 nav-destination pages
  let navDestTotal = 0;
  let headingTotalViolations = 0;

  for (const urlPath of urls) {
    const page = await context.newPage();
    let status = 0;
    try {
      const resp = await page.goto(`http://127.0.0.1:${port}${urlPath}`, { waitUntil: 'networkidle', timeout: 30000 });
      status = resp ? resp.status() : 0;
    } catch (e) {
      chatFail.push({ url: urlPath, reason: `nav-error ${e.message.split('\n')[0]}` });
      headingOffenders.push({ url: urlPath, reason: 'nav-error' });
      await page.close();
      continue;
    }
    if (status !== 200) {
      chatFail.push({ url: urlPath, reason: `http-status ${status}` });
    }

    const hasMain = await page.evaluate(() => !!document.querySelector('main'));
    if (!hasMain) mainless.push(urlPath);

    // ── CHECK F skip-link (main-bearing only) — FIRST interaction after load ──
    if (hasMain) {
      await page.keyboard.press('Tab');
      // The .skip-link slides in via `transition: top 0.2s ease` on :focus; wait for it to
      // settle before reading computed `top`, or we sample the pill mid-slide (~-55px).
      await page.waitForTimeout(300);
      const sk = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || !el.classList || !el.classList.contains('skip-link')) {
          return { ok: false, cls: el ? (el.className || el.tagName) : 'none' };
        }
        const href = el.getAttribute('href') || '';
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return { ok: true, hrefOk: href.endsWith('#main'), top: parseFloat(cs.top), boxTop: r.top, boxH: r.height };
      });
      if (!sk.ok) {
        skipFail.push({ url: urlPath, reason: `first-Tab not skip-link (focused: ${sk.cls})` });
      } else if (!sk.hrefOk) {
        skipFail.push({ url: urlPath, reason: 'skip-link href does not end #main' });
      } else if (!(sk.top >= 6 && sk.top <= 10 && sk.boxTop >= 0 && sk.boxTop < 200 && sk.boxH > 0)) {
        skipFail.push({ url: urlPath, reason: `skip-link not visible-on-focus (top ${sk.top} boxTop ${sk.boxTop} h ${sk.boxH})` });
      } else {
        skipPass++;
      }
    }

    // ── CHECK F active-nav ──
    const an = await page.evaluate(() => {
      const pill = document.querySelector('.nav-pill__links a.is-active');
      if (!pill) return { hasDest: false };
      const txt = (pill.textContent || '').trim();
      const pillAria = pill.getAttribute('aria-current');
      const drawerLinks = [...document.querySelectorAll('#mobileNav a')];
      const match = drawerLinks.find((a) => (a.textContent || '').trim() === txt);
      return {
        hasDest: true, txt, pillAria,
        drawerFound: !!match,
        drawerActive: match ? match.classList.contains('is-active') : false,
        drawerAria: match ? match.getAttribute('aria-current') : null,
      };
    });
    if (an.hasDest) {
      navDestTotal++;
      const problems = [];
      if (an.pillAria !== 'page') problems.push(`pill aria-current ${an.pillAria}`);
      if (!an.drawerFound) problems.push(`no drawer link matching "${an.txt}"`);
      else {
        if (!an.drawerActive) problems.push('drawer link not .is-active');
        if (an.drawerAria !== 'page') problems.push(`drawer aria-current ${an.drawerAria}`);
      }
      if (problems.length === 0) navPass++;
      else navFail.push({ url: urlPath, reason: problems.join('; ') });
    }

    // ── CHECK C chat tab-stops ──
    const chat = await page.evaluate(() => {
      const p = document.getElementById('adcPanel');
      if (!p) return { present: false };
      const vis = getComputedStyle(p).visibility;
      const inert = p.inert === true;
      const foci = [...p.querySelectorAll('a[href], button, [tabindex]')];
      let reachable = 0;
      for (const el of foci) {
        try { el.focus(); } catch (e) {}
        if (document.activeElement === el) reachable++;
      }
      return { present: true, vis, inert, focusables: foci.length, reachable };
    });
    if (!chat.present) {
      chatFail.push({ url: urlPath, reason: '#adcPanel not present' });
    } else {
      const cp = [];
      if (chat.vis !== 'hidden') cp.push(`visibility ${chat.vis}`);
      if (chat.inert !== true) cp.push('not inert');
      if (chat.reachable !== 0) cp.push(`${chat.reachable} reachable tab stops (of ${chat.focusables})`);

      // CHECK C focus-return (MD-01, WCAG 2.4.3): open the panel via the FAB, put keyboard
      // focus on an in-panel control (#adcClose), then invoke the widget's own close (click
      // #adcClose). Focus must land back on the chat FAB (#adcFab) — never orphaned to <body>.
      // Runs AFTER the closed-panel probe above so those negative tests still bite first.
      const ret = await page.evaluate(() => {
        const fab = document.getElementById('adcFab');
        const closeBtn = document.getElementById('adcClose');
        if (!fab || !closeBtn) return { ok: false, missing: true };
        fab.click();                                   // open(): clears panel.inert, hides+inerts the FAB
        closeBtn.focus();                              // focus an in-panel control
        const focusedInPanel = document.activeElement === closeBtn;
        closeBtn.click();                              // close(): must end with fab.focus()
        const active = document.activeElement;
        return {
          ok: focusedInPanel && active === fab,
          missing: false,
          focusedInPanel,
          landedTag: active ? (active.id || active.className || active.tagName) : 'none',
        };
      });
      if (ret.missing) cp.push('#adcFab/#adcClose not present for focus-return probe');
      else if (!ret.focusedInPanel) cp.push('could not focus in-panel control before close');
      else if (!ret.ok) cp.push(`focus not returned to #adcFab on close (landed on ${ret.landedTag})`);

      if (cp.length === 0) chatPass++;
      else chatFail.push({ url: urlPath, reason: cp.join('; ') });
    }

    // ── CHECK F heading-order (axe-core) ──
    try {
      await page.addScriptTag({ content: axeSource });
      const res = await page.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: { type: 'rule', values: ['heading-order'] } });
        let count = 0; const nodes = [];
        for (const v of r.violations) { count += v.nodes.length; for (const n of v.nodes) nodes.push(n.target); }
        return { count, nodes };
      });
      headingTotalViolations += res.count;
      if (res.count > 0) headingOffenders.push({ url: urlPath, count: res.count, nodes: res.nodes });
    } catch (e) {
      headingOffenders.push({ url: urlPath, reason: `axe-error ${e.message.split('\n')[0]}` });
      headingTotalViolations += 1;
    }

    await page.close();
  }

  const mainlessExemptOk = setsEqual(mainless, DRAWER_EXEMPT);
  return {
    chat: {
      name: 'C_chat', pass: chatPass, total: urls.length,
      failures: chatFail, ok: chatFail.length === 0 && chatPass === urls.length,
    },
    skip: {
      name: 'F_skiplink', pass: skipPass, total: urls.length - DRAWER_EXEMPT.length,
      mainless, mainlessExemptOk, failures: skipFail,
      ok: mainlessExemptOk && skipFail.length === 0 && skipPass === (urls.length - DRAWER_EXEMPT.length),
    },
    nav: {
      name: 'F_activenav', pass: navPass, total: navDestTotal,
      // 51 nav-destination pages post-Phase-8: the bio page /team/dr-david-bistritz joined the
      // shared chrome and correctly marks "Team" active (was 50 while the bio page was an orphan).
      failures: navFail, ok: navFail.length === 0 && navDestTotal === 51 && navPass === 51,
    },
    heading: {
      name: 'F_headingorder', violations: headingTotalViolations, pagesScanned: urls.length,
      offenders: headingOffenders, ok: headingTotalViolations === 0 && headingOffenders.length === 0,
    },
  };
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK D — Hero pause (/ only)
// ════════════════════════════════════════════════════════════════════════════
async function checkHero(context, port) {
  const reasons = [];
  const detail = {};

  async function run(page, mode) {
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle', timeout: 30000 });
    const has = await page.evaluate(() => !!document.querySelector('.hero__pause'));
    if (!has) return { hasButton: false };
    await page.evaluate(() => document.querySelector('.hero__pause').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(500); // settle any post-scroll reflow so the control's box is stable
    const before = await page.evaluate(() => {
      const b = document.querySelector('.hero__pause');
      const r = b.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const hit = document.elementFromPoint(cx, cy);
      const slides = [...document.querySelectorAll('.hero__slide')];
      return {
        cx, cy, w: r.width, h: r.height,
        visible: r.width > 0 && r.height > 0,
        receivesClick: hit === b || b.contains(hit),
        hit: hit ? String(hit.className || hit.tagName) : null,
        idx: slides.findIndex((s) => s.classList.contains('is-active')),
      };
    });
    const isPaused = () => page.evaluate(() => document.querySelector('.hero__pause').getAttribute('aria-label') === 'Play slideshow');
    async function activate() {
      if (mode === 'mouse') {
        // Re-read the box immediately before clicking to avoid coordinate staleness.
        const box = await page.evaluate(() => { const r = document.querySelector('.hero__pause').getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; });
        await page.mouse.click(box.cx, box.cy);
      } else {
        await page.evaluate(() => document.querySelector('.hero__pause').focus());
        await page.keyboard.press('Enter');
      }
    }
    await activate();
    // Confirm the activation registered before committing to the 12s dwell; a single
    // synthetic click on a 44px control is occasionally dropped by headless Chrome — retry
    // ONCE (mouse only). This does NOT mask the z-index:1 sabotage: when the control is
    // covered, the click never reaches it, so the retry misses too and RECEIVES_CLICK is false.
    await page.waitForTimeout(300);
    if (mode === 'mouse' && !(await isPaused())) { await activate(); await page.waitForTimeout(300); }
    await page.waitForTimeout(12000);
    const after = await page.evaluate(() => {
      const b = document.querySelector('.hero__pause');
      const slides = [...document.querySelectorAll('.hero__slide')];
      return {
        idx: slides.findIndex((s) => s.classList.contains('is-active')),
        focusOnBtn: document.activeElement === b,
        label: b.getAttribute('aria-label'),
      };
    });
    return { hasButton: true, before, after };
  }

  // Mouse path.
  let page = await context.newPage();
  const m = await run(page, 'mouse');
  await page.close();
  detail.mouse = m;
  if (!m.hasButton) reasons.push('mouse: .hero__pause missing');
  else {
    if (!m.before.visible) reasons.push('mouse: pause control not visible');
    if (!m.before.receivesClick) reasons.push(`mouse: RECEIVES_CLICK false (hit ${m.before.hit})`);
    if (m.after.idx !== m.before.idx) reasons.push(`mouse: auto-advanced ${m.before.idx}->${m.after.idx} (not paused)`);
    if (!m.after.focusOnBtn) reasons.push('mouse: focus not on control after click');
  }

  // Keyboard path.
  page = await context.newPage();
  const k = await run(page, 'key');
  await page.close();
  detail.keyboard = k;
  if (!k.hasButton) reasons.push('key: .hero__pause missing');
  else {
    if (!k.before.receivesClick) reasons.push(`key: RECEIVES_CLICK false (hit ${k.before.hit})`);
    if (k.after.idx !== k.before.idx) reasons.push(`key: auto-advanced ${k.before.idx}->${k.after.idx} (not paused)`);
    if (!k.after.focusOnBtn) reasons.push('key: focus not on control after Enter');
  }

  return { name: 'D_hero', ok: reasons.length === 0, reasons, detail };
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK E — Reviews focus retention (/ only)
// ════════════════════════════════════════════════════════════════════════════
async function checkReviews(context, port) {
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle', timeout: 30000 });
  const reasons = [];
  const dotCount = await page.evaluate(() => document.querySelectorAll('.carousel-dot').length);
  if (dotCount < 3) { reasons.push(`only ${dotCount} review dots (need >=3 to activate dot[2])`); await page.close(); return { name: 'E_reviews', ok: false, reasons }; }

  await page.evaluate(() => {
    const dots = document.querySelectorAll('.carousel-dot');
    dots[2].setAttribute('data-qa-dot', '1');
    dots[2].focus();
  });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(60);
  const r = await page.evaluate(() => {
    const dot = document.querySelector('[data-qa-dot="1"]');
    return {
      exists: !!dot,
      contained: dot ? document.body.contains(dot) : false,
      isActiveEl: document.activeElement === dot,
      active: dot ? dot.classList.contains('is-active') : false,
      label: dot ? dot.getAttribute('aria-label') : null,
      activeTag: document.activeElement ? document.activeElement.tagName : 'none',
    };
  });
  if (!r.exists) reasons.push('tagged dot[2] destroyed (not in DOM)');
  if (!r.contained) reasons.push('document.body no longer contains the activated dot');
  if (!r.isActiveEl) reasons.push(`activeElement is not the dot (it is <${r.activeTag}>)`);
  if (!r.active) reasons.push('activated dot is not .is-active');
  if (r.label !== 'Go to slide 3') reasons.push(`dot[2] aria-label "${r.label}" (expected "Go to slide 3")`);
  await page.close();
  return { name: 'E_reviews', ok: reasons.length === 0, reasons, detail: r };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  const urls = sitemapPaths();

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  // Mobile context for the drawer AX proof (375x812 isMobile + hasTouch, like qa-mobile-nav).
  const mobileCtx = await browser.newContext({
    viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true,
    deviceScaleFactor: 3, reducedMotion: 'no-preference',
  });
  // Desktop context for the rest (reducedMotion no-preference so the hero pause button renders).
  const deskCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference',
  });

  const A = await checkDrawer(mobileCtx, port, urls);
  const B = await checkFaq(deskCtx, port, urls);
  const CF = await checkChatSkipNavHeading(deskCtx, port, urls);
  const D = await checkHero(deskCtx, port);
  const E = await checkReviews(deskCtx, port);

  await browser.close();
  await new Promise((resolve) => server.close(resolve));

  const checks = {
    A_drawer: A,
    B_faq: B,
    C_chat: CF.chat,
    D_hero: D,
    E_reviews: E,
    F_skiplink: CF.skip,
    F_activenav: CF.nav,
    F_headingorder: CF.heading,
  };

  const allOk =
    A.ok && B.ok && CF.chat.ok && D.ok && E.ok && CF.skip.ok && CF.nav.ok && CF.heading.ok;

  const summary = {
    gate: 'qa-a11y (Phase 6 capstone)',
    result: allOk ? 'PASS' : 'FAIL',
    checks: {
      A_drawer:       { ok: A.ok, pass: `${A.pass}/${A.total}`, drawerlessExemptOk: A.exemptOk, drawerless: A.drawerless },
      B_faq:          { ok: B.ok, pass: `${B.pass}/${B.total}` },
      C_chat:         { ok: CF.chat.ok, pass: `${CF.chat.pass}/${CF.chat.total}` },
      D_hero:         { ok: D.ok, result: D.ok ? 'PASS' : 'FAIL' },
      E_reviews:      { ok: E.ok, result: E.ok ? 'PASS' : 'FAIL' },
      F_skiplink:     { ok: CF.skip.ok, pass: `${CF.skip.pass}/${CF.skip.total}`, mainlessExemptOk: CF.skip.mainlessExemptOk, mainless: CF.skip.mainless },
      F_activenav:    { ok: CF.nav.ok, pass: `${CF.nav.pass}/${CF.nav.total}` },
      F_headingorder: { ok: CF.heading.ok, violations: CF.heading.violations, pagesScanned: CF.heading.pagesScanned },
    },
    failures: {
      A_drawer: A.failures,
      B_faq: B.failures,
      C_chat: CF.chat.failures,
      D_hero: D.ok ? [] : D.reasons,
      E_reviews: E.ok ? [] : E.reasons,
      F_skiplink: CF.skip.failures,
      F_activenav: CF.nav.failures,
      F_headingorder: CF.heading.offenders,
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
