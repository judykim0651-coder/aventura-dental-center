# Aventura Dental Center — Static HTML Replica

**Source site:** https://aventuradentalcenter.com/
**Scraped:** July 2, 2026
**Template reference:** `medical_services_2` (Leverage Local / levloc-next-app)
**Purpose:** Static HTML replica of the live site, rebuilt to match the `medical_services_2` template with a shared CSS/JS design system instead of per-page embedded styles.

---

## Site Structure

```
aventura-dental-wireframe/
├── assets/
│   ├── css/
│   │   ├── main.css              Entry point — @imports the 4 files below
│   │   ├── tokens.css            Design tokens (HSL colors, radius, shadows, fonts)
│   │   ├── base.css              Reset, layout primitives, scroll-animate
│   │   ├── components.css        Nav pill, buttons, cards, carousels, footer
│   │   └── sections.css          Page-specific sections (hero, about, services,
│   │                             locations, contact, blog list, blog post, team)
│   └── js/
│       ├── nav.js                Sticky nav, mobile menu, scroll-reveal observer
│       ├── hero-carousel.js      Home hero carousel
│       ├── reviews-carousel.js   Reviews carousel
│       ├── faq-accordion.js      FAQ accordion (home/about)
│       ├── stats-counter.js      Animated stat counters
│       └── contact-form-embed.js LeadConnector (GHL) form embed loader
│
├── img/                          Real images downloaded from source
├── index.html                    Home page
├── about.html                    About — history, gallery, mission, values, FAQ
├── services.html                 All 17 services listing
├── blog.html                     Blog listing — 14 posts, static filters
├── team.html                     Team — Dr. David Bistritz
├── contact.html                  Contact form (GHL embed) + map
├── locations.html                15 service area locations
├── privacy-policy.html           Privacy policy
├── terms.html                    Terms of service
│
├── services/                     17 individual service detail pages
│   ├── all-on-4-implants.html
│   ├── composite-fillings.html
│   ├── dental-bonding.html
│   ├── dental-checkup.html
│   ├── dental-cleaning-examinations.html
│   ├── dental-crowns-bridges.html
│   ├── dental-implants.html
│   ├── dental-veneers-laminates.html
│   ├── dentures-partial-dentures.html
│   ├── emergency-dentist.html
│   ├── full-mouth-reconstruction.html
│   ├── invisalign-dentist.html
│   ├── invisalign-vs-braces.html
│   ├── professional-teeth-whitening.html
│   ├── root-canal-treatment.html
│   ├── smile-makeover.html
│   └── tooth-extraction.html
│
├── BLOG/                         14 full-length blog articles
│   ├── complete-guide-tooth-pain.html
│   ├── confidence-curve.html
│   ├── daily-habits-oral-health.html
│   ├── dental-checkups-guide.html
│   ├── dental-fillings.html
│   ├── dental-implants-guide.html
│   ├── discovering-clear-aligners.html
│   ├── expert-guide-dental-crowns.html
│   ├── hidden-costs-skipping-checkups.html
│   ├── hidden-secrets-dental-xrays.html
│   ├── how-often-visit-dentist.html
│   ├── modern-dental-fillings.html
│   ├── porcelain-vs-composite-veneers.html
│   └── preventive-dentistry.html
│
└── team/
    └── dr-david-bistritz.html    Doctor detail page
```

**Total: 41 HTML pages** — all fully linked with relative paths, breadcrumbs, and consistent navigation.

---

## Design

Rebuilt to replicate the **`medical_services_2`** template.

- **Shared design system** — all pages link a single stylesheet (`assets/css/main.css`) that imports `tokens.css`, `base.css`, `components.css`, and `sections.css`. No more embedded per-page CSS on the migrated pages.
- **Design tokens** (`tokens.css`) — colors defined in HSL (`--primary: 195 100% 40%` teal), radius, shadows, and font variables, mirroring the template.
- **Typography:** `Rubik` (Google Fonts) with a system-font fallback.
- **Shared behavior** (`assets/js/`) — sticky pill navigation, mobile overlay menu, scroll-reveal animations, carousels, FAQ accordion, stat counters, and the LeadConnector contact-form embed.
- **Responsive:** mobile-first, matching the template's breakpoints (`640/768/1024px`).
- **Shared header/footer** — floating pill nav + CTA header and the site footer are consistent across every page.

Pages can still be opened directly from the filesystem (`file://`) since all assets use relative paths.

---

## Images

- **29 images** downloaded from the live site's Supabase storage and placed in `img/`
- All HTML pages reference images via relative paths (`img/filename.ext` or `../img/filename.ext`)
- 5 blog-specific images could not be found on the live server and are missing from `img/`

---

## Key Business Data

| Field | Value |
|-------|-------|
| Name | Aventura Dental Center |
| Address | 18171 Biscayne Blvd, Aventura, FL 33160 |
| Phone | (305) 933-2501 |
| Email | info@aventuradentalcenter.com |
| Dentist | Dr. David S. Bistritz, DDS |
| Founded | 1989 |
| Hours | Mon–Thu 8:00am–6:00pm, Fri 8:00am–1:00pm, Sat–Sun Closed |
| Platform | Leverage Local |
| Appointments | PatientsReach |

## Social Media

- Yelp: https://www.yelp.com/biz/aventura-dental-center-aventura
- Google: https://share.google/OhvyXs4F5b7BVcNx4
- Facebook: https://www.facebook.com/DrDavidSBistritzDDSAventuraDentalCenter
- Instagram: https://www.instagram.com/aventuradentalcenter/
- Google Reviews: https://g.page/r/CQ5GxNfXPQSpEBM/review

## Blog Tags

- AventuraDentalCenter
- DentalTreatment
- Uncategorized
- Veneers
- ToothPain

---

## Modifications Log


- **Shared CSS/JS architecture** — introduced `assets/css/` (`main.css` importing `tokens.css`, `base.css`, `components.css`, `sections.css`) and `assets/js/` (`nav.js`, `hero-carousel.js`, `reviews-carousel.js`, `faq-accordion.js`, `stats-counter.js`, `contact-form-embed.js`).
- **Home (`index.html`)** — rebuilt: hero, stats, services, FAQ accordion, single-member team, reviews carousel, contact.
- **About (`about.html`)** — breadcrumb + info, gallery, mission, values, FAQ, contact. Removed the dark page hero.
- **Services (`services.html`)** — breadcrumb + header + 17 service cards linking to `services/`.
- **Locations (`locations.html`)** — 15 location cards in a 2-column grid with anchors.
- **Contact (`contact.html`)** — `primary/10` band + LeadConnector (GHL) form embed + map.
- **Blog list (`blog.html`)** — uppercase header, "14 posts found", static filter bar, 3-col grid of overlay post cards linking to `BLOG/`.
- **Team (`team.html`)** — breadcrumb, uppercase header + bio, `TeamCard` grid, back button. Removed dark hero and stray contact section.
- **Blog detail (`BLOG/*.html`)** — added the `.blog-post-*` styles (2/3 article + sticky sidebar, TOC, prose, author/share cards, related posts) and removed orphaned React/Tailwind markup that had leaked into 13 of the 14 files.
- **Fix — blank blog pages** — `nav.js` scroll-reveal now reveals `.scroll-animate` elements taller than the viewport immediately (the `IntersectionObserver` `threshold: 0.15` was never reached by the full-height blog-post wrapper, leaving pages blank).

---
