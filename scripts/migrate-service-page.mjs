// migrate-service-page.mjs — Repeatable old->shared-shell transform for ONE
// service page.
//
// Usage:  node scripts/migrate-service-page.mjs <slug>
// e.g.    node scripts/migrate-service-page.mjs dental-implants
//
// Reads  SERVICES/<slug>.html (the old embedded-style design), backs it up to
// SERVICES/<slug>.html.bak, and rewrites it in place onto the shared design
// system used by faq.html / aventura.html:
//   - <head> SEO preserved VERBATIM (title, meta description, canonical, og/
//     twitter, BOTH JSON-LD blocks, Rubik font) — only the embedded <style> is
//     dropped and <link rel="stylesheet" href="/assets/css/main.css"> is added.
//   - body replaced with the absolute-path shared shell: cta-header, pill nav,
//     mobileNav overlay, <main> (real content lifted from the old page), site
//     footer, shared script block.
//   - every relative asset/link path absolutized (../img -> /img, etc.),
//     sibling SERVICES links -> /SERVICES/<slug>.html.
//
// All 17 service pages share the identical 7-section skeleton, so this transform
// is content-agnostic: it lifts whatever <section> bodies the old page has and
// maps them into shared wrappers, rewriting only structure + paths, never copy.
//
// Dependency-free (Node stdlib only).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node scripts/migrate-service-page.mjs <slug>');
  process.exit(2);
}

const filePath = path.join(REPO_ROOT, 'SERVICES', `${slug}.html`);
if (!fs.existsSync(filePath)) {
  console.error(`Not found: ${filePath}`);
  process.exit(2);
}

const original = fs.readFileSync(filePath, 'utf8');

// ---------------------------------------------------------------------------
// Path absolutizer: rewrites relative "../x" and bare "sibling.html" links to
// absolute paths. Leaves tel:, mailto:, #anchors, and absolute https:// alone.
// ---------------------------------------------------------------------------
function absolutizePaths(html) {
  let out = html;
  // ../img/... -> /img/... , ../assets/... -> /assets/... (src or href, single
  // or double quotes).
  out = out.replace(/(["'])\.\.\/(img|assets)\//g, '$1/$2/');
  // ../<root-page>.html -> /<root-page>.html
  out = out.replace(
    /(["'])\.\.\/(index|about|services|locations|contact|blog|team|faq|privacy-policy|terms)\.html/g,
    '$1/$2.html',
  );
  // Any remaining ../<anything>.html -> /<anything>.html (catch-all for root pages)
  out = out.replace(/(["'])\.\.\/([a-z0-9-]+)\.html/gi, '$1/$2.html');
  return out;
}

// Rewrite a sibling service link (e.g. href="all-on-4-implants.html" or
// href="./all-on-4-implants.html") to the absolute /SERVICES/<slug>.html form.
function absolutizeSiblingServiceLinks(html) {
  return html.replace(
    /href="(?:\.\/)?([a-z0-9-]+)\.html"/gi,
    'href="/SERVICES/$1.html"',
  );
}

// ---------------------------------------------------------------------------
// 1. Build the migrated <head>.
// ---------------------------------------------------------------------------
const headMatch = original.match(/<head>([\s\S]*?)<\/head>/i);
if (!headMatch) {
  console.error('No <head> found');
  process.exit(1);
}
let head = headMatch[1];

// Drop the embedded <style>...</style> block entirely.
head = head.replace(/\n?\s*<style>[\s\S]*?<\/style>/gi, '');

// Remove any pre-existing main.css link so we control its placement.
head = head.replace(/\n?\s*<link\b[^>]*href="\/?assets\/css\/main\.css"[^>]*>/gi, '');

// Trim trailing whitespace, then append the stylesheet link as the last element.
head = head.replace(/\s*$/, '');
head += '\n  <link rel="stylesheet" href="/assets/css/main.css">\n';

// ---------------------------------------------------------------------------
// 2. Extract the human-readable page name (from the original H1) and hero copy.
// ---------------------------------------------------------------------------
const h1Match = original.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
const pageName = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : slug;

// Hero subcopy: the <p> immediately following the H1 inside the hero section.
const heroMatch = original.match(/<section class="hero">([\s\S]*?)<\/section>/i);
let heroSubcopy = '';
if (heroMatch) {
  const pMatch = heroMatch[1].match(/<h1[^>]*>[\s\S]*?<\/h1>\s*<p[^>]*>([\s\S]*?)<\/p>/i);
  if (pMatch) heroSubcopy = pMatch[1].trim();
}

const BOOK_URL = 'https://www.patientsreach.com/schedule/Aventura-Dental-Center/patient_types/';

// ---------------------------------------------------------------------------
// 3. Lift the old <body> content sections.
// The old body layout is: header, section.hero, then a series of plain
// <section> blocks (the first is a lone hero image, the rest are the 7 content
// sections: What-Is, Benefits, What-to-Expect, Care, Key-Features, Related,
// Contact), then footer + script. We capture every <section> AFTER the hero and
// re-wrap it in the shared design system.
// ---------------------------------------------------------------------------
const bodyMatch = original.match(/<body>([\s\S]*?)<\/body>/i);
const body = bodyMatch ? bodyMatch[1] : original;

// Grab all <section ...>...</section> blocks (non-greedy, no nested sections in
// the old pages).
const sectionRegex = /<section\b([^>]*)>([\s\S]*?)<\/section>/gi;
const sections = [];
let m;
while ((m = sectionRegex.exec(body)) !== null) {
  sections.push({ attrs: m[1], inner: m[2] });
}

// Drop the hero section (class="hero") — we rebuild it. Keep the rest.
const contentSections = sections.filter((s) => !/class="hero"/i.test(s.attrs));

// Pull the inner <div class="container">...</div> from a section (the old pages
// always wrap content in one). Fall back to raw inner if absent.
function getContainerInner(inner) {
  const c = inner.match(/<div class="container">([\s\S]*?)<\/div>\s*$/i);
  if (c) return c[1];
  // More permissive: first .container to matching close is hard with regex; the
  // old pages have exactly one .container per section, so a greedy grab to the
  // last </div> is safe.
  const c2 = inner.match(/<div class="container"[^>]*>([\s\S]*)<\/div>/i);
  return c2 ? c2[1] : inner;
}

// Extract the <h2> label from a content section's inner (used as the shared
// section title). Returns { title, rest } where rest = inner minus the old
// .section-title wrapper.
function splitTitle(containerInner) {
  const titleWrap = containerInner.match(/<div class="section-title">([\s\S]*?)<\/div>/i);
  let title = '';
  let subtitle = '';
  let rest = containerInner;
  if (titleWrap) {
    const h2 = titleWrap[1].match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    if (h2) title = h2[1].trim();
    const p = titleWrap[1].match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (p) subtitle = p[1].trim();
    rest = containerInner.replace(/<div class="section-title">[\s\S]*?<\/div>/i, '').trim();
  }
  return { title, subtitle, rest };
}

// Map old benefit/related cards + lists into shared design-system markup.
function transformBody(restHtml) {
  let html = restHtml;

  // Old ".card" benefit boxes -> keep as simple content; the shared CSS styles
  // .service-card, but these plain text cards render fine inside .container.
  // We normalize the old inline-styled grid to the shared .cards-grid class and
  // convert card-body to service-card__body for consistent styling.
  html = html.replace(/<div class="grid"[^>]*>/gi, '<div class="cards-grid">');
  html = html.replace(/<div class="card"([^>]*)>/gi, '<div class="service-card"$1>');
  html = html.replace(/<a href="([^"]+)" class="card">/gi, '<a href="$1" class="service-card">');
  html = html.replace(/<div class="card-body">/gi, '<div class="service-card__body">');

  // Related-services card images: wrap the <img> in .service-card__image so it
  // matches the shared card layout (only inside anchor cards).
  html = html.replace(
    /(<a href="[^"]+" class="service-card">)\s*<img([^>]*)>/gi,
    '$1<div class="service-card__image"><img$2></div>',
  );

  // Old ".btn" (single teal button) -> shared ".btn btn--primary".
  html = html.replace(/class="btn"/gi, 'class="btn btn--primary"');

  return html;
}

// Build the shared <main> content.
let mainSections = '';

// ---- Hero section (rebuilt from the original H1 + subcopy) ----
mainSections += `    <section class="section page-top-clearance" aria-labelledby="svc-h1">
      <div class="container">
        <nav class="breadcrumb breadcrumb--light scroll-animate" aria-label="Breadcrumb"><a href="/index.html">Home</a> &gt; <a href="/services.html">Services</a> &gt; ${pageName}</nav>
        <div class="section-header-center scroll-animate">
          <div class="section-pill"><span class="section-pill__dot"></span>${pageName}</div>
          <h1 class="section-title" id="svc-h1">${pageName}</h1>
          <p class="section-desc" style="margin:16px auto 0">${heroSubcopy}</p>
          <div style="margin-top:24px"><a href="${BOOK_URL}" target="_blank" rel="noopener" class="btn btn--primary">Book an Appointment</a></div>
        </div>
      </div>
    </section>
`;

// ---- Content sections (image + 7 content blocks) ----
let contentIndex = 0;
for (const sec of contentSections) {
  const containerInner = getContainerInner(sec.inner).trim();

  // A lone-image section (old hero image directly under .container, no
  // .section-title). Detect: contains an <img> and no <h2>.
  const hasH2 = /<h2/i.test(containerInner);
  const isImageOnly = !hasH2 && /<img/i.test(containerInner);

  const muted = contentIndex % 2 === 1 ? ' section--muted' : '';

  if (isImageOnly) {
    let body = transformBody(containerInner);
    mainSections += `    <section class="section${muted}">
      <div class="container">
        ${body.trim()}
      </div>
    </section>
`;
    contentIndex++;
    continue;
  }

  const { title, subtitle, rest } = splitTitle(containerInner);
  const isContact = /Contact/i.test(title);
  const isRelated = /Related Services/i.test(title);

  let bodyHtml = transformBody(rest);

  const headerBlock = title
    ? `        <div class="section-header-center scroll-animate"><h2 class="section-title">${title}</h2>${
        subtitle ? `<p class="section-desc" style="margin:16px auto 0">${subtitle}</p>` : ''
      }</div>\n`
    : '';

  mainSections += `    <section class="section${muted}">
      <div class="container">
${headerBlock}        ${bodyHtml.trim()}
      </div>
    </section>
`;
  contentIndex++;
}

// ---- Closing CTA row ----
mainSections += `    <section class="section section--muted">
      <div class="container">
        <div class="section-header-center scroll-animate" style="margin-bottom:0">
          <div style="margin-top:8px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
            <a href="${BOOK_URL}" target="_blank" rel="noopener" class="btn btn--primary">Book an Appointment</a>
            <a href="/contact.html" class="btn btn--outline">Contact Us</a>
          </div>
        </div>
      </div>
    </section>
`;

// ---------------------------------------------------------------------------
// 4. Assemble the shared absolute-path shell around <main>.
// ---------------------------------------------------------------------------
const shellTop = `<body>

<!-- CTA HEADER -->
<div class="cta-header" id="ctaHeader">
  <div class="cta-header__inner">
    <a href="tel:+13059332501">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      <span>(305) 933-2501</span>
    </a>
    <a href="mailto:info@aventuradentalcenter.com">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
      <span>info@aventuradentalcenter.com</span>
    </a>
  </div>
</div>

<!-- FLOATING PILL NAV -->
<header class="site-header">
  <div class="nav-pill">
    <a href="/index.html" class="nav-pill__logo">
      <img src="/img/aventura-dental-center-logo.webp" alt="Aventura Dental Center" width="180" height="60">
    </a>
    <nav class="nav-pill__links" aria-label="Main navigation">
      <a href="/index.html" data-nav="index.html">Home</a>
      <a href="/about.html" data-nav="about.html">About</a>
      <a href="/services.html" data-nav="services.html" class="is-active">Services</a>
      <a href="/locations.html" data-nav="locations.html">Locations</a>
      <a href="/contact.html" data-nav="contact.html">Contact</a>
      <a href="/blog.html" data-nav="blog.html">Blog</a>
      <a href="/team.html" data-nav="team.html">Team</a>
    </nav>
    <a href="${BOOK_URL}" class="nav-pill__cta">Book an Appointment</a>
    <button class="nav-mobile-toggle" type="button" aria-label="Open menu">&#9776;</button>
  </div>
</header>

<div id="mobileNav" class="nav-mobile-overlay" aria-hidden="true">
  <button class="nav-mobile-overlay__close" type="button" aria-label="Close menu">&times;</button>
  <a href="/index.html">Home</a>
  <a href="/about.html">About</a>
  <a href="/services.html">Services</a>
  <a href="/locations.html">Locations</a>
  <a href="/contact.html">Contact</a>
  <a href="/blog.html">Blog</a>
  <a href="/team.html">Team</a>
  <a href="${BOOK_URL}" class="nav-mobile-overlay__cta">Book an Appointment</a>
</div>


  <main>
`;

const shellFooter = `  </main>

<!-- SITE FOOTER -->
<footer class="site-footer">
  <div class="container">
    <div class="footer-main">
      <div class="footer-brand">
        <a href="/index.html"><img src="/img/aventura-dental-center-logo.webp" alt="Aventura Dental Center" width="180" height="60"></a>
        <p><strong>Aventura Dental Center</strong></p>
        <p>18171 Biscayne Blvd<br>Aventura, FL 33160</p>
        <p><a href="tel:+13059332501">(305) 933-2501</a></p>
        <p><a href="mailto:info@aventuradentalcenter.com">info@aventuradentalcenter.com</a></p>
        <div class="footer-social">
          <a href="https://www.yelp.com/biz/aventura-dental-center-aventura" aria-label="Yelp" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg></a>
          <a href="https://share.google/OhvyXs4F5b7BVcNx4" aria-label="Google" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg></a>
          <a href="https://www.facebook.com/DrDavidSBistritzDDSAventuraDentalCenter" aria-label="Facebook" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>
          <a href="https://www.instagram.com/aventuradentalcenter/" aria-label="Instagram" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg></a>
        </div>
      </div>
      <div class="footer-columns">
        <div class="footer-col">
          <h3>Services</h3>
          <ul>
            <li><a href="/SERVICES/all-on-4-implants.html">All-on-4 Implants</a></li>
            <li><a href="/SERVICES/dental-checkup.html">Dental Checkup</a></li>
            <li><a href="/SERVICES/dental-crowns-bridges.html">Dental Crowns &amp; Bridges</a></li>
            <li><a href="/SERVICES/dental-implants.html">Dental Implants</a></li>
            <li><a href="/SERVICES/invisalign-dentist.html">Invisalign Dentist</a></li>
            <li><a href="/SERVICES/smile-makeover.html">Smile Makeover</a></li>
          </ul>
          <a href="/services.html" class="view-all">View All Services</a>
        </div>
        <div class="footer-col">
          <h3>Service Areas</h3>
          <ul>
            <li><a href="/locations.html#hallandale-beach">Hallandale Beach</a></li>
            <li><a href="/locations.html#north-miami-beach">North Miami Beach</a></li>
            <li><a href="/locations.html#sunny-isles-beach">Sunny Isles Beach</a></li>
            <li><a href="/locations.html#golden-beach">Golden Beach</a></li>
            <li><a href="/locations.html#hollywood">Downtown Hollywood</a></li>
            <li><a href="/locations.html#aventura-lakes">Aventura Lakes</a></li>
          </ul>
          <a href="/locations.html" class="view-all">View All Locations</a>
        </div>
        <div class="footer-col">
          <h3>Company</h3>
          <ul>
            <li><a href="/index.html">Home</a></li>
            <li><a href="/about.html">About</a></li>
            <li><a href="/services.html">Services</a></li>
            <li><a href="/locations.html">Locations</a></li>
            <li><a href="/contact.html">Contact</a></li>
            <li><a href="/blog.html">Blog</a></li>
            <li><a href="/team.html">Team</a></li>
            <li><a href="/faq.html">FAQ</a></li>
          </ul>
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <p>&copy; 2026 Aventura Dental Center. All rights reserved.</p>
      <div class="footer-legal">
        <a href="/privacy-policy.html">Privacy Policy</a>
        <a href="/terms.html">Terms of Service</a>
      </div>
      <p>Powered by <a href="https://leveragelocal.com/" target="_blank" rel="noopener">Leverage Local</a></p>
    </div>
  </div>
</footer>

  <script src="/assets/js/nav.js"></script>
  <script src="/assets/js/faq-accordion.js"></script>
  <script src="/assets/js/chat-widget.js" defer></script>
</body>`;

// ---------------------------------------------------------------------------
// 5. Assemble final document, then absolutize any remaining relative paths in
//    the lifted content (main sections came from the old body).
// ---------------------------------------------------------------------------
let migrated = `<!DOCTYPE html>
<html lang="en">
<head>${head}</head>
${shellTop}${mainSections}${shellFooter}
</html>
`;

// Absolutize paths ONLY in the <main> region (the shell + head are already
// absolute / verbatim). Do a global sweep — the head SEO uses absolute https://
// URLs which the absolutizers ignore, and the shell is already absolute.
migrated = absolutizeSiblingServiceLinks(migrated);
migrated = absolutizePaths(migrated);

// ---------------------------------------------------------------------------
// 6. Back up the original, write the migrated file.
// ---------------------------------------------------------------------------
fs.writeFileSync(`${filePath}.bak`, original, 'utf8');
fs.writeFileSync(filePath, migrated, 'utf8');

// ---------------------------------------------------------------------------
// 7. Summary line.
// ---------------------------------------------------------------------------
const styleRemoved = !/<style[\s>]/i.test(migrated);
const mainCss = /href="\/assets\/css\/main\.css"/.test(migrated);
const h1Count = (migrated.match(/<h1\b/gi) || []).length;
const absolutePaths = !/(src|href)="\.\.\//.test(migrated);

console.log(
  `migrated ${slug}: styleRemoved=${styleRemoved} mainCss=${mainCss} h1Count=${h1Count} absolutePaths=${absolutePaths}`,
);
