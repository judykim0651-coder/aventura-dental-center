// sweep-skiplink-activenav.mjs — A11Y-10 (WCAG 2.4.1 Bypass Blocks + 4.1.2
// aria-current) one-shot sweep of the 53 <main>-bearing served pages + the
// (never-served) partial.
//
// Usage:  node scripts/sweep-skiplink-activenav.mjs
//
// For EACH of the 53 served pages it, in order:
//   1. Backs the file up to .backup-phase06/<origpath> (dirs created).
//      ".backup-phase*" is in .vercelignore, so backups never ship publicly.
//   2. Idempotency — each of the three edits is skipped if its marker already
//      exists:  class="skip-link" (skip link) · id="main" (main target) ·
//      aria-current="page" (active nav).
//   3. Skip link — inserts `<a href="#main" class="skip-link">Skip to content</a>`
//      immediately after the opening <body> tag, so it is the FIRST focusable
//      element (before the cta-header tel: link). Text "Skip to content" (D-11).
//   4. Main target — adds id="main" tabindex="-1" to the page's single <main>
//      opening tag (handles <main> and <main class="...">), giving the skip link
//      a focusable destination. Never duplicated.
//   5. Active nav aria-current — finds the desktop .nav-pill__links a.is-active,
//      adds aria-current="page" to it, reads its VISIBLE TEXT, then in #mobileNav
//      finds the drawer <a> whose visible text equals that (text-match — drawer
//      hrefs are relative on root pages, absolute on subpages) and adds
//      class="is-active" aria-current="page". Pages with no desktop is-active
//      (faq, privacy-policy, terms) get NO active-nav edit — recorded as
//      "no nav destination" (expected).
//
// Then the equivalent skip-link prepend is applied to partials/header.html (D-16
// — belt-and-braces so hand-built future pages inherit it). The partial has no
// <body>/<main> and no is-active by design, so only the skip link is prepended.
//
// team/dr-david-bistritz.html is the single declared exemption (no <main>, hand-
// rolled nav; rebuilt on shared chrome in Phase 8) and is NOT in the file list.
//
// Half-applied-cue gate: exits non-zero if any page that HAS a desktop is-active
// link fails to also carry a drawer aria-current after the sweep.
//
// Dependency-free (Node stdlib only).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const BACKUP_ROOT = path.join(REPO_ROOT, '.backup-phase06');

// The 53 <main>-bearing served pages (== the HTML entries in 06-05-PLAN.md
// files_modified == `grep -rl '<main' --include='*.html' . | grep -v backup |
// grep -v partials`, which excludes exactly team/dr-david-bistritz.html).
const FILES = [
  'index.html', 'about.html', 'services.html', 'locations.html', 'contact.html',
  'blog.html', 'team.html', 'faq.html', 'privacy-policy.html', 'terms.html',
  'cosmetic-dentistry.html', 'preventive-dentistry.html', 'family-dentistry.html',
  'aventura.html', 'golden-beach.html', 'hallandale-beach.html', 'hollywood.html',
  'ives-estates.html', 'miami-gardens.html', 'north-miami-beach.html',
  'pembroke-park.html', 'sunny-isles-beach.html',
  'SERVICES/all-on-4-implants.html', 'SERVICES/composite-fillings.html',
  'SERVICES/dental-bonding.html', 'SERVICES/dental-checkup.html',
  'SERVICES/dental-cleaning-examinations.html', 'SERVICES/dental-crowns-bridges.html',
  'SERVICES/dental-implants.html', 'SERVICES/dental-veneers-laminates.html',
  'SERVICES/dentures-partial-dentures.html', 'SERVICES/emergency-dentist.html',
  'SERVICES/full-mouth-reconstruction.html', 'SERVICES/invisalign-dentist.html',
  'SERVICES/invisalign-vs-braces.html', 'SERVICES/professional-teeth-whitening.html',
  'SERVICES/root-canal-treatment.html', 'SERVICES/smile-makeover.html',
  'SERVICES/tooth-extraction.html',
  'BLOG/complete-guide-tooth-pain.html', 'BLOG/confidence-curve.html',
  'BLOG/daily-habits-oral-health.html', 'BLOG/dental-checkups-guide.html',
  'BLOG/dental-fillings.html', 'BLOG/dental-implants-guide.html',
  'BLOG/discovering-clear-aligners.html', 'BLOG/expert-guide-dental-crowns.html',
  'BLOG/hidden-costs-skipping-checkups.html', 'BLOG/hidden-secrets-dental-xrays.html',
  'BLOG/how-often-visit-dentist.html', 'BLOG/modern-dental-fillings.html',
  'BLOG/porcelain-vs-composite-veneers.html', 'BLOG/preventive-dentistry.html',
];

const PARTIAL = 'partials/header.html';
const SKIP_LINK = '<a href="#main" class="skip-link">Skip to content</a>';

// Strip inline markup and normalize whitespace to compare visible link text.
const visibleText = (html) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

function backup(rel, original) {
  const backupPath = path.join(BACKUP_ROOT, rel);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(backupPath, original);
}

let skipTotal = 0;
let mainTotal = 0;
let activePairTotal = 0; // pages where BOTH pill + drawer carry aria-current after sweep
let failed = false;
const noNavDestination = [];

for (const rel of FILES) {
  const abs = path.join(REPO_ROOT, rel);
  const original = fs.readFileSync(abs, 'utf8');
  backup(rel, original);

  let content = original;
  let skipLinkAdded = false;
  let mainIdAdded = false;

  // 3. Skip link — first child of <body>.
  if (!content.includes('class="skip-link"')) {
    content = content.replace('<body>', `<body>\n  ${SKIP_LINK}`);
    skipLinkAdded = true;
  }

  // 4. Main target — id + focusable tabindex on the single <main> opening tag.
  if (!/<main[^>]*\bid="main"/.test(content)) {
    content = content.replace(/<main((?:\s[^>]*)?)>/, (m, attrs) =>
      `<main id="main" tabindex="-1"${attrs || ''}>`);
    mainIdAdded = true;
  }

  // 5. Active nav aria-current (desktop pill + mirrored into the drawer).
  let desktopCurrent = null;   // visible text of the active pill link, if any
  let drawerCurrentText = null; // visible text of the matched drawer link, if any

  const pillMatch = content.match(/<nav class="nav-pill__links"[\s\S]*?<\/nav>/);
  if (pillMatch) {
    const pill = pillMatch[0];
    const activeAnchor = pill.match(/<a\b[^>]*class="[^"]*\bis-active\b[^"]*"[^>]*>([\s\S]*?)<\/a>/);
    if (activeAnchor) {
      desktopCurrent = visibleText(activeAnchor[1]);
      // Add aria-current="page" to the active pill anchor (idempotent).
      const newPill = pill.replace(
        /(<a\b[^>]*class="[^"]*\bis-active\b[^"]*")([^>]*>)/,
        (m, head, tail) => (/aria-current/.test(m) ? m : `${head} aria-current="page"${tail}`),
      );
      content = content.replace(pill, newPill);
    }
  }

  if (desktopCurrent) {
    const drawerMatch = content.match(/<div id="mobileNav"[\s\S]*?<\/div>/);
    if (drawerMatch) {
      const drawer = drawerMatch[0];
      const newDrawer = drawer.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/g, (m, attrs, inner) => {
        if (/nav-mobile-overlay__cta/.test(attrs)) return m; // never the Book CTA
        if (visibleText(inner) !== desktopCurrent) return m;
        drawerCurrentText = desktopCurrent;
        if (/aria-current/.test(attrs)) return m; // idempotent
        if (/class="/.test(attrs)) {
          return `<a${attrs.replace(/class="([^"]*)"/, 'class="$1 is-active"')} aria-current="page">${inner}</a>`;
        }
        return `<a${attrs} class="is-active" aria-current="page">${inner}</a>`;
      });
      content = content.replace(drawer, newDrawer);
    }
  } else {
    noNavDestination.push(rel);
  }

  if (content !== original) fs.writeFileSync(abs, content);

  // Presence assertions on the FINAL on-disk content.
  const skipPresent = /class="skip-link"/.test(content);
  const mainPresent = /<main[^>]*\bid="main"/.test(content);
  const pillCurrentPresent = /<a\b[^>]*class="[^"]*\bis-active\b[^"]*"[^>]*aria-current="page"|<a\b[^>]*aria-current="page"[^>]*class="[^"]*\bis-active\b/.test(content);
  const drawerCurrentPresent = drawerCurrentText != null
    && /<div id="mobileNav"[\s\S]*?aria-current="page"[\s\S]*?<\/div>/.test(content);

  if (skipPresent) skipTotal += 1;
  if (mainPresent) mainTotal += 1;

  // Half-applied-cue gate: a page with a desktop is-active MUST end with
  // aria-current in BOTH the pill and the drawer.
  if (desktopCurrent) {
    const pairOk = pillCurrentPresent && drawerCurrentPresent;
    if (pairOk) activePairTotal += 1;
    else {
      failed = true;
      console.error(`MISMATCH in ${rel}: desktopCurrent=${JSON.stringify(desktopCurrent)} pillCurrent=${pillCurrentPresent} drawerCurrent=${drawerCurrentPresent}`);
    }
  }

  console.log(JSON.stringify({
    file: rel, skipLinkAdded, mainIdAdded, desktopCurrent, drawerCurrentText,
  }));

  if (!skipPresent || !mainPresent) {
    failed = true;
    console.error(`INCOMPLETE in ${rel}: skipPresent=${skipPresent} mainPresent=${mainPresent}`);
  }
}

// D-16 — apply the skip link to the never-served partial too (no <main>, no
// is-active there by design; skip-link prepend only).
{
  const abs = path.join(REPO_ROOT, PARTIAL);
  const original = fs.readFileSync(abs, 'utf8');
  backup(PARTIAL, original);
  let partialSkipAdded = false;
  let content = original;
  if (!content.includes('class="skip-link"')) {
    content = `${SKIP_LINK}\n${content}`;
    partialSkipAdded = true;
    fs.writeFileSync(abs, content);
  }
  console.log(JSON.stringify({ file: PARTIAL, skipLinkAdded: partialSkipAdded, note: 'partial: skip-link only (never served; no main/is-active)' }));
}

console.log(JSON.stringify({
  totals: {
    pages: FILES.length,
    skipLinkAdded: skipTotal,
    mainIdAdded: mainTotal,
    activeNavPairs: activePairTotal,
    noNavDestination,
  },
}));

if (failed) {
  console.error('FAIL: at least one page is missing a required marker or has a half-applied active-nav cue.');
  process.exit(1);
}
process.exit(0);
